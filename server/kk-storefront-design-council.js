'use strict';

const VERSION='KK_STOREFRONT_DESIGN_COUNCIL_V2';
const crypto=require('node:crypto');
const Art=require('./kk-storefront-art-director.js');
const Ux=require('./kk-storefront-ux-reviewer.js');
const Conversion=require('./kk-storefront-conversion-reviewer.js');
const Fandom=require('./kk-storefront-fandom-reviewer.js');
const Accessibility=require('./kk-storefront-accessibility-reviewer.js');
const Performance=require('./kk-storefront-performance-reviewer.js');
const Visual=require('./kk-storefront-visual-critic.js');
const ROLES=Object.freeze([
  {id:'art_direction',agent:'kk-storefront-art-director',focus:['brand_distinctiveness','visual_hierarchy','editorial_concert_identity']},
  {id:'product_ux',agent:'kk-storefront-ux-reviewer',focus:['event_discovery','information_architecture','responsive_flow']},
  {id:'conversion',agent:'kk-storefront-conversion-reviewer',focus:['event_to_package_to_booking','trust','decision_friction']},
  {id:'fandom_commerce',agent:'kk-storefront-fandom-reviewer',focus:['concert_context','emotional_relevance','fan_language_without_noise']},
  {id:'accessibility',agent:'kk-storefront-accessibility-reviewer',focus:['keyboard','focus','semantics','touch_targets','reduced_motion']},
  {id:'performance',agent:'kk-storefront-performance-reviewer',focus:['loading_perception','image_cost','font_dependency','layout_stability']},
  {id:'adversarial_visual',agent:'kk-storefront-visual-critic',focus:['generic_saas_risk','composition','mobile_density','release_blockers']}
]);

