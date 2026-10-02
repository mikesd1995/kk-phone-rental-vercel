'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Gate=require('../scripts/storefront-release-gate.js');

function acceptedReview(digest){
  return {
    status:'PASS',
    owner_decision:'ACCEPTED',
    baseline_comparison_pass:true,
    screenshot_artifact_id:123,
    frontend_digest:digest,
    reviewed_viewports:[320,375,390,430,480,768,1024,1440]
  };
}

test('backend-only candidate does not require storefront owner visual acceptance',()=>{
  const out=Gate.evaluate({
    baseSha:'a'.repeat(40),
    candidateSha:'b'.repeat(40),
    files:['api/kk-data.js','server/kk-agent-gateway.js'],
    review:{status:'BLOCKED'},
    identity:{digest:'x'}
  });
  assert.equal(out.status,'PASS');
  assert.equal(out.reason,'NO_STOREFRONT_RELEASE_CHANGE');
  assert.equal(out.owner_visual_acceptance_required,false);
});

test('storefront presentation change blocks without exact frontend owner acceptance',()=>{
  const out=Gate.evaluate({
    baseSha:'a'.repeat(40),
    candidateSha:'b'.repeat(40),
    files:['assets/kk-storefront-v5.css'],
    review:{status:'PASS',owner_decision:'ACCEPTED',baseline_comparison_pass:true,screenshot_artifact_id:123,frontend_digest:'stale',reviewed_viewports:[320,375,390,430,480,768,1024]},
    identity:{digest:'candidate'}
  });
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.reason,'OWNER_VISUAL_ACCEPTANCE_REQUIRED');
  assert.deepEqual(out.acceptance.missing_widths,[1440]);
  assert.equal(out.acceptance.reviewed_frontend_digest,'stale');
});

test('storefront presentation change passes only with exact digest and all required widths',()=>{
  const out=Gate.evaluate({
    baseSha:'a'.repeat(40),
    candidateSha:'b'.repeat(40),
    files:['index.html','assets/kk-storefront-v5.css'],
    review:acceptedReview('candidate'),
    identity:{digest:'candidate'}
  });
  assert.equal(out.status,'PASS');
  assert.equal(out.reason,'OWNER_VISUAL_ACCEPTANCE_MATCHES_CANDIDATE');
  assert.equal(out.owner_visual_acceptance_required,true);
});

test('automatic Git production on main is disabled and explicit workflow enforces the release gate',()=>{
  const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.equal(vercel.git.deploymentEnabled.main,false);
  const workflow=fs.readFileSync('.github/workflows/storefront-v60-prebuilt-production.yml','utf8');
  assert.match(workflow,/Resolve current READY main production/);
  assert.match(workflow,/storefront-release-gate\.js --base-sha "\$BASE_SHA" --candidate-sha "\$SHA"/);
  assert.match(workflow,/githubCommitRef/);
  assert.match(workflow,/target=production/);
});
