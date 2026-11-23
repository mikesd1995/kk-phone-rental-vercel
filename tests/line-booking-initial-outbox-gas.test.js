'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {harness,payload,claim,source,sha,VERSION,OWNER,CUSTOMER,SECRET,BID,RID,KIND,REPLY,HEADERS,context,RAW,HASH}=require('./fixtures/line-initial-outbox-harness');
function sent(h,kind=KIND){const p=claim(kind);assert.equal(h.claim(p).claimed,true);return h.settle({...p,delivery_state:'SENT',provider_message_id:'synthetic-message-'+kind,provider_request_id:'synthetic-request-'+kind});}

test('canonical initial producer persists two intents before Booking; replay returns same READY envelope',()=>{
 const h=harness();
 // A controlled crash at the first Booking flush proves both intents precede it.
 h.crashAt(3);assert.throws(()=>h.create(),/SYNTHETIC_CRASH/);
 assert.equal(h.bookings.rows[4][0],BID);
 assert.deepEqual(h.ledger.rows.slice(1).map(r=>r[3]),['INTENT','INTENT']);
 h.crashAt(0);const result=h.create();
 assert.equal(result.idempotent_replay,true,'old server is fenced from blind initial sends');
 assert.equal(result.initial_outbox.mode,VERSION);
 assert.equal(result.initial_outbox.context_json,RAW);
 assert.equal(result.initial_outbox.context_hash,HASH);
 assert.equal(result.initial_outbox.owner_target,OWNER);
 assert.deepEqual(Array.from(result.initial_outbox.deliveries,d=>d.state),['READY','READY']);
 assert.equal(h.create().initial_outbox.deliveries.length,2);
 assert.equal(h.stats().allocations,1);assert.equal(h.ledger.rows.length,3);
});

test('readiness and initial producer require exact schema, enabled private dispatcher and owner target before writes',()=>{
 for(const options of [{enabled:false},{noLedger:true},{header:['wrong']},{properties:{KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'distinct-admin-key'}},{properties:{KK_LINE_INITIAL_OUTBOX_OWNER_TARGET:'UOWNER'}},{properties:{KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'distinct_owner_dispatch_secret_20261114'}}]){
  const h=harness(options);
  assert.throws(()=>h.ready());assert.equal(h.stats().writes,0);
  if(options.enabled!==false){assert.throws(()=>h.create());assert.equal(h.bookings.rows.length,4);assert.equal(h.stats().writes,0);}
 }
 const h=harness();assert.equal(h.ready().initial_outbox_mode,VERSION);assert.equal(h.ready().columns,14);assert.equal(h.ready().owner_target,OWNER);
 assert.throws(()=>h.create({...payload(),initial_dispatch_key:'wrong'}));assert.equal(h.stats().writes,0);
});

test('malformed context hash, extra fields, owner mismatch or canonical customer mismatch never create Booking or intents',()=>{
 for(const modify of [p=>{p.initial_notification.context_hash='f'.repeat(64);},p=>{p.initial_notification.owner_target='C'+'b'.repeat(32);},p=>{p.initial_notification.context_json=JSON.stringify({...context,extra:'untrusted'});p.initial_notification.context_hash=sha(p.initial_notification.context_json);},p=>{p.customer_name='different';},p=>{p.customer_contact='UOWNER';},p=>{p.initial_notification.context_json=JSON.stringify({...context,phone:'x'.repeat(513)});p.initial_notification.context_hash=sha(p.initial_notification.context_json);}]){
  const h=harness(),p=payload();modify(p);assert.throws(()=>h.create(p));assert.equal(h.bookings.rows.length,4);assert.equal(h.ledger.rows.length,1);
 }
});

