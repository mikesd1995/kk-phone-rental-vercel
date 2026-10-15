'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Bridge=require('../scripts/kk-content-batch-chat-bridge.js');

function event(){
  return {
    issue:{
      number:1001,
      title:'[KK-CONTENT-BATCH] three event acceptance',
      author_association:'OWNER',
      body:''
    }
  };
}

function metrics(overrides={}){
  return {
    hook_strength:85,
    event_fandom_relevance:88,
    timing_relevance:80,
    novelty:84,
    hashtag_relevance:100,
    readability:90,
    event_specificity:90,
    naturalness:90,
    non_template_feel:88,
    hook_originality:87,
    sales_pressure_balance:90,
    commercial_relevance:86,
    ...overrides
  };
}

function copy(tag,artist,event,date,venue,hook){
  return [
    '📱 KK Phone Rental | #เช่ามือถือ',
    '',
    '🔥 งาน '+tag,
    '',
    '🎤 vivo X300 Pro 690฿ | + Lens รวม 890฿',
    '📍 '+venue,
    date+' ✅ ว่าง',
    '',
    hook,
    '',
    '💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ',
    '📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน',
    '☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน',
    '👉 เลือกวันแล้วจองคิวงาน '+event,
    'kk-phone-rental.vercel.app',
    '',
    artist
  ].join('\n');
}

function item(n,hookWinner){
  const tag='#Event'+n;
  const artist='#Artist'+n+' #Fandom'+n+' #Community'+n;
  const eventName='Event '+n;
  const date=n+' ต.ค. 2026';
  const venue='Hall '+n;
  const input={
    event:eventName,
    artist:'Artist '+n,
    venue,
    date_display:date,
    verified_event:true,
    verified_pricing:true,
    price_display:'vivo X300 Pro 690฿ | + Lens รวม 890฿',
    inventory_available:true,
    day_statuses_verified:true,
    event_dates_verified:true,
    event_dates:[date],
    day_statuses:[{date_label:date,status:'available'}],
    official_event_hashtag:tag,
    verified_hashtags:[tag,'#Artist'+n,'#Fandom'+n,'#Community'+n,'#เช่ามือถือ'],
    recent_context_checked:true,
    recent_posts:[],
    event_dna:['special format '+n,'fandom moment '+n]
  };
  return {
    subject:eventName,
    request:{message:'ขอโพสปล่อยเช่างานนี้บน X',input},
    candidates:[
      {id:'a',angle:'event_theme',copy:copy(tag,artist,eventName,date,venue,'ภาพจำของ '+eventName+' อยู่ที่ special format '+n+' ซึ่งทำให้งานนี้มีจังหวะเล่าเรื่องของตัวเอง'),metrics:metrics({hook_strength:80})},
      {id:'b',angle:'fandom',copy:copy(tag,artist,eventName,date,venue,hookWinner),metrics:metrics({hook_strength:96,novelty:94,event_specificity:97,non_template_feel:96,hook_originality:95})},
      {id:'c',angle:'trust',copy:copy(tag,artist,eventName,date,venue,'โฟกัสรอบนี้อยู่ที่ fandom moment '+n+' และการรับเครื่องหน้างานที่ลดขั้นตอนก่อนเข้างาน'),metrics:metrics({hook_strength:82})}
    ]
  };
}

test('batch bridge runs one five-agent invocation per item and returns winners only after batch QA',async()=>{
  const payload={items:[
    item(1,'เสียงเชียร์หลังเกมยังไม่จบ เพราะช่วง Group Shot คือจังหวะเฉพาะของ Event 1'),
    item(2,'เพลงเดิมถูกเล่าใหม่ด้วยซาวด์แบบ Synthphony ทำให้ Event 2 มีภาพจำคนละแบบกับโชว์ปกติ'),
    item(3,'ตอนจบไม่ได้หยุดที่หน้าจอ เพราะ Event 3 มีช่วงคุยและ Exclusive Show ต่อทันที')
  ]};
  const rows=[];
  const result=await Bridge.runBridge({
    event:event(),
    payload,
    ledgerFn:async row=>{
      rows.push(row);
      return {ok:true,inserted:true,provider:'test',invocation_id:row.invocation_id};
    }
  });
  assert.equal(result.status,'PASS',JSON.stringify({blocker:result.blocker,items:result.items&&result.items.map(x=>({blocker:x.blocker,gateway_status:x.gateway_status,finalization_gate:x.finalization_gate,owner_x_errors:x.finalization&&x.finalization.owner_x_qa&&x.finalization.owner_x_qa.errors}))}));
  assert.equal(result.batch_qa.gate,'PASS');
  assert.equal(result.item_count,3);
  assert.equal(rows.length,3);
  for(const row of result.items){
    assert.equal(row.gateway_status,'READY_FOR_OWNER_REVIEW');
    assert.equal(row.qa_gate,'PASS');
    assert.equal(row.selector_gate,'PASS');
    assert.ok(row.winner);
  }
});

test('batch bridge fail-closes when selected hooks overuse the same generic prepare-device archetype',async()=>{
  const payload={items:[
    item(1,'ใครมีบัตร Event 1 เตรียมเครื่องไว้เก็บทุกโมเมนต์ให้ครบ'),
    item(2,'แฟน Event 2 ล็อกเครื่องไว้ก่อน จะได้เก็บทุกช็อตบนเวที'),
    item(3,'ใครรอ Event 3 จองเครื่องไว้ก่อนแล้วค่อยเก็บทุกโมเมนต์ของศิลปิน')
  ]};
  const result=await Bridge.runBridge({event:event(),payload,
    ledgerFn:async row=>({ok:true,inserted:true,provider:'test',invocation_id:row.invocation_id})
  });
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.blocker,'BATCH_DIVERSITY_QA_FAILED');
  assert.match(result.batch_qa.errors.join('|'),/BATCH_GENERIC_ARCHETYPE_OVERUSED:PREPARE_DEVICE/);
});

test('batch bridge rejects non-owner issue authors before agent execution',async()=>{
  const e=event();
  e.issue.author_association='CONTRIBUTOR';
  const result=await Bridge.runBridge({event:e,payload:{items:[item(1,'หนึ่ง'),item(2,'สอง')]}});
  assert.equal(result.status,'BLOCKED');
  assert.match(result.blocker,/BATCH_BRIDGE_OWNER_ONLY/);
});

test('premium batch blocks the same booking CTA repeated across distinct events',async()=>{
  const first=item(1,'Event 1 มีโมเมนต์ Group Shot กับศิลปินที่แฟนด้อมอยากเก็บ');
  const second=item(2,'Event 2 มี Synthphony สดในโชว์พิเศษและโทนบรรยากาศอีกแบบ');
  for(const candidate of second.candidates){
    candidate.copy=candidate.copy.replace('👉 เลือกวันแล้วจองคิวงาน Event 2','👉 เลือกวันแล้วจองคิวงาน Event 1');
  }
  const result=await Bridge.runBridge({
    event:event(),payload:{items:[first,second]},
    ledgerFn:async row=>({ok:true,inserted:true,provider:'test',invocation_id:row.invocation_id})
  });
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.blocker,'BATCH_DIVERSITY_QA_FAILED');
  assert.match(result.batch_qa.errors.join('|'),/BATCH_CTA_DUPLICATE/);
});
