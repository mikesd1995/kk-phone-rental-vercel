'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const O=require('../server/ai-observability-contract');

function base(){
  return {
    provider:'LANGFUSE',
    trace_id:'trace-20260921-001',
    span_id:'span-001',
    role:'SCANNER',
    kind:'END',
    name:'discovery.normalize',
    observed_at:'2026-09-21T02:30:00+07:00',
    attributes:{
      run_id:'SCN-20260921-0200',
      component:'discovery',
      operation:'normalize',
      status:'PASS',
      latency_ms:24,
      model:'none'
    }
  };
}

test('observability event is advisory and zero-write by construction',()=>{
  const event=O.buildTraceEvent(base());
  assert.equal(event.authoritative,false);
  assert.equal(event.verifier_required,true);
  assert.equal(event.production_writes,0);
  assert.equal(event.final_truth_mutation,false);
  assert.equal(event.notification_sends,0);
});

test('disabled observability never calls sender',async()=>{
  let calls=0;
  const result=await O.emitTrace(base(),{enabled:false,sender:async()=>{ calls++; }});
  assert.equal(calls,0);
  assert.equal(result.sent,false);
  assert.equal(result.reason,'DISABLED');
});

test('enabled observability requires explicit sender',async()=>{
  await assert.rejects(
    O.emitTrace(base(),{enabled:true}),
    err=>err.code==='OBSERVABILITY_SENDER_REQUIRED'
  );
});

test('enabled observability may call explicit sink without changing authority',async()=>{
  let received=null;
  const result=await O.emitTrace(base(),{
    enabled:true,
    sender:async event=>{ received=event; return {accepted:true}; }
  });
  assert.equal(result.sent,true);
  assert.equal(received.authoritative,false);
  assert.equal(received.production_writes,0);
});

test('PII/raw prompt style attributes are rejected, not silently exported',()=>{
  const input=base();
  input.attributes.customer_phone='0812345678';
  assert.throws(()=>O.buildTraceEvent(input),err=>err.code==='OBSERVABILITY_SENSITIVE_FIELD');
});

test('business authority/write attributes are rejected',()=>{
  const input=base();
  input.attributes.production_writes=1;
  assert.throws(()=>O.buildTraceEvent(input),err=>err.code==='OBSERVABILITY_AUTHORITY_FIELD');
});

test('unknown attributes are dropped from telemetry envelope',()=>{
  const input=base();
  input.attributes.random_payload='do not export me';
  const event=O.buildTraceEvent(input);
  assert.equal(Object.hasOwn(event.attributes,'random_payload'),false);
});