function clean(v){return String(v==null?'':v).trim();}
const DIMENSIONS=Object.freeze(['brand','ux','conversion','fandom','accessibility','performance','adversarial_visual']);
function packetEvidence(packet={}){
  const missing=[];
  const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  const measured=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
  for(const key of ['width','height']) if(!positive(packet.viewport?.[key])) missing.push('viewport.'+key);
  const metrics=packet.metrics||{};
  for(const key of ['document_scroll_width_px','event_card_count','card_columns','card_min_width_px','first_event_top_px','min_form_control_font_px']){
    if(!measured(metrics[key])) missing.push('metrics.'+key);
  }
  if(!Array.isArray(metrics.tap_targets)||!metrics.tap_targets.length||metrics.tap_targets.some(item=>!positive(item?.width)||!positive(item?.height))) missing.push('metrics.tap_targets');
  if(!clean(packet.page_text)) missing.push('page_text');
  if(!Array.isArray(packet.broken_visible_images)) missing.push('broken_visible_images');
  if(!Array.isArray(packet.screenshot_artifacts)||!packet.screenshot_artifacts.length||packet.screenshot_artifacts.some(item=>typeof item!=='string'||!clean(item))) missing.push('screenshot_artifacts');
  return {
    status:missing.length?'BLOCKED':'COMPLETE',missing,
    packet_sha256:crypto.createHash('sha256').update(JSON.stringify(packet)).digest('hex'),
    viewport:packet.viewport||{},screenshot_artifacts:packet.screenshot_artifacts||[]
  };
}
function buildCouncil(input={}){
  const evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{};
  const roles=ROLES.map(role=>({
    ...role,
    mode:'READ_ONLY_REVIEWER',
    required_output:['findings','evidence','recommended_action','acceptance_test'],
    may_write_code:false,
    may_change_business_truth:false
  }));
  return {
    schema_version:VERSION,
    status:'READY_FOR_PARALLEL_REVIEW',
    target:clean(input.target||'KK storefront'),
    source_commit_sha:clean(input.source_commit_sha),
    evidence,
    roles,
    synthesis:{
      owner:'kk-storefront-art-director',
      implementation_writer:'single implementation agent only',
      rule:'Reviewers may disagree and critique; only the synthesis/implementation stage may change presentation code.',
      required_dimensions:['brand','ux','conversion','fandom','accessibility','performance','adversarial_visual'],
      block_on_missing_dimension:true
    },
    safety:{production_writes:0,business_truth_writes:0,auto_merge:false,auto_deploy:false,owner_visual_acceptance_required:true}
  };
}
function runCouncil(input={}){
  const packet=input.packet&&typeof input.packet==='object'?input.packet:input;
  const evidence=packetEvidence(packet);
  const art=Art.buildDirection(packet);
  const ux=Ux.auditStorefront(packet);
  const conversion=Conversion.review(packet);
  const fandom=Fandom.review(packet);
  const accessibility=Accessibility.review(packet);
  const performance=Performance.review(packet);
  const adversarial=Visual.critique(packet);
  const outputs=[art,ux,conversion,fandom,accessibility,performance,adversarial];
  const reviews=outputs.map((output,index)=>({
    dimension:DIMENSIONS[index],agent:ROLES[index].agent,
    status:evidence.status==='COMPLETE'?output.status:'BLOCKED',
    findings:[...(output.findings||[]),...(evidence.missing.length?[{
      code:'DESIGN_COUNCIL_PACKET_EVIDENCE_MISSING',severity:'P0',evidence:evidence.missing.join(', '),
      recommended_action:'Capture the missing rendered-state evidence before acceptance.',
      acceptance_test:'All required packet fields contain concrete viewport, image, target and screenshot evidence.'
    }]:[])],
    evidence,output,
    ...(index===0?{review_kind:'ART_DIRECTION_PLAN',aesthetic_acceptance:'NOT_EVALUATED',limitation:'READY_FOR_IMPLEMENTATION is a design plan; screenshot review and owner acceptance remain separate required gates.'}:{review_kind:'MEASURED_REVIEW'})
  }));
  const technicalBlockers=reviewBlockers(reviews);
  return {schema_version:VERSION,status:evidence.missing.length?'BLOCKED':'REVIEW_COMPLETE',technical_status:technicalBlockers.length?'BLOCKED':'PASS',blockers:technicalBlockers,invoked_agents:reviews.map(r=>r.agent),reviews,evidence,aesthetic_acceptance:'REQUIRES_SCREENSHOT_AND_OWNER_REVIEW',safety:{production_writes:0,business_truth_writes:0,auto_merge:false,auto_deploy:false}};
}
function reviewBlockers(reviews){
  const blockers=[];
  const hashes=new Set();
  for(const [index,dimension] of DIMENSIONS.entries()){
    const matches=reviews.filter(review=>review?.dimension===dimension);
    if(matches.length!==1){blockers.push('DESIGN_COUNCIL_DIMENSION_COUNT_INVALID:'+dimension);continue;}
    const review=matches[0];
    if(review.agent!==ROLES[index].agent) blockers.push('DESIGN_COUNCIL_AGENT_MISMATCH:'+dimension);
    const allowed=dimension==='brand'?['READY_FOR_IMPLEMENTATION']:['PASS','PASS_WITH_POLISH'];
    if(!allowed.includes(review.status)) blockers.push('DESIGN_COUNCIL_REVIEW_NOT_PASSING:'+dimension);
    if(!Array.isArray(review.findings)||review.findings.some(finding=>!finding||!['P0','P1','P2','P3'].includes(clean(finding.severity).toUpperCase()))) blockers.push('DESIGN_COUNCIL_FINDINGS_INVALID:'+dimension);
    const evidence=review.evidence;
    if(evidence?.status!=='COMPLETE'||!Array.isArray(evidence.missing)||evidence.missing.length||!Array.isArray(evidence.screenshot_artifacts)||!evidence.screenshot_artifacts.length||!/^[0-9a-f]{64}$/.test(evidence.packet_sha256||'')) blockers.push('DESIGN_COUNCIL_REVIEW_EVIDENCE_MISSING:'+dimension);
    else hashes.add(evidence.packet_sha256);
    if(!review.output?.schema_version||review.output.status!==review.status) blockers.push('DESIGN_COUNCIL_EXECUTION_OUTPUT_INVALID:'+dimension);
    if(dimension==='brand'&&(review.review_kind!=='ART_DIRECTION_PLAN'||review.aesthetic_acceptance!=='NOT_EVALUATED')) blockers.push('ART_DIRECTION_IS_NOT_VISUAL_ACCEPTANCE');
  }
  if(reviews.length!==DIMENSIONS.length) blockers.push('DESIGN_COUNCIL_REVIEW_COUNT_INVALID');
  if(hashes.size>1) blockers.push('DESIGN_COUNCIL_PACKET_MISMATCH');
  if(reviews.some(review=>(review?.findings||[]).some?.(finding=>['P0','P1'].includes(clean(finding?.severity).toUpperCase())))) blockers.push('DESIGN_COUNCIL_P0_P1_OPEN');
  return blockers;
}
function acceptCouncil(input={}){
  const reviews=Array.isArray(input.reviews)?input.reviews:[];
  const dimensions=new Set(reviews.map(r=>clean(r&&r.dimension)));
  const missing=DIMENSIONS.filter(x=>!dimensions.has(x));
  const p0p1=reviews.flatMap(r=>Array.isArray(r&&r.findings)?r.findings:[]).filter(f=>['P0','P1'].includes(clean(f&&f.severity).toUpperCase()));
  const blockers=reviewBlockers(reviews);
  if(missing.length) blockers.push('DESIGN_COUNCIL_DIMENSIONS_MISSING:'+missing.join(','));
  if(clean(input.owner_decision).toUpperCase()!=='ACCEPTED') blockers.push('OWNER_VISUAL_ACCEPTANCE_MISSING');
  return {schema_version:VERSION,status:blockers.length?'BLOCKED':'PASS',missing_dimensions:missing,open_p0_p1:p0p1.length,blockers,production_writes:0,auto_merge:false,auto_deploy:false};
}
module.exports={VERSION,ROLES,buildCouncil,runCouncil,acceptCouncil,packetEvidence};
