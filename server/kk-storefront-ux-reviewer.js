'use strict';

const fs=require('fs');
const path=require('path');

const VERSION='KK_STOREFRONT_UX_REVIEWER_V1';
const DEFAULT_POLICY_PATH=path.resolve(__dirname,'../config/kk-storefront-ux-policy.json');
const SEVERITY_ORDER=Object.freeze({P0:0,P1:1,P2:2,P3:3});

function clean(value){
  return String(value===undefined||value===null?'':value).replace(/\s+/g,' ').trim();
}

function number(value,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function loadPolicy(filePath=DEFAULT_POLICY_PATH){
  const policy=JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(!policy||policy.version!=='KK_STOREFRONT_UX_POLICY_V1') throw new Error('invalid storefront UX policy');
  return policy;
}

function viewportClass(width,policy){
  const w=number(width,0);
  if(w<=number(policy.viewports.mobile.max_width_px,480)) return 'mobile';
  if(w<=number(policy.viewports.tablet.max_width_px,900)) return 'tablet';
  return 'desktop';
}

function finding(code,severity,evidence,recommendedAction,acceptance){
  return {
    code,
    severity,
    evidence:clean(evidence),
    recommended_action:clean(recommendedAction),
    acceptance:clean(acceptance)
  };
}

function normalizeObservation(item,index){
  if(!item||typeof item!=='object') return null;
  const severity=clean(item.severity||'P2').toUpperCase();
  return finding(
    clean(item.code)||`SCREENSHOT_OBSERVATION_${index+1}`,
    Object.prototype.hasOwnProperty.call(SEVERITY_ORDER,severity)?severity:'P2',
    item.evidence||item.observation||item.message||'visual observation supplied',
    item.recommended_action||'Review the supplied visual observation before release.',
    item.acceptance||'Observation no longer reproduces at the affected viewport.'
  );
}

function sortFindings(items){
  return [...items].sort((a,b)=>{
    const sa=SEVERITY_ORDER[a.severity]??99;
    const sb=SEVERITY_ORDER[b.severity]??99;
    return sa-sb||a.code.localeCompare(b.code);
  });
}

function auditStorefront(input={},options={}){
  const policy=options.policy||loadPolicy(options.policy_path);
  const viewport=input.viewport&&typeof input.viewport==='object'?input.viewport:{};
  const metrics=input.metrics&&typeof input.metrics==='object'?input.metrics:{};
  const width=number(viewport.width||metrics.viewport_width_px,0);
  const height=number(viewport.height||metrics.viewport_height_px,0);
  const profileName=viewportClass(width,policy);
  const profile=policy.viewports[profileName];
  const platform=clean(input.platform||metrics.platform).toLowerCase();
  const findings=[];

  if(number(metrics.raw_i18n_key_count,0)>0){
    findings.push(finding(
      'RAW_I18N_KEY_VISIBLE','P0',
      'Visible untranslated localization keys: '+((metrics.raw_i18n_keys||[]).join(', ')||metrics.raw_i18n_key_count),
      'Repair localization initialization/binding and fail safe to customer copy.',
      'No journey_*, proof_*, events_*, filter_*, footer_*, modal_*, faq_* or related raw keys are visible.'
    ));
  }

  if(!width||!height){
    findings.push(finding(
      'VIEWPORT_EVIDENCE_MISSING','P0',
      'Viewport width/height is required for bounded visual QA.',
      'Capture or supply the viewport dimensions with the visual evidence packet.',
      'Both viewport width and height are positive finite numbers.'
    ));
  }

  const scrollWidth=number(metrics.document_scroll_width_px,0);
  const contentWidth=number(metrics.content_width_px||width,0);
  const overflowReference=width||contentWidth;
  if(scrollWidth&&overflowReference&&scrollWidth>overflowReference+1){
    findings.push(finding(
      'HORIZONTAL_OVERFLOW','P0',
      `document_scroll_width_px=${scrollWidth} exceeds viewport/content width ${overflowReference}`,
      'Remove unintended fixed/min widths or contain the overflowing component.',
      'document_scroll_width_px <= viewport_width_px + 1 at every acceptance viewport.'
    ));
  }

  const minFormFont=number(metrics.min_form_control_font_px,0);
  if(platform.includes('ios')&&minFormFont>0&&minFormFont<number(profile.min_ios_form_font_px,16)){
    findings.push(finding(
      'IOS_FORM_CONTROL_ZOOM_RISK','P0',
      `minimum form-control font size is ${minFormFont}px on iOS`,
      'Keep searchable/selectable form controls at 16px or larger on iOS-sized layouts.',
      'All focused input/select controls remain >=16px and Safari does not auto-zoom.'
    ));
  }

  const stickyHeight=number(metrics.sticky_controls_height_px,0);
  if(stickyHeight&&height){
    const ratio=stickyHeight/height;
    if(stickyHeight>number(profile.max_sticky_height_px,170)||ratio>number(profile.max_sticky_viewport_ratio,.22)){
      findings.push(finding(
        'STICKY_VIEWPORT_OBSTRUCTION','P1',
        `sticky controls occupy ${stickyHeight}px (${Math.round(ratio*100)}% of viewport height)`,
        'Collapse the sticky state to search plus a single-row filter toolbar; remove nonessential counters/spacing while stuck.',
        `Sticky controls stay <=${profile.max_sticky_height_px}px and <=${Math.round(profile.max_sticky_viewport_ratio*100)}% of viewport height.`
      ));
    }
  }

  const ctaHeight=number(metrics.bottom_cta_height_px,0);
  if(ctaHeight>number(profile.max_bottom_cta_height_px,64)){
    findings.push(finding(
      'BOTTOM_CTA_TOO_TALL','P1',
      `fixed bottom CTA height is ${ctaHeight}px`,
      'Use a compact sticky LINE CTA and preserve content visibility above it.',
      `Fixed bottom CTA height stays <=${profile.max_bottom_cta_height_px}px.`
    ));
  }

  if(metrics.bottom_cta_fixed===true&&metrics.safe_area_bottom_applied===false){
    findings.push(finding(
      'BOTTOM_SAFE_AREA_NOT_RESPECTED','P1',
      'fixed bottom CTA is present without confirmed safe-area handling',
      'Use env(safe-area-inset-bottom) in bottom offset/body padding.',
      'CTA and final event card remain fully reachable on iPhone home-indicator devices.'
    ));
  }

  const targets=Array.isArray(metrics.tap_targets)?metrics.tap_targets:[];
  const minTap=number(profile.min_tap_target_px,44);
  const smallTargets=targets.filter(target=>{
    const w=number(target&&target.width,0);
    const h=number(target&&target.height,0);
    return w>0&&h>0&&(w<minTap||h<minTap);
  });
  if(smallTargets.length){
    findings.push(finding(
      'TAP_TARGET_TOO_SMALL','P1',
      `${smallTargets.length} supplied tap target(s) fall below ${minTap}px: ${smallTargets.map(x=>clean(x.id||x.name||'unknown')).join(', ')}`,
      'Increase interactive target boxes without necessarily increasing visual chrome.',
      `All primary mobile controls expose at least ${minTap}x${minTap}px hit areas.`
    ));
  }

  const filterRows=number(metrics.filter_rows,0);
  if(filterRows>number(profile.max_filter_rows,1)){
    findings.push(finding(
      'FILTER_TOOLBAR_WRAPS','P1',
      `filter toolbar uses ${filterRows} rows`,
      'Keep status filters on one row; use horizontal overflow only for very narrow viewports.',
      'Month/status filters remain a single row at mobile acceptance widths.'
    ));
  }

  const cardColumns=number(metrics.card_columns,0);
  if(cardColumns>number(profile.max_card_columns,2)){
    findings.push(finding(
      'CARD_COLUMN_DENSITY_TOO_HIGH','P1',
      `card_columns=${cardColumns} exceeds ${profile.max_card_columns} for ${profileName}`,
      'Reduce the number of simultaneous card columns or widen cards.',
      `Card columns <=${profile.max_card_columns} at this viewport class.`
    ));
  }

  const cardMinWidth=number(metrics.card_min_width_px,0);
  if(cardMinWidth&&cardMinWidth<number(profile.min_card_width_px,150)){
    findings.push(finding(
      'CARD_WIDTH_TOO_NARROW','P1',
      `minimum event-card width is ${cardMinWidth}px`,
      'Protect readable card width before increasing grid density.',
      `Event-card width remains >=${profile.min_card_width_px}px.`
    ));
  }

  if(profileName==='mobile'&&number(metrics.visible_event_cards_above_fold,-1)===0){
    findings.push(finding(
      'NO_EVENT_CONTENT_ABOVE_FOLD','P2',
      'no event card is visible before the first viewport ends',
      'Reduce nonessential vertical chrome above the event list while keeping the search discoverable.',
      'At least part of the first event row is visible on common 375–430px mobile widths after the initial hero area.'
    ));
  }

  const blur=number(metrics.backdrop_blur_px,0);
  if(blur>number(profile.preferred_backdrop_blur_px,14)+4){
    findings.push(finding(
      'EXCESSIVE_BACKDROP_BLUR','P2',
      `backdrop blur is ${blur}px`,
      'Reduce sticky-surface blur/shadow complexity on mobile to protect scroll smoothness.',
      `Sticky blur stays near or below ${profile.preferred_backdrop_blur_px}px unless measured performance justifies more.`
    ));
  }

  for(const [index,item] of (Array.isArray(input.screenshot_observations)?input.screenshot_observations:[]).entries()){
    const normalized=normalizeObservation(item,index);
    if(normalized) findings.push(normalized);
  }

  const sorted=sortFindings(findings);
  const counts=sorted.reduce((acc,item)=>{acc[item.severity]=(acc[item.severity]||0)+1;return acc;},{P0:0,P1:0,P2:0,P3:0});
  const score=clamp(100-(counts.P0*25+counts.P1*12+counts.P2*5+counts.P3*2),0,100);
  const status=counts.P0?'BLOCKED':
    counts.P1?'NEEDS_REFINEMENT':
    counts.P2?'PASS_WITH_POLISH':'PASS';

  return {
    schema_version:VERSION,
    agent:'kk-storefront-ux-reviewer',
    mode:'READ_ONLY_DESIGN_ADVISOR',
    status,
    professional_readiness_score:score,
    viewport:{width,height,class:profileName,platform:platform||'unknown'},
    finding_counts:counts,
    findings:sorted,
    recommendations:sorted.map(item=>({
      priority:item.severity,
      code:item.code,
      action:item.recommended_action,
      acceptance:item.acceptance
    })),
    acceptance_matrix:{
      widths:[...policy.acceptance_viewports],
      required_checks:[...policy.required_checks],
      owner_visual_review_required:true
    },
    design_constraints:{
      sticky_search_allowed:true,
      mobile_filter_rows:profile.max_filter_rows,
      min_tap_target_px:profile.min_tap_target_px,
      ios_form_font_min_px:profile.min_ios_form_font_px,
      max_sticky_height_px:profile.max_sticky_height_px,
      max_sticky_viewport_ratio:profile.max_sticky_viewport_ratio,
      max_bottom_cta_height_px:profile.max_bottom_cta_height_px,
      no_horizontal_overflow:true,
      preserve_event_truth_and_booking_logic:true
    },
    safety:{...policy.safety}
  };
}

function validateVisualQa(input={},options={}){
  const review=auditStorefront(input,options);
  const evidencePresent=review.viewport.width>0&&review.viewport.height>0;
  return {
    schema_version:'KK_STOREFRONT_VISUAL_QA_V1',
    pass:evidencePresent&&review.finding_counts.P0===0&&review.finding_counts.P1===0,
    status:!evidencePresent?'BLOCKED_INSUFFICIENT_EVIDENCE':
      (review.finding_counts.P0||review.finding_counts.P1?'FAIL':'PASS'),
    review,
    production_writes:0,
    auto_merge:false,
    auto_deploy:false
  };
}

function buildAdvisorPrompt(review){
  if(!review||review.schema_version!==VERSION) throw new Error('valid KK storefront UX review required');
  return [
    'You are the KK Phone Rental Storefront UX/UI Reviewer.',
    'Improve professionalism, clarity, mobile conversion flow and visual consistency without changing business truth.',
    'Treat the supplied findings and acceptance constraints as hard evidence.',
    'Prefer compact, stable, accessible layouts over decorative density.',
    'Keep iOS form controls >=16px, mobile hit areas >=44px, no unintended horizontal overflow, and sticky UI within its viewport budget.',
    'Do not change pricing, inventory, booking semantics, event visibility, API contracts, Google Sheets, Apps Script, Machine SOT or production data.',
    'Do not auto-merge or auto-deploy. Produce a scoped design recommendation and patch plan for owner review.',
    `Review packet: ${JSON.stringify(review)}`,
    'Return: visual hierarchy changes, spacing/density changes, responsive behavior, accessibility checks, patch scope, acceptance tests, rollback risk.'
  ].join('\n');
}

module.exports={
  VERSION,
  DEFAULT_POLICY_PATH,
  clean,
  loadPolicy,
  viewportClass,
  auditStorefront,
  validateVisualQa,
  buildAdvisorPrompt
};
