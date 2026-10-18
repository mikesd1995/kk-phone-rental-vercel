'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const privateSheets=require('../api/lib/private-google-sheets');
const healthHandler=require('../api/kk-intelligence-health');
const analytics=require('../server/legacy/kk-rental-dashboard-v5');

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



test('private reader resolves GOOGLE_SHEET_ID and KK_CRM_SHEET_ID only when they agree',()=>{
  const publicOnly=privateSheets.resolveSheetId({GOOGLE_SHEET_ID:'sheet-a'});
  assert.equal(publicOnly.ok,true);
  assert.equal(publicOnly.sheetId,'sheet-a');
  const privateOnly=privateSheets.resolveSheetId({KK_CRM_SHEET_ID:'sheet-a'});
  assert.equal(privateOnly.ok,true);
  assert.equal(privateOnly.sheetId,'sheet-a');
  const same=privateSheets.resolveSheetId({GOOGLE_SHEET_ID:'sheet-a',KK_CRM_SHEET_ID:'sheet-a'});
  assert.equal(same.ok,true);
  assert.equal(same.sheetId,'sheet-a');
  const drift=privateSheets.resolveSheetId({GOOGLE_SHEET_ID:'sheet-a',KK_CRM_SHEET_ID:'sheet-b'});
  assert.equal(drift.ok,false);
  assert.equal(drift.sheetId,'');
  assert.equal(drift.classification,'CRM_SHEET_ID_CONFLICT');
});

test('private reader config fails closed on Sheet ID drift even with valid credential shape',()=>{
  const state=privateSheets.configState({
    GOOGLE_SHEET_ID:'sheet-public',
    KK_CRM_SHEET_ID:'sheet-private',
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.test',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----'
  });
  assert.equal(state.configured,false);
  assert.equal(state.sheetId,'');
  assert.equal(state.sheetIdState,'CRM_SHEET_ID_CONFLICT');
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
    {source:'MASTER',booking_id:'B2',created_at:'',status:'confirmed',event_id:'E2',event_name:'Event 2',event_date:'2026-09-02',month:'2026-09',customer_key:'phone:111',package_type:'bundle',payment_status:'unpaid',amount_received:0,package_price:690,affiliation:'GMMTV',affiliation_source:'explicit'}
  ];
  const out=analytics._test.aggregate(rows);
  assert.equal(out.metrics.unique_customers,1);
  assert.equal(out.metrics.non_cancelled_bookings,2);
  assert.equal(out.metrics.repeat_customers,1);
  assert.equal(out.metrics.actual_revenue,590);
  assert.equal(out.metrics.future_revenue,690);
  assert.equal(out.metrics.forecast_revenue,1280);
  assert.equal(out.metrics.amount_received,1280);
  const raw=JSON.stringify(out);
  assert.equal(raw.includes('phone:111'),false);
  assert.equal(raw.includes('customer_name'),false);
});


