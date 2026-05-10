// KK Phone Rental v9.2 — Fast Load Balanced (No Query Overhead)
// - Single Source of Truth (ดึงแค่ 08_Web_Ready)
// - เอา &tq= ออก เพื่อให้ Google พ่น CSV ทันที (โหลดไวที่สุด)
// - JavaScript Client-side Filtering
// - SessionStorage Caching (3 minutes)
// - FAQ & UI ครบถ้วน

var APP_CONFIG = window.KK_CONFIG || {};
var SHEET_ID = APP_CONFIG.sheetId || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var WEB_SHEET_NAME = APP_CONFIG.webSheetName || "08_Web_Ready";
var WEB_RANGE = APP_CONFIG.webRange || "A4:AA";
var LINE_OA_ID = APP_CONFIG.lineOAId || "@827blnmo";
var LINE_DIRECT_URL = APP_CONFIG.lineDirectUrl || "https://line.me/R/ti/p/%40827blnmo";

var concertsData = [];
var currentFilter = "all";

// --- ส่วนจัดการ UI ---
function applyConfigToDom(){
  if(APP_CONFIG.headerImage){
    var headerImg=document.querySelector(".brand-header-img");
    if(headerImg) headerImg.src=APP_CONFIG.headerImage;
  }
  if(APP_CONFIG.xUrl){
    document.querySelectorAll("a.quick-link").forEach(function(a){ a.href=APP_CONFIG.xUrl; });
  }
  document.querySelectorAll("a.line-btn, a.sticky-line").forEach(function(a){ a.href=LINE_DIRECT_URL; });
}

var TODAY_FOR_HIDE = new Date();
TODAY_FOR_HIDE.setHours(0,0,0,0);
var URL_PARAMS = new URLSearchParams(window.location.search);
var DEBUG_MODE = URL_PARAMS.get("debug") === "1";
var SHOW_PAST = URL_PARAMS.get("showPast") === "1";

function setUpdateDate(){
  var n=new Date(),dd=String(n.getDate()).padStart(2,"0"),mm=String(n.getMonth()+1).padStart(2,"0"),yyyy=n.getFullYear(),hh=String(n.getHours()).padStart(2,"0"),min=String(n.getMinutes()).padStart(2,"0");
  var el=document.getElementById("update-note");
  if(el)el.textContent="อัปเดตล่าสุด: "+dd+"/"+mm+"/"+yyyy+" "+hh+":"+min;
}

