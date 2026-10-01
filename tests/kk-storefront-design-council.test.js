'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const Council=require('../server/kk-storefront-design-council.js');

test('storefront design council requires all seven review dimensions and a single writer',async()=>{
  const route=Registry.routeForIntent('storefront_design_council');
  assert.equal(route.runtime_available,true);
  assert.equal(route.required_agents.length,7);
  const out=await Router.executeTask('storefront_design_council',{target:'V5'});
  assert.equal(out.invoked_agents.length,7);
  assert.equal(out.result.status,'REVIEW_COMPLETE');
  assert.equal(out.result.reviews.length,7);
  assert.deepEqual(out.result.reviews.map(r=>r.dimension),['brand','ux','conversion','fandom','accessibility','performance','adversarial_visual']);
  assert.equal(new Set(out.result.reviews.map(r=>r.agent)).size,7);
  assert.equal(out.result.safety.production_writes,0);
  assert.equal(out.result.safety.business_truth_writes,0);
});

test('design council acceptance fails closed on missing dimensions, P1 findings and owner acceptance',()=>{
  const blocked=Council.acceptCouncil({reviews:[{dimension:'brand',findings:[]}],owner_decision:'PENDING'});
  assert.equal(blocked.status,'BLOCKED');
  assert.ok(blocked.missing_dimensions.includes('ux'));
  const dimensions=['brand','ux','conversion','fandom','accessibility','performance','adversarial_visual'];
  const stillBlocked=Council.acceptCouncil({reviews:dimensions.map(d=>({dimension:d,findings:d==='conversion'?[{severity:'P1'}]:[]})),owner_decision:'ACCEPTED'});
  assert.equal(stillBlocked.status,'BLOCKED');
  const pass=Council.acceptCouncil({reviews:dimensions.map(d=>({dimension:d,findings:[]})),owner_decision:'ACCEPTED'});
  assert.equal(pass.status,'PASS');
});

test('storefront source never contains an escaped newline between FAQ event bindings',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').resolve(__dirname,'../script.js'),'utf8');
  assert.doesNotMatch(source,/openFaq\);\\\\n\s*document\.querySelectorAll\("\[data-open-faq\]"\)/);
});


test('design council executes independent reviewers and surfaces blocking evidence',async()=>{
  const out=await Router.executeTask('storefront_design_council',{
    viewport:{width:320,height:568},
    platform:'ios',
    metrics:{
      viewport_width_px:320,viewport_height_px:568,document_scroll_width_px:340,
      min_form_control_font_px:13,event_card_count:1,visible_event_cards_above_fold:0,
      tap_targets:[{id:'tiny',width:30,height:30}],bottom_cta_fixed:true,
      first_event_top_px:600,hero_height_px:300,filter_rows:1,card_columns:1,card_min_width_px:296
    },
    page_text:'KK Phone Rental concert vivo X300 Pro Lens'
  });
  const byDimension=Object.fromEntries(out.result.reviews.map(r=>[r.dimension,r]));
  assert.ok(byDimension.ux.findings.some(f=>f.code==='HORIZONTAL_OVERFLOW'));
  assert.ok(byDimension.conversion.findings.some(f=>f.code==='CONVERSION_PERSISTENT_CTA_RISK'));
  assert.equal(byDimension.fandom.status,'PASS');
  assert.ok(byDimension.accessibility.findings.some(f=>f.code==='A11Y_TAP_TARGET'));
  assert.ok(byDimension.adversarial_visual.findings.some(f=>f.code==='EVENT_DISCOVERY_TOO_LATE'));
  assert.equal(out.result.safety.production_writes,0);
});