test('analytics revenue split counts completed as actual and active bookings as future exactly once',()=>{
  const rows=[
    {source:'MASTER',booking_id:'B10',created_at:'',status:'completed',event_id:'E10',event_name:'Closed event',event_date:'2026-08-01',month:'2026-08',customer_key:'phone:a',package_type:'bundle',payment_status:'paid',amount_received:1090,affiliation:'GMMTV',affiliation_source:'explicit'},
    {source:'MASTER',booking_id:'B11',created_at:'',status:'confirmed',event_id:'E11',event_name:'Future event',event_date:'2026-10-01',month:'2026-10',customer_key:'phone:b',package_type:'bundle',payment_status:'pending',amount_received:0,package_price:1290,affiliation:'GMMTV',affiliation_source:'explicit'},
    {source:'MASTER',booking_id:'B12',created_at:'',status:'returned',event_id:'E12',event_name:'Returned not closed',event_date:'2026-09-20',month:'2026-09',customer_key:'phone:c',package_type:'phone_only',payment_status:'paid',amount_received:890,package_price:890,affiliation:'Domundi / Mandee',affiliation_source:'explicit'},
    {source:'MASTER',booking_id:'B13',created_at:'',status:'cancelled',event_id:'E13',event_name:'Cancelled event',event_date:'2026-10-02',month:'2026-10',customer_key:'phone:d',package_type:'bundle',payment_status:'pending',amount_received:1590,affiliation:'SM Entertainment',affiliation_source:'explicit'},
    {source:'MASTER',booking_id:'B14',created_at:'',status:'no_show',event_id:'E14',event_name:'No show event',event_date:'2026-09-10',month:'2026-09',customer_key:'phone:e',package_type:'bundle',payment_status:'pending',amount_received:990,affiliation:'GMMTV',affiliation_source:'explicit'}
  ];
  const out=analytics._test.aggregate(rows);
  assert.equal(out.metrics.actual_revenue,1090);
  assert.equal(out.metrics.future_revenue,2180);
  assert.equal(out.metrics.forecast_revenue,3270);
  assert.equal(out.metrics.amount_received,3270);
  assert.equal(out.metrics.completed_bookings,1);
  assert.equal(out.metrics.active_bookings,2);
  assert.equal(out.metrics.reportable_bookings,3);
  assert.equal(out.metrics.non_cancelled_bookings,3);
  assert.equal(out.top_events.find(x=>x.event_name==='Cancelled event'),undefined);
  assert.equal(out.top_events.find(x=>x.event_name==='No show event'),undefined);
  assert.equal(out.package_mix.reduce((sum,x)=>sum+x.bookings,0),3);
});


test('analytics dedupes the same booking across current and archive source projections',()=>{
  const base={booking_id:'BK-SAME',created_at:'2026-09-01T10:00:00Z',status:'completed',event_id:'E-SAME',event_name:'Same event',event_date:'2026-09-01',month:'2026-09',customer_key:'phone:111',package_type:'phone_only',payment_status:'paid',amount_received:590,affiliation:'GMMTV',affiliation_source:'explicit'};
  const out=analytics._test.aggregate([
    Object.assign({source:'MASTER'},base),
    Object.assign({source:'ARCHIVE'},base)
  ]);
  assert.equal(out.metrics.reportable_bookings,1);
  assert.equal(out.metrics.actual_revenue,590);
});

test('analytics keeps historical booking-id collisions when event/customer identity differs',()=>{
  const out=analytics._test.aggregate([
    {source:'ARCHIVE',booking_id:'BK-LEGACY-001',created_at:'2026-06-01',status:'completed',event_id:'E-A',event_name:'A',event_date:'2026-06-06',month:'2026-06',customer_key:'phone:111',package_type:'phone_only',payment_status:'paid',amount_received:590,affiliation:'Unknown',affiliation_source:'unknown'},
    {source:'ARCHIVE',booking_id:'BK-LEGACY-001',created_at:'2026-06-02',status:'completed',event_id:'E-B',event_name:'B',event_date:'2026-06-06',month:'2026-06',customer_key:'phone:222',package_type:'phone_only',payment_status:'paid',amount_received:690,affiliation:'Unknown',affiliation_source:'unknown'}
  ]);
  assert.equal(out.metrics.reportable_bookings,2);
  assert.equal(out.metrics.actual_revenue,1280);
});

test('live event metadata overrides stale archive metadata after a restored event',()=>{
  const current='event_id,event_name,event_date,venue,event_note\nEVT-X,Live Name,2026-10-01,Live Venue,affiliation: LIVE';
  const archive='archived_at,source_row,event_id,event_name,event_date,venue,poster,status,active,event_note\n2026-09-27,10,EVT-X,Old Name,2026-10-01,Old Venue,,open,TRUE,affiliation: OLD';
  const meta=analytics._test.eventMetadata(current,archive,[]);
  assert.equal(meta['EVT-X'].event_name,'Live Name');
  assert.equal(meta['EVT-X'].affiliation,'LIVE');
  assert.equal(meta['EVT-X'].affiliation_source,'explicit');
});
