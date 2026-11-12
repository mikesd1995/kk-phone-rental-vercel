'use strict';

const crypto = require('node:crypto');
const {buildBookingFlex} = require('../server/line-booking-flex');
const {safePosterSource} = require('../server/line-poster');
const InboxTee = require('./kk-line-inbox-tee');
const InboxMedia = require('./kk-inbox-media');
const {createPostgrestStore} = require('./kk-inbox-postgrest-store');
const LineMessaging = require('./kk-line-messaging-api');
const OwnerApproval = require('./line-booking-owner-approval');
const LineIdentity = require('./kk-line-identity');
const TermsEvidence = require('./kk-booking-terms-evidence');
const IdentityReceipt = require('./kk-line-booking-terms-receipt');

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const PUBLIC_DATA_BASE = 'https://kk-phone-rental.vercel.app/api/kk-data';
const WEB_READY_QUERY = '?sheet=08_Web_Ready&range=A4%3AK&showPast=1';
const WEB_PACKAGES_QUERY = '?sheet=09_Web_Packages&range=A4%3AN';

function inboxPersistFn(env=process.env, fetchImpl=fetch){
  const url=String(env.KK_INBOX_SUPABASE_URL||'').trim();
  const key=String(env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY||'').trim();
  if(!url||!key) return null;
  return createPostgrestStore({url,serviceKey:key,fetchImpl}).persistInbound;
}

function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.rawBody) return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody);
  return req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
}
function validSignature(body, signature, secret) {
  if (!body || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  const a=Buffer.from(expected), b=Buffer.from(String(signature));
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function parseBookingText(text) {
  const s=String(text||'');
  const line=(label)=>{const m=s.match(new RegExp('(?:^|\\n)[^\\p{L}\\p{N}\\n]*?(?:'+label+')[ \\t]*:[ \\t]*([^\\r\\n]*)','iu')); return m&&m[1]?m[1].trim():'';};
  const interest=s.match(/(?:สนใจเช่า|Interested in renting)\s+([^\n]+)/i);
  const event=line('งาน|Event'), date=line('วันที่|Date'), venue=line('สถานที่|Venue'), price=line('ราคา|Price');
  const nickname=line('ชื่อเล่น|Nickname'), phone=line('เบอร์โทร|Phone'), pickup=line('เวลาที่สะดวกรับอุปกรณ์|เวลารับอุปกรณ์|Pickup');
  const model=line('รุ่น/แพ็กเกจ|Package[ \\t]*/[ \\t]*model|รุ่น|Model');
  const packageName=model || (interest && interest[1] ? interest[1].trim() : '');
  if(!event || !date || !venue || !packageName) return null;
  const terms=TermsEvidence.extractFromCustomerText(s);
  return {event_name:event,event_date:date,venue,package_name:packageName,price_display:price,nickname,phone,pickup_time:pickup,
    terms_acknowledged:terms.matched,terms_version:terms.version};
}
function parseCsv(text){
  const rows=[]; let row=[],cell='',q=false; const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const c=s[i]; if(q){if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);} if(!rows.length)return[];
  const h=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||''])));
}
function isBookableWebReadyEvent(row){
  // Match the canonical public admission contract; package stock alone cannot
  // re-open owner-hidden/full event dates.
  if(!row||norm(row.action_for_web)!=='show'||norm(row.booking_status_for_web)!=='เปิดจอง')return false;
  const n=Number(String(row.available_phone_count===undefined?'':row.available_phone_count).replace(/,/g,'').trim());
  return Number.isInteger(n)&&n>0;
}
async function resolvePoster(booking, fetchImpl=fetch){
  const u=PUBLIC_DATA_BASE+WEB_READY_QUERY;
  const r=await fetchImpl(u,{headers:{'User-Agent':'KK-Line-Webhook/1.0'}});
  if(!r.ok) return '';
  const rows=parseCsv(await r.text());
  const exact=resolveEventRow(rows,booking);
  if(!isBookableWebReadyEvent(exact) || !safePosterSource(exact.poster_image_url)) return '';
  const eventId=String(exact.event_id||'').trim();
  return eventId ? 'https://kk-phone-rental.vercel.app/api/line-poster?event_id='+encodeURIComponent(eventId) : '';
}

