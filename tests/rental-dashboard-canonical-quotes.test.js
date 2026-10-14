'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Quote=require('../server/rental-dashboard-canonical-quotes.js');
const Core=require('../server/rental-dashboard-core.js')._test;
const Legacy=require('../server/legacy/kk-rental-dashboard-v5.js')._test;
const HEADER='Row,booking_id,created_at,booking_status,event_id,event_name,event_date,customer_key,customer_name,customer_phone,channel,package_type,model_group,payment_status,amount_received,return_status,file_transfer_status,drive_link,phone_asset_id,lens_asset_id,pickup_time,return_time,note,package_price';
function mkMaster(id,event,price){
  const row=Array(24).fill('');
  row[0]='5';row[1]=id;row[4]=event;row[23]=String(price);
  return row.join(',');
}
const master=[HEADER,
  mkMaster('BK-A','E1',890),
  mkMaster('BK-B','E2',1090),
  mkMaster('BK-X','E9',590),
  mkMaster('BK-X','E8',990)
].join('\n');
const helper=['Source,Booking ID,Created At,Booking Status,Event ID,Event Name,Event Date,Customer Key,Customer Name,Phone,Channel,Package Type,Payment Status,Amount Received,Event Month',
'MASTER,BK-A,2026-10-01,confirmed,E1,Example,2026-10-18,C1,Alpha,0811111111,LINE,phone_only,unpaid,0,2026-10',
'MASTER,BK-B,2026-10-01,picked_up,E2,Example,2026-10-19,C2,Beta,0822222222,LINE,phone_lens,paid,300,2026-10',
'MASTER,BK-C,2026-10-01,completed,E3,Example,2026-10-18,C5,Epsilon,0855555555,LINE,phone_only,paid,690,2026-10',
'ARCHIVE,BK-C,2026-10-01,completed,E3,Example,2026-10-18,C5,Epsilon,0855555555,LINE,phone_only,paid,690,2026-10',
'MASTER,BK-D,2026-10-01,cancelled,E4,Example,2026-10-18,C6,Zeta,0866666666,LINE,phone_only,paid,590,2026-10',
'MASTER,BK-E,2026-10-01,no_show,E5,Example,2026-10-18,C7,Eta,0877777777,LINE,phone_only,paid,590,2026-10',
'MASTER,BK-F,2026-10-01,,E6,Example,2026-10-18,C8,Theta,0888888888,LINE,phone_only,paid,590,2026-10'].join('\n');
test('canonical map uses A4/X header only, and rejects data-row headers',()=>{
  const q=Quote.bookingQuoteMap(master);
  assert.equal(q.byComposite['BK-A\u001fE1'],890);
  assert.equal(q.byComposite['BK-B\u001fE2'],1090);
  assert.equal(q.byId['BK-X'],undefined,'colliding Booking IDs cannot fall back across events');
  assert.equal(Quote.attachQuotes([{booking_id:'BK-A',event_id:'WRONG'}],q)[0].package_price,0,'known ID may not transfer quote across different events');
  assert.throws(()=>Quote.bookingQuoteMap('bad_header\nBK-A,booking_id'),e=>e.code==='CORE_QUOTE_HEADER_INVALID');
  assert.equal(Object.keys(Quote.bookingQuoteMap('').byId).length,0);
});
test('both dashboards forecast canonical private package prices, not deposit receipts',()=>{
  const map=Quote.bookingQuoteMap(master);
  for(const m of [Core,Legacy]){
    const rows=Quote.attachQuotes(m.parseHelper(helper,{},[]),map);
    const metrics=m.aggregate(rows).metrics;
    assert.equal(metrics.completed_bookings,1);
    assert.equal(metrics.active_bookings,2);
    assert.equal(metrics.actual_revenue,690);
    assert.equal(metrics.future_revenue,1980);
    assert.equal(metrics.forecast_revenue,2670);
  }
});
test('no opt-in performs zero Master requests; missing Core private identity blocks',async()=>{
  let calls=0;
  const reader=async()=>{calls++;throw Error('should not run');};
  assert.equal((await Quote.readPrivateMaster('core-id',{},reader)).status,'NOT_ENABLED');
  assert.equal(calls,0);
  await assert.rejects(()=>Quote.readPrivateMaster('core-id',{[Quote.FLAG]:'1',GOOGLE_SHEET_ID:'core-id'},reader),e=>e.code==='CORE_QUOTE_PRIVATE_NOT_CONFIGURED');
  assert.equal(calls,0);
});
test('privacy gate never accepts a different Core Sheet ID',async()=>{
  await assert.rejects(()=>Quote.readPrivateMaster('incorrect',{[Quote.FLAG]:'1',GOOGLE_SHEET_ID:'core-id'},async()=>master),e=>e.code==='CORE_QUOTE_PRIVATE_NOT_CONFIGURED');
});
test('unknown cancelled no-show statuses do not inflate revenue',()=>{
  const map=Quote.bookingQuoteMap(master);
  const rows=Quote.attachQuotes(Core.parseHelper(helper,{},[]),map);
  assert.equal(Core.aggregate(rows).metrics.reportable_bookings,3); // two active + one completed; duplicate Archive excluded
  assert.doesNotMatch(JSON.stringify(Core.aggregate(rows)),/Alpha|0811111111|Beta|0822222222/);
});
