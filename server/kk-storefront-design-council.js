'use strict';

const VERSION='KK_STOREFRONT_DESIGN_COUNCIL_V2';
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
  const art=Art.buildDirection(packet);
  const ux=Ux.auditStorefront(packet);
  const conversion=Conversion.review(packet);
  const fandom=Fandom.review(packet);
  const accessibility=Accessibility.review(packet);
  const performance=Performance.review(packet);
  const adversarial=Visual.critique(packet);
  const reviews=[
    {dimension:'brand',agent:'kk-storefront-art-director',status:art.status,findings:[]},
    {dimension:'ux',agent:'kk-storefront-ux-reviewer',status:ux.status,findings:ux.findings||[]},
    conversion,
    fandom,
    accessibility,
    performance,
    {dimension:'adversarial_visual',agent:'kk-storefront-visual-critic',status:adversarial.status,findings:adversarial.findings||[]}
  ];
  return {schema_version:VERSION,status:'REVIEW_COMPLETE',invoked_agents:reviews.map(r=>r.agent),reviews,safety:{production_writes:0,business_truth_writes:0,auto_merge:false,auto_deploy:false}};
}
function acceptCouncil(input={}){
  const reviews=Array.isArray(input.reviews)?input.reviews:[];
  const dimensions=new Set(reviews.map(r=>clean(r&&r.dimension)));
  const missing=['brand','ux','conversion','fandom','accessibility','performance','adversarial_visual'].filter(x=>!dimensions.has(x));
  const p0p1=reviews.flatMap(r=>Array.isArray(r&&r.findings)?r.findings:[]).filter(f=>['P0','P1'].includes(clean(f&&f.severity).toUpperCase()));
  const blockers=[];
  if(missing.length) blockers.push('DESIGN_COUNCIL_DIMENSIONS_MISSING:'+missing.join(','));
  if(p0p1.length) blockers.push('DESIGN_COUNCIL_P0_P1_OPEN');
  if(clean(input.owner_decision).toUpperCase()!=='ACCEPTED') blockers.push('OWNER_VISUAL_ACCEPTANCE_MISSING');
  return {schema_version:VERSION,status:blockers.length?'BLOCKED':'PASS',missing_dimensions:missing,open_p0_p1:p0p1.length,blockers,production_writes:0,auto_merge:false,auto_deploy:false};
}
module.exports={VERSION,ROLES,buildCouncil,runCouncil,acceptCouncil};
