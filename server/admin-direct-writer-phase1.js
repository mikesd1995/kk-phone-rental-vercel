'use strict';

// KK Phone Rental — Direct Google Sheets Writer Phase 1.
//
// Phase 1 deliberately routes only update-in-place actions whose business state is
// idempotent when the same request is delivered more than once:
//   - updateEvent (poster upload stays on Apps Script)
//   - updatePackage
//   - upsertEventOverride only when exactly one override row already exists
//
// Create Event, new Override creation, Booking and Asset mutations stay on the
// legacy Apps Script writer until their lock/transaction semantics are replaced.
//
// Production routing is disabled unless BOTH the foundation gates and the
// explicit per-action Phase-1 allowlist are enabled.

const crypto=require('node:crypto');
const DirectWriter=require('./admin-direct-writer.js');
const VisibilityGuard=require('./event-visibility-owner-guard.js');

const VERSION='admin-direct-google-writer-phase1-v1';
const ADMIN_SOURCE='direct-google-sheets-v1';
const SUPPORTED_ACTIONS=Object.freeze(['updateEvent','updatePackage','upsertEventOverride']);
const WRITE_SHEETS=Object.freeze([
  '01_Events',
  '03_Packages',
  '04_Event_Overrides',
  '09_Web_Packages',
  '18_Event_Visibility_Locks',
  '15_Admin_Audit_Log'
]);
const SHEET_START_ROWS=Object.freeze({
  '01_Events':5,
  '03_Packages':5,
  '04_Event_Overrides':5,
  '09_Web_Packages':5,
  '18_Event_Visibility_Locks':2
});

function text(v){return String(v===undefined||v===null?'':v).trim();}
function isBlank(v){return v===''||v===null||v===undefined;}
function isTrue(v){return ['1','true','yes','on'].includes(text(v).toLowerCase());}

function configuredActions(env=process.env){
  const wanted=new Set(String(env.KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS||'')
    .split(',')
    .map(v=>v.trim())
    .filter(Boolean));
  return SUPPORTED_ACTIONS.filter(a=>wanted.has(a));
}

function routingState(env=process.env){
  const writer=DirectWriter.state(env);
  const actions=configuredActions(env);
  return {
    version:VERSION,
    writer_ready:!!writer.ready,
    configured_actions:actions,
    ready:!!(writer.ready&&actions.length),
    booking_routed:false,
    asset_routed:false,
    create_event_routed:false,
    create_override_routed:false
  };
}

function normalizeTemplateId(raw,eventId){
  let id=text(raw);
  const p=id.indexOf('TPL-');
  if(p>=0) id=id.slice(p);
  else if(eventId&&id.startsWith(String(eventId)+'-')) id=id.slice(String(eventId).length+1);
  return id;
}

function boolOrBlank(v){
  if(isBlank(v)) return '';
  return isTrue(v);
}

function nonNegativeNumber(v,field,allowBlank=false){
  if(isBlank(v)&&allowBlank) return '';
  const n=Number(v||0);
  if(!Number.isFinite(n)||n<0){
    const err=new Error(String(field||'value')+' must be a non-negative number');
    err.code='DIRECT_PHASE1_VALIDATION_FAILED';
    throw err;
  }
  return n;
}

function normalizeEventDate(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())){
    return [value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate()];
  }
  const raw=text(value);
  if(!raw) return null;
  let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m){
    let y=Number(m[1]); if(y>2500)y-=543;
    return [y,Number(m[2]),Number(m[3])];
  }
  m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if(m){
    let y=Number(m[3]); if(y>2500)y-=543;
    return [y,Number(m[2]),Number(m[1])];
  }
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())) return null;
  return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];
}