function norm(value){ return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase(); }
function canonicalDate(value){
  const s=String(value||'').normalize('NFKC').trim();
  if(!s) return '';
  let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m){
    let y=Number(m[3]); if(y>2500)y-=543;
    return String(y).padStart(4,'0')+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0');
  }
  m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if(m){
    let y=Number(m[1]); if(y>2500)y-=543;
    return String(y).padStart(4,'0')+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');
  }
  const en={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/i);
  if(m){
    const mo=en[m[2].toLowerCase().slice(0,3)];
    if(mo){ let y=Number(m[3]); if(y>2500)y-=543; return String(y).padStart(4,'0')+'-'+String(mo).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0'); }
  }
  const th={'ม.ค.':1,'มกราคม':1,'ก.พ.':2,'กุมภาพันธ์':2,'มี.ค.':3,'มีนาคม':3,'เม.ย.':4,'เมษายน':4,'พ.ค.':5,'พฤษภาคม':5,'มิ.ย.':6,'มิถุนายน':6,'ก.ค.':7,'กรกฎาคม':7,'ส.ค.':8,'สิงหาคม':8,'ก.ย.':9,'กันยายน':9,'ต.ค.':10,'ตุลาคม':10,'พ.ย.':11,'พฤศจิกายน':11,'ธ.ค.':12,'ธันวาคม':12};
  for(const key of Object.keys(th).sort((a,b)=>b.length-a.length)){
    if(!s.includes(key)) continue;
    const parts=s.split(key);
    const day=Number(String(parts[0]||'').replace(/\D/g,''));
    const ym=String(parts[1]||'').match(/\d{4}/);
    if(!day||!ym) return '';
    let y=Number(ym[0]); if(y>2500)y-=543;
    return String(y).padStart(4,'0')+'-'+String(th[key]).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  }
  return '';
}
function resolveEventRow(rows,booking){
  const candidates=(rows||[]).filter(x=>
    norm(x.event_name)===norm(booking&&booking.event_name) &&
    norm(x.venue)===norm(booking&&booking.venue)
  );
  const wantedDate=canonicalDate(booking&&booking.event_date);
  if(wantedDate){
    const dated=candidates.filter(x=>canonicalDate(x.event_date_text||x.event_date)===wantedDate);
    return dated.length===1?dated[0]:null;
  }
  // Legacy/direct helper calls may not carry a date. Preserve them only when
  // name+venue is already unique; multi-day events must fail closed.
  return candidates.length===1?candidates[0]:null;
}
function templateIdFromWebPackageId(packageId,eventId){
  const pkg=String(packageId||'').trim();
  const eid=String(eventId||'').trim();
  if(!pkg) return '';
  const tplPos=pkg.indexOf('TPL-');
  if(tplPos>=0) return pkg.slice(tplPos);
  if(eid && pkg.startsWith(eid+'-')) return pkg.slice(eid.length+1);
  return pkg;
}
function packageLabel(row){
  const type=norm(row.package_type);
  const model=String(row.model_display||'').trim();
  const lens=String(row.lens_display||'').trim();
  if(type==='phone_lens_bundle') return (model||'มือถือ')+' + Lens';
  if(type==='lens_only') return lens||'Lens';
  return model||'มือถือ';
}
function formatCanonicalPrice(value){
  const raw=String(value||'').replace(/,/g,'').trim();
  const n=Number(raw);
  return Number.isFinite(n)&&n>0 ? n.toLocaleString('en-US')+' บาท' : '';
}
async function resolveCanonicalPackage(booking, fetchImpl=fetch){
  const headers={'User-Agent':'KK-Line-Webhook/1.0'};
  const eventRes=await fetchImpl(PUBLIC_DATA_BASE+WEB_READY_QUERY,{headers});
  if(!eventRes.ok) return null;
  const events=parseCsv(await eventRes.text());
  const event=resolveEventRow(events,booking);
  if(!isBookableWebReadyEvent(event))return null;
  const eventId=String(event.event_id||'').trim();
  if(!eventId) return null;

  const pkgRes=await fetchImpl(PUBLIC_DATA_BASE+WEB_PACKAGES_QUERY,{headers});
  if(!pkgRes.ok) return null;
  const rows=parseCsv(await pkgRes.text()).filter(x=>String(x.event_id||'').trim()===eventId);
  const wanted=norm(booking.package_name);
  const matches=rows.filter(x=>{
    const status=norm(x.package_status);
    const available=Number(String(x.available_count||'').replace(/,/g,''));
    return norm(packageLabel(x))===wanted &&
      (status==='available'||status==='open') &&
      Number.isFinite(available) && available>0;
  });
  if(matches.length!==1) return null;
  const row=matches[0];
  const price=formatCanonicalPrice(row.price);
  if(!price) return null;
  const packageId=String(row.package_id||'').trim();
  const templateId=templateIdFromWebPackageId(packageId,eventId);
  if(!templateId) return null;
  return {event_id:eventId,package_id:packageId,template_id:templateId,package_name:packageLabel(row),price_display:price};
}
function safeLineReplyDiagnostic(err){
  if(err && err.code==='LINE_BOOKING_REPLY_TRANSPORT_FAILED'){
    return {code:'LINE_BOOKING_REPLY_TRANSPORT_FAILED',provider_http_status:null,provider_category:'TRANSPORT_ERROR'};
  }
  if(err && err.code==='LINE_BOOKING_REPLY_FAILED'){
    const status=Number.isInteger(err.status) && err.status>=100 && err.status<=599 ? err.status : null;
    let category='UNKNOWN_REPLY_FAILURE';
    if(status===400) category='INVALID_REQUEST_OR_REPLY_TOKEN';
    else if(status===401 || status===403) category='PROVIDER_AUTH_OR_PERMISSION';
    else if(status===429) category='PROVIDER_RATE_LIMIT';
    else if(status!==null && status>=500) category='PROVIDER_SERVER_FAILURE';
    else if(status!==null && status>=400) category='PROVIDER_CLIENT_FAILURE';
    return {code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:status,provider_category:category};
  }
  // Preserve only explicitly recognized internal failure codes. Never log
  // arbitrary err.message, err.code, URLs, recipient IDs or provider bodies.
  const SAFE_INTERNAL_FAILURES={
    LINE_BOOKING_AUTOMATION_NOT_READY:'BOOKING_CONFIGURATION',
    LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED:'BOOKING_UPSTREAM',
    LINE_BOOKING_UPSTREAM_NON_JSON:'BOOKING_UPSTREAM',
    LINE_BOOKING_UPSTREAM_FAILED:'BOOKING_UPSTREAM',
    LINE_CUSTOMER_USER_ID_REQUIRED:'BOOKING_VALIDATION',
    LINE_CUSTOMER_USER_ID_INVALID:'BOOKING_VALIDATION',
    LINE_APPROVAL_DATA_INCOMPLETE:'OWNER_APPROVAL',
    LINE_OWNER_DECISION_BOOKING_ID_MISMATCH:'OWNER_APPROVAL',
    LINE_OWNER_DECISION_READBACK_MISMATCH:'OWNER_APPROVAL',
    LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED:'OWNER_APPROVAL',
    LINE_CUSTOMER_CONTACT_READBACK_REQUIRED:'OWNER_APPROVAL',
    LINE_SEND_FAILED:'LINE_PUSH_OR_REPLY',
    LINE_SEND_TRANSPORT_FAILED:'LINE_PUSH_OR_REPLY'
  };
  const code=err&&typeof err.code==='string'?err.code:'';
  if(Object.prototype.hasOwnProperty.call(SAFE_INTERNAL_FAILURES,code)){
    // This is not necessarily a Reply API status; do not misattribute it.
    return {code,provider_http_status:null,provider_category:SAFE_INTERNAL_FAILURES[code]};
  }
  return {code:'WEBHOOK_PROCESSING_FAILED',provider_http_status:null,provider_category:'OTHER'};
}

