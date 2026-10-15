'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Bridge=require('../scripts/kk-content-chat-bridge.js');

function event(body=''){
  return {
    issue:{
      number:999,
      title:'[KK-CONTENT-RUN] Example Concert',
      author_association:'OWNER',
      body
    }
  };
}

function copy(hook){
  return [
    '📱 KK Phone Rental | #เช่ามือถือ',
    '',
    '🔥 #ExampleConcert',
    '',
    hook,
    '',
    '🎤 vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
    '📍 Example Hall',
    '3 ต.ค. ✅ ว่าง',
    '',
    '💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ',
    '📱 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน',
    '☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน',
    '👉 เลือกวันแล้วจองคิว',
    'kk-phone-rental.vercel.app',
    '',
    '#ArtistExample #FandomExample #ExampleLive'
  ].join('\n');
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

function payload(){
  return {
    request:{
      message:'ขอโพสปล่อยเช่างานนี้บน X',
      input:{
        event:'Example Concert',
        venue:'Example Hall',
        date_display:'3 ต.ค.',
        verified_event:true,
        verified_pricing:true,
        price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
        inventory_available:true,
        recent_context_checked:true,
        day_statuses_verified:true,
        event_dates_verified:true,
        event_dates:['3 ต.ค.'],
        day_statuses:[{date_label:'3 ต.ค.',status:'available'}],
        official_event_hashtag:'#ExampleConcert',
        verified_hashtags:['#ExampleConcert','#ArtistExample','#FandomExample','#ExampleLive','#เช่ามือถือ']
      }
    },
    candidates:[
      {id:'a',angle:'event_theme',copy:copy('Hook A เน้นธีมงาน'),metrics:metrics({hook_strength:80})},
      {id:'b',angle:'fandom',copy:copy('Hook B เน้นแฟนด้อม'),metrics:metrics({hook_strength:95,novelty:92})},
      {id:'c',angle:'trust',copy:copy('Hook C เน้นความสะดวก'),metrics:metrics({hook_strength:82})}
    ]
  };
}

test('extracts a bounded JSON payload from issue markers',()=>{
  const body=`${Bridge.START}
\`\`\`json
${JSON.stringify(payload())}
\`\`\`
${Bridge.END}`;
  const parsed=Bridge.extractPayload(body);
  assert.equal(parsed.request.input.event,'Example Concert');
  assert.equal(parsed.candidates.length,3);
});

test('bridge rejects non-owner issue authors before Agent execution',async()=>{
  const e=event('');
  e.issue.author_association='CONTRIBUTOR';
  const result=await Bridge.runBridge({event:e,payload:payload()});
  assert.equal(result.status,'BLOCKED');
  assert.match(result.blocker,/BRIDGE_OWNER_ONLY/);
  assert.equal(result.gateway_status,'NOT_RUN');
});

test('bridge requires exactly three candidate envelopes',async()=>{
  const p=payload();
  p.candidates=p.candidates.slice(0,2);
  const result=await Bridge.runBridge({event:event(),payload:p});
  assert.equal(result.status,'BLOCKED');
  assert.match(result.blocker,/BRIDGE_EXACTLY_3_CANDIDATES_REQUIRED/);
});

test('owner bridge runs five-Agent gateway, QA and selector and emits one winner',async()=>{
  const rows=[];
  const result=await Bridge.runBridge({
    event:event(),
    payload:payload(),
    ledgerFn:async row=>{
      rows.push(row);
      return {ok:true,inserted:true,provider:'test',invocation_id:row.invocation_id};
    }
  });

  assert.equal(result.status,'PASS');
  assert.equal(result.gateway_status,'READY_FOR_OWNER_REVIEW');
  assert.equal(result.finalization_gate,'PASS');
  assert.equal(result.qa_gate,'PASS');
  assert.equal(result.selector_gate,'PASS');
  assert.equal(result.winner_id,'b');
  assert.equal(result.winner,copy('Hook B เน้นแฟนด้อม'));
  assert.deepEqual(result.invocation.required_agents,[
    'kk-marketing-agent',
    'kk-content-strategy',
    'kk-content-agent',
    'kk-content-qa',
    'kk-content-selector'
  ]);
  assert.deepEqual(result.invocation.invoked_agents,result.invocation.required_agents);
  assert.equal(rows.length,1);
  assert.equal(result.production_writes,0);
  assert.equal(result.publishes,0);
  assert.equal(result.owner_review_required,true);
});

test('bridge comment persists invocation evidence without exposing internal candidates',async()=>{
  const result=await Bridge.runBridge({event:event(),payload:payload()});
  assert.equal(result.status,'PASS');
  const comment=Bridge.buildComment(result);
  assert.match(comment,/KK Content Agent Bridge/);
  assert.match(comment,/Invocation:/);
  assert.match(comment,/kk-marketing-agent/);
  assert.match(comment,/kk-content-selector/);
  assert.match(comment,/Final post/);
  assert.match(comment,/Hook B เน้นแฟนด้อม/);
  assert.doesNotMatch(comment,/Hook A เน้นธีมงาน/);
  assert.doesNotMatch(comment,/Hook C เน้นความสะดวก/);
});
