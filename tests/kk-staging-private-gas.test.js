'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CorePrivacy = require('../server/core-sheet-private-reader');

const source = fs.readFileSync(path.join(__dirname,'../apps-script/staging/Code.gs'),'utf8');
const CORE_SOURCE = fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
const SID = 'staging-owner-only-synthetic-sheet-id';
const SECRET = 'private_sandbox_key_very_long_and_unique_123';
const SCRIPT_URL = 'https://script.google.com/macros/s/STAGING_SAFETY_TEST_ONLY_123456789/exec';
const REDIRECT = 'https://script.googleusercontent.com/macros/echo?user_content_key=synthetic';
const eventHeaders = ['event_id','event_name','event_date_text','venue','poster_image_url',
  'event_note','available_phone_count','available_lens_count','booking_status_for_web',
  'action_for_web','line_message_template'];
const pkgHeaders = ['package_id','event_id','package_type','model_group','model_display',
  'lens_group','lens_display','price','available_count','package_status','sort_order',
  'web_note','raw_available_count','use_case'];
const eventRows = [
  eventHeaders,
  ['EVT-20261218-SYNTHETIC-01','TEST-ONLY', '18/12/2026','SANDBOX','',
    'Synthetic event','2','1','เปิดจอง','show','DO NOT SEND'],
  ['EVT-20261219-SYNTHETIC-02','CLOSED TEST','19/12/2026','SANDBOX','',
    'Synthetic event','0','0','เต็ม','hide','DO NOT SEND']
];
const packageRows = [
  pkgHeaders,
  ['PKG-STAGING-01','EVT-20261218-SYNTHETIC-01','phone_only',
    'VIVO_X300_PRO','vivo X300 Pro','NONE','','790','1','available','1','','1',''],
  ['PKG-STAGING-02','EVT-20261218-SYNTHETIC-01','phone_lens_bundle',
    'VIVO_X300_PRO','vivo X300 Pro','ZEISS_2_35X','200 mm','990','1','available','2','','1',''],
  ['PKG-STAGING-03','EVT-20261218-SYNTHETIC-01','phone_only',
    'VIVO_X500_PRO_MAX','vivo X500 Pro Max','NONE','','1090','1','available','3','','1',''],
  ['PKG-STAGING-04','EVT-20261218-SYNTHETIC-01','phone_lens_bundle',
    'VIVO_X500_PRO_MAX','vivo X500 Pro Max','ZEISS_2_35X','200 mm','1290','1','available','4','','1',''],
  ['PKG-STAGING-05','EVT-20261218-SYNTHETIC-01','phone_lens_bundle',
    'VIVO_X500_PRO_MAX','vivo X500 Pro Max','ZEISS_400MM','400 mm','1490','1','available','5','','1','']
];
const props = {
  KK_STAGING_SHEET_ID: SID,
  KK_STAGING_PRIVATE_READ_ENABLED: '1',
  KK_CORE_PRIVATE_READ_KEY: SECRET,
  KK_ADMIN_API_KEY: 'different_admin_key_not_used_for_reads'
};
function request(sheet='08_Web_Ready',range='A4:K'){
  return {action:'privateCoreRead',readKey:SECRET,coreSheetId:SID,sheet,range};
}
function fixture(options={}){
  const propertyMap={...props,...(options.props||{})};
  const counters={sheetReads:0,readmeReads:0,driveChecks:0,mutationCalls:0};
  const table={
    '08_Web_Ready':(options.corruptHeader ? [['customer_phone',...eventHeaders.slice(1)],...eventRows.slice(1)] : eventRows).map(row=>row.slice()),
    '09_Web_Packages':packageRows.map(row=>row.slice())
  };
  if(options.realEventInserted)table['08_Web_Ready'][1][0]='EVT-20261218-LIVE-CUSTOMER';
  if(options.realPackageInserted)table['09_Web_Packages'][1][0]='PKG-LIVE-REAL';
  if(options.packageWrongType)table['09_Web_Packages'][2][2]='phone_lens_200';
  if(options.packageWrongLens)table['09_Web_Packages'][2][5]='LENS_200';
  if(options.incompatible400Lens)table['09_Web_Packages'][2][5]='ZEISS_400MM';
  if(options.duplicatePackageId)table['09_Web_Packages'][2][0]=table['09_Web_Packages'][1][0];
  if(options.duplicateEventId)table['08_Web_Ready'][2][0]=table['08_Web_Ready'][1][0];
  if(options.emptyEventRows)table['08_Web_Ready']=table['08_Web_Ready'].slice(0,1);
  const spreadsheet={
    getId:()=>options.activeId||SID,
    getSheetByName(name){
      if(name==='_STAGING_README')return{
        getRange(a1){return{getDisplayValue(){
          counters.readmeReads++;
          if(a1==='A1')return options.invalidSentinel?'PRODUCTION CORE':'KK LINE SYNTHETIC STAGING — NOT CANONICAL';
          if(a1==='B2')return 'OWNER-PRIVATE SANDBOX; NO PRODUCTION CONNECTIVITY';
          return '';
        }};}
      };
      const values=table[name];
      if(!values)return null;
      return {
        getLastRow:()=>options.lastRow||values.length+3,
        getRange(a1){return{getDisplayValues(){
          counters.sheetReads++;
          if(options.throwRead)throw Error('SECRET_IN_ERROR_SHOULD_NOT_LEAK');
          const expected=name==='08_Web_Ready'?'A4:K':'A4:N';
          if(!a1.startsWith(expected))throw Error('unexpected range '+a1);
          return values.map(r=>r.slice());
        }};}
      };
    }
  };
  const sandbox={
    SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>propertyMap[key]})},
    DriveApp:{
      Access:{PRIVATE:'PRIVATE',ANYONE:'ANYONE'},
      getFileById(id){
        counters.driveChecks++;
        assert.equal(id,SID);
        return {
          getSharingAccess:()=>options.publicAcl?'ANYONE':'PRIVATE',
          getViewers:()=>options.viewer?['foreign-viewer']:[],
          getEditors:()=>options.editor?['foreign-editor']:[]
        };
      }
    },
    ContentService:{
      MimeType:{JSON:'application/json'},
      createTextOutput(text){return {text,setMimeType(){return this;}};}
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{timeout:1000});
  function invoke(input=request()){
    const response=sandbox.doPost({postData:{contents:JSON.stringify(input)}});
    return JSON.parse(response.text);
  }
  return {invoke,counters,sandbox};
}

