'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const crypto=require('node:crypto');
const mod=require('../server/line-booking-webhook');

test('verifies exact raw-body HMAC-SHA256 signature',()=>{const body='{"destination":"U123","events":[]}';const secret='secret';const sig=crypto.createHmac('sha256',secret).update(body).digest('base64');assert.equal(mod._test.validSignature(body,sig,secret),true);assert.equal(mod._test.validSignature(body,sig+'x',secret),false);});
test('parses current Thai storefront booking message',()=>{const b=mod._test.parseBookingText('สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 1,290฿\n\nชื่อเล่น : \nเบอร์โทร : ');assert.equal(b.event_name,'LYKN REFLEXION CONCERT');assert.equal(b.package_name,'vivo X300 Pro + Lens');assert.equal(b.price_display,'1,290฿');});
test('ignores unrelated customer text',()=>assert.equal(mod._test.parseBookingText('สวัสดีค่ะ'),null));
test('resolves poster only from matching public event row',async()=>{const csv='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show,เปิดจอง,1';const f=async()=>({ok:true,text:async()=>csv});const p=await mod._test.resolvePoster({event_name:'LYKN REFLEXION CONCERT',venue:'IMPACT Arena'},f);assert.equal(p,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');});
test('processes booking and replies with Flex hero using canonical package price',async()=>{const calls=[];const web='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show,เปิดจอง,1';const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\nPKG-BUNDLE,EVT-1,phone_lens_bundle,VIVO_X300_PRO,Vivo X300 Pro,ZEISS,Lens Vivo,"1,290",1,available,30,,1,';const f=async(url,opt)=>{calls.push({url,opt});if(String(url).includes('09_Web_Packages'))return{ok:true,text:async()=>pkg};if(String(url).includes('08_Web_Ready'))return{ok:true,text:async()=>web};return{ok:true,text:async()=>''};};const event={type:'message',replyToken:'reply-1',message:{type:'text',text:'สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 590 บาท'}};const out=await mod._test.processEvent(event,{LINE_CHANNEL_ACCESS_TOKEN:'token'},f);assert.equal(out.handled,true);const reply=calls.find(x=>String(x.url).includes('api.line.me'));assert.ok(reply);const sent=JSON.parse(reply.opt.body);assert.equal(sent.messages[0].type,'flex');assert.equal(sent.messages[0].contents.hero.url,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');assert.match(JSON.stringify(sent),/1,290 บาท/);assert.doesNotMatch(JSON.stringify(sent),/ราคา  590 บาท/);assert.match(reply.opt.headers.Authorization,/^Bearer /);});

test('derives canonical template id from public package ids',()=>{
  assert.equal(mod._test.templateIdFromWebPackageId('TPL-BUNDLE','EVT-1'),'TPL-BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('EVT-1-TPL-BUNDLE','EVT-1'),'TPL-BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('EVT-1-BUNDLE','EVT-1'),'BUNDLE');
  assert.equal(mod._test.templateIdFromWebPackageId('PKG-BUNDLE','EVT-1'),'PKG-BUNDLE');
});

function syntheticVisibleRow(action='show',status='เปิดจอง',phones=1){
 return 'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\n'+
 'EVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=synthetic,'+
 action+','+status+','+phones;
}
const PACKAGES='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status\n'+
 'PKG-1,EVT-1,phone_lens_bundle,VIVO,vivo X300 Pro,ZEISS,Lens,990,1,available';
const BOOK={event_name:'LYKN REFLEXION CONCERT',event_date:'18 ต.ค. 2026',venue:'IMPACT Arena',package_name:'vivo X300 Pro + Lens'};
test('hidden, full or zero-phone event cannot be canonically rented or rendered as LINE poster',async()=>{
 for(const [action,status,phones,bookable] of [
  ['show','เปิดจอง',1,true],['hide','เปิดจอง',1,false],
  ['show_full','เต็ม',0,false],['show','เต็ม',1,false],
  ['show','เปิดจอง',0,false],['show','เปิดจอง','',false]
 ]){
  const calls=[];
  const fetchImpl=async url=>{
   calls.push(String(url));
   return {ok:true,text:async()=>String(url).includes('09_Web_Packages')?PACKAGES:syntheticVisibleRow(action,status,phones)};
  };
  const canonical=await mod._test.resolveCanonicalPackage(BOOK,fetchImpl);
  const poster=await mod._test.resolvePoster(BOOK,fetchImpl);
  assert.equal(Boolean(canonical),bookable,action+'/'+status+'/'+phones+' canonical');
  assert.equal(Boolean(poster),bookable,action+'/'+status+'/'+phones+' poster');
  assert.equal(calls.filter(x=>x.includes('09_Web_Packages')).length,bookable?1:0);
 }
});
test('LINE reply provider body and thrown transport errors never expose customer markers',async()=>{
 const marker='SYNTHETIC_PRIVATE_CONTACT_012345';
 await assert.rejects(()=>mod._test.replyFlex('T',{type:'text',text:'ok'},'SYNTHETIC_TOKEN',async()=>({
  ok:false,status:429,text:async()=>marker
 })),err=>{
  assert.equal(err.code,'LINE_BOOKING_REPLY_FAILED');
  assert.equal(err.status,429);
  assert.doesNotMatch(err.message,/SYNTHETIC_PRIVATE_CONTACT|012345/);
  return true;
 });
 await assert.rejects(()=>mod._test.replyFlex('T',{type:'text',text:'ok'},'SYNTHETIC_TOKEN',async()=>{
  throw Error(marker);
 }),err=>{
  assert.equal(err.code,'LINE_BOOKING_REPLY_TRANSPORT_FAILED');
  assert.doesNotMatch(err.message,/SYNTHETIC_PRIVATE_CONTACT|012345/);
  return true;
 });
});
test('owner-hidden event fails closed with no Apps Script booking and no PII in warning',async()=>{
 const warnings=[],old=console.warn;
 console.warn=(...args)=>warnings.push(args.join(' '));
 try{
  const input='สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nชื่อเล่น : Demo\nเบอร์โทร : 0000000000';
  const requests=[];
  const result=await mod._test.processEvent({type:'message',replyToken:'SYNTHETIC_REPLY',
   webhookEventId:'SYNTHETIC_PRIVATE_WEBHOOK',source:{type:'user',userId:'UCUSTOMER'},
   message:{type:'text',text:input}},{
   KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
   KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
   KK_ADMIN_API_KEY:'synthetic-key',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',
   LINE_CHANNEL_SECRET:'synthetic-secret',KK_OWNER_LINE_USER_ID:'UOWNER'
  },async url=>{
    requests.push(String(url));
    if(String(url).includes('08_Web_Ready'))return {ok:true,text:async()=>syntheticVisibleRow('hide','เปิดจอง',1)};
    if(String(url).includes('09_Web_Packages'))return {ok:true,text:async()=>PACKAGES};
    if(String(url).endsWith('/reply'))return {ok:true,status:200};
    throw Error('No real provider or writer calls');
  });
  assert.equal(result.handled,true);
  assert.equal(result.booking_id,'');
  assert.equal(result.automation_status,'CANONICAL_REQUIRED');
  assert.equal(requests.filter(x=>x.endsWith('/reply')).length,1);
  assert.equal(requests.some(x=>x.includes('script.google.com')||x.endsWith('/push')),false);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/FAIL_CLOSED_CANONICAL_REQUIRED/);
  assert.doesNotMatch(warnings[0],/LYKN REFLEXION CONCERT|SYNTHETIC_PRIVATE_WEBHOOK|0000000000/);
 }finally{console.warn=old;}
});