function dateSerial(value){
  const parts=normalizeEventDate(value);
  if(!parts){
    const err=new Error('event_date is invalid');
    err.code='DIRECT_PHASE1_VALIDATION_FAILED';
    throw err;
  }
  const [y,m,d]=parts;
  const ms=Date.UTC(y,m-1,d);
  const check=new Date(ms);
  if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d){
    const err=new Error('event_date is invalid');
    err.code='DIRECT_PHASE1_VALIDATION_FAILED';
    throw err;
  }
  return (ms-Date.UTC(1899,11,30))/86400000;
}

function dateTimeSerial(value=new Date()){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime())) return 0;
  return (d.getTime()-Date.UTC(1899,11,30))/86400000;
}

function padRow(row,width){
  const out=Array.isArray(row)?row.slice(0,width):[];
  while(out.length<width) out.push('');
  return out;
}

function rowMatchesId(rows,id,index=0){
  const wanted=text(id);
  return (rows||[]).map((row,i)=>({row:padRow(row,Math.max((row||[]).length,index+1)),index:i}))
    .filter(x=>text(x.row[index])===wanted);
}

function visibilityLockObjects(rows){
  return (rows||[]).map((row,i)=>{
    const r=padRow(row,14);
    return {
      __row_number:SHEET_START_ROWS['18_Event_Visibility_Locks']+i,
      lock_id:text(r[0]),event_id:text(r[1]),event_name:r[2]||'',event_date:r[3]||'',venue:r[4]||'',
      identity_key:r[5]||'',lock_state:text(r[6]).toUpperCase(),lock_reason:r[7]||'',first_locked_at:r[8]||'',
      last_changed_at:r[9]||'',changed_by:r[10]||'',explicit_reopen_required:isTrue(r[11]),
      source_evidence:r[12]||'',notes:r[13]||''
    };
  }).filter(x=>x.lock_id||x.event_id);
}

function lockRowValues(eventId,eventRow,existing,payload,state){
  const now=text(payload.visibility_changed_at)||new Date().toISOString();
  const event={
    event_id:eventId,event_name:eventRow[1]||'',event_date:eventRow[2]||'',venue:eventRow[3]||''
  };
  const prior=existing||{};
  const reason=state==='LOCKED'
    ? text(payload.visibility_lock_reason||prior.lock_reason||'OWNER_HIDE_VIA_ADMIN')
    : text(prior.lock_reason||'HISTORICAL_OWNER_HIDE');
  const changedBy=text(payload.visibility_changed_by)||(state==='REOPENED'?'OWNER_EXPLICIT_REOPEN':'OWNER_EXPLICIT_HIDE');
  return [
    text(prior.lock_id)||('LOCK|'+eventId),
    eventId,event.event_name,event.event_date,event.venue,
    VisibilityGuard.eventIdentityKey(event),
    state,reason,
    text(prior.first_locked_at)||(state==='LOCKED'?now:''),
    now,changedBy,state==='LOCKED',
    text(payload.visibility_source_evidence||payload.request_id||prior.source_evidence),
    state==='LOCKED'
      ? 'Persistent owner tombstone; data-plane formulas fail closed.'
      : 'Historical owner tombstone reopened explicitly; history retained to prevent silent recreation.'
  ];
}

function priceLensCanonical(v){
  const raw=text(v);
  const norm=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(norm==='ZEISS235X'||norm==='ZEISS235'||norm==='G1') return 'ZEISS_2_35X_G1';
  if(norm==='G2') return '__RETIRED_G2__';
  return raw.toUpperCase();
}

function webRowMatchesTemplate(webRow,eventId,templateId,targetPackage){
  const row=padRow(webRow,14);
  const eid=text(eventId);
  const tid=text(templateId);
  const packageId=text(row[0]);
  const rowEvent=text(row[1]);
  if(!packageId||rowEvent!==eid) return false;
  const rowTemplate=normalizeTemplateId(packageId,eid);
  if(rowTemplate===tid||packageId===tid) return true;
  if(!targetPackage) return false;
  return text(row[2])===text(targetPackage[2]) &&
    text(row[3])===text(targetPackage[1]) &&
    priceLensCanonical(row[5])===priceLensCanonical(targetPackage[3]);
}

