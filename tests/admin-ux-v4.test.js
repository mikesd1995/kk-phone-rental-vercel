const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const css=fs.readFileSync('admin/admin.css','utf8');
const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');

test('Admin UX v4 renders compact snapshot health disclosure',()=>{
  assert.match(html,/id="snapshotStatus"[^>]*class="card snapshot-status"/);
  assert.doesNotMatch(html,/id="snapshotStatus"[^>]*style=/);
  assert.match(js,/snapshot-status-main/);
  assert.match(js,/snapshot-details/);
  assert.match(js,/snapshot-warning-list/);
  assert.match(js,/friendlySnapshotWarning/);
  assert.doesNotMatch(js,/el\.textContent=\(snapshotState\.stale/);
});

test('Admin UX v4 shortens the overview hierarchy without changing operational surfaces',()=>{
  assert.match(html,/<h2>ภาพรวมการทำงาน<\/h2>/);
  assert.match(html,/งาน คิวเช่า ลูกค้า และความพร้อมของระบบในหน้าเดียว/);
  assert.match(html,/id="actionTable"/);
  assert.match(html,/id="statsGrid"/);
  assert.match(html,/id="bookingForm"/);
});

test('Admin UX v4 applies compact desktop and responsive layout rules',()=>{
  assert.match(css,/Admin UX v4 \/ Compact Operations Polish/);
  assert.match(css,/\.shell\{grid-template-columns:238px minmax\(0,1fr\)!important\}/);
  assert.match(css,/#snapshotStatus\.snapshot-status/);
  assert.match(css,/\.snapshot-detail-body/);
  assert.match(css,/#actionToolbar\{/);
  assert.match(css,/@media\(max-width:680px\)/);
});

test('Admin UX v4 remains presentation-only for business write semantics',()=>{
  assert.doesNotMatch(css,/KK_ADMIN_SCRIPT_URL|GOOGLE_SHEET_ID|createBooking|updateBooking/);
  assert.match(js,/single-attempt only; no automatic retry/);
});

test('Admin shell never renders escaped newline tokens between structural tags',()=>{
  assert.doesNotMatch(html,/\\n\s*</,'literal \\n before an HTML tag would render visibly in the Admin shell');
});

