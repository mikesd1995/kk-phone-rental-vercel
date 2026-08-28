// KK Phone Rental — Rental Analytics v3 (READ ONLY, isolated from public and admin write APIs)
// Reads aggregate-helper/event metadata through Google Sheets gviz. Returns aggregate metrics only; no PII leaves this endpoint.
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

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
function parseExplicitOrganizer(note){
  const s=String(note||"").trim(); if(!s) return "";
  const patterns=[/(?:^|[;|\n])\s*(?:organizer|promoter|agency|label|ผู้จัด|ค่าย)\s*[:=]\s*([^;|\n]+)/i];
  for(const re of patterns){ const m=s.match(re); if(m&&m[1]) return m[1].trim(); }
  return "";
}
const ORGANIZER_RULES=[
  {name:"GMMTV", patterns:[/\bPOND\s*PHUWIN\b/i,/\bJOSS\s*GAWIN\b/i,/\bSKY\s*NANI\b/i,/\bOH\s*MY\s*FOURTH\b/i,/\bJUNIOR\s*MARK\b/i,/\bPERTH\s*SANTA\b/i,/\bGEMINI\b/i,/\bWINNY\s*SATANG\b/i,/\bLYKN\b/i]},
  {name:"DOMUNDI / DMD", patterns:[/\bDMD\b/i,/\bNUNEW\b/i,/\bZEE\s*NUNEW\b/i]},
  {name:"SONRAY MUSIC", patterns:[/(?:^|\W)BUS(?:\W|$)/i,/LIGHT\s*AS\s*ONE/i]},
  {name:"XOXO Entertainment", patterns:[/\b4EVE\b/i]},
  {name:"Me Mind Y", patterns:[/FORT\s*PEAT/i,/FORTPEAT/i]},
  {name:"BIGHIT MUSIC / HYBE", patterns:[/\bBTS\b/i]},
  {name:"HYBE LABELS JAPAN", patterns:[/&TEAM/i,/\bANDTEAM\b/i]},
  {name:"SM Entertainment", patterns:[/\bNCT\b/i,/(?:^|\W)TEN(?:\W|$)/i]},
  {name:"GMM SHOW", patterns:[/\bGFEST\b/i]}
];
function inferOrganizer(name){
  const text=String(name||"");
  for(const rule of ORGANIZER_RULES) if(rule.patterns.some(re=>re.test(text))) return rule.name;
  return "";
}
function eventMetadata(currentCsv,archiveCsv){
  const map={};
  for(const [source,csv] of [["current",currentCsv],["archive",archiveCsv]]){
    const t=table(csv),h=t.headers;
    const ix={id:idx(h,["event_id"],source==="archive"?2:0),name:idx(h,["event_name"],source==="archive"?3:1),note:idx(h,["event_note","note"],source==="archive"?9:7),organizer:idx(h,["organizer","agency","label","promoter"],-1)};
    for(const r of t.rows){
      const id=String(cell(r,ix.id)||"").trim(); if(!id) continue;
      const name=String(cell(r,ix.name)||id).trim();
      const colOrg=ix.organizer>=0 ? String(cell(r,ix.organizer)||"").trim() : "";
      const noteOrg=parseExplicitOrganizer(cell(r,ix.note));
      const explicit=colOrg||noteOrg;
      const inferred=explicit?"":inferOrganizer(name);
      map[id]={event_name:name,organizer:explicit||inferred||"ยังไม่ระบุ / Unknown",organizer_source:explicit?"explicit":(inferred?"inferred":"unknown")};
    }
  }
  return map;
}
function parseHelper(csv,eventMap){
  const t=table(csv),h=t.headers;
  const ix={source:idx(h,["source"],0),booking:idx(h,["bookingid","booking_id"],1),created:idx(h,["createdat","created_at"],2),status:idx(h,["bookingstatus","booking_status"],3),event:idx(h,["eventid","event_id"],4),eventName:idx(h,["eventname","event_name"],5),eventDate:idx(h,["eventdate","event_date"],6),customerKey:idx(h,["customerkey","customer_key"],7),name:idx(h,["customername","customer_name"],8),phone:idx(h,["phone","customerphone","customer_phone"],9),channel:idx(h,["channel","contactchannel","contact_channel"],10),pkg:idx(h,["packagetype","package_type"],11),payment:idx(h,["paymentstatus","payment_status"],12),amount:idx(h,["amountreceived","amount_received"],13),month:idx(h,["eventmonth","event_month"],14)};
  return t.rows.map(r=>{
    const eventId=String(cell(r,ix.event)||"").trim();
    const meta=eventMap[eventId]||{};
    const eventName=String(cell(r,ix.eventName)||meta.event_name||eventId).trim();
    const inferredFallback=meta.organizer&&meta.organizer!=="ยังไม่ระบุ / Unknown" ? meta.organizer : inferOrganizer(eventName);
    return {
      source:String(cell(r,ix.source)||"").trim(), booking_id:String(cell(r,ix.booking)||"").trim(), created_at:String(cell(r,ix.created)||"").trim(),
      status:String(cell(r,ix.status)||"").toLowerCase().trim(), event_id:eventId, event_name:eventName,
      event_date:String(cell(r,ix.eventDate)||"").trim(), month:String(cell(r,ix.month)||"").trim()||eventMonth(cell(r,ix.eventDate)),
      customer_key:customerKey(r,ix), package_type:String(cell(r,ix.pkg)||"").trim()||"unknown", payment_status:String(cell(r,ix.payment)||"").toLowerCase().trim(),
      amount_received:num(cell(r,ix.amount)), organizer:meta.organizer&&meta.organizer!=="ยังไม่ระบุ / Unknown"?meta.organizer:(inferredFallback||"ยังไม่ระบุ / Unknown"),
      organizer_source:meta.organizer_source&&meta.organizer_source!=="unknown"?meta.organizer_source:(inferredFallback?"inferred":"unknown")
    };
  }).filter(r=>r.booking_id||r.event_id||r.customer_key);
}
function aggregate(rows){
  // booking_id is not globally unique in historical data, so dedupe only exact logical duplicates.
  const seen=new Set(),clean=[];
  for(const r of rows){
    const key=[r.source,r.booking_id,r.event_id,r.event_date,r.customer_key,r.created_at,r.status].join("|");
    if(seen.has(key)) continue; seen.add(key); clean.push(r);
  }
  const non=clean.filter(r=>r.status!=="cancelled");
  const customers={},months={},events={},packages={},statuses={},organizers={};
  let received=0,completed=0,active=0,orgKnown=0,orgUnknown=0;
  const activeSet=new Set(["pending","confirmed","prepared","picked_up","returned","uploaded"]);
  for(const r of non){
    received+=r.amount_received||0; if(r.status==="completed") completed++; if(activeSet.has(r.status)) active++;
    if(r.customer_key) customers[r.customer_key]=(customers[r.customer_key]||0)+1;
    const mo=r.month||eventMonth(r.event_date);
    if(mo){ months[mo]||={month:mo,customers:new Set(),bookings:0,completed:0,amount_received:0}; const x=months[mo]; x.bookings++; x.amount_received+=r.amount_received||0; if(r.status==="completed")x.completed++; if(r.customer_key)x.customers.add(r.customer_key); }
    const evKey=r.event_name||r.event_id||"Unknown"; events[evKey]||={event_name:evKey,organizer:r.organizer,customers:new Set(),bookings:0,amount_received:0}; const ev=events[evKey]; ev.bookings++; ev.amount_received+=r.amount_received||0; if(r.customer_key)ev.customers.add(r.customer_key); if(ev.organizer==="ยังไม่ระบุ / Unknown" && r.organizer!=="ยังไม่ระบุ / Unknown")ev.organizer=r.organizer;
    packages[r.package_type]=(packages[r.package_type]||0)+1;
    const org=r.organizer||"ยังไม่ระบุ / Unknown"; organizers[org]||={organizer:org,customers:new Set(),events:new Set(),bookings:0,amount_received:0,explicit:0,inferred:0,unknown:0}; const o=organizers[org]; o.bookings++; o.amount_received+=r.amount_received||0; if(r.customer_key)o.customers.add(r.customer_key); if(r.event_id||r.event_name)o.events.add(r.event_id||r.event_name); o[r.organizer_source||"unknown"]=(o[r.organizer_source||"unknown"]||0)+1; if(org==="ยังไม่ระบุ / Unknown")orgUnknown++; else orgKnown++;
  }
  for(const r of clean){ const s=r.status||"blank"; statuses[s]=(statuses[s]||0)+1; }
  const unique=Object.keys(customers).length,repeat=Object.values(customers).filter(n=>n>=2).length;
  const monthly=Object.values(months).map(x=>({month:x.month,customers:x.customers.size,bookings:x.bookings,completed:x.completed,amount_received:x.amount_received})).sort((a,b)=>a.month.localeCompare(b.month));
  const peak=[...monthly].sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings)[0]||null;
  const topEvents=Object.values(events).map(x=>({event_name:x.event_name,organizer:x.organizer,customers:x.customers.size,bookings:x.bookings,amount_received:x.amount_received})).sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings||b.amount_received-a.amount_received).slice(0,30);
  const packageMix=Object.entries(packages).map(([package_type,bookings])=>({package_type,bookings})).sort((a,b)=>b.bookings-a.bookings);
  const statusMix=Object.entries(statuses).map(([status,bookings])=>({status,bookings})).sort((a,b)=>b.bookings-a.bookings);
  const organizerMix=Object.values(organizers).map(o=>({organizer:o.organizer,customers:o.customers.size,bookings:o.bookings,events:o.events.size,amount_received:o.amount_received,explicit:o.explicit||0,inferred:o.inferred||0,unknown:o.unknown||0,mapping_summary:o.organizer==="ยังไม่ระบุ / Unknown"?"ต้องระบุผู้จัดเพิ่ม":`explicit ${o.explicit||0} · inferred ${o.inferred||0}`})).sort((a,b)=>b.customers-a.customers||b.bookings-a.bookings||b.events-a.events);
  const topOrganizer=organizerMix.find(o=>o.organizer!=="ยังไม่ระบุ / Unknown")||null;
  const dates=monthly.map(x=>x.month);
  return {
    generated_at:new Date().toISOString(),
    metrics:{unique_customers:unique,non_cancelled_bookings:non.length,completed_bookings:completed,active_bookings:active,repeat_customers:repeat,avg_bookings_per_customer:unique?non.length/unique:0,repeat_customer_rate:unique?repeat/unique:0,amount_received:received,cancellation_rate:clean.length?clean.filter(r=>r.status==="cancelled").length/clean.length:0,organizer_coverage_rate:non.length?orgKnown/non.length:0,organizer_known_bookings:orgKnown,organizer_unknown_bookings:orgUnknown},
    peak_month:peak,top_event:topEvents[0]||null,top_organizer:topOrganizer,monthly,top_events:topEvents,organizer_mix:organizerMix,package_mix:packageMix,status_mix:statusMix,range:{start:dates[0]||"",end:dates[dates.length-1]||""},
    definitions:[
      "Rental Analytics เป็น READ ONLY: endpoint อ่านข้อมูลเพื่อคำนวณเท่านั้น ไม่เขียนกลับ Booking / Event / Asset / Package / ราคา",
      "รวม Current + Booking Archive จาก _Rental_Dashboard_Data และตัด cancelled ออกจาก KPI หลัก; Status Mix ยังเก็บ cancelled เพื่อดู Cancellation Rate",
      "ลูกค้า canonicalize ด้วยเบอร์โทรก่อน แล้วใช้ customer key/ชื่อเมื่อไม่มีเบอร์ เพื่อไม่ให้นับลูกค้าคนเดียวซ้ำระหว่าง Current กับ Archive",
      "booking_id ในข้อมูลเก่าไม่ globally unique จึง dedupe เฉพาะ logical row ที่ซ้ำครบ ไม่ทิ้งคนละงานที่บังเอิญใช้ booking_id เดียวกัน",
      "ค่าย/ผู้จัดใช้ลำดับความน่าเชื่อถือ: organizer/agency/label column (ถ้ามีในอนาคต) → tag ใน Event Note เช่น organizer: / ผู้จัด: / ค่าย: → conservative inference จากชื่องาน → Unknown",
      `Organizer Coverage ตอนนี้ ${non.length?((orgKnown/non.length)*100).toFixed(1):"0.0"}% ของ booking ที่ไม่ยกเลิก; Unknown ${orgUnknown} คิว จึงไม่ควรตีความ Top Organizer ว่าเป็น market share 100% จน coverage สูงขึ้น`,
      "Top Organizer เรียงจากจำนวนลูกค้าไม่ซ้ำก่อน ตามด้วยจำนวน Booking และจำนวนงาน เพื่อใช้ตัดสินใจว่าจะโฟกัสค่าย/ผู้จัดใดเป็นพิเศษ",
      "ยอดรับแล้ว = SUM(amount_received) จากหลังบ้าน ไม่ใช่รายได้ทางบัญชี และ API response ไม่ส่งชื่อ เบอร์โทร หรือ contact ลูกค้ารายบุคคลกลับ browser"
    ]
  };
}
module.exports=async function handler(req,res){
  if(req.method==="OPTIONS") return json(res,204,{});
  if(req.method!=="POST") return json(res,405,{ok:false,error:"Method not allowed"});
  const expected=String(process.env.KK_ADMIN_PIN||"").trim();
  const provided=String(req.headers["x-admin-pin"]||"").trim();
  if(!expected) return json(res,500,{ok:false,error:"KK_ADMIN_PIN is not configured"});
  if(provided!==expected) return json(res,401,{ok:false,error:"Invalid admin PIN"});
  const sheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_SHEET_ID).trim();
  try{
    const [helperCsv,currentEventsCsv,archiveEventsCsv]=await Promise.all([
      fetchCsv(sheetId,"_Rental_Dashboard_Data","A1:O2500"),
      fetchCsv(sheetId,"01_Events","A4:Z1000"),
      fetchCsv(sheetId,"13_Event_Archive","A1:Z1000")
    ]);
    const meta=eventMetadata(currentEventsCsv,archiveEventsCsv);
    const rows=parseHelper(helperCsv,meta);
    return json(res,200,{ok:true,data:aggregate(rows)});
  }catch(err){
    const msg=err&&err.name==="AbortError"?"Google Sheet analytics timeout":(err&&err.message?err.message:String(err));
    return json(res,500,{ok:false,error:msg});
  }
};
