'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Planner=require('../server/kk-x-posting-plan-agent.js');
const TaskRouter=require('../server/kk-agent-task-router.js');
const Registry=require('../server/kk-agent-registry.js');
const Bridge=require('../scripts/kk-x-posting-plan-chat-bridge.js');

const NOW='2026-10-02T13:00:00.000Z';

function sig(overrides={}){
  return {
    source_type:'official',
    source_name:'Official',
    published_at:'2026-10-02T12:00:00.000Z',
    observed_at:NOW,
    views:10000,
    views_label_confirmed:true,
    ...overrides
  };
}

function candidate(name,overrides={}){
  return {
    event:name,
    event_key:name.toLowerCase(),
    verified_event:true,
    verified_pricing:true,
    inventory_available:true,
    inventory_remaining:2,
    days_to_event:1,
    x_signals:[sig()],
    ...overrides
  };
}

test('registry requires Marketing Agent and X Posting Plan Agent',()=>{
  const route=Registry.routeForIntent('x_posting_plan');
  assert.ok(route);
  assert.deepEqual(route.required_agents,['kk-marketing-agent','kk-x-posting-plan']);
  assert.equal(route.persistent_invocation_evidence_required,true);
  assert.equal(route.runtime_available,true);
});

test('planner fails closed without current labeled X evidence',()=>{
  const result=Planner.plan({
    now:NOW,
    requested_slots:['prime_time'],
    candidates:[candidate('Stale Event',{x_signals:[sig({published_at:'2026-09-01T00:00:00.000Z'})]})]
  });
  assert.equal(result.status,'BLOCKED_INSUFFICIENT_CURRENT_EVIDENCE');
  assert.equal(result.slots.length,0);
});

test('fresh X momentum beats historical raw scale',()=>{
  const result=Planner.plan({
    now:NOW,
    requested_slots:['prime_time'],
    candidates:[
      candidate('Fresh Event',{x_signals:[sig({views:25000})]}),
      candidate('Historical Giant',{x_signals:[sig({published_at:'2026-09-01T00:00:00.000Z',views:3000000})]})
    ]
  });
  assert.equal(result.status,'READY');
  assert.equal(result.slots[0].event,'Fresh Event');
  assert.equal(result.candidate_rankings.some(row=>row.event==='Historical Giant'),false);
});

test('recent-post fatigue reduces novelty and prevents blind repeat preference',()=>{
  const result=Planner.plan({
    now:NOW,
    requested_slots:['prime_time','late_night'],
    recent_posts:[{event:'Event A',event_key:'event a',published_at:'2026-10-02T12:20:00.000Z'}],
    candidates:[
      candidate('Event A',{x_signals:[sig({views:30000})]}),
      candidate('Event B',{x_signals:[sig({views:24000})],days_to_event:2})
    ]
  });
  assert.equal(result.status,'READY');
  assert.equal(result.slots.length,2);
  assert.ok(result.candidate_rankings.find(row=>row.event==='Event A').dimensions.novelty < 20);
  assert.ok(result.slots.some(slot=>slot.event==='Event B'));
});

test('task router records both planning agents as invoked',async()=>{
  const result=await TaskRouter.executeTask('x_posting_plan',{
    now:NOW,
    requested_slots:['prime_time'],
    candidates:[candidate('Example')]
  });
  assert.deepEqual(result.invoked_agents,['kk-marketing-agent','kk-x-posting-plan']);
  assert.equal(result.result.status,'READY');
});

test('owner-only chat bridge creates persistent agent invocation evidence',async()=>{
  const payload={now:NOW,requested_slots:['prime_time'],candidates:[candidate('Example')]};
  const event={issue:{number:555,title:'[KK-X-PLAN-RUN] Example',author_association:'OWNER'}};
  const result=await Bridge.runBridge({
    event,
    payload,
    ledgerFn:async row=>({ok:true,inserted:true,invocation_id:row.invocation_id})
  });
  assert.equal(result.status,'PASS');
  assert.equal(result.gateway_status,'RECORDED');
  assert.deepEqual(result.invocation.required_agents,['kk-marketing-agent','kk-x-posting-plan']);
  assert.deepEqual(result.invocation.invoked_agents,result.invocation.required_agents);
  const comment=Bridge.buildComment(result);
  assert.match(comment,/KK X Posting Plan Agent/);
  assert.match(comment,/19:30/);
  assert.match(comment,/Example/);
});

test('bridge refuses non-owner execution',async()=>{
  const payload={now:NOW,requested_slots:['prime_time'],candidates:[candidate('Example')]};
  const event={issue:{number:556,title:'[KK-X-PLAN-RUN] Example',author_association:'CONTRIBUTOR'}};
  const result=await Bridge.runBridge({event,payload});
  assert.equal(result.status,'BLOCKED');
  assert.match(result.blocker,/X_PLAN_OWNER_ONLY/);
  assert.equal(result.gateway_status,'NOT_RUN');
});
