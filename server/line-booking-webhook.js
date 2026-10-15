'use strict';

const crypto = require('node:crypto');
const {buildBookingFlex} = require('../server/line-booking-flex');
const {safePosterSource} = require('../server/line-poster');
const InboxTee = require('./kk-line-inbox-tee');
const {createPostgrestStore} = require('./kk-inbox-postgrest-store');
const LineMessaging = require('./kk-line-messaging-api');
const OwnerApproval = require('./line-booking-owner-approval');

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
  return {event_name:event,event_date:date,venue,package_name:packageName,price_display:price,nickname,phone,pickup_time:pickup};
}
function parseCsv(text){
  const rows=[]; let row=[],cell='',q=false; const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const c=s[i]; if(q){if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);} if(!rows.length)return[];
  const h=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||''])));
}
async function resolvePoster(booking, fetchImpl=fetch){
  const u=PUBLIC_DATA_BASE+WEB_READY_QUERY;
  const r=await fetchImpl(u,{headers:{'User-Agent':'KK-Line-Webhook/1.0'}});
  if(!r.ok) return '';
  const rows=parseCsv(await r.text());
  const exact=resolveEventRow(rows,booking);
  if(!exact || !safePosterSource(exact.poster_image_url)) return '';
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
  const eventId=event&&String(event.event_id||'').trim();
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
async function replyFlex(replyToken, message, token, fetchImpl=fetch){
  const r=await fetchImpl(LINE_REPLY_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({replyToken,messages:[message]})});
  if(!r.ok){const body=await r.text().catch(()=> ''); throw new Error('LINE reply failed '+r.status+' '+body.slice(0,200));}
}
async function processEvent(event, env=process.env, fetchImpl=fetch){
  if(!event || event.type!=='message' || !event.replyToken || !event.message || event.message.type!=='text') return {handled:false};
  const booking=parseBookingText(event.message.text);
  if(!booking) return {handled:false};
  const [poster,canonical]=await Promise.all([
    resolvePoster(booking,fetchImpl).catch(()=> ''),
    resolveCanonicalPackage(booking,fetchImpl).catch(()=> null)
  ]);
  booking.poster_image_url=poster;

  const readiness=OwnerApproval.automationReadiness(env);
  let pending=null;
  let automationStatus=readiness.ready?'CANONICAL_REQUIRED':'REPLY_ONLY';
  if(readiness.ready && canonical){
    pending=await OwnerApproval.createPendingBooking(event,booking,canonical,env,fetchImpl);
    await OwnerApproval.notifyOwner({
      booking_id:pending.booking_id,
      event_name:booking.event_name,
      event_date:booking.event_date,
      package_name:canonical.package_name,
      price_display:canonical.price_display,
      nickname:booking.nickname,
      phone:booking.phone,
      pickup_time:booking.pickup_time
    },env,fetchImpl);
    automationStatus='PENDING_OWNER_APPROVAL';
  }else if(readiness.ready && !canonical){
    console.warn('[line-booking-automation]',JSON.stringify({
      status:'FAIL_CLOSED_CANONICAL_REQUIRED',
      webhook_event_id:String(event.webhookEventId||'').trim(),
      event_name:String(booking.event_name||'').trim()
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
    profileFn:async userId=>LineMessaging.getProfile(userId,token,fetch)
  }).catch(err=>({status:'FAILED_ISOLATED',error:err&&err.message?err.message:'inbox failed'}));
  try{
    for(const event of events){
      const ownerDecision=await OwnerApproval.processOwnerPostback(event,process.env,fetch);
      if(ownerDecision.handled) continue;
      await processEvent(event,process.env,fetch);
    }
    await inboxPromise;
    res.statusCode=200;
    return res.end('OK');
  }
  catch(err){console.error('[line-webhook]',err&&err.message?err.message:'processing failed');res.statusCode=500;return res.end('Processing failed');}
};
module.exports._test={inboxPersistFn,rawBody,validSignature,parseBookingText,parseCsv,norm,canonicalDate,resolveEventRow,resolvePoster,resolveCanonicalPackage,templateIdFromWebPackageId,packageLabel,formatCanonicalPrice,replyFlex,processEvent,OwnerApproval};
