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

test('sticky browse filters stay on one compact horizontal row on mobile',()=>{
  assert.match(storeCss,/Mobile sticky browse controls v2/);
  assert.match(storeCss,/\.browse-controls-shell \.filter-bar,[\s\S]*?flex-wrap:nowrap/);
  assert.match(storeCss,/overflow-x:auto/);
  assert.match(storeCss,/\.browse-controls-shell \.month-select,[\s\S]*?min-height:44px[\s\S]*?font-size:16px/);
  assert.match(storeCss,/\.browse-controls-shell \.filter-btn,[\s\S]*?min-height:44px[\s\S]*?white-space:nowrap/);
  assert.match(storeCss,/safe-area-inset-bottom/);
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

test('mobile utility controls keep 44px touch targets',()=>{
  assert.match(storeCss,/@media\(max-width:768px\)\{\.language-switch\{min-height:44px/);
  assert.match(storeCss,/\.lang-btn\{min-width:45px;min-height:44px/);
  assert.match(storeCss,/@media\(max-width:768px\)\{body\{padding-bottom:82px\}[\s\S]*?\.mini-btn\{font-size:14px;min-height:44px/);
});

test('mobile quick links use a two-tier compact hierarchy',()=>{
  assert.match(storeCss,/@media\(max-width:430px\)\{[\s\S]*?\.quick-links\{[\s\S]*?display:grid/);
  assert.match(storeCss,/\.quick-link\{grid-column:1\/-1;width:100%/);
  assert.match(storeCss,/\.mini-btn,\.language-switch\{width:100%/);
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
  assert.match(adminHtml,/<option value="unpaid">ยังไม่จ่าย<\/option>/);
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
  assert.match(storeHtml,/style\.css\?v=compact-sticky-controls-20260927/);
  assert.match(storeHtml,/script\.js\?v=seamless-phase4-20260926/);
  assert.match(adminHtml,/admin\.css\?v=health-triage-20260926/);
  assert.match(adminHtml,/admin\.js\?v=bulk-event-price-edit-20260927/);
});


test('tap-target floors remain consistent across mobile and desktop',()=>{
  assert.match(storeCss,/Storefront UX acceptance — consistent hit-area floor/);
  assert.match(storeCss,/@media\(max-width:768px\)\{[\s\S]*?\.quick-link\{min-height:44px/);
  assert.match(storeCss,/\.language-switch \.lang-btn\{min-width:44px;min-height:44px/);
  assert.match(storeCss,/@media\(min-width:769px\)\{[\s\S]*?\.month-select,\.filter-btn\{min-height:40px/);
  assert.match(storeCss,/\.language-switch \.lang-btn\{min-width:40px;min-height:40px/);
});
