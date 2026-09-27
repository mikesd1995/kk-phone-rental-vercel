'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const workflowPath='.github/workflows/rental-analytics-prebuilt-production-recovery.yml';

test('prebuilt Production recovery remains exact-main and owner-triggered',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.match(w,/github\.event\.issue\.number == 164/);
  assert.match(w,/github\.event\.comment\.user\.login == github\.repository_owner/);
  assert.match(w,/author_association == 'OWNER'/);
  assert.match(w,/\/run-rental-analytics-prebuilt /);
  assert.match(w,/git merge-base --is-ancestor "\$RENTAL_ANALYTICS_FIX_SHA" "\$APPROVED_SHA"/);
  assert.match(w,/test "\$CURRENT_MAIN" = "\$APPROVED_SHA"/);
});

test('prebuilt candidate is created without switching Production traffic first',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.match(w,/vercel build --prod/);
  assert.match(w,/--prebuilt/);
  assert.match(w,/--prod/);
  assert.match(w,/--skip-domain/);
  const candidate=w.indexOf('Create unaliased prebuilt Production candidate');
  const promote=w.indexOf('Promote accepted candidate to Production traffic');
  const acceptance=w.indexOf('Candidate route acceptance before traffic switch');
  assert.ok(candidate>=0 && acceptance>candidate && promote>acceptance);
});

test('recovery validates v6 route shape and has bounded rollback',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.match(w,/analytics\.error!=='Unauthorized'/);
  assert.match(w,/promote\/\$PREVIOUS_ID/);
  assert.match(w,/rollback_requested=true/);
  assert.match(w,/business_writes:0/);
  assert.match(w,/admin_pin_used:false/);
});

test('recovery never performs Apps Script or Google Sheet writes',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.doesNotMatch(w,/script\.google\.com|spreadsheets\.googleapis\.com/);
  assert.match(w,/google_sheet_writes:0/);
  assert.match(w,/apps_script_writes:0/);
});


test('protected candidate acceptance uses Vercel-authenticated curl without weakening Deployment Protection',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.match(w,/Candidate route acceptance before traffic switch[\s\S]*VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(w,/npx vercel curl \/api\/kk-admin-auth --deployment "\$CANDIDATE_URL" > candidate-auth\.json/);
  assert.match(w,/npx vercel curl \/api\/kk-rental-dashboard --deployment "\$CANDIDATE_URL" > candidate-analytics\.json/);
  assert.match(w,/npx vercel curl \/ --deployment "\$CANDIDATE_URL" > candidate-root\.html/);
  assert.doesNotMatch(w,/vercel curl [^\n]*--token/);
  assert.doesNotMatch(w,/vercel curl .* -sS/);
  assert.doesNotMatch(w,/vercel curl .* -w '%\{http_code\}'/);
  assert.doesNotMatch(w,/protection-bypass/);
  assert.doesNotMatch(w,/x-vercel-protection-bypass/);
});