async function replyFlex(replyToken, message, token, fetchImpl=fetch){
  let r;
  try{
    r=await fetchImpl(LINE_REPLY_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({replyToken,messages:[message]})});
  }catch(_){
    const err=new Error('LINE booking reply transport failed');
    err.code='LINE_BOOKING_REPLY_TRANSPORT_FAILED';
    throw err;
  }
  if(!r||r.ok!==true){
    // Never reflect untrusted provider response bytes into webhook error logs.
    const err=new Error('LINE booking reply failed');
    err.code='LINE_BOOKING_REPLY_FAILED';
    if(Number.isInteger(r&&r.status))err.status=r.status;
    throw err;
  }
}
async function processEvent(event, env=process.env, fetchImpl=fetch, options={}){
  if(!event || event.type!=='message' || !event.replyToken || !event.message || event.message.type!=='text') return {handled:false};
  const booking=parseBookingText(event.message.text);
  if(!booking) return {handled:false};
  // One event-local WebReady fetch. Do not cache across customer requests.
  // Preserve exact snapshot while poster and canonical price resolve in parallel.
  let webReadySnapshot;
  const sharedFetch=async (url, options)=>{
    if(url!==PUBLIC_DATA_BASE+WEB_READY_QUERY) return fetchImpl(url,options);
    if(!webReadySnapshot) webReadySnapshot=Promise.resolve().then(()=>
      fetchImpl(url,options)).then(async response=>({
        ok:response.ok,
        text:response.ok ? await response.text() : ''
      }));
    const snapshot=await webReadySnapshot;
    return {ok:snapshot.ok,text:async()=>snapshot.text};
  };
  const [poster,canonical]=await Promise.all([
    resolvePoster(booking,sharedFetch).catch(()=> ''),
    resolveCanonicalPackage(booking,sharedFetch).catch(()=> null)
  ]);
  booking.poster_image_url=poster;

  const readiness=OwnerApproval.automationReadiness(env);
  // Validate canonical bookability FIRST. A hidden/invalid event retains the
  // existing fail-closed warning even if the customer also omitted a field.
  // For admitted events, always require a nickname, even in REPLY_ONLY mode:
  // otherwise the generic Flex would falsely imply a viable booking request.
  // Owner-only sender identity checks stay guarded by automation readiness.
  const senderUserId=event.source&&event.source.userId;
  const missingSender=!senderUserId;
  const invalidSender=readiness.ready && !LineIdentity.isUserId(senderUserId);
  if(canonical && (!booking.nickname || invalidSender)){
    const missingName=!booking.nickname;
    await replyFlex(event.replyToken,{
      type:'text',
      text:missingName
        ? 'กรุณาระบุชื่อเล่นในข้อความจอง แล้วส่งใหม่อีกครั้งเพื่อให้ร้านตรวจสอบคิวค่ะ'
        : missingSender
          ? 'กรุณาส่งคำขอจองจากแชทส่วนตัวกับ LINE OA เพื่อให้ร้านตรวจสอบได้ค่ะ'
          : 'ยังไม่สามารถตรวจสอบบัญชี LINE สำหรับจองได้ค่ะ กรุณาส่งคำขอใหม่จากแชทส่วนตัวกับ LINE OA'
    },env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
    // A signed but malformed sender cannot reach private consent lookup,
    // Pending writer or owner Push. Acknowledge safely without provider retry.
    return {handled:true,booking_id:'',
      automation_status:invalidSender&&!missingSender&&!missingName
        ? 'CUSTOMER_IDENTITY_INVALID' : 'CUSTOMER_DETAILS_REQUIRED'};
  }

  let pending=null;
  let automationStatus=readiness.ready?'CANONICAL_REQUIRED':'REPLY_ONLY';
  if(readiness.ready && canonical){
    // Only a signature-verified webhook identity may unlock a backend Terms
    // receipt. In authenticated mode, old text/Cookies cannot bypass this gate.
    let termsStatus=booking.terms_acknowledged===true ? 'LINE_MESSAGE_CONFIRMED' : 'NOT_CONFIRMED';
    if(env.KK_CUSTOMER_LOGIN_ENABLED==='true'){
      const receipt=await IdentityReceipt.lookupSignedLineAcceptance(
        event,env,fetchImpl,{signatureVerified:options.signatureVerified===true}
      );
      termsStatus=receipt.status;
      if(receipt.accepted===true) {
        booking.terms_version=TermsEvidence.VERSION;
        booking.terms_identity_verified=true;
      }
    }
    if(env.KK_CUSTOMER_LOGIN_ENABLED==='true' &&
       termsStatus!=='VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED'){
      // Do not create Pending or send an owner approval card for a LINE user
      // without a current authenticated receipt. Still acknowledge safely.
      automationStatus='TERMS_EVIDENCE_REQUIRED';
      // Do not send the generic "received booking" Flex when the signed LINE
      // identity has no current server-side consent evidence or the private
      // evidence store is unavailable. No Pending/Owner notification happened.
      await replyFlex(event.replyToken,{
        type:'text',
        text:'ยังไม่ได้บันทึกคำขอจองค่ะ\nระบบยังตรวจสอบหลักฐานการยอมรับเงื่อนไขจากบัญชี LINE นี้ไม่ได้ กรุณาเปิด https://kk-phone-rental.vercel.app/ เชื่อม LINE และยอมรับเงื่อนไข แล้วส่งคำขอใหม่อีกครั้ง หรือแจ้งร้านให้ช่วยตรวจสอบค่ะ'
      },env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
      return {handled:true,booking_id:'',automation_status:automationStatus};
    }else{
      pending=await OwnerApproval.createPendingBooking(event,booking,canonical,env,fetchImpl);
      await OwnerApproval.notifyOwner({
        booking_id:pending.booking_id,
        event_name:booking.event_name,
        event_date:booking.event_date,
        package_name:canonical.package_name,
        price_display:canonical.price_display,
        nickname:booking.nickname,
        phone:booking.phone,
        pickup_time:booking.pickup_time,
        terms_status:termsStatus,
        terms_version:booking.terms_version||''
      },env,fetchImpl);
      automationStatus='PENDING_OWNER_APPROVAL';
    }
  }else if(readiness.ready && !canonical){
    console.warn('[line-booking-automation]',JSON.stringify({
      status:'FAIL_CLOSED_CANONICAL_REQUIRED',
      reason:'PUBLIC_EVENT_NOT_BOOKABLE_OR_CANONICAL_UNVERIFIED'
    }));
  }

  const safePackage=canonical || {package_name:booking.package_name,price_display:'รอร้านตรวจสอบราคา'};
  const flex=buildBookingFlex({
    event:booking,
    package:safePackage,
    customer:{nickname:booking.nickname,pickup_time:booking.pickup_time},
    booking:pending?{booking_id:pending.booking_id}:{}
  });
  await replyFlex(event.replyToken,flex,env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
  return {handled:true,booking_id:pending&&pending.booking_id||'',automation_status:automationStatus};
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.statusCode=405; return res.end('Method Not Allowed');}
  const secret=String(process.env.LINE_CHANNEL_SECRET||'').trim();
  const token=String(process.env.LINE_CHANNEL_ACCESS_TOKEN||'').trim();
  if(!secret || !token){res.statusCode=503; return res.end('LINE Messaging API is not configured');}
  const body=rawBody(req);
  const sig=req.headers && (req.headers['x-line-signature']||req.headers['X-Line-Signature']);
  if(!validSignature(body,sig,secret)){res.statusCode=401; return res.end('Invalid signature');}
  let payload; try{payload=JSON.parse(body);}catch(_){res.statusCode=400;return res.end('Invalid JSON');}
  const events=Array.isArray(payload.events)?payload.events:[];
  // Persist only verified events; Inbox failure remains isolated from the existing booking reply path.
  const inboxPromise=InboxTee.persistVerifiedEvents(events,inboxPersistFn(process.env,fetch),{
    profileFn:async userId=>LineMessaging.getProfile(userId,token,fetch),
    mediaFn:async (event,message)=>InboxMedia.capture(event,message,{
      token,fetchImpl:fetch
    })
  }).then(receipt=>{
    if(receipt.media_errors&&receipt.media_errors.length)console.warn('[line-inbox-media]',JSON.stringify({count:receipt.media_errors.length,codes:receipt.media_errors.map(x=>x.code)}));
    return receipt;
  }).catch(err=>({status:'FAILED_ISOLATED',error:err&&err.message?err.message:'inbox failed'}));
  try{
    for(const event of events){
      const ownerDecision=await OwnerApproval.processOwnerPostback(event,process.env,fetch);
      if(ownerDecision.handled) continue;
      await processEvent(event,process.env,fetch,{signatureVerified:true});
    }
    await inboxPromise;
    res.statusCode=200;
    return res.end('OK');
  }
  catch(err){console.error('[line-webhook]',JSON.stringify(safeLineReplyDiagnostic(err)));res.statusCode=500;return res.end('Processing failed');}
};
module.exports._test={safeLineReplyDiagnostic,inboxPersistFn,rawBody,validSignature,parseBookingText,parseCsv,norm,canonicalDate,resolveEventRow,resolvePoster,resolveCanonicalPackage,templateIdFromWebPackageId,packageLabel,formatCanonicalPrice,replyFlex,processEvent,OwnerApproval};