function webPackagePriceFormula(rowNumber,templateId){
  const r=Number(rowNumber);
  const tid=String(templateId||'').replace(/"/g,'""');
  const tplExpr='"'+tid+'"';
  const standardExpr=`IFERROR(VLOOKUP(${tplExpr},'03_Packages'!$A$5:$E,5,FALSE),0)`;
  return `=IF(B${r}="","",IFERROR(LOOKUP(2,1/(('04_Event_Overrides'!$A$5:$A=B${r})*('04_Event_Overrides'!$B$5:$B=${tplExpr})*('04_Event_Overrides'!$C$5:$C<>"")),'04_Event_Overrides'!$C$5:$C),${standardExpr}))`;
}

function mutation(sheet,row,column,values){
  return {sheet,row:Number(row),column:Number(column),values:Array.isArray(values)?values.slice():[]};
}

function readback(range,expected,render='UNFORMATTED_VALUE'){
  return {range,expected:Array.isArray(expected)?expected.slice():[],render};
}

function buildUpdateEventPlan(payload,data){
  if(text(payload.poster_url)){
    return {legacy_required:true,reason:'POSTER_WRITE_REQUIRES_APPS_SCRIPT'};
  }
  const eventId=text(payload.event_id);
  if(!eventId) throw Object.assign(new Error('event_id is required'),{code:'DIRECT_PHASE1_VALIDATION_FAILED'});
  const matches=rowMatchesId(data.events,eventId,0);
  if(!matches.length) throw Object.assign(new Error('Event not found: '+eventId),{code:'DIRECT_PHASE1_EVENT_NOT_FOUND'});
  if(matches.length!==1) throw Object.assign(new Error('Event identity is ambiguous: '+eventId),{code:'DIRECT_PHASE1_EVENT_ID_AMBIGUOUS'});
  const hit=matches[0];
  const current=padRow(hit.row,8);
  const lockObjects=visibilityLockObjects(data.visibility_locks||[]);
  const eventSnapshot={
    event_id:eventId,event_name:current[1]||'',event_date:current[2]||'',venue:current[3]||'',active_on_web:current[6]
  };
  const checked=VisibilityGuard.evaluateSnapshotTransition({events:[eventSnapshot],visibility_locks:lockObjects},payload);
  if(!checked.ok){
    const err=new Error(checked.error||checked.code);
    err.code=checked.code;
    err.visibility_guard=checked;
    throw err;
  }
  const next=current.slice();
  if(payload.event_name) next[1]=text(payload.event_name);
  if(payload.event_date) next[2]=dateSerial(payload.event_date);
  if(payload.venue) next[3]=text(payload.venue);
  if(payload.status) next[5]=text(payload.status).toLowerCase();
  const active=boolOrBlank(payload.active_on_web);
  if(active!=='') next[6]=active;
  if(payload.note!==undefined&&payload.note!=='') next[7]=payload.note;

  const sheetRow=SHEET_START_ROWS['01_Events']+hit.index;
  const mutations=[mutation('01_Events',sheetRow,1,next)];
  const readbacks=[readback(`01_Events!A${sheetRow}:H${sheetRow}`,next)];

  let visibilityLockState='UNCHANGED';
  if(active!==''&&(active===false||(active===true&&VisibilityGuard.hasExplicitOwnerReopen(payload)))){
    const existing=lockObjects.find(x=>text(x.event_id)===eventId)||VisibilityGuard.findVisibilityHistory({visibility_locks:lockObjects},{event_id:eventId,event_name:next[1],event_date:next[2],venue:next[3]});
    const state=active===false?'LOCKED':'REOPENED';
    const lockValues=lockRowValues(eventId,next,existing,payload,state);
    const lockRow=existing&&Number(existing.__row_number)>0?Number(existing.__row_number):SHEET_START_ROWS['18_Event_Visibility_Locks']+(data.visibility_locks||[]).length;
    mutations.push(mutation('18_Event_Visibility_Locks',lockRow,1,lockValues));
    readbacks.push(readback(`18_Event_Visibility_Locks!A${lockRow}:N${lockRow}`,lockValues));
    visibilityLockState=state;
  }

  // Unlike the Apps Script implementation, the direct writer does not run any
  // full-column price repair while updating an Event. Therefore the safest way
  // to preserve manual/formula package prices is to not write column H at all.
  const preserved=(data.web||[])
    .map(row=>padRow(row,14))
    .filter(row=>text(row[1])===eventId&&text(row[0])).length;

  return {
    action:'updateEvent',
    result:{
      event_id:eventId,row_number:sheetRow,poster_url:current[4]||'',
      poster_drive_file_id:'',poster_public_checked:false,poster_public_warning:'',
      web_package_prices_preserved:preserved,
      visibility_lock_state:visibilityLockState,
      direct_writer_phase1:true
    },
    mutations,readbacks
  };
}

function buildUpdatePackagePlan(payload,data){
  const templateId=text(payload.template_id);
  if(!templateId) throw Object.assign(new Error('template_id is required'),{code:'DIRECT_PHASE1_VALIDATION_FAILED'});
  const matches=rowMatchesId(data.packages,templateId,0);
  if(!matches.length) throw Object.assign(new Error('Package not found: '+templateId),{code:'DIRECT_PHASE1_PACKAGE_NOT_FOUND'});
  if(matches.length!==1) throw Object.assign(new Error('Package identity is ambiguous: '+templateId),{code:'DIRECT_PHASE1_PACKAGE_ID_AMBIGUOUS'});
  const hit=matches[0];
  const next=padRow(hit.row,10);
  if(payload.standard_price!==''&&payload.standard_price!==undefined) next[4]=nonNegativeNumber(payload.standard_price,'standard_price',false);
  if(payload.display_name) next[5]=text(payload.display_name);
  const active=boolOrBlank(payload.active);
  if(active!=='') next[7]=active;
  if(payload.use_case!==undefined&&payload.use_case!=='') next[9]=payload.use_case;
  const sheetRow=SHEET_START_ROWS['03_Packages']+hit.index;
  return {
    action:'updatePackage',
    result:{template_id:templateId,row_number:sheetRow,direct_writer_phase1:true},
    mutations:[mutation('03_Packages',sheetRow,1,next)],
    readbacks:[readback(`03_Packages!A${sheetRow}:J${sheetRow}`,next)]
  };
}

function buildOverridePlan(payload,data){
  const eventId=text(payload.event_id);
  let templateId=normalizeTemplateId(payload.template_id,eventId);
  if(!eventId||!templateId) throw Object.assign(new Error('Please select event and package'),{code:'DIRECT_PHASE1_VALIDATION_FAILED'});

  const eventMatches=rowMatchesId(data.events,eventId,0);
  if(eventMatches.length!==1){
    if(!eventMatches.length) throw Object.assign(new Error('Event not found: '+eventId),{code:'DIRECT_PHASE1_EVENT_NOT_FOUND'});
    throw Object.assign(new Error('Event identity is ambiguous: '+eventId),{code:'DIRECT_PHASE1_EVENT_ID_AMBIGUOUS'});
  }
  const packageMatches=rowMatchesId(data.packages,templateId,0);
  if(packageMatches.length!==1){
    if(!packageMatches.length) throw Object.assign(new Error('Template/package not found: '+templateId),{code:'DIRECT_PHASE1_PACKAGE_NOT_FOUND'});
    throw Object.assign(new Error('Package identity is ambiguous: '+templateId),{code:'DIRECT_PHASE1_PACKAGE_ID_AMBIGUOUS'});
  }

  const overrideMatches=(data.overrides||[]).map((row,i)=>({row:padRow(row,7),index:i}))
    .filter(x=>text(x.row[0])===eventId&&text(x.row[1])===templateId);
  if(!overrideMatches.length) return {legacy_required:true,reason:'OVERRIDE_CREATE_REQUIRES_APPS_SCRIPT_LOCK'};
  if(overrideMatches.length!==1) return {legacy_required:true,reason:'OVERRIDE_DUPLICATE_CLEANUP_REQUIRES_APPS_SCRIPT_LOCK'};

  const hasPrice=!(payload.override_price===''||payload.override_price===null||payload.override_price===undefined);
  const price=hasPrice?nonNegativeNumber(payload.override_price,'override_price',false):'';
  const active=boolOrBlank(payload.active_override);
  const note=payload.override_note===undefined?'':String(payload.override_note||'');
  const sort=isBlank(payload.sort_order_override)?'':nonNegativeNumber(payload.sort_order_override,'sort_order_override',false);
  const useCase=payload.use_case_override===undefined?'':String(payload.use_case_override||'');

  const hit=overrideMatches[0];
  const overrideRow=SHEET_START_ROWS['04_Event_Overrides']+hit.index;
  const next=[eventId,templateId,price,active,note,sort,useCase];
  const mutations=[mutation('04_Event_Overrides',overrideRow,1,next)];
  const readbacks=[readback(`04_Event_Overrides!A${overrideRow}:G${overrideRow}`,next)];

  const targetPackage=padRow(packageMatches[0].row,10);
  let refreshed=0;
  (data.web||[]).forEach((row,i)=>{
    if(!webRowMatchesTemplate(row,eventId,templateId,targetPackage)) return;
    const physical=SHEET_START_ROWS['09_Web_Packages']+i;
    const nextPrice=hasPrice?price:webPackagePriceFormula(physical,templateId);
    mutations.push(mutation('09_Web_Packages',physical,8,[nextPrice]));
    readbacks.push(readback(`09_Web_Packages!H${physical}:H${physical}`,[nextPrice],hasPrice?'UNFORMATTED_VALUE':'FORMULA'));
    refreshed++;
  });

  return {
    action:'upsertEventOverride',
    result:{
      event_id:eventId,template_id:templateId,row_number:overrideRow,
      override_price:price,active_override:active,use_case_override:useCase,
      duplicate_overrides_cleared:0,web_price_rows_refreshed:refreshed,
      direct_writer_phase1:true
    },
    mutations,readbacks
  };
}

function buildPlan(payload,data){
  const action=text(payload&&payload.action);
  if(action==='updateEvent') return buildUpdateEventPlan(payload,data||{});
  if(action==='updatePackage') return buildUpdatePackagePlan(payload,data||{});
  if(action==='upsertEventOverride') return buildOverridePlan(payload,data||{});
  throw Object.assign(new Error('Direct writer action is not supported'),{code:'DIRECT_PHASE1_ACTION_NOT_SUPPORTED'});
}

function extendedValue(value){
  if(value===undefined||value===null||value==='') return null;
  if(typeof value==='boolean') return {boolValue:value};
  if(typeof value==='number'&&Number.isFinite(value)) return {numberValue:value};
  const s=String(value);
  if(s.startsWith('=')) return {formulaValue:s};
  return {stringValue:s};
}

function cellData(value){
  const v=extendedValue(value);
  return v?{userEnteredValue:v}:{};
}

function updateCellsRequest(sheetId,row,column,values){
  const startRow=Number(row)-1;
  const startCol=Number(column)-1;
  if(!Number.isInteger(startRow)||startRow<0||!Number.isInteger(startCol)||startCol<0||!Array.isArray(values)||!values.length){
    throw Object.assign(new Error('Invalid direct writer grid mutation'),{code:'DIRECT_PHASE1_MUTATION_INVALID'});
  }
  return {
    updateCells:{
      range:{
        sheetId:Number(sheetId),
        startRowIndex:startRow,endRowIndex:startRow+1,
        startColumnIndex:startCol,endColumnIndex:startCol+values.length
      },
      rows:[{values:values.map(cellData)}],
      fields:'userEnteredValue'
    }
  };
}

function auditRow(action,result,requestId,now=new Date()){
  const summary=JSON.stringify(Object.assign({},result||{},{request_id:String(requestId||'')})).slice(0,800);
  return [
    dateTimeSerial(now),VERSION,String(action||''),'OK',0,summary,
    result&&result.event_id||'',result&&result.booking_id||'',
    result&&result.row_number||'',ADMIN_SOURCE
  ];
}

function appendAuditRequest(sheetId,row){
  return {
    appendCells:{
      sheetId:Number(sheetId),
      rows:[{values:(row||[]).map(cellData)}],
      fields:'userEnteredValue'
    }
  };
}

function requestsForPlan(plan,sheetMap,requestId,now=new Date()){
  if(!plan||!Array.isArray(plan.mutations)||!plan.action) throw Object.assign(new Error('Direct writer plan is invalid'),{code:'DIRECT_PHASE1_PLAN_INVALID'});
  const requests=[];
  for(const m of plan.mutations){
    if(!WRITE_SHEETS.includes(m.sheet)||m.sheet==='15_Admin_Audit_Log'){
      throw Object.assign(new Error('Direct writer mutation sheet is not allowed'),{code:'DIRECT_PHASE1_SHEET_NOT_ALLOWED'});
    }
    const id=sheetMap[m.sheet];
    if(!Number.isInteger(Number(id))) throw Object.assign(new Error('Missing sheet metadata: '+m.sheet),{code:'DIRECT_PHASE1_SHEET_METADATA_MISSING'});
    requests.push(updateCellsRequest(id,m.row,m.column,m.values));
  }
  const auditId=sheetMap['15_Admin_Audit_Log'];
  if(!Number.isInteger(Number(auditId))) throw Object.assign(new Error('Missing audit sheet metadata'),{code:'DIRECT_PHASE1_SHEET_METADATA_MISSING'});
  requests.push(appendAuditRequest(auditId,auditRow(plan.action,plan.result,requestId,now)));
  return requests;
}

async function googleJson(url,{method='GET',token,body,fetchImpl=global.fetch,timeoutMs=12000}={}){
  if(!token) throw Object.assign(new Error('Google writer token missing'),{code:'DIRECT_PHASE1_TOKEN_MISSING'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{
      method,
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),
      signal:controller.signal
    });
    const parsed=await res.json().catch(()=>({}));
    if(!res.ok){
      const err=new Error('Google Sheets API request failed');
      err.code='DIRECT_PHASE1_GOOGLE_HTTP_'+String(res.status||'UNKNOWN');
      err.httpStatus=Number(res.status||0);
      throw err;
    }
    return parsed;
  }finally{clearTimeout(timer);}
}

