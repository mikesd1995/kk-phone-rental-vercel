'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Marketing=require('../server/kk-marketing-agent.js');
const Router=require('../server/kk-content-request-router.js');

test('marketing agent stays read-only and separates marketing from copywriting',()=>{
  assert.equal(Marketing.SAFETY.authority,'READ_ONLY_ADVISOR');
  assert.equal(Marketing.SAFETY.auto_publish,false);
  assert.equal(Marketing.SAFETY.auto_spend,false);
  assert.equal(Marketing.SAFETY.price_writes,false);
  assert.equal(Marketing.SAFETY.inventory_writes,false);
  assert.equal(Marketing.SAFETY.production_writes,0);
});

test('last unit onsite becomes conversion / onsite last unit',()=>{
  const p=Marketing.plan({
    verified_event:true,verified_pricing:true,inventory_available:true,
    inventory_remaining:1,event_is_today:true
  },[]);
  assert.equal(p.objective,'conversion');
  assert.equal(p.campaign_mode,'ONSITE_LAST_UNIT');
  assert.equal(p.evidence_state,'RULE_BASED_COLD_START');
  assert.ok(p.opportunity.score>=80);
});

test('content router invokes marketing brief before strategy plan',()=>{
  const r=Router.routeContentRequest({
    message:'ขอโพสปล่อยเช่างานนี้บน X',
    input:{
      event:'Example',venue:'Hall',verified_event:true,verified_pricing:true,
      price_display:'vivo X300 Pro 790฿ | เพิ่ม Lens +200฿',inventory_available:true
    },
    performanceRows:[]
  });
  assert.equal(r.marketing_required,true);
  assert.equal(r.route,'KK_MARKETING_TO_CONTENT_SINGLE_WINNER');
  assert.equal(r.marketing_plan.agent,'kk-marketing-agent');
  assert.equal(r.marketing_plan.winner_selection.mode,'INTERNAL_3_TO_SINGLE_FINAL');
  assert.equal(r.marketing_plan.winner_selection.public_output_count,1);
  assert.equal(r.content_gate,'PASS');
});
