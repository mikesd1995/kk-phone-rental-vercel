// KK Phone Rental Frontend v15.3 AUDITED OPTIMIZED — optimized from user's frontend and aligned with Backend v14.4 Bulletproof
// Backend contract:
// - 08_Web_Ready!A4:K = event-level output
// - 09_Web_Packages!A4:N = package-level output, including M raw_available_count and N use_case
// Improvements:
// - Vercel API proxy with direct Google Sheets fallback
// - Safer package mapping so raw_available_count is not mistaken for pkg_active
// - Availability uses package_status + available_count, with raw negative protection
// - Keeps existing v13.5 compact modal and 2-column card UX

var APP       = window.KK_CONFIG || {};
var DEFAULT_TITLE = "KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์";
var DEFAULT_DESCRIPTION = "KK Phone Rental บริการเช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และอีเวนต์ ซูมชัด เก็บครบทุกโมเมนต์ เลือกงาน ดูรุ่นที่ว่าง และจองผ่าน LINE OA กับแอดมิน";
var DEFAULT_OG_IMAGE = APP.headerImage || "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600";
var SHEET_ID  = APP.sheetId      || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var WEB_SHEET = APP.webSheetName || "08_Web_Ready";
var WEB_RANGE = APP.webRange     || "A4:K";
var PKG_SHEET = APP.pkgSheetName || "09_Web_Packages";
var PKG_RANGE = APP.pkgRange     || "A4:N"; // v15.3: M raw_available_count, N use_case from backend
var LINE_URL  = APP.lineDirectUrl|| "https://line.me/R/ti/p/%40827blnmo";
var LINE_OA_ID = APP.lineOAId || "@827blnmo";
var LINE_OA   = "https://line.me/R/oaMessage/" + encodeURIComponent(LINE_OA_ID) + "/?";
var API_ENDPOINT = APP.apiEndpoint || "/api/kk-data";
var USE_API = APP.useVercelApi !== false && typeof window !== "undefined" && window.location.protocol !== "file:" && (new URLSearchParams(window.location.search)).get("direct") !== "1";

