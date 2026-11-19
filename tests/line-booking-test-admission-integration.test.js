'use strict';
// Literal child environment; no application imports or ambient configuration.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
for (const mode of ['admission','auth-regression','auth-admitted-regression']) test('guarded LOCAL_MOCK '+mode, () => {
  const env = {LANG:'C',TZ:'UTC'};
  if (process.platform === 'win32' && typeof process.env.SystemRoot === 'string') env.SystemRoot = process.env.SystemRoot;
  const out = spawnSync(process.execPath,['--test-reporter=tap',path.join(__dirname,'fixtures/booking-admission/line-booking-dummy-child.cjs'),mode],
    {env,cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true});
  assert.ifError(out.error);
  assert.equal(out.status,0,out.stdout+'\n'+out.stderr);
  const receipts=out.stdout.split(/\r?\n/).filter(line=>line.startsWith('ADMISSION_RESULT '));
  assert.equal(receipts.length,1); const receipt=JSON.parse(receipts[0].slice(17));
  assert.equal(receipt.evidenceClass,'LOCAL_MOCK');
  assert.equal(receipt.blockedAttempts,0); assert.equal(receipt.denials,0); assert.equal(receipt.pending,0);
  assert.equal(receipt.failures,0); assert.equal(receipt.guardsInstalled,true);
  if(mode.endsWith('regression')) assert.match(out.stdout,/# pass 3\b/);
  console.log('ADMISSION_EVIDENCE '+JSON.stringify(receipt));
});
