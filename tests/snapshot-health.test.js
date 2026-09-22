const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {Readable} = require('node:stream');
const H = require('../admin/snapshot-health.js');
const U = require('../server/upstream-response.js');
const good = () => ({
  events:[{event_id:'e',event_date:'2026-09-13',status:'open',active_on_web:false}],
  bookings:[{booking_id:'b',event_date:'2026-09-13',booking_status:'confirmed',pickup_time:'12:00',return_time:'18:00'}],
  current_bookings:[{booking_id:'b',booking_status:'confirmed'}],
  assets:[{asset_id:'p'}], spreadsheet_id:'test-sheet',admin_api_version:H.BACKEND
});
const bulk = (n=10) => ({
  events:Array.from({length:n},(_,i)=>({event_id:'e'+i,event_date:'2026-10-01',status:'open'})),
  bookings:Array.from({length:n},(_,i)=>({booking_id:'b'+i,event_date:'2026-10-01',booking_status:'confirmed',pickup_time:'12:00',return_time:'18:00'})),
  current_bookings:Array.from({length:n},(_,i)=>({booking_id:'b'+i,event_date:'2026-10-01',booking_status:'confirmed'})),
  assets:Array.from({length:n},(_,i)=>({asset_id:'a'+i})),
  spreadsheet_id:'test-sheet',admin_api_version:H.BACKEND
});
const withSourceCounts = (data, counts) => Object.assign({}, data, {
  health:[
    {check:'Source count — Events',status:counts.events,detail:'INFO'},
    {check:'Source count — Bookings',status:counts.bookings,detail:'INFO'},
    {check:'Source count — Assets',status:counts.assets,detail:'INFO'}
  ]
});

test('reject malformed, partial, null and unexpected zero snapshots',()=>{
  for(const d of [null,{}, {...good(),assets:{}}, {...good(),events:[null]}]) assert.equal(H.assess(d).ok,false);
  assert.equal(H.assess({...good(),bookings:[],current_bookings:[]},good()).ok,false);
  assert.equal(H.assess({...good(),events:[]}).ok,false);
  assert.equal(H.assess(good()).ok,true);
});
test('reject missing and duplicate stable IDs',()=>{
  const missing=good();missing.events=[{event_id:''}];
  assert.equal(H.assess(missing).ok,false);
  assert.match(H.assess(missing).issues.join(' '),/missing event_id/);
  const duplicate=good();duplicate.bookings=[
    {booking_id:'dup',booking_status:'confirmed'},
    {booking_id:'dup',booking_status:'confirmed'}
  ];
  duplicate.current_bookings=[{booking_id:'dup',booking_status:'confirmed'}];
  assert.equal(H.assess(duplicate).ok,false);
  assert.match(H.assess(duplicate).issues.join(' '),/duplicate booking_id dup/);
});
test('reject correlated partial snapshot collapse and warn on isolated sharp drop',()=>{
  const previous=bulk(10);
  const partial=bulk(3);
  const h=H.assess(partial,previous);
  assert.equal(h.ok,false);
  assert.match(h.issues.join(' '),/correlated snapshot count collapse/);
  const isolated=bulk(10);
  isolated.events=isolated.events.slice(0,3);
  const isolatedHealth=H.assess(isolated,previous);
  assert.equal(isolatedHealth.ok,true);
  assert.match(isolatedHealth.warnings.join(' '),/events: count dropped sharply 10→3/);
});
test('independent Health Check counts protect first load without previous browser state',()=>{
  const source={events:20,bookings:12,assets:5};
  const partial=withSourceCounts(bulk(3),source);
  partial.assets=partial.assets.slice(0,1);
  const h=H.assess(partial);
  assert.equal(h.ok,false);
  assert.deepEqual(h.source_counts,source);
  assert.match(h.issues.join(' '),/first-load\/source count mismatch/);
});
test('healthy independent counts pass and medium mismatch warns instead of hard fail',()=>{
  const healthy=withSourceCounts(bulk(10),{events:10,bookings:10,assets:10});
  const hh=H.assess(healthy);
  assert.equal(hh.ok,true);
  assert.deepEqual(hh.source_counts,{events:10,bookings:10,assets:10});
  const warn=withSourceCounts(bulk(6),{events:10,bookings:6,assets:6});
  const hw=H.assess(warn);
  assert.equal(hw.ok,true);
  assert.match(hw.warnings.join(' '),/events: snapshot count lower than independent source 6\/10/);
});
test('partial Health Check count surface warns but does not fail a valid snapshot',()=>{
  const d=bulk(10);
  d.health=[{check:'Source count — Events',status:10,detail:'INFO'}];
  const h=H.assess(d);
  assert.equal(h.ok,true);
  assert.match(h.warnings.join(' '),/independent source-count incomplete/);
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
  d.bookings.push({booking_id:'b2',event_date:'2026-09-12',booking_status:' Returned ',pickup_time:'12:00',return_time:'18:00'});
  d.bookings.push({booking_id:'b3',event_date:'2026-09-13',booking_status:'cancelled'});
  assert.equal(H.assess(d).warnings.length,1);
  assert.equal(H.currentBookings(d).length,2);
  assert.equal(H.todayBookings(d,'2026-09-13').length,1);
});
test('warn when current_bookings contains an unknown booking id',()=>{
  const d=good();
  d.current_bookings.push({booking_id:'ghost',booking_status:'confirmed'});
  const h=H.assess(d);
  assert.equal(h.ok,true);
  assert.match(h.warnings.join(' '),/not present in bookings/);
});
test('Bangkok day rolls over while UTC is still the previous day',()=>{
  assert.equal(H.bangkokDay(new Date('2026-09-12T17:01:00Z')),'2026-09-13');
});

