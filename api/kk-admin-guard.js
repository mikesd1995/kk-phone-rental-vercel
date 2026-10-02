// KK Phone Rental — Booking Reservation Hard Guard v2 + Event Create Integrity Guard v3 Lean
// Booking writes keep the existing fresh read-only snapshot preflight.
// Event creation uses a bounded lightweight event index when completeness is proven,
// and automatically falls back to the existing full snapshot guard on any uncertainty.

const { Readable } = require('stream');
const crypto = require('node:crypto');
const LegacyAdmin = require('../server/admin-proxy.js');
const SnapshotHealth = require('../admin/snapshot-health.js');
const ReservationGuard = require('../admin/reservation-guard.js');
const AdminSheetFallback = require('../server/admin-sheet-fallback.js');
const VisibilityGuard = require('../server/event-visibility-owner-guard.js');
const AgentGateway = require('../server/kk-agent-gateway.js');
const AgentLedger = require('../server/kk-agent-invocation-ledger.js');
const AgentRegistry = require('../server/kk-agent-registry.js');
const AgentOrchestration = require('../server/kk-agent-orchestration.js');
const DecisionLedger = require('../server/kk-decision-ledger.js');
const AdminSecurity = require('../server/admin-session.js');

const GUARD_VERSION = ReservationGuard.VERSION;
const EVENT_GUARD_VERSION = 'event-create-integrity-lean-3';
const BOOKING_TIMING_POLICY_VERSION = 'booking-timing-optional-safe-fallback-2';
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const BOOKING_GUARDED_ACTIONS = new Set(['createBooking','updateBooking']);
const EVENT_GUARDED_ACTIONS = new Set(['createEvent']);
const EVENT_VISIBILITY_GUARDED_ACTIONS = new Set(['updateEvent']);
const AGENT_GATEWAY_ACTIONS = new Set(['agentGateway','agentGatewayHealth']);
const AGENT_GATEWAY_MAX_BODY_BYTES = 64 * 1024;
const EVENT_FEED_TIMEOUT_MS = 6500;
const EVENT_FEED_MIN_ROWS = 10;

function reply(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-KK-Booking-Guard-Version',GUARD_VERSION);
  res.setHeader('X-KK-Event-Guard-Version',EVENT_GUARD_VERSION);
  res.setHeader('X-KK-Booking-Timing-Policy',BOOKING_TIMING_POLICY_VERSION);
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
function authorizedClone(req,raw,adminPin){
  const clone=clonedRequest(req,raw);
  // Copy into a fresh mutable object after this layer has authenticated the
  // request. This keeps the server PIN internal even when platform request
  // headers are immutable.
  clone.headers=Object.assign({},req&&req.headers||{}, {'x-admin-pin':String(adminPin||'')});
  return clone;
}

async function fetchFreshSnapshot(env,timeoutMs){
  const waitMs=Number(timeoutMs||18000);
  let timer=null;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const err=new Error('Direct-Sheet preflight timed out');
      err.code='DIRECT_SHEET_PREFLIGHT_TIMEOUT';
      reject(err);
    },waitMs);
  });
  try{
    const snapshot=await Promise.race([
      AdminSheetFallback.buildSnapshot({
        sheetId:env.sheetId,
        env:process.env,
        cache:false
      }),
      timeout
    ]);
    const health=SnapshotHealth.assess(snapshot);
    if(!health.ok) throw new Error('Fresh direct-Sheet snapshot rejected: '+health.issues.join('; '));
    if(snapshot.spreadsheet_id&&snapshot.spreadsheet_id!==env.sheetId) throw new Error('Fresh direct-Sheet snapshot spreadsheet_id mismatch');
    return snapshot;
  }finally{
    if(timer) clearTimeout(timer);
  }
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
  // booking_id is stable across blank-row insertion, cleanup and GViz row
  // compaction. Never trust a row-only mutation when the snapshot source marks
  // row numbers non-authoritative.
  if(!bid && snapshot && snapshot.booking_row_number_reliable!==true){
    const err=new Error('Booking preflight requires booking_id because snapshot row numbers are not reliable');
    err.code='BOOKING_ID_REQUIRED';
    throw err;
  }
  const current=bid
    ? (snapshot.bookings||[]).find(b=>String(b.booking_id||'').trim()===bid)
    : (snapshot.bookings||[]).find(b=>row>0&&Number(b.row_number||0)===row);
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

