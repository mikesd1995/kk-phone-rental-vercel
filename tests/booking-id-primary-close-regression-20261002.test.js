'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const admin=fs.readFileSync('admin/admin.js','utf8');
const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const fallback=fs.readFileSync('server/admin-sheet-fallback.js','utf8');

test('booking updates carry stable booking_id even when UI selector uses a row hint',()=>{
  assert.match(admin,/function bookingMutationIdentity\(b,rowNumber\)/);
  assert.match(admin,/if\(bookingId\) return \{booking_id:bookingId\}/);
  assert.match(admin,/return row \? \{row_number:row\} : \{\}/);
  assert.match(admin,/let payload=bookingMutationIdentity\(b,row\)/);
  assert.match(admin,/Object\.assign\(payload,bookingMutationIdentity\(selected,payload\.row_number\)\)/);
});

test('Apps Script resolves booking_id before any row_number fallback',()=>{
  const start=apps.indexOf('function kkFindBookingRow_');
  const end=apps.indexOf('function kkAssertBookingAssetsNotDoubleBooked_',start);
  assert.ok(start>0&&end>start);
  const block=apps.slice(start,end);
  assert.match(block,/const id = String\(bookingId \|\| ''\)\.trim\(\)/);
  assert.match(block,/if \(id\) \{[\s\S]*matches\.push\(i \+ 5\)/);
  assert.match(block,/if \(matches\.length === 1\) return matches\[0\]/);
  assert.match(block,/Duplicate booking_id/);
  assert.ok(block.indexOf('if (id)') < block.indexOf('const n = Number(rowNumber'));
});

test('public GViz booking row numbers are explicitly non-authoritative',()=>{
  assert.match(fallback,/row_number_reliable:transportMeta\.fallback_reader!=='public-gviz'/);
  assert.match(fallback,/booking_identity_mode:'booking_id-primary'/);
  assert.match(fallback,/booking_row_number_reliable:transportMeta\.fallback_reader!=='public-gviz'/);
});
