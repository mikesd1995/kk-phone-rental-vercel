// KK Phone Rental — Front-end for backend v5
// Data source: Google Sheet v5, mainly the Web_Ready sheet.
var SHEET_ID = "1-kFC6v0cRmLnGAq3J0FRVQ3Ua65fXwrFvr_BYGBLVbQ";
var LINE_OA_ID = "@827blnmo";
var WEB_READY_SHEET = "Web_Ready";
var EVENTS_SHEET = "Events";
var concertsData = [];

var V5_WEB_READY_HEADERS = [
  "event_id",
  "event_name",
  "event_date",
  "event_time_start",
  "event_time_end",
  "venue",
  "city",
  "hashtags",
  "event_status",
  "active_on_web",
  "phone_model",
  "phone_price",
  "lens_price",
  "bundle_price",
  "follower_promo",
  "available_phone_count",
  "lens_available_qty",
  "booking_status_for_web",
  "action_for_web",
  "line_message_template",
  "notes"
];

var V5_EVENTS_HEADERS = [
  "event_id",
  "event_name",
  "event_date",
  "venue",
  "city",
  "event_hashtag",
  "status",
  "active_on_web",
  "notes",
  "event_time_start",
  "event_time_end",
  "poster_image_url",
  "booking_open_date",
  "booking_close_date",
  "pickup_point",
  "line_keyword"
];

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

