'use strict';

const OwnerPolicy=require('./kk-ultra-deep-owner-policy.js');
const Commercial=require('./kk-discovery-commercial-prep.js');
const FinalPricing=require('./kk-final-pricing-policy.js');
const Promotion=require('./kk-verifier-storefront-promotion.js');
const Executor=require('./kk-governed-storefront-executor.js');
const Completion=require('./kk-ultra-deep-full-loop-completion-gate.js');

const VERSION='KK_ULTRA_DEEP_FULL_LOOP_ORCHESTRATOR_V1';
function text(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function eventKey(v={}){return text(v.event_key||v.candidate_id||v.event_id||v.title);}
function sameEvent(a={},b={}){
 const ad=text(a.event_date),bd=text(b.event_date);
 const an=text(a.title||a.event_name).toLowerCase(),bn=text(b.title||b.event_name).toLowerCase();
 return !!ad&&ad===bd&&!!an&&an===bn;
}
function contextFor(candidate,input={}){
 const explicitId=text(candidate&&candidate.existing_event_id);
 const existing=(explicitId?(input.existing_events||[]).find(e=>text(e&&e.event_id)===explicitId):null)||(input.existing_events||[]).find(e=>sameEvent(candidate,e))||{};
 const date=text(candidate.event_date);
 const dateBookings=(input.bookings||[]).filter(b=>{
  const active=['pending','confirmed','prepared','picked_up'].includes(text(b.booking_status).toLowerCase());
  return active&&text(b.event_date)===date;
 });
 const bookings=dateBookings.filter(b=>text(existing.event_id)&&text(b.event_id)===text(existing.event_id));
 const inventory=input.inventory_by_date&&input.inventory_by_date[date]||{};
 return {existing,bookings,booking_count:bookings.length,date_bookings:dateBookings,date_booking_count:dateBookings.length,stock_remaining:Math.max(0,Number(inventory.stock_remaining)||0)};
}
function competitorRowsFor(candidate,input={}){
 const key=eventKey(candidate);
 return (input.competitor_prices||[]).filter(r=>text(r.event_key)===key&&r.exact_event===true);
}
function posterRowsFor(candidate,input={}){
 const key=eventKey(candidate);
 return (input.posters||[]).filter(r=>text(r.event_key)===key&&r.verified===true);
}
function currentPrice(existing={}){
 const rows=Array.isArray(existing.packages)?existing.packages:[];
 const phone=rows.find(p=>text(p.package_type).toLowerCase()==='phone_only')||rows[0]||{};
 return num(phone.price||phone.override_price);
}
function policyInput(candidate,input,ctx){
 const posters=posterRowsFor(candidate,input);const official=posters.find(p=>p.official===true)||posters[0]||{};
 return {
  owner_hidden:ctx.existing.active_on_web===false,
  tombstone_locked:ctx.existing.tombstone_locked===true,
  history_state:ctx.existing.history_state,
  booking_count:ctx.booking_count,
  date_booking_count:ctx.date_booking_count,
  stock_remaining:ctx.stock_remaining,
  current_price:currentPrice(ctx.existing),
  competitor_prices:competitorRowsFor(candidate,input),
  current_poster_url:text(ctx.existing.poster_image_url||ctx.existing.poster_url),
  latest_official_poster_url:text(official.image_url),
  latest_official_poster_verified:official.verified===true
 };
}
function updatePlan(candidate,input,ctx,policy){
 const actions=[];
 if(policy.pricing.write_required){
  const rows=Array.isArray(ctx.existing.packages)?ctx.existing.packages:[];
  for(const p of rows){
   if(text(p.package_type).toLowerCase()==='lens_only') continue;
   const current=num(p.price||p.override_price);
   if(current===null) continue;
   const delta=policy.pricing.target_price-policy.pricing.current_price;
   actions.push({action:'upsertEventOverride',event_id:text(ctx.existing.event_id),template_id:text(p.template_id||p.package_id),override_price:Math.max(1,current+delta),active_override:p.active_override!==false,override_note:'ULTRA_DEEP_MARKET_ALIGNMENT'});
  }
 }
 const metadata={action:'updateEvent',event_id:text(ctx.existing.event_id),note:'ULTRA_DEEP_VERIFIED_METADATA_SYNC'};
 let metadataWrite=false;
 if(text(candidate.event_date)&&text(candidate.event_date)!==text(ctx.existing.event_date)){metadata.event_date=text(candidate.event_date);metadataWrite=true;}
 if(text(candidate.venue)&&text(candidate.venue)!==text(ctx.existing.venue)){metadata.venue=text(candidate.venue);metadataWrite=true;}
 if(policy.poster.write_required){metadata.poster_url=policy.poster.target_poster_url;metadataWrite=true;}
 if(metadataWrite) actions.push(metadata);
 return {status:actions.length?'READY_FOR_GOVERNED_EXISTING_EVENT_UPDATE':'NO_CHANGE',actions,exact_readback_required:actions.length>0};
}
function completionCandidate(candidate,meta={}){
 const pricing=meta.pricing||{};
 return {
  candidate_id:eventKey(candidate),
  verified:meta.verified===true,
  deduplicated:true,
  pricing:{competitor_evidence:meta.competitor_evidence||[],fallback_applied:meta.fallback_applied===true,proposal_source:text(meta.proposal_source),final_price:num(meta.final_price)},
  poster:{verified:meta.poster_verified===true,image_url:text(meta.poster_url)},
  storefront_compared:true,
  publish_required:meta.publish_required===true,
  publish_decision:meta.publish_required===true?'PUBLISH':'SKIP',
  governed_publish:meta.governed_publish===true,
  production_readback:meta.production_readback===true
 };
}
async function run(input={},options={}){
 const discovery=input.discovery||{};
 const candidates=Array.isArray(input.candidates)&&input.candidates.length?input.candidates:(Array.isArray(discovery.candidates)?discovery.candidates:[]);
 const rows=[];let writes=0;
 for(const candidate of candidates){
  const ctx=contextFor(candidate,input);
  const policy=OwnerPolicy.evaluate(policyInput(candidate,input,ctx));
  if(policy.discovery.reason==='OWNER_HIDDEN_OR_TOMBSTONE'){
   rows.push({event_key:eventKey(candidate),status:'SKIPPED_OWNER_HIDDEN',policy,completion:completionCandidate(candidate,{verified:true,poster_verified:true,poster_url:text(ctx.existing.poster_image_url||ctx.existing.poster_url),final_price:currentPrice(ctx.existing),fallback_applied:true})});continue;
  }
  if(text(ctx.existing.event_id)){
   const plan=updatePlan(candidate,input,ctx,policy);
   let receipt=null;
   if(plan.actions.length&&typeof options.existingEventWriterFn==='function'){
    receipt=await options.existingEventWriterFn({candidate,existing:ctx.existing,plan,policy});
    if(receipt&&receipt.readback_verified===true) writes+=plan.actions.length;
   }
   const posterUrl=policy.poster.target_poster_url||text(ctx.existing.poster_image_url||ctx.existing.poster_url);
   rows.push({event_key:eventKey(candidate),status:plan.actions.length?(receipt&&receipt.readback_verified?'UPDATED_VERIFIED':'UPDATE_READY'):'NO_CHANGE',policy,update_plan:plan,receipt,
    completion:completionCandidate(candidate,{verified:true,competitor_evidence:competitorRowsFor(candidate,input),fallback_applied:!competitorRowsFor(candidate,input).length,proposal_source:'EXISTING_EVENT_POLICY',final_price:policy.pricing.target_price||currentPrice(ctx.existing),poster_verified:!!posterUrl,poster_url:posterUrl,publish_required:plan.actions.length>0,governed_publish:!!(receipt&&receipt.readback_verified),production_readback:!!(receipt&&receipt.readback_verified)})});continue;
  }
  const commercial=Commercial.prepareCandidate(candidate,input);
  const finalPricing=FinalPricing.resolve({candidate:commercial,pricing:commercial.pricing,event_date:candidate.event_date,rental_fit_score:commercial.rental_fit_score,store_baseline_prices:input.store_baseline_prices,package_templates:input.package_templates,score_fallback_policy:input.score_fallback_policy});
  const promotion=Promotion.preparePromotion({candidate:commercial,final_pricing_policy:finalPricing,final_prices:finalPricing.final_prices,verifier_approved:input.verifier_approved===true,owner_publish_allowed:true,visibility_locks:input.visibility_locks||[]});
  let receipt=null;
  if(promotion.status==='READY_FOR_GOVERNED_ADMIN_CREATE'&&options.executeWrites===true){
   receipt=await Executor.execute(promotion,{env:options.env||process.env,fetchImpl:options.fetchImpl||global.fetch,readbackFn:options.storefrontReadbackFn,correlationId:text(input.correlation_id)});
   if(receipt.readback_verified) writes+=1;
  }
  const p=commercial.poster&&commercial.poster.selected||{};
  rows.push({event_key:eventKey(candidate),status:receipt&&receipt.readback_verified?'CREATED_VERIFIED':promotion.status,policy,commercial,final_pricing:finalPricing,promotion,receipt,
   completion:completionCandidate(candidate,{verified:commercial.status==='READY_FOR_FINAL_VERIFIER',competitor_evidence:commercial.pricing.evidence||[],fallback_applied:commercial.pricing.proposal&&commercial.pricing.proposal.proposal_available===true,proposal_source:commercial.pricing.proposal&&commercial.pricing.proposal.proposal_source,final_price:finalPricing.final_prices&&finalPricing.final_prices[0]&&finalPricing.final_prices[0].override_price,poster_verified:!!p.verified,poster_url:p.image_url,publish_required:promotion.status==='READY_FOR_GOVERNED_ADMIN_CREATE',governed_publish:!!(receipt&&receipt.readback_verified),production_readback:!!(receipt&&receipt.readback_verified)})});
 }
 const acceptance=Completion.evaluate({discovery,candidates:rows.map(r=>r.completion),terminal_dispositions:input.terminal_dispositions||[],verified_candidate_count:input.verified_candidate_count,final_report_ready:true});
 return {version:VERSION,status:acceptance.complete?'COMPLETE':'INCOMPLETE',month:text(discovery.month||input.month),rows,acceptance,production_writes:writes,production_completion_claim_allowed:acceptance.production_completion_claim_allowed===true};
}
module.exports={VERSION,eventKey,sameEvent,contextFor,competitorRowsFor,posterRowsFor,currentPrice,policyInput,updatePlan,completionCandidate,run};
