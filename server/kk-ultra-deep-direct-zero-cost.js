'use strict';

const Runtime=require('./kk-ultra-deep-runtime-runner.js');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Pricing=require('./kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const Production=require('./kk-ultra-deep-production-runtime.js');
const Rentability=require('./kk-ultra-deep-rentability-score.js');

const VERSION='KK_ULTRA_DEEP_DIRECT_ZERO_COST_V24_V2_2';
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

  // V2.2 commercial qualification is a prioritization gate, not a discovery deletion gate.
  // Preserve every discovered row for audit/learning. Booked/full-capacity dates still need
  // official date/venue/poster verification even when new commercial inventory is unavailable.
  const qualified=(discovery.candidates||[]).map(candidate=>{
    const eventDate=String(candidate.event_date||'').slice(0,10);
    const noCapacity=preflight.full_booking_dates.includes(eventDate);
    const q=Rentability.qualify({
      fandom_strength:candidate.fandom_strength,
      social_demand:candidate.social_demand,
      rental_intent:candidate.rental_intent,
      commercial_evidence:candidate.commercial_evidence,
      event_quality:candidate.event_quality,
      sold_out_or_added_round:candidate.sold_out_or_added_round,
      engagement_velocity_high:candidate.engagement_velocity_high,
      competitor_rental_count:candidate.competitor_rental_count,
      strong_fan_project_signal:candidate.strong_fan_project_signal,
      verified_competitor_rental:candidate.verified_competitor_rental,
      strong_commercial_signal:candidate.strong_commercial_signal,
      booking_probability:candidate.booking_probability,
      expected_rental_price:candidate.expected_rental_price,
      available_inventory:noCapacity?0:Math.max(1,Number(preflight.phone_capacity||1))
    },options.rentabilityConfig||{});
    return {...candidate,rentability:q.rentability,revenue_potential:q.revenue,rentability_decision:q.decision,capacity_blocked:noCapacity};
  });
  const verifierCandidates=qualified.filter(c=>['FULL_LOOP','VERIFY_MORE','NO_CAPACITY'].includes(c.rentability_decision));
  const watchCandidates=qualified.filter(c=>c.rentability_decision==='WATCH');
  const verifier=await Verifier.verifyBatch(
    verifierCandidates,
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
  if(!(commercial.ready_count>0)){
    return {version:VERSION,status:'BLOCKED_NO_COMMERCIAL_CANDIDATES',month,preflight,discovery,verifier,competitor_price_scan:priceScan,commercial,production_writes:0};
  }

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
    discovery:{status:discovery.status,candidate_count:discovery.candidate_count,qualified_candidate_count:qualified.length,verifier_candidate_count:verifierCandidates.length,watch_candidate_count:watchCandidates.length,no_capacity_candidate_count:qualified.filter(c=>c.capacity_blocked).length,full:discovery.full},
    rentability:{qualified_count:qualified.length,full_loop_count:qualified.filter(c=>c.rentability_decision==='FULL_LOOP').length,verify_more_count:qualified.filter(c=>c.rentability_decision==='VERIFY_MORE').length,watch_count:watchCandidates.length,no_capacity_count:qualified.filter(c=>c.rentability_decision==='NO_CAPACITY').length},
    verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},
    competitor_price_scan:{evidence_count:priceScan.evidence_count,competitor_universe_count:priceScan.competitor_universe_count},
    commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},
    production,
    production_writes:Number(production.production_writes||0)
  };
}

module.exports={VERSION,run};