async function fetchTextWithTimeout(url,ms){
  var t=timeoutSignal(ms||9000);
  try{
    var res=await fetch(url,{cache:"no-store",signal:t.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    return await res.text();
  }finally{
    t.clear();
  }
}

async function fetchJsonWithTimeout(url,ms){
  var t=timeoutSignal(ms||9000);
  try{
    var res=await fetch(url,{cache:"no-store",signal:t.signal});
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

function normalizeHeader(value){
  return String(value||"")
    .trim()
    .replace(/^\uFEFF/,"")
    .replace(/\s+/g,"_")
    .replace(/\-/g,"_")
    .toLowerCase();
}

function gvizDateStringToDisplay(value){
  var m=String(value||"").match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if(!m)return "";
  var y=Number(m[1]);
  var mo=Number(m[2]);
  var d=Number(m[3]);
  return pad2(d)+"/"+pad2(mo+1)+"/"+y;
}

function cellToValue(cell){
  if(!cell)return "";
  if(cell.f!==undefined&&cell.f!==null&&String(cell.f).trim()!=="")return cell.f;
  if(cell.v===undefined||cell.v===null)return "";
  if(typeof cell.v==="string"&&cell.v.indexOf("Date(")===0)return gvizDateStringToDisplay(cell.v);
  return cell.v;
}

async function fetchGvizSheet(sheetName,range,defaultHeaders){
  var url="https://docs.google.com/spreadsheets/d/"+SHEET_ID+
    "/gviz/tq?sheet="+encodeURIComponent(sheetName)+
    "&range="+encodeURIComponent(range)+
    "&headers=1&tqx=out:json&_="+Date.now();
  var text=await retry(function(){return fetchTextWithTimeout(url,10000);},2,700);
  var match=text.match(/google\.visualization\.Query\.setResponse\(([^]+)\);?\s*$/);
  if(!match)throw new Error("อ่านข้อมูลจาก Google Sheet ไม่ได้");
  var payload=JSON.parse(match[1]);
  if(payload.status&&payload.status!=="ok")throw new Error(payload.errors&&payload.errors[0]&&payload.errors[0].detailed_message||"Google Sheet error");
  var table=payload.table||{};
  var headers=(table.cols||[]).map(function(col,i){
    return normalizeHeader((col&&col.label)||defaultHeaders[i]||("col_"+i));
  });
  var rows=(table.rows||[]).map(function(row){
    var obj={};
    (row.c||[]).forEach(function(cell,i){
      obj[headers[i]||("col_"+i)]=cellToValue(cell);
    });
    return obj;
  });
  return rows.filter(function(row){
    return Object.values(row).some(function(value){return String(value||"").trim()!=="";});
  });
}

async function fetchOpenSheetFallback(sheetName,defaultHeaders){
  var url="https://opensheet.elk.sh/"+SHEET_ID+"/"+encodeURIComponent(sheetName)+"?_="+Date.now();
  var rows=await retry(function(){return fetchJsonWithTimeout(url,9000);},2,700);
  return normalizeOpenSheetRows(rows,defaultHeaders);
}

function normalizeOpenSheetRows(rows,defaultHeaders){
  if(!Array.isArray(rows))return [];
  var hasDirectHeader=rows.some(function(row){return row&&row.event_id!==undefined;});
  if(hasDirectHeader){
    return rows.map(function(row){
      var out={};
      Object.keys(row||{}).forEach(function(key){out[normalizeHeader(key)]=row[key];});
      return out;
    });
  }

  var arrays=rows.map(function(row){return Object.values(row||{});});
  var headerIndex=-1;
  for(var i=0;i<arrays.length;i++){
    if(arrays[i].some(function(value){return normalizeHeader(value)==="event_id";})){
      headerIndex=i;
      break;
    }
  }
  if(headerIndex<0)return [];

  var headers=arrays[headerIndex].map(function(value,i){return normalizeHeader(value||defaultHeaders[i]||("col_"+i));});
  return arrays.slice(headerIndex+1).map(function(arr){
    var obj={};
    headers.forEach(function(h,i){obj[h]=arr[i]===undefined?"":arr[i];});
    return obj;
  }).filter(function(row){
    return Object.values(row).some(function(value){return String(value||"").trim()!=="";});
  });
}

async function fetchV5Sheet(sheetName,range,defaultHeaders){
  try{
    return await fetchGvizSheet(sheetName,range,defaultHeaders);
  }catch(primaryError){
    console.warn("GViz fetch failed, trying opensheet fallback:", sheetName, primaryError);
    try{
      return await fetchOpenSheetFallback(sheetName,defaultHeaders);
    }catch(fallbackError){
      console.error("OpenSheet fallback failed:", sheetName, fallbackError);
      throw primaryError;
    }
  }
}

function getField(row,fields){
  row=row||{};
  for(var i=0;i<fields.length;i++){
    var f=normalizeHeader(fields[i]);
    if(row[f]!==undefined&&row[f]!==null&&String(row[f]).trim()!=="")return row[f];
  }
  return "";
}

function pad2(n){return String(n).padStart(2,"0");}

function excelSerialToDate(serial){
  var n=Number(serial);
  if(!isFinite(n)||n<30000||n>70000)return null;
  var utc=(n-25569)*86400*1000;
  var d=new Date(utc);
  if(isNaN(d.getTime()))return null;
  return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
}

function formatDateDisplay(value){
  if(value instanceof Date&&!isNaN(value.getTime()))return pad2(value.getDate())+"/"+pad2(value.getMonth()+1)+"/"+value.getFullYear();
  var s=String(value||"").trim();
  if(!s)return "";
  if(/^\d{4,5}(\.\d+)?$/.test(s)){
    var serialDate=excelSerialToDate(s);
    if(serialDate)return pad2(serialDate.getDate())+"/"+pad2(serialDate.getMonth()+1)+"/"+serialDate.getFullYear();
  }
  var gviz=gvizDateStringToDisplay(s);
  if(gviz)return gviz;
  return s;
}

function toNumber(value){
  var raw=String(value||"").replace(/[^0-9.\-]/g,"");
  if(raw==="")return 0;
  var n=Number(raw);
  return isFinite(n)?n:0;
}

function formatPrice(value){
  var number=toNumber(value);
  if(!number)return "-";
  return number.toLocaleString()+" บาท/วัน";
}

function isTruthy(value){
  if(value===true)return true;
  var v=String(value||"").trim().toLowerCase();
  return v==="true"||v==="1"||v==="yes"||v==="y"||v==="show"||v==="open"||v==="ว่าง"||v==="เปิด"||v==="เปิดจอง";
}

function isExplicitFalse(value){
  if(value===false)return true;
  var v=String(value||"").trim().toLowerCase();
  return v==="false"||v==="0"||v==="no"||v==="n"||v==="hide"||v==="closed"||v==="ปิด"||v==="ซ่อน";
}

function isRowAllowedOnWeb(row){
  var active=getField(row,["active_on_web"]);
  var action=String(getField(row,["action_for_web"])).trim().toLowerCase();
  var status=String(getField(row,["event_status","status"])).trim().toLowerCase();

  if(isExplicitFalse(active))return false;
  if(action&&action!=="show"&&action!=="แสดง")return false;
  if(status==="finished"||status==="closed"||status==="cancelled"||status==="ยกเลิก"||status==="จบแล้ว")return false;
  return true;
}

function buildEventMetaMap(eventRows){
  var map=new Map();
  (eventRows||[]).forEach(function(row){
    var id=String(getField(row,["event_id"])).trim();
    if(!id)return;
    map.set(id,{
      id:id,
      name:getField(row,["event_name"]),
      date:formatDateDisplay(getField(row,["event_date"])),
      venue:getField(row,["venue"]),
      city:getField(row,["city"]),
      hashtags:getField(row,["event_hashtag","hashtags"]),
      status:getField(row,["status"]),
      active:getField(row,["active_on_web"]),
      img:normalizeImageUrl(getField(row,["poster_image_url","img","image","poster"])),
      pickupPoint:getField(row,["pickup_point"]),
      notes:getField(row,["notes"])
    });
  });
  return map;
}

function makePhoneSpec(row){
  var phonePrice=toNumber(getField(row,["phone_price"]));
  var lensPrice=toNumber(getField(row,["lens_price"]));
  var bundlePrice=toNumber(getField(row,["bundle_price"]));
  var parts=[];
  if(phonePrice)parts.push("เครื่อง "+phonePrice.toLocaleString()+".-");
  if(lensPrice)parts.push("Lens "+lensPrice.toLocaleString()+".-");
  if(bundlePrice)parts.push("เช่าคู่ "+bundlePrice.toLocaleString()+".-");
  return parts.join(" · ");
}

function makePhoneNote(row){
  var promo=getField(row,["follower_promo"]);
  var notes=getField(row,["notes"]);
  var values=[];
  if(promo)values.push(promo);
  if(notes)values.push(notes);
  return values.join(" · ");
}

function normalizeLineTemplate(text){
  var s=String(text||"").trim();
  if(!s)return "";
  try{
    if(/%0A|%0D|%20|%E0%B8/i.test(s))return decodeURIComponent(s);
  }catch(e){}
  return s.replace(/\\n/g,"\n");
}

async function loadData(){
  var results=await Promise.all([
    fetchV5Sheet(WEB_READY_SHEET,"A4:U",V5_WEB_READY_HEADERS),
    fetchV5Sheet(EVENTS_SHEET,"A4:P",V5_EVENTS_HEADERS).catch(function(e){console.warn("Events meta unavailable",e);return [];})
  ]);

  var webRows=results[0]||[];
  var eventMeta=buildEventMetaMap(results[1]||[]);
  var concertMap=new Map();

  webRows.forEach(function(row){
    if(!isRowAllowedOnWeb(row))return;
    var id=String(getField(row,["event_id"])).trim();
    var name=getField(row,["event_name"]);
    if(!id||!name)return;

    var meta=eventMeta.get(id)||{};
    if(isExplicitFalse(meta.active))return;

    if(!concertMap.has(id)){
      concertMap.set(id,{
        id:id,
        name:name||meta.name,
        date:formatDateDisplay(getField(row,["event_date"])||meta.date),
        venue:getField(row,["venue"])||meta.venue||"-",
        city:getField(row,["city"])||meta.city||"",
        hashtags:getField(row,["hashtags"])||meta.hashtags||"",
        img:meta.img||"",
        phones:[]
      });
    }

    var concert=concertMap.get(id);
    var availableCount=toNumber(getField(row,["available_phone_count"]));
    var bookingStatus=String(getField(row,["booking_status_for_web"])).trim().toLowerCase();
    var model=getField(row,["phone_model"]);
    if(!model)return;

    var phonePrice=getField(row,["phone_price"]);
    var bundlePrice=getField(row,["bundle_price"]);
    var displayPrice=bundlePrice||phonePrice;
    var phone={
      model:model,
      spec:makePhoneSpec(row),
      price:displayPrice,
      phonePrice:phonePrice,
      lensPrice:getField(row,["lens_price"]),
      bundlePrice:bundlePrice,
      note:makePhoneNote(row),
      lineTemplate:normalizeLineTemplate(getField(row,["line_message_template"])),
      avail:availableCount>0 && bookingStatus!=="เต็ม" && bookingStatus!=="full" && bookingStatus!=="hide" && bookingStatus!=="รอใส่วันที่"
    };
    concert.phones.push(phone);
  });

  return Array.from(concertMap.values());
}

// Hide past events
// ใช้วันที่จริงอัตโนมัติจากเครื่องผู้ใช้
var TODAY_FOR_HIDE = new Date();
TODAY_FOR_HIDE.setHours(0,0,0,0);

// Owner review modes:
// ?debug=1      = แสดง label เตือนถ้าวันที่อ่านไม่ได้
// ?showPast=1   = แสดงงานย้อนหลังด้วย
var URL_PARAMS = new URLSearchParams(window.location.search);
var DEBUG_MODE = URL_PARAMS.get("debug") === "1";
var SHOW_PAST = URL_PARAMS.get("showPast") === "1";

function isValidDateParts(dateObj,year,monthIndex,day){
  return dateObj instanceof Date && !isNaN(dateObj.getTime()) &&
    dateObj.getFullYear()===year &&
    dateObj.getMonth()===monthIndex &&
    dateObj.getDate()===day;
}

function parseEventDate(dateStr){
  var s = String(dateStr || "").trim();
  if(!s) return null;

  if(/^\d{4,5}(\.\d+)?$/.test(s)){
    return excelSerialToDate(s);
  }

  if(s.indexOf("Date(")===0){
    var display=gvizDateStringToDisplay(s);
    if(display)return parseEventDate(display);
  }

  // dd/mm/yyyy or dd-mm-yyyy
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){
    var d1 = parseInt(m[1],10);
    var mo1 = parseInt(m[2],10) - 1;
    var y1 = parseInt(m[3],10);
    if(y1 > 2500) y1 -= 543;
    var date1 = new Date(y1, mo1, d1);
    return isValidDateParts(date1,y1,mo1,d1) ? date1 : null;
  }

  // yyyy-mm-dd or yyyy/mm/dd
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){
    var y2 = parseInt(m[1],10);
    var mo2 = parseInt(m[2],10) - 1;
    var d2 = parseInt(m[3],10);
    if(y2 > 2500) y2 -= 543;
    var date2 = new Date(y2, mo2, d2);
    return isValidDateParts(date2,y2,mo2,d2) ? date2 : null;
  }

  // 09 May 2026 / 9 May 2026
  var enMonths = {
    jan:0,january:0,
    feb:1,february:1,
    mar:2,march:2,
    apr:3,april:3,
    may:4,
    jun:5,june:5,
    jul:6,july:6,
    aug:7,august:7,
    sep:8,sept:8,september:8,
    oct:9,october:9,
    nov:10,november:10,
    dec:11,december:11
  };

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

  // Thai month formats
  var thMonths = {
    "ม.ค.":0,"มกราคม":0,
    "ก.พ.":1,"กุมภาพันธ์":1,
    "มี.ค.":2,"มีนาคม":2,
    "เม.ย.":3,"เมษายน":3,
    "พ.ค.":4,"พฤษภาคม":4,
    "มิ.ย.":5,"มิถุนายน":5,
    "ก.ค.":6,"กรกฎาคม":6,
    "ส.ค.":7,"สิงหาคม":7,
    "ก.ย.":8,"กันยายน":8,
    "ต.ค.":9,"ตุลาคม":9,
    "พ.ย.":10,"พฤศจิกายน":10,
    "ธ.ค.":11,"ธันวาคม":11
  };

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
  if(!d) return Number.MAX_SAFE_INTEGER; // วันที่อ่านไม่ได้ให้ไปท้ายสุด
  d.setHours(0,0,0,0);
  return d.getTime();
}

function sortConcertsByDateAsc(concerts){
  return concerts.slice().sort(function(a,b){
    var timeA = getConcertSortTime(a);
    var timeB = getConcertSortTime(b);

    if(timeA !== timeB) return timeA - timeB;

    // ถ้าวันเดียวกัน ให้เรียงตามชื่อเพื่อให้ลำดับนิ่ง
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function renderConcerts(concerts){
  var el=document.getElementById("content");el.innerHTML="";
  if(!concerts||!concerts.length){el.innerHTML='<div class="error-box">ยังไม่มีข้อมูลงานตอนนี้น้า<br><small>เพิ่มข้อมูลใน Google Sheet v5 ที่ชีต Web_Ready ได้เลย</small></div>';return;}

  var visibleConcerts = sortConcertsByDateAsc(concerts.filter(shouldShowConcert));

  if(!visibleConcerts.length){
    el.innerHTML='<div class="error-box">ยังไม่มีงานที่กำลังจะมาถึงตอนนี้น้า<br><small>งานที่วันที่ผ่านมาแล้วจะถูกซ่อนอัตโนมัติ</small></div>';
    return;
  }

  var grid=document.createElement("div");grid.className="poster-grid";
  visibleConcerts.forEach(function(c,i){
    var phones=c.phones||[],availablePhones=phones.filter(function(p){return p.avail;}),availableCount=availablePhones.length,available=availableCount>0;
    var availText=available?(availableCount===1?"เหลือ 1 รุ่น/เครื่องสุดท้าย ✨":"ว่าง "+availableCount+" รุ่น ✨"):"เต็มแล้วน้า 😢";
    var card=document.createElement("button");card.type="button";card.className="concert-card";card.setAttribute("aria-label","ดูเครื่องว่างสำหรับงาน "+(c.name||""));card.onclick=function(){showModal(c);};
    var imgWrap=document.createElement("div");imgWrap.className="poster-img-wrap";
    var badge=document.createElement("div");badge.className="status-badge"+(available?"":" full");badge.textContent=available?(availableCount===1?"เหลือ 1 สุดท้าย":"ว่างน้า"):"เต็มแล้ว";imgWrap.appendChild(badge);
    var imgUrl=c.img?String(c.img).trim():"";
    if(imgUrl){var img=document.createElement("img");img.src=imgUrl;img.alt=c.name||"Event poster";img.loading="lazy";img.onerror=function(){imgWrap.innerHTML='<div class="poster-placeholder"><span>ยังไม่มีรูป</span></div>';};imgWrap.appendChild(img);}
    else{imgWrap.innerHTML='<div class="poster-placeholder"><span>ยังไม่มีรูป</span></div>';}
    var info=document.createElement("div");info.className="poster-info";
    var date=document.createElement("div");date.className="pi-date";date.textContent=c.date||"";
    var name=document.createElement("div");name.className="pi-name";name.textContent=c.name||"";
    var avail=document.createElement("div");avail.className="pi-avail"+(available?"":" none");avail.textContent=availText;
    var tap=document.createElement("div");
    tap.className="pi-tap"+(available?"":" full");
    tap.textContent=available?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว";
    tap.style.width="100%";
    tap.style.alignSelf="stretch";
    tap.style.marginTop="auto";
    tap.style.boxSizing="border-box";
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
  if(phone&&phone.lineTemplate)return phone.lineTemplate;
  var detail=(phone&&phone.spec)?("รายละเอียดราคา : "+phone.spec):"";
  return [
    "สวัสดีค่ะ สนใจจองมือถือกับ KK Phone Rental ค่ะ",
    "",
    "งาน : "+(concert.name||"-"),
    "วันที่ : "+(concert.date||"-"),
    "สถานที่ : "+(concert.venue||"-"),
    "รุ่น : "+((phone&&phone.model)||"-"),
    "ราคา : "+formatPrice(phone&&phone.price),
    detail,
    "",
    "ชื่อเล่น : ",
    "เบอร์โทร : ",
    "เวลาที่สะดวกรับเครื่อง : "
  ].filter(function(line){return line!==""||true;}).join("\n");
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
  var availablePhones=(c.phones||[]).filter(function(p){return p.avail;});
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
function showError(m){document.getElementById("content").innerHTML='<div class="error-box">'+m+'</div>';}

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

document.addEventListener("DOMContentLoaded",function(){
  setUpdateDate();

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
    showError("โหลดข้อมูลไม่สำเร็จ<br><small>เช็กว่า Google Sheet แชร์เป็น Anyone with the link และมีชีต Web_Ready / Events ตามไฟล์ v5</small><br><small>รายละเอียด: "+e.message+"</small>");
  });
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&document.getElementById("overlay").classList.contains("active"))closeModal();
  if(e.key==="Escape"&&document.getElementById("faqOverlay")&&document.getElementById("faqOverlay").classList.contains("active"))closeFaq();
});
