// KK Phone Rental — Booking Reservation Hard Guard v2 + Event Create Integrity Guard v2
// Booking writes get a fresh read-only snapshot preflight before delegating to the
// existing Admin proxy. Event creation preflights duplicate identity and blocks
// accidental past-dated events before any upstream business write.

const { Readable } = require('stream');
const LegacyAdmin = require('./kk-admin.js');
const SnapshotHealth = require('../admin/snapshot-health.js');
const ReservationGuard = require('../admin/reservation-guard.js');

const GUARD_VERSION = ReservationGuard.VERSION;
const EVENT_GUARD_VERSION = 'event-create-integrity-2';
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const BOOKING_GUARDED_ACTIONS = new Set(['createBooking','updateBooking']);
const EVENT_GUARDED_ACTIONS = new Set(['createEvent']);

function reply(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-KK-Booking-Guard-Version',GUARD_VERSION);
  res.setHeader('X-KK-Event-Guard-Version',EVENT_GUARD_VERSION);
  res.end(JSON.stringify(Object.assign({guard_version:GUARD_VERSION,event_guard_version:EVENT_GUARD_VERSION},body||{})));
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

async function fetchFreshSnapshot(env,timeoutMs){
  const waitMs=Number(timeoutMs||18000);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),waitMs);
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

