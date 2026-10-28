'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/kk-storefront-v5.css'),'utf8');
const start=script.indexOf('var STOREFRONT_OFFICIAL_DATE_CONTEXT=');
const end=script.indexOf('var TODAY_TS',start);
assert.ok(start>0&&end>start,'Date context helper missing');
const context={eventDateKey(value){
 const s=String(value||'').trim();
 const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;
}};
vm.runInNewContext(script.slice(start,end),context);
const get=context.storefrontOfficialDateContext;

test('all eleven approved event-date display clarifications require exact event ID and source date',()=>{
 const cases=[
 ['EVT-20261030-DAOUOFFROAD-HALLOWEEN-FAN-PARTY','30/10/2026','30–31'],
 ['EVT-20261030-POPPAH4-HALLOWEEN-NAMP','30/10/2026','30 ต.ค.–1 พ.ย.'],
 ['EVT-20261115-2026-K-POP-MASTERZ-SPECIAL-L','15/11/2026','14–15'],
 ['EVT-20261127-FORTREASURE-BEYOND-HORIZON','27/11/2026','คอนเสิร์ตหลักวันที่ 29'],
 ['EVT-20261129-FORTREASURE-BEYOND-HORIZON','29/11/2026','คอนเสิร์ตหลักวันที่ 29'],
 ['EVT-20261203-BTS-WORLD-TOUR-ARIRANG','03/12/2026','3, 5 และ 6'],
 ['EVT-20261205-BTS-WORLD-TOUR-ARIRANG','05/12/2026','3, 5 และ 6'],
 ['EVT-20261206-WILLIAM-EST-REIGN-TOGETHER-C','06/12/2026','5–7'],
 ['EVT-20261207-WILLIAM-EST-REIGN-TOGETHER-C','07/12/2026','5–7'],
 ['EVT-20261230-WHITE-PARTY-BANGKOK-AMAXON-AGM','30/12/2026','AGM Night'],
 ['EVT-20261231-WHITE-PARTY-BANGKOK-AMAXON-NYE','31/12/2026',"New Year's Eve"]
 ];
 for(const [id,date,hint] of cases){
   const item=get(id,date);
   assert.ok(item,'Missing scoped metadata for '+id);
   assert.match(item.th,new RegExp(hint));
   assert.ok(item.en&&item.th);
   assert.equal(item.date,context.eventDateKey(date));
   assert.equal(get(id,'01/01/2027'),null,'Stale hardcoded date cannot override source');
 }
 assert.equal(Object.keys(context.STOREFRONT_OFFICIAL_DATE_CONTEXT).length,11);
});

test('benefit-only Nov27 is not mislabelled main concert; Nov29 remains concert',()=>{
 const benefits=get('EVT-20261127-FORTREASURE-BEYOND-HORIZON','27/11/2026');
 assert.match(benefits.displayName,/FAN BENEFITS/);
 assert.match(benefits.th,/ไม่ใช่คอนเสิร์ตหลัก/);
 const concert=get('EVT-20261129-FORTREASURE-BEYOND-HORIZON','29/11/2026');
 assert.equal(concert.displayName,undefined);
 assert.match(concert.th,/คอนเสิร์ตหลัก/);
});

test('White Party confirmed dates drop obsolete unverified title, without altering source booking date',()=>{
 const id='EVT-20261230-WHITE-PARTY-BANGKOK-AMAXON-AGM';
 const entry=get(id,'30/12/2026');
 assert.equal(entry.displayName,'White Party Bangkok AmaXon — AGM Night');
 assert.doesNotMatch(entry.displayName,/รอยืนยัน/);
 assert.match(script,/date:\s+fmtDate\(rawDate\)/);
 assert.match(script,/presentedLineTemplate=presentedName===originalName\?originalLineTemplate/);
});

test('single rental date never creates hidden or unavailable other-date inventory',()=>{
 assert.equal(get('EVT-20261031-DAOUOFFROAD-HALLOWEEN-FAN-PARTY','31/10/2026'),null);
 assert.equal(get('EVT-20261128-FORTREASURE-BEYOND-HORIZON','28/11/2026'),null);
 assert.equal(get('EVT-20261206-BTS-WORLD-TOUR-ARIRANG','06/12/2026'),null);
 assert.equal(get('EVT-20261114-2026-K-POP-MASTERZ-SPECIAL-L','14/11/2026'),null);
 assert.equal(get('EVT-20261205-WILLIAM-EST-REIGN-TOGETHER-C','05/12/2026'),null);
});

test('catalog card and modal render organizer date separately from the sheet rental date',()=>{
 assert.match(script,/var dateContext=storefrontOfficialDateContext\(eventId,rawDate\)/);
 assert.match(script,/dateContext:\s+dateContext/);
 assert.match(script,/dateEl\.textContent=c\.date\|\|""/);
 assert.match(script,/dateContextEl\.textContent=currentLang==="en"\?c\.dateContext\.en:c\.dateContext\.th/);
 assert.match(script,/organizerDateNote=c\.dateContext\?/);
 assert.match(script,/eventNoteEl\.textContent=\[organizerDateNote/);
 assert.match(script,/dedupeWebRowsByEventId\(webRows\)\.filter\(function\(r\)\{ return isVisibleWebAction\(r\.action_for_web\); \}\)/);
});

test('cache-bust, mobile scope typography and no new event/booking writer',()=>{
 assert.match(html,/script\.js\?v=official-event-date-scope-20261029/);
 assert.match(html,/kk-storefront-v5\.css\?v=20261029-event-date-scope/);
 assert.match(css,/\.poster-grid \.concert-card \.pi-date-scope/);
 const helper=script.slice(start,end);
 assert.doesNotMatch(helper,/fetch\(|setFormulas|createEvent|bookings|booking_status/);
});
