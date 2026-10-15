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
  KK_ADMIN_API_KEY:'SECRET_NOT_FOR_OUTPUT',
  KK_CORE_PRIVATE_READ_KEY:'unit_fixture_read_key_abcdefghijklmnopqrstuvwxyz_12345'
};
const config={...env,GOOGLE_SERVICE_ACCOUNT_EMAIL:undefined,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined};
function okResponse(values,extra={}){
 return {ok:true,url:'https://script.googleusercontent.com/macros/echo',json:async()=>({
   ok:true,data:{spreadsheet_id:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',values},...extra
 })};
}
test('alternate transport is strictly opt-in and rejects non-Google/script URL/credential absent',()=>{
 assert.equal(core.state({}).transport,'none');
 assert.equal(core.state(config).configured,true);
 assert.equal(core.state({KK_CORE_SHEET_REQUIRE_PRIVATE:'1',GOOGLE_SHEET_ID:'owner-test',
  GOOGLE_SERVICE_ACCOUNT_EMAIL:'read@example.invalid',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'dummy'}).configured,false,
  'strict Core cannot silently switch to a service account when the owner-selected transport is unspecified');
 assert.equal(core.state(config).authMode,'apps_script_key');
 for(const bad of [
  'https://evil.com/macros/s/example/exec',
  'http://script.google.com/macros/s/example/exec',
  'https://script.google.com/evil',
  'https://script.google.com/macros/s/example/exec?redirect=https://evil.com',
  'https://script.google.com.evil.test/macros/s/example/exec',
  'https://script.google.com/macros/s/example/exec#xx'
 ])assert.equal(script.scriptState({...config,KK_ADMIN_SCRIPT_URL:bad}).configured,false,bad);
 assert.equal(script.scriptState({...config,KK_ADMIN_API_KEY:''}).configured,true);
 assert.equal(script.scriptState({...config,KK_CORE_PRIVATE_READ_KEY:''}).configured,false);
 assert.equal(script.scriptState({...config,KK_CORE_PRIVATE_READ_KEY:'short'}).configured,false);
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
 assert.equal(body.readKey,env.KK_CORE_PRIVATE_READ_KEY);
 assert.equal(body.apiKey,undefined);
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
test('Apps Script action requires a separate private read key and extra Script Property, exact allowlist, bounded source, and skips request audit logging',()=>{
 assert.match(appSource,/if\(action==='privateCoreRead'\) kkApiRequirePrivateReadKey_\(payload\);/);
 assert.match(appSource,/else kkApiRequireKey_\(payload\);/);
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


test('ContentService redirect is checked BEFORE following; second GET carries zero credentials',async()=>{
 const calls=[];
 const values=await script.readValues({env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',
   fetchImpl:async(url,options)=>{
     calls.push({url,options});
     if(calls.length===1)return {
       status:302,ok:false,url:env.KK_ADMIN_SCRIPT_URL,
       headers:{get:()=> 'https://script.googleusercontent.com/macros/echo?user_content_key=REDACTED'}
     };
     return okResponse([['event_id'],['E1']]);
   }
 });
 assert.equal(calls.length,2);
 assert.equal(values.length,2);
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[1].options.method,'GET');
 assert.equal(calls[1].options.redirect,'error');
 assert.equal(calls[1].options.body,undefined);
 assert.equal(calls[1].options.headers,undefined);
 assert.doesNotMatch(JSON.stringify(calls[1]),/SECRET_NOT_FOR_OUTPUT/);
 let second=0;
 await assert.rejects(()=>script.readValues({env:config,sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',
   fetchImpl:async()=>{second++;return {status:302,ok:false,headers:{get:()=> 'https://evil.example/private'}}}
 }),e=>e.code==='CORE_APPS_SCRIPT_BAD_REDIRECT');
 assert.equal(second,1);
});


function simulateScriptRead({property='1',id='private-core-example',lastRow=6}={}){
 const acl=appSource.match(/const KK_PRIVATE_CORE_READ_ALLOWLIST = Object\.freeze\([\s\S]*?\n\}\);/);
 const fn=appSource.match(/function kkApiPrivateCoreRead_\(payload\)\{[\s\S]*?\n\}/);
 assert.ok(acl&&fn,'private Core Apps Script allowlist or function missing');
 const scriptProps={getScriptProperties(){return {getProperty:()=>property}}};
 const spreadsheet={getId:()=>id,getSheetByName:name=>name==='08_Web_Ready'?{
   getLastRow:()=>lastRow,getRange:a1=>({getDisplayValues:()=>[['event_id','event_name'],['EVT-1','Concert']]})
 }:null};
 const factory=Function('PropertiesService','SpreadsheetApp',acl[0]+'\n'+fn[0]+'\nreturn kkApiPrivateCoreRead_;');
 return factory(scriptProps,{getActive:()=>spreadsheet});
}
test('Apps Script function itself rejects disabled service, spoofed workbook and arbitrary range',()=>{
 const input={coreSheetId:'private-core-example',sheet:'08_Web_Ready',range:'A4:K'};
 assert.throws(()=>simulateScriptRead({property:''})(input),/PRIVATE_CORE_READ_DISABLED/);
 assert.throws(()=>simulateScriptRead({id:'other'})(input),/PRIVATE_CORE_ID_MISMATCH/);
 assert.throws(()=>simulateScriptRead()({...input,sheet:'00_Master_Booking',range:'A1:ZZ'}),/PRIVATE_CORE_RANGE_DENIED/);
 assert.throws(()=>simulateScriptRead()({...input,range:'A1:K'}),/PRIVATE_CORE_RANGE_DENIED/);
 assert.throws(()=>simulateScriptRead({lastRow:4001})(input),/PRIVATE_CORE_RANGE_NOT_READY/);
});
test('Apps Script function exact allowed range returns selected display values with canonical identity',()=>{
 const result=simulateScriptRead()({coreSheetId:'private-core-example',sheet:'08_Web_Ready',range:'A4:K'});
 assert.equal(result.data.spreadsheet_id,'private-core-example');
 assert.equal(result.data.sheet,'08_Web_Ready');
 assert.equal(result.data.range,'A4:K');
 assert.deepEqual(result.data.values,[['event_id','event_name'],['EVT-1','Concert']]);
});