// --- ส่วนจัดการรูปภาพ ---
function extractGoogleDriveFileId(url){
  var s=String(url||"").trim(); if(!s)return "";
  var patterns=[/\/file\/d\/([^/?#]+)/,/[?&]id=([^&#]+)/,/\/thumbnail\?id=([^&#]+)/,/googleusercontent\.com\/d\/([^=/?#]+)/];
  for(var i=0;i<patterns.length;i++){ var m=s.match(patterns[i]); if(m&&m[1])return decodeURIComponent(m[1]).trim(); }
  return "";
}

function getImageCandidates(url){
  var original=String(url||"").trim(); if(!original)return [];
  var id=extractGoogleDriveFileId(original);
  if(id) return ["https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1200","https://lh3.googleusercontent.com/d/"+encodeURIComponent(id)+"=w1200","https://drive.google.com/uc?export=view&id="+encodeURIComponent(id)];
  return [original];
}

function normalizeImageUrl(url){ var list=getImageCandidates(url); return list.length?list[0]:""; }

function setImageWithFallback(img, urls){
  urls=(urls||[]).filter(Boolean); var index=0;
  function setNext(){ if(index>=urls.length)return false; img.src=urls[index++]; return true; }
  img.onerror=function(){
    if(!setNext()){
      var wrap=img.parentElement; img.remove();
      if(wrap && !wrap.querySelector(".poster-placeholder")){
        var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML='<span>ยังไม่มีรูป</span>'; wrap.appendChild(ph);
      }
    }
  };
  setNext();
}

// --- ส่วนดึงข้อมูล ---
function timeoutSignal(ms){
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},ms);
  return {signal:controller.signal,clear:function(){clearTimeout(timer);}};
}

async function fetchTextWithTimeout(url,ms){
  var t=timeoutSignal(ms||9000);
  try{
    var res=await fetch(url,{cache:"no-store",signal:t.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    return await res.text();
  }finally{ t.clear(); }
}

async function retry(fn,tries,delay){
  var lastError; tries=tries||2; delay=delay||650;
  for(var i=0;i<tries;i++){
    try{return await fn();} catch(e){ lastError=e; if(i<tries-1)await new Promise(function(resolve){setTimeout(resolve,delay);}); }
  }
  throw lastError;
}

function parseCsv(text){
  var rows=[], row=[], value="", insideQuotes=false;
  text=String(text||"").replace(/^\uFEFF/,"");
  for(var i=0;i<text.length;i++){
    var ch=text[i], next=text[i+1];
    if(ch==='"'){
      if(insideQuotes && next==='"'){ value+='"'; i++; }else{ insideQuotes=!insideQuotes; }
    }else if(ch===',' && !insideQuotes){ row.push(value); value="";
    }else if((ch==='\n'||ch==='\r') && !insideQuotes){
      if(ch==='\r' && next==='\n') i++; row.push(value);
      if(row.some(function(cell){return String(cell||"").trim()!=="";})) rows.push(row);
      row=[]; value="";
    }else{ value+=ch; }
  }
  row.push(value); if(row.some(function(cell){return String(cell||"").trim()!=="";})) rows.push(row);
  return rows;
}

function csvRowsToObjects(rows){
  if(!rows||rows.length<2)return [];
  var headers=rows[0].map(function(h){return String(h||"").trim();});
  return rows.slice(1).map(function(row){
    var obj={}; headers.forEach(function(h,i){if(h)obj[h]=row[i]!==undefined?row[i]:"";});
    return obj;
  }).filter(function(obj){ return Object.keys(obj).some(function(k){return String(obj[k]||"").trim()!=="";}); });
}

function getField(row, keys) {
  if (!row) return "";
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function formatPrice(num) {
  var n = Number(num); if (isNaN(n) || n <= 0) return "0";
  return n.toLocaleString("th-TH") + " บาท/วัน";
}
function toBool(value){
  if(value===true)return true;
  var v=String(value||"").trim().toUpperCase();
  return v==="TRUE"||v==="YES"||v==="Y"||v==="1"||v==="ว่าง"||v==="OPEN"||v==="SHOW";
}
function toNumber(value){
  var n=Number(String(value||"").replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n;
}
function formatDateFromSerial(serial){
  var n=Number(serial); if(!n||isNaN(n))return String(serial||"");
  var d=new Date(Date.UTC(1899,11,30)+n*86400000);
  return String(d.getUTCDate()).padStart(2,"0")+"/"+String(d.getUTCMonth()+1).padStart(2,"0")+"/"+d.getUTCFullYear();
}

// 🔵 โหลดข้อมูลโดยไม่ใช้ Google Query เพื่อลดภาระการคำนวณฝั่ง Server (โหลดไวขึ้น)
async function fetchWebReadyRows(){
  var cacheKey = "kk_events_cache";
  var cacheTimeKey = "kk_events_cache_time";
  var now = new Date().getTime();
  var cachedData = sessionStorage.getItem(cacheKey);
  var cachedTime = sessionStorage.getItem(cacheTimeKey);

  if (cachedData && cachedTime && (now - cachedTime < 180000) && !DEBUG_MODE) {
    return JSON.parse(cachedData);
  }

  // ❌ ลบ &tq= ออก ให้รับไฟล์ CSV ดิบเลย
  var url="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(WEB_SHEET_NAME)+"&range="+encodeURIComponent(WEB_RANGE);
  
  var csv=await retry(function(){return fetchTextWithTimeout(url,9000);},2,700);
  var result = csvRowsToObjects(parseCsv(csv));

  sessionStorage.setItem(cacheKey, JSON.stringify(result));
  sessionStorage.setItem(cacheTimeKey, now.toString());

  return result;
}

// 🔵 นำฟังก์ชันคัดกรองข้อมูลของฝั่งเว็บกลับมา
function isRowVisibleOnWeb(row){
  var action=String(getField(row,["action_for_web","action","web_action"])).trim().toLowerCase();
  var health=String(getField(row,["data_health"])).trim().toUpperCase();
  var status=String(getField(row,["event_status","booking_status_for_web"])).trim().toLowerCase();
  if(action && action!=="show")return false;
  if(health && health!=="OK")return false;
  if(status==="draft"||status==="cancelled"||status==="closed")return false;
  return toBool(getField(row,["active_on_web","show_on_web","active"]));
}

function buildPackageOptions(row){
  var options=[];
  var baseModel=getField(row,["phone_model_display","model","รุ่น"])||"มือถือ";
  var lensGroup=getField(row,["allowed_lens_group","lens_model_display","lens"]);
  var note=getField(row,["web_note","note","หมายเหตุ"]);
  var phonePrice=toNumber(getField(row,["phone_price","price","ราคา"]));
  var lensPrice=toNumber(getField(row,["lens_price"]));
  var bundlePrice=toNumber(getField(row,["bundle_price"]));
  var eventOpen=String(getField(row,["event_status"])).trim().toLowerCase()==="open" || String(getField(row,["booking_status_for_web"])).indexOf("เปิด")>=0;
  var phoneAvailable=toBool(getField(row,["phone_only_available"])) || toNumber(getField(row,["available_phone_count"]))>0;
  var lensAvailable=toBool(getField(row,["lens_only_available"])) || toNumber(getField(row,["available_lens_count"]))>0;
  var bundleAvailable=toBool(getField(row,["phone_lens_available"])) || (phoneAvailable && lensAvailable && bundlePrice>0);
  
  if(phonePrice>0) options.push({model:baseModel,spec:"เฉพาะมือถือ",price:phonePrice,note:note,avail:eventOpen&&phoneAvailable,packageType:"phone_only"});
  if(lensPrice>0) options.push({model:"Lens",spec:lensGroup&&lensGroup!=="NONE"?lensGroup:"เลนส์เสริม",price:lensPrice,note:note,avail:eventOpen&&lensAvailable,packageType:"lens_only"});
  if(bundlePrice>0) options.push({model:baseModel+" + Lens",spec:"มือถือ + เลนส์",price:bundlePrice,note:note,avail:eventOpen&&bundleAvailable,packageType:"phone_lens_bundle"});
  if(!options.length) options.push({model:baseModel,spec:"สอบถามแพ็กเกจผ่าน LINE OA",price:0,note:note,avail:eventOpen,packageType:"ask"});
  
  return options;
}

async function loadData(){
  var rows = await fetchWebReadyRows();
  
  // 🔵 กรองข้อมูลด้วย JavaScript เร็วกว่า
  var concerts = rows.filter(isRowVisibleOnWeb).map(function(r){
    var eventDateText=getField(r,["event_date_text","date_text","วันที่"]);
    var eventDateRaw=getField(r,["event_date","date"]);
    var rawPoster=getField(r,["poster_image_url","img","image","poster","รูป"]);
    return {
      id:getField(r,["event_id","id","ID"]),
      name:getField(r,["event_name","name","ชื่องาน"]),
      date:eventDateText || formatDateFromSerial(eventDateRaw),
      venue:getField(r,["venue","location","สถานที่"]),
      img:normalizeImageUrl(rawPoster),
      imgCandidates:getImageCandidates(rawPoster),
      webNote:getField(r,["web_note","note","หมายเหตุ"]),
      availableCount:toNumber(getField(r,["available_phone_count"])),
      bookingStatus:getField(r,["booking_status_for_web"]),
      eventStatus:String(getField(r,["event_status","booking_status_for_web"])).trim().toLowerCase(),
      lineTemplate:getField(r,["line_message_template"]),
      phones:buildPackageOptions(r)
    };
  });
  return concerts;
}

// --- ส่วนจัดการการแสดงผล ---
function parseEventDate(dateStr){
  var s = String(dateStr || "").trim(); if(!s) return null;
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){
    var d1 = parseInt(m[1],10), mo1 = parseInt(m[2],10) - 1, y1 = parseInt(m[3],10);
    if(y1 > 2500) y1 -= 543;
    var d = new Date(y1, mo1, d1); return (!isNaN(d.getTime())) ? d : null;
  }
  return null;
}

function shouldShowConcert(concert){
  if(SHOW_PAST) return true;
  var d = parseEventDate(concert && concert.date);
  if(!d) return true; d.setHours(0,0,0,0); return d >= TODAY_FOR_HIDE;
}

function getConcertSortTime(concert){
  var d = parseEventDate(concert && concert.date);
  if(!d) return Number.MAX_SAFE_INTEGER; d.setHours(0,0,0,0); return d.getTime();
}

function sortConcertsByDateAsc(concerts){
  return concerts.slice().sort(function(a,b){
    var timeA = getConcertSortTime(a), timeB = getConcertSortTime(b);
    if(timeA !== timeB) return timeA - timeB;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function getAvailablePhones(concert){ return ((concert && concert.phones) || []).filter(function(p){return p.avail;}); }
function getAvailableCount(concert){
  if(concert && concert.availableCount!==undefined && concert.availableCount!==null && Number(concert.availableCount)>0) return Number(concert.availableCount);
  return getAvailablePhones(concert).length;
}

function isSoonConcert(concert){
  var d = parseEventDate(concert && concert.date); if(!d) return false;
  d.setHours(0,0,0,0); var diffDays = Math.round((d.getTime() - TODAY_FOR_HIDE.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 14;
}

function getFilteredConcerts(concerts){
  var visible = sortConcertsByDateAsc((concerts || []).filter(shouldShowConcert));
  if(currentFilter === "available") return visible.filter(function(c){return getAvailableCount(c) > 0;});
  if(currentFilter === "full") return visible.filter(function(c){return getAvailableCount(c) === 0;});
  if(currentFilter === "soon") return visible.filter(isSoonConcert);
  return visible;
}

function renderEmptyState(message,detail){
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML='<div class="empty-state"><div class="empty-emoji">💙</div><h3>'+message+'</h3><p>'+(detail||'ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย')+'</p><a class="empty-line-btn" href="'+LINE_DIRECT_URL+'" target="_blank" rel="noopener">ทัก LINE OA</a></div>';
}

function updateFilterButtons(){
  document.querySelectorAll(".filter-btn").forEach(function(btn){
    var active = btn.getAttribute("data-filter") === currentFilter;
    btn.classList.toggle("active", active); btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setFilter(filter){ currentFilter = filter || "all"; updateFilterButtons(); renderConcerts(concertsData); }

function renderConcerts(concerts){
  var el=document.getElementById("content"); if(!el)return; el.innerHTML="";
  if(!concerts||!concerts.length){ renderEmptyState("ยังไม่มีข้อมูลงานตอนนี้น้า 💙"); return; }
  var visibleConcerts = getFilteredConcerts(concerts);
  if(!visibleConcerts.length){ renderEmptyState("ยังไม่มีงานในหมวดหมู่นี้น้า 💙"); return; }

  var grid=document.createElement("div"); grid.className="poster-grid";
  visibleConcerts.forEach(function(c){
    var availableCount=getAvailableCount(c), available
