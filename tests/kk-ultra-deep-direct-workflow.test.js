'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const workflowPath='.github/workflows/ultra-deep-full-loop.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');

test('direct Full Loop requires production runtime V2 and completion gate V2',()=>{
  assert.match(workflow,/KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2/);
  assert.match(workflow,/KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V2/);
});

test('direct Full Loop refreshes production only when executor contract is stale',()=>{
  assert.match(workflow,/Refresh production executor once when contract is stale/);
  assert.match(workflow,/steps\.endpoint\.outputs\.compatible != 'true'/);
  assert.match(workflow,/vercel deploy --prebuilt --prod/);
});

test('compatible production path verifies contract again before governed write',()=>{
  assert.match(workflow,/Verify compatible production executor contract/);
  assert.match(workflow,/Execute governed production Full Loop/);
  assert.ok(workflow.indexOf('Verify compatible production executor contract') < workflow.indexOf('Execute governed production Full Loop'));
});

test('normal compatible data runs do not unconditionally deploy',()=>{
  const refreshBlock=workflow.split('- name: Refresh production executor once when contract is stale')[1]||'';
  assert.match(refreshBlock,/if: \$\{\{ steps\.commercial_gate\.outcome == 'success' && steps\.endpoint\.outputs\.compatible != 'true' \}\}/);
});
