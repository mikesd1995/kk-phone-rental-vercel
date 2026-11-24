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

test('booking price formula honors locked quote before historical price lookup without writing live formulas',()=>{
  const {context:c}=fixture();
  const formula=c.kkFormulaBookingPrice_(47);
  assert.match(formula,/REGEXEXTRACT\(T47,"\\\[KK_QUOTE:/);
  assert.match(formula,/SUMIFS\('09_Web_Packages'/);
  assert.ok(formula.indexOf('KK_QUOTE')<formula.indexOf('SUMIFS'));
});