var concertsData  = [];
var TODAY_TS = (function(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
var URL_PARAMS = new URLSearchParams(window.location.search);
var DEBUG_MODE = URL_PARAMS.get("debug")==="1";
var SHOW_PAST  = URL_PARAMS.get("showPast")==="1";
var REQUESTED_EVENT = String(URL_PARAMS.get("event") || URL_PARAMS.get("e") || "").trim();
var REQUESTED_FILTER = String(URL_PARAMS.get("filter") || "all").trim().toLowerCase();
var currentFilter = ["all","available","full","soon"].indexOf(REQUESTED_FILTER)>=0 ? REQUESTED_FILTER : "all";
var PRELOADED_IMAGES = {};

// ─── Helpers ─────────────────────────────────────────────────────────────
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function toNum(v){ var n=Number(String(v||"").replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }
function hasVal(v){ return v!==undefined && v!==null && String(v).trim()!==""; }
function toBool(v){ if(v===true||v===1)return true; var s=String(v||"").trim().toUpperCase(); return s==="TRUE"||s==="YES"||s==="1"||s==="ว่าง"||s==="OPEN"||s==="SHOW"; }
function fmtPrice(n){ n=toNum(n); return n>0?n.toLocaleString("th-TH")+" บาท/วัน":"ไม่ระบุ"; }
function fmtPriceLine(n){ n=toNum(n); return n>0?n.toLocaleString("th-TH")+" บาท":"ไม่ระบุ"; }
function lineVal(v){ var s=String(v||"").replace(/\s+/g," ").trim(); return s||"-"; }

// Header-safe row utilities: Google Sheets CSV may export Thai headers with line breaks.
function compactKey(k){
  return String(k||"")
    .toLowerCase()
    .replace(/[\s_\-()\[\].:\/\\]+/g,"")
    .replace(/[^a-z0-9ก-๙]/g,"")
    .trim();
}
function pick(obj, keys, fallbackIndex){
  var rawKeys = Object.keys(obj||{}), wanted = keys.map(compactKey);
  for(var i=0;i<rawKeys.length;i++){
    if(wanted.indexOf(compactKey(rawKeys[i]))>=0) return obj[rawKeys[i]];
  }
  if(typeof fallbackIndex==="number"){
    var vals = rawKeys.map(function(k){return obj[k];});
    if(vals[fallbackIndex]!==undefined) return vals[fallbackIndex];
  }
  return "";
}
function normalizePkgRow(p){
  // Backend v14.4 headers:
  // A package_id, B event_id, C package_type, D model_group, E model_display,
  // F lens_group, G lens_display, H price, I available_count, J package_status,
  // K sort_order, L web_note, M raw_available_count, N use_case
  var status = pick(p,["package_status","package status","status","สถานะแพ็กเกจ"],9);
  var price  = pick(p,["price","standard_price","standard price","ราคา"],7);
  var modelDisplay = pick(p,["model_display","phone_model_display","ชื่อแสดง\nมือถือ","ชื่อแสดงมือถือ"],4);
  var lensDisplay  = pick(p,["lens_display","lens_model_display","ชื่อแสดง\nเลนส์","ชื่อแสดงเลนส์"],6);
  var pkgType = pick(p,["pkg_type","package_type","package type","ประเภท\nแพ็กเกจ","ประเภทแพ็กเกจ"],2);
  var availableCount = pick(p,["available_count","available count","available_count\n(auto)","จำนวนว่าง"],8);
  var rawAvailableCount = pick(p,["raw_available_count","raw available count","raw_available_count\n(auto)","จำนวนว่างดิบ"],12);
  var useCase = pick(p,["use_case","use case","use_case_note","เหมาะกับ","ข้อความเหมาะกับ"],13);

  return {
    package_id:          pick(p,["package_id","pkg_id","template_id","รหัสแพ็กเกจ\n(Auto)","รหัสแพ็กเกจ"],0),
    event_id:            pick(p,["event_id","event_id\n(ตรงกับ 01_Events)"],1),
    pkg_type:            pkgType,
    model_group:         pick(p,["model_group","model_group\n(จาก Settings)"],3),
    phone_model_display: modelDisplay,
    model_display:       modelDisplay,
    lens_group:          pick(p,["lens_group","lens_group\n(NONE ถ้าไม่มี)"],5),
    lens_model_display:  lensDisplay,
    lens_display:        lensDisplay,
    price:               price,
    web_note:            pick(p,["web_note","package_note","หมายเหตุ\n(สำหรับเว็บ)","หมายเหตุ"],11),
    // ห้าม fallback เป็น index 12 เพราะ v14.4 column M คือ raw_available_count ไม่ใช่ active flag
    pkg_active:          pick(p,["pkg_active","pkg_active\n(TRUE/FALSE)"]),
    available_count:     availableCount,
    raw_available_count: rawAvailableCount,
    use_case:            useCase,
    package_status:      status,
    sort_order:          pick(p,["sort_order"],10)
  };
}
function isPkgVisible(p){
  var st=String((p&&p.package_status)||"").trim().toLowerCase();
  if(st==="hidden"||st==="hide") return false;
  if(hasVal(p&&p.pkg_active)) return toBool(p.pkg_active);
  return true;
}

// ─── GA4 minimal tracker ──────────────────────────────────────────────────
// ถ้ายังไม่ได้เซ็ต GA_ID ใน config.js ก็ skip ไปเงียบๆ
function track(name, params){
  try{ if(typeof gtag==="function"){ gtag("event", name, params||{}); } }catch(e){}
}
function setMeta(attr, key, val){
  try{
    if(!val)return;
    var el=document.querySelector('meta['+attr+'="'+key+'"]');
    if(el)el.setAttribute("content", val);
  }catch(e){}
}
function eventUrl(c){
  try{ var u=new URL(homeUrl()); u.searchParams.set("event", c.id||""); return u.toString(); }
  catch(e){ return (APP.siteUrl || window.location.href); }
}
function resetMeta(){
  try{
    document.title = DEFAULT_TITLE;
    setMeta("name","description",DEFAULT_DESCRIPTION);
    setMeta("property","og:title",DEFAULT_TITLE);
    setMeta("property","og:description",DEFAULT_DESCRIPTION);
    setMeta("property","og:url",APP.siteUrl || homeUrl());
    setMeta("property","og:image",DEFAULT_OG_IMAGE);
    setMeta("name","twitter:title",DEFAULT_TITLE);
    setMeta("name","twitter:description",DEFAULT_DESCRIPTION);
    setMeta("name","twitter:image",DEFAULT_OG_IMAGE);
  }catch(e){}
}
function updateMetaForEvent(c){
  if(!c)return;
  var title=(c.name?c.name+" | ":"")+"KK Phone Rental";
  var desc="เช่ามือถือถ่ายงาน "+(c.name||"คอนเสิร์ต")+" วันที่ "+(c.date||"-")+" ดูแพ็กเกจและจองผ่าน LINE OA";
  document.title=title;
  setMeta("name","description",desc);
  setMeta("property","og:title",title);
  setMeta("property","og:description",desc);
  setMeta("property","og:url",eventUrl(c));
  if(c.imgFull&&c.imgFull[0])setMeta("property","og:image",c.imgFull[0]);
  setMeta("name","twitter:title",title);
  setMeta("name","twitter:description",desc);
  if(c.imgFull&&c.imgFull[0])setMeta("name","twitter:image",c.imgFull[0]);
}

// ─── Date utils ───────────────────────────────────────────────────────────
function parseDate(s){
  s=String(s||"").trim(); if(!s)return null;
  if(/^\d{5}$/.test(s)){ return new Date(Date.UTC(1899,11,30)+Number(s)*86400000); }
  var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){ var y=parseInt(m[3],10); if(y>2500)y-=543; return new Date(y,parseInt(m[2],10)-1,parseInt(m[1],10)); }
  m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){ var y2=parseInt(m[1],10); if(y2>2500)y2-=543; return new Date(y2,parseInt(m[2],10)-1,parseInt(m[3],10)); }
  var en={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/i);
  if(m){ var mo=en[m[2].toLowerCase().slice(0,3)]; if(mo!==undefined){ var y3=parseInt(m[3],10); if(y3>2500)y3-=543; return new Date(y3,mo,parseInt(m[1],10)); }}
  var th={"ม.ค.":0,"มกราคม":0,"ก.พ.":1,"กุมภาพันธ์":1,"มี.ค.":2,"มีนาคม":2,"เม.ย.":3,"เมษายน":3,"พ.ค.":4,"พฤษภาคม":4,"มิ.ย.":5,"มิถุนายน":5,"ก.ค.":6,"กรกฎาคม":6,"ส.ค.":7,"สิงหาคม":7,"ก.ย.":8,"กันยายน":8,"ต.ค.":9,"ตุลาคม":9,"พ.ย.":10,"พฤศจิกายน":10,"ธ.ค.":11,"ธันวาคม":11};
  for(var k in th){ if(s.indexOf(k)>=0){ var parts=s.split(k); var d2=parseInt(String(parts[0]).replace(/\D/g,""),10); var ym=String(parts[1]||"").match(/\d{4}/); var y4=ym?parseInt(ym[0],10):new Date().getFullYear(); if(y4>2500)y4-=543; if(d2)return new Date(y4,th[k],d2); }}
  return null;
}
function fmtDate(s){ var d=parseDate(s); if(!d)return String(s||""); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }

// ─── Image utils — FIX 2: w600 thumbnail, w1200 only for modal ───────────
function getDriveId(url){
  var s=String(url||"").trim();
  var pats=[/\/file\/d\/([^/?#]+)/,/[?&]id=([^&#]+)/,/\/thumbnail\?id=([^&#]+)/,/googleusercontent\.com\/d\/([^=/?#]+)/];
  for(var i=0;i<pats.length;i++){ var m=s.match(pats[i]); if(m&&m[1])return decodeURIComponent(m[1]).trim(); }
  return "";
}
function getImgCandidates(url, size){
  // FIX: size param — "thumb" = w600 (grid), "full" = w1200 (modal)
  var sz = size==="full" ? "w1200" : "w600";
  var s=String(url||"").trim(); if(!s)return [];
  var id=getDriveId(s);
  if(id)return [
    "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz="+sz,
    "https://lh3.googleusercontent.com/d/"+encodeURIComponent(id)+"="+sz,
    "https://drive.google.com/uc?export=view&id="+encodeURIComponent(id)
  ];
  return [s];
}
function setImgFallback(img, urls){
  urls=(urls||[]).filter(Boolean); var idx=0;
  function next(){
    if(idx>=urls.length){
      if(img.id==="modal-poster-img"){ img.style.display="none"; return; }
      var w=img.parentElement; img.remove();
      if(w&&!w.querySelector(".poster-placeholder")){ var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML="<span>ยังไม่มีรูป</span>"; w.appendChild(ph); }
      return;
    }
    img.style.display="block"; img.src=urls[idx++];
  }
  img.onerror=function(){ next(); }; next();
}

// ─── CSV + fetch ──────────────────────────────────────────────────────────
function parseCsv(text){
  var rows=[],row=[],val="",q=false;
  text=String(text||"").replace(/^\uFEFF/,"");
  for(var i=0;i<text.length;i++){
    var c=text[i],n=text[i+1];
    if(c==='"'){ if(q&&n==='"'){val+='"';i++;}else q=!q; }
    else if(c===','&&!q){ row.push(val);val=""; }
    else if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&n==='\n')i++; row.push(val); if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); } row=[];val=""; }
    else val+=c;
  }
  row.push(val);
  if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); }
  return rows;
}
function csvToObjects(rows){
  if(!rows||rows.length<2)return [];
  var headers=rows[0].map(function(h){return String(h||"").trim();});
  return rows.slice(1).map(function(row){
    var obj={}; headers.forEach(function(h,i){ if(h)obj[h]=row[i]!==undefined?row[i]:""; });
    return obj;
  }).filter(function(o){ return Object.keys(o).some(function(k){return String(o[k]||"").trim()!=="";});});
}
function abortAfter(ms){ var c=new AbortController(); var t=setTimeout(function(){c.abort();},ms); return {signal:c.signal,clear:function(){clearTimeout(t);}}; }
async function fetchText(url,ms){
  var ab=abortAfter(ms||9000);
  try{ var r=await fetch(url,{cache:"default",signal:ab.signal}); if(!r.ok)throw new Error("HTTP "+r.status); return await r.text(); }
  finally{ ab.clear(); }
}
async function withRetry(fn,tries,delay){
  var err; tries=tries||2; delay=delay||700;
  for(var i=0;i<tries;i++){ try{return await fn();}catch(e){err=e;if(i<tries-1)await new Promise(function(r){setTimeout(r,delay);});} }
  throw err;
}
function directSheetUrl(name,range){ return "https://docs.google.com/spreadsheets/d/"+encodeURIComponent(SHEET_ID)+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(name)+"&range="+encodeURIComponent(range)+"&t="+Date.now(); }
function apiSheetUrl(name,range){ return API_ENDPOINT+"?sheet="+encodeURIComponent(name)+"&range="+encodeURIComponent(range)+"&t="+Date.now(); }
async function fetchSheetCsv(name,range,ms){
  if(USE_API){
    try{ return await fetchText(apiSheetUrl(name,range),ms||9000); }
    catch(e){
      console.warn("KK proxy failed; falling back to direct Google Sheets", e);
      if(APP.disableDirectFallback) throw e;
    }
  }
  return await fetchText(directSheetUrl(name,range),ms||9000);
}

