// KK Phone Rental v8 — Optimized Backend (Single Source)
// - ลบการดึงข้อมูลซ้ำซ้อน 2 ชีตออก ดึงแค่ 08_Web_Ready หน้าเดียว
// - เพิ่มประสิทธิภาพการทำงานให้โหลดเร็วขึ้น
// - จัดการ Filter, Badge, Lazy Image อย่างครบถ้วน

var APP_CONFIG = window.KK_CONFIG || {};
var SHEET_ID = APP_CONFIG.sheetId || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var WEB_SHEET_NAME = APP_CONFIG.webSheetName || "08_Web_Ready";
var WEB_RANGE = APP_CONFIG.webRange || "A4:AA";
var LINE_OA_ID = APP_CONFIG.lineOAId || "@827blnmo";
var LINE_DIRECT_URL = APP_CONFIG.lineDirectUrl || "https://line.me/R/ti/p/%40827blnmo";

var concertsData = [];
var currentFilter = "all";

// --- ส่วนจัดการตั้งค่าและ UI ---
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

function showBrandFallback(){
  var a=document.getElementById("brandImageCard"),b=document.getElementById("brandFallback");
  if(a)a.style.display="none"; if(b)b.style.display="flex";
}

function setUpdateDate(){
  var n=new Date(),dd=String(n.getDate()).padStart(2,"0"),mm=String(n.getMonth()+1).padStart(2,"0"),yyyy=n.getFullYear(),hh=String(n.getHours()).padStart(2,"0"),min=String(n.getMinutes()).padStart(2,"0");
  var el=document.getElementById("update-note");
  if(el)el.textContent="อัปเดตล่าสุด: "+dd+"/"+mm+"/"+yyyy+" "+hh+":"+min;
}

