'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-public-web-adapters.js');

test('search evidence parses explicit Thai full and abbreviated CE and BE dates',()=>{
 const full=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 const abbr=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 for(let i=0;i<12;i++){
  const expected=['2026-'+String(i+1).padStart(2,'0')+'-14'];
  for(const month of [full[i],abbr[i]]){
   assert.deepEqual(A.inferSearchEventDates('งานใหม่ 14 '+month+' 2569'),expected);
   assert.deepEqual(A.inferSearchEventDates('งานใหม่ 14 '+month+' ค.ศ. 2026'),expected);
  }
 }
 assert.deepEqual(A.inferSearchEventDates('วันที่ 24 ตุลาคม พ.ศ. 2569'),['2026-10-24']);
});

test('search evidence parses explicit numeric day month year with calendar validation',()=>{
 assert.deepEqual(A.inferSearchEventDates('วันที่ 14/11/2026'),['2026-11-14']);
 assert.deepEqual(A.inferSearchEventDates('วันที่ 1/2/2569'),['2026-02-01']);
 assert.deepEqual(A.inferSearchEventDates('29/2/2567'),['2024-02-29']);
 for(const value of ['31/2/2026','29 ก.พ. 2569','31 เมษายน 2026','24 ต.ค.','24 ต.ค. 69','14/11/26','114/11/2026','14/11/20261']) assert.deepEqual(A.inferSearchEventDates(value),[],value);
});

test('unsupported Thai and numeric ranges never become an isolated final day',()=>{
 for(const value of ['11-13 ตุลาคม 2569','11 – 13 ต.ค. 2569','11/10/2026 - 13/10/2026','11 ถึง 13 ตุลาคม 2569','11/10/2026 ถึง 13/10/2026']) assert.deepEqual(A.inferSearchEventDates(value),[],value);
});

test('DDGS retains a new Thai-dated title without borrowing unrelated body dates',async()=>{
 const rows=await A.ddgsTrafilatura({query:'งานศิลปินใหม่'},{ddgs_runner:async()=>[{title:'คอนเสิร์ตสมมติ 24 ตุลาคม 2569',body:'เปิดขายบัตร 1 October 2026',url:'https://example.com/new-show'}]});
 assert.equal(rows.length,1);
 assert.equal(rows[0].event_date,'2026-10-24');
 assert.equal(rows[0].source_url,'https://example.com/new-show');
});
