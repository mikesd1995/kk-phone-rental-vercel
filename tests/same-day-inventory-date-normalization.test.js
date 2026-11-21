'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gs = fs.readFileSync('apps-script/Code.gs', 'utf8');

test('same-day stock reservation compares event-id day keys, not raw date cells', () => {
  assert.match(gs, /function kkFormulaActiveBookingCount_\(eventIdExpr, packageRegex\)/);
  assert.match(gs, /MID\('00_Master_Booking'!\$D\$5:\$D\$1000,5,8\)/);
  assert.match(gs, /MID\(\$\{eventIdExpr\},5,8\)/);
  assert.doesNotMatch(gs, /'00_Master_Booking'!\$V\$5:\$V\$1000=\$\{eventDateExpr\}/);
});

test('same-day lens holds and model-specific phone holds use the encoded event-id date', () => {
  // Lens compatibility continues to use the date-normalized booking helper.
  assert.match(gs, /kkFormulaActiveBookingCount_\(`B\$\{rowNumber\}`, 'lens_only\|phone_lens_bundle'\)/);
  // Phone count now uses booking AJ/AL model hints instead of indiscriminately
  // subtracting every X300 booking from X500 stock on the same calendar date.
  assert.match(gs, /const dateKey = `"EVT-"&MID\(B\$\{r\},5,8\)&"-\*"`/);
  assert.match(gs, /'00_Master_Booking'!\$AJ\$5:\$AJ\$1000,TRUE/);
  assert.match(gs, /'00_Master_Booking'!\$AL\$5:\$AL\$1000,D\$\{r\}/);
  assert.match(gs, /'00_Master_Booking'!\$AL\$5:\$AL\$1000,""/);
  assert.match(gs, /PHONE-004/);
  assert.match(gs, /20261128/);
});

test('repair version is bumped so deployed repair will restore hardened formulas', () => {
  assert.match(gs, /KK_LENS_COMPAT_PATCH_VERSION = 'v16\.7\.0_PHASE3_9_5_11_SAME_DAY_INVENTORY_20260928'/);
});

test('date-type mismatch example still resolves to one shared inventory day', () => {
  const dayFromId = id => String(id).slice(4, 12);
  const atom = { id: 'EVT-20261023-ATOM-PARIYA-SLAY-DOWN', dateCell: '23/10/2026' };
  const lyknBooking = { eventId: 'EVT-20261023-LYKN-REFLEXION-CONCERT-2', dateCell: 46318 };
  assert.notEqual(atom.dateCell, lyknBooking.dateCell);
  assert.equal(dayFromId(atom.id), dayFromId(lyknBooking.eventId));
});


test('backend explicitly parses dd/mm/yyyy event dates', () => {
  assert.match(gs, /const dmy = raw\.match\(\/\^\(\\d\{2\}\)\\\/\(\\d\{2\}\)\\\/\(\\d\{4\}\)\$\//);
  assert.match(gs, /new Date\(Number\(dmy\[3\]\), Number\(dmy\[2\]\) - 1, Number\(dmy\[1\]\)\)/);
});
