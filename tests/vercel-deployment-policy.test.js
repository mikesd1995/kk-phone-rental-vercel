'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const config=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
const rules=config.git?.deploymentEnabled||{};

test('Git auto deploys only production main and deliberate release candidates',()=>{
  assert.equal(rules['**'],false,'default deny all branches');
  assert.equal(rules.main,true,'main must continue production deployment');
  assert.equal(rules['release/**'],true,'approved release candidate pattern');
  for(const branch of ['fix/','feat/','chore/','docs/','experiment/']){
    assert.ok(!Object.keys(rules).some(x=>x.startsWith(branch)&&rules[x]===true),
      'no broad automatic preview pattern: '+branch);
  }
});

test('storage remediation cannot disturb existing function routing or ignore gate',()=>{
  assert.equal(config.ignoreCommand,'node scripts/vercel-ignore-build.js');
  assert.ok(config.rewrites.some(r=>r.source==='/api/kk-admin'));
  assert.ok(config.rewrites.some(r=>r.source==='/api/kk-data'||r.source==='/event/:eventId'),
    'customer API route must remain present');
  assert.equal(config.functions['api/kk-scanner-dispatch.js'].maxDuration,300);
});
