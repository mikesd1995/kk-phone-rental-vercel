'use strict';

// Local evidence checklist only. No Google client, credentials, network, or ACL
// mutation. A completed checklist is never runtime acceptance or authority.
const {RANGE_SPECS}=require('../server/core-private-range-contract.js');
const CORE_WORKBOOK='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const CONSUMERS=Object.freeze([
  'storefront_event_share','storefront_packages','admin_snapshot','admin_guards',
  'rental_dashboard','intelligence_read_helpers','canonical_quote_gate'
]);
const TYPES=new Set(['user','group','domain','anyone']);
const ROLES=new Set(['owner','organizer','fileOrganizer','writer','commenter','reader']);
function requiredPairs(){return RANGE_SPECS.map(({sheet,range})=>({sheet,range}));}
function pairKey(p){return JSON.stringify([p&&p.sheet,p&&p.range]);}
function sha(s){return typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);}
function reference(s){return typeof s==='string'&&s.trim().length>0;}
function permissions(list){
  if(!Array.isArray(list)||!list.length||list.length>1000)return null;
  const result=[];
  for(const p of list){
    if(!p||!TYPES.has(p.type)||!ROLES.has(p.role))return null;
    const safe={type:p.type,role:p.role};
    if(p.type==='anyone'){
      if(typeof p.allowFileDiscovery!=='boolean')return null;
      safe.allowFileDiscovery=p.allowFileDiscovery;
    }
    result.push(safe);
  }
  return result.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function evaluate(input={},options={}){
  const p=input&&typeof input==='object'?input:{};
  const blockers=[];
  const bound=Number.isInteger(options.maxAgeSeconds)&&options.maxAgeSeconds>0&&options.maxAgeSeconds<=3600;
  const now=typeof options.now==='string'?Date.parse(options.now):NaN;
  function fresh(at){const t=typeof at==='string'?Date.parse(at):NaN;return bound&&Number.isFinite(now)&&Number.isFinite(t)&&t<=now&&now-t<=options.maxAgeSeconds*1000;}
  if(!bound||!Number.isFinite(now))blockers.push('FRESHNESS_BOUND_REQUIRED');
  if(p.target!==CORE_WORKBOOK)blockers.push('CORE_TARGET_MISMATCH');
  const sourceValid=sha(p.candidateSha);
  if(!sourceValid)blockers.push('CANDIDATE_SOURCE_MISSING');
  const d=p.deployment||{};
  if(!sourceValid||d.sourceSha!==p.candidateSha||!fresh(d.observedAtUTC)||!reference(d.readbackRef))blockers.push('DEPLOYMENT_BINDING_MISSING');
  const acl=p.permissions||{};
  if(acl.complete!==true||acl.publishedViewExcluded!==true||!fresh(acl.observedAtUTC))blockers.push('PERMISSION_SNAPSHOT_INCOMPLETE_OR_STALE');
  const actual=permissions(acl.actual),expected=permissions(acl.expected);
  if(!actual||!expected||JSON.stringify(actual)!==JSON.stringify(expected))blockers.push('PERMISSION_STATE_DRIFT');
  // Type/role counts cannot detect replacing a private grantee with another.
  // Digest must be produced/reviewed in the owner's secure just-in-time ACL
  // context over exact sorted permission identities, roles and inheritance.
  // This helper does not obtain or authenticate that evidence and never prints it.
  if(typeof acl.actualDigest!=='string'||!/^[a-f0-9]{64}$/.test(acl.actualDigest)||acl.actualDigest!==acl.expectedDigest)
    blockers.push('EXACT_PERMISSION_DIGEST_MISSING_OR_CHANGED');
  const publicGrants=actual&&actual.filter(x=>x.type==='anyone');
  const safeScope=actual&&publicGrants.length===1&&publicGrants[0].role==='reader'&&
    actual.some(x=>x.type==='user'&&x.role==='owner')&&!actual.some(x=>x.type==='domain');
  if(!safeScope)blockers.push('ACL_REMOVAL_SCOPE_UNSAFE');
  const reads=p.privateReads||{},results=Array.isArray(reads.results)?reads.results:[];
  const expectedPairs=new Set(requiredPairs().map(pairKey));
  const received=new Set(results.map(pairKey));
  if(!sourceValid||reads.sourceSha!==p.candidateSha||!fresh(reads.observedAtUTC)||reads.authenticated!==true||reads.publicFallback!==false||
    results.length!==expectedPairs.size||received.size!==expectedPairs.size||
    results.some(r=>!expectedPairs.has(pairKey(r))||r.status!=='VERIFIED'||!reference(r.evidenceRef)))blockers.push('PRIVATE_RANGE_ACCEPTANCE_INCOMPLETE');
  if(CONSUMERS.some(key=>{
    const c=p.consumers&&p.consumers[key];
    return !c||c.status!=='VERIFIED'||!sourceValid||c.sourceSha!==p.candidateSha||!fresh(c.observedAtUTC)||!reference(c.evidenceRef);
  }))blockers.push('CONSUMER_ACCEPTANCE_INCOMPLETE');
  const policy=p.policy||{};
  if(policy.compatibleActive!==true||!fresh(policy.observedAtUTC)||!reference(policy.evidenceRef))blockers.push('ACTIVE_POLICY_READBACK_MISSING');
  const binding=p.ownerCredentialBinding||{};
  if(binding.status!=='VERIFIED'||!sourceValid||binding.sourceSha!==p.candidateSha||!fresh(binding.observedAtUTC)||!reference(binding.evidenceRef))blockers.push('OWNER_BINDING_MISSING');
  if(!p.rollback||p.rollback.failClosed!==true||p.rollback.restorePublicAccess!==false)blockers.push('ROLLBACK_MUST_REMAIN_PRIVATE');
  const complete=blockers.length===0;
  return {
    schema_version:'CORE_PRIVATE_ACL_PREPARATION_V1',
    status:complete?'CHECKLIST_COMPLETE_REQUIRES_LIVE_REVIEW':'PREPARATION_HAS_GAPS',
    blockers,required_range_pairs:expectedPairs.size,required_consumers:CONSUMERS.length,
    execution_authorized:false,cutover_ready:false,runtime_verified:false,
    native_c1_dependency:false,evidence_authenticity:'NOT_ESTABLISHED_BY_OFFLINE_CHECKLIST',
    proposed_operations:complete?[{action:'REMOVE_EXACT_ANYONE_READER_AFTER_FRESH_ID_READ',count:1}]:[],
    expected_after:complete?actual.filter(x=>x.type!=='anyone'):[],
    permission_writes:0,data_writes:0,network_calls:0,
    rollback:'FAIL_CLOSED_KEEP_PRIVATE_NO_PUBLIC_REOPEN',
    exact_readback_required:true
  };
}
if(require.main===module){
  // Deliberately no --execute or provider flags. CLI is a blocked empty template.
  const result=evaluate();process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=2;
}
module.exports={CORE_WORKBOOK,CONSUMERS,requiredPairs,evaluate};
