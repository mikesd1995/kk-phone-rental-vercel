'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const QA=require('../server/kk-content-qa-gate.js');

const input={
 verified_event:true,verified_pricing:true,inventory_available:true,
 official_event_hashtag:'#THEMOMENT_ARENAENCORE',
 verified_hashtags:['#THEMOMENT_ARENAENCORE','#NONTTANONT','#nontfam','#นนท์แฟม','#เช่ามือถือ'],
 date_display:'3–4 ต.ค.',venue:'IMPACT ARENA'
};
const base=(hook,tail='#NONTTANONT #nontfam #นนท์แฟม')=>`📱 KK Phone Rental | #เช่ามือถือ

🔥 #THEMOMENT_ARENAENCORE

${hook}

🎤 vivo X300 Pro 790฿ | เพิ่ม Lens +200฿
📍 3–4 ต.ค. | IMPACT ARENA

💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ
📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน
☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน
👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/

${tail}`;

test('passes verified hashtag and single canonical date/venue block',()=>{
 const r=QA.validatePost(base('บางโมเมนต์ดีพอที่จะต้องกลับมา ENCORE อีกครั้ง 🔥'),input);
 assert.equal(r.gate,'PASS');
 assert.deepEqual(r.errors,[]);
});
test('blocks synthesized or unverified hashtag',()=>{
 const r=QA.validatePost(base('Hook','#NONTTheMomentOfSpectacleArenaEncore #NONTTANONT'),input);
 assert.equal(r.gate,'BLOCKED');
 assert.match(r.errors.join('|'),/UNVERIFIED_HASHTAG_USED/);
});
test('blocks duplicate date in hook and canonical date block',()=>{
 const r=QA.validatePost(base('3–4 ต.ค. เตรียมไปเจอนนท์กันเต็ม ARENA'),input);
 assert.equal(r.gate,'BLOCKED');
 assert.match(r.errors.join('|'),/DUPLICATE_DATE/);
});
test('blocks duplicate venue in hook and canonical block',()=>{
 const r=QA.validatePost(base('เจอกันที่ IMPACT ARENA'),input);
 assert.equal(r.gate,'BLOCKED');
 assert.match(r.errors.join('|'),/DUPLICATE_VENUE/);
});
test('fails closed when hashtag evidence was not verified',()=>{
 const r=QA.validatePost(base('Hook'),{...input,official_event_hashtag:'',verified_hashtags:[]});
 assert.equal(r.gate,'BLOCKED');
 assert.match(r.errors.join('|'),/HASHTAGS_NOT_VERIFIED/);
});
test('direct rental QA requires exactly three distinct internal candidates',()=>{
 const a=base('Hook ที่หนึ่ง');
 const b=base('Hook ที่สอง');
 const c=base('Hook ที่สาม');
 assert.equal(QA.validateVariants([a,b,c],input).gate,'PASS');
 assert.equal(QA.validateVariants([a],input).gate,'BLOCKED');
 assert.match(QA.validateVariants([a,a,c],input).errors.join('|'),/DUPLICATE_INTERNAL_CANDIDATE_COPY/);
});

test('structured internal candidates must use distinct angles',()=>{
 const a={copy:base('Hook A'),angle:'event_theme'};
 const b={copy:base('Hook B'),angle:'fandom'};
 const c={copy:base('Hook C'),angle:'convenience'};
 assert.equal(QA.validateVariants([a,b,c],input).gate,'PASS');
 assert.match(QA.validateVariants([a,{...b,angle:'event_theme'},c],input).errors.join('|'),/DUPLICATE_INTERNAL_CANDIDATE_ANGLE/);
});
