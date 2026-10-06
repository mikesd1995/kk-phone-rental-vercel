'use strict';

const VERSION='KK_STOREFRONT_ART_DIRECTOR_V5_INSPO_REFERENCE';
const Inspo=require('./kk-inspo-reference-gate.js');

const DESIGN_SYSTEM=Object.freeze({
  direction:'proprietary-editorial-concert-optics',
  principles:[
    'Poster and event identity lead; chrome recedes.',
    'One dominant action per decision layer.',
    'Use restrained depth, not decorative noise.',
    'Mobile is the primary composition, not a compressed desktop.',
    'Typography and spacing create hierarchy before color or effects.',
    'Trend references are inputs, not instructions: recommend brand-fit before implementation.',
    'Own one proprietary concert-optics device instead of generic gradients, mascots or trend decoration.',
    'Use human/editorial restraint and allow event posters to supply most of the visual color.',
    'Preserve business truth and existing booking behavior.'
  ],
  tokens:{
    radius:{sm:12,md:18,lg:24,xl:32},
    space:[4,8,12,16,20,24,32,40,48,64],
    tap_target_min_px:44,
    ios_input_font_min_px:16,
    content_max_width_px:1180,
    card_poster_ratio:'4/5'
  }
});

function clean(v){return String(v==null?'':v).trim();}
function buildDirection(input={}){
  const reference_gate=Inspo.validateEvidence(input);
  const references=(Array.isArray(input.references)?input.references:[]).map(clean).filter(Boolean);
  const goals=(Array.isArray(input.goals)?input.goals:[
    'premium visual hierarchy','fast event discovery','high-confidence LINE conversion','mobile-first polish'
  ]).map(clean).filter(Boolean);
  return {
    schema_version:VERSION,
    status:reference_gate.status==='BLOCKED'?'BLOCKED_REFERENCE_RESEARCH':'READY_FOR_IMPLEMENTATION',
    reference_gate,
    design_system:DESIGN_SYSTEM,
    goals,
    references,
    composition:{
      header:'quiet branded masthead with premium breathing room',
      discovery:'single compact search/filter command surface',
      event_grid:'poster-first editorial grid with consistent card rhythm',
      event_card:'poster -> date/status -> event title -> availability action',
      detail:'bottom-sheet/modal with package decision hierarchy and one primary CTA',
      footer:'low-noise trust and support layer'
    },
    anti_patterns:[
      'stacked utility boxes competing above the event grid',
      'emoji as primary visual system',
      'multiple equally loud CTAs',
      'heavy gradients/glows without hierarchy purpose',
      'literal trend imitation without KK brand-fit critique',
      'generic pastel gradients used as a substitute for a proprietary visual idea',
      'mascot or cute decoration competing with event posters',
      'tiny mobile controls or dense two-column text',
      'visual changes that alter price, inventory, event visibility or booking semantics',
      'more than three competing utility surfaces before primary event content',
      'persistent CTA visually dominating poster or event discovery content',
      'dashboard-like filter chrome outweighing customer-facing event content',
      'shipping a new visual layer by stacking overrides on an obsolete visual layer',
      'declaring aesthetic quality from geometry/readiness metrics alone'
    ],
    acceptance:{
      mobile_first:true,
      required_widths:[320,375,390,430,480,768,1024,1440],
      no_horizontal_overflow:true,
      min_tap_target_px:44,
      min_ios_input_font_px:16,
      reduced_motion:true,
      business_truth_unchanged:true,
      independent_visual_qa_required:true,
      content_first_mobile:true,
      max_competing_utility_surfaces_before_events:3,
      persistent_cta_must_recede:true,
      screenshot_review_required:true,
      single_visual_source_of_truth:true,
      aesthetic_pass_cannot_be_inferred_from_readiness_score:true
    },
    authority:{
      production_writes:0,pricing_mutation:false,booking_mutation:false,
      inventory_mutation:false,machine_sot_mutation:false,auto_merge:false,auto_deploy:false
    }
  };
}
function evaluateImplementation(input={}){
  const evidence=input.evidence||{};
  const blockers=[];
  const referenceGate=Inspo.validateEvidence(input);
  if(referenceGate.status==='BLOCKED') blockers.push(...referenceGate.blockers);
  if(!evidence.multi_viewport) blockers.push('MULTI_VIEWPORT_EVIDENCE_MISSING');
  if(!evidence.no_horizontal_overflow) blockers.push('HORIZONTAL_OVERFLOW_NOT_PROVEN');
  if(!evidence.business_truth_unchanged) blockers.push('BUSINESS_TRUTH_PRESERVATION_NOT_PROVEN');
  if(!evidence.visual_qa_pass) blockers.push('INDEPENDENT_VISUAL_QA_NOT_PASSING');
  if(evidence.content_first_mobile===false) blockers.push('CONTENT_FIRST_MOBILE_NOT_PROVEN');
  if(evidence.persistent_cta_recedes===false) blockers.push('PERSISTENT_CTA_TOO_DOMINANT');
  if(!evidence.single_visual_source_of_truth) blockers.push('VISUAL_SOURCE_OF_TRUTH_NOT_SINGLE');
  if(!evidence.screenshot_review_pass) blockers.push('SCREENSHOT_REVIEW_NOT_PASSING');
  return {schema_version:VERSION,status:blockers.length?'BLOCKED':'PASS',blockers,production_writes:0};
}
module.exports={VERSION,DESIGN_SYSTEM,buildDirection,evaluateImplementation};