async function readValues(range,{token,render='UNFORMATTED_VALUE',fetchImpl=global.fetch}={}){
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(DirectWriter.CORE_SHEET_ID)+'/values/'+encodeURIComponent(range)+
    '?majorDimension=ROWS&valueRenderOption='+encodeURIComponent(render)+'&dateTimeRenderOption=SERIAL_NUMBER';
  const body=await googleJson(url,{token,fetchImpl});
  return Array.isArray(body.values)?body.values:[];
}

async function loadModel(action,{token,fetchImpl=global.fetch}={}){
  const base={events:[],packages:[],overrides:[],web:[],webPriceFormula:[],visibility_locks:[]};
  if(action==='updateEvent'){
    const [events,web,visibility_locks]=await Promise.all([
      readValues('01_Events!A5:H',{token,fetchImpl}),
      readValues('09_Web_Packages!A5:N',{token,fetchImpl}),
      readValues('18_Event_Visibility_Locks!A2:N',{token,fetchImpl})
    ]);
    return Object.assign(base,{events,web,visibility_locks});
  }
  if(action==='updatePackage'){
    base.packages=await readValues('03_Packages!A5:J',{token,fetchImpl});
    return base;
  }
  if(action==='upsertEventOverride'){
    const [events,packages,overrides,web]=await Promise.all([
      readValues('01_Events!A5:H',{token,fetchImpl}),
      readValues('03_Packages!A5:J',{token,fetchImpl}),
      readValues('04_Event_Overrides!A5:G',{token,fetchImpl}),
      readValues('09_Web_Packages!A5:N',{token,fetchImpl})
    ]);
    return Object.assign(base,{events,packages,overrides,web});
  }
  return base;
}

