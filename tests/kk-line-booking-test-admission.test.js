'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ids = Array.from({length: 11}, (_, i) => 'U' + i.toString(16).padStart(32, '0'));
const load = () => require('../server/kk-line-booking-test-admission');
const config = list => ({KK_LINE_BOOKING_TEST_MODE:'true', KK_LINE_BOOKING_TEST_USER_IDS:list});
test('absent and literal false preserve behavior without reading an irrelevant list', () => {
  for (const env of [{}, {KK_LINE_BOOKING_TEST_MODE:'false', KK_LINE_BOOKING_TEST_USER_IDS:'invalid'}]) {
    const p = load().configuration(env);
    assert.equal(p.enabled, false); assert.equal(load().isEventAllowed(null, p), true);
  }
});
test('only literal true enables one to ten unique exact identities without mutating input', () => {
  for (const count of [1,10]) {
    const env = Object.freeze(config('  '+ids.slice(0,count).join(' , ')+'  '));
    const p = load().configuration(env);
    assert.deepEqual(p.userIds, ids.slice(0,count)); assert.equal(p.enabled,true);
    assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.userIds));
    assert.equal(load().isUserAllowed(ids[0],p),true);
    for (const bad of [ids[10],ids[0]+' ',ids[0].toLowerCase(),null,{},'U'+'A'.repeat(32)])
      assert.equal(load().isUserAllowed(bad,p),false);
    assert.equal(load().isEventAllowed({source:{type:'user',userId:ids[0]}},p),true);
    for (const type of ['group','room',undefined])
      assert.equal(load().isEventAllowed({source:{type,userId:ids[0]}},p),false);
    assert.equal(load().isEventAllowed(null,p),false);
  }
});
test('invalid booleans and absent empty malformed duplicate or excessive lists fail with only a safe code', () => {
  const invalid = ['', 'TRUE', 'False', '1', 'yes', true, null].map(value => ({KK_LINE_BOOKING_TEST_MODE:value}));
  for (const list of [undefined,'',' ',ids[0]+',',ids[0]+','+ids[0],ids.join(','),'U'+'A'.repeat(32),'C'+'a'.repeat(32),'Ubad']) invalid.push(config(list));
  for (const env of invalid) assert.throws(() => load().configuration(env), err =>
    err.code === 'LINE_BOOKING_TEST_CONFIG_INVALID' && err.message === err.code);
});
test('pure helper imports no module or transport and ignores ambient environment', () => {
  const source = fs.readFileSync(path.join(__dirname,'../server/kk-line-booking-test-admission.js'),'utf8');
  assert.doesNotMatch(source,/require\s*\(|\bimport\b|process\.env|\bfetch\s*\(/);
  assert.equal(load().configuration().enabled,false);
});
