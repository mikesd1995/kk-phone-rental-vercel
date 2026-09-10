'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function list(v){ return Array.isArray(v)?v:[]; }
function bool(v){ return v===true || upper(v)==='TRUE'; }

const OWNER_GATED_OPERATIONS=new Set(['MERGE_MAIN','DEPLOY_PRODUCTION','FORCE_PUSH','PUBLIC_PUBLISH','CUSTOMER_SEND','PROVIDER_MUTATION']);

function categoriesForPath(path){
  const p=text(path).replace(/\\/g,'/').replace(/^\.\//,'');
  const out=new Set();
  if(/scheduler|runner|runtime|scanner|scan|verifier|canary/i.test(p)) out.add('CONTROL_PLANE');
  if(/booking|crm|inventory/i.test(p)) out.add('BOOKING_STATE');
  if(/notification|telegram|line|publish|x-publish|provider|xama|kyc/i.test(p)) out.add('OUTBOUND_PROVIDER');
  if(/transaction|projection|candidate|handoff|discovery-closure/i.test(p)) out.add('STATE_MACHINE');
  if(/third-party|agent-guard|sol-advisor|fcc|gstack|canfly/i.test(p)) out.add('THIRD_PARTY_TOOLING');
  if(/^api\//i.test(p)) out.add('API_BOUNDARY');
  return Array.from(out);
}

const REQUIRED_BY_CATEGORY=Object.freeze({
  CONTROL_PLANE:['authority','identity','lease','fencing','manifest','terminal_closure','release','natural_runtime_evidence'],
  BOOKING_STATE:['authority','identity','idempotency','transactionality','exact_readback','no_pii_leak'],
  OUTBOUND_PROVIDER:['authorization','idempotency','provider_ack_semantics','no_fake_receipt'],
  STATE_MACHINE:['identity','allowed_transition','transactionality','exact_readback','cross_system_reconciliation'],
  THIRD_PARTY_TOOLING:['owned_scope','protected_branch_guard','credential_isolation','production_target_denial'],
  API_BOUNDARY:['input_validation','authorization','idempotency_or_retry_semantics']
});

function requiredInvariants(changedFiles=[]){
  const categories=new Set();
  for(const file of list(changedFiles)) for(const c of categoriesForPath(file)) categories.add(c);
  const required=new Set(['scope_owned','regression_test']);
  for(const c of categories){ for(const r of REQUIRED_BY_CATEGORY[c]||[]) required.add(r); }
  return {categories:Array.from(categories).sort(),required:Array.from(required).sort()};
}

function reviewChangeSet(input={}){
  const files=list(input.changed_files).map(text).filter(Boolean);
  const declared=new Set(list(input.declared_invariants).map(v=>text(v).toLowerCase()).filter(Boolean));
  const tests=list(input.test_evidence).map(text).filter(Boolean);
  const operations=list(input.operations).map(upper).filter(Boolean);
  const req=requiredInvariants(files);
  const missing=req.required.filter(r=>!declared.has(r));
  const reasons=[];

  if(files.length===0) reasons.push('CHANGED_FILES_REQUIRED');
  if(tests.length===0) reasons.push('TEST_EVIDENCE_REQUIRED');
  for(const m of missing) reasons.push(`MISSING_INVARIANT:${m}`);

  const gated=operations.filter(op=>OWNER_GATED_OPERATIONS.has(op));
  if(gated.length && !bool(input.explicit_owner_approval)) reasons.push('OWNER_APPROVAL_REQUIRED');
  if(bool(input.tests_weakened_or_deleted)) reasons.push('TEST_WEAKENING_PROHIBITED');
  if(bool(input.evidence_claim_exceeds_proof)) reasons.push('EVIDENCE_OVERCLAIM');
  if(bool(input.unowned_file_changed)) reasons.push('UNOWNED_FILE_CHANGED');

  let tier='SELF_REVIEW';
  if(req.categories.some(c=>['CONTROL_PLANE','BOOKING_STATE','OUTBOUND_PROVIDER','STATE_MACHINE','THIRD_PARTY_TOOLING'].includes(c))) tier='AUDIT';
  else if(files.some(f=>/\.(js|ts|mjs|cjs|py|sh|ps1)$/i.test(f))) tier='PARENT_VERIFY';

  const unique=Array.from(new Set(reasons));
  return {
    decision:unique.length?'HOLD':'PASS',
    tier,
    categories:req.categories,
    required_invariants:req.required,
    missing_invariants:missing,
    owner_gated_operations:gated,
    reasons:unique
  };
}

module.exports={OWNER_GATED_OPERATIONS,categoriesForPath,requiredInvariants,reviewChangeSet};
