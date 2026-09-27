'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Router=require('../server/kk-agent-task-router.js');
const Registry=require('../server/kk-agent-registry.js');

test('Agent Router executes Ultra Deep gap plan through explicitly bound provider',async()=>{
  const out=await Router.executeTask('execute_ultra_deep_gaps',{plan:{gap_tasks:[{source_tier:'SOCIAL',providers:['SEARXNG','EXA']}]}},{
    ultraDeepProviders:{SEARXNG:async()=>[{title:'Event',source_url:'https://example.com/social'}]}
  });
  assert.deepEqual(out.invoked_agents,['kk-discovery-source-watch','kk-discovery-scanner']);
  assert.equal(out.result.status,'GAPS_RESOLVED');
  assert.equal(out.result.results[0].provider,'SEARXNG');
  assert.equal(out.result.production_writes,0);
});

test('Registry exposes provider execution as callable but provider-gated',()=>{
  const route=Registry.routeForIntent('execute_ultra_deep_gaps');
  assert.equal(route.runtime_available,true);
  assert.equal(route.provider_executor_required,true);
});
