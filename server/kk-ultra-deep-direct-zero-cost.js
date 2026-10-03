'use strict';

const Runtime=require('./kk-ultra-deep-runtime-runner.js');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Pricing=require('./kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const Production=require('./kk-ultra-deep-production-runtime.js');
const V2Adapter=require('./kk-ultra-deep-v2-runtime-adapter.js');

const VERSION='KK_ULTRA_DEEP_DIRECT_ZERO_COST_V24';
function text(v){return String(v==null?'':v).trim();}

async function run(input={},options={}){
  const month=text(input.month);
  if(!/^\d{4}-\d{2}$/.test(month)){
    const e=new Error('month must be YYYY-MM'); e.code='ULTRA_DEEP_MONTH_INVALID'; throw e;
  }
  const location=text(input.location)||'Bangkok Metropolitan Region Thailand';
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

  const discovery=await Runtime.runMonthlyUltraDeep(
    {month,location},
    {publicWebOptions:{fetchImpl},providers:options.providers||{}}
  );
  if(discovery.full!==true||discovery.status!=='READY_FOR_VERIFIER'){
    return {version:VERSION,status:'BLOCKED_DISCOVERY_NOT_FULL',month,preflight,discovery,production_writes:0};
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
  const commercial=Commercial.prepareBatch({
    candidates:verifier.verified_candidates,
    competitor_prices:priceScan.evidence,
    posters:verifier.posters
  });
  if(!(commercial.ready_count>0)&&options.executeWrites===true){
    return {version:VERSION,status:'BLOCKED_NO_COMMERCIAL_CANDIDATES',month,preflight,discovery,verifier,competitor_price_scan:priceScan,commercial,production_writes:0};
  }

  const v2_read_only=V2Adapter.buildReadOnlyPlan({month,candidates:verifier.verified_candidates,snapshot:preflightSnapshot,commercial});
  if(options.executeWrites!==true){
    return {
      version:VERSION,status:v2_read_only.status==='READY'?'V2_READ_ONLY_READY':'V2_READ_ONLY_HOLD',month,mode:'READ_ONLY_ACCEPTANCE',
      preflight,discovery:{status:discovery.status,candidate_count:discovery.candidate_count,eligible_candidate_count:eligibleCandidates.length,full:discovery.full},
      verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},
      competitor_price_scan:{evidence_count:priceScan.evidence_count,competitor_universe_count:priceScan.competitor_universe_count},
      commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},v2_read_only,production_writes:0
    };
  }
  return {version:VERSION,status:'BLOCKED_V2_COMMIT_NOT_WIRED',month,mode:'COMMIT',preflight,discovery:{status:discovery.status,candidate_count:discovery.candidate_count,full:discovery.full},verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},competitor_price_scan:{evidence_count:priceScan.evidence_count},commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},v2_read_only,blockers:['V2_GOVERNED_WRITER_MAPPING_REQUIRED'],production_writes:0};

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

module.exports={VERSION,run};
