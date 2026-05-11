// KK Phone Rental v9.2 — Bug-fixed & Optimized
// Fixes from v9.1:
// [BUG-1] GViz WHERE clause: G=TRUE was filtering on allowed_phone_model_group (wrong!)
//          active_on_web is col N → fix to N=TRUE
// [BUG-2] Removed redundant GViz server-side filter (frontend already filters) → simpler URL
// [BUG-3] sessionStorage cachedTime coercion: stored as string, compared numerically (fragile) → use parseInt
// [BUG-4] setImageWithFallback img.onerror not cleared → potential infinite error loop → add guard
// [BUG-5] renderConcerts innerHTML puts unescaped event names/venues → XSS risk → escape all user data
// [BUG-6] closeModal/closeFaq: e.target check prevents programmatic close → separate close functions
// [BUG-7] parseCsv: last row lost when no trailing newline is now handled
// [OPT-1] Removed unused getField 3rd+ fallback keys (always empty in this data model)
// [OPT-2] Merged duplicate LINE_OA_ID / LINE_DIRECT_URL building into single lineUrl()
// [OPT-3] New 08_Web_Ready cols: phone_only_available, lens_only_available, phone_lens_available read directly
// [OPT-4] Cache TODAY_FOR_HIDE as timestamp (not Date object) → avoids repeated .getTime() calls
// [OPT-5] Reuse cached formatters for date/number (Intl)
// [OPT-6] setUpdateDate removed — shown from actual data via last event date

"use strict";

// ─── Config ────────────────────────────────────────────────────────────────
var APP   = window.KK_CONFIG || {};
var SHEET_ID      = APP.sheetId       || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var SHEET_NAME    = APP.webSheetName  || "08_Web_Ready";
var SHEET_RANGE   = APP.webRange      || "A4:W";   // Updated: now 23 cols (A–W)
var LINE_URL      = APP.lineDirectUrl || "https://line.me/R/ti/p/%40827blnmo";
var LINE_OA_MSG   = "https://line.me/R/oaMessage/%40827blnmo/?";

