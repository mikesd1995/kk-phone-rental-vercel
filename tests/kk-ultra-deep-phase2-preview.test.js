'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync(require.resolve('../api/kk-ultra-deep-phase2-preview.js'),'utf8');

test('preview Phase 2 executor is non-production and explicit-confirm only',()=>{
 assert.match(src,/VERCEL_ENV\)!=='preview'/);
 assert.match(src,/VERCEL_GIT_COMMIT_REF/);
 assert.match(src,/fix\/ultra-deep-learn-ryo-brand-social-miss/);
 assert.match(src,/PHASE2_READ_ONLY_CONFIRM_REQUIRED/);
 assert.match(src,/req\.method!=='GET'/);
});

test('preview Phase 2 executor cannot write or start Phase 3',()=>{
 assert.match(src,/phase:'PHASE2'/);
 assert.match(src,/stopAfterPhase2:true/);
 assert.match(src,/executeWrites:false/);
 assert.match(src,/PHASE2_READ_ONLY_INVARIANT_BROKEN/);
 assert.match(src,/production_writes:0/);
 assert.match(src,/phase3_started:false/);
 assert.doesNotMatch(src,/executeWrites:true/);
});
