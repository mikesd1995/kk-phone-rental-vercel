'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const privateSheets=require('../api/lib/private-google-sheets');
const healthHandler=require('../api/kk-intelligence-health');
const analytics=require('../api/kk-rental-dashboard-v5');

function fakeRes(){
  let body='';
  const headers={};
  return {
    statusCode:200,
    headers,
    setHeader(k,v){headers[String(k).toLowerCase()]=v;},
    end(v){body=String(v||'');},
    get body(){return body;},
    json(){return JSON.parse(body||'{}');}
  };
}

function withEnv(patch,fn){
  const before={};
  for(const k of Object.keys(patch)){before[k]=process.env[k];const v=patch[k];if(v===undefined)delete process.env[k];else process.env[k]=v;}
  return Promise.resolve().then(fn).finally(()=>{for(const k of Object.keys(patch)){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}});
}

test('private reader requires sheet id plus service-account credentials',()=>{
  const noCreds=privateSheets.configState({KK_CRM_SHEET_ID:'sheet-1'});
  assert.equal(noCreds.configured,false);
  const ready=privateSheets.configState({KK_CRM_SHEET_ID:'sheet-1',GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.test',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----'});
  assert.equal(ready.configured,true);
  assert.equal(ready.authMode,'service_account');
});

test('service-account JSON is parsed without exposing secret material',()=>{
  const creds=privateSheets.credentialsFromEnv({GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'reader@example.test',private_key:'line1\\nline2'})});
  assert.equal(creds.email,'reader@example.test');
  assert.equal(creds.privateKey,'line1\nline2');
  assert.equal(privateSheets.configState({KK_CRM_SHEET_ID:'crm',GOOGLE_SERVICE_ACCOUNT_JSON:'not-json'}).configured,false);
});

test('valuesToCsv preserves commas, quotes and newlines safely',()=>{
  const csv=privateSheets.valuesToCsv([['a','b,c','d"e'],['line\nbreak','',7]]);
  assert.equal(csv,'a,"b,c","d""e"\n"line\nbreak",,7');
});

test('JWT assertion uses RS256 and contains readonly Sheets scope',()=>{
  const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const pem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const jwt=privateSheets.createAssertion({email:'reader@example.test',privateKey:pem},1700000000);
  const parts=jwt.split('.');
  assert.equal(parts.length,3);
  const payload=JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));
  assert.equal(payload.iss,'reader@example.test');
  assert.match(payload.scope,/spreadsheets\.readonly/);
  assert.equal(payload.aud,'https://oauth2.googleapis.com/token');
});

test('intelligence health stays safe and explicit when private reader is not configured',async()=>{
  await withEnv({KK_ADMIN_PIN:'1234',KK_CRM_SHEET_ID:'crm-test',GOOGLE_SERVICE_ACCOUNT_EMAIL:undefined,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined,GOOGLE_SERVICE_ACCOUNT_JSON:undefined},async()=>{
    const req={method:'POST',headers:{'x-admin-pin':'1234'}};
    const res=fakeRes();
    await healthHandler(req,res);
    const out=res.json();
    assert.equal(res.statusCode,200);
    assert.equal(out.ok,true);
    assert.equal(out.data.status,'PENDING_SECURE_READER');
    assert.equal(out.data.core_status,'ACTIVE_SOT');
    assert.equal(out.data.crm_status,'SHADOW_PRIVATE');
    assert.equal(out.data.runtime_cutover,false);
    assert.equal(JSON.stringify(out).includes('PRIVATE KEY'),false);
  });
});

test('analytics aggregate remains PII-free while preserving operational metrics',()=>{
  const rows=[
    {source:'MASTER',booking_id:'B1',created_at:'',status:'completed',event_id:'E1',event_name:'Event 1',event_date:'2026-09-01',month:'2026-09',customer_key:'phone:111',package_type:'phone_only',payment_status:'paid',amount_received:590,affiliation:'GMMTV',affiliation_source:'explicit'},
    {source:'MASTER',booking_id:'B2',created_at:'',status:'confirmed',event_id:'E2',event_name:'Event 2',event_date:'2026-09-02',month:'2026-09',customer_key:'phone:111',package_type:'bundle',payment_status:'paid',amount_received:690,affiliation:'GMMTV',affiliation_source:'explicit'}
  ];
  const out=analytics._test.aggregate(rows);
  assert.equal(out.metrics.unique_customers,1);
  assert.equal(out.metrics.non_cancelled_bookings,2);
  assert.equal(out.metrics.repeat_customers,1);
  assert.equal(out.metrics.amount_received,1280);
  const raw=JSON.stringify(out);
  assert.equal(raw.includes('phone:111'),false);
  assert.equal(raw.includes('customer_name'),false);
});