test('historical OK request or lost initial ledger row never backfills delivery intents',()=>{
 const h=harness();h.seedLegacy();
 const r=h.create();assert.equal(r.initial_outbox.deliveries.length,2);assert.ok(Array.from(r.initial_outbox.deliveries).every(d=>d.state==='MISSING'));assert.equal(h.ledger.rows.length,1);
 const active=harness();active.create();active.ledger.rows.splice(2,1);
 const missing=active.create();assert.ok(Array.from(missing.initial_outbox.deliveries).every(d=>d.state==='MISSING'));assert.equal(active.ledger.rows.length,2);
 assert.throws(()=>active.claim(claim(REPLY)));assert.equal(active.ledger.rows[1][3],'READY');
});

test('initial claims are one-time, customer Reply waits for durable owner SENT, and receipt replay is exact',()=>{
 const h=harness();h.create();assert.equal(h.claim(claim(REPLY)).claimed,false);
 assert.equal(h.claim().claimed,true);assert.equal(h.claim().claimed,false);
 const p=claim();const receipt={...p,delivery_state:'SENT',provider_message_id:'synthetic-message',provider_request_id:'synthetic-request'};
 assert.equal(h.settle(receipt).state,'SENT');assert.equal(h.settle(receipt).state,'SENT');
 assert.throws(()=>h.settle({...receipt,provider_message_id:'different'}));
 assert.throws(()=>h.settle({...receipt,delivery_state:'UNCERTAIN',provider_message_id:'',provider_request_id:''}));
 assert.equal(h.claim(claim(REPLY)).claimed,true);assert.equal(h.claim(claim(REPLY)).claimed,false);
 assert.equal(h.ledger.rows.length,3);
});

test('UNCERTAIN never grants another send; only same claimed message may reconcile a receipt',()=>{
 const h=harness();h.create();h.claim();const p=claim();
 assert.equal(h.settle({...p,delivery_state:'UNCERTAIN'}).state,'UNCERTAIN');assert.equal(h.claim().claimed,false);
 assert.throws(()=>h.settle({...p,message_hash:'f'.repeat(64),delivery_state:'SENT',provider_message_id:'receipt'}));
 assert.equal(h.settle({...p,delivery_state:'SENT',provider_message_id:'receipt',provider_request_id:'request'}).state,'SENT');
});

test('status, canonical recipient, context, request and configured owner drift block claim and settlement',()=>{
 for(const drift of [h=>{h.bookings.rows[4][2]='picked_up';},h=>{h.bookings.rows[4][5]='U'+'b'.repeat(32);},h=>{h.bookings.rows[4][19]='[KK_REQ:line:'+'b'.repeat(48)+']';},h=>{h.ledger.rows[1][9]=RAW+' ';},h=>{h.stored.KK_LINE_INITIAL_OUTBOX_OWNER_TARGET='C'+'a'.repeat(32);},h=>{h.bookings.rows[4][4]='different';},h=>{h.bookings.rows[4][9]='PHONE-1';}]){
  const h=harness();h.create();drift(h);assert.throws(()=>h.claim());assert.equal(h.ledger.rows[1][3],'READY');
  const s=harness();s.create();s.claim();drift(s);assert.throws(()=>s.settle({...claim(),delivery_state:'SENT',provider_message_id:'receipt'}));assert.equal(s.ledger.rows[1][3],'CLAIMED');
 }
});

test('canonical package type remains pinned for initial replay, claim and receipt settlement',()=>{
 const h=harness();h.create();h.bookings.rows[4][8]='phone_lens_bundle';
 const before=h.stats().writes;
 assert.throws(()=>h.claim(),/CANONICAL|PACKAGE/);assert.equal(h.stats().writes,before);
 assert.throws(()=>h.create(),/CANONICAL|PACKAGE/);assert.equal(h.stats().writes,before);
 const settled=harness();settled.create();settled.claim();settled.bookings.rows[4][2]='confirmed';settled.bookings.rows[4][8]='phone_lens_bundle';
 const prior=settled.stats().writes;
 assert.throws(()=>settled.settle({...claim(),delivery_state:'SENT',provider_message_id:'synthetic-receipt'}),/CANONICAL|PACKAGE/);
 assert.equal(settled.stats().writes,prior);assert.equal(settled.ledger.rows[1][3],'CLAIMED');
});

