// KK Phone Rental — Booking Reservation Hard Guard v2
// Wrapper for /api/kk-admin. Booking writes get a fresh read-only snapshot preflight
// before delegating to the existing Admin proxy. Non-booking actions are unchanged.

const { Readable } = require('stream');
const LegacyAdmin = require('./kk-admin.js');
const SnapshotHealth = require('../admin/snapshot-health.js');
const ReservationGuard = require('../admin/reservation-guard.js');

const GUARD_VERSION = ReservationGuard.VERSION;
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const GUARDED_ACTIONS = new Set(['createBooking','updateBooking']);

function reply(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-KK-Booking-Guard-Version',GUARD_VERSION);
  res.end(JSON.stringify(Object.assign({guard_version:GUARD_VERSION},body||{})));
}

function readBody(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>6*1024*1024){ reject(new Error('Request too large')); req.destroy(); }
    });
    req.on('end',()=>resolve(raw));
    req.on('error',reject);
  });
}

function clonedRequest(req,raw){
  const clone=Readable.from([raw||'']);
  clone.method=req.method;
  clone.url=req.url;
  clone.headers=req.headers||{};
  return clone;
}

async function fetchFreshSnapshot(env){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const r=await fetch(env.scriptUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'snapshot',apiKey:env.apiKey,proxyVersion:SnapshotHealth.VERSION,frontendSheetId:env.sheetId,sheetIdSource:env.sheetIdSource}),
      signal:controller.signal
    });
    const text=await r.text();
    let parsed;
    try{ parsed=JSON.parse(text); }
    catch(_){ throw new Error('Fresh snapshot preflight returned non-JSON'); }
    if(!r.ok||!parsed||!parsed.ok||!parsed.data) throw new Error(parsed&&parsed.error?parsed.error:'Fresh snapshot preflight failed');
    const health=SnapshotHealth.assess(parsed.data);
    if(!health.ok) throw new Error('Fresh snapshot rejected: '+health.issues.join('; '));
    if(parsed.data.spreadsheet_id&&parsed.data.spreadsheet_id!==env.sheetId) throw new Error('Fresh snapshot spreadsheet_id mismatch');
    return parsed.data;
  }finally{ clearTimeout(timer); }
}

function normalizedTemplateId(raw,eventId){
  let id=String(raw||'').trim();
  const p=id.indexOf('TPL-');
  if(p>=0) id=id.slice(p);
  else if(eventId&&id.startsWith(String(eventId)+'-')) id=id.slice(String(eventId).length+1);
  return id;
}

function resolvePackageType(snapshot,payload,eventId){
  const templateId=normalizedTemplateId(payload&&payload.template_id,eventId);
  const pkg=(snapshot.packages||[]).find(p=>String(p.template_id||'').trim()===templateId);
  if(pkg&&pkg.package_type) return String(pkg.package_type).trim();
  const web=(snapshot.web_packages||[]).find(p=>{
    if(String(p.event_id||'').trim()!==String(eventId||'').trim()) return false;
    const pid=String(p.package_id||'').trim();
    return pid===String(payload&&payload.template_id||'').trim()||normalizedTemplateId(pid,eventId)===templateId;
  });
  return web&&web.package_type?String(web.package_type).trim():'';
}

function createProposal(snapshot,payload){
  const eventId=String(payload.event_id||'').trim();
  const event=(snapshot.events||[]).find(e=>String(e.event_id||'').trim()===eventId);
  return {
    booking_id:'__PREFLIGHT_NEW__',
    row_number:0,
    booking_status:String(payload.booking_status||'confirmed').trim(),
    event_id:eventId,
    event_date:event&&event.event_date||'',
    package_type:resolvePackageType(snapshot,payload,eventId),
    phone_asset_id:String(payload.phone_asset_id||'').trim(),
    lens_asset_id:String(payload.lens_asset_id||'').trim(),
    pickup_time:String(payload.pickup_time||'').trim(),
    return_time:''
  };
}

