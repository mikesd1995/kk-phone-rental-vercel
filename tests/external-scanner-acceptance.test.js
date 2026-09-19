'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/external-scanner-acceptance');
const R=require('../server/external-scanner-runtime');

function row(hour,status='EXPECTED'){
  const scheduled=`2026-09-18T${String(hour).padStart(2,'0')}:00:00+07:00`;
  const out={
    occurrence_id:R.occurrenceIdFor(scheduled),
    role:'SCANNER',
    scheduled_at:scheduled,
    issued_at:`2026-09-18T${String(hour).padStart(2,'0')}:00:05+07:00`,
    nonce:`nonce-20260918T${String(hour).padStart(2,'0')}0000-01`,
    source:R.SOURCE,
    trigger_version:R.VERSION,
    status,
    mode:'WITNESS_ONLY',
    received_at:`2026-09-18T${String(hour).padStart(2,'0')}:00:06+07:00`
  };
  out.payload_hash=R.sha256(R.canonicalizeEnvelope({
    version:out.trigger_version,
    role:out.role,
    occurrence_id:out.occurrence_id,
    scheduled_at:out.scheduled_at,
    issued_at:out.issued_at,
    nonce:out.nonce,
    source:out.source
  }));
  return out;
}

test('six recent consecutive witness expectations pass only the clock witness gate',()=>{
  const rows=[18,19,20,21,22,23].map(h=>row(h));
  const result=A.evaluateWitnessWindow(rows,{
    required:6,
    nowMs:Date.parse('2026-09-18T23:20:00+07:00')
  });
  assert.equal(result.ok,true);
  assert.equal(result.classification,'WITNESS_STREAK_PASS');
  assert.equal(result.consecutive,6);
  assert.equal(result.scanner_runtime_acceptance,false);
  assert.equal(result.production_cutover_authorized,false);
});

test('a missing hourly slot keeps witness acceptance incomplete',()=>{
  const rows=[18,19,20,22,23].map(h=>row(h));
  const result=A.evaluateWitnessWindow(rows,{
    required:6,
    nowMs:Date.parse('2026-09-18T23:20:00+07:00')
  });
  assert.equal(result.ok,false);
  assert.equal(result.classification,'WITNESS_STREAK_INCOMPLETE');
  assert.equal(result.missing_slots,1);
  assert.deepEqual(result.missing_scheduled_at,['2026-09-18T21:00:00+07:00']);
});

test('duplicate slot is invalid rather than counted twice',()=>{
  const rows=[18,19,20,21,22,23].map(h=>row(h));
  rows.push({...row(23),received_at:'2026-09-18T23:00:07+07:00'});
  const result=A.evaluateWitnessWindow(rows,{
    required:6,
    nowMs:Date.parse('2026-09-18T23:20:00+07:00')
  });
  assert.equal(result.ok,false);
  assert.equal(result.classification,'WITNESS_DATA_INVALID');
  assert.equal(result.duplicate_slots.length,1);
});

test('malformed role/source/version/mode cannot satisfy witness acceptance',()=>{
  const rows=[18,19,20,21,22,23].map(h=>row(h));
  rows[2].role='VERIFIER';
  rows[3].source='UNKNOWN';
  rows[4].trigger_version='old-version';
  rows[5].mode='EXECUTE';
  const result=A.evaluateWitnessWindow(rows,{
    required:6,
    nowMs:Date.parse('2026-09-18T23:20:00+07:00')
  });
  assert.equal(result.ok,false);
  assert.equal(result.invalid_rows,4);
  assert.notEqual(result.classification,'WITNESS_STREAK_PASS');
});

test('old six-hour streak is stale and cannot certify a current witness',()=>{
  const rows=[12,13,14,15,16,17].map(h=>row(h));
  const result=A.evaluateWitnessWindow(rows,{
    required:6,
    nowMs:Date.parse('2026-09-18T23:20:00+07:00')
  });
  assert.equal(result.ok,false);
  assert.equal(result.classification,'WITNESS_STREAK_STALE');
  assert.equal(result.latest_is_fresh,false);
});

test('receive timestamp far outside ingress window is invalid',()=>{
  const bad=row(23);
  bad.received_at='2026-09-18T23:40:00+07:00';
  const checked=A.validateWitnessRow(bad);
  assert.equal(checked.ok,false);
  assert.ok(checked.reasons.includes('RECEIVE_LAG'));
});


test('tampered persisted envelope is rejected when payload hash no longer matches',()=>{
  const bad=row(23);
  bad.nonce='nonce-20260918T230000-99';
  const checked=A.validateWitnessRow(bad);
  assert.equal(checked.ok,false);
  assert.ok(checked.reasons.includes('PAYLOAD_HASH'));
});

test('malformed payload hash is rejected before witness streak counting',()=>{
  const bad=row(23);
  bad.payload_hash='not-a-sha256';
  const checked=A.validateWitnessRow(bad);
  assert.equal(checked.ok,false);
  assert.ok(checked.reasons.includes('PAYLOAD_HASH_FORMAT'));
});