test('pair capacity preflight admits no partial new work, but existing recovery remains available above cap',()=>{
 const full=harness();while(full.ledger.rows.length<1000)full.ledger.rows.push(Array(14).fill('historical'));
 assert.throws(()=>full.create(),/CAPACITY/);assert.equal(full.bookings.rows.length,4);assert.equal(full.ledger.rows.length,1000);
 const h=harness();h.create();while(h.ledger.rows.length<1003)h.ledger.rows.push(Array(14).fill('historical'));
 assert.equal(h.create().initial_outbox.deliveries[0].state,'READY');assert.equal(sent(h).state,'SENT');
});

test('invalid claim identity or missing receipt cannot advance canonical state',()=>{
 for(const patch of [{claim_key:'bad'},{kind:'OTHER'},{request_id:'line:'+'b'.repeat(48)},{outbox_id:'forged'},{context_hash:'b'.repeat(64)},{message_hash:''},{initial_dispatch_key:'wrong'}]){
  const h=harness();h.create();assert.throws(()=>h.claim(claim(KIND,patch)));assert.equal(h.ledger.rows[1][3],'READY');
 }
 const h=harness();h.create();h.claim();for(const p of [{delivery_state:'SENT'},{delivery_state:'SENT',provider_message_id:'x'.repeat(201)},{delivery_state:'UNCERTAIN',provider_message_id:'receipt'}])assert.throws(()=>h.settle({...claim(),...p}));
});

test('disabled initial feature retains the legacy pending writer and creates no initial ledger work',()=>{
 const h=harness({enabled:false});const p=payload();delete p.initial_notification;delete p.initial_dispatch_key;
 assert.equal(h.create(p).idempotent_replay,false);assert.equal(h.create(p).idempotent_replay,true);assert.equal(h.ledger.rows.length,1);
});

test('mixed-version initial payload is rejected while feature is OFF, before Booking allocation',()=>{
 const h=harness({enabled:false});assert.throws(()=>h.create(payload()),/INITIAL_OUTBOX_DISABLED/);
 assert.equal(h.stats().allocations,0);assert.equal(h.ledger.rows.length,1);assert.equal(h.bookings.rows.length,4);
});

test('context and request properties use UTF8 byte limits, not character counts',()=>{
 const h=harness();const p=payload();
 p.initial_notification.context_json=JSON.stringify({...context,event_name:'ก'.repeat(512),venue:'ก'.repeat(512),package_name:'ก'.repeat(512),price_display:'ก'.repeat(512)});
 p.initial_notification.context_hash=sha(p.initial_notification.context_json);
 assert.ok(p.initial_notification.context_json.length<8192);
 assert.throws(()=>h.create(p),/CONTEXT|SIZE/);assert.equal(h.stats().allocations,0);assert.equal(h.bookings.rows.length,4);
 const repeated=harness(),p2=payload();p2.customer_name='ก'.repeat(512);p2.customer_phone='ข'.repeat(512);
 p2.initial_notification.context_json=JSON.stringify({...context,nickname:p2.customer_name,phone:p2.customer_phone});
 p2.initial_notification.context_hash=sha(p2.initial_notification.context_json);
 assert.ok(Buffer.byteLength(p2.initial_notification.context_json,'utf8')<6000);
 assert.throws(()=>repeated.create(p2),/CLAIM_SIZE/);assert.equal(repeated.stats().allocations,0);assert.equal(repeated.ledger.rows.length,1);
});

test('a provider receipt may settle after fast owner decision but never grant a fresh terminal Booking claim',()=>{
 for(const status of ['confirmed','cancelled']){
  const h=harness();h.create();h.claim();h.bookings.rows[4][2]=status;
  h.bookings.rows[4][9]='PHONE-SYNTHETIC';h.bookings.rows[4][13]='paid';h.bookings.rows[4][14]=790;
  const receipt={...claim(),delivery_state:'SENT',provider_message_id:'synthetic-receipt',provider_request_id:'synthetic-request'};
  assert.equal(h.settle(receipt).state,'SENT');assert.equal(h.settle(receipt).state,'SENT');
  assert.throws(()=>h.claim(claim(REPLY)));assert.equal(h.ledger.rows[2][3],'READY');
  h.bookings.rows[4][5]='U'+'b'.repeat(32);assert.throws(()=>h.settle(receipt));
 }
});

