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
