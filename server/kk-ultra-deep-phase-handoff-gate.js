'use strict';

const VERSION='KK_ULTRA_DEEP_PHASE_HANDOFF_GATE_V2';
const ORDER=Object.freeze([
 ['PHASE1','discovery'],
 ['PHASE2','verification_dedup'],
 ['PHASE3','commercial_pricing'],
 ['PHASE4','poster_storefront_reconciliation'],
 ['PHASE5','governed_publish'],
 ['PHASE6','production_readback']
]);
function text(v){return String(v==null?'':v).trim();}
function evaluate(input={}){
 const current=text(input.current_phase).toUpperCase();
 const idx=ORDER.findIndex(x=>x[0]===current);
 const blockers=[];
 if(idx<0)blockers.push('UNKNOWN_CURRENT_PHASE');
 if(input.production_writes!==0 && idx<4)blockers.push('EARLY_PHASE_PRODUCTION_WRITE_PROHIBITED');
 if(input.phase_report_complete!==true)blockers.push('CURRENT_PHASE_REPORT_INCOMPLETE');
 if(input.candidate_pool_complete!==true && ['PHASE1','PHASE2'].includes(current))blockers.push('CANDIDATE_POOL_INCOMPLETE');
 if(input.learning_recovery_complete!==true && ['PHASE1','PHASE2','PHASE3','PHASE4'].includes(current))blockers.push('LEARNING_RECOVERY_INCOMPLETE');
 if(['PHASE2','PHASE3'].includes(current)){
  if(input.phase_artifact_frozen!==true)blockers.push('CURRENT_PHASE_ARTIFACT_NOT_FROZEN');
  if(!text(input.phase_artifact_fingerprint))blockers.push('CURRENT_PHASE_ARTIFACT_FINGERPRINT_REQUIRED');
 }
 if(input.owner_approval===true && input.phase_report_complete!==true)blockers.push('OWNER_APPROVAL_CANNOT_OVERRIDE_INCOMPLETE_REPORT');
 const ready=blockers.length===0;
 const next=idx>=0&&idx<ORDER.length-1?ORDER[idx+1][0]:'COMPLETE';
 return {version:VERSION,current_phase:current,next_phase:next,ready_for_next_phase:ready,blockers,auto_start_next_phase:false,production_writes:Number(input.production_writes||0)};
}
module.exports={VERSION,ORDER,evaluate};