function normalizeIdentityText(value){
  return String(value===undefined||value===null?'':value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[\s\-_.,/\\()[\]{}:;'"`]+/g,'');
}

function normalizeEventDate(value){
  if(value instanceof Date&&!isNaN(value)) return value.toISOString().slice(0,10);
  const raw=String(value===undefined||value===null?'':value).trim();
  if(!raw) return '';
  if(/^\d+(?:\.\d+)?$/.test(raw)){
    const n=Number(raw);
    if(n>1000&&n<100000){
      const ms=Date.UTC(1899,11,30)+Math.round(n*86400000);
      return new Date(ms).toISOString().slice(0,10);
    }
  }
  let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m){
    let y=Number(m[1]); if(y>2500)y-=543;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  }
  m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if(m){
    let y=Number(m[3]); if(y>2500)y-=543;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  const d=new Date(raw);
  return isNaN(d)?'':d.toISOString().slice(0,10);
}

function bangkokTodayISO(now){
  const d=now instanceof Date?now:new Date(now||Date.now());
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d);
  const get=type=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isPastEventDate(value,now){
  const eventDate=normalizeEventDate(value);
  return !!eventDate && eventDate<bangkokTodayISO(now);
}

function findDuplicateEvent(snapshot,payload){
  const wantedName=normalizeIdentityText(payload&&payload.event_name);
  const wantedDate=normalizeEventDate(payload&&payload.event_date);
  const wantedVenue=normalizeIdentityText(payload&&payload.venue);
  if(!wantedName||!wantedDate) return null;
  return (snapshot.events||[]).find(event=>{
    if(normalizeIdentityText(event&&event.event_name)!==wantedName) return false;
    if(normalizeEventDate(event&&event.event_date)!==wantedDate) return false;
    const existingVenue=normalizeIdentityText(event&&event.venue);
    // Same name + same date is already highly specific. When both venues are known,
    // require venue equality to avoid blocking legitimately distinct same-day venues.
    if(wantedVenue&&existingVenue&&wantedVenue!==existingVenue) return false;
    return true;
  })||null;
}

function prepareCreateEventPayload(payload){
  const next=Object.assign({},payload||{});
  const missing=!Object.prototype.hasOwnProperty.call(next,'active_on_web')||next.active_on_web===null||next.active_on_web==='';
  if(missing) next.active_on_web=true;
  return {payload:next,publish_default_applied:missing};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return LegacyAdmin(req,res);

  let raw='';
  try{ raw=await readBody(req); }
  catch(err){ return reply(res,413,{ok:false,error:err.message||String(err),error_code:'REQUEST_TOO_LARGE'}); }

  let payload;
  try{ payload=raw?JSON.parse(raw):{}; }
  catch(_){ return LegacyAdmin(clonedRequest(req,raw),res); }
  const action=String(payload&&payload.action||'');
  const bookingGuarded=BOOKING_GUARDED_ACTIONS.has(action);
  const eventGuarded=EVENT_GUARDED_ACTIONS.has(action);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||(!bookingGuarded&&!eventGuarded)){
    return LegacyAdmin(clonedRequest(req,raw),res);
  }

  const adminPin=String(process.env.KK_ADMIN_PIN||'').trim();
  const providedPin=String(req.headers&&req.headers['x-admin-pin']||'').trim();
  if(!adminPin) return reply(res,500,{ok:false,error:'Admin API is not configured. Set KK_ADMIN_PIN in Vercel Environment Variables.',error_code:bookingGuarded?'BOOKING_PREFLIGHT_UNAVAILABLE':'EVENT_PREFLIGHT_UNAVAILABLE'});
  if(providedPin!==adminPin) return reply(res,401,{ok:false,error:'Invalid admin PIN'});

  if(eventGuarded&&isPastEventDate(payload.event_date)){
    return reply(res,422,{
      ok:false,
      error:'วันที่งานเป็นอดีต กรุณาตรวจวัน/เดือน/ปีอีกครั้งก่อนสร้างงาน',
      error_code:'EVENT_DATE_IN_PAST',
      event_date:normalizeEventDate(payload.event_date),
      today_bangkok:bangkokTodayISO(),
      recommended_action:'correctEventDate'
    });
  }

  const scriptUrl=String(process.env.KK_ADMIN_SCRIPT_URL||'').trim();
  const apiKey=String(process.env.KK_ADMIN_API_KEY||'').trim();
  const envSheetId=String(process.env.GOOGLE_SHEET_ID||'').trim();
  const sheetId=envSheetId||DEFAULT_SHEET_ID;
  if(!scriptUrl||!apiKey) return reply(res,503,{ok:false,error:(bookingGuarded?'Booking':'Event')+' preflight unavailable: Admin upstream is not configured',error_code:bookingGuarded?'BOOKING_PREFLIGHT_UNAVAILABLE':'EVENT_PREFLIGHT_UNAVAILABLE'});

  let snapshot;
  try{
    snapshot=await fetchFreshSnapshot({scriptUrl,apiKey,sheetId,sheetIdSource:envSheetId?'env':'default-fallback'},eventGuarded?30000:18000);
  }catch(err){
    return reply(res,503,{ok:false,error:(bookingGuarded?'Booking':'Event')+' preflight unavailable; write blocked: '+(err&&err.message?err.message:String(err)),error_code:bookingGuarded?'BOOKING_PREFLIGHT_UNAVAILABLE':'EVENT_PREFLIGHT_UNAVAILABLE'});
  }

  if(eventGuarded){
    const duplicate=findDuplicateEvent(snapshot,payload);
    if(duplicate){
      const active=duplicate.active_on_web!==false&&String(duplicate.active_on_web||'').toLowerCase()!=='false';
      return reply(res,409,{
        ok:false,
        error:'มีงานชื่อนี้ในวันเดียวกันอยู่แล้ว กรุณาแก้ Event เดิมแทนการสร้างซ้ำ'+(active?'':' (Event เดิมยังซ่อนจากเว็บอยู่)'),
        error_code:'EVENT_DUPLICATE',
        existing_event:{
          event_id:String(duplicate.event_id||''),
          event_name:String(duplicate.event_name||''),
          event_date:duplicate.event_date||'',
          venue:String(duplicate.venue||''),
          active_on_web:duplicate.active_on_web,
          status:duplicate.status
        },
        recommended_action:'updateEvent'
      });
    }
    const prepared=prepareCreateEventPayload(payload);
    if(prepared.publish_default_applied) res.setHeader('X-KK-Event-Publish-Default','TRUE');
    res.setHeader('X-KK-Event-Guard','PASS');
    return LegacyAdmin(clonedRequest(req,JSON.stringify(prepared.payload)),res);
  }

  let assessment;
  try{ assessment=evaluate(snapshot,payload); }
  catch(err){
    return reply(res,503,{ok:false,error:'Booking preflight unavailable; write blocked: '+(err&&err.message?err.message:String(err)),error_code:'BOOKING_PREFLIGHT_UNAVAILABLE'});
  }

  if(!assessment.result.ok){
    return reply(res,409,{ok:false,error:'Booking blocked by reservation/collision guard: '+assessment.result.errors.map(e=>e.message).join('; '),error_code:'BOOKING_COLLISION',reservation_guard:assessment.result});
  }

  res.setHeader('X-KK-Booking-Guard','PASS');
  res.setHeader('X-KK-Reservation-Mode',assessment.result.window&&assessment.result.window.mode||'none');
  return LegacyAdmin(clonedRequest(req,raw),res);
};

module.exports._test={normalizedTemplateId,resolvePackageType,createProposal,updateProposal,evaluate,normalizeIdentityText,normalizeEventDate,bangkokTodayISO,isPastEventDate,findDuplicateEvent,prepareCreateEventPayload};
