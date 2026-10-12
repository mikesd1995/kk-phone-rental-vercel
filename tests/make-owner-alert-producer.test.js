'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/make-owner-alert-producer.js');

const REF='zehlsagzrpromtfqqflt';
const env={
  KK_MAKE_OWNER_PRODUCER_ENABLED:'true',KK_MAKE_OWNER_TRANSPORT_ENABLED:'true',
  KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:REF,
  SUPABASE_URL:'https://'+REF+'.supabase.co',
  SUPABASE_SECRET_KEY:'sb_secret_test_server_only',
  KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'x'.repeat(64),
  KK_MAKE_OWNER_WEBHOOK_URL:'https://hook.us2.make.com/abcdef0123456789'
};
const identity='EVT-20261012-TEST';
const canonical={
  source:P.VERIFIED_SOURCE,status:'VERIFIED',
  event_type:'OWNER_ALERT',entity_id:identity,
  content_version:'a'.repeat(64),text:'Verified event notice; no Booking or price write'
};
const opts=(other={})=>({
  env,now:new Date('2026-10-12T10:20:00.000Z'),
  canonicalReadbackFn:async()=>({...canonical}),
  insertFn:async()=>({ok:true,inserted:true}),
  sendFn:async()=>({ok:true}),
  ...other
});
test('producer disabled by default and project-bound',()=>{
  assert.equal(P.config({}).ready,false);
  assert.equal(P.config({...env,KK_MAKE_OWNER_PRODUCER_ENABLED:'false'}).ready,false);
  assert.equal(P.config({...env,KK_MAKE_OWNER_TRANSPORT_ENABLED:'false'}).ready,false);
  assert.equal(P.config({...env,KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:'other'}).ready,false);
  assert.equal(P.config({...env,KK_MAKE_OWNER_WEBHOOK_URL:'https://evil.example/xx'}).ready,false);
  assert.equal(P.config({...env,KK_MAKE_OWNER_WEBHOOK_URL:'http://hook.us2.make.com/abc'}).ready,false);
  assert.equal(P.config(env).ready,true);
});
test('disabled producer never reads or writes canonical/outbox/Make',async()=>{
  let calls=0;
  const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
    env:{...env,KK_MAKE_OWNER_PRODUCER_ENABLED:'false'},
    canonicalReadbackFn:async()=>{calls++;return {...canonical};},
    insertFn:async()=>{calls++;},sendFn:async()=>{calls++;}
  }));
  assert.equal(result.ok,false);
  assert.equal(result.provider_sends,0);
  assert.equal(calls,0);
});
test('unverified and stale or wrong canonical identity cannot produce events',async()=>{
  for(const readback of [
    {...canonical,status:'PENDING'},
    {...canonical,source:'OWNER_CALLER'},
    {...canonical,entity_id:'EVT-OTHER'},
    {...canonical,event_type:'BOOKING_CONFIRM'},
    {...canonical,content_version:'not-sha256'},
    {...canonical,text:''},
    {...canonical,text:'x'.repeat(2100)}
  ]){
    let writes=0;
    const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
      canonicalReadbackFn:async()=>readback,
      insertFn:async()=>{writes++},sendFn:async()=>{writes++}
    }));
    assert.equal(result.ok,false,JSON.stringify(readback).slice(0,140));
    assert.equal(writes,0);
  }
});
test('same verified entity, revision and text yield deterministic idempotency identity',()=>{
  const a=P.makeIdentity(canonical),b=P.makeIdentity({...canonical});
  assert.equal(a.ok,true);
  assert.equal(a.notification_id,b.notification_id);
  assert.equal(a.request_id,b.request_id);
  assert.match(a.content_version,/^[a-f]{64}$/);
  assert.notEqual(P.makeIdentity({...canonical,text:'Changed verified message'}).request_id,a.request_id);
  assert.notEqual(P.makeIdentity({...canonical,content_version:'b'.repeat(64)}).request_id,a.request_id);
});
test('strict order readback -> durable insert -> signed Make handoff (no Telegram direct send)',async()=>{
  const seq=[];
  let inserted,envelope;
  const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
    canonicalReadbackFn:async()=>{seq.push('readback');return {...canonical};},
    insertFn:async row=>{seq.push('insert');inserted=row;return {ok:true,inserted:true};},
    sendFn:async body=>{seq.push('handoff');envelope=body.envelope;return {ok:true};}
  }));
  assert.equal(result.ok,true);
  assert.deepEqual(seq,['readback','insert','handoff']);
  assert.equal(inserted.status,'QUEUED');
  assert.equal(inserted.content_version,canonical.content_version);
  assert.equal(envelope.notification_id,inserted.notification_id);
  assert.equal(envelope.signature.length,64);
  assert.equal(result.provider_sends,0);
  assert.equal(result.status,'PENDING_PROVIDER_ACK');
});
test('duplicate outbox insert must never make second webhook request',async()=>{
  let sends=0;
  const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
    insertFn:async()=>({ok:true,inserted:false}),
    sendFn:async()=>{sends++;return {ok:true};}
  }));
  assert.equal(result.ok,false);
  assert.equal(result.duplicate,true);
  assert.equal(sends,0);
});
test('outbox insert error or unverified receipt fail closed',async()=>{
  for(const insertFn of [
    async()=>{throw new Error('DB down')},
    async()=>({ok:false,inserted:false}),
    async()=>({ok:true,inserted:false})
  ]){
    let sends=0;
    const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
      insertFn,sendFn:async()=>{sends++;return {ok:true};}
    }));
    assert.equal(result.ok,false);
    assert.equal(sends,0);
  }
});
test('unknown transport outcome leaves reserved/queued state for manual review, not retry',async()=>{
  const result=await P.notifyVerifiedOwner({entity_id:identity},opts({
    sendFn:async()=>{throw new Error('timeout after request accepted');}
  }));
  assert.equal(result.queued,true);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'MAKE_TRANSPORT_UNCONFIRMED_REQUIRES_REVIEW');
});
test('outbox API uses service-secret apikey only, verifies exact insert returned',async()=>{
  let init;
  const row={notification_id:'kn_test',request_id:'kr_test',content_version:'a'.repeat(64),
    text_sha256:'b'.repeat(64),status:'QUEUED'};
  const config=P.config(env);
  const success=await P.insertOutbox(row,config,async(_url,options)=>{
    init=options;
    return {ok:true,json:async()=>[{...row}]};
  });
  assert.equal(success.inserted,true);
  assert.equal(init.headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(Object.hasOwn(init.headers,'Authorization'),false);
  const dup=await P.insertOutbox(row,config,async()=>({ok:true,json:async()=>[]}));
  assert.equal(dup.inserted,false);
  await assert.rejects(()=>P.insertOutbox(row,config,async()=>({ok:true,json:async()=>[{...row,content_version:'x'}]})),/readback mismatch/);
});