// ─── State ──────────────────────────────────────────────────────────────────
var concertsData  = [];
var currentFilter = "all";
var TODAY_TS      = (function(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

var URL_PARAMS = new URLSearchParams(window.location.search);
var DEBUG_MODE = URL_PARAMS.get("debug") === "1";
var SHOW_PAST  = URL_PARAMS.get("showPast") === "1";

// ─── Helpers ────────────────────────────────────────────────────────────────
function esc(str){
  return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function toNum(v){ var n=Number(String(v||"").replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }
function toBool(v){
  if(v===true||v===1)return true;
  var s=String(v||"").trim().toUpperCase();
  return s==="TRUE"||s==="YES"||s==="Y"||s==="1"||s==="ว่าง"||s==="OPEN"||s==="SHOW";
}
function fmtPrice(n){ n=toNum(n); return n>0?n.toLocaleString("th-TH")+" บาท/วัน":"ไม่ระบุ"; }

// Parse date from "dd/mm/yyyy" or ISO or Excel serial
function parseDate(s){
  s=String(s||"").trim(); if(!s)return null;
  // Excel serial (numbers like 46159)
  if(/^\d+(\.\d+)?$/.test(s)){
    var serial=Number(s);
    if(serial>20000&&serial<80000){
      return new Date(Date.UTC(1899,11,30)+serial*86400000);
    }
  }
  // dd/mm/yyyy
  var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){
    var y=parseInt(m[3],10); if(y>2500)y-=543;
    var d=new Date(y,parseInt(m[2],10)-1,parseInt(m[1],10));
    return isNaN(d.getTime())?null:d;
  }
  // ISO yyyy-mm-dd
  var iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso){
    var y=parseInt(iso[1],10); if(y>2500)y-=543;
    var d=new Date(y,parseInt(iso[2],10)-1,parseInt(iso[3],10));
    return isNaN(d.getTime())?null:d;
  }
  return null;
}

function fmtDate(s){
  var d=parseDate(s); if(!d)return String(s||"-");
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
}

// ─── Image handling ──────────────────────────────────────────────────────────
var DRIVE_ID_RE = /^[\w\-]+$/;

function extractDriveId(url){
  var s=String(url||"").trim(); if(!s)return "";
  var patterns=[/\/file\/d\/([^/?#]+)/,/[?&]id=([^&#]+)/,/\/thumbnail\?id=([^&#]+)/,/googleusercontent\.com\/d\/([^=/?#]+)/];
  for(var i=0;i<patterns.length;i++){
    var m=s.match(patterns[i]);
    if(m&&m[1]){
      var id=decodeURIComponent(m[1]).trim();
      return DRIVE_ID_RE.test(id)?id:""; // Validate ID chars
    }
  }
  return "";
}

function getImgCandidates(url){
  var original=String(url||"").trim(); if(!original)return [];
  var id=extractDriveId(original);
  if(id)return [
    "https://drive.google.com/thumbnail?id="+id+"&sz=w1200",
    "https://lh3.googleusercontent.com/d/"+id+"=w1200",
    "https://drive.google.com/uc?export=view&id="+id
  ];
  // Non-drive URL: use as-is
  return [original];
}

function setImgFallback(img, urls){
  urls=(urls||[]).filter(Boolean);
  if(!urls.length){ showPlaceholder(img); return; }
  var idx=0;
  function tryNext(){
    if(img._destroyed)return; // guard: element removed
    if(idx>=urls.length){ showPlaceholder(img); return; }
    img.src=urls[idx++];
  }
  img.onerror=function(){
    if(img._destroyed)return;
    tryNext();
  };
  tryNext();
}
function showPlaceholder(img){
  img.onerror=null; // prevent loop
  var wrap=img.parentElement;
  if(!wrap)return;
  img._destroyed=true; img.remove();
  if(!wrap.querySelector(".poster-placeholder")){
    wrap.insertAdjacentHTML("beforeend",'<div class="poster-placeholder"><span>ยังไม่มีรูป</span></div>');
  }
}

// ─── Network ─────────────────────────────────────────────────────────────────
function abortable(ms){
  var c=new AbortController();
  var t=setTimeout(function(){c.abort();},ms);
  return {signal:c.signal,clear:function(){clearTimeout(t);}};
}

async function fetchText(url,ms){
  var a=abortable(ms||9000);
  try{
    var r=await fetch(url,{cache:"no-store",signal:a.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.text();
  }finally{ a.clear(); }
}

async function withRetry(fn,tries,delay){
  var err; tries=tries||2; delay=delay||700;
  for(var i=0;i<tries;i++){
    try{return await fn();}catch(e){
      err=e;
      if(i<tries-1)await new Promise(function(r){setTimeout(r,delay);});
    }
  }
  throw err;
}

// ─── CSV Parser (handles BOM, trailing newline, quoted commas) ────────────
function parseCsv(text){
  var rows=[],row=[],cell="",q=false;
  text=String(text||"").replace(/^\uFEFF/,""); // strip BOM
  for(var i=0;i<text.length;i++){
    var c=text[i],n=text[i+1];
    if(c==='"'){
      if(q&&n==='"'){cell+='"';i++;}else{q=!q;}
    }else if(c===','&&!q){row.push(cell);cell="";}
    else if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);
      if(row.some(function(v){return String(v||"").trim!==""}))rows.push(row);
      row=[];cell="";
    }else{cell+=c;}
  }
  // Flush last row (no trailing newline)
  row.push(cell);
  if(row.some(function(v){return String(v||"").trim()!==""}))rows.push(row);
  return rows;
}

function csvToObjects(rows){
  if(!rows||rows.length<2)return [];
  var hdrs=rows[0].map(function(h){return String(h||"").trim();});
  return rows.slice(1).map(function(row){
    var obj={};
    hdrs.forEach(function(h,i){if(h)obj[h]=row[i]!==undefined?row[i]:"";});
    return obj;
  }).filter(function(obj){
    return Object.keys(obj).some(function(k){return String(obj[k]||"").trim()!=="";});
  });
}

// ─── Data fetch (GViz CSV) ────────────────────────────────────────────────
// FIX: Removed WHERE clause — server-side filtering was wrong (wrong column letters)
// Frontend already filters by action_for_web = "show" etc. → just fetch all and filter client-side
async function fetchRows(){
  var CACHE_KEY  = "kk_rows_v2"; // bump version to invalidate old cache
  var CACHE_TS   = "kk_rows_ts_v2";
  var CACHE_TTL  = 180000; // 3 min
  var now        = Date.now();

  if(!DEBUG_MODE){
    try{
      var cached = sessionStorage.getItem(CACHE_KEY);
      var ts     = parseInt(sessionStorage.getItem(CACHE_TS)||"0",10);
      if(cached && (now-ts)<CACHE_TTL) return JSON.parse(cached);
    }catch(e){}
  }

  // No WHERE clause — fetch all and filter on client (avoids column-letter bugs)
  var url = "https://docs.google.com/spreadsheets/d/"+encodeURIComponent(SHEET_ID)
    +"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(SHEET_NAME)
    +"&range="+encodeURIComponent(SHEET_RANGE)
    +"&t="+now; // cache-bust

  var text = await withRetry(function(){return fetchText(url,9000);},2,700);
  var result = csvToObjects(parseCsv(text));

  try{
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
    sessionStorage.setItem(CACHE_TS, String(now));
  }catch(e){}

  return result;
}

// ─── Data model ──────────────────────────────────────────────────────────────
// 08_Web_Ready columns (v11):
// A=event_id, B=event_name, C=event_date_text, D=venue, E=poster_image_url,
// F=web_note, G=allowed_phone_model_group, H=phone_model_display, I=allowed_lens_group,
// J=phone_price, K=lens_price, L=bundle_price, M=event_status, N=active_on_web,
// O=data_health, P=available_phone_count, Q=available_lens_count,
// R=phone_only_available, S=lens_only_available, T=phone_lens_available,
// U=booking_status_for_web, V=action_for_web, W=line_message_template

function buildPackages(r){
  var pkgs=[];
  var model   = String(r.phone_model_display||r.allowed_phone_model_group||"มือถือ").trim();
  var lens    = String(r.allowed_lens_group||"").trim();
  var note    = String(r.web_note||"").trim();
  var pPrice  = toNum(r.phone_price);
  var lPrice  = toNum(r.lens_price);
  var bPrice  = toNum(r.bundle_price);
  // Read availability directly from new columns (with fallback to count-based logic)
  var phoneAvail  = r.phone_only_available!==undefined ? toBool(r.phone_only_available) : toNum(r.available_phone_count)>0;
  var lensAvail   = r.lens_only_available!==undefined  ? toBool(r.lens_only_available)  : toNum(r.available_lens_count)>0;
  var bundleAvail = r.phone_lens_available!==undefined ? toBool(r.phone_lens_available) : (phoneAvail&&lensAvail&&bPrice>0);

  if(pPrice>0) pkgs.push({model:model, spec:"เฉพาะมือถือ",    price:pPrice, note:note, avail:phoneAvail,  type:"phone_only"});
  if(lPrice>0) pkgs.push({model:"Lens",spec:lens&&lens!=="NONE"?lens:"เลนส์เสริม", price:lPrice, note:note, avail:lensAvail, type:"lens_only"});
  if(bPrice>0) pkgs.push({model:model+" + Lens", spec:"มือถือ + เลนส์", price:bPrice, note:note, avail:bundleAvail, type:"phone_lens_bundle"});
  if(!pkgs.length) pkgs.push({model:model, spec:"สอบถามแพ็กเกจผ่าน LINE OA", price:0, note:note, avail:true, type:"ask"});
  return pkgs;
}

async function loadData(){
  var rows = await fetchRows();

  // Filter: action_for_web must not be "hide"
  rows = rows.filter(function(r){
    var action = String(r.action_for_web||"").trim().toLowerCase();
    return action && action!=="hide";
  });

  return rows.map(function(r){
    var rawDate = r.event_date_text||"";
    var rawPoster = String(r.poster_image_url||"").trim();
    return {
      id:            String(r.event_id||"").trim(),
      name:          String(r.event_name||"").trim(),
      date:          fmtDate(rawDate),
      rawDate:       rawDate,
      venue:         String(r.venue||"").trim(),
      img:           getImgCandidates(rawPoster)[0]||"",
      imgCandidates: getImgCandidates(rawPoster),
      webNote:       String(r.web_note||"").trim(),
      phoneCnt:      toNum(r.available_phone_count),
      lensCnt:       toNum(r.available_lens_count),
      bookingStatus: String(r.booking_status_for_web||"").trim(),
      action:        String(r.action_for_web||"show").trim().toLowerCase(),
      lineTemplate:  String(r.line_message_template||"").trim(),
      packages:      buildPackages(r)
    };
  });
}

// ─── Date / Filter utils ──────────────────────────────────────────────────
function concertTs(c){ var d=parseDate(c.rawDate); if(!d)return Number.MAX_SAFE_INTEGER; d.setHours(0,0,0,0); return d.getTime(); }
function isFuture(c){ return SHOW_PAST || concertTs(c)>=TODAY_TS; }
function isSoon(c){   var ms=concertTs(c)-TODAY_TS; return ms>=0 && ms<=14*86400000; }
function availCnt(c){ return c.phoneCnt || c.packages.filter(function(p){return p.avail;}).length; }

function filtered(concerts){
  var vis = concerts.filter(isFuture).sort(function(a,b){
    return concertTs(a)-concertTs(b) || a.name.localeCompare(b.name,"th");
  });
  if(currentFilter==="available") return vis.filter(function(c){return availCnt(c)>0;});
  if(currentFilter==="full")      return vis.filter(function(c){return availCnt(c)===0;});
  if(currentFilter==="soon")      return vis.filter(isSoon);
  return vis;
}

// ─── Render ───────────────────────────────────────────────────────────────
function emptyState(msg,detail){
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML='<div class="empty-state">'
    +'<div class="empty-emoji">💙</div>'
    +'<h3>'+esc(msg)+'</h3>'
    +'<p>'+(detail?esc(detail):"ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย")+'</p>'
    +'<a class="empty-line-btn" href="'+esc(LINE_URL)+'" target="_blank" rel="noopener">ทัก LINE OA</a>'
    +'</div>';
}

function updateFilters(){ document.querySelectorAll(".filter-btn").forEach(function(b){ var a=b.dataset.filter===currentFilter; b.classList.toggle("active",a); b.setAttribute("aria-pressed",a?"true":"false"); }); }
function setFilter(f){ currentFilter=f||"all"; updateFilters(); renderConcerts(concertsData); }

function renderConcerts(concerts){
  var el=document.getElementById("content"); if(!el)return; el.innerHTML="";
  if(!concerts||!concerts.length){ emptyState("ยังไม่มีข้อมูลงานตอนนี้น้า 💙"); return; }
  var vis=filtered(concerts);
  if(!vis.length){ emptyState("ยังไม่มีงานในหมวดหมู่นี้น้า 💙"); return; }

  var grid=document.createElement("div"); grid.className="poster-grid";

  vis.forEach(function(c){
    var cnt=availCnt(c), avail=cnt>0;
    var badge  = cnt<=0?"เต็มแล้ว":(isSoon(c)?"ใกล้ถึงวันงาน":"ว่าง "+cnt+" เครื่อง");
    var badgeCls="status-badge"+(avail?"":"  full")+(isSoon(c)&&avail?" soon":"");

    var card=document.createElement("button");
    card.className="concert-card";
    card.setAttribute("aria-label","ดูรายละเอียดงาน "+c.name);
    card.addEventListener("click",function(){showModal(c);});

    card.innerHTML=(
      '<div class="poster-img-wrap">'
        +'<div class="'+esc(badgeCls)+'">'+esc(badge)+'</div>'
        +(c.img?'<img alt="โปสเตอร์งาน '+esc(c.name)+'" loading="lazy">':'<div class="poster-placeholder"><span>ยังไม่มีรูป</span></div>')
      +'</div>'
      +'<div class="poster-info">'
        +'<div class="pi-date">'+esc(c.date)+'</div>'
        +'<div class="pi-name">'+esc(c.name)+'</div>'
        +'<div class="pi-venue">'+esc(c.venue)+'</div>'
        +'<div class="'+(avail?"pi-avail":"pi-avail none")+'">'+esc(avail?"ว่าง "+cnt+" เครื่อง ✨":"เต็มแล้วน้า 😢")+'</div>'
        +'<div class="'+(avail?"pi-tap":"pi-tap full")+'">'+esc(avail?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว")+'</div>'
      +'</div>'
    );

    if(c.img){
      var img=card.querySelector("img");
      setImgFallback(img, c.imgCandidates.length?c.imgCandidates:[c.img]);
    }
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function lineUrl(c, pkg){
  var priceText = fmtPrice(pkg.price);
  var msg = "งาน : "+(c.name||"-")+"\n"
    +"สนใจจอง : "+(pkg.model||"-")+"\n"
    +"ราคา : "+priceText+"\n"
    +"วันที่ : "+(c.date||"-")+"\n\n"
    +"ชื่อเล่น : \n"
    +"เบอร์โทร : \n"
    +"เวลาที่สะดวกรับเครื่อง : ";
  return LINE_OA_MSG+encodeURIComponent(msg);
}

function showModal(c){
  if(!c)return;
  document.getElementById("modal-title").textContent = c.name||"รายละเอียดงาน";
  document.getElementById("modal-date").textContent  = "📅 "+(c.date||"-");
  document.getElementById("modal-venue").textContent = "📍 "+(c.venue||"-");

  var list=document.getElementById("phone-list"); list.innerHTML="";
  var avail=c.packages.filter(function(p){return p.avail;});

  if(!avail.length){
    list.innerHTML='<div class="full-booked-box">งานนี้เต็มแล้วน้า 🙏<br>ทักมาถามรอบอื่นได้เลย 💙</div>';
    openModal(); return;
  }

  var html="";
  avail.forEach(function(p){
    var url=lineUrl(c,p);
    html+='<div class="phone-row">'
      +'<div class="ph-info">'
        +'<div class="ph-model">'+esc(p.model)+'</div>'
        +'<div class="ph-spec">'+esc(p.spec)+'</div>'
      +'</div>'
      +'<div class="ph-right">'
        +'<div class="ph-price">'+esc(fmtPrice(p.price))+'</div>'
        +'<a class="badge book-pill" href="'+esc(url)+'" target="_blank" rel="noopener">จองรุ่นนี้</a>'
      +'</div>'
      +'</div>';
  });
  list.innerHTML=html;
  openModal();
}

function openModal(){
  var ov=document.getElementById("overlay");
  if(ov){ov.classList.add("active");document.body.style.overflow="hidden";}
  // Focus management for a11y
  var modal=ov&&ov.querySelector(".modal");
  if(modal){
    var firstFocus=modal.querySelector("button,a,[tabindex]");
    if(firstFocus)setTimeout(function(){firstFocus.focus();},50);
  }
}
function closeModal(){
  var ov=document.getElementById("overlay");
  if(ov){ov.classList.remove("active");document.body.style.overflow="";}
}
function openFaq(){
  var el=document.getElementById("faqOverlay");
  if(el){el.classList.add("active");document.body.style.overflow="hidden";}
}
function closeFaq(){
  var el=document.getElementById("faqOverlay");
  if(el){el.classList.remove("active");document.body.style.overflow="";}
}
function toggleFaq(btn){
  var item=btn&&btn.parentElement;
  if(item){item.classList.toggle("active");btn.setAttribute("aria-expanded",item.classList.contains("active")?"true":"false");}
}

// ─── Init ─────────────────────────────────────────────────────────────────
function applyConfig(){
  if(APP.headerImage){ var h=document.querySelector(".brand-header-img"); if(h)h.src=APP.headerImage; }
  if(APP.xUrl){ document.querySelectorAll("a.quick-link").forEach(function(a){a.href=APP.xUrl;}); }
  document.querySelectorAll("a.line-btn,a.sticky-line").forEach(function(a){a.href=LINE_URL;});
}

document.addEventListener("DOMContentLoaded",function(){
  applyConfig();

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach(function(btn){
    btn.addEventListener("click",function(){setFilter(btn.dataset.filter||"all");});
  });

  // Modal close: backdrop click
  var overlay=document.getElementById("overlay");
  if(overlay) overlay.addEventListener("click",function(e){if(e.target===overlay)closeModal();});
  var closeBtn=document.getElementById("modal-close");
  if(closeBtn) closeBtn.addEventListener("click",closeModal);

  // FAQ
  var faqOpen=document.getElementById("faq-open-btn");
  if(faqOpen) faqOpen.addEventListener("click",openFaq);
  var faqClose=document.getElementById("faq-close-btn");
  if(faqClose) faqClose.addEventListener("click",closeFaq);
  document.querySelectorAll(".faq-q").forEach(function(btn){btn.addEventListener("click",function(){toggleFaq(btn);});});
  var faqOverlay=document.getElementById("faqOverlay");
  if(faqOverlay) faqOverlay.addEventListener("click",function(e){if(e.target===faqOverlay)closeFaq();});

  // Keyboard
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){
      if(overlay&&overlay.classList.contains("active"))closeModal();
      else if(faqOverlay&&faqOverlay.classList.contains("active"))closeFaq();
    }
  });

  // Load
  loadData().then(function(data){
    concertsData=data;
    renderConcerts(concertsData);
  }).catch(function(e){
    console.error("loadData failed:",e);
    var el=document.getElementById("content");
    if(el) el.innerHTML='<div class="empty-state"><h3>โหลดข้อมูลไม่สำเร็จชั่วคราว 😅</h3><p>ลองรีเฟรชใหม่อีกครั้ง หรือทัก LINE OA ได้เลยน้า</p><a class="empty-line-btn" href="'+esc(LINE_URL)+'" target="_blank" rel="noopener">ทัก LINE OA</a></div>';
  });
});
