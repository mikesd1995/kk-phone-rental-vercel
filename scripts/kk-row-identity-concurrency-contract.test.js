'use strict';
const assert=require('assert');
const c=require('../lib/kk-row-identity-concurrency-contract');
let n=0;
const ok=(v,msg)=>{assert(v,msg);n++;};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

function createRecord(overrides={}){
  return Object.assign({
    operation:'CREATE',
    creation_mode:'ATOMIC_APPEND',
    atomic_append:true,
    computed_last_row_write:false,
    immutable_identity_bound:true,
    identity_match_count:1,
    exact_readback:true
  },overrides);
}

function updateRecord(overrides={}){
  return Object.assign({
    operation:'UPDATE',
    cached_row_used_as_authority:false,
    rebind_performed:true,
    identity_match_count:1,
    identity_unchanged:true,
    exact_readback:true
  },overrides);
}

function shared(overrides={}){
  return Object.assign({
    shared_lock_creation_mode:'ATOMIC_APPEND',
    shared_lock_atomic_append:true,
    shared_lock_count:1,
    shared_lock_owned:true,
    shared_lock_identity_proven:true,
    own_role_lock_count:1,
    own_role_lock_owned:true,
    other_role_active_after_acquire:false,
    protected_write_before_shared_gate:false
  },overrides);
}

let r=c.recordIdentityGate(createRecord());
ok(r.accepted&&r.status==='PASS','atomic append plus exact immutable identity passes create gate');
r=c.recordIdentityGate(createRecord({atomic_append:false,creation_mode:'POSITIONAL'}));
ok(!r.accepted&&r.reasons.includes('NON_ATOMIC_APPEND'),'non-atomic creation is denied');
r=c.recordIdentityGate(createRecord({computed_last_row_write:true}));
ok(r.reasons.includes('COMPUTED_LAST_ROW_WRITE'),'computed lastRow+1 write is explicitly denied');
r=c.recordIdentityGate(createRecord({immutable_identity_bound:false}));
ok(r.reasons.includes('IMMUTABLE_IDENTITY_NOT_BOUND'),'new run record must bind immutable identity');
r=c.recordIdentityGate(createRecord({identity_match_count:2}));
ok(r.reasons.includes('IDENTITY_MATCH_COUNT_NOT_ONE'),'duplicate identity after append is denied');
r=c.recordIdentityGate(createRecord({exact_readback:false}));
ok(r.reasons.includes('EXACT_READBACK_REQUIRED'),'creation requires exact readback');

r=c.recordIdentityGate(updateRecord());
ok(r.accepted,'update after immutable exact1 rebind passes');
r=c.recordIdentityGate(updateRecord({operation:'RELEASE'}));
ok(r.accepted&&r.release,'release uses the same stable-identity gate');
r=c.recordIdentityGate(updateRecord({cached_row_used_as_authority:true}));
ok(r.reasons.includes('CACHED_ROW_AUTHORITY'),'cached physical row cannot authorize update');
r=c.recordIdentityGate(updateRecord({rebind_performed:false}));
ok(r.reasons.includes('IDENTITY_REBIND_REQUIRED'),'every later update must rebind');
r=c.recordIdentityGate(updateRecord({identity_match_count:0}));
ok(r.reasons.includes('IDENTITY_MATCH_COUNT_NOT_ONE'),'missing row identity fails closed');
r=c.recordIdentityGate(updateRecord({identity_match_count:2}));
ok(r.reasons.includes('IDENTITY_MATCH_COUNT_NOT_ONE'),'duplicate row identity fails closed');
r=c.recordIdentityGate(updateRecord({identity_unchanged:false}));
ok(r.reasons.includes('IDENTITY_DRIFT'),'changed immutable identity fails closed');
r=c.recordIdentityGate(updateRecord({exact_readback:false}));
ok(r.reasons.includes('EXACT_READBACK_REQUIRED'),'later update requires exact readback');
r=c.recordIdentityGate(updateRecord({physical_row_changed:true}));
ok(r.accepted,'physical row movement is safe when immutable identity is rebound exact1');

