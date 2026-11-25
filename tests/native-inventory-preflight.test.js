'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Native=require('../scripts/native-inventory-preflight.cjs');
const now='2026-11-13T02:00:00.000Z';
const ref='sha256:'+'a'.repeat(64);
function complete(){
  const p=Native.template();
  p.collectedAtUTC=now;
  p.project.status='ACTIVE_HEALTHY';p.project.observedAtUTC=now;p.project.evidenceRef=ref;
  p.source.sha='7'.repeat(40);p.source.evidenceRef=ref;
  p.containment.state='EVIDENCED_HELD';p.containment.evidenceRef=ref;
  p.transition.state='EVIDENCED_CONTINUOUS';p.transition.evidenceRef=ref;
  for(const item of [...p.inventory,...p.dispositions])Object.assign(item,{state:'EVIDENCED_NONE',itemCount:0,heldItemCount:0,evidenceRef:ref});
  return p;
}
function evaluate(p,options={}){return Native.evaluate(p,{now,maxAgeSeconds:900,...options});}
test('default template preserves unknown native state, zero budgets and all required classes',()=>{
  const p=Native.template(),r=evaluate(p);
  assert.equal(p.inventory.length,11);assert.equal(new Set(p.inventory.map(x=>x.name)).size,11);
  assert.equal(p.dispositions.length,7);
  assert.ok(p.inventory.every(x=>x.state==='UNKNOWN'&&x.itemCount===null));
  assert.equal(r.structuralComplete,false);assert.equal(r.runtimeGo,false);
  assert.equal(r.executionAuthorized,false);assert.equal(r.c1Decision,'NOT_ASSESSED_KEEP_OFF');
  assert.ok(Object.values(p.authority.budgets).every(x=>x===0));
});
test('complete synthetic packet is structural preparation only, never native/C1/runtime acceptance',()=>{
  const r=evaluate(complete());assert.equal(r.structuralComplete,true);
  assert.equal(r.status,'STRUCTURALLY_COMPLETE_REQUIRES_INDEPENDENT_EVIDENCE_REVIEW');
  assert.equal(r.workerState,'UNKNOWN');assert.equal(r.runtimeGo,false);assert.equal(r.executionAuthorized,false);
  assert.equal(r.evidenceAuthenticityVerified,false);assert.equal(r.c1Decision,'NOT_ASSESSED_KEEP_OFF');
});
for(const name of ['QUEUES','OUTBOXES','RETRIES','ATTEMPTS','NONCES','ARM','FENCES'])test('unknown '+name+' disposition cannot be erased by complete catalog',()=>{
  const p=complete();p.dispositions.find(x=>x.name===name).state='UNKNOWN';
  assert.equal(evaluate(p).structuralComplete,false);
});
test('missing or duplicate catalog classes and extra categories fail closed',()=>{
  for(const mutate of [p=>p.inventory.pop(),p=>p.inventory[1]={...p.inventory[0]},p=>p.inventory.push({...p.inventory[0],name:'MADE_UP'})]){
    const p=complete();mutate(p);assert.equal(evaluate(p).structuralComplete,false);
  }
});
test('none requires numeric zero and held requires all nonempty items held',()=>{
  for(const [state,itemCount,heldItemCount,ok] of [
    ['EVIDENCED_NONE',0,0,true],['EVIDENCED_NONE',null,null,false],['EVIDENCED_NONE','0',0,false],
    ['EVIDENCED_NONE',1,0,false],['EVIDENCED_HELD',2,2,true],['EVIDENCED_HELD',2,1,false],
    ['EVIDENCED_HELD',0,0,false],['EVIDENCED_HELD',-1,-1,false],['EVIDENCED_HELD',1.5,1.5,false]
  ]){const p=complete();Object.assign(p.inventory[0],{state,itemCount,heldItemCount});assert.equal(evaluate(p).structuralComplete,ok);}
});
test('completeness class cannot use held records to conceal unexamined classes',()=>{
  const p=complete(),last=p.inventory.at(-1);Object.assign(last,{state:'EVIDENCED_HELD',itemCount:1,heldItemCount:1});
  assert.equal(evaluate(p).structuralComplete,false);
});
test('exact runtime project and current-active observation are required',()=>{
  for(const mutate of [p=>p.project.id='mxjnjujqjybqughsnqbz',p=>p.project.status='INACTIVE',p=>p.project.status='UNKNOWN']){
    const p=complete();mutate(p);assert.equal(evaluate(p).structuralComplete,false);
  }
});
test('source binding, evidence hashes and known inspected containment/continuity are required',()=>{
  for(const mutate of [p=>p.source.sha=null,p=>p.source.sha='main',p=>p.source.evidenceRef='url-with-key',p=>p.containment.state='UNKNOWN',p=>p.transition.state='UNKNOWN',p=>p.transition.previousStatus='ACTIVE_HEALTHY']){
    const p=complete();mutate(p);assert.equal(evaluate(p).structuralComplete,false);
  }
});
test('stale, future, malformed or misordered timestamps and invalid evaluator clock fail closed',()=>{
  for(const mutate of [p=>p.collectedAtUTC='2026-11-12T02:00:00.000Z',p=>p.collectedAtUTC='2026-11-14T02:00:00.000Z',p=>p.collectedAtUTC='today',p=>p.project.observedAtUTC='2026-11-14T02:00:00.000Z']){
    const p=complete();mutate(p);assert.equal(evaluate(p).structuralComplete,false);
  }
  assert.equal(evaluate(complete(),{now:'bad'}).structuralComplete,false);
  assert.equal(evaluate(complete(),{maxAgeSeconds:Infinity}).structuralComplete,false);
});
test('authority must explicitly remain OFF, unarmed and exact zero budgets',()=>{
  for(const mutate of [p=>p.authority.keepOff=false,p=>p.authority.executionAuthorized=true,p=>p.authority.budgets.health=1,p=>delete p.authority.budgets.replay,p=>p.authority.budgets.nativeClaim='0']){
    const p=complete();mutate(p);assert.equal(evaluate(p).structuralComplete,false);
  }
});
test('unexpected fields, raw nonces or credential-like values cannot enter output',()=>{
  for(const mutate of [p=>p.secret='SUPER_SECRET',p=>p.project.token='SUPER_SECRET',p=>p.dispositions[0].nonce='SUPER_SECRET',p=>p.source.evidenceRef='SUPER_SECRET']){
    const p=complete();mutate(p);const r=evaluate(p);assert.equal(r.structuralComplete,false);assert.ok(!JSON.stringify(r).includes('SUPER_SECRET'));
  }
});
test('malformed input, unsupported prototype and getters cannot be mistaken for plain JSON',()=>{
  for(const p of [null,[],{},'secret',Object.create({schema:Native.SCHEMA})])assert.equal(evaluate(p).structuralComplete,false);
  const p=complete();let reads=0;Object.defineProperty(p,'schema',{enumerable:true,get(){reads++;throw Error('secret');}});
  assert.equal(evaluate(p).structuralComplete,false);assert.equal(reads,0);
});
test('CLI supports local template and bounded local JSON only; all execution arguments are denied',()=>{
  assert.equal(Native.run([]).exitCode,0);assert.equal(Native.run(['--template']).exitCode,0);
  let reads=0;const readInput=()=>{reads++;return JSON.stringify(complete());};
  assert.equal(Native.run(['--input','fixture.json'],{readInput,now,maxAgeSeconds:900}).result.structuralComplete,true);
  for(const args of [['--probe'],['--execute'],['--input'],['--input','fixture.json','--execute'],['--input','fixture.json','--input','fixture.json']])assert.equal(Native.run(args,{readInput}).exitCode,2);
  assert.equal(reads,1);
  for(const read of [()=>'{',()=>JSON.stringify(complete())+' '.repeat(Native.MAX_INPUT_BYTES),()=>{throw Error('secret');}]){
    const r=Native.run(['--input','fixture.json'],{readInput:read});assert.equal(r.exitCode,2);assert.ok(!JSON.stringify(r).includes('secret'));
  }
});
test('network, scheme, drive-relative and Windows device input paths are denied before any filesystem read',()=>{
  let reads=0;const readInput=()=>{reads++;return JSON.stringify(complete());};
  for(const file of ['\\\\host\\share\\packet.json','//host/share/packet.json','\\/host/share/packet.json',
    'file:///C:/packet.json','https://host/packet.json','\\\\?\\C:\\packet.json','\\\\.\\pipe\\packet',
    'C:packet.json','packet.json:stream','CON','NUL.json','relative/COM1.json']){
    assert.equal(Native.run(['--input',file],{readInput,now}).exitCode,2,file);
  }
  assert.equal(reads,0);
  for(const file of ['fixture.json','../fixtures/packet.json','C:/fixtures/packet.json','C:\\fixtures\\packet.json']){
    assert.equal(Native.run(['--input',file],{readInput,now}).exitCode,0,file);
  }
  assert.equal(reads,4);
});
test('offline preparation never imports runtime client, executes process or dispatches network',()=>{
  const source=fs.readFileSync(require.resolve('../scripts/native-inventory-preflight.cjs'),'utf8');
  assert.doesNotMatch(source,/require\(['"](?:node:)?(?:https?|https2|net|tls|child_process)|require\(['"].*runtime-ledger|\bfetch\s*\(/);
});
