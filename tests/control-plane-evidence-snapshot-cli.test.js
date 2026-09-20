'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const B=require('../server/control-plane-evidence-snapshot.js');

test('snapshot CLI emits sanitized JSON and succeeds for exact v4.9.19 authority',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-cp-snapshot-'));
  const file=path.join(dir,'input.json');
  const input={
    policy_versions:[
      {rule_id:'POLICY_VERSION',rule_value:'v4.9.19 CANONICAL MINIMAL LAUNCHER',policy_version:'v4.9.19',active:true,row_number:320}
    ],
    task_registry:[
      {id:B.CANONICAL_SCANNER_ID,title:'KK Discovery Scanner — Current Policy',schedule:'RRULE:FREQ=HOURLY;BYMINUTE=0',default_timezone:'Asia/Bangkok',is_enabled:false,prompt:'scanner raw prompt'},
      {id:B.CANONICAL_VERIFIER_ID,title:'KK GPT Verifier — Current Policy',schedule:'RRULE:FREQ=HOURLY;BYMINUTE=30',default_timezone:'Asia/Bangkok',is_enabled:false,prompt:'verifier raw prompt'}
    ],
    controls:{}
  };
  fs.writeFileSync(file,JSON.stringify(input));
  const r=spawnSync(process.execPath,['scripts/build-control-plane-evidence-snapshot.js',file],{
    cwd:path.resolve(__dirname,'..'),
    encoding:'utf8'
  });
  assert.equal(r.status,0,r.stderr);
  const out=JSON.parse(r.stdout);
  assert.equal(out.usable,true);
  assert.equal(JSON.stringify(out).includes('scanner raw prompt'),false);
  assert.equal(JSON.stringify(out).includes('verifier raw prompt'),false);
  assert.match(out.evidence_digest_sha256,/^[0-9a-f]{64}$/);
});