let s=c.sharedWriterGate(shared());
ok(s.accepted&&s.status==='PASS','single owned shared writer with exact role lock passes');
s=c.sharedWriterGate(shared({shared_lock_atomic_append:false,shared_lock_creation_mode:'POSITIONAL'}));
ok(s.reasons.includes('SHARED_LOCK_NON_ATOMIC_APPEND'),'shared writer lock must use atomic append');
s=c.sharedWriterGate(shared({shared_lock_count:0}));
ok(s.reasons.includes('SHARED_LOCK_COUNT_NOT_ONE'),'missing shared lock denies protected writes');
s=c.sharedWriterGate(shared({shared_lock_count:2}));
ok(s.reasons.includes('SHARED_LOCK_COUNT_NOT_ONE'),'duplicate shared locks deny protected writes');
s=c.sharedWriterGate(shared({shared_lock_owned:false}));
ok(s.reasons.includes('SHARED_LOCK_NOT_OWNED'),'role cannot write through another holder shared lock');
s=c.sharedWriterGate(shared({shared_lock_identity_proven:false}));
ok(s.reasons.includes('SHARED_LOCK_IDENTITY_NOT_PROVEN'),'shared lock needs immutable identity proof');
s=c.sharedWriterGate(shared({own_role_lock_count:0}));
ok(s.reasons.includes('OWN_ROLE_LOCK_COUNT_NOT_ONE'),'own role lock exact1 is required');
s=c.sharedWriterGate(shared({own_role_lock_owned:false}));
ok(s.reasons.includes('OWN_ROLE_LOCK_NOT_OWNED'),'own role lock ownership is required');
s=c.sharedWriterGate(shared({other_role_active_after_acquire:true}));
ok(s.reasons.includes('CROSS_ROLE_ACTIVE_CONFLICT'),'concurrent other role after acquire fails closed');
s=c.sharedWriterGate(shared({protected_write_before_shared_gate:true}));
ok(s.reasons.includes('PROTECTED_WRITE_BEFORE_SHARED_GATE'),'protected writes cannot precede shared gate');

let p=c.protectedWriteGate({shared:shared(),record:updateRecord()});
ok(p.accepted,'protected write passes only when shared and record gates both pass');
p=c.protectedWriteGate({shared:shared(),record:updateRecord({cached_row_used_as_authority:true})});
ok(!p.accepted&&p.reasons.includes('CACHED_ROW_AUTHORITY'),'row-identity failure denies combined protected write');
p=c.protectedWriteGate({shared:shared({other_role_active_after_acquire:true}),record:updateRecord()});
ok(!p.accepted&&p.reasons.includes('CROSS_ROLE_ACTIVE_CONFLICT'),'cross-role conflict denies combined protected write');

// Real 2026-09-11 Scanner collision regression: the row passed an initial read,
// then Verifier replaced the physical row identity before Scanner close. A cached
// row close must be denied rather than terminalizing/releasing the wrong record.
r=c.recordIdentityGate(updateRecord({
  operation:'RELEASE',
  cached_row_used_as_authority:true,
  rebind_performed:false,
  identity_match_count:0,
  identity_unchanged:false,
  exact_readback:false
}));
ok(!r.accepted,'real cross-writer replaced-row close is denied');
ok(r.reasons.includes('CACHED_ROW_AUTHORITY')&&r.reasons.includes('IDENTITY_REBIND_REQUIRED')&&r.reasons.includes('IDENTITY_DRIFT'),'real incident exposes cached-row, rebind and identity-drift violations');
eq(r.highest_severity,'P0','row identity collision is P0');

let d=c.concurrencyDecision({
  scanner:shared(),
  verifier:shared({shared_lock_owned:false,other_role_active_after_acquire:true})
});
ok(d.safe&&d.admitted.length===1&&d.admitted[0]==='SCANNER','simultaneous roles serialize to one shared writer');
d=c.concurrencyDecision({scanner:shared(),verifier:shared()});
ok(!d.safe&&d.status==='DUAL_WRITER_DENY','two accepted shared writers are a deterministic invariant failure');
d=c.concurrencyDecision({
  scanner:shared({shared_lock_owned:false}),
  verifier:shared({shared_lock_owned:false})
});
ok(d.safe&&d.admitted.length===0,'fail-closed zero-writer state is safer than dual writer');

eq(c.failureSeverity('IDENTITY_DRIFT'),'P0','identity drift severity is P0');
eq(c.failureSeverity('UNKNOWN_METADATA'),'P2','unknown metadata defaults to P2');

console.log(`kk-row-identity-concurrency-contract: ${n}/${n} PASS`);
