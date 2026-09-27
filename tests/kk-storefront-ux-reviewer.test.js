'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Reviewer=require('../server/kk-storefront-ux-reviewer.js');

test('storefront UX reviewer flags the exact mobile failure classes we want to prevent',()=>{
  const report=Reviewer.auditStorefront({
    platform:'ios',
    viewport:{width:390,height:844},
    metrics:{
      document_scroll_width_px:420,
      content_width_px:390,
      sticky_controls_height_px:245,
      bottom_cta_height_px:86,
      bottom_cta_fixed:true,
      safe_area_bottom_applied:false,
      min_form_control_font_px:13,
      filter_rows:2,
      card_columns:2,
      card_min_width_px:168,
      visible_event_cards_above_fold:0,
      tap_targets:[{id:'filter-full',width:74,height:36}]
    }
  });

  assert.equal(report.status,'BLOCKED');
  assert.ok(report.professional_readiness_score<70);
  const codes=new Set(report.findings.map(x=>x.code));
  assert.equal(codes.has('HORIZONTAL_OVERFLOW'),true);
  assert.equal(codes.has('IOS_FORM_CONTROL_ZOOM_RISK'),true);
  assert.equal(codes.has('STICKY_VIEWPORT_OBSTRUCTION'),true);
  assert.equal(codes.has('BOTTOM_CTA_TOO_TALL'),true);
  assert.equal(codes.has('BOTTOM_SAFE_AREA_NOT_RESPECTED'),true);
  assert.equal(codes.has('TAP_TARGET_TOO_SMALL'),true);
  assert.equal(codes.has('FILTER_TOOLBAR_WRAPS'),true);
});

test('storefront UX reviewer accepts a compact professional mobile evidence packet',()=>{
  const report=Reviewer.auditStorefront({
    platform:'ios',
    viewport:{width:390,height:844},
    metrics:{
      document_scroll_width_px:390,
      content_width_px:390,
      sticky_controls_height_px:126,
      bottom_cta_height_px:56,
      bottom_cta_fixed:true,
      safe_area_bottom_applied:true,
      min_form_control_font_px:16,
      filter_rows:1,
      card_columns:2,
      card_min_width_px:172,
      visible_event_cards_above_fold:1,
      backdrop_blur_px:14,
      tap_targets:[
        {id:'search',width:370,height:44},
        {id:'month',width:118,height:44},
        {id:'all',width:82,height:44},
        {id:'available',width:72,height:44},
        {id:'waitlist',width:82,height:44}
      ]
    }
  });

  assert.equal(report.status,'PASS');
  assert.equal(report.professional_readiness_score,100);
  assert.equal(report.findings.length,0);
});

test('visual QA fails closed without viewport evidence and never grants production authority',()=>{
  const qa=Reviewer.validateVisualQa({metrics:{}});
  assert.equal(qa.pass,false);
  assert.equal(qa.status,'BLOCKED_INSUFFICIENT_EVIDENCE');
  assert.equal(qa.production_writes,0);
  assert.equal(qa.auto_merge,false);
  assert.equal(qa.auto_deploy,false);
});

test('advisor prompt preserves UX scope and business safety boundaries',()=>{
  const report=Reviewer.auditStorefront({
    platform:'ios',
    viewport:{width:375,height:812},
    metrics:{document_scroll_width_px:375,content_width_px:375,min_form_control_font_px:16}
  });
  const prompt=Reviewer.buildAdvisorPrompt(report);
  assert.match(prompt,/Storefront UX\/UI Reviewer/);
  assert.match(prompt,/iOS form controls >=16px/);
  assert.match(prompt,/Do not change pricing, inventory, booking semantics/);
  assert.match(prompt,/Do not auto-merge or auto-deploy/);
});