function validateCreateBookingTiming(payload){
  if(String(payload&&payload.action||'')!=='createBooking') return {ok:true,mode:'not-create'};
  const pickup=String(payload&&payload.pickup_time||'').trim();
  if(!pickup){
    return {
      ok:true,
      pickup_time:'',
      mode:'fallback-day-start',
      note:'pickup_time is optional/TBD; reservation starts at 00:00 on event day'
    };
  }
  if(ReservationGuard.timeMinutes(pickup)===null){
    return {
      ok:false,
      status:422,
      error_code:'BOOKING_PICKUP_TIME_INVALID',
      error:'เวลารับเครื่องไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM เช่น 17:30 หรือเว้นว่างถ้าลูกค้ายังไม่ยืนยัน',
      recommended_action:'correctOrClearPickupTime'
    };
  }
  return {ok:true,pickup_time:pickup,mode:'explicit-pickup'};
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

function parseCsv(text){
  const rows=[];
  let row=[];
  let cell='';
  let quoted=false;
  const input=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"'&&input[i+1]==='"'){ cell+='"'; i++; }
      else if(ch==='"') quoted=false;
      else cell+=ch;
      continue;
    }
    if(ch==='"') quoted=true;
    else if(ch===','){ row.push(cell); cell=''; }
    else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else if(ch!=='\r') cell+=ch;
  }
  if(cell!==''||row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function gvizCsvUrl(sheetId,sheet,range){
  const params=new URLSearchParams({tqx:'out:csv',sheet,range,t:String(Date.now())});
  return 'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(sheetId)+'/gviz/tq?'+params.toString();
}

async function fetchTextWithTimeout(url,timeoutMs){
  const waitMs=Number(timeoutMs||EVENT_FEED_TIMEOUT_MS);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),waitMs);
  try{
    const r=await fetch(url,{signal:controller.signal});
    const text=await r.text();
    if(!r.ok) throw new Error('event feed HTTP '+r.status);
    if(/<!doctype html|<html/i.test(text)) throw new Error('event feed returned HTML');
    return text;
  }finally{ clearTimeout(timer); }
}

function eventRowsFromCsv(text){
  const rows=parseCsv(text).filter(r=>r.some(v=>String(v||'').trim()));
  if(!rows.length) throw new Error('event feed is empty');
  const header=rows[0].map(v=>String(v||'').trim().toLowerCase());
  const id=header.indexOf('event_id');
  const name=header.indexOf('event_name');
  const eventDate=header.indexOf('event_date')>=0?header.indexOf('event_date'):header.indexOf('event_date_text');
  const venue=header.indexOf('venue');
  const action=header.indexOf('action_for_web');
  if(id<0||name<0||eventDate<0||venue<0) throw new Error('event feed header mismatch');
  return rows.slice(1)
    .filter(r=>String(r[id]||'').trim())
    .map(r=>({
      event_id:String(r[id]||'').trim(),
      event_name:r[name]||'',
      event_date:r[eventDate]||'',
      venue:r[venue]||'',
      active_on_web:action>=0?String(r[action]||'').trim().toLowerCase()!=='hide':undefined,
      status:''
    }));
}

function sourceEventCountFromCsv(text){
  const rows=parseCsv(text);
  const hit=rows.find(r=>String(r[0]||'').trim().toLowerCase()==='source count — events'.toLowerCase());
  if(!hit) throw new Error('event source-count row missing');
  const n=Number(String(hit[1]||'').replace(/,/g,'').trim());
  if(!Number.isFinite(n)||n<0||Math.floor(n)!==n) throw new Error('event source-count invalid');
  return n;
}

function validateLeanEventIndex(events,expected){
  if(!Array.isArray(events)) throw new Error('event index invalid');
  if(events.length<EVENT_FEED_MIN_ROWS) throw new Error('event index unexpectedly small: '+events.length);
  if(Number(expected)!==events.length) throw new Error('event index/source count mismatch: '+events.length+'/'+expected);
  const ids=new Set();
  for(const event of events){
    const id=String(event&&event.event_id||'').trim();
    if(!id) throw new Error('event index row missing event_id');
    if(ids.has(id)) throw new Error('event index duplicate event_id: '+id);
    ids.add(id);
  }
  return {events,expected:Number(expected)};
}

