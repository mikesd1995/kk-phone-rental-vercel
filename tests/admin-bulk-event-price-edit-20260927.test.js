const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');

test('Admin override card exposes bulk event price editor',()=>{
  assert.match(html,/id="bulkEventPriceOverrides"/);
  assert.match(html,/id="saveBulkEventPrices"/);
  assert.match(html,/id="resetBulkEventPrices"/);
  assert.match(html,/แก้ราคาหลายแพ็กเกจ/);
  assert.match(html,/บันทึกทั้งหมด/);
  assert.match(html,/แก้ทีละแพ็กเกจ \/ รายละเอียดขั้นสูง/);
});

test('Bulk editor only writes changed rows and preserves advanced override fields',()=>{
  assert.match(js,/function collectEventBulkPriceChanges\(/);
  assert.match(js,/\["override_price","active_override","override_note"\]/);
  assert.match(js,/sort_order_override:String\(initial\.sort_order_override\|\|""\)/);
  assert.match(js,/use_case_override:String\(initial\.use_case_override\|\|""\)/);
  assert.match(js,/await api\("upsertEventOverride",Object\.assign\(\{event_id:eventId\},item\)\)/);
});

test('Bulk editor keeps failed rows as retryable drafts after partial failure',()=>{
  assert.match(js,/const failed=\[\]/);
  assert.match(js,/restoreEventBulkPriceDraft\(failed\.map\(x=>x\.item\)\)/);
  assert.match(js,/บันทึกได้ \$\{saved\}\/\$\{changes\.length\} รายการ/);
});

test('Bulk price change ships with a dedicated admin cache key',()=>{
  assert.match(html,/admin\.js\?v=diagnostic-evidence-authority-20261013/);
});
