'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const crypto=require('node:crypto');
const mod=require('../server/line-booking-webhook');

test('verifies exact raw-body HMAC-SHA256 signature',()=>{const body='{"destination":"U123","events":[]}';const secret='secret';const sig=crypto.createHmac('sha256',secret).update(body).digest('base64');assert.equal(mod._test.validSignature(body,sig,secret),true);assert.equal(mod._test.validSignature(body,sig+'x',secret),false);});
test('parses current Thai storefront booking message',()=>{const b=mod._test.parseBookingText('สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 1,290฿\n\nชื่อเล่น : \nเบอร์โทร : ');assert.equal(b.event_name,'LYKN REFLEXION CONCERT');assert.equal(b.package_name,'vivo X300 Pro + Lens');assert.equal(b.price_display,'1,290฿');});
test('ignores unrelated customer text',()=>assert.equal(mod._test.parseBookingText('สวัสดีค่ะ'),null));
test('resolves poster only from matching public event row',async()=>{const csv='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show,เปิดจอง,1';const f=async()=>({ok:true,text:async()=>csv});const p=await mod._test.resolvePoster({event_name:'LYKN REFLEXION CONCERT',venue:'IMPACT Arena'},f);assert.equal(p,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');});
test('processes booking and replies with Flex hero using canonical package price',async()=>{const calls=[];const web='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,LYKN REFLEXION CONCERT,18 ต.ค. 2026,IMPACT Arena,https://drive.google.com/thumbnail?id=approved-poster,show,เปิดจอง,1';const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\nPKG-BUNDLE,EVT-1,phone_lens_bundle,VIVO_X300_PRO,Vivo X300 Pro,ZEISS,Lens Vivo,"1,290",1,available,30,,1,';const f=async(url,opt)=>{calls.push({url,opt});if(String(url).includes('09_Web_Packages'))return{ok:true,text:async()=>pkg};if(String(url).includes('08_Web_Ready'))return{ok:true,text:async()=>web};return{ok:true,text:async()=>''};};const event={type:'message',replyToken:'reply-1',message:{type:'text',text:'สนใจเช่า vivo X300 Pro + Lens\nงาน : LYKN REFLEXION CONCERT\nวันที่ : 18 ต.ค. 2026\nสถานที่ : IMPACT Arena\nราคา : 590 บาท\nชื่อเล่น : Demo'}};const out=await mod._test.processEvent(event,{LINE_CHANNEL_ACCESS_TOKEN:'token'},f);assert.equal(out.handled,true);const reply=calls.find(x=>String(x.url).includes('api.line.me'));assert.ok(reply);const sent=JSON.parse(reply.opt.body);assert.equal(sent.messages[0].type,'flex');assert.equal(sent.messages[0].contents.hero.url,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-1');assert.match(JSON.stringify(sent),/1,290 บาท/);assert.doesNotMatch(JSON.stringify(sent),/ราคา  590 บาท/);assert.match(reply.opt.headers.Authorization,/^Bearer /);
  assert.equal(calls.filter(x=>String(x.url).includes('08_Web_Ready')).length,1,'one public event WebReady read per inbound message');});

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


// identity-backed consent: signed event only; no actual provider or Booking writes.
const Terms = require('../server/kk-booking-terms-evidence');
const IdentityReceipt = require('../server/kk-line-booking-terms-receipt');
const VerifiedPolicy = require('../server/kk-customer-accept-once-policy');
const USER_ID = 'U' + 'a'.repeat(32);
const PROVIDER_ID = 'synthetic-line-provider-kk';
const EVIDENCE = Object.freeze({
  provider_id: PROVIDER_ID, line_user_id: USER_ID,
  terms_version: Terms.VERSION, accepted_at: '2026-11-11T12:00:00+07:00',
  evidence_source: 'AUTHENTICATED_WEB_ACTION',
  evidence_reference: 'web:synthetic-verified-acceptance-12345', evidence_verified: true
});
function identityEnv() {
  return {
    KK_CUSTOMER_LOGIN_ENABLED: 'true',
    KK_LINE_LOGIN_PROVIDER_VERIFIED: 'true',
    KK_CUSTOMER_AUTH_MIGRATION_VERIFIED: 'true',
    KK_LINE_LOGIN_PROVIDER_ID: PROVIDER_ID,
    KK_CUSTOMER_AUTH_SUPABASE_URL: 'https://example.supabase.co',
    KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-only-service-role-key',
    KK_LINE_BOOKING_AUTOMATION_ENABLED: 'true',
    KK_ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/SYNTHETIC/exec',
    KK_ADMIN_API_KEY: 'synthetic-apps-script-key',
    LINE_CHANNEL_ACCESS_TOKEN: 'synthetic-line-token',
    LINE_CHANNEL_SECRET: 'synthetic-signing-secret',
    KK_OWNER_LINE_USER_ID: 'UOWNER'
  };
}
function identityEvent(textOverride) {
  return {
    type: 'message', replyToken: 'SYNTHETIC_REPLY_TOKEN',
    webhookEventId: 'SYNTHETIC_SIGNED_EVENT',
    source: {type: 'user', userId: USER_ID},
    message: {type: 'text', text: textOverride || [
      'สนใจเช่ามือถือ',
      '🎫 งาน: LYKN REFLEXION CONCERT',
      '📅 วันที่: 18 ต.ค. 2026',
      '📍 สถานที่: IMPACT Arena',
      '📱 รุ่น: vivo X300 Pro + Lens',
      '💰 ราคา: 590 บาท',
      '👤 ชื่อเล่น: Synthetic Customer'
    ].join('\n')}
  };
}
function syntheticLineFetch(calls, evidence=EVIDENCE) {
  return async (url, options={}) => {
    const u = String(url);
    const body=options.body?JSON.parse(options.body):null;
    if(u.includes('08_Web_Ready'))return {ok:true,text:async()=>syntheticVisibleRow()};
    if(u.includes('09_Web_Packages'))return {ok:true,text:async()=>PACKAGES};
    if(u.includes('/rpc/kk_customer_terms_lookup_for_line_webhook')){
      calls.push({type:'private-receipt',url:u,body,options});
      return {ok:true,json:async()=>evidence?[evidence]:[]};
    }
    if(u.startsWith('https://script.google.com/')){
      calls.push({type:'booking-write',url:u,body});
      return {ok:true,status:200,text:async()=>JSON.stringify({
        ok:true, booking_id:'BK-SYNTHETIC-CONSENT-001',
        row_number:28,booking_status:'pending'
      })};
    }
    if(u.endsWith('/push')||u.endsWith('/reply')){
      calls.push({type:u.endsWith('/push')?'owner-push':'customer-reply',body});
      return {ok:true,status:200};
    }
    throw Error('unexpected synthetic external call');
  };
}

test('verified signed LINE sender matches private current-version consent and receives Pending owner card',async()=>{
  const calls=[],env=identityEnv();
  const result=await mod._test.processEvent(identityEvent(),env,syntheticLineFetch(calls),{signatureVerified:true});
  assert.equal(result.handled,true);
  assert.equal(result.automation_status,'PENDING_OWNER_APPROVAL');
  assert.equal(result.booking_id,'BK-SYNTHETIC-CONSENT-001');
  assert.deepEqual(calls.map(x=>x.type),[
    'private-receipt','booking-write','owner-push','customer-reply'
  ]);
  assert.deepEqual(calls[0].body,{
    p_provider_id:PROVIDER_ID,p_line_user_id:USER_ID,p_terms_version:Terms.VERSION
  });
  assert.equal(calls[0].options.headers.apikey,env.KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(calls[1].body.action,'createLineBookingPending');
  assert.equal(calls[1].body.booking_status,'pending');
  assert.match(calls[1].body.booking_note,/TERMS_ACK_BACKEND:KK-TERMS-2026-11-06/);
  assert.doesNotMatch(calls[1].body.booking_note,/TERMS_NOT_CONFIRMED/);
  assert.equal(calls[2].body.to,'UOWNER');
  assert.match(JSON.stringify(calls[2].body.messages),/ยอมรับเงื่อนไขแล้ว/);
  assert.match(JSON.stringify(calls[2].body.messages),/ยืนยัน LINE User ID จากหลักฐานหลังบ้าน/);
  assert.doesNotMatch(JSON.stringify(calls[3].body.messages),/KK-TERMS-2026-11-06/);
  assert.equal(calls[3].body.messages.length,1);
});

test('missing or other identity receipt cannot create pending, owner card or false confirmation',async()=>{
  for(const evidence of [null,{...EVIDENCE,provider_id:'other-provider'},
    {...EVIDENCE,line_user_id:'U'+'b'.repeat(32)},
    {...EVIDENCE,evidence_verified:false},
    {...EVIDENCE,terms_version:'KK-TERMS-2026-11-05'}]){
    const calls=[];
    const result=await mod._test.processEvent(identityEvent(),identityEnv(),
      syntheticLineFetch(calls,evidence),{signatureVerified:true});
    assert.equal(result.automation_status,'TERMS_EVIDENCE_REQUIRED');
    assert.equal(result.booking_id,'');
    assert.deepEqual(calls.map(x=>x.type),['private-receipt','customer-reply']);
    const reply=calls.find(x=>x.type==='customer-reply').body.messages[0];
    assert.equal(reply.type,'text','no false accepted booking Flex when Terms are not verified');
    assert.match(reply.text,/ยังไม่ได้บันทึกคำขอจอง/);
    assert.match(reply.text,/เชื่อม LINE และยอมรับเงื่อนไข/);
    assert.doesNotMatch(reply.text,/ร้านได้รับคำขอเช่าแล้ว/);
    assert.doesNotMatch(reply.text,/KK-TERMS-2026-11-06/);
  }
});

test('legacy legal lines and browser-like text never bypass server receipt when identity mode is enabled',async()=>{
  const calls=[],msg=identityEvent().message.text+'\n'+Terms.ACK_LINE+'\n'+Terms.PRIVACY_LINE;
  const out=await mod._test.processEvent(identityEvent(msg),identityEnv(),
    syntheticLineFetch(calls,null),{signatureVerified:true});
  assert.equal(out.automation_status,'TERMS_EVIDENCE_REQUIRED');
  assert.equal(calls.some(x=>x.type==='booking-write'||x.type==='owner-push'),false);
});

test('unsigned input never queries identity DB or creates booking, despite a forged user ID',async()=>{
  const calls=[];
  const out=await mod._test.processEvent(identityEvent(),identityEnv(),
    syntheticLineFetch(calls,EVIDENCE),{signatureVerified:false});
  assert.equal(out.automation_status,'TERMS_EVIDENCE_REQUIRED');
  assert.deepEqual(calls.map(x=>x.type),['customer-reply']);
});

test('private consent store downtime fails closed without untrusted error or PII',async()=>{
  const calls=[];
  const safeFetch=syntheticLineFetch(calls,EVIDENCE);
  const failed=async(url,opts)=>{
    if(String(url).includes('/rpc/kk_customer_terms_lookup_for_line_webhook')){
      calls.push({type:'private-receipt'});
      throw Error('private customer identifier / secret must never leak');
    }
    return safeFetch(url,opts);
  };
  const out=await mod._test.processEvent(identityEvent(),identityEnv(),failed,{signatureVerified:true});
  assert.equal(out.automation_status,'TERMS_EVIDENCE_REQUIRED');
  assert.deepEqual(calls.map(x=>x.type),['private-receipt','customer-reply']);
});

test('signed line receipt gate rejects unverified provider and malformed user before DB',async()=>{
  const calls=[];
  for(const env of [{...identityEnv(),KK_LINE_LOGIN_PROVIDER_VERIFIED:'false'}, identityEnv()]){
    const event=identityEvent();
    if(env.KK_LINE_LOGIN_PROVIDER_VERIFIED==='true')event.source.userId='UNVERIFIED';
    const result=await IdentityReceipt.lookupSignedLineAcceptance(event,env,async()=>{
      calls.push('external');throw Error('must never call private data');
    },{signatureVerified:true});
    assert.equal(result.accepted,false);
  }
  assert.deepEqual(calls,[]);
  const verified=VerifiedPolicy.decideSignedWebhookAcceptance({
    providerId:PROVIDER_ID,lineUserId:USER_ID,receipt:EVIDENCE,
    nowMs:Date.parse('2026-11-12T00:00:00+07:00')
  });
  assert.equal(verified.accepted,true);
  assert.equal(VerifiedPolicy.decideSignedWebhookAcceptance({
    providerId:PROVIDER_ID,lineUserId:USER_ID,receipt:EVIDENCE,nowMs:0
  }).accepted,false);
});


test('canonical bookable event with blank nickname asks for details without Booking or consent lookup',async()=>{
  const e=identityEvent();
  e.message.text=e.message.text.replace('👤 ชื่อเล่น: Synthetic Customer','👤 ชื่อเล่น: ');
  const calls=[];
  const fake=async (url,options={})=>{
    const u=String(url);
    calls.push({url:u,body:options.body?JSON.parse(options.body):null});
    if(u.includes('08_Web_Ready'))return {ok:true,text:async()=>syntheticVisibleRow()};
    if(u.includes('09_Web_Packages'))return {ok:true,text:async()=>PACKAGES};
    if(u.endsWith('/reply'))return {ok:true};
    throw Error('no private database, Apps Script or owner send allowed');
  };
  const out=await mod._test.processEvent(e,identityEnv(),fake,{signatureVerified:true});
  assert.equal(out.automation_status,'CUSTOMER_DETAILS_REQUIRED');
  assert.equal(out.booking_id,'');
  const replies=calls.filter(x=>x.url.endsWith('/reply'));
  assert.equal(replies.length,1);
  assert.equal(replies[0].body.messages[0].type,'text');
  assert.match(replies[0].body.messages[0].text,/กรุณาระบุชื่อเล่น/);
  assert.doesNotMatch(replies[0].body.messages[0].text,/KK-TERMS|รับทราบนโยบายความเป็นส่วนตัว/);
  assert.equal(calls.some(x=>x.url.includes('script.google.com')||x.url.includes('/rpc/')||x.url.endsWith('/push')),false);
});

test('REPLY_ONLY mode never falsely acknowledges a bookable request with blank nickname',async()=>{
  const e=identityEvent();
  e.message.text=e.message.text.replace('👤 ชื่อเล่น: Synthetic Customer','👤 ชื่อเล่น: ');
  const calls=[];
  const response=await mod._test.processEvent(e,{
    LINE_CHANNEL_ACCESS_TOKEN:'synthetic-messaging-only-token'
    // Owner automation intentionally OFF; an inbound LINE request is not a Booking.
  },async (url,options={})=>{
    const u=String(url);
    calls.push({url:u,body:options.body?JSON.parse(options.body):null});
    if(u.includes('08_Web_Ready'))return {ok:true,text:async()=>syntheticVisibleRow()};
    if(u.includes('09_Web_Packages'))return {ok:true,text:async()=>PACKAGES};
    if(u.endsWith('/reply'))return {ok:true,status:200};
    throw Error('no private DB, Apps Script, owner LINE or customer push allowed');
  });
  assert.equal(response.handled,true);
  assert.equal(response.automation_status,'CUSTOMER_DETAILS_REQUIRED');
  assert.equal(response.booking_id,'');
  const replies=calls.filter(x=>x.url.endsWith('/reply'));
  assert.equal(replies.length,1,'exactly one customer correction reply');
  assert.equal(replies[0].body.messages[0].type,'text');
  assert.match(replies[0].body.messages[0].text,/กรุณาระบุชื่อเล่น/);
  assert.doesNotMatch(JSON.stringify(replies[0].body),/ร้านได้รับคำขอเช่าแล้ว|KK-TERMS-2026-11-06|รับทราบนโยบายความเป็นส่วนตัว/);
  assert.equal(calls.some(x=>x.url.includes('script.google.com')||x.url.includes('/rpc/')||x.url.endsWith('/push')),false);
});

test('canonical bookable event without customer LINE identity gets a safe reply only',async()=>{
  const e=identityEvent();
  delete e.source.userId;
  const calls=[];
  const out=await mod._test.processEvent(e,identityEnv(),async (url,options={})=>{
    const u=String(url);
    calls.push(u);
    if(u.includes('08_Web_Ready'))return {ok:true,text:async()=>syntheticVisibleRow()};
    if(u.includes('09_Web_Packages'))return {ok:true,text:async()=>PACKAGES};
    if(u.endsWith('/reply')){
      assert.match(JSON.parse(options.body).messages[0].text,/แชทส่วนตัวกับ LINE OA/);
      return {ok:true};
    }
    throw Error('no private database, Apps Script or owner send allowed');
  },{signatureVerified:true});
  assert.equal(out.automation_status,'CUSTOMER_DETAILS_REQUIRED');
  assert.equal(out.booking_id,'');
  assert.equal(calls.filter(x=>x.endsWith('/reply')).length,1);
  assert.equal(calls.some(x=>x.includes('script.google.com')||x.includes('/rpc/')||x.endsWith('/push')),false);
});


// Shared with diagnostics-only PR #862; this integrated release supersedes that scope.
test('sanitized LINE reply diagnostics distinguish provider status without provider PII',()=>{
  const cases=[
    [400,'INVALID_REQUEST_OR_REPLY_TOKEN'],
    [401,'PROVIDER_AUTH_OR_PERMISSION'],
    [403,'PROVIDER_AUTH_OR_PERMISSION'],
    [404,'PROVIDER_CLIENT_FAILURE'],
    [429,'PROVIDER_RATE_LIMIT'],
    [500,'PROVIDER_SERVER_FAILURE'],
    [503,'PROVIDER_SERVER_FAILURE']
  ];
  for(const [status,category] of cases){
    const err=Object.assign(new Error('SYNTHETIC_PHONE_0999999999 TOKEN_SUPER_SECRET'),{
      code:'LINE_BOOKING_REPLY_FAILED',status,
      providerBody:'SYNTHETIC_CUSTOMER_PRIVATE',
      replyToken:'SYNTHETIC_TOKEN'
    });
    const out=mod._test.safeLineReplyDiagnostic(err);
    assert.deepEqual(out,{code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:status,provider_category:category});
    assert.doesNotMatch(JSON.stringify(out),/0999999999|SUPER_SECRET|SYNTHETIC_CUSTOMER_PRIVATE|SYNTHETIC_TOKEN/);
  }
});

test('transport and malformed status fail closed without arbitrary error details',()=>{
  const original='CUSTOMER_PRIVATE_DETAILS_AND_ACCESS_TOKEN';
  assert.deepEqual(
    mod._test.safeLineReplyDiagnostic({code:'LINE_BOOKING_REPLY_TRANSPORT_FAILED',message:original,status:503}),
    {code:'LINE_BOOKING_REPLY_TRANSPORT_FAILED',provider_http_status:null,provider_category:'TRANSPORT_ERROR'}
  );
  for(const status of [null,undefined,0,600,'401',NaN,Infinity,-1]){
    const output=mod._test.safeLineReplyDiagnostic({code:'LINE_BOOKING_REPLY_FAILED',status,message:original});
    assert.deepEqual(output,{code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:null,provider_category:'UNKNOWN_REPLY_FAILURE'});
  }
  for(const malicious of [null,undefined,{},new Error(original),{code:'ATTACK_'+original,status:429,message:original}]){
    const output=mod._test.safeLineReplyDiagnostic(malicious);
    assert.deepEqual(output,{code:'WEBHOOK_PROCESSING_FAILED',provider_http_status:null,provider_category:'OTHER'});
    assert.doesNotMatch(JSON.stringify(output),/CUSTOMER_PRIVATE|ACCESS_TOKEN/);
  }
});

test('known owner/booking failures remain identifiable but private data is never logged',()=>{
  const cases=[
    ['LINE_BOOKING_AUTOMATION_NOT_READY','BOOKING_CONFIGURATION'],
    ['LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED','BOOKING_UPSTREAM'],
    ['LINE_BOOKING_UPSTREAM_NON_JSON','BOOKING_UPSTREAM'],
    ['LINE_BOOKING_UPSTREAM_FAILED','BOOKING_UPSTREAM'],
    ['LINE_CUSTOMER_USER_ID_REQUIRED','BOOKING_VALIDATION'],
    ['LINE_APPROVAL_DATA_INCOMPLETE','OWNER_APPROVAL'],
    ['LINE_OWNER_DECISION_BOOKING_ID_MISMATCH','OWNER_APPROVAL'],
    ['LINE_OWNER_DECISION_READBACK_MISMATCH','OWNER_APPROVAL'],
    ['LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED','OWNER_APPROVAL'],
    ['LINE_CUSTOMER_CONTACT_READBACK_REQUIRED','OWNER_APPROVAL'],
    ['LINE_SEND_FAILED','LINE_PUSH_OR_REPLY'],
    ['LINE_SEND_TRANSPORT_FAILED','LINE_PUSH_OR_REPLY']
  ];
  for(const [code,provider_category] of cases){
    const error=Object.assign(new Error('PRIVATE_NAME PHONE_0999999999 SECRET_TOKEN'),{
      code,status:429,replyToken:'PRIVATE_REPLY_TOKEN',customer:'PRIVATE_CUSTOMER_ID'
    });
    const out=mod._test.safeLineReplyDiagnostic(error);
    assert.deepEqual(out,{code,provider_http_status:null,provider_category});
    assert.doesNotMatch(JSON.stringify(out),/PRIVATE|0999999999|SECRET|CUSTOMER_ID/);
  }
  const injected=mod._test.safeLineReplyDiagnostic({code:'LINE_SEND_FAILED_PRIVATE_TOKEN',status:429});
  assert.deepEqual(injected,{code:'WEBHOOK_PROCESSING_FAILED',provider_http_status:null,provider_category:'OTHER'});
});

test('LINE Reply API response status is preserved for redacted logging without reading response body',async()=>{
  let bodyReads=0;
  await assert.rejects(
    ()=>mod._test.replyFlex('SYNTHETIC_REPLY',{type:'text',text:'demo'},'SYNTHETIC_ACCESS_TOKEN',async()=>({
      ok:false,status:429,text:async()=>{bodyReads++;return 'PRIVATE_RESPONSE_TOKEN';}
    })),
    err=>{
      assert.deepEqual(mod._test.safeLineReplyDiagnostic(err),{
        code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:429,provider_category:'PROVIDER_RATE_LIMIT'
      });
      assert.doesNotMatch(JSON.stringify(mod._test.safeLineReplyDiagnostic(err)),/PRIVATE_RESPONSE_TOKEN|SYNTHETIC_REPLY/);
      return true;
    }
  );
  assert.equal(bodyReads,0,'never consume untrusted LINE response bodies');
});
