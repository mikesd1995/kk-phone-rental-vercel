'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const program = new vm.Script(source, {filename:'canonical-Code.gs'});
const SHEET_ID='synthetic-canonical-sheet-0001';
const SCRIPT_ID='synthetic-canonical-script-0001';
const KEY='s'.repeat(48), ADMIN='a'.repeat(48);
const LENS_VERSION='v16.7.0_PHASE3_9_5_14_EXACT_MODEL_HOLDS_20261124';
const required=['00_Master_Booking','01_Events','03_Packages','02_Assets','08_Web_Ready','09_Web_Packages'];

function fixture(opts={}) {
  const props={
    KK_CANONICAL_RUNTIME_ENABLED:'1',
    KK_CANONICAL_WORKBOOK_ID:SHEET_ID,
    KK_CANONICAL_VERIFIED_BINDING:SCRIPT_ID+':'+SHEET_ID,
    KK_CORE_PRIVATE_READ_ENABLED:'1',
    KK_CORE_PRIVATE_READ_KEY:KEY, KK_ADMIN_API_KEY:ADMIN,
    ...opts.props
  };
  const counters={open:0,active:0,docProps:0,docLock:0,scriptLock:0,reads:0,writes:0,propsWrites:0,flush:0};
  const mutex=opts.mutex||{held:false};
  const workbook={
    getId:()=>opts.openedId||SHEET_ID,
    getSheetByName(name){
      if (opts.missingSheet===name) return null;
      if(!required.includes(name))throw Error('unexpected synthetic tab '+name);
      return {
        getLastRow:()=>5,
        getRange(range){
          counters.reads++;
          assert.equal(range,'A4:K5');
          return {getDisplayValues:()=>[['event_id','event_name'],['EVT-SYNTHETIC','STAGING ONLY']]};
        }
      };
    },
    insertSheet(){counters.writes++;throw Error('unexpected synthetic sheet mutation');}
  };
  const activeWorkbook={...workbook,getId:()=>opts.activeId||SHEET_ID};
  const properties={
    getProperty:k=>props[k]||null,
    setProperty(k,v){counters.propsWrites++;props[k]=v;},
    deleteProperty(k){counters.propsWrites++;delete props[k];}
  };
  const context=vm.createContext({
    PropertiesService:{
      getScriptProperties:()=>properties,
      getDocumentProperties(){counters.docProps++;if(!opts.editor)throw Error('document properties unavailable in web app');return {getProperty:()=>opts.lensMarker||null};}
    },
    ScriptApp:{getScriptId:()=>opts.scriptId||SCRIPT_ID},
    SpreadsheetApp:{
      getActive(){counters.active++;throw Error('no active spreadsheet');},
      getActiveSpreadsheet(){counters.active++;if(!opts.editor)throw Error('no active spreadsheet in web app');return activeWorkbook;},
      openById(id){counters.open++;assert.equal(id,SHEET_ID,'never open caller-selected workbook');if(opts.openFails)throw Error('synthetic open error');return workbook;},
      flush(){counters.flush++;}
    },
    LockService:{
      getDocumentLock(){counters.docLock++;throw Error('document lock not available in web app');},
      getScriptLock(){
        counters.scriptLock++;
        if(opts.noLock)return null;
        let mine=false;
        return {
          tryLock(ms){assert.ok(ms>=1000);if(mutex.held)return false;mutex.held=true;mine=true;return true;},
          releaseLock(){assert.equal(mine,true);assert.equal(mutex.held,true);mine=false;mutex.held=false;}
        };
      }
    },
    ContentService:{MimeType:{JSON:'json'},createTextOutput(value){return {value,setMimeType(){return this;}}}},
    Logger:{log(){}}
  });
  program.runInContext(context,{timeout:1000});
  function post(payload){return JSON.parse(context.doPost({postData:{contents:JSON.stringify(payload)}}).value);}
  return {context,props,counters,mutex,post};
}

test('real canonical GAS executes private HTTP read without an active spreadsheet or document properties',()=>{
  const f=fixture();
  const result=f.post({action:'privateCoreRead',readKey:KEY,coreSheetId:SHEET_ID,sheet:'08_Web_Ready',range:'A4:K'});
  assert.equal(result.ok,true);
  assert.equal(result.data.spreadsheet_id,SHEET_ID);
  assert.deepEqual(result.data.values,[['event_id','event_name'],['EVT-SYNTHETIC','STAGING ONLY']]);
  assert.equal(f.counters.active,0);
  assert.equal(f.counters.docProps,0);
  assert.equal(f.counters.docLock,0);
  assert.equal(f.counters.writes,0);
  assert.equal(f.counters.propsWrites,0);
});

