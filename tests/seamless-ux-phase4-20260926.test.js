'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const storeHtml=fs.readFileSync('index.html','utf8');
const storeJs=fs.readFileSync('script.js','utf8');
const storeCss=fs.readFileSync('style.css','utf8');
const adminHtml=fs.readFileSync('admin/index.html','utf8');
const adminJs=fs.readFileSync('admin/admin.js','utf8');
const adminCss=fs.readFileSync('admin/admin.css','utf8');

test('storefront has semantic skip target and compact sticky browse controls',()=>{
  assert.match(storeHtml,/class="skip-link" href="#event-browser"/);
  assert.match(storeHtml,/<main id="event-browser"/);
  assert.match(storeHtml,/class="browse-controls-shell"/);
  assert.match(storeCss,/\.browse-controls-shell\{position:sticky/);
});

test('storefront can recover from transient load errors without forcing LINE exit',()=>{
  assert.match(storeJs,/error_retry:"ลองโหลดข้อมูลใหม่"/);
  assert.match(storeJs,/id="storefront-retry-btn"/);
  assert.match(storeJs,/function refreshStorefrontData\(reason\)/);
  assert.match(storeJs,/refreshStorefrontData\("retry"\)/);
});

test('storefront refreshes stale availability when returning to the foreground',()=>{
  assert.match(storeJs,/STALE_REFRESH_MS = 3\*60\*1000/);
  assert.match(storeJs,/document\.addEventListener\("visibilitychange"/);
  assert.match(storeJs,/Date\.now\(\)-lastDataLoadAt<STALE_REFRESH_MS/);
  assert.match(storeJs,/refreshStorefrontData\("foreground"\)/);
});

test('storefront respects reduced motion and improves very narrow readability',()=>{
  assert.match(storeCss,/@media\(max-width:340px\)/);
  assert.match(storeCss,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Admin protects dirty forms from accidental navigation and page unload',()=>{
  assert.match(adminJs,/function dirtyForms\(\)/);
  assert.match(adminJs,/function setupUnsavedGuards\(\)/);
  assert.match(adminJs,/function confirmDiscardDirty\(targetTab\)/);
  assert.match(adminJs,/activeTabId\(\)!==id && !confirmDiscardDirty/);
  assert.match(adminJs,/window\.addEventListener\("beforeunload"/);
  assert.match(adminHtml,/id="unsavedBadge"/);
});

test('Admin foreground refresh defers while an operator has unsaved work',()=>{
  assert.match(adminJs,/function adminSnapshotIsStale\(\)/);
  assert.match(adminJs,/document\.addEventListener\("visibilitychange"/);
  assert.match(adminJs,/dirtyForms\(\)\.length\)\{showNotice\("ข้อมูล Snapshot อาจเก่า/);
});

test('Booking form keeps the daily path short and hides overrides under Advanced',()=>{
  assert.match(adminHtml,/class="booking-advanced-details"/);
  assert.match(adminHtml,/<summary>ตัวเลือกเพิ่มเติม<\/summary>/);
  assert.match(adminHtml,/<option value="confirmed">ยืนยันแล้ว<\/option>/);
  assert.match(adminHtml,/<select name="payment_status"><option value="unpaid">ยังไม่จ่าย · รับเงินตอนส่งเครื่อง<\/option><\/select>/);
});

test('Event Control batch mutation shows a concrete preview before write',()=>{
  assert.match(adminHtml,/id="batchPreviewDialog"/);
  assert.match(adminJs,/function confirmBatchPreview/);
  assert.match(adminJs,/await confirmBatchPreview\(\{actionLabel,ids,skipped,rowsById,detail\}\)/);
  assert.match(adminJs,/batch-preview-item/);
});

test('Admin Ctrl-K is a cross-entity command search instead of only local focus',()=>{
  assert.match(adminHtml,/id="commandPalette"/);
  assert.match(adminHtml,/id="globalAdminSearch"/);
  assert.match(adminJs,/function commandSearchRows\(query\)/);
  assert.match(adminJs,/kind:"event"/);
  assert.match(adminJs,/kind:"booking"/);
  assert.match(adminJs,/kind:"customer"/);
  assert.match(adminJs,/openCommandPalette\(\)/);
});

test('Admin mobile quick actions use safer tap targets and reduced motion',()=>{
  assert.match(adminCss,/\.mini-btn.*min-height:44px!important/s);
  assert.match(adminCss,/@media\(prefers-reduced-motion:reduce\)/);
});

test('phase 4 assets are cache-busted',()=>{
  assert.match(storeHtml,/style\.css\?v=clear-filter-containment-20260930/);
  assert.match(storeHtml,/script\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);
  assert.match(adminHtml,/admin\.css\?v=health-triage-20260926/);
  assert.match(adminHtml,/admin\.js\?v=bulk-event-price-edit-20260927/);
});
