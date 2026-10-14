// KK Phone Rental — Rental Analytics Core v3 (READ ONLY, internal server module)
// Reads aggregate-helper/event metadata through Google Sheets gviz. Returns aggregate metrics only; no PII leaves this endpoint.
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
const AdminSecurity = require('./admin-session.js');
const CanonicalQuote = require('./rental-dashboard-canonical-quotes.js');

function json(res,status,body){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, max-age=0");
  res.end(JSON.stringify(body||{}));
}
function csvUrl(sheetId,sheet,range){
  const params=new URLSearchParams({tqx:"out:csv",sheet,range,t:String(Date.now())});
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params.toString()}`;
}
async function fetchCsv(sheetId,sheet,range){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(csvUrl(sheetId,sheet,range),{signal:controller.signal});
    const text=await r.text();
    if(!r.ok || /<!doctype html|<html/i.test(text)) throw new Error(`อ่าน ${sheet} ไม่สำเร็จ`);
    return text;
  }finally{ clearTimeout(timer); }
}
function parseCsv(text){
  const rows=[]; let row=[],value="",quoted=false;
  const s=String(text||"").replace(/^\uFEFF/,"");
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(c==='"'){
      if(quoted && n==='"'){ value+='"'; i++; }
      else quoted=!quoted;
    }else if(c===',' && !quoted){ row.push(value); value=""; }
    else if((c==='\n'||c==='\r') && !quoted){
      if(c==='\r' && n==='\n') i++;
      row.push(value); rows.push(row); row=[]; value="";
    }else value+=c;
  }
  row.push(value); rows.push(row);
  return rows.filter(r=>r.some(v=>String(v||"").trim()!==""));
}
function compact(v){ return String(v||"").toLowerCase().replace(/[\s_\-()\[\].:\/\\]+/g,"").replace(/[^a-z0-9ก-๙]/g,"").trim(); }
function idx(headers,names,fallback=-1){
  const wanted=names.map(compact);
  for(let i=0;i<headers.length;i++) if(wanted.includes(compact(headers[i]))) return i;
  return fallback;
}
function table(csv){ const rows=parseCsv(csv); return {headers:rows[0]||[],rows:rows.slice(1)}; }
function cell(row,i){ return i>=0 && i<row.length ? row[i] : ""; }
function num(v){ const n=Number(String(v??"").replace(/,/g,"").trim()); return Number.isFinite(n)?n:0; }
function normalizePhone(v){ return String(v||"").replace(/\D+/g,""); }
function customerKey(row,ix){
  const phone=normalizePhone(cell(row,ix.phone)); if(phone) return "phone:"+phone;
  const rawKey=String(cell(row,ix.customerKey)||"").trim().toLowerCase();
  if(/^(phone|contact|name):/.test(rawKey)) return rawKey.replace(/\s+/g," ");
  const name=String(cell(row,ix.name)||"").trim().toLowerCase().replace(/\s+/g," ");
  return name ? "name:"+name : (rawKey ? "legacy:"+rawKey : "");
}
function eventMonth(v){
  const s=String(v||"").trim();
  let m=s.match(/^(\d{4})[-\/]?(\d{1,2})/); if(m) return `${m[1]}-${String(Number(m[2])).padStart(2,"0")}`;
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if(m){ let y=Number(m[3]); if(y>2500)y-=543; return `${y}-${String(Number(m[2])).padStart(2,"0")}`; }
  const d=new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function parseExplicitAffiliation(note){
  const s=String(note||"").trim(); if(!s) return "";
  const patterns=[/(?:^|[;|\n])\s*(?:talent_affiliation|artist_agency|artist_label|affiliation|สังกัดศิลปิน|สังกัดนักแสดง|สังกัด|ค่ายศิลปิน)\s*[:=]\s*([^;|\n]+)/i];
  for(const re of patterns){ const m=s.match(re); if(m&&m[1]) return m[1].trim(); }
  return "";
}
const AFFILIATION_RULES=[
  {name:"GMMTV",patterns:[/\bPOND\s*PHUWIN\b/i,/\bJOSS\s*GAWIN\b/i,/\bSKY\s*NANI\b/i,/\bOH\s*MY\s*FOURTH\b/i,/\bJUNIOR\s*MARK\b/i,/\bPERTH\s*SANTA\b/i,/\bGEMINI\b/i,/\bWINNY\s*SATANG\b/i,/\bSOTUS\b/i,/MR\.?KILL/i,/CLASS\s*CRUSH\s*CRISIS/i,/\bNANON\b/i,/(?:^|\W)AOU(?:\W|$)/i,/\bLYKN\b/i]},
  {name:"Domundi / Mandee",patterns:[/\bDMD\b/i,/\bDOMUNDI\b/i,/\bFIRSTONE\b/i,/\bNUNEW\b/i,/\bZEE\s*NUNEW\b/i,/\bKENG\b.*\bNAMPING\b/i]},
  {name:"SM Entertainment",patterns:[/\bNCT\b/i,/\bJNJM\b/i,/\bJENO\b.*\bJAEMIN\b/i,/\bU-KNOW\b/i,/\bSUPER\s*JUNIOR\b/i]},
  {name:"YG Entertainment",patterns:[/\bBIGBANG\b/i,/\bBABYMONSTER\b/i,/\bBLACKPINK\b/i]},
  {name:"G’NEST / GMM MUSIC",patterns:[/\bPERSES\b/i]},
  {name:"GMM Grammy / Genie Records",patterns:[/\bBIG\s*ASS\b/i]},
  {name:"LOVEiS Entertainment",patterns:[/\bNONT\s*TANONT\b/i,/THE\s*MOMENT\s*OF\s*SPECTACLE/i]},
  {name:"BOXX MUSIC",patterns:[/INK\s*WARUNTORN/i,/SYNTHPHONY/i]},
  {name:"4NOLOGUE",patterns:[/\bTRINITY\b/i]},
  {name:"XOXO Entertainment",patterns:[/\bATLAS\b/i,/\b4EVE\b/i]},
  {name:"Me Mind Y",patterns:[/FORT\s*PEAT/i,/FORTPEAT/i]},
  {name:"BIGHIT MUSIC / HYBE",patterns:[/\bBTS\b/i]},
  {name:"HYBE LABELS JAPAN",patterns:[/&TEAM/i,/\bANDTEAM\b/i]},
  {name:"PLEDIS Entertainment / HYBE",patterns:[/\bTWS\b/i]},
  {name:"JYP Entertainment",patterns:[/\bYOUNG\s*K\b/i,/\bDAY6\b/i]},
  {name:"F&F Entertainment",patterns:[/\bAHOF\b/i]}
];
function inferAffiliation(name){
  const text=String(name||"");
  for(const rule of AFFILIATION_RULES) if(rule.patterns.some(re=>re.test(text))) return rule.name;
  return "";
}
function registryAffiliationRules(csv){
  if(!csv) return [];
  const t=table(csv),h=t.headers;
  const ix={artist:idx(h,["Artist / Pair","artist"],0),thai:idx(h,["Thai Alias"],1),eng:idx(h,["English Alias"],2),other:idx(h,["Other-language Alias"],3),aff:idx(h,["Label / Agency","labelagency"],4)};
  const out=[];
  for(const r of t.rows){
    const aff=String(cell(r,ix.aff)||"").trim(); if(!aff) continue;
    const aliases=[cell(r,ix.artist),cell(r,ix.thai),cell(r,ix.eng),cell(r,ix.other)].flatMap(v=>String(v||"").split(/\s*\/\s*/)).map(x=>x.trim()).filter(x=>x.length>=3 && !/priority artists?/i.test(x));
    if(aliases.length) out.push({affiliation:aff,aliases});
  }
  return out;
}
function inferFromRegistry(name,rules){
  const text=String(name||"").toLowerCase();
  for(const r of rules||[]){
    if(r.aliases.some(a=>text.includes(String(a).toLowerCase()))) return r.affiliation;
  }
  return "";
}
function eventMetadata(currentCsv,archiveCsv,registryRules){
  const map={};
  // Archive is fallback metadata; live Current must win for restored/reopened events.
  for(const [source,csv] of [["archive",archiveCsv],["current",currentCsv]]){
    const t=table(csv),h=t.headers;
    const ix={id:idx(h,["event_id"],source==="archive"?2:0),name:idx(h,["event_name"],source==="archive"?3:1),date:idx(h,["event_date","event_date_text"],-1),note:idx(h,["event_note","note"],source==="archive"?9:7),affiliation:idx(h,["talent_affiliation","artist_agency","artist_label","affiliation"],-1)};
    for(const r of t.rows){
      const id=String(cell(r,ix.id)||"").trim(); if(!id) continue;
      const name=String(cell(r,ix.name)||id).trim();
      const colAff=ix.affiliation>=0 ? String(cell(r,ix.affiliation)||"").trim() : "";
      const noteAff=parseExplicitAffiliation(cell(r,ix.note));
      const explicit=colAff||noteAff;
      const registry=explicit?"":inferFromRegistry(name,registryRules);
      const inferred=(explicit||registry)?"":inferAffiliation(name);
      map[id]={event_name:name,event_date:ix.date>=0?String(cell(r,ix.date)||"").trim():"",affiliation:explicit||registry||inferred||"ยังไม่ระบุ / Unknown",affiliation_source:explicit?"explicit":(registry?"artist_registry":(inferred?"inferred":"unknown"))};
    }
  }
  return map;
}
function parseHelper(csv,eventMap,registryRules){
  const t=table(csv),h=t.headers;
  const ix={source:idx(h,["source"],0),booking:idx(h,["bookingid","booking_id"],1),created:idx(h,["createdat","created_at"],2),status:idx(h,["bookingstatus","booking_status"],3),event:idx(h,["eventid","event_id"],4),eventName:idx(h,["eventname","event_name"],5),eventDate:idx(h,["eventdate","event_date"],6),customerKey:idx(h,["customerkey","customer_key"],7),name:idx(h,["customername","customer_name"],8),phone:idx(h,["phone","customerphone","customer_phone"],9),channel:idx(h,["channel","contactchannel","contact_channel"],10),pkg:idx(h,["packagetype","package_type"],11),payment:idx(h,["paymentstatus","payment_status"],12),amount:idx(h,["amountreceived","amount_received"],13),month:idx(h,["eventmonth","event_month"],14)};
  return t.rows.map(r=>{
    const eventId=String(cell(r,ix.event)||"").trim();
    const meta=eventMap[eventId]||{};
    const eventName=String(cell(r,ix.eventName)||meta.event_name||eventId).trim();
    const resolvedEventDate=String(cell(r,ix.eventDate)||meta.event_date||"").trim();
    const fallback=meta.affiliation&&meta.affiliation!=="ยังไม่ระบุ / Unknown" ? meta.affiliation : (inferFromRegistry(eventName,registryRules)||inferAffiliation(eventName));
    return {
      source:String(cell(r,ix.source)||"").trim(),booking_id:String(cell(r,ix.booking)||"").trim(),created_at:String(cell(r,ix.created)||"").trim(),
      status:String(cell(r,ix.status)||"").toLowerCase().trim(),event_id:eventId,event_name:eventName,event_date:resolvedEventDate,month:String(cell(r,ix.month)||"").trim()||eventMonth(resolvedEventDate),
      customer_key:customerKey(r,ix),package_type:String(cell(r,ix.pkg)||"").trim()||"unknown",payment_status:String(cell(r,ix.payment)||"").toLowerCase().trim(),amount_received:num(cell(r,ix.amount)),
      affiliation:meta.affiliation&&meta.affiliation!=="ยังไม่ระบุ / Unknown"?meta.affiliation:(fallback||"ยังไม่ระบุ / Unknown"),affiliation_source:meta.affiliation_source&&meta.affiliation_source!=="unknown"?meta.affiliation_source:(fallback?"inferred":"unknown")
    };
  }).filter(r=>r.booking_id||r.event_id||r.customer_key);
}
function aggregate(rows){
  const seen=new Set(),clean=[];
  for(const r of rows){
    // Deduplicate the same booking across current/archive projections. Do not
    // dedupe on booking_id alone because historical formula IDs were not globally
    // immutable and can legitimately collide across different events/customers.
    const key=[r.booking_id,r.event_id,r.event_date,r.customer_key,r.created_at,r.status].join("|");
    if(seen.has(key))continue;seen.add(key);clean.push(r);
  }
  const activeSet=new Set(["pending","confirmed","prepared","picked_up","returned","uploaded"]);
  // Reporting policy is fail-closed: only completed + active workflow states
  // participate in customer/booking/revenue metrics. cancelled, no_show, blank
  // and unknown statuses stay visible in status_mix but never inflate KPIs.
  const reportableSet=new Set(["completed",...activeSet]);
  const non=clean.filter(r=>reportableSet.has(r.status));
  const customers={},months={},events={},packages={},statuses={},affiliations={};
  let actualRevenue=0,futureRevenue=0,completed=0,active=0,affKnown=0,affUnknown=0;
  for(const r of non){
    const amount=r.amount_received||0;
    const actualAmount=r.status==="completed"?amount:0;
    const futureAmount=activeSet.has(r.status)?(CanonicalQuote.positiveAmount(r.package_price)||amount):0;
    const forecastAmount=actualAmount+futureAmount;
    actualRevenue+=actualAmount;
    futureRevenue+=futureAmount;
    if(r.status==="completed")completed++;
    if(activeSet.has(r.status))active++;
    if(r.customer_key)customers[r.customer_key]=(customers[r.customer_key]||0)+1;

    const mo=r.month||eventMonth(r.event_date);
    if(mo){
      months[mo]||={month:mo,customers:new Set(),bookings:0,completed:0,actual_revenue:0,future_revenue:0,forecast_revenue:0};
      const x=months[mo];
      x.bookings++;
      x.actual_revenue+=actualAmount;
      x.future_revenue+=futureAmount;
      x.forecast_revenue+=forecastAmount;
      if(r.status==="completed")x.completed++;
      if(r.customer_key)x.customers.add(r.customer_key);
    }

    const evKey=r.event_name||r.event_id||"Unknown";
    events[evKey]||={event_name:evKey,affiliation:r.affiliation,customers:new Set(),bookings:0,actual_revenue:0,future_revenue:0,forecast_revenue:0};
    const ev=events[evKey];
    ev.bookings++;
    ev.actual_revenue+=actualAmount;
    ev.future_revenue+=futureAmount;
    ev.forecast_revenue+=forecastAmount;
    if(r.customer_key)ev.customers.add(r.customer_key);
    if(ev.affiliation==="ยังไม่ระบุ / Unknown"&&r.affiliation!=="ยังไม่ระบุ / Unknown")ev.affiliation=r.affiliation;

    packages[r.package_type]=(packages[r.package_type]||0)+1;
    const aff=r.affiliation||"ยังไม่ระบุ / Unknown";
    affiliations[aff]||={affiliation:aff,customers:new Set(),events:new Set(),bookings:0,actual_revenue:0,future_revenue:0,forecast_revenue:0,explicit:0,artist_registry:0,inferred:0,unknown:0};
    const a=affiliations[aff];
    a.bookings++;
    a.actual_revenue+=actualAmount;
    a.future_revenue+=futureAmount;
    a.forecast_revenue+=forecastAmount;
    if(r.customer_key)a.customers.add(r.customer_key);
    if(r.event_id||r.event_name)a.events.add(r.event_id||r.event_name);
    a[r.affiliation_source||"unknown"]=(a[r.affiliation_source||"unknown"]||0)+1;
    if(aff==="ยังไม่ระบุ / Unknown")affUnknown++;else affKnown++;
  }
  for(const r of clean){const s=r.status||"blank";statuses[s]=(statuses[s]||0)+1;}
  const unique=Object.keys(customers).length,repeat=Object.values(customers).filter(n=>n>=2).length;
  const forecastRevenue=actualRevenue+futureRevenue;
  const monthly=Object.values(months).map(x=>({
    month:x.month,customers:x.customers.size,bookings:x.bookings,completed:x.completed,
    actual_revenue:x.actual_revenue,future_revenue:x.future_revenue,forecast_revenue:x.forecast_revenue,
    amount_received:x.forecast_revenue
  })).sort((a,b)=>a.month.localeCompare(b.month));
  const peak=[...monthly].sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings)[0]||null;
  const topEvents=Object.values(events).map(x=>({
    event_name:x.event_name,affiliation:x.affiliation,customers:x.customers.size,bookings:x.bookings,
    actual_revenue:x.actual_revenue,future_revenue:x.future_revenue,forecast_revenue:x.forecast_revenue,
    amount_received:x.forecast_revenue
  })).sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings||b.forecast_revenue-a.forecast_revenue).slice(0,30);
  const packageMix=Object.entries(packages).map(([package_type,bookings])=>({package_type,bookings})).sort((a,b)=>b.bookings-a.bookings);
  const statusMix=Object.entries(statuses).map(([status,bookings])=>({status,bookings})).sort((a,b)=>b.bookings-a.bookings);
  const affiliationMix=Object.values(affiliations).map(a=>({
    affiliation:a.affiliation,customers:a.customers.size,bookings:a.bookings,events:a.events.size,
    actual_revenue:a.actual_revenue,future_revenue:a.future_revenue,forecast_revenue:a.forecast_revenue,
    amount_received:a.forecast_revenue,
    explicit:a.explicit||0,artist_registry:a.artist_registry||0,inferred:a.inferred||0,unknown:a.unknown||0,
    mapping_summary:a.affiliation==="ยังไม่ระบุ / Unknown"?"ยังระบุสังกัดไม่ได้":`explicit ${a.explicit||0} · registry ${a.artist_registry||0} · inferred ${a.inferred||0}`
  })).sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings||b.events-a.events);
  const topAffiliation=affiliationMix.find(a=>a.affiliation!=="ยังไม่ระบุ / Unknown")||null;
  const dates=monthly.map(x=>x.month);
  return {generated_at:new Date().toISOString(),metrics:{
    unique_customers:unique,
    non_cancelled_bookings:non.length,
    reportable_bookings:non.length,
    completed_bookings:completed,
    active_bookings:active,
    repeat_customers:repeat,
    avg_bookings_per_customer:unique?non.length/unique:0,
    repeat_customer_rate:unique?repeat/unique:0,
    actual_revenue:actualRevenue,
    future_revenue:futureRevenue,
    forecast_revenue:forecastRevenue,
    amount_received:forecastRevenue,
    cancellation_rate:clean.length?clean.filter(r=>r.status==="cancelled").length/clean.length:0,
    affiliation_coverage_rate:non.length?affKnown/non.length:0,
    affiliation_known_bookings:affKnown,
    affiliation_unknown_bookings:affUnknown
  },peak_month:peak,top_event:topEvents[0]||null,top_affiliation:topAffiliation,monthly,top_events:topEvents,affiliation_mix:affiliationMix,package_mix:packageMix,status_mix:statusMix,range:{start:dates[0]||"",end:dates[dates.length-1]||""},definitions:[
    "Rental Analytics เป็น READ ONLY: ไม่เขียนกลับ Booking / Event / Asset / Package / ราคา",
    "ค่าย/สังกัดใช้สังกัดของนักแสดงหรือศิลปินเป็นหลัก ไม่ใช่บริษัทผู้จัดงาน: GMMTV cast => GMMTV, Domundi talent => Domundi / Mandee, NCT => SM Entertainment เป็นต้น",
    "ลำดับข้อมูลสังกัด: explicit talent-affiliation field/note → _Artist_Registry (เมื่ออ่านได้) → conservative event-name mapping → Unknown. Event promoter/organizer ไม่ override สังกัดศิลปิน",
    `Affiliation Coverage ตอนนี้ ${non.length?((affKnown/non.length)*100).toFixed(1):"0.0"}% ของ booking ที่นับในรายงาน; Unknown ${affUnknown} คิว`,
    "Top Affiliation เรียงจากลูกค้าไม่ซ้ำ → Booking → จำนวนงาน เพื่อใช้ตัดสินใจว่าจะโฟกัสค่ายใดเป็นพิเศษ",
    "รายรับจริง = SUM(amount_received) เฉพาะ booking ที่ status=completed",
    "รายรับในอนาคต = SUM(amount_received) เฉพาะ booking ที่ยัง Active: pending / confirmed / prepared / picked_up / returned / uploaded",
    "คาดการณ์รายรับรวม = รายรับจริง + รายรับในอนาคต; cancelled / no_show / สถานะว่างไม่ถูกนับ และ booking หนึ่งรายการอยู่ได้เพียง bucket เดียว",
    "metrics.amount_received คงไว้เป็น compatibility alias ของ forecast_revenue; UI ไม่แสดง field นี้ว่าเป็นยอดรับจริงอีก",
    "API response ไม่ส่งชื่อ เบอร์โทร หรือ contact ลูกค้ารายบุคคลกลับ browser"
  ]};
}
module.exports=async function handler(req,res){
  if(req.method==="OPTIONS") return json(res,204,{});
  if(req.method!=="POST") return json(res,405,{ok:false,error:"Method not allowed"});
  const expected=String(process.env.KK_ADMIN_PIN||"").trim();
  const provided=String(req.headers["x-admin-pin"]||"").trim();
  if(!expected) return json(res,500,{ok:false,error:"KK_ADMIN_PIN is not configured"});
  if(!AdminSecurity.isAuthorizedRequest(req) && provided!==expected) return json(res,401,{ok:false,error:"Invalid admin PIN"});
  const sheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_SHEET_ID).trim();
  const trackerId=String(process.env.KK_EVENT_TRACKER_SHEET_ID||"1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo").trim();
  try{
    const [helperCsv,currentEventsCsv,archiveEventsCsv,registryResult,privateMaster]=await Promise.all([
      fetchCsv(sheetId,"_Rental_Dashboard_Data","A1:O"),
      fetchCsv(sheetId,"01_Events","A4:Z"),
      fetchCsv(sheetId,"13_Event_Archive","A1:Z"),
      fetchCsv(trackerId,"_Artist_Registry","A1:E").then(x=>({ok:true,csv:x})).catch(()=>({ok:false,csv:""})),
      CanonicalQuote.readPrivateMaster(sheetId,process.env)
    ]);
    const registryRules=registryAffiliationRules(registryResult.csv);
    const meta=eventMetadata(currentEventsCsv,archiveEventsCsv,registryRules);
    const rows=CanonicalQuote.attachQuotes(parseHelper(helperCsv,meta,registryRules),CanonicalQuote.bookingQuoteMap(privateMaster.csv));
    const data=aggregate(rows);
    data.revenue_quote_source=privateMaster.status;
    return json(res,200,{ok:true,data});
  }catch(err){
    if(String(process.env[CanonicalQuote.FLAG]||'').trim()==='1'&&String(err&&err.code||'').startsWith('CORE_QUOTE_'))
      return json(res,503,{ok:false,error:'Canonical private quote reader unavailable',error_code:'CORE_QUOTE_PRIVATE_READ_FAILED'});
    const msg=err&&err.name==="AbortError"?"Google Sheet analytics timeout":(err&&err.message?err.message:String(err));
    return json(res,500,{ok:false,error:msg});
  }
};


module.exports._test={eventMetadata,parseHelper,aggregate,eventMonth};
