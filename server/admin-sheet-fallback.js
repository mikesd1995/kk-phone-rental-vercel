'use strict';

// KK Phone Rental — emergency Admin direct-Sheet read-only snapshot fallback.
// This module NEVER writes. It reconstructs the Admin snapshot from Google Sheets
// only when the Apps Script snapshot upstream is unavailable.
const privateSheets = require('../api/lib/private-google-sheets.js');
const CorePrivacy = require('./core-sheet-private-reader.js');
const BookingLifecycleShadow = require('./kk-booking-lifecycle-shadow.js');
const FALLBACK_VERSION = 'admin-direct-sheet-readonly-fallback-v3.1';
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const FALLBACK_CACHE_TTL_MS = 2000;
const snapshotCache = new Map();
const snapshotInflight = new Map();
const fetchIdentity = new WeakMap();
let nextFetchIdentity = 1;

const SPECS = {
  events:       { sheet:'01_Events', range:'A4:I', header:'event_id', startRow:4 },
  bookings:     { sheet:'00_Master_Booking', range:'A4:X', header:'booking_id', startRow:4 },
  assets:       { sheet:'02_Assets', range:'A4:G', header:'asset_id', startRow:4 },
  packages:     { sheet:'03_Packages', range:'A4:J', header:'template_id', startRow:4 },
  overrides:    { sheet:'04_Event_Overrides', range:'A4:G', header:'event_id', startRow:4 },
  web_ready:    { sheet:'08_Web_Ready', range:'A4:K', header:'event_id', startRow:4 },
  web_packages: { sheet:'09_Web_Packages', range:'A4:N', header:'package_id', startRow:4 },
  customers:    { sheet:'11_Customer_Stats', range:'A1:H', header:'customer_key', startRow:1 },
  health:       { sheet:'10_Admin_Health_Check', range:'A4:D', header:'Check', startRow:4 },
  model_master: { sheet:'Model_Master', range:'A4:E', header:'model_group', startRow:4 },
  visibility_locks:{ sheet:'18_Event_Visibility_Locks', range:'A1:N', header:'lock_id', startRow:1 }
};

