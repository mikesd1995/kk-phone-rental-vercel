'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');

const Planner=require('../server/kk-x-posting-plan.js');
const Gateway=require('../server/kk-agent-gateway.js');
const Registry=require('../server/kk-agent-registry.js');

function candidates(){
  return [
    {
      event:'Event A',
      verified_event:true,
      verified_pricing:true,
      inventory_available:true,
      inventory_remaining:1,
      event_is_tomorrow:true,
      engagement_velocity:96,
      conversation_volume:94,
      fandom_strength:92,
      competitor_activity:70,
      booking_opportunity:88,
      recent_posted_hours_ago:1
    },
    {
      event:'Event B',
      verified_event:true,
      verified_pricing:true,
      inventory_available:true,
      inventory_remaining:1,
      event_is_tomorrow:true,
      engagement_velocity:84,
      conversation_volume:86,
      fandom_strength:88,
      competitor_activity:76,
      booking_opportunity:94,
      recent_posted_hours_ago:9
    },
    {
      event:'Event C',
      verified_event:true,
      verified_pricing:true,
      inventory_available:true,
      days_to_event:2,
      engagement_velocity:78,
      conversation_volume:80,
      fandom_strength:82,
      competitor_activity:60,
      booking_opportunity:76,
      recent_posted_hours_ago:24
    },
    {
      event:'Event D',
      verified_event:true,
      verified_pricing:true,
      inventory_available:true,
      days_to_event:5,
      engagement_velocity:65,
      conversation_volume:68,
      fandom_strength:74,
      competitor_activity:45,
      booking_opportunity:62,
      recent_posted_hours_ago:24
    }
  ];
}

test('X posting planner uses Bangkok evening slots and penalizes recent-post fatigue',()=>{
  const result=Planner.plan({candidates:candidates()});
  assert.equal(result.schema_version,'KK_X_POSTING_PLAN_V1');
  assert.equal(result.timezone,'Asia/Bangkok');
  assert.deepEqual(result.slots.map(x=>x.time),['19:30','21:00','22:30','00:00']);
  assert.equal(result.slots[0].event,'Event B');
  assert.notEqual(result.slots[0].event,'Event A');
  assert.equal(result.slots[3].action,'CONVERSATION_CAPTURE');
  assert.equal(new Set(result.slots.map(x=>x.event).filter(Boolean)).size,result.slots.filter(x=>x.event).length);
  assert.equal(result.production_writes,0);
  assert.equal(result.publishes,0);
});

test('planner exposes the six scoring dimensions plus recent-post fatigue',()=>{
  const result=Planner.plan({candidates:candidates()});
  const row=result.ranking.find(x=>x.event==='Event B');
  assert.ok(row);
  assert.deepEqual(Object.keys(row.dimensions).sort(),[
    'booking_opportunity',
    'competitor_activity',
    'conversation_volume',
    'engagement_velocity',
    'event_proximity',
    'fandom_strength'
  ]);
  assert.equal(typeof row.recent_post_fatigue,'number');
  assert.equal(row.marketing_agent.schema_version,'KK_MARKETING_AGENT_V2_X_SIGNAL');
});

test('plain Thai/X planning request auto-routes through the Agent Gateway',async()=>{
  const ledger=[];
  const result=await Gateway.executeAgentRequest({
    message:'ไปตรวจสอบ X ว่าตอนนี้ควรโพสอะไรต่อจากเดิม ตั้งแต่ 19.30 ไปจนถึงช่วง late night',
    input:{candidates:candidates()}
  },{
    projectMemoryListFn:async()=>({rows:[]}),
    ledgerFn:async row=>{ledger.push(row);return {ok:true,inserted:true,invocation_id:row.invocation_id};}
  });
  assert.equal(result.status,'RECORDED');
  assert.equal(result.intent,'x_posting_plan');
  assert.deepEqual(result.invocation.required_agents,['kk-marketing-agent']);
  assert.deepEqual(result.invocation.invoked_agents,['kk-marketing-agent']);
  assert.equal(result.result.timezone,'Asia/Bangkok');
  assert.equal(result.result.slots.length,4);
  assert.equal(result.production_writes,0);
  assert.equal(result.publishes,0);
  assert.equal(ledger.length,1);
});

test('registry declares X posting plan as a live evidenced marketing route',()=>{
  const route=Registry.routeForIntent('x_posting_plan');
  assert.ok(route);
  assert.equal(route.runtime_available,true);
  assert.deepEqual(route.required_agents,['kk-marketing-agent']);
  assert.equal(route.persistent_invocation_evidence_required,true);
});
