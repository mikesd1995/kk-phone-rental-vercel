'use strict';

const C=require('../contracts');
const {collectSnapshot}=require('./sheets-collector');
const {collectPublic}=require('./public-collector');
const {runPilot}=require('./local-pilot');
const {runAdvisory}=require('./advisory-journal');

// The trusted local host owns credentials, reader functions, directories and authority.
// There is no scheduler, production writer or notification interface in this cycle.
async function runReadOnlyCycle({reader,familyId,eventIds,expectedPolicyVersion,occurrenceId,stateDirectory,
  advisoryStateDirectory,provider,authorize,fetchImpl,clock=()=>new Date().toISOString()}={}) {
  C.id(occurrenceId);const started=clock();C.utc(started);
  const collection=await collectSnapshot({reader,familyId,eventIds,expectedPolicyVersion,now:started});
  const publicObservation=await collectPublic({eventIds,now:clock,fetchImpl});
  let pilot=null;let advisory={status:'DISABLED',provider_calls_this_invocation:0};
  if(collection.status==='BLOCKED') advisory={status:'POLICY_BLOCKED',provider_calls_this_invocation:0};
  else {
    pilot=runPilot({stateDirectory,snapshot:collection.snapshot,occurrenceId,expectedPolicyVersion,now:clock()});
    if(provider) advisory=await runAdvisory({stateDirectory:advisoryStateDirectory,occurrenceId,report:pilot.report,provider,authorize,clock});
  }
  return {version:'kk-readonly-connected-cycle-v1',started_at:started,completed_at:clock(),
    status:collection.status==='BLOCKED'?'POLICY_BLOCKED':'OBSERVATION_RECORDED',
    collection,pilot,public_observation:publicObservation,advisory,production_writes:0,notification_sends:0,
    execution_authorized:false,full_system_verified:false,
    limitations:['BOUNDED_SELECTED_SCOPE','MONTHLY_STABLE_IDENTITY_NOT_COLLECTED','NO_RENTAL_LIFECYCLE_ACCEPTANCE','NO_BACKGROUND_RUNNER']};
}
module.exports={runReadOnlyCycle};