// ─── Session cache (3 min) ────────────────────────────────────────────────
var CACHE_TTL=90000; // v15.3: shorter cache so admin price/stock changes show faster
function cacheGet(k){ try{ var raw=sessionStorage.getItem(k); if(!raw)return null; var o=JSON.parse(raw); return (Date.now()-o.ts)<CACHE_TTL?o.data:null; }catch(e){return null;} }
function cacheSet(k,d){ try{sessionStorage.setItem(k,JSON.stringify({ts:Date.now(),data:d}));}catch(e){} }

async function fetchWebRows(){
  var k="kk_web_v15_3:"+SHEET_ID+":"+WEB_SHEET+":"+WEB_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k); if(!DEBUG_MODE&&c)return c;
  var t=await withRetry(function(){return fetchSheetCsv(WEB_SHEET,WEB_RANGE,9000);},2,700);
  var d=csvToObjects(parseCsv(t)); if(!DEBUG_MODE)cacheSet(k,d); return d;
}
async function fetchPkgRows(){
  var k="kk_pkg_v15_3:"+SHEET_ID+":"+PKG_SHEET+":"+PKG_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k); if(!DEBUG_MODE&&c)return c;
  var t=await withRetry(function(){return fetchSheetCsv(PKG_SHEET,PKG_RANGE,9000);},2,700);
  var d=csvToObjects(parseCsv(t)).map(normalizePkgRow); if(!DEBUG_MODE)cacheSet(k,d); return d;
}

