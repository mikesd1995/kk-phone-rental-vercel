'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='.github/workflows/phase4-zero-cost-existing-preview-recovery.yml';
const w=fs.readFileSync(path,'utf8');

test('zero-cost recovery is owner-comment gated and exact-main pinned',()=>{
  assert.match(w,/github\.event\.issue\.number == 213/);
  assert.match(w,/author_association == 'OWNER'/);
  assert.match(w,/\/run-phase4-zero-cost-promote/);
  assert.match(w,/git ls-remote origin refs\/heads\/main/);
  assert.match(w,/test "\$CURRENT_MAIN" = "\$APPROVED_SHA"/);
});

test('zero-cost recovery never creates a Vercel deployment',()=>{
  assert.doesNotMatch(w,/vercel deploy/);
  assert.doesNotMatch(w,/--prebuilt/);
  assert.match(w,/promote\/\$CANDIDATE_ID/);
  assert.match(w,/reuse_existing_ready_preview_no_new_deployment/);
});

test('candidate runtime tree must equal current main outside tests docs and workflows',()=>{
  assert.match(w,/git diff --name-only "\$CANDIDATE_SHA" "\$APPROVED_SHA"/);
  assert.match(w,/'\:\(exclude\)tests\/\*\*'/);
  assert.match(w,/'\:\(exclude\)docs\/\*\*'/);
  assert.match(w,/'\:\(exclude\)\.github\/\*\*'/);
  assert.match(w,/test -s runtime-diff\.txt/);
});

test('preview promotion fails closed on env target drift and branch overrides',()=>{
  assert.match(w,/env-target-audit\.json/);
  assert.match(w,/UNSAFE_ENV_TARGET_DRIFT/);
  assert.match(w,/branchOverride/);
  assert.match(w,/target\.includes\('production'\).*target\.includes\('preview'\)/s);
});

test('candidate receives read-only acceptance before promotion',()=>{
  const acceptance=w.indexOf('Candidate read-only acceptance');
  const promote=w.indexOf('Promote existing accepted Preview without creating a deployment');
  assert.ok(acceptance>0 && promote>acceptance);
  assert.match(w,/kk-admin-auth/);
  assert.match(w,/kk-rental-dashboard/);
  assert.match(w,/kk-data\?sheet=08_Web_Ready/);
  assert.match(w,/PUBLIC_DATA_PARITY_MISMATCH/);
});

test('post-promotion acceptance has rollback to previous production',()=>{
  const promote=w.indexOf('Promote existing accepted Preview without creating a deployment');
  const verify=w.indexOf('Verify live Phase 4; rollback on mismatch');
  assert.ok(verify>promote);
  assert.match(w,/restoring previous Production deployment/);
  assert.match(w,/promote\/\$PREVIOUS_ID/);
  assert.match(w,/seamless-phase4-20260926/);
});

test('recovery evidence explicitly records no business writes and no PIN use',()=>{
  assert.match(w,/admin_pin_used:false/);
  assert.match(w,/sheet_business_writes:0/);
  assert.match(w,/booking_price_stock_visibility_writes:0/);
  assert.match(w,/secret_values_logged:false/);
});
