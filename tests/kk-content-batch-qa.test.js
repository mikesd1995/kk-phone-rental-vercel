'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const BatchQa=require('../server/kk-content-batch-qa.js');

function item(event,hook,dna=[]){
  const post=[
    '📱 KK Phone Rental | #เช่ามือถือ',
    '',
    '🎤 vivo X300 Pro 690฿ | + Lens รวม 890฿',
    '',
    '🗓️ 1 ต.ค. 2026',
    '📍 Example Hall',
    '',
    hook,
    '',
    '💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ',
    '📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน',
    '☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน',
    '👉 จองคิว / เช็กคิวว่าง',
    'https://kk-phone-rental.vercel.app/',
    '',
    '#ExampleEvent #Artist #Fandom'
  ].join('\n');
  return {
    input:{
      event,
      artist:event,
      venue:'Example Hall',
      date_display:'1 ต.ค. 2026',
      price_display:'vivo X300 Pro 690฿ | + Lens รวม 890฿',
      official_event_hashtag:'#ExampleEvent',
      recent_context_checked:true,
      event_dna:dna.length?dna:[event+' special format',event+' fandom detail']
    },
    post
  };
}

test('blocks batch when generic prepare-device hook archetype is overused',()=>{
  const result=BatchQa.validateFinalPostBatch([
    item('Event A','ใครมีบัตรแล้ว เตรียมเครื่องไว้เก็บทุกโมเมนต์ของ Event A ให้ครบ'),
    item('Event B','แฟน Event B เตรียมเครื่องไว้เก็บทุกช็อตบนเวทีให้ครบ'),
    item('Event C','ใครรอ Event C ล็อกเครื่องไว้ก่อน จะได้เก็บทุกโมเมนต์ของศิลปิน')
  ]);
  assert.equal(result.gate,'BLOCKED');
  assert.match(result.errors.join('|'),/BATCH_GENERIC_ARCHETYPE_OVERUSED:PREPARE_DEVICE/);
});

test('passes when each event uses a different hook architecture',()=>{
  const result=BatchQa.validateFinalPostBatch([
    item('Sport Day','เสียงเชียร์หลังเกมยังไม่จบ เพราะ Group Shot 2:20 คือจังหวะที่งานนี้ต่างจากอีเวนต์ทั่วไป',['Group Shot 2:20','after-match format']),
    item('Synthphony','เพลงคุ้นหูของ INK กำลังถูกจัดวางใหม่ในโลก Synthphony ที่เน้นเสียงและภาพคนละอารมณ์กับโชว์ปกติ',['Synthphony arrangement','INK live reinterpretation']),
    item('Final EP','ตอนจบไม่ได้อยู่แค่บนจอ เพราะหลัง Final EP ยังมีช่วงคุยกับนักแสดงและ Exclusive Show ต่อทันที',['Final EP screening','Exclusive Show'])
  ]);
  assert.equal(result.gate,'PASS');
  assert.equal(result.rows.length,3);
});

test('fails closed when recent-post context was not checked',()=>{
  const a=item('Event A','ธีมของงานนี้วางภาพจำไว้ที่โชว์เปิดและช่วงพูดคุย',['opening show','talk segment']);
  a.input.recent_context_checked=false;
  const b=item('Event B','รอบนี้ใช้เวทีแบบ 360 องศา ทำให้มุมถ่ายต่างจากคอนปกติ',['360 stage','arena layout']);
  const result=BatchQa.validateFinalPostBatch([a,b]);
  assert.equal(result.gate,'BLOCKED');
  assert.match(result.errors.join('|'),/RECENT_CONTEXT_NOT_CHECKED/);
});

test('hook skeleton removes known event DNA before similarity comparison',()=>{
  const a=item('Alpha Event','Alpha Event กับ Group Shot 2:20 ทำให้ช่วงท้ายมีจังหวะเฉพาะที่แฟนรอ',['Group Shot 2:20','Alpha special']);
  const skeleton=BatchQa.hookSkeleton(a.post,a.input);
  assert.doesNotMatch(skeleton,/group shot/i);
  assert.doesNotMatch(skeleton,/alpha event/i);
});


test('event hashtag header is not mistaken for the creative hook',()=>{
  const a=item('Event Header','ธีมจริงของงานอยู่ที่ช่วงพูดคุยพิเศษ',['special talk','fandom detail']);
  a.post=a.post.replace('🎤 vivo X300 Pro 690฿ | + Lens รวม 890฿','🔥 งาน #ExampleEvent\n\n🎤 vivo X300 Pro 690฿ | + Lens รวม 890฿');
  const hook=BatchQa.hookText(a.post,a.input);
  assert.doesNotMatch(hook,/งาน\s+#ExampleEvent/);
  assert.match(hook,/ธีมจริงของงาน/);
});
