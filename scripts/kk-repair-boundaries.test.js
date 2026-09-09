'use strict';
const assert=require('node:assert/strict');
const {Sheet,context}=require('./helpers/apps-script-sandbox');
const notify=require('../lib/kk-owner-notification-contract');
const source=require('../lib/kk-competitor-discovery-contract');
const market=require('../lib/kk-competitor-current-market');
const presentation=require('../lib/kk-market-presentation-contract');
const x=require('../lib/kk-x-publish-guard');
const crypto=require('node:crypto');
let count=0;function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}
test('delayed failure cannot demote a durable SENT receipt or enqueue retry',()=>{
  const prior={prior_status:'SENT',attempt_count:2,provider_message_id:'123',accepted_at:'2026-09-08T10:00:00+07:00',error:'LATE_FAILURE'};
  const r=notify.providerAckTransition(prior);assert.equal(r.status,'SENT');assert.equal(r.attempt_count,2);assert.equal(r.provider_message_id,'123');
  assert.throws(()=>notify.providerAckTransition({...prior,provider_message_id:''}),/RECONCILIATION/);
});
test('quarantined/cancelled notification and invalid ACK time cannot become SENT',()=>{
  for(const prior_status of ['QUARANTINED','CANCELLED','REJECTED','UNKNOWN'])assert.throws(()=>notify.providerAckTransition({prior_status,attempt_count:0,provider_message_id:'p',accepted_at:'2026-09-08T10:00:00Z'}));
  for(const accepted_at of ['garbage','2026-09-08T10:00:00',''])assert.notEqual(notify.providerAckTransition({attempt_count:0,provider_message_id:'p',accepted_at}).status,'SENT');
});
test('string FALSE does not satisfy notification consumer design guards',()=>{
  const d={ledger_only:'FALSE',queued_only:'FALSE',provider_id_on_sent:'FALSE',failure_updates_retry_wait:'FALSE',attempt_count_increments:'FALSE'};assert.equal(notify.telegramConsumerDesignAudit(d).pass,false);
});
test('X approved account is immutable scope and wrong account cannot be PUBLISHED',()=>{
  const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),body='SYNTHETIC ONLY';
  const input={target_account:'account_a',idempotency_key:'test',content:{status:'APPROVED',version_id:'v',approval_fingerprint:hash('approve'),selected_body:body,external_send_authorized:true,production_publish_authorized:true},creative_binding:{status:'CREATIVE_BOUND_READY',content_version_id:'v',approval_fingerprint:hash('approve'),selected_body_sha256:hash(body),creative_hash:hash('image'),source_asset_hash:hash('poster'),canva_design_id:'design'}};
  input.prior_publish_records=[];
  const request=x.authorizeXPublish(input);assert.notEqual(request.publish_scope_fingerprint,x.authorizeXPublish({...input,target_account:'account_b'}).publish_scope_fingerprint);
  assert.throws(()=>x.authorizeXPublish({...input,target_account:''}));
  const receipt={ok:true,post_id:'123',post_url:'https://x.com/account_b/status/123',received_at:'2026-09-08T10:00:00Z',provider_evidence_ref:'synthetic',exact_text_sha256:hash(body),creative_hash:hash('image')};
  assert.throws(()=>x.verifyProviderPublish(request,receipt),/account/);
  assert.throws(()=>x.authorizeXPublish({...input,prior_publish_records:[{...receipt,idempotency_key:'test',publish_scope_fingerprint:request.publish_scope_fingerprint}]}),/account/);
  assert.equal(x.verifyProviderPublish(request,{...receipt,post_url:'https://x.com/account_a/status/123'}).target_account,'account_a');
});
test('recurring source rejects executable URLs, credentials and malformed addresses',()=>{
  for(const direct_url of ['javascript:alert(1)','file:///private','data:text/html,x','https://secret@host.test/path','not a URL'])assert.equal(source.sourcePersistenceDecision({official_verified:true,recurring:true,source_name:'Org',direct_url}).decision,'HOLD');
});
test('source tracking aliases converge but distinct query routes are preserved',()=>{
  const base={official_verified:true,recurring:true,source_name:'Org'};
  const existing=[{direct_url:'https://example.test/events?id=1'}];
  assert.equal(source.sourcePersistenceDecision({...base,direct_url:'https://example.test/events/?utm_source=x&id=1#top'},existing).decision,'ALREADY_PRESENT');
  assert.equal(source.sourcePersistenceDecision({...base,direct_url:'https://example.test/events?id=2'},existing).decision,'UPSERT_DIRECT_SOURCE_MAP');
  assert.equal(source.sourcePersistenceDecision({...base,direct_url:existing[0].direct_url},[...existing,...existing]).decision,'HOLD');
});
test('single-shop bundle_price alias survives summary and foreign history never leaks',()=>{
  const options={event_key:'A',package_key:'B',now:'2026-09-08T10:00:00Z'};
  const offer={event_key:'A',package_key:'B',competitor_key:'shop',bundle_price:590,source_evidence_row:2,last_checked:'2026-09-08T09:00:00Z',fresh_until:'2026-09-08T11:00:00Z',freshness:'FRESH'};
  assert.equal(presentation.monthlyMarketSummary([offer],[],options).reference,590);
  assert.equal(presentation.monthlyMarketSummary([],[{...offer,event_key:'FOREIGN'}],options).kind,'NONE');
  assert.equal(presentation.monthlyMarketSummary([],[offer],{...options,own_competitor_ids:['shop']}).kind,'NONE');
});
test('price projection readback includes source URL, observation time and queue state',()=>{
  const base={event_key:'A',competitor_key:'shop',package_key:'B',current_bundle_price:590,source_evidence_row:2,last_checked:'2026-09-08T09:00:00Z',fresh_until:'2026-09-08T11:00:00Z',freshness:'FRESH',post_url:'https://example.test/p',queue_status:'OPEN'};
  for(const field of ['post_url','last_checked','queue_status'])assert.equal(market.assertProjectionReadback(base,{...base,[field]:'WRONG'}).ok,false);
  assert.equal(market.queueIsBookable({queue_status:'OPEN BUT FULL'}),false);
});
test('wrong spreadsheet request is rejected before action or diagnostic writes',()=>{
  const c=context();let invoked=0;c.kkApiRequireKey_=()=>{};c.SpreadsheetApp.getActive=()=>({getId:()=> 'ACTUAL'});c.kkApiCreateEvent_=()=>{invoked++;};c.kkErrorLog_=()=>{invoked++;};c.kkApiJson_=v=>v;
  const r=c.doPost({postData:{contents:JSON.stringify({action:'createEvent',frontendSheetId:'WRONG'})}});assert.equal(invoked,0);assert.equal(r.ok,false);
});
test('schema mismatch never rewrites headers above existing data',()=>{
  const sh=new Sheet('history',[['wrong'],['historical evidence']]);const c=context({history:sh});assert.throws(()=>c.kkEnsureSheetWithHeaders_('history',['expected']),/SCHEMA_MISMATCH/);assert.equal(sh.writes,0);assert.equal(sh.rows[1][0],'historical evidence');
});
test('archive and installer quarantine has zero reads, writes, deletions or scheduler calls',()=>{
  const c=context();let sideEffects=0;c.kkEnsureCrmArchiveSheets_=()=>{sideEffects++;};c.ScriptApp=new Proxy({},{get(){sideEffects++;throw Error('scheduler called');}});
  assert.throws(()=>c.kkCleanupOldData30Days_(),/MIGRATION_BLOCKED/);assert.throws(()=>c.kkInstallDailyCleanupTrigger(),/MIGRATION_BLOCKED/);assert.equal(sideEffects,0);
});
test('template shape cannot override another explicit template identity',()=>{
  const c=context();c.kkNormalizeTemplateIdForEvent_=(e,t)=>t;const row=['TPL-B','EV','phone_only','PHONE','',''];
  assert.equal(c.kkWebPackageRowMatchesTemplate_(row,'EV','TPL-A',{package_type:'phone_only',model_group:'PHONE',lens_group:''}),false);
  assert.equal(c.kkWebPackageRowMatchesTemplate_(row,'EV','TPL-B',{}),true);
});
test('logs omit customer fields, secrets and raw exception text',()=>{
  const c=context();const p={customer_name:'PRIVATE_NAME',customer_phone:'PRIVATE_PHONE',booking_note:'PRIVATE_NOTE',refresh_token:'SECRET',nested:{password:'SECRET2'}};
  const text=c.kkSafeStringify_(p);for(const value of ['PRIVATE_NAME','PRIVATE_PHONE','PRIVATE_NOTE','SECRET2'])assert.ok(!text.includes(value));
  let logged;c.kkAppendRowSafe_=(name,row)=>{logged=row;};c.kkErrorLog_('createBooking',p,new Error('PRIVATE_EXCEPTION'),Date.now());assert.ok(!JSON.stringify(logged).includes('PRIVATE_EXCEPTION'));
});
test('lens retirement cannot overwrite package sort_order with a bookable boolean',()=>{
  const assets=new Sheet('02_Assets',[[],[],[],[]]);const packages=new Sheet('03_Packages',[[],[],[],[],['TPL','NONE','lens_only','G2',590,'Legacy','',true,7,'']]);
  const c=context({'02_Assets':assets,'03_Packages':packages});c.kkRetireG2AssetsAndPackages_();assert.equal(packages.rows[4][7],false);assert.equal(packages.rows[4][8],7);
});
test('event date edit cannot change linked booking formula identity',()=>{
  const ev=new Sheet('01_Events',[[],[],[],[],['EV','Event',new Date('2099-01-01'),'Venue','','open',true,'']]);const booking=Array(20).fill('');booking[0]='BK';booking[3]='EV';
  const c=context({'01_Events':ev,'00_Master_Booking':new Sheet('00_Master_Booking',[[],[],[],[],booking])});c.kkSnapshotWebPackagePricesForEvent_=()=>[];
  assert.throws(()=>c.kkApiUpdateEvent_({event_id:'EV',event_date:'2099-01-02'}),/DATE_MIGRATION_REQUIRED/);assert.equal(ev.writes,0);
});
test('unknown event date of active booking cannot silently free reserved stock',()=>{
  const row=Array(20).fill('');Object.assign(row,{2:'confirmed',3:'MISSING_EVENT',9:'PHONE'});
  const c=context({'01_Events':new Sheet('01_Events',[[],[],[],[]]),'00_Master_Booking':new Sheet('00_Master_Booking',[[],[],[],[],row])});
  assert.throws(()=>c.kkBookedAssetIdsForDate_(new Date('2099-01-01')),/EVENT_DATE_MISSING/);
});
test('duplicate event, package, asset and override identities are not first/last-row wins',()=>{
  const c=context({'01_Events':new Sheet('01_Events',[[],[],[],[],['EV'],['EV']]),'03_Packages':new Sheet('03_Packages',[[],[],[],[],['TPL'],['TPL']]),'02_Assets':new Sheet('02_Assets',[[],[],[],[],['ASSET'],['ASSET']]),'04_Event_Overrides':new Sheet('04_Event_Overrides',[[],[],[],[],['EV','TPL'],['EV','TPL']])});
  assert.throws(()=>c.kkGetEventById_('EV'),/EXACT1/);assert.throws(()=>c.kkGetPackageByTemplateId_('TPL'),/EXACT1/);assert.throws(()=>c.kkFindAssetRow_('ASSET'),/EXACT1/);assert.throws(()=>c.kkFindOverrideRow_('EV','TPL'),/EXACT1/);
});
test('numeric values cannot accept infinity, boolean or object coercion',()=>{
  const c=context();for(const v of [Infinity,'Infinity',true,false,[],{}])assert.throws(()=>c.kkApiNumber_(v,'amount',false));
});
test('package create/update and event update join the canonical script lock',()=>{
  const c=context();c.LockService.getScriptLock=()=>({tryLock:()=>false});
  for(const fn of ['kkApiCreatePackage_','kkApiUpdatePackage_','kkApiUpdateEvent_'])assert.throws(()=>c[fn]({}),/ระบบกำลังบันทึก/);
});
test('price restoration rejects row reorder, duplicate keys and legacy row-only snapshots before any write',()=>{
  const sh=new Sheet('09_Web_Packages',[[],[],[],[],['P-A','EV','','','','','',500],['P-B','EV','','','','','',900]]);
  const c=context({'09_Web_Packages':sh});const saved=c.kkSnapshotWebPackagePricesForEvent_('EV');
  [sh.rows[4],sh.rows[5]]=[sh.rows[5],sh.rows[4]];
  assert.throws(()=>c.kkRestoreWebPackagePricesForEvent_(saved),/IDENTITY_DRIFT/);assert.equal(sh.writes,0);
  assert.throws(()=>c.kkRestoreWebPackagePricesForEvent_([{row:5,value:500,formula:''}]),/IDENTITY_DRIFT/);
  sh.rows[5]=sh.rows[4].slice();assert.throws(()=>c.kkSnapshotWebPackagePricesForEvent_('EV'),/IDENTITY_DRIFT/);assert.equal(sh.writes,0);
});
test('price restoration preserves exact matching value and detects readback corruption',()=>{
  const sh=new Sheet('09_Web_Packages',[[],[],[],[],['P','EV','','','','','',500]]);const c=context({'09_Web_Packages':sh});
  const saved=c.kkSnapshotWebPackagePricesForEvent_('EV');sh.rows[4][7]=0;
  assert.equal(c.kkRestoreWebPackagePricesForEvent_(saved),1);assert.equal(sh.rows[4][7],500);
  c.SpreadsheetApp.flush=()=>{sh.rows[4][7]=999;};assert.throws(()=>c.kkRestoreWebPackagePricesForEvent_(saved),/READBACK/);
});
test('real business schema guard rejects altered column names without relabeling',()=>{
  const headers='asset_id,asset_type,model_group,serial_no,status,notes,rentable_now'.split(',');
  const sh=new Sheet('02_Assets',[[],[],[],headers]);const c=context({'02_Assets':sh});assert.equal(c.actualKkSheet('02_Assets'),sh);
  headers[4]='wrong_column';assert.throws(()=>c.actualKkSheet('02_Assets'),/SCHEMA_MISMATCH/);assert.equal(sh.writes,0);
});
test('runtime CRM target binding is mandatory before even acquiring a writer lock',()=>{
  for(const property of ['', 'OTHER']){
    const c=context();let locks=0;c.PropertiesService.getScriptProperties=()=>({getProperty:()=>property});c.LockService.getScriptLock=()=>{locks++;throw Error('not reached');};
    assert.throws(()=>c.kkAcquireDocumentLock_('test',1000),/CRM_SPREADSHEET/);assert.equal(locks,0);
  }
});
test('bulk visibility preflights a later duplicate before changing the first package',()=>{
  const sh=new Sheet('04_Event_Overrides',[[],[],[],[],['EV','P1','','','','',''],['EV','P2'],['EV','P2']]);
  const pk=new Sheet('03_Packages',[[],[],[],[],['P1','','','','','','',true],['P2','','','','','','',true]]);
  const c=context({'04_Event_Overrides':sh,'03_Packages':pk});c.kkGetEventById_=()=>({});
  assert.throws(()=>c.kkApiBulkSetEventPackageVisibility_({event_id:'EV',mode:'hide'}),/EXACT1/);assert.equal(sh.writes,0);
});
test('CRM capacity guard cannot allocate beyond formula row 1000 or silently extend',()=>{
  const rows=Array.from({length:1000},(_,i)=>['ASSET-'+i]);const sh=new Sheet('02_Assets',rows);let inserts=0;sh.insertRowsAfter=()=>{inserts++;};const c=context({'02_Assets':sh});
  assert.throws(()=>c.kkEmptyRows_('02_Assets',1,5,1,7,1),/CAPACITY_MIGRATION/);assert.equal(inserts,0);assert.equal(sh.writes,0);
});
test('supplied Drive poster link cannot trigger file sharing',()=>{
  const c=context();let shares=0;c.kkEnsureDriveFilePublic_=()=>{shares++;throw Error('must not share');};
  const result=c.kkPosterForWrite_('https://drive.google.com/file/d/SYNTHETIC_POSTER_FILE/view');
  assert.equal(shares,0);assert.equal(result.public_checked,false);
});
test('unknown/freeform log keys are omitted rather than blacklisted by known PII names only',()=>{
  const c=context();const log=c.kkSafeStringify_({new_field:'SENSITIVE',message:'SENSITIVE',nested:{anything:'SENSITIVE'},count:2,event_id:'EV-TEST'});
  assert.ok(!log.includes('SENSITIVE'));assert.equal(JSON.parse(log).count,2);
});
test('asset deletion cannot clear a record without an archive transaction',()=>{
  const c=context();c.kkFindAssetRow_=()=>5;c.kkAssetUsageSummary_=()=>({current_active:0,current_total:0,archive_total:0});
  assert.throws(()=>c.kkApiDeleteAsset_({asset_id:'ASSET'}),/ASSET_ARCHIVE_REQUIRED/);
});
test('invalid calendar dates and formula-bearing business input are rejected',()=>{
  const c=context();assert.throws(()=>c.kkDateObj_('2026-02-30'),/CALENDAR_DATE/);assert.throws(()=>c.kkAssertLiteralRow_(['=IMPORTXML("https://example.test", "//x")']),/FORMULA_INPUT/);
});
test('booking compatibility check cannot auto-repair formulas or change marker state',()=>{
  const c=context();let writes=0;
  c.PropertiesService.getDocumentProperties=()=>({getProperty:()=>'',setProperty:()=>{writes++;}});
  c.kkRepairLensCompatibilityFormulas_=()=>{writes++;};c.kkEnsureZeissLensModelMaster_=()=>{writes++;};
  assert.throws(()=>c.kkEnsureLensCompatibilityPatchInstalled_(),/READINESS_UNVERIFIED/);assert.equal(writes,0);
  c.PropertiesService.getDocumentProperties=()=>null;assert.throws(()=>c.kkEnsureLensCompatibilityPatchInstalled_(),/READINESS_UNVERIFIED/);
});
test('prepared booking cannot guess between different model groups sharing package_type',()=>{
  const pk=new Sheet('03_Packages',[[],[],[],[],['P1','PHONE-A','phone_only','NONE',0,'','',true],['P2','PHONE-B','phone_only','NONE',0,'','',true]]);
  const c=context({'03_Packages':pk});assert.throws(()=>c.kkGetPackageSpecByType_('phone_only'),/AMBIGUOUS/);
  pk.rows[5][1]='PHONE-A';assert.equal(c.kkGetPackageSpecByType_('phone_only').model_group,'PHONE-A');
});
test('formula maintenance requires exact formula readback, not just successful setFormulas',()=>{
  const c=context();let written=0;
  assert.throws(()=>c.kkWriteFormulasReadback_({setFormulas:()=>{written++;},getFormulas:()=>[['=WRONG']]},[['=1+1']]),/READBACK_MISMATCH/);assert.equal(written,1);
});
test('accessory duplicate input fails before any mutation',()=>{
  const sh=new Sheet('06_Accessory_Stock',[[],[],[],[],['CABLE',2,0,2,'']]);const c=context({'06_Accessory_Stock':sh});
  c.SpreadsheetApp.getUi=()=>({alert:()=>{}});c.kkRange_=()=>({getValues:()=>[['CABLE',2,0,''],['CABLE',3,0,'']]});
  assert.throws(()=>c.kkUpdateAccessoryStockFromDashboard(),/INPUT_DUPLICATE/);assert.equal(sh.writes,0);
});
test('invalid accessory quantity in a later row cannot partially change an earlier row',()=>{
  const sh=new Sheet('06_Accessory_Stock',[[],[],[],[],['CABLE',2,0,2,'']]);const c=context({'06_Accessory_Stock':sh});
  c.SpreadsheetApp.getUi=()=>({alert:()=>{}});c.kkRange_=()=>({getValues:()=>[['CABLE',3,0,''],['CASE',1,2,'']]});
  assert.throws(()=>c.kkUpdateAccessoryStockFromDashboard(),/QUANTITY_INVALID/);assert.equal(sh.writes,0);
});
test('notification booleans, missing counters and invalid calendar times cannot become evidence',()=>{
  for(const attempt_count of [false,true,[],{},'NaN'])assert.throws(()=>notify.providerAckTransition({attempt_count}),/INVALID_ATTEMPT/);
  assert.throws(()=>notify.morningBriefPlan({bangkok_date:'2026-09-09',counts:{}}),/UNVERIFIED/);
  assert.throws(()=>notify.morningBriefPlan({bangkok_date:'2026-02-30',counts:{}}),/bangkok_date/);
  assert.notEqual(notify.providerAckTransition({attempt_count:0,provider_message_id:'p',accepted_at:'2026-02-30T12:00:00Z'}).status,'SENT');
});
test('legacy stats increment cannot bypass archive transaction quarantine',()=>{
  const c=context();assert.throws(()=>c.kkUpsertCustomerStat_([],{}),/CUSTOMER_STATS_TRANSACTION_REQUIRED/);
});
test('named range setup updates without delete and requires exact readback',()=>{
  const c=context();let writes=0,removes=0,released=0;let current;
  const ss={getId:()=> 'SYNTHETIC_SHEET',getNamedRanges:()=>[{getName:()=> 'TEST',remove:()=>{removes++;},setRange:r=>{writes++;current=r;}}],getRangeByName:()=>current};
  const range={getSheet:()=>({getName:()=> 'DASH',getParent:()=>ss}),getA1Notation:()=> 'B1'};
  require('node:vm').runInContext("KK_NAMED_RANGES.splice(0, KK_NAMED_RANGES.length, {name:'TEST',sheet:'DASH',a1:'B1'})",c);c.kkSheet_=()=>({getRange:()=>range});c.SpreadsheetApp.getActive=()=>ss;
  c.kkAcquireDocumentLock_=()=>({assertHeld:()=>{},releaseLock:()=>{released++;}});c.kkEnsureCrmArchiveSheets_=()=>{};c.kkEnsureAdminLogSheets_=()=>{};c.kkSafeAlert_=()=>{};
  c.kkSetupNamedRanges();assert.equal(writes,1);assert.equal(removes,0);assert.equal(released,1);
  ss.getRangeByName=()=>null;assert.throws(()=>c.kkSetupNamedRanges(),/READBACK_MISMATCH/);assert.equal(released,2);
});
test('date output follows CRM calendar and instants retain an explicit timezone',()=>{
  const c=context();let zone;c.Utilities.formatDate=(d,tz)=>{zone=tz;return '2026-09-09';};c.Session.getScriptTimeZone=()=>{throw Error('no implicit script calendar');};
  const d=new Date('2026-09-08T18:00:00Z');assert.equal(c.kkApiDate_(d),'2026-09-09');assert.equal(zone,'Etc/GMT');assert.equal(c.kkApiDateTime_(d),d.toISOString());
});
test('watch clock without offset or with invalid calendar date is not authoritative',()=>{
  const planner=require('../lib/kk-planner-materialization-contract');
  for(const now of ['2026-09-09T10:00:00','2026-02-30T10:00:00Z'])assert.equal(planner.dueWatchMaterializationGate({candidate_rows:[],now}).ok,false);
});
test('sharing setter success alone cannot claim public access verified',()=>{
  const c=context();let actual='PRIVATE';const file={getUrl:()=> 'https://drive.google.com/file/d/SYNTHETIC/view',setSharing:()=>{},getSharingAccess:()=>actual,getSharingPermission:()=> 'VIEW'};
  c.DriveApp={getFileById:()=>file,Access:{ANYONE_WITH_LINK:'ANYONE_WITH_LINK'},Permission:{VIEW:'VIEW'}};c.kkDrivePermissionApiSetAnyone_=()=>({ok:true});
  assert.equal(c.kkEnsureDriveFilePublic_('SYNTHETIC',{}).public_checked,false);actual='ANYONE_WITH_LINK';assert.equal(c.kkEnsureDriveFilePublic_('SYNTHETIC',{}).public_checked,true);
});
test('manual schema setup joins the canonical lock and releases before UI',()=>{
  const c=context();let held=false;c.kkAcquireDocumentLock_=()=>{held=true;return {releaseLock:()=>{held=false;}};};c.kkEnsureCrmArchiveSheets_=()=>assert.equal(held,true);c.kkEnsureAdminLogSheets_=()=>assert.equal(held,true);c.kkSafeAlert_=()=>assert.equal(held,false);c.kkEnsurePhase1Sheets();
});
console.log(`${count} repair boundary invariant groups passed (local only)`);
