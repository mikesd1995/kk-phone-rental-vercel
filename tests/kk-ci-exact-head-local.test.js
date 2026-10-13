'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const script=path.join(__dirname,'..','scripts','kk-ci-exact-head-local.sh');
const source=fs.readFileSync(script,'utf8');

test('offline acceptance helper has valid Bash syntax',()=>{
  const out=cp.spawnSync('bash',['-n',script],{encoding:'utf8'});
  assert.equal(out.status,0,out.stderr);
});
test('rejects malformed SHA before running any code',()=>{
  const out=cp.spawnSync('bash',[script,'INVALID_SHA'],{encoding:'utf8'});
  assert.equal(out.status,2);
  assert.match(out.stderr,/BLOCKED_INVALID_EXACT_SHA/);
});
test('rejects mismatched exact commit inside a clean temporary Git repository',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'kk-ci-local-'));
  try{
    const init=cp.spawnSync('git',['init','-q'],{cwd,encoding:'utf8'});
    assert.equal(init.status,0,init.stderr);
    const commit=cp.spawnSync('git',['-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','fixture'],{cwd,encoding:'utf8'});
    assert.equal(commit.status,0,commit.stderr);
    const out=cp.spawnSync('bash',[script,'0000000000000000000000000000000000000000'],{cwd,encoding:'utf8'});
    assert.equal(out.status,2);
    assert.match(out.stderr,/BLOCKED_SHA_MISMATCH/);
  } finally {fs.rmSync(cwd,{recursive:true,force:true});}
});
test('never masquerades as GitHub CI or installs unpinned dependencies',()=>{
  assert.match(source,/LOCAL_ONLY_PASS/);
  assert.match(source,/GitHub_actions_pass=false release_ready=false/);
  assert.match(source,/node scripts\/kk-ci-offline-dependency-gate\.js ultradeep/);
  assert.match(source,/npm run test:ultradeep:recall/);
  assert.match(source,/node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js/);
  assert.doesNotMatch(source,/^npm\s+(?:ci|install|i)(?:\s|$)/m);
});
