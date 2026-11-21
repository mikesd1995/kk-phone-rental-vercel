'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing production function ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

const calls = [];
const context = vm.createContext({
  kkGetPackageByTemplateId_(id) {
    calls.push(['template', id]);
    if (id === 'TPL-VIVO-X500-PRO-MAX-PHONE') {
      return { package_type: 'phone_only', model_group: 'VIVO_X500_PRO_MAX', lens_group: 'NONE' };
    }
    throw new Error('unknown template');
  },
  kkGetPackageSpecByType_(type) {
    calls.push(['legacy_type', type]);
    return { package_type: type, model_group: 'VIVO_X300_PRO', lens_group: 'NONE' };
  },
  kkFindAvailableAsset_(kind, group, date) {
    calls.push(['find', kind, group, date]);
    if (kind === 'phone') return group === 'VIVO_X500_PRO_MAX' ? 'PHONE-003' : 'PHONE-001';
    throw new Error('unexpected lens allocation');
  }
});

for (const name of [
  'kkBookingTemplateIdFromNote_',
  'kkBookingNoteWithTemplate_',
  'kkBookingNoteForDisplay_',
  'kkAssignMissingAssetsForPreparedBooking_'
]) {
  vm.runInContext(extractFunction(name), context);
}

test('note marker retains an exact X500 phone-only template and hides it from displayed notes', () => {
  const note = context.kkBookingNoteWithTemplate_('customer LINE [KK_REQ:line:12345678]', 'TPL-VIVO-X500-PRO-MAX-PHONE');
  assert.equal(context.kkBookingTemplateIdFromNote_(note), 'TPL-VIVO-X500-PRO-MAX-PHONE');
  assert.equal(context.kkBookingNoteForDisplay_(note), 'customer LINE');
  assert.match(note, /\[KK_REQ:line:12345678\]/);
});

test('preparing an X500 pending LINE booking allocates X500, not default X300', () => {
  calls.length = 0;
  const row = Array(20).fill('');
  row[8] = 'phone_only';
  row[19] = context.kkBookingNoteWithTemplate_('LINE booking', 'TPL-VIVO-X500-PRO-MAX-PHONE');
  const result = context.kkAssignMissingAssetsForPreparedBooking_(row, 'prepared', '2026-12-11');
  assert.equal(result[9], 'PHONE-003');
  assert.equal(result[10], '');
  assert.ok(calls.some(x => x[0] === 'template' && x[1] === 'TPL-VIVO-X500-PRO-MAX-PHONE'));
  assert.ok(!calls.some(x => x[0] === 'legacy_type'));
});

test('bad template/type combination cannot allocate a different phone silently', () => {
  calls.length = 0;
  const row = Array(20).fill('');
  row[8] = 'phone_lens_bundle';
  row[19] = context.kkBookingNoteWithTemplate_('', 'TPL-VIVO-X500-PRO-MAX-PHONE');
  assert.throws(() => context.kkAssignMissingAssetsForPreparedBooking_(row, 'prepared', '2026-12-11'), /template\/type mismatch/);
  assert.equal(row[9], '');
});

test('legacy pending phone bookings still allocate by their original fallback', () => {
  calls.length = 0;
  const row = Array(20).fill('');
  row[8] = 'phone_only';
  const result = context.kkAssignMissingAssetsForPreparedBooking_(row, 'prepared', '2026-12-11');
  assert.equal(result[9], 'PHONE-001');
  assert.ok(calls.some(x => x[0] === 'legacy_type'));
});

test('LINE pending and direct booking writers persist template, notes edits keep it', () => {
  assert.match(source, /const bookingNote = kkBookingNoteWithTemplate_\(\s*kkBookingNoteWithRequest_\(payload.booking_note \|\| 'LINE webhook intake', requestId\)/);
  assert.match(source, /bookingNote = kkBookingNoteWithTemplate_\(bookingNote, templateId\)/);
  assert.match(source, /kkBookingTemplateIdFromNote_\(current\[19\]\)/);
});