function parseCsv(text){
  const rows=[]; let row=[], field='', quote=false;
  const s=String(text||'');
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(quote){
      if(c==='"' && s[i+1]==='"'){ field+='"'; i++; }
      else if(c==='"') quote=false;
      else field+=c;
    }else{
      if(c==='"') quote=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c==='\n'){ row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if(field || row.length){ row.push(field.replace(/\r$/,'')); rows.push(row); }
  return rows;
}

function rowsAsObjects(csv, requiredHeader, startRow=1){
  const rows=parseCsv(csv);
  const headerIndex=rows.findIndex(r=>r.some(v=>String(v||'').trim()===requiredHeader));
  if(headerIndex<0) throw new Error('Fallback schema header not found: '+requiredHeader);
  const headers=rows[headerIndex].map(v=>String(v||'').trim());
  const out=[];
  for(let i=headerIndex+1;i<rows.length;i++){
    const r=rows[i];
    if(!r.some(v=>String(v||'').trim()!=='')) continue;
    const o={__row_number:Number(startRow||1)+i};
    headers.forEach((h,j)=>{ if(h) o[h]=r[j]===undefined?'':r[j]; });
    out.push(o);
  }
  return out;
}

function bool(v){ return ['1','true','yes','on'].includes(String(v||'').trim().toLowerCase()); }
function num(v){ const n=Number(String(v??'').replace(/,/g,'')); return Number.isFinite(n)?n:0; }
function date(v){
  const s=String(v||'').trim(); if(!s) return '';
  let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m){ let y=Number(m[3]); if(y>2500)y-=543; return String(y).padStart(4,'0')+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0'); }
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1]+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');
  return s;
}
function bangkokDay(now){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now||new Date());
}
function workflowOpen(s){ return ['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(String(s||'').trim().toLowerCase()); }
function cleanBookingNote(v){
  return String(v||'').replace(/\s*\[KK_REQ:[A-Za-z0-9._:-]{8,128}\]\s*/g,' ').replace(/\s{2,}/g,' ').trim();
}

function fetchWithTimeout(url, fetchImpl, timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs||12000);
  return fetchImpl(url,{headers:{'User-Agent':'KK-Phone-Rental-Admin-Fallback/1'},signal:controller.signal})
    .finally(()=>clearTimeout(timer));
}
function gvizUrl(sheetId,spec){
  return 'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(sheetId)+'/gviz/tq?tqx=out:csv&sheet='+encodeURIComponent(spec.sheet)+'&range='+encodeURIComponent(spec.range)+'&t='+Date.now();
}
async function readSpecPublic(sheetId,key,fetchImpl){
  const spec=SPECS[key];
  let r;
  try{
    r=await fetchWithTimeout(gvizUrl(sheetId,spec),fetchImpl,12000);
  }catch(err){
    if(!err.code) err.code=err && err.name==='AbortError' ? 'FALLBACK_GVIZ_TIMEOUT' : 'FALLBACK_GVIZ_FETCH_FAILED';
    err.dataset=key;
    throw err;
  }
  const text=await r.text();
  if(!r.ok){
    const err=new Error('Fallback GViz '+spec.sheet+' HTTP '+r.status);
    err.code='FALLBACK_GVIZ_HTTP_'+String(r.status||'UNKNOWN');
    err.dataset=key;
    throw err;
  }
  if(/<html[\s>]/i.test(text)){
    const err=new Error('Fallback GViz '+spec.sheet+' returned HTML');
    err.code='FALLBACK_GVIZ_HTML';
    err.dataset=key;
    throw err;
  }
  try{
    return rowsAsObjects(text,spec.header,spec.startRow||1);
  }catch(err){
    if(!err.code) err.code='FALLBACK_SCHEMA_HEADER_MISSING';
    err.dataset=key;
    throw err;
  }
}
function valuesAsObjects(values,requiredHeader,startRow=1){
  const rows=Array.isArray(values)?values:[];
  const headerIndex=rows.findIndex(r=>Array.isArray(r) && r.some(v=>String(v||'').trim()===requiredHeader));
  if(headerIndex<0) throw new Error('Fallback private schema header not found: '+requiredHeader);
  const headers=(rows[headerIndex]||[]).map(v=>String(v||'').trim());
  const out=[];
  for(let i=headerIndex+1;i<rows.length;i++){
    const r=Array.isArray(rows[i])?rows[i]:[];
    if(!r.some(v=>String(v||'').trim()!=='')) continue;
    const o={__row_number:Number(startRow||1)+i};
    headers.forEach((h,j)=>{ if(h) o[h]=r[j]===undefined?'':r[j]; });
    out.push(o);
  }
  return out;
}

async function readSpecPrivate(sheetId,key,env,fetchImpl){
  const spec=SPECS[key];
  const values=await privateSheets.readValues({
    sheetId,
    range:spec.sheet+'!'+spec.range,
    env,
    fetchImpl
  });
  return valuesAsObjects(values,spec.header,spec.startRow||1);
}

function modelMap(rows){
  const map={};
  rows.forEach(r=>{ const k=String(r.model_group||'').trim(); if(k) map[k]={model_group:k,model_display:r.model_display||k,asset_type:String(r.asset_type||'').toLowerCase(),active:bool(r.active),notes:r.notes||''}; });
  return map;
}

function buildFromRaw(raw,sheetId,startedAt,transportMeta={}){
  const models=modelMap(raw.model_master);
  const events=raw.events.filter(r=>r.event_id).map(r=>({
    event_id:String(r.event_id||'').trim(), event_name:r.event_name||'', event_date:date(r.event_date),
    venue:r.venue||'', poster_url:r.poster_image_url||'', status:r.event_status||'',
    active_on_web:bool(r.active_on_web), note:r.event_note||'', data_health:r.data_health||''
  }));
  const eventById={}; events.forEach(e=>{eventById[e.event_id]=e;});

  const packages=raw.packages.filter(r=>r.template_id).map(r=>({
    template_id:String(r.template_id||'').trim(), model_group:r.model_group||'', package_type:r.package_type||'',
    lens_group:r.lens_group||'', standard_price:num(r.standard_price), display_name:r.display_name||'',
    active:bool(r.active), use_case:r.use_case||''
  }));
  const packageByType={}; packages.forEach(p=>{ if(p.package_type && !packageByType[p.package_type]) packageByType[p.package_type]=p.display_name||p.template_id||p.package_type; });

  const overrides=raw.overrides.filter(r=>r.event_id&&r.template_id).map(r=>({
    row_number:r.__row_number, event_id:String(r.event_id||'').trim(), template_id:String(r.template_id||'').trim(),
    override_price:String(r.override_price||'')===''?'':num(r.override_price),
    active_override:String(r.active_override||'')===''?'':bool(r.active_override),
    override_note:r.override_note||'', sort_order_override:r.sort_order_override||'', use_case_override:r.use_case_override||''
  }));

  const assets=raw.assets.filter(r=>r.asset_id).map(r=>{
    const group=String(r.model_group||'').trim(), model=models[group]||{};
    const type=String(r.asset_type||'').trim().toLowerCase();
    const status=String(r.status||'').trim();
    const setting=String(r.rentable_now||'').trim();
    return {asset_id:String(r.asset_id||'').trim(),asset_type:type,model_group:group,model_display:model.model_display||group,
      serial:r.serial_no||'',status,notes:r.notes||'',rentable_setting:setting===''?'':bool(setting),
      rentable:setting==='' ? ['available','ready'].includes(status.toLowerCase()) : bool(setting)};
  });
  const assetById={}; assets.forEach(a=>{assetById[a.asset_id]=a;});

  const bookings=raw.bookings.filter(r=>r.booking_id||r.event_id).map(r=>{
    const eventId=String(r.event_id||'').trim(), event=eventById[eventId]||{};
    const phoneId=String(r.phone_asset_id||'').trim(), lensId=String(r.lens_asset_id||'').trim();
    const phone=assetById[phoneId]||{}, lens=assetById[lensId]||{};
    const st=String(r.booking_status||'').trim().toLowerCase();
    let task=''; if(st==='picked_up')task='รับคืน/ตรวจเครื่อง'; else if(st==='prepared')task='พร้อมส่งมอบ/รอลูกค้ารับ'; else if(['pending','confirmed'].includes(st))task='เตรียมส่งมอบ'; else if(st==='returned')task='อัปโหลดไฟล์'; else if(st==='uploaded')task='ปิดงาน';
    return {row_number:r.__row_number,row_number_reliable:transportMeta.fallback_reader!=='public-gviz',booking_id:r.booking_id||'',created_at:r.created_at||'',booking_status:r.booking_status||'',
      event_id:eventId,event_name:event.event_name||eventId,event_date:event.event_date||'',venue:event.venue||'',
      customer_name:r.customer_name||'',customer_contact:r.customer_contact||'',customer_phone:r.customer_phone||'',
      contact_channel:r.channel||'',package_type:r.package_type||'',package_display:packageByType[r.package_type]||r.package_type||'',
      phone_asset_id:phoneId,phone_model_display:phone.model_display||phoneId||'',phone_model_group:phone.model_group||'',
      lens_asset_id:lensId,lens_model_display:lens.model_display||lensId||'',lens_model_group:lens.model_group||'',
      pickup_time:r.pickup_time||'',return_time:r.return_time||'',payment_status:r.payment_status||'',amount_received:num(r.amount_received),
      package_price:num(r.package_price),
      return_status:r.return_status||'',file_transfer_status:r.file_transfer_status||'',drive_link:r.drive_link||'',damage_fee:num(r.damage_fee),
      work_task:task,is_cancelled:st==='cancelled',is_active_hold:['pending','confirmed','prepared','picked_up'].includes(st),
      should_show_current:workflowOpen(st),note:cleanBookingNote(r.staff_note)};
  }).reverse();

  const current=bookings.filter(b=>b.should_show_current);
  const today=bangkokDay();
  const todayWorking=bookings.filter(b=>b.event_date===today && !['cancelled','completed','no_show'].includes(String(b.booking_status||'').toLowerCase()))
    .sort((a,b)=>String(a.pickup_time||'').localeCompare(String(b.pickup_time||'')));

  const webReady=raw.web_ready.filter(r=>r.event_id).map(r=>({
    event_id:String(r.event_id||'').trim(),event_name:r.event_name||'',event_date:date(r.event_date_text||r.event_date),
    venue:r.venue||'',poster_image_url:r.poster_image_url||'',phone_model_display:'',
    available_phone_count:num(r.available_phone_count),available_lens_count:num(r.available_lens_count),
    line_message_template:r.line_message_template||'',action_for_web:r.action_for_web||'',data_health:r.data_health||''
  }));
  const webPackages=raw.web_packages.filter(r=>r.package_id&&r.event_id).map(r=>({
    package_id:String(r.package_id||'').trim(),event_id:String(r.event_id||'').trim(),package_type:r.package_type||'',
    model_group:r.model_group||'',model_display:r.model_display||'',lens_group:r.lens_group||'',lens_display:r.lens_display||'',
    price:num(r.price),available_count:num(r.available_count),package_status:r.package_status||'',sort_order:r.sort_order||'',
    web_note:r.web_note||'',raw_available_count:num(r.raw_available_count),use_case:r.use_case||''
  }));
  const customers=raw.customers.filter(r=>r.customer_key).map(r=>({
    customer_key:r.customer_key||'',customer_name:r.customer_name||'',customer_contact:r.customer_contact||'',
    customer_phone:r.customer_phone||'',rental_count:num(r.rental_count),first_rental_date:date(r.first_rental_date),
    last_rental_date:date(r.last_rental_date),last_event_name:r.last_event_name||''
  }));
  const health=raw.health.filter(r=>r.Check).map(r=>({
    check:r.Check||'',count:num(r.Count),status:r.Status||'',detail:String(r.Count||''),note:r['What to fix']||''
  }));
  const visibilityLocks=(raw.visibility_locks||[]).filter(r=>r.lock_id||r.event_id).map(r=>({
    row_number:r.__row_number,
    lock_id:String(r.lock_id||'').trim(),event_id:String(r.event_id||'').trim(),event_name:r.event_name||'',
    event_date:date(r.event_date),venue:r.venue||'',identity_key:r.identity_key||'',lock_state:String(r.lock_state||'').trim().toUpperCase(),
    lock_reason:r.lock_reason||'',first_locked_at:r.first_locked_at||'',last_changed_at:r.last_changed_at||'',changed_by:r.changed_by||'',
    explicit_reopen_required:bool(r.explicit_reopen_required),source_evidence:r.source_evidence||'',notes:r.notes||''
  }));

  return {
    events,packages,overrides,assets,bookings,current_bookings:current,web_ready:webReady,web_packages:webPackages,visibility_locks:visibilityLocks,
    // Aggregates only: no customer PII or mutable booking fields exposed by this audit.
    booking_closure_evidence_shadow:BookingLifecycleShadow.audit(bookings),
    today_working:todayWorking,today_key:today,model_master:Object.keys(models).map(k=>models[k]),customers,health,
    generated_at:new Date().toISOString(),spreadsheet_id:sheetId,admin_api_version:FALLBACK_VERSION,
    degraded_read_only:true,snapshot_source:transportMeta.snapshot_source||'direct-sheet-gviz-readonly-fallback',
    fallback_reader:transportMeta.fallback_reader||'public-gviz',
    fallback_private_attempted:!!transportMeta.fallback_private_attempted,
    fallback_private_error_code:transportMeta.fallback_private_error_code||'',
    write_actions_enabled:false,
    booking_identity_mode:'booking_id-primary',
    booking_row_number_reliable:transportMeta.fallback_reader!=='public-gviz',
    phase1_diagnostics:{fallback_mode:true,frontend_sheet_id:sheetId,spreadsheet_id:sheetId,admin_api_version:FALLBACK_VERSION},
    performance:{snapshot_ms:Date.now()-startedAt,range_mode:'direct-sheet-gviz-readonly-fallback'}
  };
}

function isTrue(v){ return ['1','true','yes','on'].includes(String(v||'').trim().toLowerCase()); }

function cloneSnapshot(value){
  return JSON.parse(JSON.stringify(value));
}

function fetchIdentityKey(fetchImpl){
  if((typeof fetchImpl!=='function' && typeof fetchImpl!=='object') || fetchImpl===null) return 'none';
  if(!fetchIdentity.has(fetchImpl)) fetchIdentity.set(fetchImpl,String(nextFetchIdentity++));
  return fetchIdentity.get(fetchImpl);
}

function snapshotCacheKey(sheetId,env,fetchImpl){
  const requirePrivate=isTrue(env.KK_ADMIN_FALLBACK_REQUIRE_PRIVATE)||CorePrivacy.enabled(env);
  const privateConfigured=!!privateSheets.credentialsFromEnv(env);
  return [sheetId,requirePrivate?'private-required':'private-optional',privateConfigured?'private-configured':'public-only',fetchIdentityKey(fetchImpl)].join('|');
}

function clearSnapshotCache(){
  snapshotCache.clear();
  snapshotInflight.clear();
}

async function buildSnapshotUncached(options={}){
  const env=options.env||process.env;
  const sheetId=String(options.sheetId||env.GOOGLE_SHEET_ID||DEFAULT_SHEET_ID).trim();
  const fetchImpl=options.fetchImpl||fetch;
  if(!sheetId) throw new Error('Fallback sheet id missing');
  if(CorePrivacy.enabled(env)) CorePrivacy.requireExplicitPrivateSource(sheetId,env);
  const startedAt=Date.now();
  const keys=Object.keys(SPECS);
  const requirePrivate=isTrue(env.KK_ADMIN_FALLBACK_REQUIRE_PRIVATE)||CorePrivacy.enabled(env);
  const privateConfigured=!!privateSheets.credentialsFromEnv(env);
  let values=null;
  let transportMeta={snapshot_source:'direct-sheet-gviz-readonly-fallback',fallback_reader:'public-gviz',fallback_private_attempted:false,fallback_private_error_code:''};

  if(privateConfigured){
    transportMeta.fallback_private_attempted=true;
    try{
      values=await Promise.all(keys.map(k=>readSpecPrivate(sheetId,k,env,fetchImpl)));
      transportMeta.snapshot_source='direct-sheet-private-service-account-readonly-fallback';
      transportMeta.fallback_reader='private-service-account';
    }catch(err){
      transportMeta.fallback_private_error_code=String((err&&err.code)||'PRIVATE_FALLBACK_READ_FAILED');
      if(requirePrivate) throw err;
      values=null;
    }
  }else if(requirePrivate){
    const err=new Error('Private Admin fallback reader is required but not configured');
    err.code='ADMIN_FALLBACK_PRIVATE_READER_NOT_CONFIGURED';
    throw err;
  }

  if(!values){
    values=await Promise.all(keys.map(k=>readSpecPublic(sheetId,k,fetchImpl)));
  }

  const raw={}; keys.forEach((k,i)=>{raw[k]=values[i];});
  for(const key of ['events','bookings','assets']){
    if(!Array.isArray(raw[key])) throw new Error('Fallback required dataset missing: '+key);
  }
  return buildFromRaw(raw,sheetId,startedAt,transportMeta);
}

async function buildSnapshot(options={}){
  const env=options.env||process.env;
  const sheetId=String(options.sheetId||env.GOOGLE_SHEET_ID||DEFAULT_SHEET_ID).trim();
  const fetchImpl=options.fetchImpl||fetch;
  const requestedTtl=Number(options.cacheTtlMs);
  const ttlMs=Number.isFinite(requestedTtl)?Math.max(0,requestedTtl):FALLBACK_CACHE_TTL_MS;
  const cacheEnabled=options.cache!==false && ttlMs>0;
  if(!cacheEnabled){
    const uncached=await buildSnapshotUncached(options);
    uncached.fallback_cache_status='disabled';
    uncached.fallback_cache_age_ms=0;
    return uncached;
  }

  const key=snapshotCacheKey(sheetId,env,fetchImpl);
  const now=Date.now();
  const cached=snapshotCache.get(key);
  if(cached && now-cached.at<=ttlMs){
    const out=cloneSnapshot(cached.value);
    out.fallback_cache_status='hit';
    out.fallback_cache_age_ms=Math.max(0,now-cached.at);
    return out;
  }

  if(snapshotInflight.has(key)){
    const out=cloneSnapshot(await snapshotInflight.get(key));
    out.fallback_cache_status='coalesced';
    out.fallback_cache_age_ms=0;
    return out;
  }

  const pending=buildSnapshotUncached(options)
    .then(snapshot=>{
      snapshotCache.set(key,{at:Date.now(),value:cloneSnapshot(snapshot)});
      return snapshot;
    })
    .finally(()=>snapshotInflight.delete(key));
  snapshotInflight.set(key,pending);

  const out=cloneSnapshot(await pending);
  out.fallback_cache_status='miss';
  out.fallback_cache_age_ms=0;
  return out;
}

module.exports={
  FALLBACK_VERSION,FALLBACK_CACHE_TTL_MS,SPECS,parseCsv,rowsAsObjects,valuesAsObjects,
  buildFromRaw,buildSnapshot,buildSnapshotUncached,clearSnapshotCache,bangkokDay,isTrue
};
