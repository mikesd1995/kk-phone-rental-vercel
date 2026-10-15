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
  assert.match(rule.summary,/excluding locked days from public copy/);
  assert.doesNotMatch(rule.summary,/showing them only as ❌ เต็ม/);
  assert.doesNotMatch(rule.summary,/🚫 ปิด/);
  const latest=result.context.find(x=>x.memory_id==='kk:memory:content:x-post-intent-final-only-mandatory-agent:20261015');
  assert.ok(latest,'owner latest intent rule is absent');
  assert.match(latest.summary,/omitted from public copy/);
});