async function sheetMap({token,fetchImpl=global.fetch}={}){
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(DirectWriter.CORE_SHEET_ID)+
    '?fields=sheets.properties(sheetId,title)';
  const body=await googleJson(url,{token,fetchImpl});
  const out={};
  for(const item of body.sheets||[]){
    const p=item&&item.properties||{};
    if(WRITE_SHEETS.includes(String(p.title||''))) out[String(p.title)]=Number(p.sheetId);
  }
  return out;
}

async function executeBatch(requests,{token,fetchImpl=global.fetch}={}){
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(DirectWriter.CORE_SHEET_ID)+':batchUpdate';
  return googleJson(url,{method:'POST',token,fetchImpl,body:{requests},timeoutMs:15000});
}

function normalizeCell(v){
  return v===undefined||v===null?'':v;
}

function rowsEqual(actual,expected){
  const a=padRow(actual,expected.length).map(normalizeCell);
  const e=(expected||[]).map(normalizeCell);
  return JSON.stringify(a)===JSON.stringify(e);
}

async function verifyReadbacks(plan,{token,fetchImpl=global.fetch}={}){
  for(const rb of plan.readbacks||[]){
    const values=await readValues(rb.range,{token,render:rb.render||'UNFORMATTED_VALUE',fetchImpl});
    if(!rowsEqual(values[0]||[],rb.expected||[])){
      const err=new Error('Direct writer exact readback mismatch at '+rb.range);
      err.code='DIRECT_PHASE1_READBACK_MISMATCH';
      throw err;
    }
  }
  return true;
}

