'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Handler=require('../server/line-booking-webhook');
const Line=require('../server/kk-line-webhook');

const ENV={LINE_CHANNEL_SECRET:'synthetic-signing-key',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-line-token',
 KK_INBOX_SUPABASE_URL:'https://example.supabase.co',KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-key',
 KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
 KK_ADMIN_API_KEY:'synthetic-admin-key',KK_OWNER_LINE_USER_ID:'UOWNER',KK_OWNER_LINE_TARGET_ID:'UOWNER'};
const image={type:'message',webhookEventId:'synthetic-image-event',source:{type:'user',userId:'USYNTHETIC'},
 message:{type:'image',id:'123456789012345'}};
const booking={type:'message',webhookEventId:'synthetic-booking-event',replyToken:'synthetic-reply',
 source:{type:'user',userId:'USYNTHETIC'},message:{type:'text',
 text:'งาน: Hidden event\nวันที่: 18/10/2026\nสถานที่: TEST VENUE\nรุ่น/แพ็กเกจ: vivo X300 Pro\nชื่อเล่น: Demo\nเบอร์โทร:'}};
const WEB='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\n'+
 'EVT-HIDDEN,Hidden event,18/10/2026,TEST VENUE,https://drive.google.com/thumbnail?id=synthetic,hide,เปิดจอง,1';
const PACKAGE='package_id,event_id,package_type,model_display,price,available_count,package_status\n'+
 'EVT-HIDDEN-TPL-PHONE,EVT-HIDDEN,phone_only,vivo X300 Pro,790,1,available';
const PNG=Buffer.from([137,80,78,71,13,10,26,10,0]);

