const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('admin/admin.css','utf8');

test('Admin UX v3 promotes Action Center in Overview hierarchy',()=>{
  assert.match(css,/#tab-overview > \.action-card\{order:3!important\}/);
  assert.match(css,/#statsGrid\{display:grid!important;grid-template-columns:repeat\(5/);
  assert.match(css,/\.action-table-wrap\{max-height:460px!important/);
});

test('Admin UX v3 makes Event and Booking workflows operationally focused',()=>{
  assert.match(css,/#tab-events > \.grid\.two-col\{grid-template-columns:minmax\(0,1\.32fr\)/);
  assert.match(css,/#eventUpdateForm\{background:#fbfcfe!important;position:sticky!important/);
  assert.match(css,/#tab-booking #bookingForm\{max-width:1320px!important/);
  assert.match(css,/\.form-action-bar\{position:sticky!important/);
});

test('Admin UX v3 supports mobile operations and accessible interaction',()=>{
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/#statsGrid\{display:flex!important;overflow-x:auto!important/);
  assert.match(css,/input,select,textarea,\.btn,\.nav\{min-height:44px!important\}/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
