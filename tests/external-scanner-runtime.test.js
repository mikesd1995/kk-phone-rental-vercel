'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/external-scanner-runtime');

function envelope(){
  const scheduled='2026-09-18T23:00:00+07:00';
  return {
    version:R.VERSION,
    role:'SCANNER',
    occurrence_id:R.occurrenceIdFor(scheduled),
    scheduled_at:scheduled,
    issued_at:'2026-09-18T23:00:10+07:00',
    nonce:'nonce-20260918T230000-01',
    source:R.SOURCE
  };
}

test('signed external Scanner envelope verifies at Bangkok top-of-hour',()=>{
  const e=envelope();
  const secret='test-secret-not-production';
  const signature=R.signEnvelope(secret,e);
  const v=R.verifyEnvelope({
    secret,
    signature,
    envelope:e,
    options:{nowMs:Date.parse('2026-09-18T23:00:30+07:00')}
  });
  assert.equal(v.envelope.occurrence_id,'SCANNER|2026-09-18T23:00:00+07:00');
  assert.match(v.payload_hash,/^[0-9a-f]{64}$/);
});

test('tampered payload is rejected by HMAC verification',()=>{
  const e=envelope();
  const secret='test-secret-not-production';
  const signature=R.signEnvelope(secret,e);
  e.nonce='nonce-20260918T230000-02';
  assert.throws(()=>R.verifyEnvelope({
    secret,
    signature,
    envelope:e,
    options:{nowMs:Date.parse('2026-09-18T23:00:30+07:00')}
  }),err=>err.code==='TRIGGER_SIGNATURE_INVALID');
});

test('occurrence identity must be deterministic from scheduled_at',()=>{
  const e=envelope();
  e.occurrence_id='SCANNER|2026-09-18T22:00:00+07:00';
  assert.throws(()=>R.validateEnvelope(e,{
    nowMs:Date.parse('2026-09-18T23:00:30+07:00')
  }),err=>err.code==='TRIGGER_OCCURRENCE_ID_INVALID');
});

test('non top-of-hour Scanner trigger is rejected',()=>{
  const e=envelope();
  e.scheduled_at='2026-09-18T23:05:00+07:00';
  e.occurrence_id='SCANNER|2026-09-18T23:05:00+07:00';
  assert.throws(()=>R.validateEnvelope(e,{
    nowMs:Date.parse('2026-09-18T23:05:10+07:00')
  }),err=>err.code==='TRIGGER_SCHEDULE_INVALID');
});

test('stale trigger is rejected before any ledger or business action',()=>{
  const e=envelope();
  assert.throws(()=>R.validateEnvelope(e,{
    nowMs:Date.parse('2026-09-19T00:00:30+07:00')
  }),err=>['TRIGGER_ISSUED_AT_STALE','TRIGGER_SCHEDULE_STALE'].includes(err.code));
});

test('external ingress is Scanner-only',()=>{
  const e=envelope();
  e.role='VERIFIER';
  assert.throws(()=>R.validateEnvelope(e,{
    nowMs:Date.parse('2026-09-18T23:00:30+07:00')
  }),err=>err.code==='TRIGGER_ROLE_INVALID');
});
