'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../scripts/admin-gviz-live-header-probe.cjs');
const F=require('../server/admin-sheet-fallback.js');

test('zero-row live probe pins the source range and explicit one-row header for all datasets',async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    const u=new URL(String(url));
    const spec=Object.values(F.SPECS).find(s=>s.sheet===u.searchParams.get('sheet'));
    assert.ok(spec);
    assert.equal(u.hostname,'docs.google.com');
    assert.equal(u.searchParams.get('tqx'),'out:csv');
    assert.equal(u.searchParams.get('headers'),'1');
    assert.equal(u.searchParams.get('tq'),'select A limit 0');
    assert.equal(u.searchParams.get('range'),spec.range);
    assert.equal(opts.redirect,'error');
    calls.push(spec.sheet);
    return {ok:true,text:async()=>'"'+spec.header+'"\n'};
  };
  const out=await P.probe({sheetId:'safe-fixture',fetchImpl});
  assert.equal(out.ok,true);
  assert.equal(calls.length,Object.keys(F.SPECS).length);
  assert.deepEqual(out.datasets.map(x=>x.code),Array(calls.length).fill('OK'));
});

test('live header probe refuses data-bearing CSV and never returns row contents',async()=>{
  const privateRow='PRIVATE_PHONE_AND_BOOKING_CUSTOMER';
  const out=await P.probe({sheetId:'safe-fixture',keys:['bookings'],fetchImpl:async()=>
    ({ok:true,text:async()=>'"booking_id"\n"'+privateRow+'"\n'})});
  assert.equal(out.ok,false);
  assert.equal(out.datasets[0].code,'ZERO_ROW_CONTRACT_FAILED');
  assert.doesNotMatch(JSON.stringify(out),new RegExp(privateRow));
});

test('live header probe reports bounded schema mismatches and failed fetches without payload',async()=>{
  const mismatch=await P.probe({sheetId:'safe-fixture',keys:['bookings'],fetchImpl:async()=>
    ({ok:true,text:async()=>'"wrong-column"\n'})});
  assert.equal(mismatch.ok,false);
  assert.equal(mismatch.datasets[0].code,'HEADER_MISMATCH');
  const failed=await P.probe({sheetId:'safe-fixture',keys:['bookings'],fetchImpl:async()=>{throw Error('secret API credential');}});
  assert.equal(failed.datasets[0].code,'FETCH_FAILED');
  assert.doesNotMatch(JSON.stringify(failed),/secret/);
});