test('staging reader lives in standalone path, never changes production GAS dispatch',()=>{
  assert.match(source,/function doPost\(event\)/);
  assert.match(source,/KK_STAGING_SENTINEL_/);
  assert.match(source,/KK_STAGING_PRIVATE_READ_ENABLED/);
  assert.doesNotMatch(source,/createBooking|setValues|setValue\(|appendRow|UrlFetchApp|LINE_CHANNEL_ACCESS_TOKEN/);
  assert.match(CORE_SOURCE,/function kkApiPrivateCoreRead_/);
});

test('private owner-only staging serves exact synthetic event and package schemas',()=>{
  const x=fixture();
  const event=x.invoke();
  const packs=x.invoke(request('09_Web_Packages','A4:N'));
  assert.equal(event.ok,true);
  assert.equal(packs.ok,true);
  assert.equal(event.data.spreadsheet_id,SID);
  assert.equal(event.data.range,'A4:K');
  assert.deepEqual(Array.from(event.data.values[0]),eventHeaders);
  assert.deepEqual(Array.from(packs.data.values[0]),pkgHeaders);
  assert.equal(packs.data.values.length,6,'five synthetic storefront packages');
  assert.deepEqual(packs.data.values.slice(1).map(row=>[row[2],row[3],row[5]]),[
    ['phone_only','VIVO_X300_PRO','NONE'],
    ['phone_lens_bundle','VIVO_X300_PRO','ZEISS_2_35X'],
    ['phone_only','VIVO_X500_PRO_MAX','NONE'],
    ['phone_lens_bundle','VIVO_X500_PRO_MAX','ZEISS_2_35X'],
    ['phone_lens_bundle','VIVO_X500_PRO_MAX','ZEISS_400MM']
  ]);
  assert.equal(x.counters.sheetReads,2);
});

test('staging rejects identity, sharing, key, flag, sentinel and range failures before reading feed',()=>{
  const cases=[
    [{publicAcl:true},request()],
    [{viewer:true},request()],
    [{editor:true},request()],
    [{invalidSentinel:true},request()],
    [{activeId:'foreign-booking-data-id'},request()],
    [{props:{KK_STAGING_PRIVATE_READ_ENABLED:'0'}},request()],
    [{props:{KK_STAGING_SHEET_ID:'foreign-id'}},request()],
    [{props:{KK_CORE_PRIVATE_READ_KEY:'weak'}},request()],
    [{props:{KK_ADMIN_API_KEY:SECRET}},request()],
    [{}, {...request(),readKey:'wrong-secret'}],
    [{}, {...request(),coreSheetId:'foreign-booking-data-id'}],
    [{}, {...request(),action:'createBooking'}],
    [{}, request('00_Master_Booking','A4:X')],
    [{}, request('08_Web_Ready','A4:Z')],
    [{}, request('09_Web_Packages','A1:N')],
    [{lastRow:251},request()],
    [{lastRow:4001},request()],
    [{realEventInserted:true},request()],
    [{realPackageInserted:true},request('09_Web_Packages','A4:N')],
    [{packageWrongType:true},request('09_Web_Packages','A4:N')],
    [{packageWrongLens:true},request('09_Web_Packages','A4:N')],
    [{incompatible400Lens:true},request('09_Web_Packages','A4:N')],
    [{duplicatePackageId:true},request('09_Web_Packages','A4:N')],
    [{duplicateEventId:true},request()],
    [{emptyEventRows:true},request()],
    [{corruptHeader:true},request()],
    [{throwRead:true},request()]
  ];
  for(const [options,input] of cases){
    const f=fixture(options);
    const result=f.invoke(input);
    assert.deepEqual(result,{ok:false,error_code:'STAGING_PRIVATE_READ_DENIED'});
    assert.doesNotMatch(JSON.stringify(result),/SECRET_IN_ERROR|foreign-booking|readKey|admin_key|synthetic-sheet-id/);
    assert.equal(f.counters.mutationCalls,0);
  }
});

test('staging source only emits fixed error for malformed/oversized requests',()=>{
  const f=fixture();
  for(const raw of ['{not-json',JSON.stringify(request())+' '.repeat(2100),'']){
    const result=JSON.parse(f.sandbox.doPost({postData:{contents:raw}}).text);
    assert.deepEqual(result,{ok:false,error_code:'STAGING_PRIVATE_READ_DENIED'});
  }
  assert.equal(f.counters.sheetReads,0);
});

function fakeGoogleTransport(f){
  const calls=[];
  const transport=async (url,init={})=>{
    calls.push({url,method:init.method,redirect:init.redirect});
    if(url===SCRIPT_URL){
      assert.equal(init.method,'POST');
      assert.equal(init.redirect,'manual');
      const input=JSON.parse(init.body);
      assert.equal(input.readKey,SECRET);
      assert.equal(input.action,'privateCoreRead');
      return {status:302,headers:{get:key=>key==='location'?REDIRECT:null}};
    }
    assert.equal(url,REDIRECT);
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'error');
    return {status:200,ok:true,url:REDIRECT,json:async()=>f.invoke(calls[0].request)};
  };
  // Preserve POST payload without ever putting it in the call log diagnostics.
  const wrapped=async(url,init={})=>{
    if(url===SCRIPT_URL){
      const payload=JSON.parse(init.body);
      const ret=await transport(url,init);
      calls[0].request=payload;
      return ret;
    }
    return transport(url,init);
  };
  return {calls,fetchImpl:wrapped};
}

