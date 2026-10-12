'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

test('Apps Script owner decision is a separate atomic pending-only action',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'decideLineBookingPending': result = kkApiDecideLineBookingPending_\(payload\); break;/);
  const start=source.indexOf('function kkApiDecideLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/kkAcquireDocumentLock_\('LINE owner booking decision', 12000\)/);
  assert.match(body,/currentStatus !== 'pending'/);
  assert.match(body,/targetStatus = decision === 'approve' \? 'confirmed' : 'cancelled'/);
  assert.match(body,/idempotent_replay: true/);
  assert.match(body,/SpreadsheetApp\.flush\(\)/);
  assert.match(body,/Owner decision readback failed/);
  assert.match(body,/LINE customer contact readback failed/);
  assert.match(body,/customer_contact: customerContact/);
  assert.match(body,/customerContact = String\(current\[5\]/);
  assert.match(body,/String\(persisted\[5\]/);
});

test('v2 approval snapshot binds A:T booking state and rejects changed version under document lock',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'decideLineBookingPendingV2': result = kkApiDecideLineBookingPending_\(payload, true\); break;/);
  assert.match(source,/function kkLineBookingApprovalVersion_\(row\)/);
  assert.match(source,/Utilities\.computeDigest\(Utilities\.DigestAlgorithm\.SHA_256/);
  assert.match(source,/const indices = \[0,1,2,3,4,5,6,7,8,9,10,11,13,14,19\]/);
  assert.match(source,/approval_version:kkLineBookingApprovalVersionAtRow_/);
  const start=source.indexOf('function kkApiDecideLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  const body=source.slice(start,end);
  assert.match(body,/kkAcquireDocumentLock_\('LINE owner booking decision', 12000\)/);
  assert.match(body,/approvedVersion = kkLineBookingApprovalVersion_\(current\)/);
  assert.match(body,/approvedVersion !== expectedVersion/);
  assert.match(body,/currentStatus !== 'pending'/);
  assert.match(body,/Number\(current\[14\]\|\|0\) !== 0/);
  assert.match(body,/kkIsPastEventDate_\(liveEvent\.event_date\)/);
  assert.match(body,/approved_version:approvedVersion/);
});

test('v2 commercial version binds current event and exact public package price',()=>{
  const code=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(code,/function kkLineBookingCommercialSnapshot_\(row\)/);
  const start=code.indexOf('function kkLineBookingCommercialSnapshot_');
  const end=code.indexOf('function kkLineBookingApprovalVersionAtRow_',start);
  assert.ok(end>start,'version helper section must be contiguous');
  const body=code.slice(start,end);
  assert.match(body,/kkBookingRequestIdFromNote_\(row\[19\]\)/);
  assert.match(body,/claim\.status !== 'OK'/);
  assert.match(body,/String\(claim\.booking_id\|\|''\)\.trim\(\) !== bookingId/);
  assert.match(body,/String\(claim\.event_id\|\|''\)\.trim\(\) !== eventId/);
  assert.match(body,/kkGetEventById_\(eventId\)/);
  assert.match(body,/kkApiWebPackageRows_\(\)\.filter/);
  assert.match(body,/matching\.length !== 1 \|\| !\(Number\(matching\[0\]\.price\|\|0\)>0\)/);
  assert.match(body,/kkApiDate_\(event\.event_date\)/);
  assert.match(body,/Number\(pkg\.price\)/);
  assert.match(body,/JSON\.stringify\(\['KK_LINE_BOOKING_OWNER_APPROVAL_V2', normalized, commercial\]\)/);
  assert.match(code,/decision === 'approve' &&\s*\(String\(liveEvent\.status/);
  assert.match(code,/approvedVersion !== expectedVersion/);
});

test('legacy pending create never requires V2 canonical price; V2 preflights before Booking write',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  const start=src.indexOf('function kkApiCreateLineBookingPending_');
  const end=src.indexOf('\nfunction kkApiDecideLineBookingPending_',start);
  const body=src.slice(start,end);
  assert.match(body,/const requestV2 = String\(payload\.approval_mode\|\|''\)\.trim\(\)\.toLowerCase\(\) === 'v2'/);
  assert.match(body,/if \(requestV2\) \{[\s\S]*exact\.length !== 1[\s\S]*exact price unavailable before booking create/);
  assert.ok(body.indexOf('exact price unavailable before booking create') < body.indexOf('status: \'PENDING\''),'V2 price must be checked before claim and booking mutation');
  assert.equal((body.match(/approval_version:requestV2 \? kkLineBookingApprovalVersionAtRow_/g)||[]).length,3,'every pending/replayed intake response must be opt-in');
  assert.match(src,/case 'decideLineBookingPending': result = kkApiDecideLineBookingPending_\(payload\); break;/);
  assert.match(src,/case 'decideLineBookingPendingV2': result = kkApiDecideLineBookingPending_\(payload, true\); break;/);
});


test('V2 effective owner-hidden/date gate and package stock are source-bound, not only event.active',()=>{
 const code=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
 assert.match(code,/function kkLineBookingVisibleEventV2_\(eventId, expectedDate\)/);
 assert.match(code,/action !== 'show' && action !== 'show_full'/);
 assert.match(code,/LINE owner V2 event hidden by effective storefront visibility/);
 assert.match(code,/LINE owner V2 storefront\/core event date mismatch/);
 assert.match(code,/const web=kkLineBookingVisibleEventV2_\(eventId,liveDate\)/);
 assert.match(code,/web\.action,web\.phone_count,web\.lens_count/);
 assert.match(code,/Number\(pkg\.available_count\|\|0\),Number\(pkg\.raw_available_count\|\|0\)/);
 const intake=code.slice(code.indexOf('function kkApiCreateLineBookingPending_'),code.indexOf('function kkApiDecideLineBookingPending_',code.indexOf('function kkApiCreateLineBookingPending_')));
 assert.match(intake,/kkLineBookingVisibleEventV2_\(eventId,kkApiDate_\(event\.event_date\)\)/);
 assert.match(intake,/web\.action !== 'show'/);
 assert.ok(intake.indexOf("web.action !== 'show'") < intake.indexOf("status: 'PENDING'"),'owner-day guard must happen before booking claim');
});

test('actual Apps Script V2 fingerprint detects owner-hidden, stale dates and package stock without touching bookings',()=>{
 const code=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
 const start=code.indexOf('function kkLineBookingVisibleEventV2_');
 const end=code.indexOf('function kkLineBookingApprovalVersionAtRow_',start);
 assert.ok(start>=0 && end>start,'extract actual Apps Script V2 authorization functions');
 const requestId='line:'+'a'.repeat(48);
 const claim={status:'OK',booking_id:'BK-TEST',event_id:'EVT-1',template_id:'TPL-1'};
 const core={event_date:'2026-11-14',status:'open',active:true};
 const web={event_id:'EVT-1',event_date:'2026-11-14',action_for_web:'show',available_phone_count:2,available_lens_count:2};
 const pkg={event_id:'EVT-1',package_id:'EVT-1-TPL-1',price:890,package_status:'available',available_count:2,raw_available_count:2};
 let webRows=[web];
 const sandbox={
   PropertiesService:{getScriptProperties(){return {getProperty(){return JSON.stringify(claim);}};}},
   Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest(_alg,text){return Array.from(crypto.createHash('sha256').update(text,'utf8').digest());}},
   kkBookingRequestIdFromNote_:()=>requestId,
   kkLineBookingRequestKey_:id=>'claim:'+id,
   kkNormalizeTemplateIdForEvent_:(_id,t)=>t,
   kkTemplateIdFromWebPackageId_:(id,eventId)=>id.slice(eventId.length+1),
   kkGetEventById_:()=>core,
   kkApiDate_:x=>String(x),
   kkApiDateTime_:x=>String(x),
   kkApiWebReadyRows_:()=>webRows,
   kkApiWebPackageRows_:()=>[pkg]
 };
 vm.runInNewContext(code.slice(start,end),sandbox);
 const booking=Array(20).fill('');
 booking[0]='BK-TEST';booking[1]='2026-10-12';booking[2]='pending';booking[3]='EVT-1';booking[13]='unpaid';booking[14]=0;booking[19]='governed LINE request';
 const baseline=sandbox.kkLineBookingApprovalVersion_(booking);
 assert.match(baseline,/^[a-f0-9]{64}$/);
 web.action_for_web='hide';
 assert.throws(()=>sandbox.kkLineBookingApprovalVersion_(booking),/hidden by effective storefront visibility/);
 web.action_for_web='show';web.event_date='2026-11-15';
 assert.throws(()=>sandbox.kkLineBookingApprovalVersion_(booking),/storefront\/core event date mismatch/);
 web.event_date='2026-11-14';
 pkg.available_count=1;
 assert.notEqual(sandbox.kkLineBookingApprovalVersion_(booking),baseline,'new booking reduces available stock: stale owner approval invalid');
 pkg.available_count=2;web.available_phone_count=1;
 assert.notEqual(sandbox.kkLineBookingApprovalVersion_(booking),baseline,'owner daily stock count change invalidates revision');
 web.available_phone_count=2;web.action_for_web='show_full';
 assert.notEqual(sandbox.kkLineBookingApprovalVersion_(booking),baseline,'pending reservation may cause full display; must require matching signed version');
 web.action_for_web='show';webRows=[];
 assert.throws(()=>sandbox.kkLineBookingApprovalVersion_(booking),/missing or duplicated/);
 webRows=[web,web];
 assert.throws(()=>sandbox.kkLineBookingApprovalVersion_(booking),/missing or duplicated/);
});