// ─── FIX 1: buildPackagesFromSheet — ใช้ available_count จาก 09_Web_Packages จริง ─
function buildPackagesFromSheet(pkgRows, eventId, phoneCnt, lensCnt){
  // phoneCnt + lensCnt มาจาก 08_Web_Ready G/H; package count มาจาก 09_Web_Packages I
  var evtPkgs=(pkgRows||[]).filter(function(p){
    var rowEvent = String(p.event_id||"").trim();
    return (!rowEvent || rowEvent===String(eventId||"").trim()) && isPkgVisible(p);
  });
  if(!evtPkgs.length)return [];

  return evtPkgs.sort(function(a,b){ return toNum(a.sort_order)-toNum(b.sort_order); }).map(function(p){
    var pkgType      = String(p.pkg_type||"phone_only").trim();
    var modelDisplay = String(p.model_display||p.phone_model_display||"มือถือ").trim();
    var lensDisplay  = String(p.lens_display||p.lens_model_display||p.lens_group||"").trim();
    var note         = String(p.web_note||p.package_note||"").trim();
    var useCase      = String(p.use_case||"").trim();

    var override = toNum(p.price_override);
    var directPrice = toNum(p.price);
    var price;
    if(directPrice>0){ price=directPrice; }
    else if(override>0){ price=override; }
    else if(pkgType==="phone_only"){ price=toNum(p.phone_price); }
    else if(pkgType==="lens_only"){  price=toNum(p.lens_price); }
    else{ price=toNum(p.bundle_price||p.phone_price); }

    var spec  = pkgType==="phone_only" ? "เฉพาะมือถือ" : pkgType==="lens_only" ? (lensDisplay||"เลนส์เสริม") : "มือถือ + เลนส์";
    var label = pkgType==="lens_only"  ? (lensDisplay||"Lens") : pkgType==="phone_lens_bundle" ? modelDisplay+" + Lens" : modelDisplay;

    // FIX: ใช้ available_count จาก 09_Web_Packages แทน isOpen&&price>0
    // available_count จาก 09_Web_Packages เป็น source of truth ต่อ package
    var sheetAvailRaw = p.available_count;
    var sheetHasAvail = hasVal(sheetAvailRaw);
    var sheetAvail = toNum(sheetAvailRaw);
    var rawAvailRaw = p.raw_available_count;
    var rawHasAvail = hasVal(rawAvailRaw);
    var rawAvail = toNum(rawAvailRaw);
    var pkgStatus = String(p.package_status||"").trim().toLowerCase();
    var avail;
    if(pkgStatus==="hidden"||pkgStatus==="hide"){
      avail = false;
    } else if(pkgStatus==="available"){
      avail = sheetHasAvail ? sheetAvail > 0 : true;
    } else if(pkgStatus==="full"){
      avail = false;
    } else if(sheetHasAvail){
      // v13.4: 09_Web_Packages!available_count เป็น source of truth ต่อ package
      avail = sheetAvail > 0;
    } else if(pkgType==="lens_only"){
      // backward compatibility ถ้าใช้ backend เก่า
      avail = lensCnt > 0;
    } else if(pkgType==="phone_lens_bundle"){
      // bundle ต้องมีทั้งเครื่องและเลนส์
      avail = phoneCnt > 0 && lensCnt > 0;
    } else {
      avail = phoneCnt > 0;
    }
    // ถ้า price=0 ก็ไม่ available อยู่ดี และถ้า raw_available_count ติดลบ แปลว่า overbooking/manual risk
    if(price<=0) avail = false;
    if(rawHasAvail && rawAvail < 0) avail = false;

    return { id:p.package_id||"", model:label, spec:spec, price:price, note:note, useCase:useCase, avail:avail, count:sheetAvail, rawCount:rawAvail, type:pkgType, lensDisp:lensDisplay, sort:toNum(p.sort_order) };
  });
}