test('HTTP authentication and binding checks fail before any workbook open, lock, or mutation',()=>{
  for(const patch of [{KK_CANONICAL_RUNTIME_ENABLED:'0'},{KK_CANONICAL_VERIFIED_BINDING:''},{KK_CANONICAL_WORKBOOK_ID:'foreign-canonical-sheet-id-0001'},{KK_CANONICAL_VERIFIED_BINDING:'different-script-id:'+SHEET_ID}]){
    const f=fixture({props:patch});
    assert.equal(f.post({action:'createLineBookingPending',apiKey:ADMIN}).ok,false);
    assert.equal(f.counters.open,0);
    assert.equal(f.counters.scriptLock,0);
    assert.equal(f.counters.writes,0);
    assert.equal(f.counters.propsWrites,0);
  }
  const unauthorized=fixture();
  assert.equal(unauthorized.post({action:'privateCoreRead',readKey:ADMIN,coreSheetId:SHEET_ID,sheet:'08_Web_Ready',range:'A4:K'}).ok,false);
  assert.equal(unauthorized.counters.open,0);
  const other=fixture({scriptId:'different-synthetic-script-0001'});
  assert.throws(()=>other.context.kkCanonicalWorkbook_(),/BINDING_REQUIRED/);
  assert.equal(other.counters.open,0);
});

test('opened workbook ID is checked and private read denial never echoes source identity',()=>{
  const f=fixture({openedId:'other-canonical-sheet-0001'});
  assert.throws(()=>f.context.kkCanonicalWorkbook_(),/WORKBOOK_ID_MISMATCH/);
  const result=f.post({action:'privateCoreRead',readKey:KEY,coreSheetId:SHEET_ID,sheet:'08_Web_Ready',range:'A4:K'});
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'PRIVATE_CORE_READ_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(result),/synthetic-canonical-sheet|other-canonical-sheet/);
  assert.equal(f.counters.reads,0);
  assert.equal(f.counters.writes,0);
  const spoof=fixture();
  assert.equal(spoof.post({action:'privateCoreRead',readKey:KEY,coreSheetId:'foreign-canonical-sheet-id-0001',sheet:'08_Web_Ready',range:'A4:K'}).ok,false);
  assert.equal(spoof.counters.reads,0);
});

test('owner editor attestation works only disabled, validates parent/schema, and preserves exact prior marker',()=>{
  const disabled={KK_CANONICAL_RUNTIME_ENABLED:'0',KK_CANONICAL_VERIFIED_BINDING:''};
  const f=fixture({editor:true,props:disabled,lensMarker:LENS_VERSION});
  assert.equal(f.context.kkBindCanonicalWorkbookFromEditor().binding_verified,true);
  assert.equal(f.props.KK_CANONICAL_VERIFIED_BINDING,SCRIPT_ID+':'+SHEET_ID);
  assert.equal(f.props.KK_LENS_COMPAT_PATCH_VERSION,LENS_VERSION);
  assert.equal(f.counters.open,0);
  assert.equal(f.counters.writes,0);
  assert.throws(()=>f.context.kkCanonicalWorkbook_(),/RUNTIME_DISABLED/);
  f.props.KK_CANONICAL_RUNTIME_ENABLED='1';
  assert.equal(f.context.kkCanonicalWorkbook_().getId(),SHEET_ID);
  assert.throws(()=>f.context.kkBindCanonicalWorkbookFromEditor(),/BIND_REQUIRES_DISABLED/);
  for(const patch of [{activeId:'wrong-sheet-id-000000001'},{missingSheet:'09_Web_Packages'},{editor:false},{props:{...disabled,KK_CANONICAL_VERIFIED_BINDING:'different-binding'}}]){
    const bad=fixture({editor:true,props:disabled,...patch});
    assert.throws(()=>bad.context.kkBindCanonicalWorkbookFromEditor());
    assert.equal(bad.counters.propsWrites,0);
  }
  const stale=fixture({editor:true,props:{...disabled,KK_LENS_COMPAT_PATCH_VERSION:LENS_VERSION},lensMarker:'stale'});
  stale.context.kkBindCanonicalWorkbookFromEditor();
  assert.equal(stale.props.KK_LENS_COMPAT_PATCH_VERSION,undefined);
});

test('actual booking, cleanup, owner maintenance and background lock helpers share one ScriptLock domain',()=>{
  const mutex={held:false};
  const a=fixture({mutex}), b=fixture({mutex});
  const owner=a.context.kkAcquireDocumentLock_('synthetic owner writer',12000);
  assert.equal(mutex.held,true);
  for(const fn of ['kkApiCreateLineBookingPending_','kkApiCreateBooking_','kkApiUpdateBooking_','kkApiDecideLineBookingPending_','kkCleanupOldData30Days_','kkEnsurePhase1Sheets','kkSetupNamedRanges']){
    assert.throws(()=>b.context[fn]({}),/กำลังบันทึก/,'blocked before writes: '+fn);
  }
  assert.equal(b.context.kkTryDocumentLock_('synthetic background',3000),null);
  assert.equal(b.counters.reads,0);
  assert.equal(b.counters.writes,0);
  assert.equal(b.counters.propsWrites,0);
  assert.equal(b.counters.docLock,0);
  owner.releaseLock();
  const next=b.context.kkTryDocumentLock_('next writer',3000);
  assert.ok(next);
  next.releaseLock();
  assert.equal(mutex.held,false);
  assert.throws(()=>fixture({noLock:true}).context.kkAcquireDocumentLock_('no lock'),/SCRIPT_LOCK_UNAVAILABLE/);
});