async function fetchLeanEventIndex(sheetId){
  const startedAt=Date.now();
  const [eventCsv,healthCsv,lockCsv]=await Promise.all([
    fetchTextWithTimeout(gvizCsvUrl(sheetId,'08_Web_Ready','A4:J500'),EVENT_FEED_TIMEOUT_MS),
    fetchTextWithTimeout(gvizCsvUrl(sheetId,'10_Admin_Health_Check','A4:B40'),EVENT_FEED_TIMEOUT_MS),
    fetchTextWithTimeout(gvizCsvUrl(sheetId,'18_Event_Visibility_Locks','A1:N500'),EVENT_FEED_TIMEOUT_MS)
  ]);
  const checked=validateLeanEventIndex(eventRowsFromCsv(eventCsv),sourceEventCountFromCsv(healthCsv));
  const visibilityLocks=AdminSheetFallback.rowsAsObjects(lockCsv,'lock_id',1).filter(r=>String(r.lock_id||r.event_id||'').trim());
  return {events:checked.events,visibility_locks:visibilityLocks,expected:checked.expected,latency_ms:Date.now()-startedAt};
}


function safeSecretEqual(a,b){
  const left=crypto.createHash('sha256').update(String(a||''),'utf8').digest();
  const right=crypto.createHash('sha256').update(String(b||''),'utf8').digest();
  return crypto.timingSafeEqual(left,right);
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
  const agentGatewayAction=AGENT_GATEWAY_ACTIONS.has(action);
  const bookingGuarded=BOOKING_GUARDED_ACTIONS.has(action);
  const eventGuarded=EVENT_GUARDED_ACTIONS.has(action);
  const visibilityGuarded=EVENT_VISIBILITY_GUARDED_ACTIONS.has(action) &&
    VisibilityGuard.requestedVisibility(payload)===true;
  const passthrough=!payload||typeof payload!=='object'||Array.isArray(payload)||(!agentGatewayAction&&!bookingGuarded&&!eventGuarded&&!visibilityGuarded);

  const adminPin=String(process.env.KK_ADMIN_PIN||'').trim();
  const providedPin=String(req.headers&&req.headers['x-admin-pin']||'').trim();
  if(!adminPin) return reply(res,500,{ok:false,error:'Admin API is not configured. Set KK_ADMIN_PIN in Vercel Environment Variables.',error_code:agentGatewayAction?'AGENT_GATEWAY_UNAVAILABLE':(bookingGuarded?'BOOKING_PREFLIGHT_UNAVAILABLE':(visibilityGuarded?'EVENT_VISIBILITY_PREFLIGHT_UNAVAILABLE':'EVENT_PREFLIGHT_UNAVAILABLE'))});
  // The outer signed-session gate may authorize the request without exposing the
  // PIN to browser JavaScript. Do not depend on mutating request headers in the
  // Vercel runtime; accept the signed HttpOnly session directly as well.
  const signedSession=AdminSecurity.hasValidSession(req)||AdminSecurity.isAuthorizedRequest(req);
  const legacyPinOk=!!providedPin&&safeSecretEqual(providedPin,adminPin);
  if(!signedSession&&!legacyPinOk) return reply(res,401,{ok:false,error:'Invalid admin session'});
  if(passthrough) return LegacyAdmin(authorizedClone(req,raw,adminPin),res);

  if(agentGatewayAction){
    res.setHeader('X-KK-Agent-Gateway-Version',AgentGateway.GATEWAY_VERSION);
    if(Buffer.byteLength(raw||'','utf8')>AGENT_GATEWAY_MAX_BODY_BYTES){
      return reply(res,413,{ok:false,error:'Agent Gateway request too large',error_code:'AGENT_GATEWAY_BODY_TOO_LARGE'});
    }
    if(action==='agentGatewayHealth'){
      const ledgerState=AgentLedger.configState();
      let coverage={status:'UNAVAILABLE',summary:null,error_code:''};
      if(ledgerState.configured){
        try{
          const recent=await AgentLedger.listRecentInvocations({limit:100});
          coverage={
            status:'READBACK_COMPLETE',
            summary:AgentOrchestration.coverageSummary(recent.rows),
            sampled_rows:recent.rows.length,
            error_code:''
          };
        }catch(err){
          coverage={
            status:'READBACK_BLOCKED',
            summary:null,
            error_code:String(err&&(err.code||err.name)||'AGENT_LEDGER_READ_FAILED')
          };
        }
      }
      return reply(res,200,{
        ok:true,
        agent_gateway:{
          gateway_version:AgentGateway.GATEWAY_VERSION,
          registry:AgentRegistry.publicRegistry(),
          ledger:ledgerState,
          decision_ledger:DecisionLedger.configState(),
          coverage,
          production_writes:0,
          publishes:0
        }
      });
    }
    const request=payload.request&&typeof payload.request==='object'&&!Array.isArray(payload.request)?payload.request:{};
    if(!String(request.message||'').trim()&&!String(request.task_type||'').trim()){
      return reply(res,400,{ok:false,error:'request.message or request.task_type is required',error_code:'AGENT_GATEWAY_REQUEST_REQUIRED'});
    }
    let effectiveRequest=request;
    if(String(request.task_type||'').trim()==='resolve_final_pricing'){
      try{
        const envSheetId=String(process.env.GOOGLE_SHEET_ID||'').trim();
        const sheetId=envSheetId||DEFAULT_SHEET_ID;
        const snapshot=await fetchFreshSnapshot({sheetId,sheetIdSource:envSheetId?'env':'default-fallback'},18000);
        effectiveRequest=Object.assign({},request,{input:Object.assign({},request.input||{},{package_templates:snapshot.packages||[]})});
        res.setHeader('X-KK-Final-Pricing-SOT','03_Packages');
      }catch(err){
        return reply(res,503,{ok:false,error:'Final pricing SOT unavailable; resolution blocked',error_code:'FINAL_PRICING_SOT_UNAVAILABLE'});
      }
    }
    let result;
    try{
      result=await AgentGateway.executeAgentRequest(effectiveRequest,{
        ledgerFn:row=>AgentLedger.recordInvocation({row})
      });
    }catch(err){
      return reply(res,500,{
        ok:false,
        error:'Agent Gateway execution failed',
        error_code:'AGENT_GATEWAY_EXECUTION_FAILED',
        failure_class:String(err&&(err.code||err.name)||'ERROR')
      });
    }
    const status=result.status==='BLOCKED_LEDGER_UNAVAILABLE'?503:
      (String(result.status||'').startsWith('BLOCKED_')?409:200);
    return reply(res,status,{ok:status===200,agent_gateway:result});
  }

  if(bookingGuarded){
    res.setHeader('X-KK-Booking-Timing-Policy',BOOKING_TIMING_POLICY_VERSION);
    const timing=validateCreateBookingTiming(payload);
    if(!timing.ok){
      return reply(res,timing.status,{
        ok:false,
        error:timing.error,
        error_code:timing.error_code,
        recommended_action:timing.recommended_action
      });
    }
    res.setHeader('X-KK-Booking-Pickup-Mode',timing.mode||'unknown');
  }

  if(visibilityGuarded){
    const envSheetId=String(process.env.GOOGLE_SHEET_ID||'').trim();
    const sheetId=envSheetId||DEFAULT_SHEET_ID;
    let snapshot;
    try{
      snapshot=await fetchFreshSnapshot({sheetId,sheetIdSource:envSheetId?'env':'default-fallback'},18000);
    }catch(err){
      return reply(res,503,{
        ok:false,
        error:'Event visibility preflight unavailable; re-open blocked: '+(err&&err.message?err.message:String(err)),
        error_code:'EVENT_VISIBILITY_PREFLIGHT_UNAVAILABLE',
        recommended_action:'retryFromAdminVisibilityControl'
      });
    }
    const checked=VisibilityGuard.evaluateSnapshotTransition(snapshot,payload);
    if(!checked.ok){
      return reply(res,409,{
        ok:false,
        error:'งานนี้ถูกซ่อนจากหน้าบ้านโดยเจ้าของ ระบบจะไม่เปิดกลับอัตโนมัติ',
        error_code:checked.code,
        event_id:checked.event_id||String(payload.event_id||''),
        recommended_action:'reopenFromAdminVisibilityControl',
        visibility_guard:checked
      });
    }
    res.setHeader('X-KK-Event-Visibility-Guard',checked.code||'PASS');
    return LegacyAdmin(authorizedClone(req,raw,adminPin),res);
  }

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
  // Preflight no longer depends on Apps Script. Actual writes still delegate to the
  // guarded legacy writer until the authenticated direct writer passes acceptance.

  if(eventGuarded){
    let snapshot;
    let preflightMode='LEAN_GVIZ';
    let preflightMs=0;
    try{
      const lean=await fetchLeanEventIndex(sheetId);
      snapshot={events:lean.events,visibility_locks:lean.visibility_locks||[]};
      preflightMs=lean.latency_ms;
      res.setHeader('X-KK-Event-Preflight-Rows',String(lean.events.length));
    }catch(leanErr){
      preflightMode='FULL_SNAPSHOT_FALLBACK';
      const fallbackStartedAt=Date.now();
      try{
        snapshot=await fetchFreshSnapshot({sheetId,sheetIdSource:envSheetId?'env':'default-fallback'},30000);
        preflightMs=Date.now()-fallbackStartedAt;
        res.setHeader('X-KK-Event-Preflight-Fallback',String(leanErr&&leanErr.message?leanErr.message:leanErr).slice(0,180));
      }catch(err){
        return reply(res,503,{ok:false,error:'Event preflight unavailable; write blocked: '+(err&&err.message?err.message:String(err)),error_code:'EVENT_PREFLIGHT_UNAVAILABLE'});
      }
    }

    res.setHeader('X-KK-Event-Preflight',preflightMode);
    res.setHeader('X-KK-Event-Preflight-MS',String(preflightMs));
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
        recommended_action:'updateEvent',
        preflight_mode:preflightMode
      });
    }
    const history=VisibilityGuard.evaluateCreateAgainstHistory(snapshot,payload);
    if(!history.ok){
      const locked=history.code==='EVENT_VISIBILITY_TOMBSTONE_LOCKED';
      return reply(res,409,{
        ok:false,
        error:locked?'งานนี้เคยถูกเจ้าของซ่อน ระบบจะไม่สร้าง/เปิดกลับอัตโนมัติ':'งานนี้มีประวัติใน Core แล้ว ระบบจะ reconcile งานเดิมแทนการสร้างซ้ำ',
        error_code:history.code,
        history:history.history||null,
        recommended_action:locked?'explicitOwnerReopen':'reconcileHistoricalEvent',
        preflight_mode:preflightMode
      });
    }
    const prepared=prepareCreateEventPayload(payload);
    if(prepared.publish_default_applied) res.setHeader('X-KK-Event-Publish-Default','TRUE');
    res.setHeader('X-KK-Event-Guard','PASS');
    return LegacyAdmin(authorizedClone(req,JSON.stringify(prepared.payload),adminPin),res);
  }

  let snapshot;
  try{
    snapshot=await fetchFreshSnapshot({sheetId,sheetIdSource:envSheetId?'env':'default-fallback'},18000);
    res.setHeader('X-KK-Booking-Preflight','DIRECT_SHEET');
  }catch(err){
    return reply(res,503,{ok:false,error:'Booking preflight unavailable; write blocked: '+(err&&err.message?err.message:String(err)),error_code:'BOOKING_PREFLIGHT_UNAVAILABLE'});
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
  return LegacyAdmin(authorizedClone(req,raw,adminPin),res);
};

module.exports._test={normalizedTemplateId,resolvePackageType,createProposal,updateProposal,evaluate,validateCreateBookingTiming,normalizeIdentityText,normalizeEventDate,bangkokTodayISO,isPastEventDate,findDuplicateEvent,prepareCreateEventPayload,parseCsv,eventRowsFromCsv,sourceEventCountFromCsv,validateLeanEventIndex,VisibilityGuard,AGENT_GATEWAY_ACTIONS,AGENT_GATEWAY_MAX_BODY_BYTES};
