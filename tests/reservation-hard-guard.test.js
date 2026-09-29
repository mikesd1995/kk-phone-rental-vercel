const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('stream');
const R=require('../admin/reservation-guard.js');
const Guard=require('../api/kk-admin-guard.js');
const AdminSheetFallback=require('../server/admin-sheet-fallback.js');

const assets=[
  {asset_id:'PHONE-001',asset_type:'phone',status:'available',rentable_setting:true},
  {asset_id:'LENS-001',asset_type:'lens',status:'available',rentable_setting:true}
];
const booking=(id,date,pickup,status='confirmed',extra={})=>Object.assign({booking_id:id,row_number:10,event_id:'E-'+date,event_date:date,booking_status:status,package_type:'phone_only',phone_asset_id:'PHONE-001',lens_asset_id:'',pickup_time:pickup,return_time:''},extra);

test('reservation window treats an earlier return time as cross-midnight',()=>{
  const w=R.reservationWindow(booking('B1','2026-09-19','22:00','confirmed',{return_time:'01:00'}));
  assert.equal(w.mode,'explicit');
  assert.equal(w.end_ms-w.start_ms,3*60*60*1000);
});

test('missing return time uses conservative next-day 06:00 window',()=>{
  const w=R.reservationWindow(booking('B1','2026-09-19','20:00'));
  assert.equal(w.mode,'fallback-next-day-06:00');
  assert.equal(w.end_at,'2026-09-19T23:00:00.000Z');
});

test('fallback window blocks a 02:00 next-day asset collision',()=>{
  const existing=booking('B1','2026-09-19','20:00');
  const proposed=booking('NEW','2026-09-20','02:00','confirmed',{row_number:0});
  const r=R.preflight({assets,bookings:[existing]},proposed);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.code==='PHONE_CAPACITY_EXCEEDED'));
  assert.ok(r.errors.some(x=>x.code==='ASSET_WINDOW_COLLISION'));
});

test('fallback window releases capacity after 06:00 next day',()=>{
  const existing=booking('B1','2026-09-19','20:00');
  const proposed=booking('NEW','2026-09-20','08:00','confirmed',{row_number:0});
  const r=R.preflight({assets,bookings:[existing]},proposed);
  assert.equal(r.ok,true);
  assert.equal(r.overlapping_booking_ids.length,0);
});

test('picked_up without return evidence remains open-ended',()=>{
  const existing=booking('B1','2026-09-19','20:00','picked_up');
  const proposed=booking('NEW','2026-09-22','12:00','confirmed',{row_number:0});
  const r=R.preflight({assets,bookings:[existing]},proposed);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.code==='ASSET_WINDOW_COLLISION'));
});

function snapshot(){
  const b=booking('B1','2026-09-19','20:00');
  return {
    events:[{event_id:'E-2026-09-19',event_date:'2026-09-19'},{event_id:'E-2026-09-20',event_date:'2026-09-20'}],
    packages:[{template_id:'TPL-PHONE',package_type:'phone_only'}],
    web_packages:[{package_id:'E-2026-09-20-TPL-PHONE',event_id:'E-2026-09-20',package_type:'phone_only'}],
    assets:[assets[0]],bookings:[b],current_bookings:[b],web_ready:[],
    health:[
      {check:'Source count — Events',status:'2'},
      {check:'Source count — Bookings',status:'1'},
      {check:'Source count — Assets',status:'1'}
    ],
    spreadsheet_id:'test-sheet',admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'
  };
}

function req(body){
  const r=Readable.from([JSON.stringify(body)]); r.method='POST'; r.url='/api/kk-admin'; r.headers={'x-admin-pin':'1234'}; return r;
}
function res(){
  return {statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(v){this.body=String(v||'');}};
}
function response(obj){ return {ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(obj)}; }

function withEnv(t){
  const old={...process.env};
  process.env.KK_ADMIN_PIN='1234'; process.env.KK_ADMIN_API_KEY='key'; process.env.KK_ADMIN_SCRIPT_URL='https://script.google.com/macros/s/test/exec'; process.env.GOOGLE_SHEET_ID='test-sheet';
  t.after(()=>{ process.env=old; });
}
function withDirectSnapshot(t,value=snapshot()){
  const old=AdminSheetFallback.buildSnapshot;
  AdminSheetFallback.buildSnapshot=async()=>value;
  t.after(()=>{AdminSheetFallback.buildSnapshot=old;});
}