async function verifyAudit(requestId,{token,fetchImpl=global.fetch}={}){
  const rows=await readValues('15_Admin_Audit_Log!A:J',{token,fetchImpl});
  for(let i=rows.length-1;i>=Math.max(0,rows.length-250);i--){
    const summary=rows[i]&&rows[i][5];
    if(typeof summary!=='string'||!summary.includes(String(requestId))) continue;
    try{
      const parsed=JSON.parse(summary);
      if(String(parsed.request_id||'')===String(requestId)) return {ok:true,row_number:i+1};
    }catch(_){}
  }
  const err=new Error('Direct writer audit readback missing');
  err.code='DIRECT_PHASE1_AUDIT_READBACK_MISSING';
  throw err;
}

async function findAuditRequest(requestId,{token,fetchImpl=global.fetch}={}){
  const wanted=String(requestId||'');
  if(!wanted) return null;
  const rows=await readValues('15_Admin_Audit_Log!A:J',{token,fetchImpl});
  for(let i=rows.length-1;i>=Math.max(0,rows.length-500);i--){
    const row=rows[i]||[];
    const summary=row[5];
    if(typeof summary!=='string'||!summary.includes(wanted)) continue;
    try{
      const parsed=JSON.parse(summary);
      if(String(parsed.request_id||'')!==wanted) continue;
      return {
        row_number:i+1,
        action:String(row[2]||''),
        status:String(row[3]||''),
        result:parsed
      };
    }catch(_){}
  }
  return null;
}

