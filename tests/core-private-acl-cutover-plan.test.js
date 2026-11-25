'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ACL=require('../scripts/core-private-acl-cutover-plan.cjs');

const NOW='2026-11-13T02:00:00.000Z';
const SHA='a'.repeat(40);
function fixture(){
  return {
    target:ACL.CORE_WORKBOOK,
    candidateSha:SHA,
    deployment:{sourceSha:SHA,readbackRef:'evidence:deployment',observedAtUTC:NOW},
    permissions:{observedAtUTC:NOW,complete:true,publishedViewExcluded:true,expectedDigest:'c'.repeat(64),actualDigest:'c'.repeat(64),
      expected:[{type:'user',role:'owner'},{type:'anyone',role:'reader',allowFileDiscovery:false}],
      actual:[{type:'anyone',role:'reader',allowFileDiscovery:false},{type:'user',role:'owner'}]},
    privateReads:{sourceSha:SHA,observedAtUTC:NOW,authenticated:true,publicFallback:false,
      results:ACL.requiredPairs().map(pair=>({...pair,status:'VERIFIED',evidenceRef:'evidence:private-acceptance'}))},
    consumers:Object.fromEntries(ACL.CONSUMERS.map(key=>[key,{status:'VERIFIED',sourceSha:SHA,observedAtUTC:NOW,evidenceRef:'evidence:consumer-acceptance'}])),
    policy:{compatibleActive:true,observedAtUTC:NOW,evidenceRef:'evidence:policy'},
    ownerCredentialBinding:{status:'VERIFIED',sourceSha:SHA,observedAtUTC:NOW,evidenceRef:'evidence:binding'},
    rollback:{failClosed:true,restorePublicAccess:false}
  };
}
function evaluate(p){return ACL.evaluate(p,{now:NOW,maxAgeSeconds:900});}