test('canonical source keeps editor binding isolated and no nested auto-repair or document lock in writer',()=>{
  assert.equal((source.match(/SpreadsheetApp\.getActiveSpreadsheet\(\)/g)||[]).length,1);
  assert.doesNotMatch(source,/SpreadsheetApp\.getActive\(\)|LockService\.getDocumentLock\(\)/);
  const start=source.indexOf('function kkApiCreateBooking_(');
  const end=source.indexOf('\nfunction ',start+1);
  const writer=source.slice(start,end);
  assert.doesNotMatch(writer,/kkEnsureLensCompatibilityPatchInstalled_\(/);
  assert.match(writer,/LENS_COMPAT_OWNER_REVIEW_REQUIRED/);
  assert.match(source,/function kkCleanupOldData30Days_\(\) \{\s*const lock = kkAcquireDocumentLock_\([\s\S]*?try \{\s*kkEnsureCrmArchiveSheets_\(\)/);
  const dispatch=source.slice(source.indexOf('function doPost('),source.indexOf('function doGet('));
  assert.doesNotMatch(dispatch,/case 'kkBindCanonicalWorkbookFromEditor'/);
});

test('actual template allocation distinguishes all five rental packages and refuses ambiguous historical rows',()=>{
  const {context:c}=fixture();
  const rows=[
    ['TPL-X300-PHONE','VIVO_X300_PRO','phone_only','NONE',590,'X300',null,true],
    ['TPL-X300-200','VIVO_X300_PRO','phone_lens_bundle','ZEISS_2_35X',790,'X300 200mm',null,true],
    ['TPL-X500-PHONE','VIVO_X500_PRO_MAX','phone_only','NONE',1090,'X500',null,true],
    ['TPL-X500-200','VIVO_X500_PRO_MAX','phone_lens_bundle','ZEISS_2_35X',1290,'X500 200mm',null,true],
    ['TPL-X500-400','VIVO_X500_PRO_MAX','phone_lens_bundle','ZEISS_400MM',1590,'X500 400mm',null,true]
  ];
  c.kkGetValues_=()=>rows;
  const calls=[];
  c.kkFindAvailableAsset_=(kind,group)=>{calls.push([kind,group]);return kind+'-'+group;};
  for(const [id,model,type,lens,price] of rows){
    calls.length=0;
    const booking=Array(20).fill('');
    booking[8]=type;
    booking[19]=c.kkBookingNoteWithTemplate_('synthetic',id,price);
    c.kkAssignMissingAssetsForPreparedBooking_(booking,'confirmed','2026-12-11');
    assert.deepEqual(calls,[],'confirmation never allocates');
    c.kkAssignMissingAssetsForPreparedBooking_(booking,'prepared','2026-12-11');
    assert.equal(booking[9],'phone-'+model);
    assert.equal(booking[10],lens==='NONE'?'':'lens-'+lens);
    assert.equal(c.kkBookingQuotedPriceFromNote_(booking[19]),price);
  }
  for(const type of ['phone_only','phone_lens_bundle']){
    const legacy=Array(20).fill('');legacy[8]=type;
    assert.throws(()=>c.kkAssignMissingAssetsForPreparedBooking_(legacy,'prepared','2026-12-11'),/TEMPLATE_OWNER_REVIEW_REQUIRED/);
    assert.equal(legacy[9],'');
  }
  const bad=Array(20).fill('');bad[8]='phone_only';
  bad[19]=c.kkBookingNoteWithTemplate_('synthetic','TPL-X500-400',1590);
  assert.throws(()=>c.kkAssignMissingAssetsForPreparedBooking_(bad,'prepared','2026-12-11'),/template\/type mismatch/);
});

test('locked strict Web Package lookup rejects missing or duplicate template before bookability filtering',()=>{
  const {context:c}=fixture();
  const row={package_id:'EVT-SYNTHETIC-TPL-X500-PHONE',event_id:'EVT-SYNTHETIC',
    price:1090,available_count:1,package_status:'available',
    package_type:'phone_only',model_group:'VIVO_X500_PRO_MAX',lens_group:'NONE'};
  c.kkApiWebPackageRows_=()=>[row];
  const exact=c.kkAssertWebPackageBookable_('EVT-SYNTHETIC','TPL-X500-PHONE',true);
  assert.equal(exact.price,1090);
  const spec={package_type:'phone_only',model_group:'VIVO_X500_PRO_MAX',lens_group:'NONE'};
  assert.equal(c.kkLineVerifiedQuote_(exact,spec,'1,090 บาท'),1090);
  assert.throws(()=>c.kkLineVerifiedQuote_(exact,spec,'1,290 บาท'),/QUOTE_CHANGED/);
  c.kkApiWebPackageRows_=()=>[row,{...row,available_count:0,package_status:'hidden'}];
  assert.throws(()=>c.kkAssertWebPackageBookable_('EVT-SYNTHETIC','TPL-X500-PHONE',true),/ambiguous/);
  c.kkApiWebPackageRows_=()=>[];
  assert.throws(()=>c.kkAssertWebPackageBookable_('EVT-SYNTHETIC','TPL-X500-PHONE',true),/ambiguous/);
});

test('manual and legacy LINE admission cannot bypass missing or unavailable Web Package rows',()=>{
  const {context:c}=fixture();
  const event='EVT-SYNTHETIC', template='TPL-X500-PHONE';
  const row={package_id:event+'-'+template,event_id:event,price:1090,available_count:1,package_status:'available'};
  for(const args of [[event,template],[event,template,false],[event,template,true]]){
    for(const rows of [[],[{...row,event_id:'OTHER-EVENT'}],[{...row,package_id:event+'-WRONG'}],[row,row]]){
      c.kkApiWebPackageRows_=()=>rows;
      assert.throws(()=>c.kkAssertWebPackageBookable_(...args),/ambiguous/);
    }
    for(const patch of [{available_count:0},{price:0},{package_status:'hidden'}]){
      c.kkApiWebPackageRows_=()=>[{...row,...patch}];
      assert.throws(()=>c.kkAssertWebPackageBookable_(...args),/ไม่พร้อมจอง/);
    }
    c.kkApiWebPackageRows_=()=>[row];
    assert.equal(c.kkAssertWebPackageBookable_(...args).price,1090);
  }
  assert.doesNotMatch(source,/if \(!eventRows\.length && !requireExact\) return/);
  assert.doesNotMatch(source,/kkAssertWebPackageBookable_\(eventId, templateId, Boolean\(initial\)\)/);
});

test('Web Package admission rejects nonfinite prices and malformed or fractional physical counts',()=>{
  const {context:c}=fixture();
  const event='EVT-20261226-ALLYMPIC-MAIN', other='EVT-20261226-BUTTERBEAR';
  const template='TPL-VIVO-X300-PRO-PHONE';
  const row={package_id:event+'-'+template,event_id:event,price:790,available_count:2,package_status:'available'};
  for(const count of ['not-a-number',Infinity,'Infinity',-1,0,0.5,1.5,Number.MAX_SAFE_INTEGER+1]){
    c.kkApiWebPackageRows_=()=>[{...row,available_count:count}];
    assert.throws(()=>c.kkAssertWebPackageBookable_(event,template),/ไม่พร้อมจอง/);
  }
  for(const price of ['not-a-number',Infinity,'Infinity',-1,0,NaN]){
    c.kkApiWebPackageRows_=()=>[{...row,price}];
    assert.throws(()=>c.kkAssertWebPackageBookable_(event,template),/ไม่พร้อมจอง/);
  }
  c.kkApiWebPackageRows_=()=>[{...row,package_status:'pending'}];
  assert.throws(()=>c.kkAssertWebPackageBookable_(event,template),/ไม่พร้อมจอง/);
  c.kkApiWebPackageRows_=()=>[{...row,event_id:other,package_id:other+'-'+template}];
  assert.throws(()=>c.kkAssertWebPackageBookable_(event,template),/ambiguous/);
  c.kkApiWebPackageRows_=()=>[row,{...row,package_id:event+'-TPL-ZEISS-2-35X-LENS',package_status:'hidden',available_count:0,price:0}];
  assert.throws(()=>c.kkAssertWebPackageBookable_(event,'TPL-ZEISS-2-35X-LENS'),/ไม่พร้อมจอง/);
  assert.equal(c.kkAssertWebPackageBookable_(event,event+'-'+template).price,790);
  c.kkApiWebPackageRows_=()=>[{...row,available_count:'2',price:'790.50',package_status:'open'}];
  assert.equal(c.kkAssertWebPackageBookable_(event,template).price,'790.50');
});

test('shared API numeric parser rejects nonfinite and nonscalar payment or price inputs before writes',()=>{
  const {context:c}=fixture();
  for(const field of ['amount_received','standard_price','override_price','sort_order_override']){
    for(const value of [Infinity,-Infinity,'Infinity','1e999',NaN,'bad',-1,'-0.5',true,false,[],[1],{}]){
      assert.throws(()=>c.kkApiNumber_(value,field,true),/must be a non-negative number/);
    }
    for(const value of ['',null,undefined]){
      assert.equal(c.kkApiNumber_(value,field,true),'');
      assert.equal(c.kkApiNumber_(value,field,false),0);
    }
    for(const [value,expected] of [[0,0],[790,790],['1090',1090],['790.50',790.5]]){
      assert.equal(c.kkApiNumber_(value,field,false),expected);
    }
  }
});

test('manual booking replay requires unique request marker and matching booking identity before returning success',()=>{
  const f=fixture(), c=f.context;
  const event='EVT-SYNTHETIC', template='TPL-X500-PHONE', request='manual-synthetic-0001';
  const row=Array(20).fill('');
  row[0]='BOOK-SYNTHETIC'; row[2]='completed'; row[3]=event;
  row[4]='SYNTHETIC'; row[5]='synthetic-contact'; row[6]='0000000000';
  row[19]=c.kkBookingNoteWithTemplate_(c.kkBookingNoteWithRequest_('',request),template,0);
  const payload={request_id:request,event_id:event,template_id:template,customer_name:'SYNTHETIC',customer_contact:'synthetic-contact',customer_phone:'0000000000'};
  c.kkGetValues_=()=>[row];
  assert.equal(c.kkApiCreateBooking_(payload).idempotent_replay,true);
  assert.equal(c.kkApiCreateBooking_({...payload,template_id:event+'-'+template}).booking_id,'BOOK-SYNTHETIC');
  for(const patch of [{event_id:'OTHER'},{template_id:'TPL-X300-PHONE'},{customer_name:'OTHER'},{customer_contact:'OTHER'},{customer_phone:'OTHER'},{event_id:''},{template_id:''},{customer_name:''}]){
    assert.throws(()=>c.kkApiCreateBooking_({...payload,...patch}),/BOOKING_REQUEST_IDENTITY_CONFLICT/);
    assert.equal(f.mutex.held,false);
  }
  const legacy=row.slice();legacy[19]=c.kkBookingNoteWithRequest_('',request);
  c.kkGetValues_=()=>[legacy];
  assert.throws(()=>c.kkApiCreateBooking_(payload),/BOOKING_REQUEST_IDENTITY_CONFLICT/);
  c.kkGetValues_=()=>[row,row.slice()];
  assert.throws(()=>c.kkApiCreateBooking_(payload),/BOOKING_REQUEST_AMBIGUOUS/);
  for(const marker of [request,'manual-synthetic-0002']){
    const bad=row.slice();bad[19]+=' [KK_REQ:'+marker+']';
    c.kkGetValues_=()=>[bad];
    assert.throws(()=>c.kkApiCreateBooking_(payload),/BOOKING_REQUEST_AMBIGUOUS/);
  }
  assert.equal(f.counters.writes,0);
  assert.equal(f.counters.flush,0);
  assert.equal(f.mutex.held,false);
});

test('master event and package identity lookups reject duplicate and blank IDs',()=>{
  const f=fixture(), c=f.context;
  const event=['EVT-SYNTHETIC','STAGING','2027-01-01','SYNTHETIC','','open',true,'',''];
  const pkg=['TPL-X500-PHONE','VIVO_X500_PRO_MAX','phone_only','NONE',790,'SYNTHETIC','',true,'',''];
  for(const [lookup,row,id,error,missing] of [
    ['kkGetEventById_',event,event[0],/EVENT_ID_AMBIGUOUS/,/Event not found/],
    ['kkGetPackageByTemplateId_',pkg,pkg[0],/BOOKING_TEMPLATE_AMBIGUOUS/,/Template\/package not found/]
  ]){
    c.kkGetValues_=()=>[row];
    assert.ok(c[lookup](id));
    c.kkGetValues_=()=>[row,row.slice()];
    assert.throws(()=>c[lookup](id),error);
    c.kkGetValues_=()=>[row,['']];
    assert.throws(()=>c[lookup](''),missing);
    assert.throws(()=>c[lookup]('UNKNOWN'),missing);
  }
  assert.equal(f.counters.writes,0);
});

test('manual booking rejects incompatible physical asset shape before reserving or writing',()=>{
  const f=fixture({props:{KK_LENS_COMPAT_PATCH_VERSION:LENS_VERSION}}), c=f.context;
  const event='EVT-SYNTHETIC', template='TPL-X500-PHONE';
  const payload={event_id:event,template_id:template,customer_name:'SYNTHETIC'};
  const phone={active:true,package_type:'phone_only',model_group:'VIVO_X500_PRO_MAX',lens_group:'NONE'};
  const lens={active:true,package_type:'lens_only',model_group:'NONE',lens_group:'ZEISS_235X'};
  const bundle={...phone,package_type:'phone_lens_bundle',lens_group:'ZEISS_235X'};
  c.kkGetEventById_=()=>({event_date:'2027-01-01',status:'open',active:true});
  c.kkIsPastEventDate_=()=>false;
  c.kkAssertWebPackageBookable_=()=>({price:790,available_count:2});
  let allocations=0,validations=0;
  c.kkValidateManualAsset_=()=>{validations++;};
  c.kkFindAvailableAsset_=type=>{allocations++;return type==='phone'?'PHONE-1':'LENS-1';};
  c.kkFirstEmptyRow_=()=>{throw Error('SYNTHETIC_WRITE_BOUNDARY');};
  for(const [spec,patch] of [[phone,{lens_asset_id:'LENS-1'}],[lens,{phone_asset_id:'PHONE-1'}],[{...phone,model_group:'NONE'},{}],[{...bundle,lens_group:''},{}],[{...phone,package_type:'unknown'},{}]]){
    c.kkGetPackageByTemplateId_=()=>spec;
    assert.throws(()=>c.kkApiCreateBooking_({...payload,...patch}),/BOOKING_ASSET_SHAPE_INVALID/);
    assert.equal(f.mutex.held,false);
  }
  assert.equal(allocations,0);assert.equal(validations,0);
  for(const spec of [phone,lens,bundle]){
    c.kkGetPackageByTemplateId_=()=>spec;
    assert.throws(()=>c.kkApiCreateBooking_(payload),/SYNTHETIC_WRITE_BOUNDARY/);
  }
  c.kkGetPackageByTemplateId_=()=>phone;
  c.kkFindAvailableAsset_=()=> '';
  assert.throws(()=>c.kkApiCreateBooking_(payload),/BOOKING_ASSET_SHAPE_INVALID/);
  c.kkGetPackageByTemplateId_=()=>bundle;
  c.kkFindAvailableAsset_=()=> 'DUPLICATE-ID';
  assert.throws(()=>c.kkApiCreateBooking_(payload),/BOOKING_ASSET_SHAPE_INVALID/);
  assert.equal(f.counters.writes,0);assert.equal(f.counters.flush,0);assert.equal(f.mutex.held,false);
});

test('booking price formula honors locked quote before historical price lookup without writing live formulas',()=>{
  const {context:c}=fixture();
  const formula=c.kkFormulaBookingPrice_(47);
  assert.match(formula,/REGEXEXTRACT\(T47,"\\\[KK_QUOTE:/);
  assert.match(formula,/SUMIFS\('09_Web_Packages'/);
  assert.ok(formula.indexOf('KK_QUOTE')<formula.indexOf('SUMIFS'));
});


test('physical asset allocation and manual validation reject ambiguous global IDs and cross-column holds',()=>{
  const f=fixture(), c=f.context;
  const day='2027-01-01', group='VIVO_X500_PRO_MAX';
  const phone=['PHONE-101','phone',group,'','available','',true];
  const next=['PHONE-102','phone',group,'','available','',true];
  const wrong=[' PHONE-101 ','lens','ZEISS_400MM','','retired','',false];
  let rows=[phone,next], holds={phone:{},lens:{}};
  c.kkGetValues_=()=>rows;
  c.kkBookedAssetIdsForDate_=()=>holds;
  c.kkAssetDateEligible_=()=>true;
  c.kkDateKey_=()=>20270101;
  assert.equal(c.kkFindAvailableAsset_('phone',group,day),'PHONE-101');
  assert.doesNotThrow(()=>c.kkValidateManualAsset_('PHONE-101','phone',group,day));
  for(const duplicate of [phone.slice(),wrong]){
    rows=[phone,next,duplicate];
    assert.throws(()=>c.kkFindAvailableAsset_('phone',group,day),/ASSET_ID_AMBIGUOUS/);
    assert.throws(()=>c.kkValidateManualAsset_('PHONE-101','phone',group,day),/ASSET_ID_AMBIGUOUS/);
    assert.doesNotThrow(()=>c.kkValidateManualAsset_('PHONE-102','phone',group,day));
  }
  rows=[phone,next];holds={phone:{},lens:{'PHONE-101':true}};
  assert.equal(c.kkFindAvailableAsset_('phone',group,day),'PHONE-102');
  assert.throws(()=>c.kkValidateManualAsset_('PHONE-101','phone',group,day),/already booked/);
  c.kkGetEventById_=()=>({event_date:day});
  const row=Array(20).fill('');row[3]='EVT-SYNTHETIC';row[9]='PHONE-101';
  assert.throws(()=>c.kkAssertBookingAssetsNotDoubleBooked_(5,row,'confirmed'),/already booked/);
  holds={phone:{},lens:{}};row[10]='PHONE-101';
  assert.throws(()=>c.kkAssertBookingAssetsNotDoubleBooked_(5,row,'confirmed'),/BOOKING_ASSET_SHAPE_INVALID/);
  row[10]='';assert.doesNotThrow(()=>c.kkAssertBookingAssetsNotDoubleBooked_(5,row,'confirmed'));
  assert.equal(f.counters.writes,0);
});


test('manual booking update rejects wrong shape and legacy wildcard before canonical row write',()=>{
  const f=fixture(), c=f.context;
  const spec={package_type:'phone_only',model_group:'VIVO_X500_PRO_MAX',lens_group:'NONE'};
  const row=Array(20).fill('');
  row[0]='BKG-SYNTHETIC';row[2]='confirmed';row[3]='EVT-SYNTHETIC';row[4]='SYNTHETIC';
  row[8]='phone_only';row[13]='unpaid';row[14]=0;
  row[19]=c.kkBookingNoteWithTemplate_('synthetic','TPL-X500-PHONE',790);
  let current=row.slice(), writes=0, allocations=0, validations=[];
  c.kkFindBookingRow_=()=>5;
  c.kkSheet_=()=>({getRange(){return {getValues:()=>[current.slice()],setValues(v){writes++;current=v[0].slice();}};}});
  c.kkGetEventById_=()=>({event_date:'2027-01-01'});
  c.kkGetPackageByTemplateId_=()=>spec;
  c.kkGetPackageSpecByType_=()=>{throw Error('BOOKING_TEMPLATE_OWNER_REVIEW_REQUIRED');};
  c.kkFindAvailableAsset_=()=>{allocations++;return 'PHONE-101';};
  c.kkValidateManualAsset_=(id,type,group)=>validations.push([id,type,group]);
  c.kkBookedAssetIdsForDate_=()=>({phone:{},lens:{}});
  assert.throws(()=>c.kkApiUpdateBooking_({lens_asset_id:'LENS-101'}),/BOOKING_ASSET_SHAPE_INVALID/);
  assert.equal(writes,0);assert.equal(allocations,0);assert.equal(f.mutex.held,false);
  current[19]='legacy';
  assert.throws(()=>c.kkApiUpdateBooking_({phone_asset_id:'PHONE-101'}),/TEMPLATE_OWNER_REVIEW_REQUIRED/);
  assert.equal(writes,0);assert.equal(validations.length,0);
  current=row.slice();
  const result=c.kkApiUpdateBooking_({booking_status:'prepared'});
  assert.equal(result.phone_asset_id,'PHONE-101');assert.equal(writes,1);
  assert.deepEqual(validations,[['PHONE-101','phone','VIVO_X500_PRO_MAX']]);
  c.kkApiUpdateBooking_({customer_name:'SYNTHETIC UPDATED'});
  assert.equal(writes,2);assert.equal(validations.length,1);
  current=row.slice();c.kkFindAvailableAsset_=()=> '';
  assert.throws(()=>c.kkApiUpdateBooking_({booking_status:'prepared'}),/BOOKING_ASSET_SHAPE_INVALID/);
  assert.equal(writes,2);assert.equal(f.mutex.held,false);
});

test('physical holds with ambiguous or orphan event dates reserve only their IDs across dates',()=>{
  const f=fixture(),c=f.context;
  const day='2027-01-01',other='2027-01-02';
  let events=[['EVT-MOVE','',other],['EVT-OTHER','',day],['EVT-DUP','',other],[' EVT-DUP ','',day],['EVT-BAD','','invalid']];
  const make=(status,event,phone='',lens='')=>[status,event,'','','','','',phone,lens];
  let bookings=[make('confirmed ','EVT-OTHER','PHONE-1'),make('pending','EVT-DUP','','PHONE-2'),make('prepared','MISSING','PHONE-3'),make('confirmed','EVT-BAD','PHONE-4'),make('cancelled','MISSING','PHONE-5'),make('confirmed','EVT-MOVE','PHONE-6')];
  c.kkGetValues_=(name)=>name==='01_Events'?events:bookings;
  c.kkSameDate_=(a,b)=>{if(a==='invalid')throw Error('bad date');return a===b;};
  let held=c.kkBookedAssetIdsForDate_(day);
  for(const id of ['PHONE-1','PHONE-2','PHONE-3','PHONE-4'])assert.equal(c.kkAssetHeldByBooking_(held,id),true,id);
  for(const id of ['PHONE-5','PHONE-6','PHONE-7'])assert.equal(c.kkAssetHeldByBooking_(held,id),false,id);
  held=c.kkBookedAssetIdsForDate_(day,5);
  assert.equal(c.kkAssetHeldByBooking_(held,'PHONE-1'),false);
  assert.equal(f.counters.writes,0);
});

test('event date moves block cross-column collisions and unknown-date reservations',()=>{
  const {context:c}=fixture();
  const day='2027-01-01',other='2027-01-02';
  c.kkGetEventById_=()=>({event_date:other});
  c.kkSameDate_=(a,b)=>a===b;
  c.kkDateKey_=()=>20270101;
  const events=[['EVT-MOVE','',other],['EVT-OTHER','',day]];
  const row=(event,phone,lens,status='confirmed')=>{const r=Array(20).fill('');r[2]=status;r[3]=event;r[9]=phone;r[10]=lens;return r;};
  let bookings=[row('EVT-MOVE','PHONE-1',''),row('EVT-OTHER','','PHONE-1')];
  c.kkGetValues_=name=>name==='01_Events'?events:bookings;
  assert.throws(()=>c.kkAssertEventDateChangeSafe_('EVT-MOVE',day),/EVENT_DATE_ASSET_COLLISION/);
  bookings[1]=row('ORPHAN','','PHONE-1');
  assert.throws(()=>c.kkAssertEventDateChangeSafe_('EVT-MOVE',day),/EVENT_DATE_ASSET_COLLISION/);
  bookings[1]=row('ORPHAN','','PHONE-2');
  assert.equal(c.kkAssertEventDateChangeSafe_('EVT-MOVE',day),true);
  bookings[1]=row('EVT-OTHER','','PHONE-1','cancelled');
  assert.equal(c.kkAssertEventDateChangeSafe_('EVT-MOVE',day),true);
});


test('event update rejects duplicate identity, unsafe day changes and historical drift reopening before poster or row writes',()=>{
  const f=fixture(),c=f.context;
  const id='EVT-20270101-SYNTHETIC',day='2027-01-01',other='2027-01-02';
  const event=[id,'SYNTHETIC',day,'VENUE','','open',true,''];
  let rows=[event.slice()], snapshots=0,posters=0,writeAttempts=0,dateChecks=0;
  c.kkGetValues_=()=>rows;
  c.kkSnapshotWebPackagePricesForEvent_=()=>{snapshots++;return [];};
  c.kkSheet_=()=>({getRange(){return {setValues(){writeAttempts++;throw Error('SYNTHETIC_WRITE_BOUNDARY');}};}});
  c.kkDateObj_=v=>v;
  c.kkDateKey_=v=>String(v).replace(/-/g,'');
  c.kkSameDate_=(a,b)=>a===b;
  c.kkAssertEventDateChangeSafe_=()=>{dateChecks++;return true;};
  c.kkFindVisibilityHistory_=()=>null;
  c.kkPosterForWrite_=()=>{posters++;return {url:'https://example.invalid/synthetic.png'};};
  const poster_url='https://example.invalid/synthetic.png';
  rows=[event.slice(),event.slice()];
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,poster_url}),/EVENT_ID_AMBIGUOUS/);
  assert.equal(snapshots,0);
  rows=[event.slice()];
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,event_date:other,poster_url}),/EVENT_DATE_ID_MIGRATION_REQUIRED/);
  assert.equal(posters,0);assert.equal(writeAttempts,0);assert.equal(dateChecks,0);
  rows[0][2]=other;rows[0][6]=false;rows[0][5]='closed';
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,active_on_web:true,visibility_owner_intent:'explicit_owner_reopen',poster_url}),/EVENT_DATE_ID_MIGRATION_REQUIRED/);
  assert.equal(posters,0);assert.equal(writeAttempts,0);
  // Historical hidden records may still be annotated without reopening stock.
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,note:'SYNTHETIC ANNOTATION'}),/SYNTHETIC_WRITE_BOUNDARY/);
  assert.equal(posters,0);assert.equal(writeAttempts,1);
  // Correcting back to the encoded date and true same-day edits proceed.
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,event_date:day,poster_url}),/SYNTHETIC_WRITE_BOUNDARY/);
  rows=[event.slice()];
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:id,event_date:day}),/SYNTHETIC_WRITE_BOUNDARY/);
  assert.equal(posters,1);assert.equal(writeAttempts,3);assert.equal(dateChecks,2);
  assert.equal(f.mutex.held,false);assert.equal(f.counters.flush,0);
});


