// KK Phone Rental v7 — Frontend Optimized
// - Config แยกไว้ใน config.js
// - Filter งาน / Badge สถานะ / Empty state / Error state
// - Lazy image + fallback image

var APP_CONFIG = window.KK_CONFIG || {};
var SHEET_ID = APP_CONFIG.sheetId || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var LINE_OA_ID = APP_CONFIG.lineOAId || "@827blnmo";
var LINE_DIRECT_URL = APP_CONFIG.lineDirectUrl || "https://line.me/R/ti/p/%40827blnmo";
var concertsData = [];
var currentFilter = "all";

// Hide past events
var TODAY_FOR_HIDE = new Date();
TODAY_FOR_HIDE.setHours(0,0,0,0);

// Owner review modes:
// ?debug=1      = แสดง label เตือนถ้าวันที่อ่านไม่ได้
// ?showPast=1   = แสดงงานย้อนหลังด้วย
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

function normalizeImageUrl(url){
  url=String(url||"").trim();
  if(!url)return "";
  var m=url.match(/\/file\/d\/([^/]+)/);
  if(m&&m[1])return "https://lh3.googleusercontent.com/d/"+m[1]+"=w1200";
  var id=url.match(/[?&]id=([^&]+)/);
  if(id&&id[1])return "https://lh3.googleusercontent.com/d/"+id[1]+"=w1200";
  return url;
}

function timeoutSignal(ms){
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},ms);
  return {signal:controller.signal,clear:function(){clearTimeout(timer);}};
}

