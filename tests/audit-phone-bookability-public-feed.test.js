'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../scripts/audit-phone-bookability-public-feed.cjs');
const header='event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template';
const row=(id,date,phone,lens,label,action)=>
  [id,'Test event',date,'Venue','https://example.com/p.jpg','',phone,lens,label,action,'Message'].join(',');
const asCsv=(...rows)=>[header,...rows].join('\n');

test('Dec 3/5 real-world 0-phone + 1-lens feed discrepancy is caught',()=>{
 const csv=asCsv(
  row('EVT-20261203-BTS-WORLD-TOUR-ARIRANG','03/12/2026',0,1,'เปิดจอง','show'),
  row('EVT-20261205-BTS-WORLD-TOUR-ARIRANG','05/12/2026',0,1,'เปิดจอง','show'));
 const result=Audit.inspectCsv(csv);
 assert.equal(result.pass,false);
 assert.equal(result.stats['2026-12'].events,2);
 assert.equal(result.issues.length,2);
 for(const issue of result.issues){
   assert.deepEqual(issue.reasons,['SHOW_WITH_ZERO_PHONE','OPEN_BOOKING_WITH_ZERO_PHONE']);
 }
});

test('approved phone-full waitlist retains card while lens is spare',()=>{
 const result=Audit.inspectCsv(asCsv(
  row('DEC3','03/12/2026',0,1,'เต็มแล้ว','show_full'),
  row('DEC5','05/12/2026',0,1,'เต็มแล้ว','show_full'),
  row('NOV7','07/11/2026',1,1,'เปิดจอง','show'),
  row('NOV6_HIDDEN','06/11/2026',0,0,'ซ่อนจากเว็บ','hide')));
 assert.equal(result.pass,true);
 assert.equal(result.stats['2026-11'].show,1);
 assert.equal(result.stats['2026-11'].hide,1);
 assert.equal(result.stats['2026-12'].show_full,2);
});

test('duplicate event ID fails closed rather than hiding a conflicting availability row',()=>{
 const result=Audit.inspectCsv(asCsv(
  row('DUP','03/12/2026',1,1,'เปิดจอง','show'),
  row('DUP','03/12/2026',0,0,'เต็มแล้ว','show_full')));
 assert.equal(result.pass,false);
 assert.deepEqual(result.issues[0].reasons,['DUPLICATE_EVENT_ID']);
});

test('invalid or missing inventory fails closed even with a show action',()=>{
 const result=Audit.inspectCsv(asCsv(row('INVALID','03/12/2026','',1,'เปิดจอง','show')));
 assert.deepEqual(result.issues[0].reasons,['INVALID_PHONE_COUNT']);
});

test('read-only CSV parser handles quoted commas and multiline LINE message',()=>{
 const csv=header+'\n'+
   'ID,"Concert, Bangkok",03/12/2026,Venue,https://example.com/a.jpg,,0,1,เต็มแล้ว,show_full,"LINE, text\nmore text"';
 const parsed=Audit.parseCsv(csv);
 assert.equal(parsed[0].event_name,'Concert, Bangkok');
 assert.equal(parsed[0].line_message_template,'LINE, text\nmore text');
 assert.equal(Audit.inspectRows(parsed).pass,true);
});

test('unrecognized public statuses fail closed without mutating feed',()=>{
 const result=Audit.inspectCsv(asCsv(row('E1','03/12/2026',1,0,'เปิดจอง','unknown')));
 assert.deepEqual(result.issues[0].reasons,['UNRECOGNIZED_PUBLIC_ACTION']);
});

test('reject schema drift and unterminated quoted fields',()=>{
 assert.throws(()=>Audit.inspectCsv('event_id,event_date_text\n1,03/12/2026'),/WEB_READY_MISSING_COLUMN/);
 assert.throws(()=>Audit.parseCsv(header+'\n"broken'),/CSV_UNTERMINATED_QUOTE/);
});

test('date parser accepts Thai D/M/YYYY and ISO and excludes unrelated months',()=>{
 assert.equal(Audit.dateKey('03/12/2569'),'2026-12-03');
 assert.equal(Audit.dateKey('2026-11-07'),'2026-11-07');
 const result=Audit.inspectCsv(asCsv(
  row('OCT','03/10/2026',0,1,'เปิดจอง','show'),
  row('NOV','07/11/2026',1,1,'เปิดจอง','show')),['2026-11']);
 assert.equal(result.pass,true);
 assert.equal(result.stats['2026-11'].events,1);
 assert.equal(result.issues.length,0);
});

test('only read-only public API source is allowed and no customer data is emitted',()=>{
 assert.equal(Audit.PUBLIC_FEED,'https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK');
 const r=Audit.inspectCsv(asCsv(row('E1','03/12/2026',0,1,'เปิดจอง','show')));
 assert.equal(r.read_only,true);
 assert.ok(!JSON.stringify(r).includes('line_message_template'));
});
