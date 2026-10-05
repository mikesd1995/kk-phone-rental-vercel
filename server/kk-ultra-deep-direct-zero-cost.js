'use strict';

const Runtime=require('./kk-ultra-deep-runtime-runner.js');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Pricing=require('./kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const Production=require('./kk-ultra-deep-production-runtime.js');
const V2Adapter=require('./kk-ultra-deep-v2-runtime-adapter.js');
const V2Writer=require('./kk-ultra-deep-v2-governed-writer.js');
const Phase2Runtime=require('./kk-ultra-deep-phase2-runtime.js');
const PhaseArtifact=require('./kk-ultra-deep-phase-artifact.js');

const VERSION='KK_ULTRA_DEEP_DIRECT_ZERO_COST_V27';
function text(v){return String(v==null?'':v).trim();}

async function runPhase2Only(input={},options={}){
  const month=text(input.month||input.phase1_artifact&&input.phase1_artifact.month);
  if(!/^\d{4}-\d{2}$/.test(month)){
    const e=new Error('month must be YYYY-MM');e.code='ULTRA_DEEP_MONTH_INVALID';throw e;
  }
  if(options.executeWrites===true){
    const e=new Error('Phase 2 is read-only');e.code='PHASE2_PRODUCTION_WRITES_PROHIBITED';throw e;
  }
  const location=text(input.location)||'Bangkok Metropolitan Region Thailand';
  const fetchImpl=options.fetchImpl||global.fetch;
  let artifact=input.phase1_artifact||null;
  let discovery=null;
  if(artifact){
    const checked=PhaseArtifact.validateForPhase2(artifact);
    if(!checked.pass){
      return {version:VERSION,status:'PHASE2_HOLD',mode:'PHASE2_READ_ONLY',month,phase1_artifact:{valid:false,blockers:checked.blockers,fingerprint:checked.fingerprint},ready_for_phase3:false,production_writes:0,phase3_started:false};
    }
  }else{
    const discoveryFn=typeof options.discoveryFn==='function'
      ? options.discoveryFn
      : (payload=>Runtime.runMonthlyUltraDeep(payload,{publicWebOptions:{fetchImpl},providers:options.providers||{}}));
    discovery=await discoveryFn({month,location});
    if(!(discovery&&discovery.full===true&&discovery.status==='READY_FOR_VERIFIER')){
      return {version:VERSION,status:'PHASE2_HOLD',mode:'PHASE2_READ_ONLY',month,discovery,blockers:['PHASE1_POOL_RECONSTRUCTION_NOT_ACCEPTED'],ready_for_phase3:false,production_writes:0,phase3_started:false};
    }
    artifact=PhaseArtifact.freezePhase1({
      phase:'PHASE1',status:'PHASE1_ACCEPTED',month,
      accepted_at:text(discovery.finished_at||discovery.created_at),
      candidates:discovery.candidates||[],production_writes:0
    });
    if(!artifact.frozen){
      return {version:VERSION,status:'PHASE2_HOLD',mode:'PHASE2_READ_ONLY',month,discovery:{status:discovery.status,full:discovery.full,candidate_count:discovery.candidate_count},phase1_artifact:artifact,blockers:artifact.blockers.map(x=>'PHASE1_ARTIFACT:'+x),ready_for_phase3:false,production_writes:0,phase3_started:false};
    }
  }
  const phase2Fn=typeof options.phase2RunFn==='function'?options.phase2RunFn:Phase2Runtime.run;
  const phase2=await phase2Fn({
    phase1_artifact:artifact,month,location,max_rounds:Number(input.max_rounds||3)
  },{
    fetchFn:fetchImpl,fetchImpl,
    providers:options.providers||{},
    concurrency:Number(options.phase2Concurrency||4)
  });
  return {
    version:VERSION,
    status:phase2.status,
    mode:'PHASE2_READ_ONLY',
    month,
    discovery:discovery?{status:discovery.status,full:discovery.full===true,candidate_count:discovery.candidate_count}:null,
    phase1_artifact:artifact,
    phase2,
    ready_for_phase3:phase2.status==='PHASE2_ACCEPTED'&&phase2.ready_for_phase3===true,
    production_writes:0,
    phase3_started:false
  };
}

async function run(input={},options={}){
  const month=text(input.month);
  if(!/^\d{4}-\d{2}$/.test(month)){
    const e=new Error('month must be YYYY-MM'); e.code='ULTRA_DEEP_MONTH_INVALID'; throw e;
  }
  const location=text(input.location)||'Bangkok Metropolitan Region Thailand';
  const phase=text(input.phase||options.phase).toUpperCase();
  if(phase==='PHASE2'||options.stopAfterPhase2===true) return runPhase2Only({...input,month,location},options);
  const env=options.env||process.env;
  const fetchImpl=options.fetchImpl||global.fetch;
  const preflightSnapshot=await Production.freshSnapshot(env,fetchImpl);
  const preflight={
    snapshot_source:text(preflightSnapshot.snapshot_source),
    snapshot_generated_at:text(preflightSnapshot.generated_at),
    storefront_event_count:(preflightSnapshot.web_ready||[]).length,
    existing_event_count:(preflightSnapshot.events||[]).length,
    active_booking_dates:[...Production.activeBookingDateSet(preflightSnapshot)],
    full_booking_dates:[...Production.fullBookingDateSet(preflightSnapshot)],
    phone_capacity:Production.phoneInventoryCapacity(preflightSnapshot),
    production_writes:0
  };

  const operational=options.operational===true;
  const discovery=operational
    ? await Runtime.runOperationalDiscovery(
        {month,location},
        {publicWebOptions:{fetchImpl},providers:options.providers||{}}
      )
    : await Runtime.runMonthlyUltraDeep(
        {month,location},
        {publicWebOptions:{fetchImpl},providers:options.providers||{}}
      );
  const discoveryReady=operational
    ? discovery.operational_ready===true&&discovery.status==='READY_FOR_VERIFIER'
    : discovery.full===true&&discovery.status==='READY_FOR_VERIFIER';
  if(!discoveryReady){
    return {
      version:VERSION,
      status:operational?'BLOCKED_OPERATIONAL_DISCOVERY':'BLOCKED_DISCOVERY_NOT_FULL',
      month,mode:operational?'SMART_OPERATIONAL':'ULTRA_DEEP_AUDIT',
      preflight,discovery,production_writes:0
    };
  }

  // Do not delete full-booked-date candidates: existing booked events still require verified metadata maintenance.
  // V2Adapter applies capacity to new commercial candidates after canonical matching.
  const eligibleCandidates=(discovery.candidates||[]);
  const verifier=await Verifier.verifyBatch(
    eligibleCandidates,
    {month,location},
    {concurrency:4,timeout_ms:9000,fetchImpl}
  );
  if(!(verifier.verified_count>0)){
    return {version:VERSION,status:'BLOCKED_NO_VERIFIED_CANDIDATES',month,preflight,discovery,verifier,production_writes:0};
  }

  const priceScan=await Pricing.scanBatch(
    verifier.verified_candidates,
    {concurrency:3,max_results:20,fetchImpl}
  );
  const baselinePrices=(preflightSnapshot.packages||[])
    .filter(p=>text(p.package_type).toLowerCase()==='phone_only'&&Number(p.standard_price)>0)
    .map(p=>({
      reference_id:text(p.template_id||p.package_id)||'KK_PHONE_BASELINE',
      package_type:'PHONE_ONLY',
      price:Number(p.standard_price),
      reference_kind:'KK_APPROVED_BASELINE',
      approved:true
    }));
  const commercial=Commercial.prepareBatch({
    candidates:verifier.verified_candidates,
    competitor_prices:priceScan.evidence,
    posters:verifier.posters,
    store_baseline_prices:baselinePrices
  });
  if(!(commercial.ready_count>0)&&options.executeWrites===true){
    return {version:VERSION,status:'BLOCKED_NO_COMMERCIAL_CANDIDATES',month,preflight,discovery,verifier,competitor_price_scan:priceScan,commercial,production_writes:0};
  }

  const v2_read_only=V2Adapter.buildReadOnlyPlan({month,candidates:verifier.verified_candidates,snapshot:preflightSnapshot,commercial});
  if(options.executeWrites!==true){
    return {
      version:VERSION,status:v2_read_only.status==='READY'?'V2_READ_ONLY_READY':'V2_READ_ONLY_HOLD',month,mode:operational?'SMART_OPERATIONAL_READ_ONLY':'READ_ONLY_ACCEPTANCE',
      preflight,discovery:{status:discovery.status,candidate_count:discovery.candidate_count,eligible_candidate_count:eligibleCandidates.length,full:discovery.full===true,operational_ready:discovery.operational_ready===true,audit_required:discovery.audit_required===true,audit_blocking:discovery.audit_blocking===true},
      verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},
      competitor_price_scan:{evidence_count:priceScan.evidence_count,competitor_universe_count:priceScan.competitor_universe_count},
      commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},v2_read_only,production_writes:0
    };
  }
  if(v2_read_only.status!=='READY'){
    return {version:VERSION,status:'BLOCKED_V2_PLAN_HOLD',month,mode:operational?'SMART_OPERATIONAL_COMMIT':'COMMIT',preflight,v2_read_only,blockers:['V2_PLAN_NOT_READY'],production_writes:0};
  }
  const updatePlan={...v2_read_only.plan,mutations:(v2_read_only.plan.mutations||[]).filter(m=>m.type!=='CREATE_EVENT')};
  const v2_write=await V2Writer.execute(updatePlan,{executeWrites:true,env,fetchImpl});
  const byKey=new Map((v2_read_only.plan.decisions||[]).map(x=>[text(x.event_key),x]));
  const createReceipts=[];let createWrites=0;
  for(const m of (v2_read_only.plan.mutations||[]).filter(x=>x.type==='CREATE_EVENT')){
    const decision=byKey.get(text(m.event_key));
    const receipt=await V2Writer.executeCreate(decision,m,{env,fetchImpl,packageTemplates:preflightSnapshot.packages||[],correlationId:text(input.correlation_id)});
    createReceipts.push({event_key:text(m.event_key),receipt});if(receipt&&receipt.readback_verified===true)createWrites++;
  }
  const totalWrites=Number(v2_write.production_writes||0)+createWrites;
  const exact=(v2_write.status==='COMPLETE'&&(v2_write.receipts||[]).every(x=>x.ok===true)&&createReceipts.every(x=>x.receipt&&x.receipt.readback_verified===true));
  const combined={status:exact?'COMPLETE':'INCOMPLETE',production_writes:totalWrites,receipts:v2_write.receipts||[],create_receipts:createReceipts};
  const v2_acceptance=require('./kk-ultra-deep-full-loop-v2.js').acceptance(v2_read_only.plan,combined,{exact_match:exact});
  return {version:VERSION,status:v2_acceptance.status==='COMPLETE'?'COMPLETE':'V2_COMMIT_INCOMPLETE',month,mode:operational?'SMART_OPERATIONAL_COMMIT':'COMMIT',preflight,v2_read_only,v2_write:combined,v2_acceptance,production_writes:totalWrites};

  /* Legacy handoff retained below as unreachable reference until V2 writer mapping is accepted. */
  const handoff={
    schema:'KK_ULTRA_DEEP_COMMERCIAL_HANDOFF_V1',
    created_at:new Date().toISOString(),
    month,
    discovery:{full:discovery.full,status:discovery.status,candidate_count:discovery.candidate_count,blockers:discovery.blockers||[]},
    verifier,
    competitor_price_scan:priceScan,
    competitor_prices:priceScan.evidence,
    posters:verifier.posters,
    commercial,
    production_writes:0
  };
  const production=await Production.execute(handoff,{
    executeWrites:options.executeWrites===true,
    env,fetchImpl,
    correlation_id:text(options.correlation_id)||('direct-'+Date.now())
  });
  return {
    version:VERSION,
    status:production.status==='COMPLETE'?'COMPLETE':production.status,
    month,
    mode:options.executeWrites===true?'COMMIT':'READ_ONLY_ACCEPTANCE',
    preflight,
    discovery:{status:discovery.status,candidate_count:discovery.candidate_count,eligible_candidate_count:eligibleCandidates.length,full:discovery.full},
    verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},
    competitor_price_scan:{evidence_count:priceScan.evidence_count,competitor_universe_count:priceScan.competitor_universe_count},
    commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},
    production,
    production_writes:Number(production.production_writes||0)
  };
}

module.exports={VERSION,runPhase2Only,run};
