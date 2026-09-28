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

test('phone and lens availability both use event-id same-day reservation helper', () => {
  assert.match(gs, /kkFormulaActiveBookingCount_\(`B\$\{rowNumber\}`, 'lens_only\|phone_lens_bundle'\)/);
  assert.match(gs, /kkFormulaActiveBookingCount_\(`B\$\{r\}`, 'phone_only\|phone_lens_bundle'\)/);
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
