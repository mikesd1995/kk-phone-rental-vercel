'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const H=require('../admin/snapshot-health.js');
const proxySource=fs.readFileSync(require.resolve('../server/admin-proxy.js'),'utf8');
function ui(){
 const source=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
 const take=(start,end)=>source.slice(source.indexOf('  function '+start+'('),source.indexOf('  function '+end+'('));
 const context={KK_ADMIN_UI_VERSION:H.VERSION,EXPECTED_PROXY_VERSION:H.VERSION,EXPECTED_BACKEND_VERSION:H.BACKEND,KKSnapshotHealth:H,snapshotState:{stale:false,goodAt:'test'},storefrontGuardRows:()=>[],bookingClosureGuardRows:()=>[]};
 vm.createContext(context);vm.runInContext(take('versionDiagnosticsRows','posterSyncText')+take('buildSnapshotGuardRows','renderSystemGuard'),context);
 return context;
}
const fallback=()=>({admin_api_version:'admin-direct-sheet-readonly-fallback-v3.1',frontend_proxy_version:H.VERSION,spreadsheet_id:'bound',frontend_sheet_id:'bound',phase1_diagnostics:{fallback_mode:true,admin_api_version:'admin-direct-sheet-readonly-fallback-v3.1'}});
test('reader snapshot cannot certify Apps Script revision or runtime sheet binding even if version strings match',()=>{
 const c=ui();
 for(const version of ['admin-direct-sheet-readonly-fallback-v3.1',H.BACKEND]){
  const d=fallback();d.admin_api_version=version;
  const rows=c.versionDiagnosticsRows(d);
  const runtime=rows.find(r=>r.check==='Version · Apps Script');
  assert.equal(runtime.status,'CHECK');assert.match(runtime.detail,/ยังไม่ยืนยัน/);
  assert.equal(rows.find(r=>r.check==='Version · Snapshot Reader').detail,version);
  assert.equal(rows.find(r=>r.check==='Sheet ID · Frontend vs Apps Script').status,'CHECK');
  assert.equal(rows.find(r=>r.check==='Sheet ID · Read Source').status,'OK');
  const guard=c.buildSnapshotGuardRows(d);
  assert.equal(guard.find(r=>r.label==='Apps Script Version').status,'WARN');
  assert.equal(guard.find(r=>r.label==='Sheet ID Match').status,'WARN');
 }
});
test('missing or invalid runtime booleans stay unknown without assumed setup or fallback availability',()=>{
 const c=ui();
 for(const value of [undefined,null,'false','true',0,1,{},[]]){
  const d=fallback();for(const key of ['poster_folder_id_set','log_sheets_ready','direct_fallback_disabled'])d.phase1_diagnostics[key]=value;
  const rows=c.versionDiagnosticsRows(d);
  for(const check of ['ENV · KK_POSTER_FOLDER_ID','Log Sheets','Read fallback']){
   const row=rows.find(r=>r.check===check);assert.equal(row.status,'CHECK');assert.match(row.detail,/ยังไม่ยืนยัน/);assert.doesNotMatch(row.note,/Setup\/Repair|emergency fallback available/);
  }
  const guard=c.buildSnapshotGuardRows(d);
  for(const label of ['Poster Folder','Audit/Error Logs']){
   const row=guard.find(r=>r.label===label);assert.equal(row.status,'WARN');assert.match(row.detail,/ยังไม่ยืนยัน/);assert.doesNotMatch(row.suggestion,/setup\/repair/i);
  }
 }
});
test('actual runtime true/false diagnostics keep original polarity and genuine negative warnings',()=>{
 const c=ui();
 for(const present of [true,false]){
  const d={admin_api_version:H.BACKEND,frontend_proxy_version:H.VERSION,spreadsheet_id:'bound',frontend_sheet_id:'bound',phase1_diagnostics:{poster_folder_id_set:present,log_sheets_ready:present,direct_fallback_disabled:present}};
  const rows=c.versionDiagnosticsRows(d);
  assert.equal(rows.find(r=>r.check==='Version · Apps Script').status,'OK');
  assert.equal(rows.find(r=>r.check==='ENV · KK_POSTER_FOLDER_ID').detail,present?'set':'missing');
  assert.equal(rows.find(r=>r.check==='Read fallback').status,present?'CHECK':'OK');
  const guard=c.buildSnapshotGuardRows(d);
  assert.equal(guard.find(r=>r.label==='Audit/Error Logs').status,present?'OK':'WARN');
  if(present)for(const label of ['Poster Folder','Audit/Error Logs'])assert.equal(guard.find(r=>r.label===label).suggestion,'');
 }
});
test('cached successful write probe does not turn reader provenance into live source proof',()=>{
 const c=ui(),d=fallback();d.write_path_health={ok:true,backend_version:H.BACKEND,cache_status:'hit',cache_age_ms:25000,grace_used:true};
 assert.equal(c.versionDiagnosticsRows(d).find(r=>r.check==='Version · Apps Script').status,'CHECK');
 assert.equal(c.buildSnapshotGuardRows(d).find(r=>r.label==='Apps Script Version').status,'WARN');
});
async function health(status,body,throws=false){
 const context={module:{exports:{}},require:id=>{
  if(id.includes('direct-writer-phase1'))return {routingState:()=>({ready:false,writer_ready:false,configured_actions:[]})};
  if(id.includes('core-sheet-private-reader'))return {enabled:()=>false};
  return require(id.includes('snapshot-health')?'../admin/snapshot-health.js':'../server/upstream-response.js');
 },process:{env:{}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console,
 fetch:async url=>{
  if(String(url).includes('script.google.com')){
   if(throws){const e=Error('timeout');e.name='AbortError';throw e;}
   return {ok:status>=200&&status<300,status,headers:{get:()=> 'application/json'},text:async()=>typeof body==='string'?body:JSON.stringify(body)};
  }
  return {ok:true,status:200,headers:{get:()=> 'text/csv'},text:async()=> 'event_id,poster_image_url,action_for_web,package_id,available_count,template_id\n'};
 }};
 vm.createContext(context);vm.runInContext(proxySource+'\nmodule.exports.buildSystemHealth=buildSystemHealth;',context);
 return context.module.exports.buildSystemHealth({}, {frontendSheetId:'bound',envSheetId:'bound',scriptUrl:'https://script.google.com/macros/s/test/exec',apiKey:'test',adminPin:'test'});
}
test('HTTP failure never certifies JSON or derived runtime identity even with ok:true',async()=>{
 const r=await health(503,{ok:true,data:{spreadsheet_id:'bound',poster_folder_id_set:true,log_sheets_ready:true}});
 assert.equal(r.ok,false);assert.equal(r.data.rows.find(x=>x.key==='apps_script_json').status,'FAIL');
 assert.equal(r.data.rows.some(x=>['same_sheet','poster_folder','log_sheets'].includes(x.key)),false);
});
test('healthy runtime and valid feed headers keep overall health successful',async()=>{
 const r=await health(200,{ok:true,admin_api_version:H.BACKEND,data:{spreadsheet_id:'bound',poster_folder_id_set:true,log_sheets_ready:true}});
 assert.equal(r.ok,true);assert.equal(r.data.summary.fail,0);
 assert.equal(r.data.rows.filter(x=>x.key.startsWith('feed_')&&x.status==='OK').length,3);
});
test('rejected or malformed envelopes never certify runtime diagnostics',async()=>{
 for(const body of [{ok:false,error:'Invalid API key',data:{spreadsheet_id:'bound'}},{ok:'true',data:{spreadsheet_id:'bound'}},{ok:true,data:[]},{ok:true,data:null},[],null,'<html>Sign in</html>']){
  const r=await health(200,body);assert.equal(r.ok,false);assert.equal(r.data.rows.some(x=>x.key==='same_sheet'),false);
 }
});
test('timeout remains a failure and valid diagnostics retain independent Sheet mismatch evidence',async()=>{
 assert.equal((await health(200,{},true)).data.rows.find(x=>x.key==='apps_script_reachable').status,'FAIL');
 for(const id of ['bound','other']){
  const r=await health(200,{ok:true,admin_api_version:H.BACKEND,data:{spreadsheet_id:id,poster_folder_id_set:true,log_sheets_ready:true}});
  assert.equal(r.data.rows.find(x=>x.key==='apps_script_json').status,'OK');
  assert.equal(r.data.rows.find(x=>x.key==='same_sheet').status,id==='bound'?'OK':'FAIL');
 }
});
test('accepted partial diagnostics retain unknown optional runtime flags without inferred repairs',async()=>{
 for(const value of [undefined,null,'false','true',0]){
  const r=await health(200,{ok:true,data:{spreadsheet_id:'bound',poster_folder_id_set:value,log_sheets_ready:value}});
  for(const key of ['poster_folder','log_sheets']){
   const row=r.data.rows.find(x=>x.key===key);assert.equal(row.status,'WARN');assert.match(row.detail,/not verified/);assert.doesNotMatch(row.suggestion,/Set Script Property|setup\/repair/i);
  }
 }
});
