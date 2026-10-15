'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Corpus=require('../config/kk-project-memory.json');
const Memory=require('../server/kk-project-memory.js');

test('canonical project memory bootstraps with the owner X content rule',()=>{
  const result=Memory.buildBootstrap(Corpus.items,{domains:['content'],limit:80});
  assert.equal(result.status,'READY',JSON.stringify(result.blockers||[]));
  const rule=result.context.find(x=>x.memory_id==='kk:memory:content:x-owner-gated-copy:20261013');
  assert.ok(rule,'owner X rule is absent from project memory');
  assert.equal(rule.kind,'LOCKED_RULE');
  assert.match(rule.summary,/Agent/);
  assert.match(rule.summary,/✅ ว่าง/);
  assert.match(rule.summary,/❌ เต็ม/);
  assert.match(rule.summary,/ONLY ✅ ว่าง or ❌ เต็ม/);
  assert.doesNotMatch(rule.summary,/🚫 ปิด/);
  assert.match(rule.summary,/owner-facing copy/);
});