test('createBooking without pickup_time is allowed into conservative reservation preflight',async t=>{
  withEnv(t); withDirectSnapshot(t); const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{calls++; return response({ok:true,row_number:99,admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'});};
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',phone_asset_id:'PHONE-001'}),out);
  // Existing prior-day booking is reserved through 06:00, while unknown pickup starts
  // at 00:00. The request is accepted as TBD timing but safely collision-blocked.
  assert.equal(out.statusCode,409);
  assert.equal(JSON.parse(out.body).error_code,'BOOKING_COLLISION');
  assert.equal(out.headers['X-KK-Booking-Timing-Policy'],'booking-timing-return-time-persisted-staged-3');
  assert.equal(out.headers['X-KK-Booking-Pickup-Mode'],'fallback-day-start');
  assert.equal(calls,0);
});

test('timing validator treats blank pickup as optional TBD state',()=>{
  assert.deepEqual(
    Guard._test.validateCreateBookingTiming({action:'createBooking',pickup_time:''}),
    {
      ok:true,
      pickup_time:'',
      return_time:'',
      mode:'fallback-day-start',
      note:'pickup_time is optional/TBD; reservation starts at 00:00 on event day'
    }
  );
});

test('server wrapper rejects invalid createBooking pickup_time before any upstream call',async t=>{
  withEnv(t); withDirectSnapshot(t); const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{calls++; throw new Error('should not fetch');};
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',pickup_time:'25:99',phone_asset_id:'PHONE-001'}),out);
  assert.equal(out.statusCode,422);
  assert.equal(JSON.parse(out.body).error_code,'BOOKING_PICKUP_TIME_INVALID');
  assert.equal(calls,0);
});

test('server wrapper rejects invalid booking return_time before any upstream call',async t=>{
  withEnv(t); withDirectSnapshot(t); const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{calls++; throw new Error('should not fetch');};
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',pickup_time:'18:00',return_time:'25:99',phone_asset_id:'PHONE-001'}),out);
  assert.equal(out.statusCode,422);
  assert.equal(JSON.parse(out.body).error_code,'BOOKING_RETURN_TIME_INVALID');
  assert.equal(calls,0);
});

test('server wrapper blocks a conflicting createBooking before legacy write',async t=>{
  withEnv(t); withDirectSnapshot(t); const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{calls++; return response({ok:true,row_number:99,admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'});};
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',pickup_time:'02:00',phone_asset_id:'PHONE-001'}),out);
  assert.equal(out.statusCode,409);
  assert.equal(JSON.parse(out.body).error_code,'BOOKING_COLLISION');
  assert.equal(calls,0);
});

test('server wrapper delegates a non-conflicting createBooking after preflight',async t=>{
  withEnv(t); withDirectSnapshot(t); const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{
    calls++;
    return response({ok:true,row_number:99,phone_asset_id:'PHONE-001',admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'});
  };
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',pickup_time:'08:00',phone_asset_id:'PHONE-001'}),out);
  assert.equal(out.statusCode,200);
  assert.equal(out.headers['X-KK-Booking-Guard'],'PASS');
  assert.equal(out.headers['X-KK-Booking-Timing-Policy'],'booking-timing-return-time-persisted-staged-3');
  assert.equal(JSON.parse(out.body).ok,true);
  assert.equal(calls,1);
});


test('booking collision preflight remains available when Apps Script configuration is missing',async t=>{
  withEnv(t); withDirectSnapshot(t);
  delete process.env.KK_ADMIN_SCRIPT_URL;
  delete process.env.KK_ADMIN_API_KEY;
  const oldFetch=global.fetch; let calls=0;
  global.fetch=async()=>{calls++; throw new Error('legacy writer must not be reached for blocked collision');};
  t.after(()=>{global.fetch=oldFetch;});
  const out=res();
  await Guard(req({action:'createBooking',event_id:'E-2026-09-20',template_id:'TPL-PHONE',booking_status:'confirmed',customer_name:'X',pickup_time:'02:00',phone_asset_id:'PHONE-001'}),out);
  assert.equal(out.statusCode,409);
  assert.equal(JSON.parse(out.body).error_code,'BOOKING_COLLISION');
  assert.equal(out.headers['X-KK-Booking-Preflight'],'DIRECT_SHEET');
  assert.equal(calls,0);
});
