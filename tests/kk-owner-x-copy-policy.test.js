'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Policy=require('../server/kk-owner-x-copy-policy.js');

const valid=()=>({
 message:'ขอโพสปล่อยเช่างานนี้บน X',
 input:{
  cta_style:'lead_then_book_link',
  recent_context_checked:true,
  recent_context_source:'chat_drafts',
  recent_posts:['ข้อความเก่าจากประวัติแชทที่นำมาเทียบ'],
  event_dna:['verified show format','verified artist segment']
 }
});

test('direct rental post requires owner CTA and audited history before agent dispatch',()=>{
 const v=Policy.validateRequest(valid());
 assert.equal(v.pass,true);
 assert.equal(v.applicable,true);
});

test('direct rental bridge rejects bypass of owner CTA or post history',()=>{
 const v=valid();
 delete v.input.cta_style;
 v.input.recent_posts=[];
 v.input.recent_context_source='';
 const r=Policy.validateRequest(v);
 assert.equal(r.pass,false);
 assert.match(r.errors.join('|'),/OWNER_X_CTA_STYLE_REQUIRED/);
 assert.match(r.errors.join('|'),/OWNER_X_RECENT_COPY_REQUIRED/);
 assert.match(r.errors.join('|'),/OWNER_X_HISTORY_SOURCE_REQUIRED/);
});

test('confirmed X history must include at least one actual post URL',()=>{
 const v=valid();
 v.input.recent_context_source='confirmed_x';
 const missing=Policy.validateRequest(v);
 assert.equal(missing.pass,false);
 assert.match(missing.errors.join('|'),/OWNER_X_CONFIRMED_POST_LINK_REQUIRED/);
 v.input.recent_post_urls=['https://x.com/KK_PhoneRental/status/2105847739502248275'];
 assert.equal(Policy.validateRequest(v).pass,true);
});

test('non-rental post can pass without rental-specific CTA',()=>{
 const r=Policy.validateRequest({message:'สรุปข่าวศิลปิน',input:{}});
 assert.equal(r.pass,true);
 assert.equal(r.applicable,false);
});
