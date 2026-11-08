'use strict';

const Runtime=require('./kk-ultra-deep-runtime-runner.js');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Pricing=require('./kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const Production=require('./kk-ultra-deep-production-runtime.js');
const V2Adapter=require('./kk-ultra-deep-v2-runtime-adapter.js');
const V2Writer=require('./kk-ultra-deep-v2-governed-writer.js');
const Executor=require('./kk-governed-storefront-executor.js');
const Promotion=require('./kk-verifier-storefront-promotion.js');

const VERSION='KK_ULTRA_DEEP_DIRECT_ZERO_COST_V26';
function text(v){return String(v==null?'':v).trim();}
function validCount(value){return Number.isSafeInteger(value)&&value>=0;}
function validFootprint(value){
  return !!value&&['production_writes','verified_writes','attempted_writes','unknown_write_outcomes'].every(key=>validCount(value[key]))&&
    value.verified_writes<=value.production_writes&&value.production_writes+value.unknown_write_outcomes===value.attempted_writes;
}
function writeFootprint(value,attemptedFallback=0){
  const row=value||{};
  const production_writes=validCount(row.production_writes)?row.production_writes:0;
  const attempted_writes=Math.max(production_writes,validCount(row.attempted_writes)?row.attempted_writes:attemptedFallback);
  const verified_writes=validCount(row.verified_writes)&&row.verified_writes<=production_writes?row.verified_writes:0;
  const unknown_write_outcomes=attempted_writes-production_writes;
  return {production_writes,verified_writes,attempted_writes,unknown_write_outcomes};
}
function validCreateReceipt(receipt,mutation){
  const verification=receipt&&receipt.verification,created=receipt&&receipt.create_result;
  if(!(receipt&&receipt.schema_version===Executor.VERSION&&receipt.status==='STOREFRONT_PROMOTION_VERIFIED'&&receipt.publishes===1&&receipt.readback_verified===true&&
    verification&&verification.schema_version===Promotion.VERSION&&verification.status==='STOREFRONT_PROMOTION_VERIFIED'&&verification.verified===true&&
    Array.isArray(verification.blockers)&&verification.blockers.length===0&&typeof verification.event_id==='string'&&text(verification.event_id)&&
    verification.pricing_status===text(mutation.price_basis)&&verification.needs_price_recheck===false&&created&&created.ok===true))return false;
  // Existing admin results may expose identity directly, under result, or under
  // data. Some provide only ok:true; the exact verification identity is required
  // in every case, and any supplied create identity must agree with it.
  const identities=[created.event_id,created.result&&created.result.event_id,created.data&&created.data.event_id].filter(value=>value!==undefined&&value!==null);
  return identities.every(value=>typeof value==='string'&&text(value)===text(verification.event_id));
}

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
  let v2_write;
  try{v2_write=await V2Writer.execute(updatePlan,{executeWrites:true,env,fetchImpl});}
  catch(err){v2_write={status:'INCOMPLETE',...writeFootprint(err&&err.write_footprint,1),receipts:[],blockers:['V2_UPDATE_EXECUTION_FAILED']};}
  const totals=writeFootprint(v2_write,updatePlan.mutations.length?1:0);
  const byKey=new Map((v2_read_only.plan.decisions||[]).map(x=>[text(x.event_key),x]));
  const updateReceipts=v2_write&&Array.isArray(v2_write.receipts)?v2_write.receipts:[];
  let exact=!!v2_write&&v2_write.status==='COMPLETE'&&validFootprint(v2_write)&&
    totals.production_writes===updatePlan.mutations.length&&totals.verified_writes===updatePlan.mutations.length&&
    totals.attempted_writes===updatePlan.mutations.length&&totals.unknown_write_outcomes===0&&
    updateReceipts.length===updatePlan.mutations.length&&updateReceipts.every((receipt,index)=>{
      const mutation=updatePlan.mutations[index];
      return receipt&&receipt.ok===true&&receipt.event_key===text(mutation.event_key)&&receipt.type===mutation.type&&
        receipt.readback&&receipt.readback.event&&Array.isArray(receipt.readback.packages)&&
        V2Writer.exactMatch({mutation,admin:V2Writer.mapMutation(mutation,byKey.get(text(mutation.event_key)))},receipt.readback);
    });
  const createReceipts=[];
  const creates=(v2_read_only.plan.mutations||[]).filter(x=>x.type==='CREATE_EVENT');
  for(const m of exact?creates:[]){
    const decision=byKey.get(text(m.event_key));
    let receipt;
    try{receipt=await V2Writer.executeCreate(decision,m,{env,fetchImpl,packageTemplates:preflightSnapshot.packages||[],correlationId:text(input.correlation_id)});}
    catch(err){receipt={...writeFootprint(err&&err.write_footprint,1),readback_verified:false,error_code:err&&err.code==='PROMOTION_READBACK_FAILED'?'PROMOTION_READBACK_FAILED':'V2_CREATE_EXECUTION_FAILED'};}
    const footprint=writeFootprint(receipt,1);
    for(const key of Object.keys(totals))totals[key]+=footprint[key];
    createReceipts.push({event_key:text(m.event_key),receipt});
    if(!(validFootprint(receipt)&&validCreateReceipt(receipt,m)&&
      footprint.production_writes===1&&footprint.verified_writes===1&&footprint.attempted_writes===1&&footprint.unknown_write_outcomes===0)){
      exact=false;break;
    }
  }
  exact=exact&&createReceipts.length===creates.length;
  const totalWrites=totals.production_writes;
  const combined={status:exact?'COMPLETE':'INCOMPLETE',...totals,receipts:updateReceipts,create_receipts:createReceipts};
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

module.exports={VERSION,run};
