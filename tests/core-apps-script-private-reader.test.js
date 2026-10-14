'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../server/core-sheet-private-reader');
const script=require('../server/core-sheet-apps-script-reader');
const privateSheets=require('../api/lib/private-google-sheets');
const appSource=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
const env={
  KK_CORE_SHEET_REQUIRE_PRIVATE:'1',KK_CORE_PRIVATE_TRANSPORT:'apps-script',
  GOOGLE_SHEET_ID:'private-core-example',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/example_123-AB/exec',
  KK_ADMIN_API_KEY:'SECRET_NOT_FOR_OUTPUT'
};
const config={...env,GOOGLE_SERVICE_ACCOUNT_EMAIL:undefined,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined};
function okResponse(values,extra={}){
 return {ok:true,url:'https://script.googleusercontent.com/macros/echo',json:async()=>({
   ok:true,data:{spreadsheet_id:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',values},...extra
 })};
}
test('alternate transport is strictly opt-in and rejects non-Google/script URL/credential absent',()=>{
 assert.equal(core.state({}).transport,'service-account');
 assert.equal(core.state(config).configured,true);
 assert.equal(core.state(config).authMode,'apps_script_key');
 for(const bad of [
  'https://evil.com/macros/s/example/exec',
  'http://script.google.com/macros/s/example/exec',
  'https://script.google.com/evil',
  'https://script.google.com/macros/s/example/exec?redirect=https://evil.com',
  'https://script.google.com.evil.test/macros/s/example/exec',
  'https://script.google.com/macros/s/example/exec#xx'
 ])assert.equal(script.scriptState({...config,KK_ADMIN_SCRIPT_URL:bad}).configured,false,bad);
 assert.equal(script.scriptState({...config,KK_ADMIN_API_KEY:''}).configured,false);
});
test('Apps Script Core read stays bound to canonical Core ID and Google HTTPS URL',async()=>{
 let sent=null;
 const values=await script.readValues({
   env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',
   fetchImpl:async(url,options)=>{sent={url,options};return okResponse([['event_id','event_name'],['EVT-A','A']])}
 });
 assert.equal(values.length,2);
 assert.equal(sent.url,env.KK_ADMIN_SCRIPT_URL);
 assert.equal(sent.options.method,'POST');
 const body=JSON.parse(sent.options.body);
 assert.equal(body.action,'privateCoreRead');
 assert.equal(body.coreSheetId,env.GOOGLE_SHEET_ID);
 assert.equal(body.apiKey,env.KK_ADMIN_API_KEY);
 assert.equal(body.sheet,'08_Web_Ready');
 assert.equal(body.range,'A4:K');
 assert.equal(core.requireExplicitPrivateSource(env.GOOGLE_SHEET_ID,config),env.GOOGLE_SHEET_ID);
});
test('no public fallback and reject mismatched IDs, non-Google redirect and unexpected JSON shape',async()=>{
 await assert.rejects(()=>script.readValues({...{
   env:config,sheetId:'OTHER',sheet:'08_Web_Ready',range:'A4:K'},fetchImpl:async()=>{throw Error('must not fetch')}}),e=>e.code==='CORE_APPS_SCRIPT_ID_MISMATCH');
 for(const response of [
  {...okResponse([['a']]),url:'https://bad.example/redirect'},
  {ok:true,url:'https://script.googleusercontent.com/',json:async()=>({ok:true,data:{spreadsheet_id:'OTHER',sheet:'08_Web_Ready',range:'A4:K',values:[['x']]}})},
  {ok:true,url:'https://script.googleusercontent.com/',json:async()=>({ok:true,data:{spreadsheet_id:env.GOOGLE_SHEET_ID,sheet:'00_Master_Booking',range:'A4:K',values:[['x']]}})}
 ]){
   await assert.rejects(()=>script.readValues({env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',fetchImpl:async()=>response}),e=>String(e.code||'').startsWith('CORE_APPS_SCRIPT_'));
 }
});
test('server private Core API dispatches explicitly selected Apps Script transport and serializes bounded CSV',async()=>{
 const orig=script.readValues;
 let count=0;
 script.readValues=async()=>{count++;return [['event_id','event_name'],['EVT-A','A']]};
 try{
   const v=await core.readValues({env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K'});
   const csv=await core.readCsv({env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K'});
   assert.equal(v.length,2);
   assert.match(csv,/event_id,event_name/);
   assert.equal(count,2);
 }finally{script.readValues=orig}
});
test('Apps Script action requires admin key and extra Script Property, exact allowlist, bounded source, and skips request audit logging',()=>{
 assert.match(appSource,/kkApiRequireKey_\(payload\);[\s\S]*?switch \(action\)/);
 assert.match(appSource,/case 'privateCoreRead': result = kkApiPrivateCoreRead_\(payload\); break;/);
 assert.match(appSource,/KK_CORE_PRIVATE_READ_ENABLED/);
 assert.match(appSource,/KK_PRIVATE_CORE_READ_ALLOWLIST/);
 assert.match(appSource,/KK_PRIVATE_CORE_READ_ALLOWLIST\[sheet\]\.indexOf\(range\)<0/);
 assert.match(appSource,/requestedEnd>4000/);
 assert.match(appSource,/action !== 'privateCoreRead'\) kkAuditLog_/);
 assert.match(appSource,/action !== 'privateCoreRead'\) kkErrorLog_/);
 const open=appSource.match(/function doGet\(\)\s*\{[\s\S]*?\n\}/);
 assert.ok(open);
 assert.doesNotMatch(open[0],/spreadsheet_id/);
});