test('existing Node private reader interoperates with standalone GAS via validated Google redirect',async()=>{
  const reader=require('../server/core-sheet-apps-script-reader.js');
  const fixtureServer=fixture();
  const mock=fakeGoogleTransport(fixtureServer);
  const env={
    GOOGLE_SHEET_ID:SID,KK_CORE_PRIVATE_READ_KEY:SECRET,
    KK_ADMIN_SCRIPT_URL:SCRIPT_URL,KK_ADMIN_API_KEY:props.KK_ADMIN_API_KEY
  };
  const values=await reader.readValues({sheetId:SID,sheet:'08_Web_Ready',range:'A4:K',env,fetchImpl:mock.fetchImpl});
  assert.deepEqual(values,eventRows);
  assert.deepEqual(mock.calls.map(c=>c.method),['POST','GET']);
  assert.equal(fixtureServer.counters.sheetReads,1);
});

function fakeResponse(){
  return {
    headers:{},statusCode:200,body:'',
    setHeader(key,value){this.headers[String(key).toLowerCase()]=String(value);},
    end(content){this.body=String(content||'');}
  };
}
async function withEnv(patch,fn){
  const old={};
  for(const key of Object.keys(patch)){
    old[key]=process.env[key];
    if(patch[key]===undefined)delete process.env[key];else process.env[key]=patch[key];
  }
  try{return await fn();}
  finally{for(const key of Object.keys(patch)){
    if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];
  }}
}
test('existing /api/kk-data serves only bounded synthetic private GAS feeds, no GViz fallback',async()=>{
  const handler=require('../api/kk-data.js');
  const f=fixture();
  const mock=fakeGoogleTransport(f);
  const originalFetch=global.fetch;
  global.fetch=mock.fetchImpl;
  const env={
    GOOGLE_SHEET_ID:SID,KK_CRM_SHEET_ID:undefined,
    KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
    KK_CORE_PRIVATE_TRANSPORT:'apps-script',
    KK_CORE_PRIVATE_READ_KEY:SECRET,
    KK_ADMIN_SCRIPT_URL:SCRIPT_URL,
    KK_ADMIN_API_KEY:props.KK_ADMIN_API_KEY,
    KK_PUBLIC_SHEET_REQUIRE_PRIVATE:'1',
    GOOGLE_SERVICE_ACCOUNT_JSON:undefined,
    GOOGLE_SERVICE_ACCOUNT_EMAIL:undefined,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined
  };
  try{
    await withEnv(env,async()=>{
      for(const [sheet,range,marker] of [
        ['08_Web_Ready','A4:K','EVT-20261218-SYNTHETIC-01'],
        ['09_Web_Packages','A4:N','PKG-STAGING-01']
      ]){
        const res=fakeResponse();
        await handler({method:'GET',url:'/api/kk-data?sheet='+sheet+'&range='+encodeURIComponent(range)},res);
        assert.equal(res.statusCode,200);
        assert.equal(res.headers['x-kk-sheet-source'],'private-owner-apps-script');
        assert.equal(res.headers['x-kk-private-reader-strict'],'1');
        assert.match(res.body,new RegExp(marker));
        assert.doesNotMatch(res.body,/customer_phone|SECRET_IN_ERROR/);
      }
    });
    assert.equal(mock.calls.filter(c=>c.url.startsWith('https://docs.google.com')).length,0);
    assert.equal(mock.calls.filter(c=>c.method==='POST').length,2);
    assert.equal(f.counters.sheetReads,2);
  }finally{global.fetch=originalFetch;}
});

test('strict public endpoint returns 503 on revoked staging ACL without any public fallback',async()=>{
  const handler=require('../api/kk-data.js');
  const f=fixture({publicAcl:true});
  const mock=fakeGoogleTransport(f);
  const old=global.fetch;global.fetch=mock.fetchImpl;
  try{
    await withEnv({
      GOOGLE_SHEET_ID:SID,KK_CRM_SHEET_ID:undefined,KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
      KK_CORE_PRIVATE_TRANSPORT:'apps-script',KK_CORE_PRIVATE_READ_KEY:SECRET,
      KK_ADMIN_SCRIPT_URL:SCRIPT_URL,KK_ADMIN_API_KEY:props.KK_ADMIN_API_KEY
    },async()=>{
      const res=fakeResponse();
      await handler({method:'GET',url:'/api/kk-data?sheet=08_Web_Ready&range=A4%3AK'},res);
      assert.equal(res.statusCode,503);
      assert.equal(res.headers['x-kk-sheet-source'],'private-read-failed');
      assert.doesNotMatch(res.body,/staging-owner|secret|stack|PRIVATE_KEY/i);
      assert.equal(mock.calls.length,2);
    });
    assert.equal(f.counters.sheetReads,0);
  }finally{global.fetch=old;}
});
