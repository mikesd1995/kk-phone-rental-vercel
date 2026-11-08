'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {evaluate,SCHEMA}=require('../scripts/qa/kk-active-poster-acl-evidence-20261107.cjs');
const file=path.resolve(__dirname,'../evidence/kk-active-poster-acl-snapshot-20261107.json');
const baseline=JSON.parse(fs.readFileSync(file,'utf8'));
const clone=()=>JSON.parse(JSON.stringify(baseline));

test('live dated ACL evidence totals 45 public writer files and 1 no-anyone grant',()=>{
  const r=evaluate(baseline);
  assert.equal(r.distinct_google_drive_posters,46);
  assert.equal(r.visible_events,106);
  assert.equal(r.non_drive_poster_url_rows,48);
  assert.deepEqual(r.counts,{writer:45,reader:0,none:1,unreadable:0});
  assert.equal(r.result,'P0_BLOCKED');
  assert.equal(r.production_acl_changed,false);
  assert.equal(r.release_authorized,false);
  assert.ok(r.issues.includes('SIGNED_OUT_IMAGE_DELIVERY_UNVERIFIED'));
});

test('evidence manifest stores only ordinal roles and contains no image URLs or IDs',()=>{
  assert.equal(baseline.schema,SCHEMA);
  assert.deepEqual(Object.keys(baseline.public_permissions[0]).sort(),['anyone_permission','position']);
  assert.ok(baseline.public_permissions.every((p,i)=>p.position===i+1));
  for(const row of baseline.public_permissions){
    assert.ok(!('file_id' in row)&&!('url' in row)&&!('customer' in row));
  }
  assert.ok(!Object.keys(baseline).includes('credentials'));
});

test('incomplete, duplicate, unordered, unknown and injected role records fail closed',()=>{
  const scenarios=[
    s=>s.public_permissions.pop(),
    s=>{s.public_permissions[2].position=2;},
    s=>{s.public_permissions[1].anyone_permission='owner';},
    s=>{s.public_permissions[4].file_id='SHOULD_NOT_COMMIT';},
    s=>{s.public_permissions[6].anyone_permission='__proto__';},
    s=>{s.scope.distinct_google_drive_poster_files=47;},
    s=>{s.observation_date='today';}
  ];
  for(const mutate of scenarios){
    const s=clone();mutate(s);
    assert.throws(()=>evaluate(s),/INVALID|INCOMPLETE/,JSON.stringify(scenarioName(mutate)));
  }
});
function scenarioName(fn){return fn.toString().slice(0,100);}

test('zero public writers from a hypothetical future snapshot still does not authorize production release',()=>{
  const s=clone();
  s.public_permissions=s.public_permissions.map(p=>({...p,anyone_permission:'reader'}));
  const r=evaluate(s);
  assert.equal(r.counts.writer,0);
  assert.equal(r.result,'REVIEW_REQUIRED');
  assert.equal(r.production_acl_changed,false);
  assert.equal(r.release_authorized,false);
  assert.ok(r.issues.includes('OWNER_GATED_LIVE_RECHECK_REQUIRED'));
});

test('an unreadable ACL or missing signed-out proof never becomes a clean security declaration',()=>{
  const s=clone();
  s.public_permissions=s.public_permissions.map(p=>({...p,anyone_permission:'reader'}));
  s.public_permissions[0].anyone_permission='unreadable';
  assert.equal(evaluate(s).result,'EVIDENCE_INCOMPLETE');
  s.public_permissions[0].anyone_permission='none';
  assert.ok(evaluate(s).issues.includes('SIGNED_OUT_IMAGE_DELIVERY_UNVERIFIED'));
});

test('the evidence reporter contains no external/network/permission mutation calls',()=>{
  const code=fs.readFileSync(path.resolve(__dirname,'../scripts/qa/kk-active-poster-acl-evidence-20261107.cjs'),'utf8');
  assert.doesNotMatch(code,/(?:require\(['"](?:http|https|child_process|@google)|fetch\(|permissions\.(?:create|delete|update)\s*\()/);
  assert.match(code,/production_acl_changed:false/);
  assert.match(code,/release_authorized:false/);
});