test('crashes at partial INTENT cannot allocate another Booking; crashes during READY reconcile same pair',()=>{
 for(const flush of [1,2]){
  const h=harness();h.crashAt(flush);assert.throws(()=>h.create(),/SYNTHETIC_CRASH/);h.crashAt(0);
  assert.throws(()=>h.create());assert.equal(h.stats().allocations,1);assert.equal(h.bookings.rows.length,4);assert.equal(h.ledger.rows.length,flush+1);
 }
 for(const flush of [4,5]){
  const h=harness();h.crashAt(flush);assert.throws(()=>h.create(),/SYNTHETIC_CRASH/);h.crashAt(0);
  const r=h.create();assert.ok(Array.from(r.initial_outbox.deliveries).every(d=>d.state==='READY'));
  assert.equal(h.stats().allocations,1);assert.equal(h.ledger.rows.length,3);
 }
});

test('duplicate ledger IDs and corrupted receipts cannot authorize claims',()=>{
 const duplicate=harness();duplicate.create();duplicate.ledger.rows.push(duplicate.ledger.rows[1].slice());
 assert.throws(()=>duplicate.claim(),/DUPLICATE_ID/);
 const corrupt=harness();corrupt.create();sent(corrupt);corrupt.ledger.rows[1][5]='';
 assert.throws(()=>corrupt.claim(claim(REPLY)),/IDENTITY_OR_STATE/);
});

test('initial API audit/error paths retain metadata only, secrets and context are redacted',()=>{
 const h=harness(),logs=[];
 const start=source.indexOf('function doPost(e)');const end=source.indexOf('\nfunction doGet',start);
 Object.assign(h.ctx,{kkApiRequireKey_(){},kkApiJson_:v=>v,kkApiOk_:v=>({ok:true,...v}),kkApiFail_:e=>({ok:false,error:e.message}),kkAuditLog_:(...a)=>logs.push(a),kkErrorLog_:(...a)=>logs.push(a)});
 vm.runInContext(source.slice(start,end),h.ctx);
 const p={...payload(),action:'createLineBookingPending'};
 const r=h.ctx.doPost({postData:{contents:JSON.stringify(p)}});assert.equal(r.ok,true);
 const rendered=JSON.stringify(logs);assert.doesNotMatch(rendered,new RegExp(SECRET+'|Synthetic Customer|'+CUSTOMER+'|context_json'));
 logs.length=0;h.ctx.kkApiClaimLineBookingInitialDelivery_=()=>{throw Error('PRIVATE_CONTEXT_'+RAW+' '+SECRET);};
 const failed=h.ctx.doPost({postData:{contents:JSON.stringify({...claim(),action:'claimLineBookingInitialDelivery'})}});
 assert.equal(failed.ok,false);assert.doesNotMatch(JSON.stringify([logs,failed]),/PRIVATE_CONTEXT|Synthetic Customer|synthetic_initial_dispatch/);
 assert.match(JSON.stringify(failed),/LINE_INITIAL_OUTBOX_ACTION_FAILED/);
 const stringifyStart=source.indexOf('function kkRedactSecretText_');const stringifyEnd=source.indexOf('\nfunction kkEnsurePhase1Sheets',stringifyStart);
 vm.runInContext(source.slice(stringifyStart,stringifyEnd),h.ctx);
 assert.doesNotMatch(h.ctx.kkSafeStringify_({initial_dispatch_key:SECRET,context_json:RAW,initial_notification:p.initial_notification},3000),/synthetic_initial_dispatch|Synthetic Customer/);
});
