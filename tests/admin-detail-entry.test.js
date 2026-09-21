'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'admin', 'admin.js'), 'utf8');

test('admin event venue fields reuse a shared venue suggestion list', () => {
  assert.match(html, /<datalist id="venueOptions"><\/datalist>/);
  const venueRefs = html.match(/name="venue" list="venueOptions"/g) || [];
  assert.equal(venueRefs.length, 2);
  assert.match(js, /function populateEntrySuggestions\(data\)/);
  assert.match(js, /d\.events\|\|\[\]/);
});

test('admin booking asset fields provide snapshot-backed suggestions without removing free entry', () => {
  assert.match(html, /<datalist id="phoneAssetOptions"><\/datalist>/);
  assert.match(html, /<datalist id="lensAssetOptions"><\/datalist>/);
  assert.equal((html.match(/name="phone_asset_id" list="phoneAssetOptions"/g) || []).length, 2);
  assert.equal((html.match(/name="lens_asset_id" list="lensAssetOptions"/g) || []).length, 2);
  assert.match(js, /fillAssetList\("#phoneAssetOptions","phone"\)/);
  assert.match(js, /fillAssetList\("#lensAssetOptions","lens"\)/);
  assert.match(js, /a\.rentable===false\?"not rentable":"rentable"/);
});
