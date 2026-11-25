'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Preflight=require('../scripts/core-private-cutover-preflight.cjs');

const env={KK_CORE_SHEET_REQUIRE_PRIVATE:'1',KK_CORE_PRIVATE_TRANSPORT:'apps-script',
  GOOGLE_SHEET_ID:'fixture-core-only',KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/fixture_only/exec',
  KK_ADMIN_API_KEY:'admin-fixture-only',KK_CORE_PRIVATE_READ_KEY:'reader_fixture_key_abcdefghijklmnopqrstuvwxyz'};
const publicEvents=['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web','line_message_template'];
const publicPackages=['package_id','event_id','package_type','model_group','model_display','lens_group','lens_display','price','available_count','package_status','sort_order','web_note','raw_available_count','use_case'];
const headers={'01_Events':['event_id','event_name'],'00_Master_Booking':['booking_id'],
  '02_Assets':['asset_id'],'03_Packages':['template_id'],'04_Event_Overrides':['event_id'],
  '11_Customer_Stats':['customer_key'],'10_Admin_Health_Check':['Check'],
  'Model_Master':['model_group'],'18_Event_Visibility_Locks':['lock_id'],
  '_Rental_Dashboard_Data':['Source','Booking ID'],'13_Event_Archive':['archived_at']};
function fixture({sheet,range},withData=true){
  const width=range.startsWith('A4:J')?10:sheet==='09_Web_Packages'?({N:14,M:13,L:12}[range.slice(-1)]):11;
  const h=sheet==='08_Web_Ready'?publicEvents.slice(0,width):sheet==='09_Web_Packages'?publicPackages.slice(0,width):headers[sheet];
  return withData?[h,['PRIVATE_CUSTOMER_VALUE_NEVER_REPORT']]:[h];
}
function pairsFromGas(){
  const text=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  const match=text.match(/const KK_PRIVATE_CORE_READ_ALLOWLIST = Object\.freeze\((\{[\s\S]*?\})\);/);
  assert.ok(match,'GAS must still have a fixed allowlist');
  const allow=vm.runInNewContext('('+match[1]+')',Object.create(null));
  return Object.entries(allow).flatMap(([sheet,ranges])=>Array.from(ranges,range=>sheet+'!'+range)).sort();
}

test('preflight covers all19 exact Apps Script source allowlist pairs, including six consumer variants',async()=>{
  const calls=[];
  const out=await Preflight.probe({env,reader:async info=>{calls.push(info.sheet+'!'+info.range);return fixture(info);}});
  assert.equal(out.datasets_checked,19);
  assert.equal(out.passed,19);
  assert.equal(out.failed,0);
  assert.deepEqual(calls.sort(),pairsFromGas());
  assert.equal(out.status,'PRIVATE_RANGE_SCHEMAS_PASS');
  assert.equal(out.schema_checks_complete,true);
  assert.equal(out.consumer_acceptance,'PENDING');
  assert.equal(out.cutover_ready,false);
  assert.doesNotMatch(JSON.stringify(out),/PRIVATE_CUSTOMER_VALUE|fixture-core-only|reader_fixture_key/);
});

test('range manifest is immutable, unique, and exactly matches current GAS allowlist',()=>{
  const {RANGE_SPECS}=require('../server/core-private-range-contract.js');
  assert.equal(RANGE_SPECS.length,19);
  assert.equal(new Set(RANGE_SPECS.map(s=>s.dataset)).size,19);
  assert.equal(new Set(RANGE_SPECS.map(s=>s.sheet+'!'+s.range)).size,19);
  assert.deepEqual(RANGE_SPECS.map(s=>s.sheet+'!'+s.range).sort(),pairsFromGas());
  assert.ok(Object.isFrozen(RANGE_SPECS));
  for(const s of RANGE_SPECS){assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.consumers));assert.ok(s.consumers.length>0);}
});

test('all existing Admin dataset specs retain exact identity, range and header in the shared contract',()=>{
  const Admin=require('../server/admin-sheet-fallback.js');
  const {RANGE_SPECS}=require('../server/core-private-range-contract.js');
  for(const [dataset,s] of Object.entries(Admin.SPECS)){
    const match=RANGE_SPECS.find(r=>r.dataset===dataset);
    assert.ok(match,dataset);
    assert.deepEqual([match.sheet,match.range,match.header],[s.sheet,s.range,s.header]);
  }
});

