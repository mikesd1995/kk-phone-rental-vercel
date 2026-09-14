const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const css=fs.readFileSync('admin/admin.css','utf8');
const v3=fs.readFileSync('admin/admin-ux-v3.css','utf8');

test('Admin UX v3.1 preserves v3 as a rollback layer',()=>{
  assert.match(css,/admin-ux-v3\.css/);
  assert.ok(v3.length>5000,'v3 stylesheet should remain intact as a rollback layer');
  assert.match(v3,/admin-ux-v2\.css/);
});

test('Admin UX v3.1 fixes screenshot-observed Overview and Today density issues',()=>{
  assert.match(css,/\.pro-hero h2\{color:var\(--ux31-ink\)!important/);
  assert.match(css,/\.action-table-wrap\{max-height:380px!important/);
  assert.match(css,/#tab-today:has\(#todayTable td\[colspan\]\)/);
});

test('Admin UX v3.1 restores structured Rental Analytics presentation',()=>{
  assert.match(css,/\.rental-analytics-kpis\{display:grid!important;grid-template-columns:repeat\(6/);
  assert.match(css,/\.rental-analytics-snapshot\{display:grid!important/);
  assert.match(css,/\.rental-bar-row\{display:grid!important/);
  assert.match(css,/\.rental-bar-track\{height:10px!important/);
});

test('Admin UX v3.1 protects System Guard long diagnostics and primary edit action',()=>{
  assert.match(css,/#systemGuardTable\{width:100%!important;table-layout:fixed!important\}/);
  assert.match(css,/overflow-wrap:anywhere!important/);
  assert.match(css,/#tab-edit-booking \.btn\[type="submit"\]\{background:#1d4ed8!important/);
});