function browser(){
  let source=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
  source=source.slice(0,source.lastIndexOf('  applyDensityMode();'))+
    'globalThis.hooks={state,refresh,api,runSystemGuard,sortedOpenEvents,startOfToday,buildActionRows,actionMatchesFilter,reportInsightRows,getStatus:()=>snapshotState}; render=()=>{}; renderSystemGuard=()=>{}; loadRentalAnalytics=()=>{}; showNotice=()=>{};})();';
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
test('UI preserves prior data when a correlated partial snapshot is rejected',async()=>{
  const {context,h}=browser();
  const initial=bulk(10);
  context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:initial})});
  await h.refresh();const first=h.state.data;
  context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:bulk(3)})});
  await assert.rejects(h.refresh(),/correlated snapshot count collapse/);
  assert.equal(h.state.data,first);
  assert.equal(h.getStatus().stale,true);
});
test('UI rejects first-load partial snapshot when Health Check counts disagree',async()=>{
  const {context,h}=browser();
  const partial=withSourceCounts(bulk(3),{events:20,bookings:12,assets:5});
  partial.assets=partial.assets.slice(0,1);
  context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:partial})});
  await assert.rejects(h.refresh(),/first-load\/source count mismatch/);
  assert.equal(h.state.data,null);
  assert.equal(h.getStatus().stale,true);
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
test('TBD pickup stays informational and does not become a risk/data error',()=>{
  const {h}=browser();
  const d=new Date(); d.setDate(d.getDate()+1);
  const eventDate=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const booking={
    row_number:7, booking_id:'BK-TBD', event_id:'EV-TBD', event_name:'TBD Event', event_date:eventDate,
    booking_status:'confirmed', payment_status:'paid', pickup_time:'', customer_name:'A', customer_phone:'0800000000',
    package_type:'phone_only', phone_asset_id:'PHONE-001'
  };
  const actionRows=h.buildActionRows({bookings:[booking],events:[]});
  assert.equal(actionRows.some(r=>r.type==='data' && /เวลารับ/.test(r.task||'')),false);
  const prep=actionRows.find(r=>r.type==='prep');
  assert.ok(prep);
  assert.match(prep.task,/TBD/);
  assert.equal(h.actionMatchesFilter(prep,'risk'),false);

  const insights=h.reportInsightRows({events:[],packages:[],assets:[],customers:[],repeatCustomers:0,utilizationRate:0,assetsAvailable:0,utilizedAssets:0},{bookings:[booking]});
  const info=insights.find(x=>/TBD/.test(x.title||''));
  assert.ok(info);
  assert.equal(info.level,'info');
  assert.match(info.detail,/เว้นว่างได้ตาม policy/);
});
test('System Guard reports one upstream root failure and marks dependent snapshot checks as warnings',async()=>{
  const {context,h}=browser();
  context.fetch=async(_url,options)=>{
    const action=JSON.parse(options.body).action;
    if(action==='systemHealth'){
      return {
        ok:true,status:200,
        json:async()=>({ok:false,data:{rows:[{key:'apps_script_json',label:'Apps Script JSON Response',status:'FAIL',detail:'Apps Script returned a Google sign-in/auth page instead of JSON. [GOOGLE_AUTH_HTML; HTTP 200]'}]}})
      };
    }
    if(action==='snapshotHealth'){
      return {
        ok:false,status:502,
        json:async()=>({ok:false,error:'Apps Script returned a Google sign-in/auth page instead of JSON.',error_code:'SNAPSHOT_UPSTREAM_NON_JSON',upstream_failure_class:'GOOGLE_AUTH_HTML',upstream_status:200})
      };
    }
    throw new Error('unexpected action '+action);
  };
  await h.runSystemGuard();
  const rows=h.state.systemHealth.rows;
  assert.equal(rows.filter(r=>r.status==='FAIL').length,1);
  for(const key of H.KEYS){
    const row=rows.find(r=>r.label==='Snapshot · '+key);
    assert.equal(row.status,'WARN');
    assert.match(row.detail,/Blocked by upstream root cause/);
  }
  assert.equal(rows.find(r=>r.label==='Snapshot validation').status,'WARN');
  assert.equal(rows.find(r=>r.label==='Snapshot latency').status,'WARN');
});

function proxy(fetchImpl){
  const directPhase1Stub={
    SUPPORTED_ACTIONS:[],
    VERSION:'test-direct-phase1-disabled',
    routingState:()=>({ready:false,writer_ready:false,configured_actions:[]}),
    tryExecute:async()=>({handled:false,reason:'ACTION_NOT_ROUTED'})
  };
  const context={module:{exports:{}},require:(id)=>{
    const key=String(id);
    if(key.includes('admin-direct-writer-phase1')) return directPhase1Stub;
    if(key.includes('upstream-response')) return U;
    return H;
  },process:{env:{KK_ADMIN_PIN:'test',KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',KK_ADMIN_API_KEY:'test',GOOGLE_SHEET_ID:'test-sheet'}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:fetchImpl};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../server/admin-proxy.js'),'utf8'),context);
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