async function fetchJsonWithTimeout(url,ms){
  var t=timeoutSignal(ms||9000);
  try{
    var res=await fetch(url,{cache:"default",signal:t.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    return await res.json();
  }finally{
    t.clear();
  }
}

async function retry(fn,tries,delay){
  var lastError;
  tries=tries||2;
  delay=delay||650;
  for(var i=0;i<tries;i++){
    try{return await fn();}
    catch(e){
      lastError=e;
      if(i<tries-1)await new Promise(function(resolve){setTimeout(resolve,delay);});
    }
  }
  throw lastError;
}

async function fetchSheet(sheetName){
  var url="https://opensheet.elk.sh/"+SHEET_ID+"/"+encodeURIComponent(sheetName);
  return retry(function(){return fetchJsonWithTimeout(url,9000);},2,700);
}

function getField(row,fields){
  for(var i=0;i<fields.length;i++){
    var f=fields[i];
    if(row[f]!==undefined&&row[f]!==null&&row[f]!=="")return row[f];
  }
  return "";
}

function formatPrice(value){
  var raw=String(value||"").replace(/[^0-9.]/g,"");
  var number=Number(raw);
  if(!number)return "-";
  return number.toLocaleString()+" บาท/วัน";
}

function isAvailable(value){
  var v=String(value||"").trim().toUpperCase();
  return v==="TRUE"||v==="1"||v==="YES"||v==="Y"||v==="ว่าง"||v==="AVAILABLE";
}

async function loadData(){
  var result=await Promise.all([fetchSheet("concerts"),fetchSheet("phones")]);
  var concertRows=result[0];
  var phoneRows=result[1];

  var concerts=concertRows.filter(function(r){return getField(r,["concert_id","id","ID","concert id"]);}).map(function(r){
    return {
      id:getField(r,["concert_id","id","ID","concert id"]),
      name:getField(r,["name","event_name","ชื่องาน"]),
      date:getField(r,["date","event_date","วันที่"]),
      venue:getField(r,["venue","location","สถานที่"]),
      img:normalizeImageUrl(getField(r,["img","image","poster","รูป"])),
      phones:[]
    };
  });

  var concertMap=new Map();
  concerts.forEach(function(c){concertMap.set(String(c.id),c);});

  phoneRows.forEach(function(p){
    var cid=getField(p,["concert_id","id","ID","concert id"]);
    if(!cid)return;
    var concert=concertMap.get(String(cid));
    if(!concert)return;

    concert.phones.push({
      model:getField(p,["model","phone","รุ่น"]),
      spec:getField(p,["spec","detail","สเปค"]),
      price:getField(p,["price","ราคา"]),
      note:getField(p,["note","หมายเหตุ"]),
      avail:isAvailable(getField(p,["avail","available","status","สถานะ"]))
    });
  });

  return concerts;
}

function isValidDateParts(dateObj,year,monthIndex,day){
  return dateObj instanceof Date && !isNaN(dateObj.getTime()) &&
    dateObj.getFullYear()===year &&
    dateObj.getMonth()===monthIndex &&
    dateObj.getDate()===day;
}

function parseEventDate(dateStr){
  var s = String(dateStr || "").trim();
  if(!s) return null;

  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){
    var d1 = parseInt(m[1],10);
    var mo1 = parseInt(m[2],10) - 1;
    var y1 = parseInt(m[3],10);
    if(y1 > 2500) y1 -= 543;
    var date1 = new Date(y1, mo1, d1);
    return isValidDateParts(date1,y1,mo1,d1) ? date1 : null;
  }

  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){
    var y2 = parseInt(m[1],10);
    var mo2 = parseInt(m[2],10) - 1;
    var d2 = parseInt(m[3],10);
    if(y2 > 2500) y2 -= 543;
    var date2 = new Date(y2, mo2, d2);
    return isValidDateParts(date2,y2,mo2,d2) ? date2 : null;
  }

  var enMonths = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if(m){
    var d3 = parseInt(m[1],10);
    var monName = m[2].toLowerCase();
    var y3 = parseInt(m[3],10);
    if(y3 > 2500) y3 -= 543;
    if(enMonths[monName] !== undefined){
      var date3 = new Date(y3, enMonths[monName], d3);
      return isValidDateParts(date3,y3,enMonths[monName],d3) ? date3 : null;
    }
  }

  var thMonths = {"ม.ค.":0,"มกราคม":0,"ก.พ.":1,"กุมภาพันธ์":1,"มี.ค.":2,"มีนาคม":2,"เม.ย.":3,"เมษายน":3,"พ.ค.":4,"พฤษภาคม":4,"มิ.ย.":5,"มิถุนายน":5,"ก.ค.":6,"กรกฎาคม":6,"ส.ค.":7,"สิงหาคม":7,"ก.ย.":8,"กันยายน":8,"ต.ค.":9,"ตุลาคม":9,"พ.ย.":10,"พฤศจิกายน":10,"ธ.ค.":11,"ธันวาคม":11};
  for(var key in thMonths){
    if(s.indexOf(key) >= 0){
      var parts = s.split(key);
      var d4 = parseInt(String(parts[0]).replace(/\D/g,""),10);
      var yMatch = String(parts[1] || "").match(/\d{4}/);
      var y4 = yMatch ? parseInt(yMatch[0],10) : TODAY_FOR_HIDE.getFullYear();
      if(y4 > 2500) y4 -= 543;
      if(d4){
        var date4 = new Date(y4, thMonths[key], d4);
        return isValidDateParts(date4,y4,thMonths[key],d4) ? date4 : null;
      }
    }
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

function isDateUnreadable(concert){
  return !!(concert && concert.date && !parseEventDate(concert.date));
}

function getConcertSortTime(concert){
  var d = parseEventDate(concert && concert.date);
  if(!d) return Number.MAX_SAFE_INTEGER;
  d.setHours(0,0,0,0);
  return d.getTime();
}

function sortConcertsByDateAsc(concerts){
  return concerts.slice().sort(function(a,b){
    var timeA = getConcertSortTime(a);
    var timeB = getConcertSortTime(b);
    if(timeA !== timeB) return timeA - timeB;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function getAvailablePhones(concert){
  return ((concert && concert.phones) || []).filter(function(p){return p.avail;});
}

function getAvailableCount(concert){
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

function getEmptyMessage(){
  if(currentFilter === "available") return "ยังไม่มีงานที่มีเครื่องว่างตอนนี้น้า 💙";
  if(currentFilter === "full") return "ยังไม่มีงานที่เต็มแล้วตอนนี้น้า ✨";
  if(currentFilter === "soon") return "ยังไม่มีงานใกล้ถึงใน 14 วันน้า 💙";
  return "ยังไม่มีงานที่เปิดให้จองตอนนี้น้า 💙";
}

function renderEmptyState(message,detail){
  var el=document.getElementById("content");
  if(!el)return;
  el.innerHTML='<div class="empty-state"><div class="empty-emoji">💙</div><h3>'+message+'</h3><p>'+(detail||'ถ้ามีงานที่อยากเช่า สามารถทัก Line OA มาสอบถามได้เลย')+'</p><a class="empty-line-btn" href="'+LINE_DIRECT_URL+'" target="_blank" rel="noopener">ทัก Line OA</a></div>';
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

function getStatusBadgeText(concert){
  var count = getAvailableCount(concert);
  if(count <= 0) return "เต็มแล้ว";
  if(isSoonConcert(concert)) return "ใกล้ถึงวันงาน";
  return "ว่าง " + count + " รุ่น";
}

function renderConcerts(concerts){
  var el=document.getElementById("content");
  if(!el)return;
  el.innerHTML="";
  if(!concerts||!concerts.length){
    renderEmptyState("ยังไม่มีข้อมูลงานตอนนี้น้า 💙","เพิ่มข้อมูลใน Google Sheet หลังบ้าน แล้วรีเฟรชหน้านี้ได้เลย");
    return;
  }

  var visibleConcerts = getFilteredConcerts(concerts);
  if(!visibleConcerts.length){
    renderEmptyState(getEmptyMessage());
    return;
  }

  var grid=document.createElement("div");grid.className="poster-grid";
  visibleConcerts.forEach(function(c){
    var availableCount=getAvailableCount(c),available=availableCount>0;
    var availText=available?(availableCount===1?"เหลือ 1 รุ่นสุดท้าย ✨":"ว่าง "+availableCount+" รุ่น ✨"):"เต็มแล้วน้า 😢";
    var card=document.createElement("button");card.type="button";card.className="concert-card";card.setAttribute("aria-label","ดูเครื่องว่างสำหรับงาน "+(c.name||""));card.onclick=function(){showModal(c);};
    var imgWrap=document.createElement("div");imgWrap.className="poster-img-wrap";
    var badge=document.createElement("div");badge.className="status-badge"+(available?"":" full")+(isSoonConcert(c)&&available?" soon":"");badge.textContent=getStatusBadgeText(c);imgWrap.appendChild(badge);
    var imgUrl=c.img?String(c.img).trim():"";
    if(imgUrl){
      var img=document.createElement("img");
      img.src=imgUrl;img.alt=c.name||"Event poster";img.loading="lazy";img.decoding="async";
      img.onerror=function(){img.remove(); if(!imgWrap.querySelector(".poster-placeholder")){var ph=document.createElement("div");ph.className="poster-placeholder";ph.innerHTML='<span>ยังไม่มีรูป</span>';imgWrap.appendChild(ph);}};
      imgWrap.appendChild(img);
    }else{
      var placeholder=document.createElement("div");placeholder.className="poster-placeholder";placeholder.innerHTML='<span>ยังไม่มีรูป</span>';imgWrap.appendChild(placeholder);
    }
    var info=document.createElement("div");info.className="poster-info";
    var date=document.createElement("div");date.className="pi-date";date.textContent=c.date||"";
    var name=document.createElement("div");name.className="pi-name";name.textContent=c.name||"";
    var avail=document.createElement("div");avail.className="pi-avail"+(available?"":" none");avail.textContent=availText;
    var tap=document.createElement("div");
    tap.className="pi-tap"+(available?"":" full");
    tap.textContent=available?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว";
    info.appendChild(date);
    if(DEBUG_MODE && isDateUnreadable(c)){
      var warn=document.createElement("div");
      warn.className="date-warning-label";
      warn.textContent="⚠️ เช็กวันที่";
      info.appendChild(warn);
      console.warn("KK Phone Rental: อ่านวันที่ไม่ได้", c.name, c.date);
    }
    info.appendChild(name);info.appendChild(avail);info.appendChild(tap);
    card.appendChild(imgWrap);card.appendChild(info);grid.appendChild(card);
  });
  el.appendChild(grid);
}

function buildBookingMessage(concert,phone){
  return ["สวัสดีค่ะ สนใจจองมือถือกับ KK Phone Rental ค่ะ","","งาน : "+(concert.name||"-"),"รุ่น : "+((phone&&phone.model)||"-"),"ราคา : "+formatPrice(phone&&phone.price),"วันที่ : "+(concert.date||"-"),"","ชื่อเล่น : ","เวลาที่สะดวกรับเครื่อง : "].join("\n");
}

function getLineBookingUrl(concert,phone){
  var message=buildBookingMessage(concert,phone);
  return "https://line.me/R/oaMessage/"+encodeURIComponent(LINE_OA_ID)+"/?"+encodeURIComponent(message);
}

function getPhoneSuitability(phone){
  var model=String((phone&&phone.model)||"").toLowerCase();
  var spec=String((phone&&phone.spec)||"").toLowerCase();
  var text=model+" "+spec;
  if(text.indexOf("lens")>=0||text.indexOf("zeiss")>=0||text.indexOf("x300")>=0){
    return "เหมาะกับ: ถ่ายเวทีไกล / ซูมศิลปิน / วิดีโอคอนเสิร์ต";
  }
  if(text.indexOf("ultra")>=0||text.indexOf("pro")>=0||text.indexOf("zoom")>=0){
    return "เหมาะกับ: ถ่ายคอนเสิร์ต / ซูมระยะไกล / เก็บโมเมนต์สำคัญ";
  }
  return "เหมาะกับ: ถ่ายภาพและวิดีโอในงานอีเวนต์";
}

function showModal(input){
  var c = (typeof input === "number") ? concertsData[input] : input;
  if(!c)return;
  document.getElementById("modal-title").textContent=c.name||"รายละเอียดงาน";
  document.getElementById("modal-date").textContent="📅 "+(c.date||"-");
  document.getElementById("modal-venue").textContent="📍 "+(c.venue||"-");
  var list=document.getElementById("phone-list");list.innerHTML="";
  var availablePhones=getAvailablePhones(c);
  if(!availablePhones.length){list.innerHTML='<div class="full-booked-box">งานนี้เต็มแล้วน้า 🙏<br>ทักมาถามรอบอื่นได้เลย 💙</div>';openModal();return;}
  availablePhones.forEach(function(p){
    var row=document.createElement("div");row.className="phone-row";
    var icon=document.createElement("div");icon.className="ph-icon";icon.innerHTML='<svg viewBox="0 0 28 28" fill="none"><rect x="6" y="3" width="16" height="22" rx="3" stroke="#5B8DEF" stroke-width="1.8"/><rect x="10" y="6" width="8" height="1.5" rx="0.75" fill="#5B8DEF"/><circle cx="14" cy="22" r="1.2" fill="#5B8DEF"/></svg>';
    var info=document.createElement("div");info.className="ph-info";
    var model=document.createElement("div");model.className="ph-model";model.textContent=p.model||"";
    var spec=document.createElement("div");spec.className="ph-spec";spec.textContent=p.spec||"";
    info.appendChild(model);info.appendChild(spec);
    var usecase=document.createElement("div");usecase.className="ph-usecase";usecase.textContent=getPhoneSuitability(p);info.appendChild(usecase);
    if(p.note){var note=document.createElement("div");note.className="ph-note";note.textContent=p.note;info.appendChild(note);}
    var right=document.createElement("div");right.className="ph-right";
    var price=document.createElement("div");price.className="ph-price";
    var priceText=formatPrice(p.price);
    price.textContent=priceText.replace(" บาท/วัน","");
    var small=document.createElement("span");small.textContent=" บาท/วัน";price.appendChild(small);
    var bookPill=document.createElement("a");bookPill.className="badge book-pill";bookPill.textContent="จองรุ่นนี้";bookPill.href=getLineBookingUrl(c,p);bookPill.target="_blank";bookPill.rel="noopener";bookPill.onclick=function(e){e.stopPropagation();};
    right.appendChild(price);right.appendChild(bookPill);
    row.appendChild(icon);row.appendChild(info);row.appendChild(right);list.appendChild(row);
  });
  openModal();
}

function closeModal(e){
  if(e && e.target!==document.getElementById("overlay"))return;
  document.getElementById("overlay").classList.remove("active");
  document.body.style.overflow="";
}
function openModal(){
  document.getElementById("overlay").classList.add("active");
  document.body.style.overflow="hidden";
}
function showError(m){
  var el=document.getElementById("content");
  if(el)el.innerHTML='<div class="empty-state error-state"><div class="empty-emoji">🙏</div><h3>โหลดข้อมูลคิวไม่สำเร็จชั่วคราวน้า</h3><p>'+m+'</p><a class="empty-line-btn" href="'+LINE_DIRECT_URL+'" target="_blank" rel="noopener">ทัก Line OA มาสอบถาม</a></div>';
}

function openFaq(){
  var el=document.getElementById("faqOverlay");
  if(el){el.classList.add("active");document.body.style.overflow="hidden";}
}
function closeFaq(e){
  if(e && e.target!==document.getElementById("faqOverlay"))return;
  var el=document.getElementById("faqOverlay");
  if(el){el.classList.remove("active");document.body.style.overflow="";}
}
function toggleFaq(btn){
  var item=btn&&btn.parentElement;
  if(item){
    item.classList.toggle("active");
    btn.setAttribute("aria-expanded",item.classList.contains("active")?"true":"false");
  }
}

function initFilters(){
  document.querySelectorAll(".filter-btn").forEach(function(btn){
    btn.addEventListener("click",function(){setFilter(btn.getAttribute("data-filter") || "all");});
  });
  updateFilterButtons();
}

document.addEventListener("DOMContentLoaded",function(){
  setUpdateDate();
  initFilters();

  var brandImg=document.querySelector(".brand-header-img");
  if(brandImg)brandImg.addEventListener("error",showBrandFallback);

  var faqOpenBtn=document.getElementById("faq-open-btn");
  if(faqOpenBtn)faqOpenBtn.addEventListener("click",openFaq);

  var faqCloseBtn=document.getElementById("faq-close-btn");
  if(faqCloseBtn)faqCloseBtn.addEventListener("click",function(){closeFaq();});

  document.querySelectorAll(".faq-q").forEach(function(btn){
    btn.addEventListener("click",function(){toggleFaq(btn);});
  });

  var overlay=document.getElementById("overlay");
  if(overlay)overlay.addEventListener("click",closeModal);

  var faqOverlay=document.getElementById("faqOverlay");
  if(faqOverlay)faqOverlay.addEventListener("click",closeFaq);

  var closeBtn=document.getElementById("modal-close");
  if(closeBtn)closeBtn.addEventListener("click",function(){closeModal();});

  loadData().then(function(concerts){
    concertsData=concerts;
    renderConcerts(concertsData);
  }).catch(function(e){
    console.error(e);
    showError("ลองรีเฟรชอีกครั้ง หรือเช็กว่า Google Sheet แชร์เป็น Anyone with the link และมีชีตชื่อ concerts / phones");
  });
});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&document.getElementById("overlay").classList.contains("active"))closeModal();
  if(e.key==="Escape"&&document.getElementById("faqOverlay")&&document.getElementById("faqOverlay").classList.contains("active"))closeFaq();
});
