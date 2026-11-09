'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const QA=require('../server/kk-content-qa-gate.js');

const input={
 verified_event:true,verified_pricing:true,inventory_available:true,
 price_display:'vivo X300 Pro 790฿ | เพิ่ม Lens +200฿',
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
 const a=base('เวทีรอบนี้เล่นกับแสงและภาพใหญ่ ใครชอบเก็บช็อตรวมทั้งฮอลล์น่าจะมีมุมให้เล่นเยอะ');
 const b=base('แฟนที่รอ ENCORE รอบนี้น่าจะอยากเก็บทั้งเสียงร้องและรีแอคชันช่วงสำคัญให้ครบ');
 const c=base('ถ้าอยากลดความวุ่นวายก่อนเข้าฮอลล์ ร้านเตรียมเครื่องและสอนใช้ให้ก่อนเวลาได้');
 assert.equal(QA.validateVariants([a,b,c],input).gate,'PASS');
 assert.equal(QA.validateVariants([a],input).gate,'BLOCKED');
 assert.match(QA.validateVariants([a,a,c],input).errors.join('|'),/DUPLICATE_INTERNAL_CANDIDATE_COPY/);
});

test('structured internal candidates must use distinct angles',()=>{
 const a={copy:base('เวทีรอบนี้เล่นกับแสงและภาพใหญ่ เหมาะกับการเก็บบรรยากาศกว้าง'),angle:'event_theme'};
 const b={copy:base('แฟนที่รอ ENCORE น่าจะอยากเก็บโมเมนต์ร้องสดและรีแอคชันช่วงสำคัญ'),angle:'fandom'};
 const c={copy:base('ลดความวุ่นวายก่อนเข้าฮอลล์ด้วยการเตรียมเครื่องและเรียนรู้การใช้ก่อนเวลา'),angle:'convenience'};
 assert.equal(QA.validateVariants([a,b,c],input).gate,'PASS');
 assert.match(QA.validateVariants([a,{...b,angle:'event_theme'},c],input).errors.join('|'),/DUPLICATE_INTERNAL_CANDIDATE_ANGLE/);
});


test('owner CTA style accepts a unique booking lead before a canonical simple link',()=>{
 const post=base('เสียงเชียร์บนเวทีทำให้แฟน ๆ รู้สึกใกล้กับการแสดงมากขึ้น')
  .replace('👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/','เสียงเพลงกำลังจะเริ่ม เลือกแพ็กเกจให้เหมาะกับการใช้งานของคุณ\n👉 จองเลย: https://kk-phone-rental.vercel.app/');
 const result=QA.validatePost(post,{...input,cta_style:'lead_then_book_link'});
 assert.equal(result.gate,'PASS',result.errors.join('|'));
});

test('owner CTA style rejects stock counts and generic or absent booking lead',()=>{
 const strict={...input,cta_style:'lead_then_book_link'};
 const absent=base('นี่คือข้อความอธิบายงาน').replace('👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/','👉 จองเลย: https://kk-phone-rental.vercel.app/');
 const result=QA.validatePost(absent,strict);
 assert.equal(result.gate,'BLOCKED');
 assert.match(result.errors.join('|'),/BOOKING_CTA_LEAD_MISSING/);
 const withStock=absent.replace('👉 จองเลย: https:', 'เลือกแพ็กเกจให้เหมาะกับงานที่กำลังจะมาถึง\n👉 จองเลย: https:').replace('นี่คือข้อความอธิบายงาน','เหลือ 2 เครื่อง นี่คือข้อความอธิบายงาน');
 const blocked=QA.validatePost(withStock,strict);
 assert.match(blocked.errors.join('|'),/INVENTORY_COUNT_IN_PUBLIC_COPY/);
});

test('owner CTA style rejects event dates inside booking lead',()=>{
 const strict={...input,cta_style:'lead_then_book_link'};
 const post=base('เพลงนี้สร้างบรรยากาศการแสดงที่มีเอกลักษณ์')
  .replace('👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/','ไปเจอกัน 3–4 ต.ค. เปิดดูราคาแพ็กเกจได้เลย\n👉 จองเลย: https://kk-phone-rental.vercel.app/');
 const result=QA.validatePost(post,strict);
 assert.match(result.errors.join('|'),/BOOKING_CTA_LEAD_HAS_DATE/);
});