function setup(t,fetchImpl){
 const originalFetch=global.fetch,originalWarn=console.warn,originalError=console.error;
 const prior=Object.fromEntries(Object.keys(ENV).map(key=>[key,process.env[key]]));
 const warnings=[],errors=[];
 Object.assign(process.env,ENV);global.fetch=fetchImpl;
 console.warn=(...args)=>warnings.push(args.map(String).join(' '));
 console.error=(...args)=>errors.push(args.map(String).join(' '));
 t.after(()=>{global.fetch=originalFetch;console.warn=originalWarn;console.error=originalError;
  for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 return {warnings,errors};
}
async function deliver(events,valid=true){
 const raw=JSON.stringify({events});
 const signature=crypto.createHmac('sha256',ENV.LINE_CHANNEL_SECRET).update(raw).digest('base64');
 const response={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
 await Handler({method:'POST',body:raw,headers:{'x-line-signature':valid?signature:'invalid'}},response);
 return response;
}

test('signed mixed webhook archives private image while hidden event cannot write booking or push owner',async t=>{
 const calls=[];
 const logs=setup(t,async(url,init={})=>{
  calls.push({url:String(url),init});
  if(url.includes('/profile/'))return new Response(JSON.stringify({displayName:'Synthetic customer'}));
  if(url.includes('/rpc/kk_inbox_persist_inbound'))return new Response(JSON.stringify({writes:1,duplicate:false}));
  if(url.startsWith('https://api-data.line.me/'))return new Response(PNG);
  if(url.includes('/storage/v1/object/kk-inbox-media/'))return new Response('{}');
  if(url.includes('08_Web_Ready'))return new Response(WEB);
  if(url.includes('09_Web_Packages'))return new Response(PACKAGE);
  if(url.endsWith('/reply'))return new Response('{}');
  if(url.startsWith('https://script.google.com/'))return new Response(JSON.stringify({ok:true,booking_id:'BK-SYNTHETIC',booking_status:'pending'}));
  if(url.endsWith('/push'))return new Response('{}');
  throw Error('Unexpected synthetic endpoint');
 });
 const response=await deliver([image,booking]);
 assert.equal(response.statusCode,200);assert.equal(response.body,'OK');assert.deepEqual(logs.errors,[]);
 assert.equal(calls.filter(c=>c.url.includes('/rpc/kk_inbox_persist_inbound')).length,2);
 const normalized=Line.normalizeEvent(image);
 const persisted=calls.findIndex(c=>c.url.includes('/rpc/')&&JSON.stringify(c.init.body).includes(normalized.message_id));
 const downloaded=calls.findIndex(c=>c.url.startsWith('https://api-data.line.me/'));
 const archived=calls.find(c=>c.url.includes('/storage/v1/object/kk-inbox-media/'));
 assert.ok(persisted>=0&&downloaded>persisted,'persist identity before downloading image');
 assert.ok(archived.url.endsWith('/line/'+normalized.message_id));
 assert.equal(archived.init.headers.Authorization,'Bearer '+ENV.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY);
 assert.equal(calls.filter(c=>c.url.endsWith('/reply')).length,1);
 assert.equal(calls.filter(c=>c.url.includes('09_Web_Packages')||c.url.includes('script.google.com')||c.url.endsWith('/push')).length,0);
 assert.doesNotMatch(logs.warnings.join('\n'),/synthetic-booking-event|Hidden event|USYNTHETIC/);
});

test('invalid signature cannot persist, download an image, resolve booking or send LINE',async t=>{
 let calls=0;setup(t,async()=>{calls++;throw Error('No I/O permitted');});
 const response=await deliver([image,booking],false);
 assert.equal(response.statusCode,401);assert.equal(calls,0);
});

test('signed visible event retains international LINE contact, canonical price and pending owner approval',async t=>{
 const writes=[],pushes=[],replies=[];
 const logs=setup(t,async(url,init={})=>{
  if(url.includes('/profile/'))return new Response('{}');
  if(url.includes('/rpc/kk_inbox_persist_inbound'))return new Response(JSON.stringify({writes:1,duplicate:false}));
  if(url.includes('08_Web_Ready'))return new Response(WEB.replace(',hide,',',show,'));
  if(url.includes('09_Web_Packages'))return new Response(PACKAGE);
  if(url.startsWith('https://script.google.com/')){
   writes.push(JSON.parse(init.body));
   return new Response(JSON.stringify({ok:true,booking_id:'BK-SYNTHETIC',booking_status:'pending'}));
  }
  if(url.endsWith('/push')){pushes.push(JSON.parse(init.body));return new Response('{}');}
  if(url.endsWith('/reply')){replies.push(JSON.parse(init.body));return new Response('{}');}
  throw Error('Unexpected synthetic endpoint');
 });
 const response=await deliver([booking]);
 assert.equal(response.statusCode,200);assert.deepEqual(logs.errors,[]);assert.deepEqual(logs.warnings,[]);
 assert.equal(writes.length,1);assert.equal(writes[0].action,'createLineBookingPending');
 assert.equal(writes[0].customer_contact,'USYNTHETIC');assert.equal(writes[0].customer_phone,'');
 assert.equal(writes[0].template_id,'TPL-PHONE');assert.equal(writes[0].booking_status,'pending');
 assert.equal(pushes.length,1);assert.equal(pushes[0].to,'UOWNER');
 assert.match(JSON.stringify(pushes[0]),/ติดต่อทาง LINE · ไม่ระบุเบอร์โทรศัพท์/);
 assert.match(JSON.stringify(pushes[0]),/790 บาท/);assert.equal(replies.length,1);
});

test('untrusted image transport error code cannot leak private content into webhook diagnostics',async t=>{
 const marker='SYNTHETIC_PRIVATE_MEDIA_CONTACT_0001234567';
 const logs=setup(t,async url=>{
  if(url.includes('/profile/'))return new Response('{}');
  if(url.includes('/rpc/kk_inbox_persist_inbound'))return new Response(JSON.stringify({writes:1,duplicate:false}));
  throw Object.assign(Error(marker),{code:marker});
 });
 const response=await deliver([image]);
 assert.equal(response.statusCode,200);assert.deepEqual(logs.errors,[]);
 assert.equal(logs.warnings.length,1);
 assert.match(logs.warnings[0],/INBOX_MEDIA_CAPTURE_FAILED/);
 assert.doesNotMatch(logs.warnings[0],new RegExp(marker));
});
