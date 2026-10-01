'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const admin=fs.readFileSync('admin/admin.js','utf8');
const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const proxy=fs.readFileSync('server/admin-proxy.js','utf8');

test('closed booking is cleared from Edit Booking selector after refresh',()=>{
  assert.match(admin,/if\(current && rows\.some\(b=>String\(b\.row_number\)===String\(current\)\)\) sel\.value=current;\s*else sel\.value="";/);
  assert.match(admin,/นำออกจากรายการแก้ Booking แล้ว/);
});

test('completed cancelled and no_show remain excluded from Edit Booking',()=>{
  assert.match(admin,/function isClosedBookingStatus\(status\)[\s\S]*?\["cancelled","completed","no_show"\]/);
  assert.match(admin,/if\(isClosedBookingStatus\(b\.booking_status\)\) return false/);
});

test('unchanged assigned assets are not revalidated for availability on unrelated active booking edits',()=>{
  assert.match(apps,/const reactivating = !kkActiveHold_\(currentStatus\)/);
  assert.match(apps,/const phoneChanged = String\(next\[9\]/);
  assert.match(apps,/const lensChanged = String\(next\[10\]/);
  assert.match(apps,/if \(next\[9\] && \(reactivating \|\| phoneChanged\)\) kkValidateManualAsset_/);
  assert.match(apps,/if \(next\[10\] && \(reactivating \|\| lensChanged\)\) kkValidateManualAsset_/);
  assert.match(apps,/kkAssertBookingAssetsNotDoubleBooked_\(row, next, nextStatus\)/);
});

test('rejected mutations get a stable diagnostic code and bounded error text',()=>{
  assert.match(proxy,/UPSTREAM_BUSINESS_REJECTED/);
  assert.match(proxy,/String\(data\.error \|\| ''\)\.slice\(0, 240\)/);
});
