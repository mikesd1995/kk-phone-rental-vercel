'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const Council=require('../server/kk-storefront-design-council.js');
function packet(){
  return {
    viewport:{width:390,height:844},platform:'ios',page_text:'KK concert phone rental',
    screenshot_artifacts:['390x844-light-top.jpg'],broken_visible_images:[],
    metrics:{viewport_width_px:390,viewport_height_px:844,document_scroll_width_px:390,
      event_card_count:4,card_columns:2,card_min_width_px:170,first_event_top_px:400,
      min_form_control_font_px:16,tap_targets:[{id:'search',width:300,height:44}],
      visible_event_cards_above_fold:2,filter_rows:1,hero_height_px:180,
      sticky_controls_height_px:80,bottom_cta_fixed:false,pre_event_surface_count:3}
  };
}
function reviews(){return Council.runCouncil({packet:packet()}).reviews;}

test('storefront design council requires all seven review dimensions and a single writer',async()=>{
  const route=Registry.routeForIntent('storefront_design_council');
  assert.equal(route.runtime_available,true);
  assert.equal(route.required_agents.length,7);
  const out=await Router.executeTask('storefront_design_council',{packet:packet()});
  assert.equal(out.invoked_agents.length,7);
  assert.equal(out.result.status,'REVIEW_COMPLETE');
  assert.equal(out.result.technical_status,'PASS');
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
  const bad=reviews();
  bad.find(review=>review.dimension==='conversion').findings.push({severity:'P1'});
  const stillBlocked=Council.acceptCouncil({reviews:bad,owner_decision:'ACCEPTED'});
  assert.equal(stillBlocked.status,'BLOCKED');
  const pass=Council.acceptCouncil({reviews:reviews(),owner_decision:'ACCEPTED'});
  assert.equal(pass.status,'PASS');
  assert.equal(Council.acceptCouncil({reviews:reviews(),owner_decision:'REJECTED'}).status,'BLOCKED');
});

test('storefront source never contains an escaped newline between FAQ event bindings',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').resolve(__dirname,'../script.js'),'utf8');
  assert.doesNotMatch(source,/openFaq\);\\\\n\s*document\.querySelectorAll\("\[data-open-faq\]"\)/);
});


test('design council executes independent reviewers and surfaces blocking evidence',async()=>{
  const out=await Router.executeTask('storefront_design_council',{
    ...packet(),
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
  assert.equal(out.result.technical_status,'BLOCKED');
});

test('all seven agents execute but missing concrete evidence blocks every review',()=>{
  const out=Council.runCouncil({});
  assert.equal(out.invoked_agents.length,7);
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.technical_status,'BLOCKED');
  assert.ok(out.reviews.every(review=>review.status==='BLOCKED'&&review.output.schema_version));
  for(const field of ['screenshot_artifacts','broken_visible_images','page_text','viewport','metrics']){
    const incomplete=packet();delete incomplete[field];
    assert.equal(Council.runCouncil(incomplete).technical_status,'BLOCKED',field);
  }
  const malformed=packet();malformed.metrics.tap_targets=[{width:44,height:NaN}];
  assert.equal(Council.runCouncil(malformed).technical_status,'BLOCKED');
});

test('council synthesis rejects absent or invalid status, agent, output and evidence',()=>{
  const mutate=[
    r=>{r[1].status='BLOCKED';},r=>{r[1].status='UNKNOWN';},r=>{r[1].status='REVISE';},
    r=>{delete r[1].status;},r=>{r[1].agent='pretend-agent';},
    r=>{delete r[1].output;},r=>{delete r[1].evidence;},
    r=>{r[1].evidence={...r[1].evidence,packet_sha256:'0'.repeat(64)};},
    r=>{r.push(r[1]);},r=>{r.splice(1,1);},r=>{r[1].findings=null;}
  ];
  for(const change of mutate){
    const current=reviews();change(current);
    assert.equal(Council.acceptCouncil({reviews:current,owner_decision:'ACCEPTED'}).status,'BLOCKED',String(change));
  }
});

test('art direction preserves planning details and never becomes aesthetic approval',()=>{
  const brand=reviews()[0];
  assert.equal(brand.status,'READY_FOR_IMPLEMENTATION');
  assert.equal(brand.aesthetic_acceptance,'NOT_EVALUATED');
  assert.equal(brand.output.design_system.direction,'proprietary-editorial-concert-optics');
  const current=reviews();current[0].status='PASS';current[0].output.status='PASS';
  assert.equal(Council.acceptCouncil({reviews:current,owner_decision:'ACCEPTED'}).status,'BLOCKED');
});

test('acceptance route executes real reviewers and ignores forged supplied reviews',async()=>{
  const missing=await Router.executeTask('storefront_design_council_acceptance',{reviews:reviews(),owner_decision:'ACCEPTED'});
  assert.equal(missing.result.status,'BLOCKED');
  assert.equal(missing.result.council.reviews.length,7);
  assert.ok(missing.result.council.reviews.every(review=>review.output.schema_version));
  const bad=packet();bad.metrics.document_scroll_width_px=900;
  const failed=await Router.executeTask('storefront_design_council_acceptance',{packet:bad,reviews:reviews(),owner_decision:'ACCEPTED'});
  assert.equal(failed.result.status,'BLOCKED');
  assert.ok(failed.result.council.reviews[1].findings.some(f=>f.code==='HORIZONTAL_OVERFLOW'));
  const valid=await Router.executeTask('storefront_design_council_acceptance',{packet:packet(),owner_decision:'ACCEPTED'});
  assert.equal(valid.result.status,'PASS');
  assert.deepEqual(valid.invoked_agents,valid.result.council.invoked_agents);
});