test('all19 Core reader calls cross the existing Apps Script request/response and GAS allowlist using isolated fixtures',async()=>{
  const Core=require('../server/core-sheet-private-reader.js');
  const Script=require('../server/core-sheet-apps-script-reader.js');
  const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  const allow=source.match(/const KK_PRIVATE_CORE_READ_ALLOWLIST = Object\.freeze\([\s\S]*?\n\}\);/);
  const fn=source.match(/function kkApiPrivateCoreRead_\(payload\)\{[\s\S]*?\n\}/);
  let selection,reads=0;
  const gas=Function('PropertiesService','SpreadsheetApp',allow[0]+'\n'+fn[0]+'\nreturn kkApiPrivateCoreRead_;')(
    {getScriptProperties:()=>({getProperty:()=> '1'})},
    {getActive:()=>({getId:()=>env.GOOGLE_SHEET_ID,getSheetByName:sheet=>({
      getLastRow:()=>6,getRange:()=>({getDisplayValues:()=>{reads++;return fixture(selection);}})
    })})});
  const original=Script.readValues;
  const calls=[];
  Script.readValues=info=>original({...info,fetchImpl:async (url,options)=>{
    assert.equal(options.method,'POST');
    const input=JSON.parse(options.body);selection=input;
    calls.push(input.sheet+'!'+input.range);
    assert.equal(input.action,'privateCoreRead');
    assert.equal(input.readKey,env.KK_CORE_PRIVATE_READ_KEY);
    return {ok:true,status:200,url, json:async()=>({ok:true,...gas(input)})};
  }});
  try{
    for(const pair of pairsFromGas()){
      const [sheet,range]=pair.split('!');
      const values=await Core.readValues({sheetId:env.GOOGLE_SHEET_ID,sheet,range,env});
      assert.deepEqual(values,fixture({sheet,range}));
    }
    assert.equal(reads,19);
    assert.deepEqual(calls.sort(),pairsFromGas());
  }finally{Script.readValues=original;}
});

test('header-only and blank-body private responses are schema evidence only',async()=>{
  for(const blank of [false,true]){
    const out=await Preflight.probe({env,reader:async info=>{const rows=fixture(info,false);return blank?[...rows,['','']]:rows;}});
    assert.equal(out.ok,true);
    assert.equal(out.passed,19);
    assert.equal(out.cutover_ready,false);
    assert.equal(out.consumer_acceptance,'PENDING');
    assert.ok(out.results.every(x=>x.classification==='PRIVATE_RANGE_SCHEMA_EMPTY'));
  }
});

test('malformed response envelopes/cells and data-only rows failclosed before cutover',async()=>{
  for(const bad of [null,{},[],[null],[['event_id'],[{phone:'PRIVATE'}]],[['event_id'],[123]],
    [['wrong_heading'],['event_id']],[['event_id'],new Array(27).fill('PRIVATE')],new Array(4001).fill(['event_id'])]){
    const out=await Preflight.probe({env,reader:async info=>info.sheet==='01_Events'&&info.range==='A4:Z'?bad:fixture(info)});
    assert.equal(out.ok,false);
    assert.equal(out.schema_checks_complete,false);
    assert.equal(out.cutover_ready,false);
    assert.equal(out.failed,1);
    assert.equal(out.results.find(x=>x.dataset==='events_analytics').classification,'PRIVATE_SCHEMA_INVALID');
    assert.doesNotMatch(JSON.stringify(out),/wrong_heading|phone|"PRIVATE"/);
  }
});

test('public variants require ordered projection schema, not one matching header among private columns',async()=>{
  for(const pair of ['08_Web_Ready!A4:K','08_Web_Ready!A4:J500','09_Web_Packages!A4:N','09_Web_Packages!A4:M','09_Web_Packages!A4:L']){
    const out=await Preflight.probe({env,reader:async info=>{
      if(info.sheet+'!'+info.range!==pair)return fixture(info);
      return [[info.sheet==='08_Web_Ready'?'event_id':'package_id','customer_phone'],['PRIVATE_CUSTOMER_VALUE']];
    }});
    assert.equal(out.failed,1,pair);
    assert.equal(out.ok,false,pair);
    assert.doesNotMatch(JSON.stringify(out),/customer_phone|PRIVATE_CUSTOMER_VALUE/);
  }
});

test('one failed variant blocks complete schema coverage without hiding or retrying any failure',async()=>{
  const pairs=pairsFromGas();
  for(const denied of pairs){
    const calls=[];
    const out=await Preflight.probe({env,reader:async info=>{
      const pair=info.sheet+'!'+info.range;calls.push(pair);
      if(pair===denied)throw Object.assign(Error('PRIVATE_CONTACT_AND_KEY'),{code:'CORE_APPS_SCRIPT_UNAVAILABLE;readKey=PRIVATE'});
      return fixture(info);
    }});
    assert.equal(out.datasets_checked,19,denied);
    assert.equal(out.passed,18,denied);
    assert.equal(out.failed,1,denied);
    assert.equal(out.status,'PRIVATE_READS_BLOCKED',denied);
    assert.equal(out.cutover_ready,false,denied);
    assert.deepEqual(calls.sort(),pairs,denied);
    assert.equal(out.results.filter(x=>!x.ok)[0].classification,'CORE_PRIVATE_PROBE_FAILED');
    assert.doesNotMatch(JSON.stringify(out),/PRIVATE_CONTACT_AND_KEY|readKey=PRIVATE/);
  }
});

test('config-only and missing config never grant schema/consumer/ACL acceptance',async()=>{
  const config=Preflight.plan(env);
  assert.equal(config.ok,true);
  assert.equal(config.expected_ranges,19);
  assert.equal(config.schema_checks_complete,false);
  assert.equal(config.cutover_ready,false);
  assert.equal(config.consumer_acceptance,'PENDING');
  let calls=0;
  const out=await Preflight.probe({env:{...env,KK_CORE_PRIVATE_READ_KEY:''},reader:async()=>{calls++;throw Error('MUST_NOT_CALL');}});
  assert.equal(calls,0);
  assert.equal(out.datasets_checked,0);
  assert.equal(out.cutover_ready,false);
});
