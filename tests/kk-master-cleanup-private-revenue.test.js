'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Quote=require('../server/rental-dashboard-canonical-quotes.js');
const Booked=require('../server/rental-analytics-booked-quote.js');
const Private=require('../server/core-sheet-private-reader.js');
const Core=require('../server/rental-dashboard-core.js')._test;
const Legacy=require('../server/legacy/kk-rental-dashboard-v5.js')._test;
const header='Row,booking_id,created_at,booking_status,event_id,event_name,event_date,customer_key,customer_name,customer_phone,channel,package_type,model_group,payment_status,amount_received,return_status,file_transfer_status,drive_link,phone_asset_id,lens_asset_id,pickup_time,return_time,note,package_price';
function row(id,event,status,pkg,price){const a=Array(24).fill('');a[0]='5';a[1]=id;a[3]=status;a[4]=event;a[11]=pkg;a[23]=String(price);return a.join(',');}
const master=[header,row('B1','EV1','confirmed','phone_only',890),row('B2','EV2','picked_up','phone_lens',1090)].join('\n');
const helper=[
 'Source,Booking ID,Created At,Booking Status,Event ID,Event Name,Event Date,Customer Key,Customer Name,Phone,Channel,Package Type,Payment Status,Amount Received,Event Month',
 'MASTER,B1,2026-10-01,confirmed,EV1,Event A,2026-11-01,C1,Customer One,0811111111,LINE,phone_only,unpaid,0,2026-11',
 'MASTER,B2,2026-10-01,picked_up,EV2,Event B,2026-11-02,C2,Customer Two,0822222222,LINE,phone_lens,partial,300,2026-11',
 'MASTER,B3,2026-10-01,completed,EV3,Event C,2026-11-03,C3,Customer Three,0833333333,LINE,phone_only,paid,690,2026-11',
 'ARCHIVE,B3,2026-10-01,completed,EV3,Event C,2026-11-03,C3,Customer Three,0833333333,LINE,phone_only,paid,690,2026-11',
 'MASTER,B4,2026-10-01,cancelled,EV4,Event D,2026-11-04,C4,Customer Four,0844444444,LINE,phone_only,paid,590,2026-11'
].join('\n');
const env={
 KK_CORE_CANONICAL_QUOTE_PRIVATE_ENABLED:'1',
 KK_CORE_SHEET_REQUIRE_PRIVATE:'1', KK_CORE_PRIVATE_TRANSPORT:'apps-script',
 GOOGLE_SHEET_ID:'synthetic-core',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TESTREADER_123/exec',
 KK_ADMIN_API_KEY:'a'.repeat(48), KK_CORE_PRIVATE_READ_KEY:'r'.repeat(48)
};
test('private Master read disabled by default; independent Apps Script read-key required',async()=>{
 let reads=0;const reader=async req=>{reads++;assert.deepEqual([req.sheet,req.range,req.sheetId],['00_Master_Booking','A4:X','synthetic-core']);return master;};
 assert.equal((await Quote.readPrivateMaster('synthetic-core',{},reader)).status,'NOT_ENABLED');
 assert.equal((await Quote.readPrivateMaster('synthetic-core',env,reader)).status,'PRIVATE_VERIFIED');
 assert.equal(reads,1);
 for(const bad of [
  {...env,KK_CORE_PRIVATE_TRANSPORT:'service-account'},
  {...env,KK_CORE_PRIVATE_READ_KEY:env.KK_ADMIN_API_KEY},
  {...env,KK_CORE_SHEET_REQUIRE_PRIVATE:'0'},
  {...env,GOOGLE_SHEET_ID:'another-sheet'},
  {...env,KK_ADMIN_SCRIPT_URL:'https://evil.example/macros/s/a/exec'}])
   await assert.rejects(()=>Quote.readPrivateMaster('synthetic-core',bad,reader),e=>e.code==='CORE_QUOTE_PRIVATE_NOT_CONFIGURED');
 assert.equal(reads,1);
});
test('private Master fails closed on unreadable, empty and invalid data',async()=>{
 for(const fixture of ['', 'bad_header\nB1,EV1']){
  await assert.rejects(()=>Quote.readPrivateMaster('synthetic-core',env,async()=>fixture),e=>e.code==='CORE_QUOTE_PRIVATE_READ_FAILED');
 }
 await assert.rejects(()=>Quote.readPrivateMaster('synthetic-core',env,async()=>{throw Error('sensitive upstream message');}),e=>e.code==='CORE_QUOTE_PRIVATE_READ_FAILED');
});
test('Core and legacy calculate completed Actual, exact package-X Future and Forecast',()=>{
 for(const m of [Core,Legacy]){
  const booked=Booked.bookedPriceRows(m.parseHelper(helper,{},[]),master,Quote.parseCsv);
  const metrics=m.aggregate(booked,{strictQuotes:true}).metrics;
  assert.equal(metrics.actual_revenue,690);
  assert.equal(metrics.future_revenue,1980);
  assert.equal(metrics.forecast_revenue,2670);
  assert.equal(metrics.completed_bookings,1);
  assert.equal(metrics.active_bookings,2);
  assert.doesNotMatch(JSON.stringify(metrics),/Customer One|0811111111/);
 }
});
test('strict Master X: exact identity, duplicate and missing quotes fail closed',()=>{
 const seed={booking_id:'B1',event_id:'EV1',status:'confirmed',package_type:'phone_only'};
 for(const bad of [
  {...seed,booking_id:'UNKNOWN'},{...seed,event_id:'WRONG'},
  {...seed,status:'pending'},{...seed,package_type:'phone_lens'},
  {...seed,package_type:''}
 ])assert.throws(()=>Booked.bookedPriceRows([bad],master,Quote.parseCsv),e=>e.code==='MISSING_QUOTE');
 assert.throws(()=>Booked.bookedPriceRows([seed],master+'\n'+row('B1','EV1','confirmed','phone_only',890),Quote.parseCsv),e=>e.code==='DUPLICATE_QUOTE');
 assert.throws(()=>Booked.bookedPriceRows([seed],[header,row('B1','EV1','confirmed','phone_only',0)].join('\n'),Quote.parseCsv),e=>e.code==='MISSING_QUOTE');
});
test('named Core and Legacy adapters require private opt-in and strict quote schema',async()=>{
 for(const mod of [Core,Legacy]){
  const index=mod.buildStrictBookingQuoteMap(master);
  assert.equal(Booked.bookedPriceRows([{booking_id:'B1',event_id:'EV1',status:'confirmed',package_type:'phone_only',amount_received:0}],index)[0].package_price,890);
  assert.equal((await mod.fetchAppsScriptPrivateQuotes('synthetic-core',{})).status,'NOT_ENABLED');
 }
 assert.equal((await Quote.fetchAppsScriptPrivateQuotes('synthetic-core',{})).status,'NOT_ENABLED');
 assert.throws(()=>Booked.buildStrictBookingQuoteMap(header.replace('package_price','other_price')+'\n'+row('B1','EV1','confirmed','phone_only',890),Quote.parseCsv),
   e=>e.code==='RENTAL_MASTER_QUOTE_SCHEMA_INVALID');
});
test('strict mode cannot fall back to amount_received when quote invalid',()=>{
 for(const m of [Core,Legacy])
  assert.throws(()=>m.aggregate([{status:'confirmed',amount_received:300,package_price:0}],{strictQuotes:true}),e=>e.code==='RENTAL_ACTIVE_QUOTE_UNVERIFIED');
});
test('strict Core reads use the protected transport for both dashboards without GViz',async()=>{
 const prev=Private.readCsv;let calls=[];
 Private.readCsv=async x=>{calls.push(x);return 'synthetic-private-csv';};
 try{
  for(const m of [Core,Legacy])assert.equal(await m.coreCsv('synthetic-core','01_Events','A4:Z',env),'synthetic-private-csv');
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.sheet==='01_Events'&&x.range==='A4:Z'));
 }finally{Private.readCsv=prev;}
});