function validRequestId(value){
  const v=text(value);
  return /^[A-Za-z0-9._:-]{8,128}$/.test(v)?v:'';
}

async function tryExecute(payload,options={}){
  const env=options.env||process.env;
  const action=text(payload&&payload.action);
  const state=routingState(env);
  if(!SUPPORTED_ACTIONS.includes(action)) return {handled:false,reason:'ACTION_NOT_SUPPORTED',state};
  if(!state.configured_actions.includes(action)) return {handled:false,reason:'ACTION_NOT_ROUTED',state};
  if(!state.writer_ready) return {handled:false,reason:'WRITER_NOT_READY',state};

  const suppliedRequestId=validRequestId(payload&&payload.request_id);
  const requestId=suppliedRequestId||crypto.randomUUID();
  const fetchImpl=options.fetchImpl||global.fetch;
  const tokenProvider=options.tokenProvider||DirectWriter.getAccessToken;
  const load=options.loadModel||loadModel;
  const metadata=options.sheetMap||sheetMap;
  const batch=options.executeBatch||executeBatch;
  const verify=options.verifyReadbacks||verifyReadbacks;
  const verifyAuditFn=options.verifyAudit||verifyAudit;
  const findAudit=options.findAuditRequest||findAuditRequest;

  const token=await tokenProvider({env,fetchImpl});
  if(suppliedRequestId){
    const prior=await findAudit(requestId,{token,fetchImpl,env});
    if(prior && prior.status==='OK' && prior.action===action){
      return {
        handled:true,status:200,request_id:requestId,
        body:{
          ok:true,
          data:Object.assign({},prior.result||{},{request_id:requestId,audit_row_number:prior.row_number,idempotent_replay:true}),
          direct_writer:true,
          direct_writer_version:VERSION,
          write_transport:'direct-google-sheets',
          no_legacy_fallback:true,
          idempotent_replay:true
        }
      };
    }
  }
  const model=await load(action,{token,fetchImpl,env});
  const plan=buildPlan(payload||{},model);
  if(plan.legacy_required) return {handled:false,reason:plan.reason||'LEGACY_REQUIRED',state,request_id:requestId};

  const map=await metadata({token,fetchImpl,env});
  const requests=requestsForPlan(plan,map,requestId,options.now||new Date());
  let mutationCommitted=false;
  try{
    await batch(requests,{token,fetchImpl,env});
    mutationCommitted=true;
    await verify(plan,{token,fetchImpl,env});
    const audit=await verifyAuditFn(requestId,{token,fetchImpl,env});
    return {
      handled:true,status:200,request_id:requestId,
      body:{
        ok:true,
        data:Object.assign({},plan.result,{request_id:requestId,audit_row_number:audit.row_number}),
        direct_writer:true,
        direct_writer_version:VERSION,
        write_transport:'direct-google-sheets',
        no_legacy_fallback:true
      }
    };
  }catch(err){
    if(mutationCommitted) err.mutation_committed=true;
    err.no_legacy_fallback=true;
    throw err;
  }
}

module.exports={
  VERSION,ADMIN_SOURCE,SUPPORTED_ACTIONS,WRITE_SHEETS,
  configuredActions,routingState,normalizeTemplateId,boolOrBlank,nonNegativeNumber,
  normalizeEventDate,dateSerial,dateTimeSerial,visibilityLockObjects,lockRowValues,priceLensCanonical,webRowMatchesTemplate,
  webPackagePriceFormula,buildUpdateEventPlan,buildUpdatePackagePlan,buildOverridePlan,buildPlan,
  extendedValue,cellData,updateCellsRequest,auditRow,appendAuditRequest,requestsForPlan,
  readValues,loadModel,sheetMap,executeBatch,rowsEqual,verifyReadbacks,verifyAudit,findAuditRequest,validRequestId,tryExecute
};
