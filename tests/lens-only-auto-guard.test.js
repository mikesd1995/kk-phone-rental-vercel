'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gs = fs.readFileSync('apps-script/Code.gs', 'utf8');

test('canonical Apps Script defines lens-only storefront guard', () => {
  assert.match(gs, /function kkFormulaWebPackageStatus_\(rowNumber\)/);
  assert.match(gs, /C\\\$\{r\}="lens_only"/);
  assert.match(gs, /LOWER\('00_Master_Booking'!\$I\$5:\$I\$1000\)="phone_only"/);
  assert.match(gs, /pending\|confirmed\|prepared\|picked_up/);
});

test('lens-only guard is repaired into 09_Web_Packages column J', () => {
  assert.match(gs, /const status = \[\]/);
  assert.match(gs, /status\.push\(\[kkFormulaWebPackageStatus_\(row\)\]\)/);
  assert.match(gs, /getRange\(startRow, 10, rowCount, 1\)\.setFormulas\(status\)/);
});

test('manual FALSE override remains an emergency kill switch', () => {
  assert.match(gs, /'04_Event_Overrides'!\$D\$5:\$D,FALSE/);
});

test('lens compatibility patch version is bumped for the new policy', () => {
  assert.match(gs, /KK_LENS_COMPAT_PATCH_VERSION = 'v16\.7\.0_PHASE3_9_5_10_LENS_ONLY_AUTO_GUARD_20260928'/);
});
