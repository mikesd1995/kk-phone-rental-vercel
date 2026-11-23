'use strict';
// Literal dummy data and injected transport only. Never establishes native acceptance.
const test=require('node:test'),assert=require('node:assert/strict');
const Webhook=require('../server/line-booking-webhook')._test;
const Owner=require('../server/line-booking-owner-approval');
const Poster=require('../server/line-poster');
const Initial=require('../server/line-initial-durable-outbox');
const Target=require('../server/kk-line-booking-test-target');
const Intake=require('../server/line-booking-intake');
const {harness,OWNER,CUSTOMER,SECRET,BID}=require('./fixtures/line-initial-outbox-harness');
function env(){const now=Date.now();return {KK_LINE_BOOKING_TEST_MODE:'true',KK_LINE_BOOKING_TEST_USER_IDS:OWNER+','+CUSTOMER,
 KK_LINE_BOOKING_TEST_ORIGIN:'https://s2-booking.invalid',KK_LINE_BOOKING_TEST_SCOPE:'s2_dummy_run_0001',
 KK_LINE_BOOKING_TEST_WINDOW_START:new Date(now-60000).toISOString(),KK_LINE_BOOKING_TEST_WINDOW_END:new Date(now+60000).toISOString(),
 KK_LINE_BOOKING_TEST_EVENT_IDS:'EVT-SYNTHETIC',KK_LINE_APPROVAL_SECRET:'synthetic_s2_approval_key_0123456789',
 KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
 KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:SECRET,KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'distinct_owner_dispatch_secret_20261114',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',KK_ADMIN_API_KEY:'distinct-admin-key',
 KK_OWNER_LINE_USER_ID:OWNER,LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',LINE_CHANNEL_SECRET:'synthetic-secret'};}
const event=()=>({type:'message',replyToken:'SYNTHETIC_REPLY',timestamp:Date.now(),webhookEventId:'SYNTHETIC_S2_EVENT',
 source:{type:'user',userId:CUSTOMER},message:{type:'text',text:'สนใจเช่า Phone\nงาน: Synthetic Event\nวันที่: 18/11/2026\nสถานที่: Synthetic Hall\nชื่อเล่น: Synthetic Customer\nเวลารับอุปกรณ์: 16:00'}});
const booking={event_name:'Synthetic Event',event_date:'18/11/2026',venue:'Synthetic Hall',package_name:'Phone',nickname:'Synthetic Customer'};
function csv(url,poster='/assets/event-posters/dummy.png'){
 return String(url).includes('08_Web_Ready')?'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-SYNTHETIC,Synthetic Event,18/11/2026,Synthetic Hall,'+poster+',show,เปิดจอง,1':
 'package_id,event_id,package_type,model_display,price,available_count,package_status\nTPL-PHONE,EVT-SYNTHETIC,phone_only,Phone,790,1,available';
}
const json=value=>({ok:true,status:200,headers:{get:()=> 'synthetic-request-id'},text:async()=>JSON.stringify(value)});
test('test feed and poster helper use only approved origin with redirect errors; production helper remains unchanged',async()=>{
 const e=env(),calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>csv(url)};};
 const canonical=await Webhook.resolveCanonicalPackage(booking,fetchImpl,e);
 assert.equal(canonical.event_id,'EVT-SYNTHETIC');
 assert.equal(await Webhook.resolvePoster(booking,fetchImpl,e),'https://s2-booking.invalid/api/line-poster?event_id=EVT-SYNTHETIC');
 assert.ok(calls.every(c=>c.url.startsWith(e.KK_LINE_BOOKING_TEST_ORIGIN+'/api/kk-data?')&&c.options.redirect==='error'));
 calls.length=0;await Webhook.resolveCanonicalPackage(booking,fetchImpl,{});
 assert.ok(calls.every(c=>c.url.startsWith(Target.PRODUCTION_ORIGIN+'/api/kk-data?')));
});
test('poster resolver never follows Production image URLs or redirects in test mode',async()=>{
 const e=env(),calls=[];const f=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>csv(url,'https://kk-phone-rental.vercel.app/assets/event-posters/real.png')};};
 assert.equal(await Poster.resolveSource('EVT-SYNTHETIC',f,e),'');assert.equal(calls.length,1);
 assert.ok(calls[0].url.startsWith(e.KK_LINE_BOOKING_TEST_ORIGIN));assert.equal(calls[0].options.redirect,'error');
 calls.length=0;assert.equal((await Poster.fetchPoster('EVT-OTHER',f,e)).status,404);assert.equal(calls.length,0);
 assert.equal(await Poster.resolveSource('EVT-SYNTHETIC',async()=>({ok:true,redirected:true,text:async()=>csv('08_Web_Ready')}),e),'');
});
test('old event, missing original ID, forbidden canonical event and disabled durability never write/send',async()=>{
 const e=env();let calls=0;const f=async()=>{calls++;throw Error('UNEXPECTED_IO');};
 assert.equal((await Webhook.processEvent({...event(),timestamp:0},e,f,{signatureVerified:true})).handled,false);
 await assert.rejects(()=>Owner.createPendingBooking({...event(),webhookEventId:''},booking,{event_id:'EVT-SYNTHETIC',template_id:'TPL-PHONE'},e,f),{code:'LINE_EVENT_ID_REQUIRED'});
 await assert.rejects(()=>Owner.createPendingBooking(event(),booking,{event_id:'EVT-OLD',template_id:'TPL-PHONE'},e,f),{code:'LINE_BOOKING_TEST_EVENT_DENIED'});
 await assert.rejects(()=>Webhook.processEvent(event(),{...e,KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'false'},f),{code:'LINE_BOOKING_TEST_DURABLE_REQUIRED'});
 await assert.rejects(()=>Owner.notifyOwner({booking_id:BID},e,f),{code:'LINE_BOOKING_TEST_DURABLE_REQUIRED'});
 await assert.rejects(()=>Owner.createPendingBooking(event(),booking,{event_id:'EVT-SYNTHETIC',template_id:'TPL-PHONE'},
  {...e,KK_OWNER_LINE_TARGET_ID:'C'+'a'.repeat(32)},f,{initialContext:Initial.contextJson(booking,
   {package_name:'Phone',price_display:'790 บาท'},'NOT_CONFIRMED')}),{code:'LINE_BOOKING_TEST_CONFIG_INVALID'});
 assert.equal(calls,0);
});
test('test cards reject production/foreign scope/origin/window and altered IDs before GAS; production kkb1 stays compatible',async()=>{
 const e=env(),rid='line:'+'a'.repeat(48);let calls=0;const f=async()=>{calls++;throw Error('UNEXPECTED_IO');};
 const data=Owner.decisionData('approve',BID,e,rid);assert.match(data,/^kkt1\|approve\|/);
 assert.deepEqual(Owner.parseDecisionData(data,e),{decision:'approve',booking_id:BID,request_id:rid});
 const legacy=Owner.decisionData('approve',BID,{KK_LINE_APPROVAL_SECRET:e.KK_LINE_APPROVAL_SECRET});assert.match(legacy,/^kkb1\|/);
 for(const value of [legacy,data.replace(BID,BID+'X'),data.replace(rid,'line:'+'b'.repeat(48))]){
  const out=await Owner.processOwnerPostback({...event(),type:'postback',source:{type:'user',userId:OWNER},postback:{data:value}},e,f);
  assert.equal(out.status,'TEST_POSTBACK_DENIED');
 }
 for(const changed of [{KK_LINE_BOOKING_TEST_SCOPE:'s2_dummy_run_0002'},{KK_LINE_BOOKING_TEST_ORIGIN:'https://other-s2.invalid'},
  {KK_LINE_BOOKING_TEST_WINDOW_START:new Date(Date.parse(e.KK_LINE_BOOKING_TEST_WINDOW_START)-1000).toISOString()}])
  assert.equal(Owner.parseDecisionData(data,{...e,...changed}),null);
 const out=await Owner.processOwnerPostback({...event(),type:'postback',timestamp:0,source:{type:'user',userId:OWNER},postback:{data}},e,f);
 assert.equal(out.handled,false);assert.equal(calls,0);
});
test('actual canonical mock issues scoped request/card once; same event redelivery preserves exact durable message hashes',async()=>{
 const e=env(),ev=event(),h=harness(),provider=[],actions=[];
 const fetchImpl=async(url,request)=>{
  if(String(url).startsWith(e.KK_LINE_BOOKING_TEST_ORIGIN+'/api/kk-data?'))return {ok:true,text:async()=>csv(url,'')};
  if(String(url).includes('script.google.com')){const p=JSON.parse(request.body);actions.push(p);
   const fn={lineInitialOutboxReadiness:h.ready,createLineBookingPending:h.create,claimLineBookingInitialDelivery:h.claim,settleLineBookingInitialDelivery:h.settle}[p.action];
   assert.ok(fn,'known mock action');return json({ok:true,...fn(p)});}
  assert.match(String(url),/^https:\/\/api\.line\.me\/v2\/bot\/message\/(push|reply)$/);
  provider.push(JSON.parse(request.body));return json({sentMessages:[{id:'synthetic-provider-'+provider.length}]});
 };
 const result=await Webhook.processEvent(ev,e,fetchImpl,{signatureVerified:true});assert.equal(result.initial_delivery_status,'SENT');
 const created=actions.find(p=>p.action==='createLineBookingPending');
 assert.notEqual(created.request_id,Intake.requestIdFromLineEvent(ev));
 const card=provider[0].messages[0];const data=card.contents.footer.contents[0].action.data;
 assert.equal(Owner.parseDecisionData(data,e).request_id,created.request_id);
 assert.equal(Object.keys(JSON.parse(h.ledger.rows[1][9])).length,12);
 await Webhook.processEvent({...ev,replyToken:'OTHER_REPLY'},e,fetchImpl,{signatureVerified:true});
 assert.equal(provider.length,2);assert.equal(h.stats().allocations,1);
 assert.ok(h.ledger.rows.slice(1).every(r=>r[3]==='SENT'));
 assert.equal(Initial.parseContext(h.ledger.rows[1][9],h.ledger.rows[1][10]).nickname,'Synthetic Customer');
});