test('legacy LINE replay binds cached claims to unique canonical pending booking and exact caller identity',()=>{
  const f=fixture(),c=f.context;
  const request='line:'+'a'.repeat(48),event='EVT-SYNTHETIC',template='TPL-X500-PHONE',contact='U'+'b'.repeat(32);
  const payload={request_id:request,event_id:event,template_id:template,customer_name:'SYNTHETIC',customer_contact:contact,customer_phone:'',pickup_time:'16:00'};
  const claim={status:'OK',request_id:request,event_id:event,template_id:template,booking_id:'BKG-SYNTHETIC',row_number:5,template_binding_version:'KK_TEMPLATE_BINDING_V1',bound_package_type:'phone_only',quoted_price:0};
  const row=Array(20).fill('');
  row[0]=claim.booking_id;row[2]='pending';row[3]=event;row[4]=payload.customer_name;row[5]=contact;row[7]='LINE';row[8]='phone_only';row[11]='16:00';row[13]='unpaid';row[14]=0;
  row[19]=c.kkBookingNoteWithTemplate_(c.kkBookingNoteWithRequest_('synthetic',request),template,0);
  let rows=[row.slice()],writeAttempts=0;
  c.kkLineNativeConsentEnabled_=()=>false;c.kkLineInitialOutboxEnabled_=()=>false;
  c.kkLineBookingRequestKey_=()=> 'SYNTHETIC_CLAIM';
  c.kkGetValues_=(name,start,col,width)=>rows.map(r=>r.slice(col-1,col-1+width));
  c.kkSheet_=()=>({getRange(n){return {getValues:()=>[rows[n-5].slice()],setValues(){writeAttempts++;throw Error('unexpected write');}};}});
  c.kkFirstEmptyRow_=()=>{writeAttempts++;throw Error('unexpected allocation');};
  const setClaim=v=>{f.props.SYNTHETIC_CLAIM=JSON.stringify(v);};
  setClaim(claim);
  assert.equal(c.kkApiCreateLineBookingPending_(payload).idempotent_replay,true);
  assert.equal(f.counters.propsWrites,0);
  for(const patch of [{customer_contact:'U'+'c'.repeat(32)},{customer_name:'OTHER'},{customer_phone:'123'},{pickup_time:'17:00'},{template_id:'TPL-X300-PHONE'},{event_id:'EVT-OTHER'},{phone_asset_id:'PHONE-1'}]){
    assert.throws(()=>c.kkApiCreateLineBookingPending_({...payload,...patch}),/LINE_BOOKING_REPLAY_(?:IDENTITY_CONFLICT|CANONICAL_UNVERIFIED)/);
    assert.equal(f.mutex.held,false);
  }
  rows[0][2]='confirmed';
  assert.throws(()=>c.kkApiCreateLineBookingPending_(payload),/CANONICAL_UNVERIFIED/);
  rows=[row.slice(),row.slice()];
  assert.throws(()=>c.kkApiCreateLineBookingPending_(payload),/BOOKING_REQUEST_AMBIGUOUS/);
  rows[1][19]='other';
  assert.throws(()=>c.kkApiCreateLineBookingPending_(payload),/Duplicate booking_id/);
  rows=[row.slice()];rows[0][19]=row[19]+' '+c.kkBookingRequestMarker_(request);
  assert.throws(()=>c.kkApiCreateLineBookingPending_(payload),/BOOKING_REQUEST_AMBIGUOUS/);
  rows=[row.slice()];setClaim({...claim,initial_mode:'KK_LINE_INITIAL_OUTBOX_V1'});
  assert.throws(()=>c.kkApiCreateLineBookingPending_(payload),/IDENTITY_CONFLICT/);
  setClaim({...claim,status:'PENDING',customer_name:payload.customer_name,customer_contact:contact,customer_phone:''});
  assert.throws(()=>c.kkApiCreateLineBookingPending_({...payload,pickup_time:'18:00'}),/exact readback did not reconcile/);
  assert.equal(f.counters.propsWrites,0);
  assert.equal(c.kkApiCreateLineBookingPending_(payload).reconciled,true);
  assert.equal(f.counters.propsWrites,1);
  assert.equal(JSON.parse(f.props.SYNTHETIC_CLAIM).status,'OK');
  assert.equal(writeAttempts,0);assert.equal(f.counters.writes,0);assert.equal(f.mutex.held,false);
});
