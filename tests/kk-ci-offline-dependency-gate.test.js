'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Gate=require('../scripts/kk-ci-offline-dependency-gate.js');
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kk-ci-offline-'));
 const write=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
 try{return fn({root,write})}finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('offline gate passes Node-only import closure without any lockfile or network',()=>{
 fixture(({root,write})=>{
  write('tests/entry.test.js',"'use strict';const x=require('../lib/logic.js');const t=require('node:test');t('works',()=>{if(!x)throw Error('missing')});");
  write('lib/logic.js',"const fs=require('node:fs');module.exports=!!fs;");
  const result=Gate.inspect(root,['tests/entry.test.js']);
  assert.equal(result.status,'PASS');
  assert.equal(result.checked_files,2);
  assert.equal(result.production_writes,0);
  assert.equal(result.hosted_ci_pass,false);
 });
});
test('offline gate holds when a third-party module requires a lockfile',()=>{
 fixture(({root,write})=>{
  write('tests/entry.test.js',"const x=require('@vercel/functions');");
  const out=Gate.inspect(root,['tests/entry.test.js']);
  assert.equal(out.status,'HOLD');
  assert.ok(out.blockers.some(x=>x.reason==='EXTERNAL_PACKAGE_REQUIRES_LOCKED_INSTALL'));
  assert.equal(out.external_imports[0].package,'@vercel/functions');
 });
});
test('offline gate refuses missing relative imports and computed requires',()=>{
 fixture(({root,write})=>{
  write('tests/entry.test.js',"require('./not-found');const value='node:fs';require(value);");
  const out=Gate.inspect(root,['tests/entry.test.js']);
  assert.ok(out.blockers.some(x=>x.reason==='LOCAL_MODULE_MISSING'));
  assert.ok(out.blockers.some(x=>x.reason==='DYNAMIC_REQUIRE_OR_IMPORT_NOT_AUDITED'));
 });
});
test('offline gate never accepts a repository-relative path escape',()=>{
 fixture(({root,write})=>{
  write('tests/entry.test.js',"require('../../../private/outside');");
  const out=Gate.inspect(root,['tests/entry.test.js']);
  assert.equal(out.status,'HOLD');
  assert.ok(out.blockers.some(x=>x.reason==='PATH_ESCAPE'));
 });
});
test('recall script parser rejects arbitrary shell commands and missing test entry',()=>{
 assert.deepEqual(Gate.parseRecall('node --test tests/example.test.js'),['tests/example.test.js']);
 assert.throws(()=>Gate.parseRecall('node --test tests/a.test.js && npm install'),/NOT_EXPLICIT_NODE_TEST/);
 assert.throws(()=>Gate.parseRecall('node --test'),/NOT_EXPLICIT_NODE_TEST/);
 assert.throws(()=>Gate.entriesFor('/missing','unrecognized'),/OFFLINE_CI_MODE_INVALID/);
});
test('both workflow acceptance modes select exact dedicated regression entrypoints',()=>{
 fixture(({root,write})=>{
  write('package.json',JSON.stringify({scripts:{'test:ultradeep:recall':'node --test tests/a.test.js'}}));
  const u=Gate.entriesFor(root,'ultradeep'),s=Gate.entriesFor(root,'storage');
  assert.ok(u.includes('tests/a.test.js'));
  assert.ok(u.includes('tests/kk-ultra-deep-full-loop-v2.test.js'));
  assert.ok(u.includes('tests/ultra-deep-v2-workflow-contract.test.js'));
  assert.ok(!s.includes('tests/ultra-deep-v2-workflow-contract.test.js'));
  assert.ok(s.includes('tests/vercel-deployment-footprint.test.js'));
  assert.ok(s.includes('tests/siam-halloween-original-asset.test.js'));
 });
});
