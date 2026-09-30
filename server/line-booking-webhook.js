'use strict';

const crypto = require('node:crypto');
const {buildBookingFlex} = require('../server/line-booking-flex');

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const PUBLIC_DATA_BASE = 'https://kk-phone-rental.vercel.app/api/kk-data';

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
  const line=(label)=>{const m=s.match(new RegExp('(?:^|\\n)[^\\p{L}\\p{N}\\n]*?(?:'+label+')\\s*:\\s*([^\\n]*)','iu')); return m&&m[1]?m[1].trim():'';};
  const interest=s.match(/(?:สนใจเช่า|Interested in renting)\s+([^\n]+)/i);
  const event=line('งาน|Event'), date=line('วันที่|Date'), venue=line('สถานที่|Venue'), price=line('ราคา|Price');
  const nickname=line('ชื่อเล่น|Nickname'), phone=line('เบอร์โทร|Phone'), pickup=line('เวลาที่สะดวกรับอุปกรณ์|เวลารับอุปกรณ์|Pickup');
  const model=line('รุ่น|Model');
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
  const u=PUBLIC_DATA_BASE+'?sheet=08_Web_Ready&range=A4%3AK&showPast=1';
  const r=await fetchImpl(u,{headers:{'User-Agent':'KK-Line-Webhook/1.0'}});
  if(!r.ok) return '';
  const rows=parseCsv(await r.text());
  const norm=v=>String(v||'').normalize('NFKC').trim().toLowerCase();
  const exact=rows.find(x=>norm(x.event_name)===norm(booking.event_name) && norm(x.venue)===norm(booking.venue));
  return exact ? String(exact.poster_image_url||'').trim() : '';
}
async function replyFlex(replyToken, message, token, fetchImpl=fetch){
  const r=await fetchImpl(LINE_REPLY_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({replyToken,messages:[message]})});
  if(!r.ok){const body=await r.text().catch(()=> ''); throw new Error('LINE reply failed '+r.status+' '+body.slice(0,200));}
}
async function processEvent(event, env=process.env, fetchImpl=fetch){
  if(!event || event.type!=='message' || !event.replyToken || !event.message || event.message.type!=='text') return {handled:false};
  const booking=parseBookingText(event.message.text);
  if(!booking) return {handled:false};
  booking.poster_image_url=await resolvePoster(booking,fetchImpl).catch(()=> '');
  const flex=buildBookingFlex({event:booking,package:{package_name:booking.package_name,price_display:booking.price_display},customer:{nickname:booking.nickname,pickup_time:booking.pickup_time}});
  await replyFlex(event.replyToken,flex,env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
  return {handled:true};
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
  try{for(const event of events) await processEvent(event,process.env,fetch); res.statusCode=200; return res.end('OK');}
  catch(err){console.error('[line-webhook]',err&&err.message?err.message:'processing failed');res.statusCode=500;return res.end('Processing failed');}
};
module.exports._test={rawBody,validSignature,parseBookingText,parseCsv,resolvePoster,replyFlex,processEvent};
