'use strict';
const assert=require('assert');
const c=require('../lib/kk-invariant-review-contract');
let n=0; const ok=(v,m)=>{assert(v,m);n++;}; const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

let cats=c.categoriesForPath('lib/kk-runtime-acceptance-contract.js');
ok(cats.includes('CONTROL_PLANE'),'runtime path classified control plane');
cats=c.categoriesForPath('lib/kk-booking-intake-guard.js');
ok(cats.includes('BOOKING_STATE'),'booking path classified');
cats=c.categoriesForPath('lib/kk-x-publish-guard.js');
ok(cats.includes('OUTBOUND_PROVIDER'),'publish path classified outbound/provider');
cats=c.categoriesForPath('lib/kk-third-party-agent-guard.js');
ok(cats.includes('THIRD_PARTY_TOOLING'),'third-party guard classified');
cats=c.categoriesForPath('api/kk-admin.js');
ok(cats.includes('API_BOUNDARY'),'api path classified');

let req=c.requiredInvariants(['lib/kk-runtime-acceptance-contract.js']);
ok(req.required.includes('fencing'),'control plane requires fencing');
ok(req.required.includes('natural_runtime_evidence'),'control plane requires natural runtime evidence');
ok(req.required.includes('scope_owned')&&req.required.includes('regression_test'),'base invariants always required');

const allRuntime=['scope_owned','regression_test','authority','identity','lease','fencing','manifest','terminal_closure','release','natural_runtime_evidence'];
let r=c.reviewChangeSet({changed_files:['lib/kk-runtime-acceptance-contract.js'],declared_invariants:allRuntime,test_evidence:['41/41 PASS']});
eq(r.decision,'PASS','fully declared control-plane change passes invariant review');
eq(r.tier,'AUDIT','control-plane change requires audit tier');

r=c.reviewChangeSet({changed_files:['lib/kk-runtime-acceptance-contract.js'],declared_invariants:['scope_owned','regression_test'],test_evidence:['tests']});
eq(r.decision,'HOLD','missing critical invariants holds review');
ok(r.reasons.includes('MISSING_INVARIANT:fencing'),'missing fencing surfaced');

r=c.reviewChangeSet({changed_files:[],declared_invariants:[],test_evidence:[]});
ok(r.reasons.includes('CHANGED_FILES_REQUIRED'),'changed files required');
ok(r.reasons.includes('TEST_EVIDENCE_REQUIRED'),'test evidence required');

r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['doc lint']});
eq(r.tier,'SELF_REVIEW','docs-only low risk may self review');

r=c.reviewChangeSet({changed_files:['scripts/tool.js'],declared_invariants:['scope_owned','regression_test'],test_evidence:['unit pass']});
eq(r.tier,'PARENT_VERIFY','ordinary executable change requires parent verification');

r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['pass'],operations:['MERGE_MAIN'],explicit_owner_approval:false});
eq(r.decision,'HOLD','owner-gated operation without approval holds');
ok(r.reasons.includes('OWNER_APPROVAL_REQUIRED'),'owner approval surfaced');
r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['pass'],operations:['MERGE_MAIN'],explicit_owner_approval:true});
eq(r.decision,'PASS','owner-gated operation may pass this review only with explicit approval');

r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['pass'],tests_weakened_or_deleted:true});
ok(r.reasons.includes('TEST_WEAKENING_PROHIBITED'),'test weakening prohibited');
r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['pass'],evidence_claim_exceeds_proof:true});
ok(r.reasons.includes('EVIDENCE_OVERCLAIM'),'evidence overclaim prohibited');
r=c.reviewChangeSet({changed_files:['docs/kk-phone-rental/note.md'],declared_invariants:['scope_owned','regression_test'],test_evidence:['pass'],unowned_file_changed:true});
ok(r.reasons.includes('UNOWNED_FILE_CHANGED'),'unowned file change prohibited');

const outboundReq=c.requiredInvariants(['lib/kk-owner-notification-contract.js']);
ok(outboundReq.required.includes('provider_ack_semantics'),'outbound requires provider ack semantics');
ok(outboundReq.required.includes('no_fake_receipt'),'outbound forbids fake receipt');

const bookingReq=c.requiredInvariants(['lib/kk-booking-intake-guard.js']);
ok(bookingReq.required.includes('idempotency')&&bookingReq.required.includes('no_pii_leak'),'booking requires idempotency and PII guard');

console.log(`kk-invariant-review-contract: ${n}/${n} PASS`);