test('missing evidence prepares no permission operation and never grants execution',()=>{
  const p=evaluate({});
  assert.equal(p.execution_authorized,false);
  assert.equal(p.cutover_ready,false);
  assert.equal(p.status,'PREPARATION_HAS_GAPS');
  assert.ok(p.blockers.length>0);
  assert.deepEqual(p.proposed_operations,[]);
});
test('complete local checklist proposes one removal but cannot establish runtime acceptance',()=>{
  const p=evaluate(fixture());
  assert.deepEqual(p.blockers,[]);
  assert.equal(p.status,'CHECKLIST_COMPLETE_REQUIRES_LIVE_REVIEW');
  assert.equal(p.cutover_ready,false);
  assert.equal(p.runtime_verified,false);
  assert.equal(p.execution_authorized,false);
  assert.equal(p.proposed_operations.length,1);
  assert.equal(p.proposed_operations[0].action,'REMOVE_EXACT_ANYONE_READER_AFTER_FRESH_ID_READ');
  assert.deepEqual(p.expected_after,[{type:'user',role:'owner'}]);
  assert.equal(p.permission_writes,0);
});
test('all 19 exact range pairs are required; a 13-of-19 schema result cannot approve ACL',()=>{
  const p=fixture();p.privateReads.results=p.privateReads.results.slice(0,13);
  assert.ok(evaluate(p).blockers.includes('PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE'));
});
test('duplicate and substituted range pairs fail even at the correct count',()=>{
  const p=fixture();p.privateReads.results[18]={...p.privateReads.results[0]};
  assert.ok(evaluate(p).blockers.includes('PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE'));
  const q=fixture();q.privateReads.results[0].range='A1:ZZ';
  assert.ok(evaluate(q).blockers.includes('PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE'));
});
test('header-only/schema statuses do not become authenticated consumer acceptance',()=>{
  const p=fixture();p.privateReads.results[0].status='PRIVATE_RANGE_SCHEMA_OK';
  assert.ok(evaluate(p).blockers.includes('PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE'));
  const q=fixture();q.consumers.admin_snapshot.status='PENDING';
  assert.ok(evaluate(q).blockers.includes('CONSUMER_ACCEPTANCE_INCOMPLETE'));
});
test('deployed source and independent owner credential binding must match candidate',()=>{
  const p=fixture();p.deployment.sourceSha='b'.repeat(40);
  assert.ok(evaluate(p).blockers.includes('DEPLOYMENT_BINDING_MISSING'));
  const q=fixture();q.ownerCredentialBinding.sourceSha='b'.repeat(40);
  assert.ok(evaluate(q).blockers.includes('OWNER_BINDING_MISSING'));
});
test('freshness is explicit and future/old timestamps fail closed',()=>{
  for(const at of ['2026-11-13T01:00:00Z','2026-11-13T02:00:01Z','invalid']){
    const p=fixture();p.permissions.observedAtUTC=at;
    assert.ok(evaluate(p).blockers.includes('PERMISSION_SNAPSHOT_INCOMPLETE_OR_STALE'));
  }
  assert.ok(ACL.evaluate(fixture(),{now:NOW}).blockers.includes('FRESHNESS_BOUND_REQUIRED'));
});
test('permission drift, incomplete ACL and unknown published views stop removal',()=>{
  const p=fixture();p.permissions.actual.push({type:'user',role:'reader'});
  assert.ok(evaluate(p).blockers.includes('PERMISSION_STATE_DRIFT'));
  for(const key of ['complete','publishedViewExcluded']){
    const q=fixture();q.permissions[key]=false;
    assert.ok(evaluate(q).blockers.includes('PERMISSION_SNAPSHOT_INCOMPLETE_OR_STALE'));
  }
});
test('private grants are preserved and public access is never restored as rollback',()=>{
  const p=fixture();const grant={type:'group',role:'reader'};
  p.permissions.actual.push(grant);p.permissions.expected.push(grant);
  assert.deepEqual(evaluate(p).expected_after,[{type:'group',role:'reader'},{type:'user',role:'owner'}]);
  const q=fixture();q.rollback.restorePublicAccess=true;
  assert.ok(evaluate(q).blockers.includes('ROLLBACK_MUST_REMAIN_PRIVATE'));
});
test('missing/ambiguous public grants or broad domain grants require manual scope review',()=>{
  for(const extra of [{type:'anyone',role:'reader'}, {type:'domain',role:'reader'}, {type:'anyone',role:'writer'}]){
    const p=fixture();p.permissions.actual.push(extra);p.permissions.expected.push(extra);
    assert.ok(evaluate(p).blockers.includes('ACL_REMOVAL_SCOPE_UNSAFE'));
  }
  const p=fixture();p.permissions.actual=p.permissions.expected=[{type:'user',role:'owner'}];
  assert.ok(evaluate(p).blockers.includes('ACL_REMOVAL_SCOPE_UNSAFE'));
});
test('wrong workbook, fallback and missing active policy block without probing',()=>{
  const p=fixture();p.target='tracker-is-not-core';p.privateReads.publicFallback=true;p.policy.compatibleActive=false;
  const result=evaluate(p);
  for(const b of ['CORE_TARGET_MISMATCH','PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE','ACTIVE_POLICY_READBACK_MISSING'])assert.ok(result.blockers.includes(b));
});
test('all output remains aggregate with no raw IDs, refs, permission identities or input strings',()=>{
  const p=fixture();p.permissions.actual[0].id='PRIVATE_PERMISSION_ID';
  p.permissions.actual[1].emailAddress='PRIVATE_EMAIL';p.consumers.admin_snapshot.evidenceRef='PRIVATE_SECRET_TOKEN';
  const out=JSON.stringify(evaluate(p));
  assert.doesNotMatch(out,/PRIVATE_PERMISSION_ID|PRIVATE_EMAIL|PRIVATE_SECRET_TOKEN|evidence:|aaaaaaaa|12Z3e_/);
});
test('native C1 is independent of this Core private ACL checklist',()=>{
  const p=fixture();p.nativeC1='UNKNOWN';
  assert.deepEqual(evaluate(p).blockers,[]);
  assert.equal(evaluate(p).native_c1_dependency,false);
});
test('role-only metadata cannot establish exact ACL identity continuity',()=>{
  const p=fixture();delete p.permissions.actualDigest;
  assert.ok(evaluate(p).blockers.includes('EXACT_PERMISSION_DIGEST_MISSING_OR_CHANGED'));
  const q=fixture();q.permissions.actualDigest='d'.repeat(64);
  assert.ok(evaluate(q).blockers.includes('EXACT_PERMISSION_DIGEST_MISSING_OR_CHANGED'));
});
test('old consumer and configured identity evidence must be refreshed before live review',()=>{
  const p=fixture();p.consumers.admin_snapshot.observedAtUTC='2026-11-01T00:00:00Z';
  assert.ok(evaluate(p).blockers.includes('CONSUMER_ACCEPTANCE_INCOMPLETE'));
  const q=fixture();q.ownerCredentialBinding.observedAtUTC='2026-11-01T00:00:00Z';
  assert.ok(evaluate(q).blockers.includes('OWNER_BINDING_MISSING'));
});
