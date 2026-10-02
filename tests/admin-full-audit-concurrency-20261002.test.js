'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const admin=fs.readFileSync('admin/admin.js','utf8');

function fn(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'missing '+name);
  const next=source.indexOf('\nfunction ',start+10);
  return source.slice(start,next===-1?source.length:next);
}

test('all legacy event/package mutations are serialized by the document lock',()=>{
  for(const name of ['kkApiUpdateEvent_','kkApiCreatePackage_','kkApiUpdatePackage_']){
    const block=fn(apps,name);
    assert.match(block,/kkAcquireDocumentLock_\(/,name+' must acquire the document lock');
    assert.match(block,/finally\s*\{\s*lock\.releaseLock\(\)/,name+' must release the document lock');
  }
});

test('event price snapshot and restore execute inside the same serialized update',()=>{
  const block=fn(apps,'kkApiUpdateEvent_');
  assert.ok(block.indexOf("kkAcquireDocumentLock_('update event'") < block.indexOf('kkSnapshotWebPackagePricesForEvent_'));
  assert.ok(block.indexOf('kkSnapshotWebPackagePricesForEvent_') < block.indexOf('kkRestoreWebPackagePricesForEvent_'));
});

test('Admin browser admits only one mutation at a time while allowing readback snapshots',()=>{
  assert.match(admin,/mutationAction:""/);
  assert.match(admin,/if\(isMutation && state\.mutationAction\)/);
  assert.match(admin,/err\.code="ADMIN_MUTATION_IN_FLIGHT"/);
  assert.match(admin,/if\(isMutation\) state\.mutationAction=action/);
  assert.match(admin,/finally\{[\s\S]*state\.mutationAction===action[\s\S]*state\.mutationAction=""/);
  assert.match(admin,/const readOnlyActions=\["snapshot","snapshotHealth","systemHealth","phase1Health"\]/);
});