// Fallback from 08_Web_Ready single row (backward compat)
function buildPackagesFromWebRow(r){
  var pkgs=[];
  var model=String(r.phone_model_display||r.allowed_phone_model_group||"มือถือ").trim();
  var lens=String(r.allowed_lens_group||"").trim();
  var note=String(r.web_note||"").trim();
  var pPrice=toNum(r.phone_price), lPrice=toNum(r.lens_price), bPrice=toNum(r.bundle_price);
  var phoneAvail = r.phone_only_available!==undefined ? toBool(r.phone_only_available) : toNum(r.available_phone_count)>0;
  var lensAvail  = r.lens_only_available!==undefined  ? toBool(r.lens_only_available)  : toNum(r.available_lens_count)>0;
  var bundleAvail= r.phone_lens_available!==undefined ? toBool(r.phone_lens_available) : (phoneAvail&&lensAvail&&bPrice>0);
  if(pPrice>0)pkgs.push({model:model, spec:"เฉพาะมือถือ",  price:pPrice, note:note, useCase:String(r.use_case||"").trim(), avail:phoneAvail, type:"phone_only"});
  if(lPrice>0)pkgs.push({model:"Lens",spec:lens&&lens!=="NONE"?lens:"เลนส์เสริม",price:lPrice,note:note,useCase:String(r.use_case||"").trim(),avail:lensAvail,type:"lens_only"});
  if(bPrice>0)pkgs.push({model:model+" + Lens",spec:"มือถือ + เลนส์",price:bPrice,note:note,useCase:String(r.use_case||"").trim(),avail:bundleAvail,type:"phone_lens_bundle"});
  if(!pkgs.length)pkgs.push({model:model,spec:"สอบถามแพ็กเกจผ่าน LINE OA",price:0,note:note,useCase:String(r.use_case||"").trim(),avail:true,type:"ask"});
  return pkgs;
}

async function loadData(){
  var results=await Promise.all([
    fetchWebRows(),
    fetchPkgRows().catch(function(){return [];})
  ]);
  var webRows=results[0]||[], pkgRows=results[1]||[];

  var pkgMap={};
  pkgRows.forEach(function(p){ var id=String(p.event_id||"").trim(); if(!id)return; if(!pkgMap[id])pkgMap[id]=[]; if(isPkgVisible(p))pkgMap[id].push(p); });

  var rows=webRows.filter(function(r){ var a=String(r.action_for_web||"").trim().toLowerCase(); return a&&a!=="hide"; });

  return rows.map(function(r){
    var eventId    = String(r.event_id||"").trim();
    var rawDate    = r.event_date_text||"";
    var rawPoster  = String(r.poster_image_url||"").trim();
    var evtStatus  = String(r.event_status||"").toLowerCase();
    var phoneCnt   = toNum(r.available_phone_count);
    var lensCnt    = toNum(r.available_lens_count);

    var hasPkgSheet = !!(pkgMap[eventId]&&pkgMap[eventId].length>0);
    // FIX: ส่ง phoneCnt/lensCnt เข้า buildPackagesFromSheet ด้วย
    var packages = hasPkgSheet
      ? buildPackagesFromSheet(pkgMap[eventId] || [], eventId, phoneCnt, lensCnt)
      : buildPackagesFromWebRow(r);

    return {
      id:           eventId,
      name:         String(r.event_name||"").trim(),
      date:         fmtDate(rawDate),
      rawDate:      rawDate,
      venue:        String(r.venue||"").trim(),
      rawPoster:    rawPoster,
      // FIX: thumbnail ใช้ w600 (เร็วกว่า w1200 4x)
      img:          getImgCandidates(rawPoster,"thumb")[0]||"",
      imgThumb:     getImgCandidates(rawPoster,"thumb"),
      imgFull:      getImgCandidates(rawPoster,"full"), // เฉพาะ modal
      webNote:      String(r.web_note||"").trim(),
      phoneCnt:     phoneCnt,
      lensCnt:      lensCnt,
      bookingStatus:String(r.booking_status_for_web||"").trim(),
      action:       String(r.action_for_web||"show").trim().toLowerCase(),
      lineTemplate: String(r.line_message_template||"").trim(),
      packages:     packages,
      hasPkgSheet:  hasPkgSheet
    };
  });
}

