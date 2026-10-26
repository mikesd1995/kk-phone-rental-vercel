'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../api/kk-data.js');

test('server public CSV redacts one-underscore and pipe-delimited operational markers',()=>{
  const csv=[
    'event_id,event_name,event_note,action_for_web,line_message_template',
    'A,Hidden,OWNER_HIDDEN 2026-09-29 | owner instruction: hide event,hide,สนใจจองผ่าน LINE',
    'B,Pipe,คำแนะนำ|PRICE_LOCKED,show,USB-C พร้อมใช้งาน',
    'C,Public,ฟรีประกันเครื่อง ไม่มีมัดจำ,show,จองเลย'
  ].join('\n');
  const out=api._test.sanitizePublicCsv('08_Web_Ready',csv);
  const rows=api._test.parseCsvRows(out.text);
  assert.equal(rows[1][2],'');
  assert.equal(rows[1][3],'hide');
  assert.equal(rows[2][2],'');
  assert.equal(rows[3][2],'ฟรีประกันเครื่อง ไม่มีมัดจำ');
  assert.doesNotMatch(out.text,/OWNER_HIDDEN|PRICE_LOCKED|owner instruction/);
});

test('browser sanitizer recognizes the same short and pipe-delimited operational markers',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
  const start=source.indexOf('function looksInternalPublicText(raw){');
  const end=source.indexOf('function sanitizePublicText(raw){',start);
  assert.ok(start>=0&&end>start);
  const looksInternal=Function(source.slice(start,end)+'; return looksInternalPublicText;')();
  assert.equal(looksInternal('OWNER_HIDDEN 2026-09-29 | owner instruction: hide event'),true);
  assert.equal(looksInternal('คำแนะนำ|PRICE_LOCKED'),true);
  assert.equal(looksInternal('ฟรีประกันเครื่อง ไม่มีมัดจำ'),false);
  assert.equal(looksInternal('USB-C พร้อมใช้งาน'),false);
});

const Writer=require('../server/kk-ultra-deep-v2-governed-writer.js');
const v2Templates=[
 {template_id:'TPL-VIVO-X300-PRO-PHONE',package_type:'phone_only',standard_price:590},
 {template_id:'TPL-ZEISS-2-35X-LENS',package_type:'lens_only',standard_price:390},
 {template_id:'TPL-VIVO-X300-PRO-BUNDLE',package_type:'phone_lens_bundle',standard_price:690}
];
function browserSanitize(){
 const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
 const start=source.indexOf('function looksInternalPublicText(raw){');
 const end=source.indexOf('function packagePublicSubtitle(p){',start);
 assert.ok(start>=0&&end>start,'browser note sanitizer must remain discoverable');
 return Function(source.slice(start,end)+'; return sanitizePublicText;')();
}

test('Ultra Deep V2 customer note survives the public proxy and browser sanitizers',()=>{
 const plan=Writer.createPlan({
   title:'Verified November Fan Event',event_date:'2026-11-27',
   verified_venue:'Bangkok Concert Hall'
 },{
   type:'CREATE_EVENT',price:590,
   poster_url:'https://example.com/correct-event-poster.png',
   price_basis:'OWNER_NOVEMBER_FLOOR'
 },v2Templates);
 const note=plan.admin_payload.note;
 const csv=[
   'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
   ['EVT-20261127-VERIFIED','Verified November Fan Event','27/11/2026','Bangkok Concert Hall',
    'https://example.com/correct-event-poster.png',note,'2','0','เปิดจอง','show','สวัสดีค่ะ สนใจจองเช่ามือถือ'].map(api._test.csvCell).join(',')
 ].join('\n');
 const out=api._test.sanitizePublicCsv('08_Web_Ready',csv);
 const rows=api._test.parseCsvRows(out.text);
 assert.equal(out.invalid,undefined);
 assert.equal(out.redacted,0);
 assert.equal(out.dropped,0);
 assert.equal(rows.length,2);
 assert.equal(rows[1][5],note);
 assert.equal(rows[1][9],'show');
 assert.equal(browserSanitize()(rows[1][5]),note);
 assert.equal(plan.admin_payload.event_price_overrides[0].override_price,590);
 assert.equal(plan.admin_payload.event_price_overrides[2].active_override,false);
});

test('V2 diagnostic machine note is redacted at both public-facing boundaries',()=>{
 const internal='ULTRA_DEEP_V2_VERIFIED_CREATE | OWNER_PRICE_LOCKED';
 const csv=[
  'event_id,event_name,event_note,action_for_web',
  ['EVT-20261127-TEST','Test',internal,'show'].map(api._test.csvCell).join(',')
 ].join('\n');
 const out=api._test.sanitizePublicCsv('08_Web_Ready',csv);
 assert.equal(api._test.parseCsvRows(out.text)[1][2],'');
 assert.equal(out.redacted,1);
 assert.equal(browserSanitize()(internal),'');
});
