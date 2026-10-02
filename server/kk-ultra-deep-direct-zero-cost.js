'use strict';

const Runtime=require('./kk-ultra-deep-runtime-runner.js');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Pricing=require('./kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const Production=require('./kk-ultra-deep-production-runtime.js');

const VERSION='KK_ULTRA_DEEP_DIRECT_ZERO_COST_V22';
function text(v){return String(v==null?'':v).trim();}

async function run(input={},options={}){
  const month=text(input.month);
  if(!/^\d{4}-\d{2}$/.test(month)){
    const e=new Error('month must be YYYY-MM'); e.code='ULTRA_DEEP_MONTH_INVALID'; throw e;
  }
  const location=text(input.location)||'Bangkok Thailand';
  const env=options.env||process.env;
  const fetchImpl=options.fetchImpl||global.fetch;

  const discovery=await Runtime.runMonthlyUltraDeep(
    {month,location},
    {publicWebOptions:{fetchImpl},providers:options.providers||{}}
  );
  if(discovery.full!==true||discovery.status!=='READY_FOR_VERIFIER'){
    return {version:VERSION,status:'BLOCKED_DISCOVERY_NOT_FULL',month,discovery,production_writes:0};
  }

  const verifier=await Verifier.verifyBatch(
    discovery.candidates||[],
    {month,location},
    {concurrency:4,timeout_ms:9000,fetchImpl}
  );
  if(!(verifier.verified_count>0)){
    return {version:VERSION,status:'BLOCKED_NO_VERIFIED_CANDIDATES',month,discovery,verifier,production_writes:0};
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
    return {version:VERSION,status:'BLOCKED_NO_COMMERCIAL_CANDIDATES',month,discovery,verifier,competitor_price_scan:priceScan,commercial,production_writes:0};
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
    discovery:{status:discovery.status,candidate_count:discovery.candidate_count,full:discovery.full},
    verifier:{verified_count:verifier.verified_count,hold_count:verifier.hold_count},
    competitor_price_scan:{evidence_count:priceScan.evidence_count,competitor_universe_count:priceScan.competitor_universe_count},
    commercial:{ready_count:commercial.ready_count,hold_count:commercial.hold_count},
    production,
    production_writes:Number(production.production_writes||0)
  };
}

module.exports={VERSION,run};