// ─── Concert logic ────────────────────────────────────────────────────────
function concertTs(c){ var d=parseDate(c.rawDate); if(!d)return Number.MAX_SAFE_INTEGER; d.setHours(0,0,0,0); return d.getTime(); }
function isFuture(c){ return SHOW_PAST||concertTs(c)>=TODAY_TS; }
function isSoon(c){ var ms=concertTs(c)-TODAY_TS; return ms>=0&&ms<=14*86400000; }
function availPkgs(c){ return (c.packages||[]).filter(function(p){return p.avail;}); }
function availCnt(c){
  // v15.3: use package-level available_count first so hidden phone packages do not inflate card availability.
  var ap=availPkgs(c);
  var maxPkg=0;
  ap.forEach(function(p){ if(hasVal(p.count)) maxPkg=Math.max(maxPkg,toNum(p.count)); });
  if(maxPkg>0) return maxPkg;
  var phone=toNum(c&&c.phoneCnt), lens=toNum(c&&c.lensCnt);
  if(ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";})) return phone;
  if(ap.some(function(p){return p.type==="lens_only";})) return lens;
  return 0;
}
function availTextFor(c){
  var ap=availPkgs(c), cnt=availCnt(c);
  if(cnt<=0) return "เต็มแล้วน้า 😢";
  var hasPhone=ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";});
  var hasLensOnly=ap.some(function(p){return p.type==="lens_only";});
  if(hasPhone) return cnt===1 ? "เหลือ 1 เครื่องสุดท้าย ✨" : "ว่าง "+cnt+" เครื่อง ✨";
  if(hasLensOnly) return "เหลือ Lens อย่างเดียว ✨";
  return "ว่าง ✨";
}

function filtered(concerts){
  var vis=concerts.filter(isFuture).sort(function(a,b){return concertTs(a)-concertTs(b)||a.name.localeCompare(b.name,"th");});
  if(currentFilter==="available")return vis.filter(function(c){return availCnt(c)>0;});
  if(currentFilter==="full")     return vis.filter(function(c){return availCnt(c)===0;});
  if(currentFilter==="soon")     return vis.filter(isSoon);
  return vis;
}
function emptyMsg(){
  if(currentFilter==="available")return "ยังไม่มีงานที่มีเครื่องว่างตอนนี้น้า 💙";
  if(currentFilter==="full")     return "ยังไม่มีงานที่เต็มแล้วตอนนี้น้า ✨";
  if(currentFilter==="soon")     return "ยังไม่มีงานใกล้ถึงใน 14 วันน้า 💙";
  return "ยังไม่มีงานที่เปิดให้จองตอนนี้น้า 💙";
}

// ─── DOM ──────────────────────────────────────────────────────────────────
function applyConfig(){
  DEFAULT_OG_IMAGE = APP.headerImage || DEFAULT_OG_IMAGE;
  if(APP.siteUrl){
    var canonical=document.querySelector('link[rel="canonical"]'); if(canonical)canonical.href=APP.siteUrl;
  }
  if(APP.headerImage){var h=document.querySelector(".brand-header-img");if(h)h.src=APP.headerImage;}
  resetMeta();
  if(APP.xUrl){document.querySelectorAll("a.quick-link").forEach(function(a){a.href=APP.xUrl;});}
  document.querySelectorAll("a.line-btn,a.sticky-line").forEach(function(a){a.href=LINE_URL;});
}
function setUpdateDate(){
  var n=new Date(); var el=document.getElementById("update-note");
  if(el)el.textContent="อัปเดตล่าสุด: "+String(n.getDate()).padStart(2,"0")+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+n.getFullYear()+" "+String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");
}
function showBrandFallback(){var a=document.getElementById("brandImageCard"),b=document.getElementById("brandFallback");if(a)a.style.display="none";if(b)b.style.display="flex";}

function renderLoadingSkeleton(count){
  var el=document.getElementById("content"); if(!el)return;
  count=count||4;
  var html='<div class="poster-grid skeleton-grid" aria-label="กำลังโหลดข้อมูลงาน">';
  for(var i=0;i<count;i++){
    html+='<div class="concert-card skeleton-card" aria-hidden="true"><div class="poster-img-wrap skeleton-poster"><span></span></div><div class="poster-info skeleton-info"><div class="sk sk-date"></div><div class="sk sk-title"></div><div class="sk sk-title short"></div><div class="sk sk-btn"></div></div></div>';
  }
  html+='</div><div class="loading-text skeleton-loading-text">กำลังเช็กคิวให้น้า... 📱✨</div>';
  el.innerHTML=html;
}
function renderEmpty(msg,detail){
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML='<div class="empty-state"><div class="empty-emoji">💙</div><h3>'+esc(msg)+'</h3><p>'+(detail?esc(detail):'ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย')+'</p><a class="empty-line-btn" href="'+LINE_URL+'" target="_blank" rel="noopener">ทัก LINE OA</a></div>';
}
function getBadgeText(c){ var cnt=availCnt(c), ap=availPkgs(c); if(cnt<=0)return "เต็มแล้ว"; if(isSoon(c))return "ใกล้ถึงวันงาน"; return ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";}) ? "ว่าง "+cnt+" เครื่อง" : "Lens ว่าง"; }

function renderConcerts(concerts){
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML="";
  if(!concerts||!concerts.length){renderEmpty("ยังไม่มีข้อมูลงานตอนนี้น้า 💙");return;}
  var vis=filtered(concerts);
  if(!vis.length){renderEmpty(emptyMsg());return;}

  var grid=document.createElement("div"); grid.className="poster-grid";

  // LCP improvement: preload รูปงานแรกครั้งเดียวต่อ URL
  if(vis[0]&&vis[0].img&&!PRELOADED_IMAGES[vis[0].img]){
    PRELOADED_IMAGES[vis[0].img]=true;
    var lnk=document.createElement("link"); lnk.rel="preload"; lnk.as="image"; lnk.href=vis[0].img;
    document.head.appendChild(lnk);
  }

  vis.forEach(function(c,idx){
    var cnt=availCnt(c), avail=cnt>0;
    var availText=availTextFor(c);
    var pkgCount=(c.packages||[]).length;
    var pkgHint=c.hasPkgSheet&&pkgCount>1?" ("+pkgCount+" แพ็กเกจ)":"";

    var card=document.createElement("button"); card.type="button"; card.className="concert-card";
    card.setAttribute("aria-label","ดูเครื่องว่างสำหรับงาน "+c.name);
    card.onclick=function(){ showModal(c); };

    var imgWrap=document.createElement("div"); imgWrap.className="poster-img-wrap";
    var badge=document.createElement("div"); badge.className="status-badge"+(avail?"":" full")+(isSoon(c)&&avail?" soon":""); badge.textContent=getBadgeText(c); imgWrap.appendChild(badge);

    var imgUrl=c.img?String(c.img).trim():"";
    if(imgUrl){
      var img=document.createElement("img"); img.alt=c.name||"Event poster";
      // FIX: ใช้ thumb candidates (w600) สำหรับ grid
      img.loading=idx===0?"eager":"lazy"; img.decoding="async";
      setImgFallback(img, c.imgThumb&&c.imgThumb.length?c.imgThumb:[imgUrl]); imgWrap.appendChild(img);
    } else {
      var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML="<span>ยังไม่มีรูป</span>"; imgWrap.appendChild(ph);
    }

    var info=document.createElement("div"); info.className="poster-info";
    var dateEl=document.createElement("div"); dateEl.className="pi-date"; dateEl.textContent=c.date||"";
    var nameEl=document.createElement("div"); nameEl.className="pi-name"; nameEl.textContent=c.name||"";
    var availEl=document.createElement("div"); availEl.className="pi-avail"+(avail?"":" none"); availEl.textContent=availText+pkgHint;
    var tap=document.createElement("div"); tap.className="pi-tap"+(avail?"":" full"); tap.textContent=avail?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว";
    info.appendChild(dateEl); info.appendChild(nameEl); info.appendChild(availEl); info.appendChild(tap);
    card.appendChild(imgWrap); card.appendChild(info); grid.appendChild(card);
  });
  el.appendChild(grid);
}

// ─── Modal ────────────────────────────────────────────────────────────────
function buildBookingMsg(c,p){
  // v14.12: keep LINE OA message short and package-specific.
  // Do not prepend backend line_message_template because that already contains event data and causes duplicated text.
  return [
    "สนใจเช่า "+lineVal(p&&p.model),
    "งาน : "+lineVal(c&&c.name),
    "วันที่ : "+lineVal(c&&c.date),
    "ราคา : "+fmtPriceLine(p&&p.price),
    "",
    "ชื่อเล่น : ",
    "เบอร์โทร : ",
    "เวลาที่สะดวกรับเครื่อง : "
  ].join("\n");
}
function getBookingUrl(c,p){ return LINE_OA+encodeURIComponent(buildBookingMsg(c,p)); }
function showModal(c){
  if(!c)return;
  // NEW: GA4 track modal open
  track("view_event_packages",{event_name:c.name, available:availCnt(c)});
  updateMetaForEvent(c);
  setEventUrl(c.id);

  document.getElementById("modal-title").textContent=c.name||"รายละเอียดงาน";
  document.getElementById("modal-date").textContent="📅 "+(c.date||"-");
  document.getElementById("modal-venue").textContent="📍 "+(c.venue||"-");

  // v13.5 UX fix: ไม่แสดงรูปโปสเตอร์ซ้ำใน modal
  // รูปยังแสดงเฉพาะบนการ์ด เพื่อให้ modal กระชับและพอดีกับจอมากขึ้น

  var list=document.getElementById("phone-list"); list.innerHTML="";
  var avail=availPkgs(c);

  if(!avail.length){
    list.innerHTML='<div class="full-booked-box">งานนี้เต็มแล้วน้า 🙏<br>ทักมาถามรอบอื่นได้เลย 💙</div>';
    openModal(); return;
  }

  avail.forEach(function(p){
    var row=document.createElement("div"); row.className="phone-row";
    var icon=document.createElement("div"); icon.className="ph-icon";
    icon.innerHTML='<svg viewBox="0 0 28 28" fill="none"><rect x="6" y="3" width="16" height="22" rx="3" stroke="#5B8DEF" stroke-width="1.8"/><rect x="10" y="6" width="8" height="1.5" rx="0.75" fill="#5B8DEF"/><circle cx="14" cy="22" r="1.2" fill="#5B8DEF"/></svg>';
    var info=document.createElement("div"); info.className="ph-info";
    var mEl=document.createElement("div"); mEl.className="ph-model"; mEl.textContent=p.model||"";
    var sEl=document.createElement("div"); sEl.className="ph-spec";  sEl.textContent=p.spec||"";
    info.appendChild(mEl); info.appendChild(sEl);
    if(p.useCase){var uEl=document.createElement("div"); uEl.className="ph-usecase"; uEl.textContent=p.useCase; info.appendChild(uEl);}
    if(p.note){var nEl=document.createElement("div"); nEl.className="ph-note"; nEl.textContent=p.note; info.appendChild(nEl);}
    var right=document.createElement("div"); right.className="ph-right";
    var priceEl=document.createElement("div"); priceEl.className="ph-price";
    if(toNum(p.price)>0){
      priceEl.textContent=toNum(p.price).toLocaleString("th-TH");
      var sm=document.createElement("span"); sm.textContent=" บาท/วัน"; priceEl.appendChild(sm);
    } else {
      priceEl.textContent="สอบถามราคา";
    }
    var bookBtn=document.createElement("a"); bookBtn.className="badge book-pill"; bookBtn.textContent="จองรุ่นนี้";
    bookBtn.href=getBookingUrl(c,p); bookBtn.target="_blank"; bookBtn.rel="noopener";
    bookBtn.setAttribute("aria-label","จองรุ่น "+(p.model||"")+" สำหรับงาน "+(c.name||""));
    // NEW: GA4 track booking click
    bookBtn.onclick=function(e){
      e.stopPropagation();
      track("booking_click",{event_name:c.name, package:p.model, price:p.price});
    };
    right.appendChild(priceEl); right.appendChild(bookBtn);
    row.appendChild(icon); row.appendChild(info); row.appendChild(right); list.appendChild(row);
  });
  openModal();
}

var PACKAGE_CLOSE_SELECTOR = "#modal-close,#modal-x-btn,[data-modal-close=\"package\"]";
var FAQ_CLOSE_SELECTOR = "#faq-close-btn,#faq-x-btn,[data-modal-close=\"faq\"]";
function lockBody(){document.body.style.overflow="hidden";}
function unlockBodyIfNoModal(){var ov=document.getElementById("overlay"), fo=document.getElementById("faqOverlay");if(!(ov&&ov.classList.contains("active"))&&!(fo&&fo.classList.contains("active")))document.body.style.overflow="";}
function homeUrl(){return window.location.origin + "/";}
function setEventUrl(eventId){
  try{
    if(!eventId)return;
    var u=new URL(homeUrl());
    u.searchParams.set("event",String(eventId));
    window.history.replaceState(null,"",u.toString());
  }catch(e){}
}
function clearEventParam(){
  try{
    // v14.11: always reset back to the clean homepage URL when package modal is closed.
    // This prevents refresh from reopening the same event modal.
    if(window.location.search||window.location.hash||window.location.pathname!=="/"){
      window.history.replaceState(null,"",homeUrl());
    }else{
      window.history.replaceState(null,"",homeUrl());
    }
  }catch(e){}
}
function openModal(){var el=document.getElementById("overlay");if(el){el.classList.add("active");lockBody();}}
function closeModal(e){var el=document.getElementById("overlay");if(e&&el&&e.target!==el&&!e.target.closest(PACKAGE_CLOSE_SELECTOR))return;if(el)el.classList.remove("active");clearEventParam();resetMeta();unlockBodyIfNoModal();}
function showError(m){var el=document.getElementById("content");if(el)el.innerHTML='<div class="empty-state error-state"><div class="empty-emoji">🙏</div><h3>โหลดข้อมูลคิวไม่สำเร็จชั่วคราวน้า</h3><p>'+esc(m)+'</p><a class="empty-line-btn" href="'+LINE_URL+'" target="_blank" rel="noopener">ทัก LINE OA มาสอบถาม</a></div>';}

function openFaq(){var el=document.getElementById("faqOverlay");if(el){el.classList.add("active");lockBody();}}
function closeFaq(e){var el=document.getElementById("faqOverlay");if(e&&el&&e.target!==el&&!e.target.closest(FAQ_CLOSE_SELECTOR))return;if(el)el.classList.remove("active");unlockBodyIfNoModal();}
function toggleFaq(btn){var item=btn&&btn.parentElement;if(item){item.classList.toggle("active");btn.setAttribute("aria-expanded",item.classList.contains("active")?"true":"false");}}

function setFilter(f){
  currentFilter=f||"all";
  document.querySelectorAll(".filter-btn").forEach(function(b){var a=b.getAttribute("data-filter")===currentFilter;b.classList.toggle("active",a);b.setAttribute("aria-pressed",a?"true":"false");});
  if(concertsData&&concertsData.length) renderConcerts(concertsData);
}

document.addEventListener("DOMContentLoaded",function(){
  applyConfig(); setUpdateDate(); renderLoadingSkeleton(4);
  document.querySelectorAll(".filter-btn").forEach(function(b){b.addEventListener("click",function(){setFilter(b.getAttribute("data-filter")||"all");});});
  setFilter(currentFilter);
  var bImg=document.querySelector(".brand-header-img"); if(bImg)bImg.addEventListener("error",showBrandFallback);
  var faqBtn=document.getElementById("faq-open-btn"); if(faqBtn)faqBtn.addEventListener("click",openFaq);
  document.querySelectorAll(".faq-q").forEach(function(b){b.addEventListener("click",function(){toggleFaq(b);});});
  var ov=document.getElementById("overlay"); if(ov)ov.addEventListener("click",closeModal);
  var fov=document.getElementById("faqOverlay"); if(fov)fov.addEventListener("click",closeFaq);
  document.querySelectorAll("#overlay .modal,.faq-overlay .modal").forEach(function(m){m.addEventListener("click",function(e){e.stopPropagation();});});
  function bindClose(selector,fn){
    document.querySelectorAll(selector).forEach(function(el){
      ["click","touchend"].forEach(function(evt){
        el.addEventListener(evt,function(e){e.preventDefault();e.stopPropagation();fn();},{passive:false});
      });
    });
  }
  bindClose(PACKAGE_CLOSE_SELECTOR,closeModal);
  bindClose(FAQ_CLOSE_SELECTOR,closeFaq);
  // Capture-phase close handler keeps close buttons working inside LINE/mobile browsers.
  document.addEventListener("click",function(e){
    if(e.target.closest(FAQ_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeFaq();return;}
    if(e.target.closest(PACKAGE_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeModal();return;}
  },true);
  window.addEventListener("popstate",function(){
    var ov=document.getElementById("overlay");
    if(ov&&ov.classList.contains("active")&&!new URL(window.location.href).searchParams.get("event")){
      ov.classList.remove("active");
      resetMeta();
      unlockBodyIfNoModal();
    }
  });

  loadData().then(function(data){
      concertsData=data;
      renderConcerts(concertsData);
      if(REQUESTED_EVENT){
        var target=concertsData.find(function(c){return String(c.id)===REQUESTED_EVENT;});
        if(target){ setTimeout(function(){ showModal(target); }, 80); }
        else{ clearEventParam(); }
      }
    })
    .catch(function(e){ console.error("KK v14.12:",e); showError("ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA"); });
});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    var ov=document.getElementById("overlay"); if(ov&&ov.classList.contains("active"))closeModal();
    var fo=document.getElementById("faqOverlay"); if(fo&&fo.classList.contains("active"))closeFaq();
  }
});
