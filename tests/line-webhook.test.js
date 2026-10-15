'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const crypto=require('node:crypto');
const mod=require('../server/line-booking-webhook');

test('verifies exact raw-body HMAC-SHA256 signature',()=>{const body='{"destination":"U123","events":[]}';const secret='secret';const sig=crypto.createHmac('sha256',secret).update(body).digest('base64');assert.equal(mod._test.validSignature(body,sig,secret),true);assert.equal(mod._test.validSignature(body,sig+'x',secret),false);});
test('parses current Thai storefront booking message',()=>{const b=mod._test.parseBookingText('สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 1,290฿\n\nชื่อเล่น : \nเบอร์โทร : ');assert.equal(b.event_name,'LYKN REFLEXION CONCERT');assert.equal(b.package_name,'vivo X300 Pro + Lens');assert.equal(b.price_display,'1,290฿');});
test('ignores unrelated customer text',()=>assert.equal(mod._test.parseBookingText('สวัสดีค่ะ'),null));
test('resolves poster only from matching public event row',async()=>{const csv='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show';const f=async()=>({ok:true,text:async()=>csv});const p=await mod._test.resolvePoster({event_name:'LYKN REFLEXION CONCERT',venue:'IMPACT Arena'},f);assert.equal(p,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');});
test('processes booking and replies with Flex hero using canonical package price',async()=>{const calls=[];const web='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show';const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\nPKG-BUNDLE,EVT-1,phone_lens_bundle,VIVO_X300_PRO,Vivo X300 Pro,ZEISS,Lens Vivo,"1,290",1,available,30,,1,';const f=async(url,opt)=>{calls.push({url,opt});if(String(url).includes('09_Web_Packages'))return{ok:true,text:async()=>pkg};if(String(url).includes('08_Web_Ready'))return{ok:true,text:async()=>web};return{ok:true,text:async()=>''};};const event={type:'message',replyToken:'reply-1',message:{type:'text',text:'สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 590 บาท'}};const out=await mod._test.processEvent(event,{LINE_CHANNEL_ACCESS_TOKEN:'token'},f);assert.equal(out.handled,true);const reply=calls.find(x=>String(x.url).includes('api.line.me'));assert.ok(reply);const sent=JSON.parse(reply.opt.body);assert.equal(sent.messages[0].type,'flex');assert.equal(sent.messages[0].contents.hero.url,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');assert.match(JSON.stringify(sent),/1,290 บาท/);assert.doesNotMatch(JSON.stringify(sent),/ราคา  590 บาท/);assert.match(reply.opt.headers.Authorization,/^Bearer /);});

test('derives canonical template id from public package ids',()=>{
  assert.equal(mod._test.templateIdFromWebPackageId('TPL-BUNDLE','EVT-1'),'TPL-BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('EVT-1-TPL-BUNDLE','EVT-1'),'TPL-BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('EVT-1-BUNDLE','EVT-1'),'BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('PKG-BUNDLE','EVT-1'),'PKG-BUNDLE');
});

test('LINE intake parses both new Storefront P0 TH/EN package labels without sending messages',()=>{
  const samples=[
    ['สวัสดีค่ะ สนใจเช่าแพ็กเกจนี้ค่ะ\n🎫 งาน: LYKN\n📅 วันที่: 24/10/2026\n📍 สถานที่: IMPACT Arena\n📱 รุ่น/แพ็กเกจ: Phone + Lens\n💰 ราคา: 1,290 THB','Phone + Lens'],
    ["Hello, I'd like to rent this package.\n🎫 Event: NCT 127\n📅 Date: 31/10/2026\n📍 Venue: Stadium\n📱 Package / model: Lens Only\n💰 Price: 390 THB",'Lens Only'],
    ['สนใจเช่า Vivo\nงาน: LYKN\nวันที่: 24/10/2026\nสถานที่: Arena\n📱 รุ่น: Vivo X300 Pro','Vivo X300 Pro'],
    ['Interested in renting model\nEvent: NCT\nDate: 31/10/2026\nVenue: Stadium\n📱 Model: Vivo X300 Pro','Vivo X300 Pro']
  ];
  for(const [body,model] of samples){
    const result=mod._test.parseBookingText(body);
    assert.ok(result,'booking payload should parse');
    assert.equal(result.package_name,model,'must preserve specific package instead of generic greeting');
  }
  assert.equal(mod._test.parseBookingText('Hello, I would like to rent this package.'),null);
});

