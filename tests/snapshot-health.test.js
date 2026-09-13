const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {Readable} = require('node:stream');
const H = require('../admin/snapshot-health.js');
const good = () => ({
  events:[{event_id:'e',event_date:'2026-09-13',status:'open',active_on_web:false}],
  bookings:[{booking_id:'b',event_date:'2026-09-13',booking_status:'confirmed'}],
  current_bookings:[{booking_id:'b',booking_status:'confirmed'}],
  assets:[{asset_id:'p'}], spreadsheet_id:'test-sheet',admin_api_version:H.BACKEND
});

test('reject malformed, partial, null and unexpected zero snapshots',()=>{
  for(const d of [null,{}, {...good(),assets:{}}, {...good(),events:[null]}]) assert.equal(H.assess(d).ok,false);
  assert.equal(H.assess({...good(),bookings:[],current_bookings:[]},good()).ok,false);
  assert.equal(H.assess({...good(),events:[]}).ok,false);
  assert.equal(H.assess(good()).ok,true);
});
test('empty system is explicitly uncertain; legitimately closed work may be zero',()=>{
  const empty={events:[],bookings:[],current_bookings:[],assets:[]};
  assert.equal(H.assess(empty).warnings.length,1);
  const d=good();d.bookings[0].booking_status='completed';d.current_bookings=[];
  assert.equal(H.assess(d,good()).ok,true);
  assert.equal(H.currentBookings(d).length,0);
});
test('derive all open bookings despite a nonempty but incomplete current_bookings',()=>{
  const d=good();
  d.bookings.push({booking_id:'b2',event_date:'2026-09-12',booking_status:' Returned '});
  d.bookings.push({booking_id:'b3',event_date:'2026-09-13',booking_status:'cancelled'});
  assert.equal(H.assess(d).warnings.length,1);
  assert.equal(H.currentBookings(d).length,2);
  assert.equal(H.todayBookings(d,'2026-09-13').length,1);
});
test('Bangkok day rolls over while UTC is still the previous day',()=>{
  assert.equal(H.bangkokDay(new Date('2026-09-12T17:01:00Z')),'2026-09-13');
});

function browser(){
  let source=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
  source=source.slice(0,source.lastIndexOf('  applyDensityMode();'))+
    'globalThis.hooks={state,refresh,api,sortedOpenEvents,startOfToday,getStatus:()=>snapshotState}; render=()=>{}; loadRentalAnalytics=()=>{}; showNotice=()=>{};})();';
  const elements=new Map();
  const context={KKSnapshotHealth:H,sessionStorage:{getItem:()=>''},document:{querySelector:sel=>{
    if(!elements.has(sel)) elements.set(sel,{textContent:'',style:{},classList:{add(){},remove(){}}});
    return elements.get(sel);
  }},console,setTimeout,clearTimeout,fetch:async()=>({ok:true,status:200,json:async()=>({ok:true,data:good()})})};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,h:context.hooks,elements};
}
test('UI preserves last good data on transport failure and guards writes; recovers on refresh',async()=>{
  const {context,h,elements}=browser();
  await h.refresh();
  const first=h.state.data;
  context.fetch=async()=>{throw new Error('Network unavailable');};
  await assert.rejects(h.refresh(),/Network unavailable/);
  assert.equal(h.state.data,first);
  assert.equal(h.getStatus().stale,true);
  assert.match(elements.get('#snapshotStatus').textContent,/Last Known Good/);
  await assert.rejects(h.api('updateBooking'),/Refresh/);
  context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:good()})});
  await h.refresh();assert.equal(h.getStatus().stale,false);
});
test('UI rejects zero without losing prior data; auth rejection clears data',async()=>{
  const {context,h}=browser();await h.refresh();const first=h.state.data;
  context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:{events:[],bookings:[],assets:[],current_bookings:[]}})});
  await assert.rejects(h.refresh(),/Snapshot rejected/);assert.equal(h.state.data,first);
  context.fetch=async()=>({ok:false,status:401,json:async()=>({ok:false,error:'Invalid PIN'})});
  await assert.rejects(h.refresh(),/Invalid PIN/);assert.equal(h.state.data,null);
});
test('Overview includes open unpublished future events, excludes closed and past',()=>{
  const {h}=browser();
  const rows=h.sortedOpenEvents([
    {event_date:'2099-01-01',status:' Open ',active_on_web:false},
    {event_date:'2099-01-01',status:'closed'},
    {event_date:'2000-01-01',status:'open'}
  ]);
  assert.equal(rows.length,1);
});

function proxy(fetchImpl){
  const context={module:{exports:{}},require:()=>H,process:{env:{KK_ADMIN_PIN:'test',KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',KK_ADMIN_API_KEY:'test',GOOGLE_SHEET_ID:'test-sheet'}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:fetchImpl};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../api/kk-admin.js'),'utf8'),context);
  return async(action,pin='test')=>{
    const req=Readable.from([JSON.stringify({action})]);req.method='POST';req.headers={'x-admin-pin':pin};
    let body;const res={setHeader(){},end(v){body=JSON.parse(v);}};
    await context.module.exports(req,res);return {status:res.statusCode,body};
  };
}
const response=d=>({ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(d)});
test('proxy authenticates health, sends read-only snapshot, returns counts and versions',async()=>{
  let called=0;
  const request=proxy(async(url,options)=>{called++;assert.equal(JSON.parse(options.body).action,'snapshot');return response({ok:true,data:good()});});
  assert.equal((await request('snapshotHealth','wrong')).status,401);assert.equal(called,0);
  const r=await request('snapshotHealth');
  assert.equal(r.body.data.counts.bookings,1);
  assert.equal(r.body.data.backend_version,H.BACKEND);
  assert.ok(r.body.data.latency_ms>=0);
});
test('proxy rejects bad snapshot and sheet mismatch; health reports failure as readable diagnostics',async()=>{
  for(const d of [{}, {...good(),spreadsheet_id:'wrong-sheet'}]){
    const request=proxy(async()=>response({ok:true,data:d}));
    assert.equal((await request('snapshot')).status,502);
    const r=await request('snapshotHealth');assert.equal(r.body.ok,true);assert.equal(r.body.data.ok,false);
  }
});
test('proxy reports timeout and measures through body consumption',async()=>{
  const fail=proxy(async()=>{const e=new Error('timeout');e.name='AbortError';throw e;});
  assert.equal((await fail('snapshot')).body.error_code,'UPSTREAM_TIMEOUT');
  const request=proxy(async()=>({ok:true,status:200,headers:{get:()=>''},text:async()=>{await new Promise(r=>setTimeout(r,25));return JSON.stringify({ok:true,data:good()});}}));
  assert.ok((await request('snapshotHealth')).body.data.latency_ms>=20);
});