function updateProposal(snapshot,payload){
  const row=Number(payload.row_number||0);
  const bid=String(payload.booking_id||'').trim();
  const current=(snapshot.bookings||[]).find(b=>(row>0&&Number(b.row_number||0)===row)||(bid&&String(b.booking_id||'').trim()===bid));
  if(!current) throw new Error('Booking preflight cannot find target booking');
  const next=Object.assign({},current);
  if(payload.booking_status!==undefined&&payload.booking_status!=='') next.booking_status=payload.booking_status;
  if(payload.phone_asset_id!==undefined) next.phone_asset_id=String(payload.phone_asset_id||'').trim();
  if(payload.lens_asset_id!==undefined) next.lens_asset_id=String(payload.lens_asset_id||'').trim();
  if(payload.pickup_time!==undefined) next.pickup_time=String(payload.pickup_time||'').trim();
  // Current live snapshot does not persist/expose return_time through the Admin API.
  // Keep fallback window conservative instead of trusting an unpersisted request field.
  next.return_time=String(current.return_time||'').trim();
  return next;
}

function evaluate(snapshot,payload){
  const proposal=payload.action==='createBooking'?createProposal(snapshot,payload):updateProposal(snapshot,payload);
  return {proposal,result:ReservationGuard.preflight(snapshot,proposal,{defaultEndHour:ReservationGuard.DEFAULT_END_HOUR})};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return LegacyAdmin(req,res);

  let raw='';
  try{ raw=await readBody(req); }
  catch(err){ return reply(res,413,{ok:false,error:err.message||String(err),error_code:'REQUEST_TOO_LARGE'}); }

  let payload;
  try{ payload=raw?JSON.parse(raw):{}; }
  catch(_){ return LegacyAdmin(clonedRequest(req,raw),res); }
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!GUARDED_ACTIONS.has(String(payload.action||''))){
    return LegacyAdmin(clonedRequest(req,raw),res);
  }

  const adminPin=String(process.env.KK_ADMIN_PIN||'').trim();
  const providedPin=String(req.headers&&req.headers['x-admin-pin']||'').trim();
  if(!adminPin) return reply(res,500,{ok:false,error:'Admin API is not configured. Set KK_ADMIN_PIN in Vercel Environment Variables.',error_code:'BOOKING_PREFLIGHT_UNAVAILABLE'});
  if(providedPin!==adminPin) return reply(res,401,{ok:false,error:'Invalid admin PIN'});

  const scriptUrl=String(process.env.KK_ADMIN_SCRIPT_URL||'').trim();
  const apiKey=String(process.env.KK_ADMIN_API_KEY||'').trim();
  const envSheetId=String(process.env.GOOGLE_SHEET_ID||'').trim();
  const sheetId=envSheetId||DEFAULT_SHEET_ID;
  if(!scriptUrl||!apiKey) return reply(res,503,{ok:false,error:'Booking preflight unavailable: Admin upstream is not configured',error_code:'BOOKING_PREFLIGHT_UNAVAILABLE'});

  let assessment;
  try{
    const snapshot=await fetchFreshSnapshot({scriptUrl,apiKey,sheetId,sheetIdSource:envSheetId?'env':'default-fallback'});
    assessment=evaluate(snapshot,payload);
  }catch(err){
    return reply(res,503,{ok:false,error:'Booking preflight unavailable; write blocked: '+(err&&err.message?err.message:String(err)),error_code:'BOOKING_PREFLIGHT_UNAVAILABLE'});
  }

  if(!assessment.result.ok){
    return reply(res,409,{ok:false,error:'Booking blocked by reservation/collision guard: '+assessment.result.errors.map(e=>e.message).join('; '),error_code:'BOOKING_COLLISION',reservation_guard:assessment.result});
  }

  res.setHeader('X-KK-Booking-Guard','PASS');
  res.setHeader('X-KK-Reservation-Mode',assessment.result.window&&assessment.result.window.mode||'none');
  return LegacyAdmin(clonedRequest(req,raw),res);
};

module.exports._test={normalizedTemplateId,resolvePackageType,createProposal,updateProposal,evaluate};