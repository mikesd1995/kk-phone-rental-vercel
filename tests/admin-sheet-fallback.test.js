'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../server/admin-sheet-fallback.js');

test('CSV parser preserves quoted commas and escaped quotes',()=>{
  const rows=F.parseCsv('"a","b"\n"1","hello, ""world"""\n');
  assert.deepEqual(rows,[['a','b'],['1','hello, "world"']]);
});

test('rowsAsObjects locates a header below title rows',()=>{
  const rows=F.rowsAsObjects('"title"\n\n"id","name"\n"1","A"\n','id');
  assert.equal(rows.length,1); assert.equal(rows[0].id,'1'); assert.equal(rows[0].name,'A'); assert.equal(rows[0].__row_number,4);
});


test('fallback GViz ranges start at each real schema header row',()=>{
  assert.equal(F.SPECS.events.range,'A4:I');
  assert.equal(F.SPECS.bookings.range,'A4:X');
  assert.equal(F.SPECS.assets.range,'A4:G');
  assert.equal(F.SPECS.packages.range,'A4:J');
  assert.equal(F.SPECS.overrides.range,'A4:G');
  assert.equal(F.SPECS.web_ready.range,'A4:K');
  assert.equal(F.SPECS.web_packages.range,'A4:N');
  assert.equal(F.SPECS.customers.range,'A1:H');
  assert.equal(F.SPECS.health.range,'A4:D');
  assert.equal(F.SPECS.model_master.range,'A4:E');
  assert.equal(F.SPECS.visibility_locks.range,'A1:N');
});

test('production-style title rows demonstrate why A1 GViz inference is unsafe',()=>{
  const inferred='"01_Events — Lean Event Master event_id","event_name"\n"EV1","Test"\n';
  assert.throws(()=>F.rowsAsObjects(inferred,'event_id'),/header not found/i);
  const aligned='"event_id","event_name"\n"EV1","Test"\n';
  const rows=F.rowsAsObjects(aligned,'event_id');
  assert.equal(rows[0].event_id,'EV1');
});

test('buildFromRaw creates required arrays and forces degraded read-only mode',()=>{
  const raw={
    events:[{event_id:'EV1',event_name:'Test',event_date:'19/09/2026',venue:'X',event_status:'open',active_on_web:'TRUE'}],
    bookings:[{__row_number:5,booking_id:'BK1',booking_status:'confirmed',event_id:'EV1',customer_name:'A',package_type:'phone_only',phone_asset_id:'P1',pickup_time:'12:00',payment_status:'paid',amount_received:'690'}],
    assets:[{asset_id:'P1',asset_type:'phone',model_group:'VIVO_X300_PRO',status:'available',rentable_now:'TRUE'}],
    packages:[{template_id:'TPL1',model_group:'VIVO_X300_PRO',package_type:'phone_only',standard_price:'690',display_name:'Vivo X300 Pro',active:'TRUE'}],
    overrides:[],web_ready:[],web_packages:[],customers:[],health:[],
    visibility_locks:[{__row_number:2,lock_id:'LOCK|EV1',event_id:'EV1',event_name:'Test',event_date:'19/09/2026',venue:'X',lock_state:'LOCKED',explicit_reopen_required:'TRUE'}],
    model_master:[{model_group:'VIVO_X300_PRO',model_display:'Vivo X300 Pro',asset_type:'phone',active:'TRUE'}]
  };
  const s=F.buildFromRaw(raw,'sheet-1',Date.now());
  assert.equal(s.degraded_read_only,true);
  assert.equal(s.write_actions_enabled,false);
  assert.equal(s.events.length,1);
  assert.equal(s.bookings.length,1);
  assert.equal(s.current_bookings.length,1);
  assert.equal(s.assets.length,1);
  assert.equal(s.bookings[0].phone_model_display,'Vivo X300 Pro');
  assert.equal(s.spreadsheet_id,'sheet-1');
  assert.equal(s.visibility_locks.length,1);
  assert.equal(s.visibility_locks[0].lock_state,'LOCKED');
  assert.equal(s.visibility_locks[0].explicit_reopen_required,true);
});

test('buildSnapshot rejects HTML or missing schema through mocked GViz reads',async()=>{
  const fetchImpl=async(url)=>({ok:true,status:200,text:async()=>url.includes('01_Events')?'<html>login</html>':'"x"\n'});
  await assert.rejects(()=>F.buildSnapshot({sheetId:'sheet',fetchImpl}),/returned HTML|schema header/i);
});


test('range-aligned row numbers preserve physical Sheet coordinates',()=>{
  const rows=F.rowsAsObjects('\"booking_id\",\"event_id\"\n\"BK1\",\"EV1\"\n\"BK2\",\"EV2\"\n','booking_id',4);
  assert.equal(rows[0].__row_number,5);
  assert.equal(rows[1].__row_number,6);
});


test('coalesces concurrent direct-Sheet fallback reads and briefly reuses the snapshot',async()=>{
  F.clearSnapshotCache();
  let calls=0;
  const fetchImpl=async(url)=>{
    calls++;
    await new Promise(resolve=>setTimeout(resolve,5));
    const u=new URL(String(url));
    const sheet=u.searchParams.get('sheet');
    const spec=Object.values(F.SPECS).find(x=>x.sheet===sheet);
    assert.ok(spec,'unexpected fallback sheet '+sheet);
    return {ok:true,status:200,text:async()=>JSON.stringify(spec.header)+'\n'};
  };
  const opts={sheetId:'sheet-cache-test',env:{},fetchImpl,cacheTtlMs:2000};
  const [a,b]=await Promise.all([F.buildSnapshot(opts),F.buildSnapshot(opts)]);
  assert.equal(calls,Object.keys(F.SPECS).length);
  assert.deepEqual(new Set([a.fallback_cache_status,b.fallback_cache_status]),new Set(['miss','coalesced']));
  const third=await F.buildSnapshot(opts);
  assert.equal(third.fallback_cache_status,'hit');
  assert.equal(calls,Object.keys(F.SPECS).length);
  assert.equal(third.degraded_read_only,true);
  assert.equal(third.write_actions_enabled,false);
  F.clearSnapshotCache();
});


test('fallback operational ranges do not reintroduce fixed row ceilings',()=>{
  for(const key of ['events','bookings','assets','packages','overrides','web_ready','web_packages','customers','health','model_master','visibility_locks']){
    assert.doesNotMatch(F.SPECS[key].range,/\\d{3,}$/,'fixed row ceiling in '+key);
  }
});