// --- ส่วนจัดการรูปภาพ ---
function extractGoogleDriveFileId(url){
  var s=String(url||"").trim();
  if(!s)return "";
  var patterns=[/\/file\/d\/([^/?#]+)/,/[?&]id=([^&#]+)/,/\/thumbnail\?id=([^&#]+)/,/googleusercontent\.com\/d\/([^=/?#]+)/];
  for(var i=0;i<patterns.length;i++){
    var m=s.match(patterns[i]);
    if(m&&m[1])return decodeURIComponent(m[1]).trim();
  }
  return "";
}

function getImageCandidates(url){
  var original=String(url||"").trim();
  if(!original)return [];
  var id=extractGoogleDriveFileId(original);
  if(id){
    return [
      "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1200",
      "https://lh3.googleusercontent.com/d/"+encodeURIComponent(id)+"=w1200",
      "https://drive.google.com/uc?export=view&id="+encodeURIComponent(id)
    ];
  }
  return [original];
}

function normalizeImageUrl(url){
  var list=getImageCandidates(url);
  return list.length?list[0]:"";
}

function setImageWithFallback(img, urls){
  urls=(urls||[]).filter(Boolean);
  var index=0;
  function setNext(){
    if(index>=urls.length)return false;
    img.src=urls[index++];
    return true;
  }
  img.onerror=function(){
    if(!setNext()){
      var wrap=img.parentElement;
      img.remove();
      if(wrap && !wrap.querySelector(".poster-placeholder")){
        var ph=document.createElement("div");
        ph.className="poster-placeholder";
        ph.innerHTML='<span>ยังไม่มีรูป</span>';
        wrap.appendChild(ph);
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

async function retry(fn,tries,delay){
  var lastError;
  tries=tries||2; delay=delay||650;
  for(var i=0;i<tries;i++){
    try{return await fn();}
    catch(e){ lastError=e; if(i<tries-1)await new Promise(function(resolve){setTimeout(resolve,delay);}); }
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
    }else if(ch===',' && !insideQuotes){
      row.push(value); value="";
    }else if((ch==='\n'||ch==='\r') && !insideQuotes){
      if(ch==='\r' && next==='\n') i++;
      row.push(value);
      if(row.some(function(cell){return String(cell||"").trim()!=="";})) rows.push(row);
      row=[]; value="";
    }else{ value+=ch; }
  }
  row.push(value);
  if(row.some(function(cell){return String(cell||"").trim()!=="";})) rows.push(row);
  return rows;
}

function csvRowsToObjects(rows){
  if(!rows||rows.length<2)return [];
  var headers=rows[0].map(function(h){return String(h||"").trim();});
  return rows.slice(1).map(function(row){
    var obj={};
    headers.forEach(function(h,i){if(h)obj[h]=row[i]!==undefined?row[i]:"";});
    return obj;
  }).filter(function(obj){
    return Object.keys(obj).some(function(k){return String(obj[k]||"").trim()!=="";});
  });
}

// ตัวช่วยแปลงข้อมูล
function getField(row, keys) {
  if (!row) return "";
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function formatPrice(num) {
  var n = Number(num);
  if (isNaN(n) || n <= 0) return "0";
  return n.toLocaleString("th-TH") + " บาท/วัน";
}

function toBool(value){
  if(value===true)return true;
  var v=String(value||"").trim().toUpperCase();
  return v==="TRUE"||v==="YES"||v==="Y"||v==="1"||v==="ว่าง"||v==="OPEN"||v==="SHOW";
}

function toNumber(value){
  var n=Number(String(value||"").replace(/[^0-9.\-]/g,""));
  return isNaN(n)?0:n;
}

function formatDateFromSerial(serial){
  var n=Number(serial);
  if(!n||isNaN(n))return String(serial||"");
  var d=new Date(Date.UTC(1899,11,30)+n*86400000);
  return String(d.getUTCDate()).padStart(2,"0")+"/"+String(d.getUTCMonth()+1).padStart(2,"0")+"/"+d.getUTCFullYear();
}

async function fetchTextWithTimeout(url,ms){
  var t=timeoutSignal(ms||9000);
  try{
    var res=await fetch(url,{cache:"no-store",signal:t.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    return await res.text();
  }finally{ t.clear(); }
}

// 🔵 โหลดข้อมูลจากชีต 08_Web_Ready ที่เดียว (Single Source)
async function fetchWebReadyRows(){
  var url="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(WEB_SHEET_NAME)+"&range="+encodeURIComponent(WEB_RANGE);
  var csv=await retry(function(){return fetchTextWithTimeout(url,9000);},2,700);
  return csvRowsToObjects(parseCsv(csv));
}

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

// 🔵 นำข้อมูลมาจัดรูปแบบ (ไม่ต้องผสม 2 ไฟล์แล้ว)
async function loadData(){
  var rows = await fetchWebReadyRows();
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

// --- ส่วนกรองวันที่และการแสดงผล ---
function isValidDateParts(dateObj,year,monthIndex,day){
  return dateObj instanceof Date && !isNaN(dateObj.getTime()) && dateObj.getFullYear()===year && dateObj.getMonth()===monthIndex && dateObj.getDate()===day;
}

function parseEventDate(dateStr){
  var s = String(dateStr || "").trim();
  if(!s) return null;
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){
    var d1 = parseInt(m[1],10), mo1 = parseInt(m[2],10) - 1, y1 = parseInt(m[3],10);
    if(y1 > 2500) y1 -= 543;
    var date1 = new Date(y1, mo1, d1);
    return isValidDateParts(date1,y1,mo1,d1) ? date1 : null;
  }
  return null;
}

function shouldShowConcert(concert){
  if(SHOW_PAST) return true;
  var d = parseEventDate(concert && concert.date);
  if(!d) return true;
  d.setHours(0,0,0,0);
  return d >= TODAY_FOR_HIDE;
}

function getConcertSortTime(concert){
  var d = parseEventDate(concert && concert.date);
  if(!d) return Number.MAX_SAFE_INTEGER;
  d.setHours(0,0,0,0);
  return d.getTime();
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
  var d = parseEventDate(concert && concert.date);
  if(!d) return false;
  d.setHours(0,0,0,0);
  var diffDays = Math.round((d.getTime() - TODAY_FOR_HIDE.getTime()) / 86400000);
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
  var el=document.getElementById("content");
  if(!el)return;
  el.innerHTML='<div class="empty-state"><div class="empty-emoji">💙</div><h3>'+message+'</h3><p>'+(detail||'ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย')+'</p><a class="empty-line-btn" href="'+LINE_DIRECT_URL+'" target="_blank" rel="noopener">ทัก LINE OA</a></div>';
}

function updateFilterButtons(){
  document.querySelectorAll(".filter-btn").forEach(function(btn){
    var active = btn.getAttribute("data-filter") === currentFilter;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setFilter(filter){
  currentFilter = filter || "all";
  updateFilterButtons();
  renderConcerts(concertsData);
}

function renderConcerts(concerts){
  var el=document.getElementById("content");
  if(!el)return; el.innerHTML="";
  if(!concerts||!concerts.length){ renderEmptyState("ยังไม่มีข้อมูลงานตอนนี้น้า 💙"); return; }
  var visibleConcerts = getFilteredConcerts(concerts);
  if(!visibleConcerts.length){ renderEmptyState("ยังไม่มีงานในหมวดหมู่นี้น้า 💙"); return; }

  var grid=document.createElement("div"); grid.className="poster-grid";
  visibleConcerts.forEach(function(c){
    var availableCount=getAvailableCount(c), available=availableCount>0;
    var card=document.createElement("button"); card.className="concert-card"; card.onclick=function(){showModal(c);};
    var imgWrap=document.createElement("div"); imgWrap.className="poster-img-wrap";
    
    var badgeText = availableCount <= 0 ? "เต็มแล้ว" : (isSoonConcert(c) ? "ใกล้ถึงวันงาน" : "ว่าง " + availableCount + " เครื่อง");
    var badge=document.createElement("div"); badge.className="status-badge"+(available?"":" full")+(isSoonConcert(c)&&available?" soon":""); badge.textContent=badgeText; imgWrap.appendChild(badge);
    
    var imgUrl=c.img?String(c.img).trim():"";
    if(imgUrl){
      var img=document.createElement("img"); img.alt=c.name; img.loading="lazy";
      setImageWithFallback(img, c.imgCandidates&&c.imgCandidates.length?c.imgCandidates:[imgUrl]);
      imgWrap.appendChild(img);
    }else{
      var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML='<span>ยังไม่มีรูป</span>'; imgWrap.appendChild(ph);
    }
    
    var info=document.createElement("div"); info.className="poster-info";
    var date=document.createElement("div"); date.className="pi-date"; date.textContent=c.date||"";
    var name=document.createElement("div"); name.className="pi-name"; name.textContent=c.name||"";
    var avail=document.createElement("div"); avail.className="pi-avail"+(available?"":" none"); avail.textContent=available?"ว่าง "+availableCount+" เครื่อง ✨":"เต็มแล้วน้า 😢";
    var tap=document.createElement("div"); tap.className="pi-tap"+(available?"":" full"); tap.textContent=available?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว";
    
    info.appendChild(date); info.appendChild(name); info.appendChild(avail); info.appendChild(tap);
    card.appendChild(imgWrap); card.appendChild(info); grid.appendChild(card);
  });
  el.appendChild(grid);
}

function showModal(input){
  var c = (typeof input === "number") ? concertsData[input] : input;
  if(!c)return;
  document.getElementById("modal-title").textContent=c.name||"รายละเอียดงาน";
  document.getElementById("modal-date").textContent="📅 "+(c.date||"-");
  document.getElementById("modal-venue").textContent="📍 "+(c.venue||"-");
  var list=document.getElementById("phone-list"); list.innerHTML="";
  
  var availablePhones=getAvailablePhones(c);
  if(!availablePhones.length){ list.innerHTML='<div class="full-booked-box">งานนี้เต็มแล้วน้า 🙏<br>ทักมาถามรอบอื่นได้เลย 💙</div>'; openModal(); return; }
  
  availablePhones.forEach(function(p){
    var row=document.createElement("div"); row.className="phone-row";
    var info=document.createElement("div"); info.className="ph-info";
    var model=document.createElement("div"); model.className="ph-model"; model.textContent=p.model||"";
    var spec=document.createElement("div"); spec.className="ph-spec"; spec.textContent=p.spec||"";
    info.appendChild(model); info.appendChild(spec);
    
    var right=document.createElement("div"); right.className="ph-right";
    var price=document.createElement("div"); price.className="ph-price"; price.textContent=formatPrice(p.price);
    
    var msg = (c.lineTemplate||"สนใจจองเช่ามือถือค่ะ")+"\nงาน: "+c.name+"\nแพ็กเกจ: "+p.model;
    var link = "https://line.me/R/oaMessage/"+encodeURIComponent(LINE_OA_ID)+"/?"+encodeURIComponent(msg);
    var btn=document.createElement("a"); btn.className="badge book-pill"; btn.textContent="จองรุ่นนี้"; btn.href=link; btn.target="_blank";
    
    right.appendChild(price); right.appendChild(btn);
    row.appendChild(info); row.appendChild(right); list.appendChild(row);
  });
  openModal();
}

function openModal(){ document.getElementById("overlay").classList.add("active"); document.body.style.overflow="hidden"; }
function closeModal(e){ if(e && e.target!==document.getElementById("overlay"))return; document.getElementById("overlay").classList.remove("active"); document.body.style.overflow=""; }

// --- Event Listeners เริ่มต้นระบบ ---
document.addEventListener("DOMContentLoaded",function(){
  applyConfigToDom(); setUpdateDate();
  
  document.querySelectorAll(".filter-btn").forEach(function(btn){
    btn.addEventListener("click",function(){setFilter(btn.getAttribute("data-filter") || "all");});
  });
  
  var overlay=document.getElementById("overlay");
  if(overlay)overlay.addEventListener("click",closeModal);
  var closeBtn=document.getElementById("modal-close");
  if(closeBtn)closeBtn.addEventListener("click",function(){closeModal();});

  loadData().then(function(concerts){
    concertsData=concerts; renderConcerts(concertsData);
  }).catch(function(e){
    var el=document.getElementById("content");
    if(el)el.innerHTML='<div class="empty-state"><h3>โหลดข้อมูลไม่สำเร็จชั่วคราว</h3><p>ลองรีเฟรชใหม่อีกครั้งนะครับ</p></div>';
  });
});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&document.getElementById("overlay").classList.contains("active"))closeModal();
});
