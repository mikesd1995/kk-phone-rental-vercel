'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');

function text(v){return String(v==null?'':v).trim();}
function argValue(argv,name){
 const i=argv.indexOf(name);
 return i>=0?text(argv[i+1]):'';
}
function redactCandidate(c={}){
 return {
   title:text(c.title)||null,
   event_date:text(c.event_date)||null,
   venue:text(c.venue)||null,
   source_url:text(c.source_url)||null
 };
}
async function main(){
 const argv=process.argv.slice(2);
 const month=argValue(argv,'--month')||'2026-10';
 const location=argValue(argv,'--location')||'Bangkok Thailand';
 const output=argValue(argv,'--output')||'ultra-deep-runtime-acceptance.json';
 const started_at=new Date().toISOString();
 const result=await Runner.runMonthlyUltraDeep({month,location});
 const evidence={
   schema:'KK_ULTRA_DEEP_RUNTIME_ACCEPTANCE_V1',
   started_at,
   finished_at:new Date().toISOString(),
   month:result.month,
   location:result.location,
   status:result.status,
   full:result.full===true,
   blockers:result.blockers||[],
   provider_binding:result.provider_binding,
   discovery_proof:result.discovery_proof,
   source_universe:{
     complete:result.source_universe&&result.source_universe.complete===true,
     required_source_count:result.source_universe&&result.source_universe.required_source_count,
     passed_required_source_count:result.source_universe&&result.source_universe.passed_required_source_count,
     missing_required_sources:result.source_universe&&result.source_universe.missing_required_sources||[],
     by_tier:result.source_universe&&result.source_universe.by_tier||{}
   },
   reference_sweep_proof:result.reference_sweep_proof,
   reconciliation:{
     complete:result.reconciliation&&result.reconciliation.complete===true,
     reconciliation_gap_count:result.reconciliation&&result.reconciliation.reconciliation_gap_count,
     reference_count:result.reconciliation&&result.reconciliation.reference_count,
     matched_count:result.reconciliation&&result.reconciliation.matched_count,
     structured_reference_count:result.reconciliation&&result.reconciliation.structured_reference_count,
     excluded_reference_count:result.reconciliation&&result.reconciliation.excluded_reference_count,
     missing_candidates:(result.reconciliation&&result.reconciliation.missing_candidates||[]).slice(0,50)
   },
   known_miss_regression:result.known_miss_regression,
   known_miss_live_recall:result.known_miss_live_recall,
   candidate_count:result.candidate_count,
   reference_candidate_count:result.reference_candidate_count,
   eligible_reference_candidate_count:result.eligible_reference_candidate_count,
   reference_scope_exclusions:result.reference_scope_exclusions||{},
   canonical_reference_alignment_count:result.canonical_reference_alignment_count||0,
   candidates:(result.candidates||[]).map(redactCandidate),
   execution_summary:result.execution_summary,
   authoritative:false,
   verifier_required:true,
   production_writes:0,
   final_truth_mutation:false
 };
 fs.writeFileSync(path.resolve(output),JSON.stringify(evidence,null,2)+'\n','utf8');
 process.stdout.write(JSON.stringify({
   status:evidence.status,
   full:evidence.full,
   blockers:evidence.blockers,
   provider_binding:evidence.provider_binding,
   discovery_complete:evidence.discovery_proof&&evidence.discovery_proof.complete,
   source_universe_complete:evidence.source_universe.complete,
   reference_sweep_complete:evidence.reference_sweep_proof&&evidence.reference_sweep_proof.complete,
   reconciliation_gap_count:evidence.reconciliation.reconciliation_gap_count,
   known_miss_complete:evidence.known_miss_regression&&evidence.known_miss_regression.complete,
   known_miss_live_passed:evidence.known_miss_live_recall&&evidence.known_miss_live_recall.passed,
   candidate_count:evidence.candidate_count,
   reference_candidate_count:evidence.reference_candidate_count,
   eligible_reference_candidate_count:evidence.eligible_reference_candidate_count,
   reference_scope_exclusions:evidence.reference_scope_exclusions,
   canonical_reference_alignment_count:evidence.canonical_reference_alignment_count,
   production_writes:0
 },null,2)+'\n');
 if(!evidence.full) process.exitCode=2;
}
main().catch(err=>{
 process.stderr.write(JSON.stringify({ok:false,error_code:text(err&&err.code)||text(err&&err.name)||'ULTRA_DEEP_RUNTIME_ACCEPTANCE_FAILED',message:text(err&&err.message).slice(0,300),production_writes:0},null,2)+'\n');
 process.exit(1);
});
