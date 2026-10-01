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
  assert.equal(out.result.synthesis.implementation_writer,'single implementation agent only');
  assert.equal(out.result.safety.production_writes,0);
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
