// KK Phone Rental Admin CRM — Snapshot Resilience 1
(function(){
  const KK_ADMIN_UI_VERSION = KKSnapshotHealth.VERSION;
  const EXPECTED_BACKEND_VERSION = KKSnapshotHealth.BACKEND;
  const EXPECTED_PROXY_VERSION = KKSnapshotHealth.VERSION;
  let snapshotState = { stale: false, checkedAt: null, goodAt: null, health: null, error: "" };
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false, posterWarning: "", selectedCustomerKey: "", actionFilter: "all", actionSearch: "", reportRange: "all", reportStart: "", reportEnd: "", reportStatusMode: "active_revenue", systemHealth: null, pricingEventFilter: "", pricingSearch: "", pricingScope: "selected", rentalAnalytics: null, rentalAnalyticsError: "", rentalAnalyticsLoading: false };
  const OPERATION_FILTERS = [
    ["all","ทั้งหมด"], ["today","วันนี้"], ["tomorrow","พรุ่งนี้"], ["week","7 วัน"],
    ["payment","ตามเงิน"], ["prep","เตรียม/ส่งมอบ"], ["return","รับคืน"], ["upload","อัปโหลด/ปิดงาน"], ["data","ข้อมูลผิด"], ["risk","เสี่ยง"]
  ];

  function showNotice(msg, type="ok"){
    const n=$("#notice");
    if(!n) return alert(msg);
    n.textContent=msg;
    n.className="notice "+type;
    n.classList.remove("hidden");
    n.setAttribute("role", type==="bad" ? "alert" : "status");
    clearTimeout(showNotice.t);
    showNotice.t=setTimeout(()=>n.classList.add("hidden"),9000);
  }
  function eventNameLint(value){
    const name=String(value||"").normalize("NFKC");
    const warnings=[];
    const count=ch=>(name.split(ch).length-1);
    if(/\s{2,}/.test(name)) warnings.push("มีช่องว่างติดกันหลายตัว");
    if(count("“")!==count("”")) warnings.push("เครื่องหมายคำพูด “ ” เปิด/ปิดไม่ครบ");
    if(count('"')%2!==0) warnings.push('เครื่องหมายคำพูด " มีจำนวนไม่ครบคู่');
    [["(",")"],["[","]"],["{","}"]].forEach(pair=>{
      if(count(pair[0])!==count(pair[1])) warnings.push("วงเล็บ "+pair[0]+" "+pair[1]+" เปิด/ปิดไม่ครบ");
    });
    if(name.length>140) warnings.push("ชื่องานยาวเกิน 140 ตัวอักษร");
    if(/^[\s\-–—:|/]+|[\s\-–—:|/]+$/.test(name)) warnings.push("มีเครื่องหมายคั่นอยู่ต้นหรือท้ายชื่อ");
    return warnings;
  }
  function confirmEventNameLint(value){
    const warnings=eventNameLint(value);
    if(!warnings.length)return true;
    return window.confirm("พบรายละเอียดชื่อ Event ที่ควรตรวจอีกครั้ง:\n\n• "+warnings.join("\n• ")+"\n\nกด OK เพื่อบันทึกต่อ หรือ Cancel เพื่อกลับไปแก้ชื่อ");
  }

  function updateUiLastRefresh(){
    const el=$("#uiLastRefresh");
    if(!el) return;
    const now=snapshotState.goodAt ? new Date(snapshotState.goodAt) : new Date();
    el.textContent=now.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"});
  }
  function applyDensityMode(){
    const compact=localStorage.getItem("kk_admin_compact_mode")==="1";
    document.body.classList.toggle("compact-mode", compact);
    const btn=$("#densityBtn");
    if(btn) btn.textContent=compact ? "Comfort" : "Compact";
  }
  function focusSmartSearch(){
    const activePanel=$(".tab-panel.active");
    const target=(activePanel && activePanel.querySelector('input[type="search"], #actionSearch')) || $("#eventsSearch") || $("#customerSearch");
    if(target){ target.focus(); target.select && target.select(); }
  }
  function setBusy(btn, busy){
    if(!btn) return;
    btn.disabled=!!busy;
    btn.classList.toggle("is-busy", !!busy);
    btn.dataset.old=btn.dataset.old||btn.textContent;
    btn.textContent=busy?"กำลังบันทึก...":btn.dataset.old;
  }
  function formData(form){
    const out={};
    new FormData(form).forEach((v,k)=>{ out[k]=typeof v==="string"?v.trim():v; });
    $$('input[type="checkbox"]',form).forEach(i=>out[i.name]=i.checked);
    return out;
  }
  function parseLocalDate(v){
    if(!v) return null;
    if(v instanceof Date && !isNaN(v)) return v;
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(m){ let y=Number(m[3]); if(y>2500)y-=543; return new Date(y, Number(m[2])-1, Number(m[1])); }
    const d=new Date(s);
    return isNaN(d) ? null : d;
  }
  function dateToInput(v){
    const d=parseLocalDate(v);
    if(!d) return String(v||"").slice(0,10);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function fmtDate(v){
    const d=parseLocalDate(v);
    if(!d) return String(v||"");
    return d.toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit"});
  }
  function fmtPickupTime(v){
    if(v===null || v===undefined) return "";
    if(v instanceof Date && !isNaN(v)){
      return `${String(v.getHours()).padStart(2,"0")}:${String(v.getMinutes()).padStart(2,"0")}`;
    }
    const raw=String(v).trim();
    if(!raw) return "";
    // Google Sheets/Apps Script may serialize time-only cells as 1899-12-30T16:30:00.000Z.
    // Display only the clock part and do not timezone-shift it in the browser.
    let m=raw.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if(m) return `${m[1]}:${m[2]}`;
    m=raw.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/);
    if(m) return `${String(Number(m[1])).padStart(2,"0")}:${m[2]}`;
    if(/^\d+(?:\.\d+)?$/.test(raw)){
      const n=Number(raw);
      if(n>=0 && n<1){
        const total=Math.round(n*24*60);
        const hh=String(Math.floor(total/60)%24).padStart(2,"0");
        const mm=String(total%60).padStart(2,"0");
        return `${hh}:${mm}`;
      }
    }
    return raw;
  }
  function extractDriveFileId(url){
    const s=String(url||"").trim();
    const patterns=[/\/file\/d\/([a-zA-Z0-9_-]{15,})/,/[?&]id=([a-zA-Z0-9_-]{15,})/,/\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,/lh[3-6]\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,/uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]{15,})/];
    for(const re of patterns){ const m=s.match(re); if(m&&m[1]) return decodeURIComponent(m[1]); }
    if(!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    return "";
  }
  function normalizePosterUrl(url){
    const s=String(url||"").trim();
    if(!s) return "";
    if(/drive\.google\.com\/(drive\/u\/\d+\/)?folders\//i.test(s) || /drive\.google\.com\/drive\/folders\//i.test(s)){
      throw new Error("Poster URL ต้องเป็นลิงก์ไฟล์รูป ไม่ใช่ลิงก์โฟลเดอร์ Google Drive");
    }
    const id=extractDriveFileId(s);
    if(id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
    if(/drive\.google\.com/i.test(s)){
      throw new Error("อ่าน File ID จาก Google Drive link ไม่ได้ กรุณาใช้ลิงก์ไฟล์รูป หรือกด Upload Poster");
    }
    return s;
  }
  function money(v){ const n=Number(v||0); return n.toLocaleString("th-TH"); }
  function dateValue(v){
    const d=parseLocalDate(v);
    return d ? d.getTime() : 0;
  }
  function textValue(v){ return String(v || "").trim().toLocaleLowerCase("th-TH"); }
  function eventSelectSortValue(e){
    const t=dateValue(e && e.event_date);
    return t || Number.MAX_SAFE_INTEGER;
  }
  function compareEventsByDateAsc(a,b){
    return (eventSelectSortValue(a)-eventSelectSortValue(b)) || textValue(a && a.event_name).localeCompare(textValue(b && b.event_name),"th") || String(a && a.event_id || "").localeCompare(String(b && b.event_id || ""));
  }
  function sortedOpenEvents(events){
    const sort=($("#eventsSort") && $("#eventsSort").value) || "date_asc";
    const rows=(events||[])
      .filter(e=>String(e.status||"").trim().toLowerCase()==="open")
      // Dashboard should show only current/upcoming open events. Past events stay in Sheet for history/archive, but should not appear as "งานที่เปิดอยู่".
      .filter(e=>isTodayOrFuture(e.event_date))
      .slice();
    if(sort==="date_desc") rows.sort((a,b)=>dateValue(b.event_date)-dateValue(a.event_date));
    else if(sort==="name_asc") rows.sort((a,b)=>textValue(a.event_name).localeCompare(textValue(b.event_name),"th"));
    else rows.sort((a,b)=>dateValue(a.event_date)-dateValue(b.event_date));
    return rows;
  }
  function sortedBookings(bookings){
    const sort=($("#bookingsSort") && $("#bookingsSort").value) || "created_desc";
    const rows=(bookings||[]).slice();
    if(sort==="event_date_asc") rows.sort((a,b)=>(dateValue(a.event_date)-dateValue(b.event_date)) || (dateValue(b.created_at)-dateValue(a.created_at)));
    else if(sort==="event_date_desc") rows.sort((a,b)=>(dateValue(b.event_date)-dateValue(a.event_date)) || (dateValue(b.created_at)-dateValue(a.created_at)));
    else if(sort==="customer_asc") rows.sort((a,b)=>textValue(a.customer_name).localeCompare(textValue(b.customer_name),"th"));
    else rows.sort((a,b)=>dateValue(b.created_at)-dateValue(a.created_at));
    return rows;
  }
  function containsQuery(row, fields, query){
    const q=String(query||"").trim().toLowerCase();
    if(!q) return true;
    return fields.map(k=>String(row && row[k] || "")).join(" ").toLowerCase().includes(q);
  }
  function daysFromToday(v){
    const d=parseLocalDate(v);
    if(!d) return null;
    d.setHours(0,0,0,0);
    return Math.round((d.getTime()-startOfToday().getTime())/86400000);
  }
  function isActiveBookingStatus(status){
    return ["pending","confirmed","prepared","picked_up"].includes(String(status||"").toLowerCase().trim());
  }
  function packageNeedsPhone(packageType){
    const t=String(packageType||"").toLowerCase().trim();
    return t==="phone_only" || t==="phone_lens_bundle";
  }
  function packageNeedsLens(packageType){
    const t=String(packageType||"").toLowerCase().trim();
    return t==="lens_only" || t==="phone_lens_bundle";
  }
  function bookingMissingRequiredAsset(b){
    if(!b) return false;
    return (packageNeedsPhone(b.package_type) && !String(b.phone_asset_id||"").trim()) ||
      (packageNeedsLens(b.package_type) && !String(b.lens_asset_id||"").trim());
  }
  function isWorkflowOpenStatus(status){
    return ["pending","confirmed","prepared","picked_up","returned","uploaded"].includes(String(status||"").toLowerCase().trim());
  }
  function isClosedBookingStatus(status){
    return ["cancelled","completed","no_show"].includes(String(status||"").toLowerCase().trim());
  }
  function shouldShowInEditBooking(b){
    // Edit Booking focuses on rows that can still be operated on.
    // completed/cancelled/no_show are final. returned/uploaded remain visible so admin can upload/close workflow.
    if(!b) return false;
    if(isClosedBookingStatus(b.booking_status)) return false;
    if(isTodayOrFuture(b.event_date)) return true;
    return isWorkflowOpenStatus(b.booking_status);
  }
  function isUnpaidPayment(status){
    const s=String(status||"").toLowerCase().trim();
    // Blank payment status should still be treated as unpaid, otherwise Action Center misses follow-up items.
    return !["paid","refunded"].includes(s);
  }
  function actionSeverity(type){
    if(type==="payment" || type==="return" || type==="data" || type==="risk") return "bad";
    if(type==="prep" || type==="upcoming" || type==="upload" || type==="close") return "warn";
    return "ok";
  }
  function actionTypeLabel(type){
    return ({payment:"ตามเงิน", prep:"เตรียม/ส่งมอบ", upcoming:"ใกล้ถึง", return:"รับคืน", upload:"อัปโหลด", close:"ปิดงาน", data:"ข้อมูล", risk:"เสี่ยง"})[type] || type || "-";
  }
  function buildActionRows(data){
    const d=data||{};
    const rows=[];
    const bookings=d.bookings||[];
    const events=d.events||[];
    const pushBooking=(b, extra)=>{
      rows.push(Object.assign({
        row_number:b.row_number,
        booking_status:b.booking_status,
        payment_status:b.payment_status,
        amount_received:b.amount_received,
        date:b.event_date,
        title:b.event_name||b.event_id||"",
        customer:b.customer_name||"-",
        contact:[b.customer_contact,b.customer_phone].filter(Boolean).join(" / "),
        pickup_time:fmtPickupTime(b.pickup_time),
        package_display:b.package_display||b.package_type||"",
        package_type:b.package_type||"",
        phone_asset_id:b.phone_asset_id||"",
        lens_asset_id:b.lens_asset_id||"",
        asset:[b.phone_asset_id,b.lens_asset_id].filter(Boolean).join(" / "),
        ref:bookingCustomerKey(b)
      }, extra||{}));
    };
    bookings.forEach(b=>{
      const st=String(b.booking_status||"").toLowerCase().trim();
      const diff=daysFromToday(b.event_date);
      if(["cancelled","completed","no_show"].includes(st)) return;
      const hasContact=String(b.customer_phone||"").trim() || String(b.customer_contact||"").trim();
      if(!hasContact){
        pushBooking(b,{type:"data", priority:1, task:"ข้อมูลติดต่อไม่ครบ", risk_flag:true});
      }
      if(isUnpaidPayment(b.payment_status)){
        pushBooking(b,{type:"payment", priority:1, task:"ตามชำระเงิน", risk_flag:true});
      }
      if(["pending","confirmed","prepared"].includes(st) && diff!==null && diff>=0 && diff<=7){
        const pickupTbd=!String(b.pickup_time||"").trim();
        let task=st==="pending" ? "ยืนยัน booking / นัดเวลา" : (st==="prepared" ? "พร้อมส่งมอบ / รอลูกค้ารับ" : (diff===0 ? "งานวันนี้: เตรียมส่งมอบ" : "งานใน "+diff+" วัน: เตรียมเครื่อง"));
        if(pickupTbd) task += " / เวลารับยัง TBD — ยืนยันเมื่อใกล้งาน";
        pushBooking(b,{type:"prep", priority: diff===0 ? 2 : 3, task});
      }
      if(st==="picked_up"){
        pushBooking(b,{type:"return", priority:1, task:"รอรับคืน / ตรวจเครื่อง"});
      }
      if(st==="returned"){
        pushBooking(b,{type:"upload", priority:2, task:"อัปโหลดไฟล์ / ส่ง Drive link"});
      }
      if(st==="uploaded"){
        pushBooking(b,{type:"close", priority:3, task:"ยืนยันส่ง link แล้ว / ปิดงาน"});
      }
    });
    events.forEach(e=>{
      if(!isActiveEvent(e) || !isTodayOrFuture(e.event_date)) return;
      const health=String(e.data_health||"").trim().toLowerCase();
      const missing=[];
      if(health && health!=="ok") missing.push("data_health: "+e.data_health);
      if(!String(e.poster_url||"").trim()) missing.push("ไม่มีรูป");
      if(!String(e.venue||"").trim()) missing.push("ไม่มีสถานที่");
      if(missing.length){
        rows.push({type:"data", priority:4, date:e.event_date, title:e.event_name||e.event_id||"", customer:"-", contact:"-", pickup_time:"", package_display:"", asset:"", booking_status:"", payment_status:"", task:missing.join(" / "), ref:""});
      }
    });
    return rows.sort((a,b)=>(a.priority-b.priority) || (dateValue(a.date)-dateValue(b.date)) || String(a.title).localeCompare(String(b.title),"th"));
  }
  function actionMatchesFilter(r, filter){
    const f=filter||"all";
    if(f==="all") return true;
    const diff=daysFromToday(r.date);
    if(f==="today") return diff===0;
    if(f==="tomorrow") return diff===1;
    if(f==="week") return diff!==null && diff>=0 && diff<=7;
    if(f==="risk") return !!r.risk_flag || r.type==="payment" || r.type==="return" || r.type==="data";
    if(f==="upload") return r.type==="upload" || r.type==="close";
    return r.type===f;
  }
  function filterActionRows(rows){
    const q=String(state.actionSearch||"").trim().toLowerCase();
    return (rows||[])
      .filter(r=>actionMatchesFilter(r, state.actionFilter))
      .filter(r=>!q || [r.title,r.customer,r.contact,r.task,r.asset,r.package_display,r.pickup_time].join(" ").toLowerCase().includes(q));
  }
  function renderActionToolbar(rows){
    const box=$("#actionToolbar");
    if(!box) return;
    const all=rows||[];
    const counts={
      all:all.length,
      today:all.filter(r=>daysFromToday(r.date)===0).length,
      tomorrow:all.filter(r=>daysFromToday(r.date)===1).length,
      week:all.filter(r=>{ const d=daysFromToday(r.date); return d!==null && d>=0 && d<=7; }).length,
      payment:all.filter(r=>r.type==="payment").length,
      prep:all.filter(r=>r.type==="prep").length,
      return:all.filter(r=>r.type==="return").length,
      upload:all.filter(r=>r.type==="upload" || r.type==="close").length,
      data:all.filter(r=>r.type==="data").length,
      risk:all.filter(r=>r.risk_flag || r.type==="payment" || r.type==="return" || r.type==="data").length
    };
    box.innerHTML=`<div class="action-filter-buttons">${OPERATION_FILTERS.map(([key,label])=>`<button class="mini-btn ${state.actionFilter===key?'active':''}" type="button" data-action-filter="${esc(key)}">${esc(label)} <span>${esc(counts[key]||0)}</span></button>`).join('')}</div>
      <label class="mini-control action-search">ค้นหาใน Command Center
        <input id="actionSearch" class="mini-search" type="search" placeholder="งาน / ลูกค้า / เบอร์ / asset / task" value="${esc(state.actionSearch||'')}" />
      </label>`;
  }
  function customerKeyFromRecord(name, contact, phone){
    const p=String(phone||"").replace(/\D+/g,"");
    if(p) return "phone:"+p;
    const c=String(contact||"").trim().toLowerCase();
    if(c) return "contact:"+c;
    const n=String(name||"").trim().toLowerCase().replace(/\s+/g," ");
    return n ? "name:"+n : "";
  }
  function customerHistoryRows(bookings, customerStats){
    const map=new Map();
    function ensure(key){
      if(!map.has(key)) map.set(key,{customer_key:key,customer_name:"",customer_contact:"",customer_phone:"",rental_count:0,first_rental_date:"",last_rental_date:"",last_event_name:"",last_booking_status:""});
      return map.get(key);
    }
    (customerStats||[]).forEach(c=>{
      const key=String(c.customer_key||"").trim() || customerKeyFromRecord(c.customer_name,c.customer_contact,c.customer_phone);
      if(!key) return;
      const item=ensure(key);
      item.customer_name=c.customer_name||item.customer_name;
      item.customer_contact=c.customer_contact||item.customer_contact;
      item.customer_phone=c.customer_phone||item.customer_phone;
      item.rental_count+=toNum(c.rental_count);
      item.first_rental_date=c.first_rental_date||item.first_rental_date;
      item.last_rental_date=c.last_rental_date||item.last_rental_date;
      item.last_event_name=c.last_event_name||item.last_event_name;
      item.last_booking_status=c.last_booking_status||item.last_booking_status;
    });
    (bookings||[]).forEach(b=>{
      const st=String(b.booking_status||"").toLowerCase().trim();
      if(["cancelled","no_show"].includes(st)) return;
      const key=customerKeyFromRecord(b.customer_name,b.customer_contact,b.customer_phone);
      if(!key) return;
      const item=ensure(key);
      item.customer_name=b.customer_name||item.customer_name;
      item.customer_contact=b.customer_contact||item.customer_contact;
      item.customer_phone=b.customer_phone||item.customer_phone;
      if(["picked_up","returned","uploaded","completed"].includes(st)) item.rental_count+=1;
      const rentalDate=b.event_date||b.created_at||"";
      if(rentalDate && (!item.first_rental_date || dateValue(rentalDate)<dateValue(item.first_rental_date))) item.first_rental_date=rentalDate;
      if(rentalDate && (!item.last_rental_date || dateValue(rentalDate)>=dateValue(item.last_rental_date))){
        item.last_rental_date=rentalDate;
        item.last_event_name=b.event_name||item.last_event_name;
        item.last_booking_status=b.booking_status||item.last_booking_status;
      }
    });
    return Array.from(map.values()).sort((a,b)=>(toNum(b.rental_count)-toNum(a.rental_count)) || (dateValue(b.last_rental_date)-dateValue(a.last_rental_date)) || textValue(a.customer_name).localeCompare(textValue(b.customer_name),"th"));
  }
  function bookingCustomerKey(b){
    return customerKeyFromRecord(b && b.customer_name, b && b.customer_contact, b && b.customer_phone);
  }
  function bookingMatchesCustomer(b, customer){
    if(!b || !customer) return false;
    const key=String(customer.customer_key||"");
    if(key && bookingCustomerKey(b)===key) return true;
    const p=String(customer.customer_phone||"").replace(/\D+/g,"");
    if(p && String(b.customer_phone||"").replace(/\D+/g,"")===p) return true;
    const c=String(customer.customer_contact||"").trim().toLowerCase();
    if(c && String(b.customer_contact||"").trim().toLowerCase()===c) return true;
    const n=String(customer.customer_name||"").trim().toLowerCase().replace(/\s+/g," ");
    return !!n && String(b.customer_name||"").trim().toLowerCase().replace(/\s+/g," ")===n;
  }
  function customerBookings(customer){
    const d=state.data||{};
    return sortedBookings((d.bookings||[]).filter(b=>bookingMatchesCustomer(b, customer)));
  }
  function findBookingByRow(rowNumber){
    const row=String(rowNumber||'').trim();
    return ((state.data||{}).bookings||[]).find(b=>String(b.row_number||'')===row) || null;
  }
  function bookingLifecycleRank(status){
    const s=String(status||'').toLowerCase().trim();
    const map={pending:1,confirmed:2,prepared:3,picked_up:4,returned:5,uploaded:6,completed:7,cancelled:0,no_show:0};
    return map[s] || 0;
  }
  function bookingLifecycleLabel(status){
    const s=String(status||'').toLowerCase().trim();
    return ({pending:'รอยืนยัน',confirmed:'ยืนยันแล้ว',prepared:'เตรียมเครื่อง',picked_up:'รับเครื่องแล้ว',returned:'คืนเครื่องแล้ว',uploaded:'อัปโหลดแล้ว',completed:'ปิดงานแล้ว',cancelled:'ยกเลิก',no_show:'ไม่มาตามนัด'})[s] || (status||'-');
  }
  function trustProfile(analytics){
    const a=analytics||{};
    let score=50;
    score += Math.min(toNum(a.completed_count), 8) * 6;
    score += Math.min(toNum(a.paid_count), 8) * 3;
    score -= Math.min(toNum(a.cancelled_count), 6) * 8;
    score -= Math.min(toNum(a.unpaid_active_count), 5) * 10;
    score -= Math.min(toNum(a.missing_contact_count), 4) * 7;
    score = Math.max(0, Math.min(100, score));
    let level='New', cls='new', note='ลูกค้าใหม่/ข้อมูลยังไม่พอ ให้เช็กข้อมูลให้ครบก่อนส่งมอบ';
    if(score>=85){ level='VIP / Trusted'; cls='vip'; note='ประวัติดีมาก เหมาะสำหรับสิทธิ์ลูกค้าเก่าหรือ no deposit ตามเงื่อนไขร้าน'; }
    else if(score>=70){ level='Good'; cls='good'; note='ลูกค้าความเสี่ยงต่ำ มีประวัติใช้งานได้ดี'; }
    else if(score<45){ level='Watchlist'; cls='risk'; note='ควรเช็กข้อมูล/การชำระเงิน/การรับคืนให้ละเอียดก่อนส่งมอบ'; }
    else if(a.unpaid_active_count || a.missing_contact_count){ level='Need Verify'; cls='verify'; note='มีข้อมูลหรือการชำระเงินที่ต้องตรวจสอบก่อนวันงาน'; }
    return {score, level, cls, note};
  }
  function customerAnalytics(customer, bookings){
    const rows=bookings||[];
    const activeStatuses=['pending','confirmed','picked_up','prepared'];
    const completedStatuses=['returned','uploaded','completed'];
    const completed=rows.filter(b=>completedStatuses.includes(String(b.booking_status||'').toLowerCase()));
    const active=rows.filter(b=>activeStatuses.includes(String(b.booking_status||'').toLowerCase()));
    const cancelled=rows.filter(b=>String(b.booking_status||'').toLowerCase()==='cancelled');
    const paid=rows.filter(b=>String(b.payment_status||'').toLowerCase()==='paid');
    const unpaidActive=active.filter(b=>isUnpaidPayment(b.payment_status));
    const upcoming=rows.filter(b=>{ const d=daysFromToday(b.event_date); return d!==null && d>=0 && activeStatuses.includes(String(b.booking_status||'').toLowerCase()); });
    const missingContact=rows.filter(b=>!String(b.customer_phone||'').trim() && !String(b.customer_contact||'').trim());
    const missingPickup=upcoming.filter(b=>!String(b.pickup_time||'').trim());
    const missingAsset=upcoming.filter(b=>!String(b.phone_asset_id||'').trim() && /phone/i.test(String(b.package_type||'')));
    const totalRevenue=rows.reduce((sum,b)=>sum+toNum(b.amount_received),0);
    const last=rows.slice().sort((a,b)=>dateValue(b.event_date)-dateValue(a.event_date))[0] || {};
    const first=rows.slice().sort((a,b)=>dateValue(a.event_date)-dateValue(b.event_date))[0] || {};
    return {
      booking_count: rows.length,
      active_count: active.length,
      completed_count: Math.max(completed.length, toNum(customer && customer.rental_count)),
      cancelled_count: cancelled.length,
      paid_count: paid.length,
      unpaid_active_count: unpaidActive.length,
      upcoming_count: upcoming.length,
      missing_contact_count: missingContact.length,
      missing_pickup_count: missingPickup.length,
      missing_asset_count: missingAsset.length,
      total_revenue: totalRevenue,
      last_event_date: last.event_date || (customer && customer.last_rental_date) || '',
      first_event_date: first.event_date || (customer && customer.first_rental_date) || '',
      last_event_name: last.event_name || (customer && customer.last_event_name) || '',
      last_status: last.booking_status || (customer && customer.last_booking_status) || ''
    };
  }
  function customerQualityIssues(customer, bookings, analytics){
    const a=analytics||customerAnalytics(customer, bookings||[]);
    const issues=[];
    if(!String(customer && customer.customer_phone || '').trim() && !String(customer && customer.customer_contact || '').trim()) issues.push({type:'bad', text:'ไม่มีเบอร์หรือ LINE/X หลักในโปรไฟล์'});
    if(a.unpaid_active_count) issues.push({type:'bad', text:`มี booking active ที่ยังไม่ paid ${a.unpaid_active_count} รายการ`});
    if(a.missing_pickup_count) issues.push({type:'warn', text:`มีงานอนาคตที่ยังไม่มีเวลารับเครื่อง ${a.missing_pickup_count} รายการ`});
    if(a.missing_asset_count) issues.push({type:'warn', text:`มีงานอนาคตที่ยังไม่ได้ล็อก asset ${a.missing_asset_count} รายการ`});
    if(a.cancelled_count>=2) issues.push({type:'warn', text:`มีประวัติยกเลิก ${a.cancelled_count} ครั้ง ควรเช็กก่อนให้สิทธิ์พิเศษ`});
    if(!issues.length) issues.push({type:'ok', text:'ข้อมูลหลักครบ ไม่มีรายการเสี่ยงเด่นจาก booking ปัจจุบัน'});
    return issues;
  }
  function crmLineMessage(b, type){
    const name=b.customer_name || 'คุณลูกค้า';
    const event=b.event_name || b.event_id || '-';
    const date=fmtDate(b.event_date) || '-';
    const pickup=fmtPickupTime(b.pickup_time) || '-';
    if(type==='payment') return `สวัสดีค่ะ ${name} ขอแจ้งเตือนเรื่องยอดชำระสำหรับงาน ${event} วันที่ ${date} ค่ะ หากชำระแล้วสามารถส่งสลิปกลับมาได้เลยนะคะ`;
    if(type==='pickup') return `สวัสดีค่ะ ${name} ยืนยันนัดรับเครื่องสำหรับงาน ${event} วันที่ ${date} เวลา ${pickup} นะคะ`;
    if(type==='return') return `สวัสดีค่ะ ${name} หลังจบงาน ${event} รบกวนคืนเครื่องตามจุดนัดหมาย และรอแอดมินตรวจเครื่อง/เลนส์ก่อนปิดงานนะคะ`;
    if(type==='upload') return `สวัสดีค่ะ ${name} แอดมินกำลังอัปโหลดไฟล์จากงาน ${event} วันที่ ${date} ให้นะคะ หากเสร็จแล้วจะส่งลิงก์ Google Drive ให้ค่ะ`;
    if(type==='close') return `สวัสดีค่ะ ${name} แอดมินส่งลิงก์ไฟล์งาน ${event} เรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ`;
    if(type==='prep') return `สวัสดีค่ะ ${name} แอดมินขอยืนยัน booking งาน ${event} วันที่ ${date} เวลารับ ${pickup} นะคะ`;
    return `สวัสดีค่ะ ${name} ขอสรุป booking งาน ${event} วันที่ ${date} เวลารับ ${pickup} ค่ะ`;
  }
  function openBookingEdit(rowNumber){
    const nav=$('.nav[data-tab="edit-booking"]');
    if(nav) nav.click();
    setTimeout(()=>{
      const form=$('#bookingEditForm');
      if(!form || !form.elements.row_number) return;
      form.elements.row_number.value=String(rowNumber||'');
      populateBookingEditForm();
      form.scrollIntoView({behavior:'smooth', block:'start'});
    },60);
  }
  function actionPriority(r){
    if(r.type==='payment') return {label:'P1', cls:'bad', title:'ต้องตามเงินก่อนส่งมอบ'};
    if(r.type==='return') return {label:'P1', cls:'bad', title:'เครื่องอยู่กับลูกค้า ต้องรับคืน/ตรวจ'};
    if(r.type==='data') return {label:'P2', cls:'warn', title:'ข้อมูลไม่ครบ ควรแก้ก่อนวันงาน'};
    if(r.type==='upload') return {label:'P2', cls:'warn', title:'ลูกค้าคืนเครื่องแล้ว ต้องอัปโหลดไฟล์'};
    if(r.type==='close') return {label:'P3', cls:'ok', title:'อัปโหลดแล้ว เหลือปิดงาน'};
    return {label:'P3', cls:'warn', title:'งานใกล้ถึง ควรเตรียมเครื่อง'};
  }
  function actionButtons(r){
    if(!r || !r.row_number) return r.ref ? `<button class="mini-btn" type="button" data-customer-key="${esc(r.ref)}">CRM</button>` : '-';
    const st=String(r.booking_status||'').toLowerCase();
    const buttons=[];
    buttons.push(`<button class="mini-btn" type="button" data-edit-booking-row="${esc(r.row_number)}">แก้</button>`);
    buttons.push(`<button class="mini-btn" type="button" data-customer-key="${esc(r.ref)}">CRM</button>`);
    if(isUnpaidPayment(r.payment_status)) buttons.push(`<button class="mini-btn danger-soft" type="button" data-quick-action="paid" data-row="${esc(r.row_number)}">Paid</button>`);
    if(['pending','confirmed'].includes(st)) buttons.push(`<button class="mini-btn" type="button" data-quick-action="prepared" data-row="${esc(r.row_number)}">เตรียมแล้ว</button>`);
    if(['prepared','picked_up'].includes(st) && bookingMissingRequiredAsset(r)) buttons.push(`<button class="mini-btn warn-soft" type="button" data-quick-action="assign_assets" data-row="${esc(r.row_number)}">จัด Asset</button>`);
    if(['pending','confirmed','prepared'].includes(st)) buttons.push(`<button class="mini-btn" type="button" data-quick-action="picked_up" data-row="${esc(r.row_number)}">รับแล้ว</button>`);
    if(st==='picked_up') buttons.push(`<button class="mini-btn" type="button" data-quick-action="returned" data-row="${esc(r.row_number)}">คืนแล้ว</button>`);
    if(st==='returned') buttons.push(`<button class="mini-btn" type="button" data-quick-action="uploaded" data-row="${esc(r.row_number)}">อัปโหลดแล้ว</button>`);
    if(st==='uploaded') buttons.push(`<button class="mini-btn" type="button" data-quick-action="completed" data-row="${esc(r.row_number)}">ปิดงาน</button>`);
    if(!['returned','uploaded','completed'].includes(st)) buttons.push(`<button class="mini-btn warn-soft" type="button" data-quick-action="no_show" data-row="${esc(r.row_number)}">No-show</button>`);
    buttons.push(`<button class="mini-btn" type="button" data-copy-line="${esc(r.type)}" data-row="${esc(r.row_number)}">LINE</button>`);
    return `<div class="inline-actions">${buttons.join('')}</div>`;
  }
  function lifecycleTimeline(bookings){
    if(!bookings || !bookings.length) return '<div class="empty-note">ยังไม่มี timeline</div>';
    return bookings.slice(0,12).map(b=>{
      const st=String(b.booking_status||'').toLowerCase();
      const cls=st==='cancelled'?'bad':(st==='returned'||st==='completed'||st==='uploaded'?'ok':(isUnpaidPayment(b.payment_status)?'warn':'info'));
      return `<div class="timeline-item ${cls}">
        <div class="timeline-dot"></div>
        <div class="timeline-main">
          <strong>${esc(fmtDate(b.event_date))} · ${esc(b.event_name||b.event_id||'')}</strong>
          <span>${esc(bookingLifecycleLabel(b.booking_status))} · ${esc(b.package_display||b.package_type||'-')} · รับ ${esc(fmtPickupTime(b.pickup_time)||'-')}</span>
          <small>Payment: ${esc(b.payment_status||'-')} · Phone: ${esc(b.phone_asset_id||'-')} · Lens: ${esc(b.lens_asset_id||'-')}</small>
        </div>
      </div>`;
    }).join('');
  }
  function setActiveCustomer(customerKey){
    state.selectedCustomerKey=String(customerKey||"");
    const nav=$('.nav[data-tab="customers"]');
    if(nav && !nav.classList.contains("active")) nav.click();
    render();
    const detail=$("#customerDetailCard") || $("#tab-customers");
    if(detail){
      setTimeout(()=>detail.scrollIntoView({behavior:"smooth", block:"start"}), 40);
    }
  }
  function renderCustomerDetail(customerHistory){
    const detailName=$("#customerDetailName"), detailMeta=$("#customerDetailMeta"), checklist=$("#customerChecklist"), tableEl=$("#customerBookingsTable");
    const profile=$("#customerProfileSummary"), riskPanel=$("#customerRiskPanel"), timeline=$("#customerTimeline");
    if(!detailName || !checklist || !tableEl) return;
    const rows=customerHistory||[];
    let customer=rows.find(c=>String(c.customer_key)===String(state.selectedCustomerKey));
    if(!customer && rows.length){
      customer=rows[0];
      state.selectedCustomerKey=String(customer.customer_key||"");
    }
    if(!customer){
      detailName.textContent="ยังไม่มีประวัติลูกค้า";
      if(detailMeta) detailMeta.textContent="เมื่อมี booking ระบบจะแสดง Customer 360, trust score, timeline และรายการที่ต้องจัดการตรงนี้";
      checklist.innerHTML="";
      if(profile) profile.innerHTML='<div class="empty-note">ยังไม่มีข้อมูลลูกค้า</div>';
      if(riskPanel) riskPanel.innerHTML='';
      if(timeline) timeline.innerHTML='';
      table(tableEl,[{label:"ข้อมูล",render:()=>"ยังไม่มีข้อมูล"}],[]);
      return;
    }
    const bookings=customerBookings(customer);
    const analytics=customerAnalytics(customer, bookings);
    const trust=trustProfile(analytics);
    const issues=customerQualityIssues(customer, bookings, analytics);
    detailName.textContent=customer.customer_name || "ไม่ระบุชื่อ";
    if(detailMeta) detailMeta.textContent=[customer.customer_phone, customer.customer_contact].filter(Boolean).join(" / ") || "ไม่มีเบอร์หรือ LINE ในระบบ";
    if(profile){
      profile.innerHTML=`<div class="crm-profile-card">
        <div class="crm-avatar">${esc(String(customer.customer_name||'KK').slice(0,2).toUpperCase())}</div>
        <div class="crm-profile-main">
          <div class="crm-profile-line"><strong>${esc(customer.customer_name||'ไม่ระบุชื่อ')}</strong><span class="trust-badge ${esc(trust.cls)}">${esc(trust.level)} · ${esc(trust.score)}/100</span></div>
          <div class="crm-contact-line">${esc([customer.customer_phone,customer.customer_contact].filter(Boolean).join(' · ') || 'ยังไม่มีข้อมูลติดต่อ')}</div>
          <div class="crm-note-line">${esc(trust.note)}</div>
        </div>
      </div>`;
    }
    checklist.innerHTML=[
      [analytics.completed_count,"เช่าสำเร็จ"],
      [analytics.booking_count,"Booking ทั้งหมด"],
      [analytics.active_count,"Active ตอนนี้"],
      [analytics.cancelled_count,"ยกเลิก"],
      [money(analytics.total_revenue),"ยอดรับรวม"],
      [fmtDate(analytics.last_event_date)||"-","ล่าสุด"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    if(riskPanel){
      riskPanel.innerHTML=`<div class="crm-risk-grid">
        ${issues.map(i=>`<div class="risk-chip ${esc(i.type)}">${esc(i.text)}</div>`).join('')}
      </div>`;
    }
    if(timeline){
      timeline.innerHTML=`<div class="section-title-row"><h3>Customer Timeline</h3><small>เรียงจากล่าสุด ใช้ดูพฤติกรรมลูกค้าและงานที่ค้าง</small></div><div class="timeline">${lifecycleTimeline(bookings)}</div>`;
    }
    table(tableEl,[
      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},
      {label:"งาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"เวลารับ",render:r=>esc(fmtPickupTime(r.pickup_time) || "-")},
      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || r.template_id || "")},
      {label:"Asset",render:r=>esc([r.phone_asset_id,r.lens_asset_id].filter(Boolean).join(" / ") || "-")},
      {label:"Booking",render:r=>{ const st=String(r.booking_status||'').toLowerCase(); const cls=['cancelled','no_show'].includes(st)?'bad':(['returned','uploaded','completed'].includes(st)?'ok':'warn'); return `<span class="pill ${cls}">${esc(bookingLifecycleLabel(r.booking_status))}</span>`; }},
      {label:"Payment",render:r=>`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>`},
      {label:"รับแล้ว",render:r=>esc(money(r.amount_received||0))},
      {label:"Action",render:r=>`<div class="inline-actions"><button class="mini-btn" type="button" data-edit-booking-row="${esc(r.row_number||'')}">แก้</button><button class="mini-btn" type="button" data-copy-line="summary" data-row="${esc(r.row_number||'')}">LINE</button></div>`}
    ], bookings);
  }


  function normalizeBookingStatus(status){
    return String(status||"").toLowerCase().trim();
  }
  function isRevenueBooking(b){
    const st=normalizeBookingStatus(b && b.booking_status);
    const pay=String(b && b.payment_status || "").toLowerCase().trim();
    if(["cancelled","no_show"].includes(st) || pay==="refunded") return false;
    if(["picked_up","returned","uploaded","completed"].includes(st)) return true;
    return toNum(b && b.amount_received)>0;
  }
  function reportDateRange(){
    const now=startOfToday();
    let start=null, end=null, label="ข้อมูลทั้งหมด";
    const range=state.reportRange||"all";
    if(range==="this_month"){
      start=new Date(now.getFullYear(), now.getMonth(), 1);
      end=new Date(now.getFullYear(), now.getMonth()+1, 0);
      label="เดือนนี้";
    }else if(range==="next_30"){
      start=new Date(now); end=new Date(now); end.setDate(end.getDate()+30); label="30 วันข้างหน้า";
    }else if(range==="last_90"){
      start=new Date(now); start.setDate(start.getDate()-90); end=new Date(now); label="ย้อนหลัง 90 วัน";
    }else if(range==="custom"){
      start=parseLocalDate(state.reportStart); end=parseLocalDate(state.reportEnd); label="กำหนดเอง";
    }
    if(start) start.setHours(0,0,0,0);
    if(end) end.setHours(23,59,59,999);
    return {start,end,label};
  }
  function bookingInReportRange(b){
    const r=reportDateRange();
    const d=parseLocalDate(b && b.event_date);
    if(!d) return false;
    if(r.start && d.getTime()<r.start.getTime()) return false;
    if(r.end && d.getTime()>r.end.getTime()) return false;
    return true;
  }
  function bookingIncludedInReport(b){
    const st=normalizeBookingStatus(b && b.booking_status);
    if(!bookingInReportRange(b)) return false;
    if(state.reportStatusMode==="completed_only") return st==="completed";
    if(state.reportStatusMode==="all_non_cancelled") return !["cancelled","no_show"].includes(st);
    return isRevenueBooking(b);
  }
  function groupAdd(map, key, seed, amount){
    const id=String(key||"-");
    if(!map.has(id)) map.set(id, Object.assign({key:id, bookings:0, revenue:0, paid:0, unpaid:0, completed:0, active:0}, seed||{}));
    const row=map.get(id);
    row.bookings += 1;
    row.revenue += amount || 0;
    return row;
  }
  function buildReportModel(data){
    const d=data||{};
    const bookings=(d.bookings||[]).filter(bookingIncludedInReport);
    const allInRange=(d.bookings||[]).filter(bookingInReportRange).filter(b=>!["cancelled","no_show"].includes(normalizeBookingStatus(b.booking_status)));
    const eventMap=new Map(), packageMap=new Map(), assetMap=new Map(), customerMap=new Map();
    let totalRevenue=0, paidCount=0, unpaidCount=0, completedCount=0, activeCount=0;
    bookings.forEach(b=>{
      const amount=toNum(b.amount_received);
      totalRevenue += amount;
      const payment=String(b.payment_status||"").toLowerCase().trim();
      const st=normalizeBookingStatus(b.booking_status);
      if(payment==="paid") paidCount += 1; else unpaidCount += 1;
      if(st==="completed") completedCount += 1;
      if(["pending","confirmed","prepared","picked_up","returned","uploaded"].includes(st)) activeCount += 1;
      const ev=groupAdd(eventMap, b.event_id || b.event_name, {event_id:b.event_id||"", event_name:b.event_name||b.event_id||"", event_date:b.event_date||""}, amount);
      if(payment==="paid") ev.paid += 1; else ev.unpaid += 1;
      const pkg=groupAdd(packageMap, b.package_display || b.package_type, {package_display:b.package_display||b.package_type||"-", package_type:b.package_type||""}, amount);
      if(payment==="paid") pkg.paid += 1; else pkg.unpaid += 1;
      [[b.phone_asset_id,b.phone_model_display,"phone"],[b.lens_asset_id,b.lens_model_display,"lens"]].forEach(([assetId,label,type])=>{
        if(!assetId) return;
        const a=groupAdd(assetMap, assetId, {asset_id:assetId, asset_type:type, model_display:label||assetId}, amount);
        a.last_event_date = !a.last_event_date || dateValue(b.event_date)>dateValue(a.last_event_date) ? b.event_date : a.last_event_date;
        a.last_customer = dateValue(b.event_date)>=dateValue(a.last_event_date||b.event_date) ? (b.customer_name||"") : a.last_customer;
      });
      const ck=bookingCustomerKey(b) || b.customer_name || b.customer_phone || "-";
      const c=groupAdd(customerMap, ck, {customer_key:ck, customer_name:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone].filter(Boolean).join(" / ")}, amount);
      c.last_event_date = !c.last_event_date || dateValue(b.event_date)>dateValue(c.last_event_date) ? b.event_date : c.last_event_date;
      c.last_event_name = dateValue(b.event_date)>=dateValue(c.last_event_date||b.event_date) ? (b.event_name||"") : c.last_event_name;
    });
    const events=[...eventMap.values()].sort((a,b)=>b.revenue-a.revenue || b.bookings-a.bookings || dateValue(b.event_date)-dateValue(a.event_date));
    const packages=[...packageMap.values()].sort((a,b)=>b.revenue-a.revenue || b.bookings-a.bookings);
    const assets=[...assetMap.values()].sort((a,b)=>b.bookings-a.bookings || b.revenue-a.revenue);
    const customers=[...customerMap.values()].sort((a,b)=>b.revenue-a.revenue || b.bookings-a.bookings);
    const repeatCustomers=customers.filter(c=>c.bookings>=2).length;
    const avgRevenue=bookings.length ? totalRevenue/bookings.length : 0;
    const assetsAvailable=(d.assets||[]).filter(a=>a.rentable!==false && String(a.status||"").toLowerCase()!=="inactive").length;
    const utilizedAssets=assets.length;
    const utilizationRate=assetsAvailable ? Math.round((utilizedAssets/assetsAvailable)*100) : 0;
    return {bookings, allInRange, events, packages, assets, customers, totalRevenue, paidCount, unpaidCount, completedCount, activeCount, repeatCustomers, avgRevenue, assetsAvailable, utilizedAssets, utilizationRate};
  }
  function reportInsightRows(model, data){
    const d=data||{};
    const rows=[];
    const overduePayments=(d.bookings||[]).filter(b=>bookingInReportRange(b) && isUnpaidPayment(b.payment_status) && !isClosedBookingStatus(b.booking_status)).length;
    const missingPickup=(d.bookings||[]).filter(b=>bookingInReportRange(b) && !String(b.pickup_time||"").trim() && !isClosedBookingStatus(b.booking_status)).length;
    const topEvent=model.events[0];
    const topAsset=model.assets[0];
    const topPackage=model.packages[0];
    if(topEvent) rows.push({level:"ok", title:"งานที่สร้างรายรับสูงสุด", detail:`${topEvent.event_name} · ${money(topEvent.revenue)} บาท · ${topEvent.bookings} booking`});
    if(topPackage) rows.push({level:"ok", title:"แพ็กเกจที่ทำเงินดีที่สุด", detail:`${topPackage.package_display} · ${money(topPackage.revenue)} บาท · ${topPackage.bookings} booking`});
    if(topAsset) rows.push({level:"ok", title:"Asset ที่ถูกใช้งานสูงสุด", detail:`${topAsset.asset_id} · ${topAsset.bookings} ครั้ง · รายรับเกี่ยวข้อง ${money(topAsset.revenue)} บาท`});
    if(overduePayments) rows.push({level:"bad", title:"ยังมีรายการต้องตามเงิน", detail:`พบ ${overduePayments} booking ที่ยังไม่ paid/refunded และยังไม่ปิดงาน`});
    if(missingPickup) rows.push({level:"info", title:"เวลารับเครื่องยัง TBD", detail:`พบ ${missingPickup} booking ในช่วงรายงานที่ยังไม่ยืนยันเวลารับ ซึ่งเว้นว่างได้ตาม policy; ระบบกันคิวแบบ conservative อยู่แล้ว และค่อยใส่เวลาเมื่อยืนยันกับลูกค้า`});
    if(model.utilizationRate>=80) rows.push({level:"ok", title:"Asset utilization สูง", detail:`ใช้ asset ${model.utilizedAssets}/${model.assetsAvailable} รายการในช่วงรายงาน (${model.utilizationRate}%) อาจเริ่มดูความคุ้มค่าการซื้อเพิ่ม`});
    if(model.repeatCustomers) rows.push({level:"ok", title:"มีลูกค้าเช่าซ้ำ", detail:`พบลูกค้าเช่าซ้ำ ${model.repeatCustomers} ราย ควรใช้ VIP/Good Customer badge ทำโปรกลับมาเช่าอีก`});
    if(!rows.length) rows.push({level:"warn", title:"ยังไม่มีข้อมูลพอสำหรับ Insight", detail:"เลือกช่วงข้อมูลอื่น หรือเพิ่ม booking ที่มีจำนวนเงินรับแล้วเพื่อให้รายงานมีความหมายมากขึ้น"});
    return rows;
  }
  function renderReports(data){
    const model=buildReportModel(data||{});
    const r=reportDateRange();
    const scopeParts=[r.label];
    if(r.start) scopeParts.push(fmtDate(r.start));
    if(r.end) scopeParts.push("ถึง "+fmtDate(r.end));
    if($("#reportScopeLabel")) $("#reportScopeLabel").textContent=scopeParts.join(" · ");
    if($("#reportKpis")){
      $("#reportKpis").innerHTML=[
        `<div><strong>${esc(money(model.totalRevenue))}</strong><span>ยอดรับจริง</span></div>`,
        `<div><strong>${esc(model.bookings.length)}</strong><span>Booking ที่นับรายงาน</span></div>`,
        `<div><strong>${esc(model.completedCount)}</strong><span>Completed</span></div>`,
        `<div><strong>${esc(model.repeatCustomers)}</strong><span>ลูกค้าเช่าซ้ำ</span></div>`,
        `<div><strong>${esc(model.utilizationRate)}%</strong><span>Asset utilization</span></div>`,
        `<div><strong>${esc(money(Math.round(model.avgRevenue)))}</strong><span>รายรับเฉลี่ย / booking</span></div>`
      ].join("");
    }
    if($("#eventPerformanceCount")) $("#eventPerformanceCount").textContent=model.events.length+" งาน";
    table($("#eventPerformanceTable"),[
      {label:"งาน",render:x=>`<strong>${esc(x.event_name)}</strong><br><small>${esc(fmtDate(x.event_date))}</small>`},
      {label:"Booking",render:x=>esc(x.bookings)},
      {label:"Paid/Unpaid",render:x=>esc(`${x.paid}/${x.unpaid}`)},
      {label:"ยอดรับ",render:x=>esc(money(x.revenue))}
    ], model.events.slice(0,50));
    if($("#packagePerformanceCount")) $("#packagePerformanceCount").textContent=model.packages.length+" แพ็กเกจ";
    table($("#packagePerformanceTable"),[
      {label:"แพ็กเกจ",render:x=>esc(x.package_display)},
      {label:"Booking",render:x=>esc(x.bookings)},
      {label:"Paid/Unpaid",render:x=>esc(`${x.paid}/${x.unpaid}`)},
      {label:"ยอดรับ",render:x=>esc(money(x.revenue))}
    ], model.packages.slice(0,50));
    if($("#assetUtilizationCount")) $("#assetUtilizationCount").textContent=model.assets.length+" asset ถูกใช้";
    table($("#assetUtilizationTable"),[
      {label:"Asset",render:x=>`<strong>${esc(x.asset_id)}</strong><br><small>${esc(x.model_display||x.asset_type)}</small>`},
      {label:"ใช้",render:x=>esc(x.bookings+" ครั้ง")},
      {label:"ล่าสุด",render:x=>esc(fmtDate(x.last_event_date))},
      {label:"ยอดรับเกี่ยวข้อง",render:x=>esc(money(x.revenue))}
    ], model.assets.slice(0,80));
    if($("#customerPerformanceCount")) $("#customerPerformanceCount").textContent=model.customers.length+" ลูกค้า";
    table($("#customerPerformanceTable"),[
      {label:"ลูกค้า",render:x=>`<strong>${esc(x.customer_name)}</strong><br><small>${esc(x.contact||'-')}</small>`},
      {label:"เช่า",render:x=>esc(x.bookings+" ครั้ง")},
      {label:"ล่าสุด",render:x=>esc(fmtDate(x.last_event_date))},
      {label:"ยอดรับ",render:x=>esc(money(x.revenue))}
    ], model.customers.slice(0,80));
    const insights=reportInsightRows(model, data||{});
    if($("#insightCount")) $("#insightCount").textContent=insights.length+" insight";
    const box=$("#reportInsights");
    if(box){
      box.innerHTML=insights.map(x=>`<div class="insight-item ${esc(x.level)}"><strong>${esc(x.title)}</strong><span>${esc(x.detail)}</span></div>`).join("");
    }
  }

  function rentalPercent(value){
    const n=Number(value||0);
    return (n*100).toLocaleString("th-TH",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
  }
  function rentalBarList(el, rows, labelKey, valueKey){
    if(!el) return;
    const list=Array.isArray(rows)?rows:[];
    if(!list.length){ el.innerHTML='<div class="muted">ยังไม่มีข้อมูล</div>'; return; }
    const max=Math.max(1,...list.map(r=>Number(r[valueKey]||0)));
    el.innerHTML=list.map(r=>{
      const value=Number(r[valueKey]||0);
      const width=Math.max(1,(value/max)*100);
      return `<div class="rental-bar-row"><div class="rental-bar-label" title="${esc(r[labelKey]||'-')}">${esc(r[labelKey]||'-')}</div><div class="rental-bar-track"><div class="rental-bar-fill" style="width:${width}%"></div></div><div class="rental-bar-value">${esc(value)}</div></div>`;
    }).join("");
  }
  function renderRentalAnalytics(){
    const status=$("#rentalAnalyticsStatus");
    if(state.rentalAnalyticsLoading){ if(status){ status.className="rental-analytics-status"; status.textContent="กำลังโหลด Rental Analytics..."; } return; }
    if(state.rentalAnalyticsError){
      if(status){ status.className="rental-analytics-status bad"; status.textContent="Rental Analytics โหลดไม่สำเร็จ: "+state.rentalAnalyticsError+" · ส่วนอื่นของ DCRM ยังใช้งานได้ตามปกติ"; }
      return;
    }
    const d=state.rentalAnalytics;
    if(!d){ if(status) status.textContent="ยังไม่ได้โหลด Rental Analytics"; return; }
    const m=d.metrics||{};
    if(status){ status.className="rental-analytics-status ok"; status.textContent=`อัปเดตแล้ว · ${d.generated_at?new Date(d.generated_at).toLocaleString("th-TH"):""} · Analytics เป็น Read-only`; }
    const kpis=$("#rentalAnalyticsKpis");
    if(kpis){
      kpis.innerHTML=[
        [m.unique_customers||0,"ลูกค้าไม่ซ้ำ"],
        [m.non_cancelled_bookings||0,"คิวไม่ยกเลิก"],
        [m.completed_bookings||0,"Completed"],
        [m.active_bookings||0,"Active"],
        [m.repeat_customers||0,"ลูกค้าเช่าซ้ำ"],
        [Number(m.avg_bookings_per_customer||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}),"เฉลี่ยครั้ง / ลูกค้า"],
        [money(m.amount_received||0)+"฿","ยอดรับแล้วตามข้อมูล"],
        [rentalPercent(m.cancellation_rate||0),"Cancellation Rate"],
        [rentalPercent(m.repeat_customer_rate||0),"Repeat Customer Rate"],
        [rentalPercent(m.affiliation_coverage_rate||0),"Affiliation Coverage"]
      ].map(x=>`<div><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></div>`).join("");
    }
    const snap=$("#rentalAnalyticsSnapshot");
    if(snap){
      const peak=d.peak_month ? `${d.peak_month.month} · ${d.peak_month.customers} คน` : "—";
      const topEvent=d.top_event ? `${d.top_event.event_name} · ${d.top_event.customers} คน` : "—";
      const topOrg=d.top_affiliation ? `${d.top_affiliation.affiliation} · ${d.top_affiliation.customers} คน` : "—";
      const range=d.range && d.range.start ? `${d.range.start} → ${d.range.end}` : "—";
      snap.innerHTML=[['เดือนพีค',peak],['งานอันดับ 1',topEvent],['ค่าย/สังกัดอันดับ 1',topOrg],['ช่วงข้อมูล',range]].map(x=>`<div><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join("");
    }
    rentalBarList($("#rentalMonthlyBars"),(d.monthly||[]).slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))),"month","customers");
    rentalBarList($("#rentalOrganizerBars"),(d.affiliation_mix||[]).filter(x=>x.affiliation!=="ยังไม่ระบุ / Unknown").slice(0,10),"affiliation","customers");
    rentalBarList($("#rentalPackageBars"),(d.package_mix||[]).slice(0,10),"package_type","bookings");
    rentalBarList($("#rentalStatusBars"),(d.status_mix||[]).slice(0,10),"status","bookings");
    const coverage=$("#rentalOrganizerCoverage");
    if(coverage) coverage.textContent=`ระบุได้ ${rentalPercent(m.affiliation_coverage_rate||0)} · Unknown ${m.affiliation_unknown_bookings||0} คิว`;
    table($("#rentalTopEventsTable"),[
      {label:"งาน",render:r=>`<strong>${esc(r.event_name||'-')}</strong><br><small>${esc(r.affiliation||'ยังไม่ระบุ / Unknown')}</small>`},
      {label:"ลูกค้า",render:r=>esc(r.customers||0)},
      {label:"Booking",render:r=>esc(r.bookings||0)},
      {label:"ยอดรับ",render:r=>esc(money(r.amount_received||0))+"฿"}
    ],(d.top_events||[]).slice(0,15));
    table($("#rentalOrganizerTable"),[
      {label:"ค่าย / สังกัดศิลปิน",render:r=>`<strong>${esc(r.affiliation||'-')}</strong><br><small>${esc(r.mapping_summary||'')}</small>`},
      {label:"ลูกค้า",render:r=>esc(r.customers||0)},
      {label:"Booking",render:r=>esc(r.bookings||0)},
      {label:"งาน",render:r=>esc(r.events||0)},
      {label:"ยอดรับ",render:r=>esc(money(r.amount_received||0))+"฿"}
    ],(d.affiliation_mix||[]).filter(r=>r.affiliation!=="ยังไม่ระบุ / Unknown").slice(0,20));
    const q=$("#rentalAnalyticsQuality");
    if(q){
      const notes=Array.isArray(d.definitions)?d.definitions:[];
      q.innerHTML=notes.map((text,i)=>`<div class="insight-item ${i===0?'ok':''}"><strong>${i===0?'หลักการนับ':'หมายเหตุ '+i}</strong><span>${esc(text)}</span></div>`).join("");
    }
  }
  async function rentalAnalyticsApi(){
    const res=await fetch("/api/kk-rental-dashboard",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Admin-Pin":state.pin},
      body:JSON.stringify({})
    });
    const data=await res.json().catch(()=>({ok:false,error:"Invalid Rental Analytics response"}));
    if(!data.ok) throw new Error(data.error||"Rental Analytics request failed");
    return data.data||{};
  }
  async function loadRentalAnalytics(){
    if(!state.pin || state.rentalAnalyticsLoading) return;
    state.rentalAnalyticsLoading=true;
    state.rentalAnalyticsError="";
    renderRentalAnalytics();
    try{
      state.rentalAnalytics=await rentalAnalyticsApi();
    }catch(err){
      state.rentalAnalyticsError=err && err.message ? err.message : String(err);
    }finally{
      state.rentalAnalyticsLoading=false;
      renderRentalAnalytics();
    }
  }

  function startOfToday(){
    const d=parseLocalDate(KKSnapshotHealth.bangkokDay());
    d.setHours(0,0,0,0);
    return d;
  }
  function isTodayOrFuture(v){
    const d=parseLocalDate(v);
    if(!d) return false;
    d.setHours(0,0,0,0);
    return d.getTime()>=startOfToday().getTime();
  }
  function bookingLabel(b){
    return `${fmtDate(b.event_date)} · ${b.event_name||b.event_id||''} · ${b.customer_name||'-'} · ${b.booking_status||''}`;
  }
  function toNum(v){
    if(v===null || v===undefined || v==='') return 0;
    const n=Number(String(v).replace(/,/g,'').trim());
    return Number.isFinite(n) ? n : 0;
  }
  function isEventOpen(e){
    return String(e && e.status || '').toLowerCase().trim() === 'open';
  }
  function isActiveEvent(e){
    // Admin operational dropdowns should only show events that are actually open and active on web.
    return !!e && isEventOpen(e) && e.active_on_web !== false;
  }
  function findEventById(eventId){
    const id=String(eventId||'').trim();
    return ((state.data||{}).events||[]).find(e=>String(e.event_id||'').trim()===id) || null;
  }
  function findPackageByTemplateId(templateId){
    const id=String(templateId||'').trim();
    return ((state.data||{}).packages||[]).find(p=>String(p.template_id||'').trim()===id) || null;
  }
  function isWebPackageBookable(p){
    const st=String(p && p.package_status || '').toLowerCase().trim();
    return !!p && (st==='available' || st==='open') && toNum(p.available_count)>0 && toNum(p.price)>0;
  }
  function webPackagesForEvent(eventId){
    const d=state.data||{};
    const id=String(eventId||'').trim();
    return (d.web_packages||[]).filter(p=>String(p.event_id||'').trim()===id);
  }
  function templateIdFromWebPackage(wp){
    const pkgId=String(wp && wp.package_id || '').trim();
    const eventId=String(wp && wp.event_id || '').trim();
    if(wp && wp.template_id) return String(wp.template_id).trim();
    const tplPos=pkgId.indexOf('TPL-');
    if(tplPos>=0) return pkgId.slice(tplPos);
    if(eventId && pkgId.indexOf(eventId+'-')===0) return pkgId.slice(eventId.length+1);
    return pkgId;
  }
  function bookableWebPackagesForEvent(eventId){
    return webPackagesForEvent(eventId).filter(isWebPackageBookable);
  }
  function hasWebPackageSource(){
    const d=state.data||{};
    return Array.isArray(d.web_packages) && d.web_packages.length>0;
  }
  function eventHasBookablePackage(eventId){
    return !hasWebPackageSource() || bookableWebPackagesForEvent(eventId).length>0;
  }
  function packageLabelFromWebRow(wp){
    const d=state.data||{};
    const byId={};
    (d.packages||[]).forEach(p=>{ byId[String(p.template_id||'').trim()] = p; });
    const templateId=templateIdFromWebPackage(wp);
    const pkg=byId[templateId] || {};
    const base=pkg.display_name || wp.model_display || templateId || wp.package_type || 'แพ็กเกจ';
    const price=toNum(wp.price || pkg.standard_price);
    const left=toNum(wp.available_count);
    return `${base} · ${money(price)}฿ · เหลือ ${left}`;
  }

  function bookingSelectedPackagePrice(){
    const form=$("#bookingForm");
    if(!form || !state.data) return null;
    const eventId=String(form.elements.event_id && form.elements.event_id.value || "").trim();
    const templateId=String(form.elements.template_id && form.elements.template_id.value || "").trim();
    if(!eventId || !templateId) return null;
    const pkg=findPackageByTemplateId(templateId) || {template_id:templateId};
    const webRows=bookableWebPackagesForEvent(eventId);
    const wp=webRows.find(p=>String(templateIdFromWebPackage(p))===templateId) || webPackageFor(eventId, pkg);
    if(wp && toNum(wp.price)>0){
      return {price:toNum(wp.price), source:"ราคาหน้าบ้านจริง", template_id:templateId};
    }
    const o=latestOverrideByCanonical(eventId, pkg);
    if(o && String(o.override_price||"").trim()!==""){
      return {price:toNum(o.override_price), source:"ราคาเฉพาะงาน", template_id:templateId};
    }
    if(pkg && toNum(pkg.standard_price)>0){
      return {price:toNum(pkg.standard_price), source:"ราคาหลัก", template_id:templateId};
    }
    return null;
  }

  function updateBookingAmountHint(info){
    const hint=$("#bookingAmountAutoHint");
    if(!hint) return;
    if(info && toNum(info.price)>0){
      hint.textContent=`Auto จาก${info.source}: ${money(info.price)}฿ · แก้เลขเองได้ถ้ามีโปร/ส่วนลด`;
      hint.classList.remove("warn");
    }else{
      hint.textContent="เลือกแพ็กเกจแล้วระบบจะเติมราคาที่ลูกค้าเห็นจริงให้อัตโนมัติ แต่ยังแก้เลขเองได้";
      hint.classList.add("warn");
    }
  }

  function autofillBookingAmountFromPackage(){
    const form=$("#bookingForm");
    if(!form || !form.elements.amount_received) return;
    const info=bookingSelectedPackagePrice();
    updateBookingAmountHint(info);
    if(!info || toNum(info.price)<=0) return;
    // Always refill when package changes. Admin can type a new amount after selecting the package
    // for promos, discounts, partial payment, or special cases.
    form.elements.amount_received.value=String(info.price);
    form.elements.amount_received.dataset.autoPrice=String(info.price);
    form.elements.amount_received.dataset.autoPriceSource=info.source||"";
  }
  function populateBookingPackages(){
    const form=$("#bookingForm");
    if(!form || !state.data) return;
    const eventSel=form.elements.event_id;
    const pkgSel=form.elements.template_id;
    if(!eventSel || !pkgSel) return;
    const current=pkgSel.value;
    const eventId=eventSel.value;
    if(hasWebPackageSource()){
      const rows=bookableWebPackagesForEvent(eventId);
      if(!eventId){
        pkgSel.innerHTML='<option value="">เลือกงานก่อน</option>';
        pkgSel.disabled=true;
      }else if(!rows.length){
        pkgSel.innerHTML='<option value="">งานนี้เต็มแล้ว / ไม่มีแพ็กเกจว่าง</option>';
        pkgSel.disabled=true;
      }else{
        pkgSel.disabled=false;
        pkgSel.innerHTML='<option value="">เลือกแพ็กเกจที่ยังว่าง</option>'+rows.map(p=>opt(templateIdFromWebPackage(p), packageLabelFromWebRow(p))).join('');
        if(current && rows.some(p=>String(templateIdFromWebPackage(p))===String(current))) pkgSel.value=current;
      }
    }else{
      pkgSel.disabled=false;
      pkgSel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(state.data.packages||[])
        .filter(p=>p.active!==false)
        .map(p=>opt(p.template_id, `${p.display_name||p.template_id} · ${money(p.standard_price)}฿`)).join('');
      if(current) pkgSel.value=current;
    }
  }
  function findOverride(eventId, templateId){
    const d=state.data||{};
    return latestOverride(eventId, templateId);
  }
  function populateEventOverrideForm(){
    const form=$("#eventPriceOverrideForm");
    if(!form || !state.data) return;
    const eventId=form.elements.event_id && form.elements.event_id.value;
    const templateId=form.elements.template_id && form.elements.template_id.value;
    const o=findOverride(eventId, templateId);
    form.elements.override_price.value=o && o.override_price!==undefined && o.override_price!==null ? o.override_price : "";
    form.elements.active_override.value=o && o.active_override!=="" && o.active_override!==undefined ? String(o.active_override) : "";
    form.elements.override_note.value=o ? (o.override_note||"") : "";
    form.elements.sort_order_override.value=o ? (o.sort_order_override||"") : "";
    form.elements.use_case_override.value=o ? (o.use_case_override||"") : "";
  }

  function activeMasterPackages(){
    const d=state.data||{};
    return (d.packages||[])
      .filter(p=>String(p.template_id||"").trim() && p.active!==false)
      .slice()
      .sort((a,b)=>String(a.package_type||"").localeCompare(String(b.package_type||"")) || String(a.display_name||a.template_id).localeCompare(String(b.display_name||b.template_id),"th"));
  }
  function renderCreateEventPriceOverrides(){
    const box=$("#createEventPriceOverrides");
    if(!box) return;
    const rows=activeMasterPackages();
    if(!rows.length){
      box.innerHTML='<div class="empty-state compact-empty">ยังไม่มีแพ็กเกจหลักที่เปิดใช้งาน กรุณาเพิ่มแพ็กเกจก่อน</div>';
      updateCreateEventPriceUi();
      return;
    }
    box.innerHTML=rows.map(p=>{
      const tpl=String(p.template_id||"").trim();
      const label=p.display_name||tpl;
      const type=p.package_type||"package";
      const standard=money(p.standard_price||0);
      const ph=p.standard_price || '1290';
      return `<div class="create-price-row compact" data-template-id="${esc(tpl)}">
        <div class="create-price-meta">
          <strong>${esc(label)}</strong>
          <small>${esc(type)} · ราคาหลัก ${standard}฿</small>
        </div>
        <label class="mini-field"><span>ราคาเฉพาะงาน</span><input data-field="override_price" type="number" min="0" step="1" placeholder="${esc(ph)}" /></label>
        <label class="mini-field"><span>สถานะ</span>
          <select data-field="active_override">
            <option value="">ใช้ค่าหลัก</option>
            <option value="true">เปิดขาย</option>
            <option value="false">ซ่อน</option>
          </select>
        </label>
        <label class="mini-field note-field"><span>Note</span><input data-field="override_note" placeholder="โปร/เงื่อนไข" /></label>
      </div>`;
    }).join('');
    $$("#createEventPriceOverrides input, #createEventPriceOverrides select").forEach(el=>{
      el.addEventListener("input", updateCreateEventPriceUi);
      el.addEventListener("change", updateCreateEventPriceUi);
    });
    updateCreateEventPriceUi();
  }
  function eventPriceToggleEnabled(){
    const toggle=$("#eventPriceToggle");
    return !!(toggle && toggle.checked);
  }
  function updateCreateEventPriceUi(){
    const toggle=$("#eventPriceToggle");
    const advanced=$("#createEventPriceAdvanced");
    const panel=advanced ? advanced.closest(".inline-price-panel") : null;
    const summary=$("#createEventPriceSummary");
    const submit=$("#createEventSubmitBtn");
    const enabled=eventPriceToggleEnabled();
    if(advanced) advanced.classList.toggle("hidden", !enabled);
    if(panel) panel.classList.toggle("collapsed", !enabled);
    const changed=$$("#createEventPriceOverrides .create-price-row").filter(row=>{
      return ["override_price","active_override","override_note"].some(f=>{
        const el=row.querySelector(`[data-field="${f}"]`);
        return el && String(el.value||"").trim()!=="";
      });
    }).length;
    if(summary){
      summary.textContent = enabled
        ? (changed ? `เปิดอยู่ · ตั้งราคาแล้ว ${changed} แพ็กเกจ` : "เปิดอยู่ · ยังไม่ได้ใส่ราคาเฉพาะงาน")
        : "ปิดอยู่ · ใช้ราคาหลักทั้งหมด";
    }
    if(submit) submit.textContent = enabled && changed ? "สร้างงาน + ตั้งราคา" : "สร้างงาน";
  }
  function resetCreateEventPriceOverrides(){
    $$("#createEventPriceOverrides input, #createEventPriceOverrides select").forEach(el=>{ el.value=""; });
    updateCreateEventPriceUi();
  }
  function collectCreateEventPriceOverrides(){
    if(!eventPriceToggleEnabled()) return [];
    return $$("#createEventPriceOverrides .create-price-row").map(row=>{
      const get=f=>{ const el=row.querySelector(`[data-field="${f}"]`); return el ? String(el.value||"").trim() : ""; };
      return {
        template_id:String(row.dataset.templateId||"").trim(),
        override_price:get("override_price"),
        active_override:get("active_override"),
        override_note:get("override_note"),
        sort_order_override:"",
        use_case_override:""
      };
    }).filter(o=>o.template_id && (o.override_price!=="" || o.active_override!=="" || o.override_note!=="" || o.sort_order_override!=="" || o.use_case_override!==""));
  }

  function populateEventUpdateForm(){
    const form=$("#eventUpdateForm");
    if(!form || !state.data) return;
    const eventId=form.elements.event_id && form.elements.event_id.value;
    const e=findEventById(eventId);
    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };
    if(!e){
      ["event_name","event_date","venue","poster_url","status","active_on_web","note"].forEach(k=>set(k,""));
      return;
    }
    set("event_name", e.event_name || "");
    set("event_date", dateToInput(e.event_date));
    set("venue", e.venue || "");
    set("poster_url", e.poster_url || "");
    set("status", String(e.status||"").toLowerCase() || "open");
    set("active_on_web", e.active_on_web===false ? "false" : "true");
    set("note", e.note || "");
  }

  function populatePackageUpdateForm(){
    const form=$("#packageUpdateForm");
    if(!form || !state.data) return;
    const templateId=form.elements.template_id && form.elements.template_id.value;
    const p=findPackageByTemplateId(templateId);
    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };
    if(!p){
      ["standard_price","display_name","use_case","active"].forEach(k=>set(k,""));
      return;
    }
    set("standard_price", p.standard_price || 0);
    set("display_name", p.display_name || "");
    set("use_case", p.use_case || "");
    set("active", p.active===false ? "false" : "true");
  }

  function populateBookingEditForm(){
    const form=$("#bookingEditForm");
    if(!form || !state.data) return;
    const sel=form.elements.row_number;
    if(!sel) return;
    const rows=sortedBookings((state.data.bookings||[]).filter(shouldShowInEditBooking));
    const current=sel.value;
    sel.innerHTML='<option value="">เลือก Booking ที่ยังต้องแก้ / ยกเลิก</option>'+
      rows.map(b=>opt(b.row_number, bookingLabel(b))).join('');
    if(current && rows.some(b=>String(b.row_number)===String(current))) sel.value=current;
    const b=rows.find(x=>String(x.row_number)===String(sel.value));
    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };
    if(!b){
      ["booking_status","customer_name","customer_contact","customer_phone","contact_channel","payment_status","amount_received","pickup_time","return_time","phone_asset_id","lens_asset_id","booking_note"].forEach(k=>set(k,""));
      return;
    }
    set("booking_status", b.booking_status || "confirmed");
    set("customer_name", b.customer_name || "");
    set("customer_contact", b.customer_contact || "");
    set("customer_phone", b.customer_phone || "");
    set("contact_channel", b.contact_channel || "LINE");
    set("payment_status", b.payment_status || "unpaid");
    set("amount_received", b.amount_received || 0);
    set("pickup_time", fmtPickupTime(b.pickup_time));
    set("return_time", fmtPickupTime(b.return_time));
    set("phone_asset_id", b.phone_asset_id || "");
    set("lens_asset_id", b.lens_asset_id || "");
    set("booking_note", b.note || "");
  }

  async function api(action, payload={}){
    const readOnlyActions=["snapshot","snapshotHealth","systemHealth","phase1Health"];
    if(state.data && state.data.degraded_read_only && !readOnlyActions.includes(action)) throw new Error("ระบบอยู่ในโหมดอ่านอย่างเดียวชั่วคราว เพราะ Apps Script ยังไม่พร้อม — ดูข้อมูลได้ แต่การบันทึก/แก้ไขถูกปิดเพื่อความปลอดภัย");
    if(snapshotState.stale && !readOnlyActions.includes(action)) throw new Error("ข้อมูลเก่า: กรุณา Refresh ให้สำเร็จก่อนบันทึก");
    const maxAttempts=action==="snapshot" ? 2 : 1;
    let lastError=null;
    for(let attempt=1; attempt<=maxAttempts; attempt++){
      try{
        const res=await fetch("/api/kk-admin",{
          method:"POST",
          headers:{"Content-Type":"application/json","X-Admin-Pin":state.pin},
          body:JSON.stringify(Object.assign({action},payload))
        });
        const data=await res.json().catch(()=>({ok:false,error:"Invalid server response"}));
        if(!res.ok || (!data.ok && !(action==="systemHealth" && data.data && data.data.rows))){
          const err=new Error(data.error||"Request failed");
          err.code=data.error_code||"";
          err.httpStatus=res.status;
          err.upstreamStatus=Number(data.upstream_status||0);
          err.upstreamFailureClass=String(data.upstream_failure_class||"");
          err.retryable=data.retryable===true;
          err.action=data.action||action;
          throw err;
        }
        return data;
      }catch(err){
        lastError=err;
        const transientStatus=Number(err.upstreamStatus||err.httpStatus||0);
        const retryable=action==="snapshot" && attempt<maxAttempts &&
          (err.code==="UPSTREAM_TIMEOUT" ||
           err.code==="UPSTREAM_ERROR" ||
           err.retryable===true ||
           transientStatus===408 || transientStatus===429 || transientStatus>=500 ||
           /timed out/i.test(String(err.message||"")));
        if(!retryable) throw err;
        await new Promise(resolve=>setTimeout(resolve,1200));
      }
    }
    throw lastError||new Error("Request failed");
  }

  function esc(v){
    return String(v ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }
  function opt(value, label){
    return `<option value="${esc(value)}">${esc(label)}</option>`;
  }
  function versionDiagnosticsRows(data){
    const d=data||{};
    const rows=[];
    const backendVersion = d.admin_api_version || (d.phase1_diagnostics && d.phase1_diagnostics.admin_api_version) || "";
    const proxyVersion = d.frontend_proxy_version || "";
    const spreadsheetId = d.spreadsheet_id || "";
    const frontendSheetId = d.frontend_sheet_id || "";
    const sameSheet = spreadsheetId && frontendSheetId && spreadsheetId === frontendSheetId;
    rows.push({check:"Version · Admin UI", status:"OK", detail:KK_ADMIN_UI_VERSION, note:"Line-by-line audited frontend/admin package"});
    rows.push({check:"Version · Vercel Proxy", status: proxyVersion===EXPECTED_PROXY_VERSION ? "OK" : "CHECK", detail:proxyVersion || "missing", note:"Expected "+EXPECTED_PROXY_VERSION});
    rows.push({check:"Version · Apps Script", status: backendVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:backendVersion || "missing", note:"Expected "+EXPECTED_BACKEND_VERSION+". Verify the deployed source; never overwrite deployed 9_5_9 with repository 9_5_8"});
    rows.push({check:"Sheet ID · Frontend vs Apps Script", status: sameSheet ? "OK" : "CHECK", detail:(frontendSheetId||"missing")+" / "+(spreadsheetId||"missing"), note:sameSheet ? "Same backend" : "GOOGLE_SHEET_ID may not match Apps Script spreadsheet"});
    if(d.phase1_diagnostics){
      const x=d.phase1_diagnostics;
      rows.push({check:"ENV · KK_POSTER_FOLDER_ID", status:x.poster_folder_id_set ? "OK" : "CHECK", detail:x.poster_folder_id_set ? "set" : "missing", note:"Needed for Upload Poster"});
      rows.push({check:"Log Sheets", status:x.log_sheets_ready ? "OK" : "CHECK", detail:x.log_sheets_ready ? "15/16 logs ready" : "missing", note:"Run KK Admin > Setup/Repair Named Ranges"});
      rows.push({check:"Read fallback", status:x.direct_fallback_disabled ? "CHECK" : "OK", detail:x.direct_fallback_disabled ? "disabled" : "emergency fallback available", note:x.direct_fallback_disabled ? "Public website may go blank if /api/kk-data fails" : "API-first, but site can recover if Vercel ENV/API fails"});
    }
    return rows;
  }
  function posterSyncText(res){
    if(!res || !res.poster_url) return "";
    if(res.web_ready_found && res.web_ready_poster_url) return " และบันทึกรูปลง Web Ready แล้ว";
    if(res.web_ready_found && !res.web_ready_poster_url) return " แต่ 08_Web_Ready ยังไม่พบรูป";
    return " และบันทึกรูปแล้ว";
  }
  function posterWarningText(res){
    const warning = (res && res.poster_public_warning) || state.posterWarning || "";
    return warning ? " หมายเหตุ: ระบบอัปโหลดรูปแล้ว แต่ตั้ง public อัตโนมัติไม่ได้ ถ้ารูปไม่ขึ้น ให้ตั้งค่าโฟลเดอร์รูปเป็น Share > Anyone with the link > Viewer" : "";
  }
  function table(el, cols, rows){
    if(!el) return;
    if(!rows || !rows.length){ el.innerHTML='<tr><td class="muted">ไม่มีข้อมูล</td></tr>'; return; }
    el.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c.render?c.render(r):esc(r[c.key]??"")}</td>`).join('')+'</tr>').join('')+'</tbody>';
  }


  function systemStatusClass(status){
    const s=String(status||"").toUpperCase();
    if(s==="OK") return "ok";
    if(s==="WARN" || s==="CHECK") return "warn";
    return "bad";
  }

  function storefrontGuardRows(integrity){
    const sf=integrity||{};
    const rows=[];
    const row=(label,count,detail,suggestion)=>rows.push({
      label,
      status:Number(count||0)>0?"WARN":"OK",
      detail:Number(count||0)>0 ? detail : "0 issues",
      suggestion:Number(count||0)>0 ? suggestion : ""
    });
    row(
      "Storefront · Package identity",
      sf.invalid_package_identity_count,
      String(sf.invalid_package_identity_count||0)+" invalid package rows",
      "ตรวจ 09_Web_Packages ให้ package_id / event_id / package_type ครบ; public proxy จะกรองแถวผิดออก"
    );
    row(
      "Storefront · Event/package mapping",
      Number(sf.orphan_package_count||0)+Number(sf.orphan_web_ready_count||0),
      String(sf.orphan_package_count||0)+" orphan packages · "+String(sf.orphan_web_ready_count||0)+" orphan web-ready events",
      "ตรวจ event_id ให้ตรงกับ Event master ก่อนเปิดขาย"
    );
    row(
      "Storefront · Availability",
      sf.negative_availability_count,
      String(sf.negative_availability_count||0)+" negative availability rows",
      "ตรวจสูตร stock/availability และอย่าปล่อยค่าติดลบสู่ public feed"
    );
    row(
      "Storefront · Published event quality",
      Number(sf.missing_poster_count||0)+Number(sf.published_past_event_count||0),
      String(sf.missing_poster_count||0)+" missing posters · "+String(sf.published_past_event_count||0)+" published past events",
      "เติม poster หรือซ่อน/ปิดงานที่พ้นวันแล้วก่อนลูกค้าเห็น"
    );
    row(
      "Storefront · Venue canonicalization",
      sf.venue_variant_group_count,
      String(sf.venue_variant_group_count||0)+" venue naming variant groups",
      "ใช้ชื่อ Venue เดิมจาก suggestion list เพื่อลดชื่อซ้ำใน Search และ Analytics"
    );
    return rows;
  }

  function buildSnapshotGuardRows(data){
    const d=data||{};
    const diag=d.phase1_diagnostics||{};
    const rows=[];
    const backendVersion=d.admin_api_version || diag.admin_api_version || "";
    const proxyVersion=d.frontend_proxy_version || "";
    const spreadsheetId=d.spreadsheet_id || diag.spreadsheet_id || "";
    const frontendSheetId=d.frontend_sheet_id || diag.frontend_sheet_id || "";
    rows.push({label:"Admin UI Version",status:"OK",detail:KK_ADMIN_UI_VERSION,suggestion:""});
    rows.push({label:"Apps Script Version",status:backendVersion===EXPECTED_BACKEND_VERSION?"OK":"WARN",detail:backendVersion||"missing",suggestion:backendVersion===EXPECTED_BACKEND_VERSION?"":"Verify deployed source; do not deploy repository 9_5_8 over 9_5_9"});
    rows.push({label:"Vercel Proxy Version",status:proxyVersion===EXPECTED_PROXY_VERSION?"OK":"WARN",detail:proxyVersion||"missing",suggestion:proxyVersion===EXPECTED_PROXY_VERSION?"":"Redeploy Vercel with latest api/kk-admin.js"});
    rows.push({label:"Sheet ID Match",status:(spreadsheetId&&frontendSheetId&&spreadsheetId===frontendSheetId)?"OK":"FAIL",detail:(spreadsheetId||"missing")+" / "+(frontendSheetId||"missing"),suggestion:"GOOGLE_SHEET_ID in Vercel must match Apps Script spreadsheet"});
    if(diag.poster_folder_id_set!==undefined) rows.push({label:"Poster Folder",status:diag.poster_folder_id_set?"OK":"WARN",detail:diag.poster_folder_id_set?"set":"missing",suggestion:"Set Script Property KK_POSTER_FOLDER_ID before uploading posters"});
    if(diag.log_sheets_ready!==undefined) rows.push({label:"Audit/Error Logs",status:diag.log_sheets_ready?"OK":"WARN",detail:diag.log_sheets_ready?"ready":"missing",suggestion:"Run setup/repair in Google Sheet menu"});
    const h=KKSnapshotHealth.assess(d);
    for(const key of KKSnapshotHealth.KEYS) rows.push({label:"Snapshot · "+key,status:h.counts[key]===null ? "FAIL" : h.counts[key]===0 ? "WARN" : "OK",detail:String(h.counts[key] ?? "invalid")+" rows",suggestion:""});
    rows.push(...storefrontGuardRows(h.storefront_integrity));
    rows.push({label:"Snapshot freshness",status:snapshotState.stale ? "FAIL" : "OK",detail:snapshotState.error || snapshotState.goodAt || "Not loaded",suggestion:snapshotState.stale ? "Refresh successfully before making changes" : ""});
    return rows;
  }

  function currentSystemGuardRows(){
    if(state.systemHealth && state.systemHealth.rows) return state.systemHealth.rows;
    return buildSnapshotGuardRows(state.data||{});
  }

  function renderSystemGuard(){
    const rows=currentSystemGuardRows();
    const grid=$("#systemGuardGrid");
    if(grid){
      const ok=rows.filter(r=>String(r.status).toUpperCase()==="OK").length;
      const warn=rows.filter(r=>["WARN","CHECK"].includes(String(r.status).toUpperCase())).length;
      const fail=rows.filter(r=>String(r.status).toUpperCase()==="FAIL").length;
      grid.innerHTML=[
        [ok,"OK"],[warn,"ต้องเช็ก"],[fail,"ผิดปกติ"],[rows.length,"รายการตรวจ"]
      ].map(s=>`<div class="card stat system-stat ${s[1]==='ผิดปกติ'&&s[0]>0?'danger':s[1]==='ต้องเช็ก'&&s[0]>0?'warning':''}"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    }
    const last=$("#systemGuardLastRun");
    if(last){
      last.textContent=state.systemHealth && state.systemHealth.generated_at
        ? "Live check ล่าสุด: "+new Date(state.systemHealth.generated_at).toLocaleString("th-TH")
        : "แสดงจาก snapshot ล่าสุด กด Run Live Check เพื่อเช็ก Vercel ENV / Apps Script / public feeds แบบสด";
    }
    table($("#systemGuardTable"),[
      {label:"Check",render:r=>esc(r.label||r.check||r.key||"")},
      {label:"Status",render:r=>`<span class="pill ${systemStatusClass(r.status)}">${esc(r.status||"")}</span>`},
      {label:"Detail",render:r=>esc(r.detail||"")},
      {label:"สิ่งที่ควรทำ",render:r=>esc(r.suggestion||r.note||"")}
    ], rows);
  }

  async function runSystemGuard(btn){
    if(btn) setBusy(btn,true);
    try{
      const startedAt=Date.now();
      const results=await Promise.allSettled([api("systemHealth",{}), api("snapshotHealth",{})]);
      const base=results[0].status==="fulfilled" ? results[0].value.data : null;
      const rows=base && Array.isArray(base.rows) ? base.rows.slice() : [{label:"System Health",status:"FAIL",detail:results[0].reason?.message || "Invalid health response"}];
      const snap=results[1].status==="fulfilled" ? results[1].value.data : null;
      const snapshotError=results[1].status==="rejected" ? results[1].reason : null;
      const upstreamRoot=rows.find(r=>r && r.status==="FAIL" && (r.key==="apps_script_json" || r.key==="apps_script_reachable" || r.key==="admin_script_url" || r.key==="admin_api_key"));
      const blockedByUpstream=!snap && !!upstreamRoot;
      const blockedDetail=blockedByUpstream
        ? "Blocked by upstream root cause: "+String(upstreamRoot.detail||upstreamRoot.label||"Apps Script unavailable")
        : (snapshotError?.message || "Snapshot unavailable");

      for(const key of KKSnapshotHealth.KEYS){
        rows.push({
          label:"Snapshot · "+key,
          status:!snap ? (blockedByUpstream ? "WARN" : "FAIL") : snap.counts[key]===null ? "FAIL" : snap.counts[key]===0 ? "WARN" : "OK",
          detail:snap ? String(snap.counts[key])+" rows" : blockedDetail,
          suggestion:blockedByUpstream ? "แก้ Apps Script upstream จุดเดียวก่อน แล้ว Run Live Check ใหม่; รายการนี้เป็นผลกระทบตาม ไม่ใช่ root cause แยก" : ""
        });
      }
      rows.push({
        label:"Snapshot validation",
        status:!snap ? (blockedByUpstream ? "WARN" : "FAIL") : !snap.ok ? "FAIL" : snap.warnings.length ? "WARN" : "OK",
        detail:snap ? snap.issues.concat(snap.warnings).join("; ") || "Valid snapshot" : blockedDetail,
        suggestion:blockedByUpstream ? "Snapshot ยังตรวจไม่ได้จนกว่า Apps Script จะคืน JSON ปกติ" : ""
      });
      if(snap&&snap.storefront_integrity) rows.push(...storefrontGuardRows(snap.storefront_integrity));
      else if(state.data) rows.push(...storefrontGuardRows(KKSnapshotHealth.assess(state.data).storefront_integrity));
      rows.push({
        label:"Snapshot latency",
        status:snap ? "OK" : (blockedByUpstream ? "WARN" : "FAIL"),
        detail:snap ? snap.latency_ms+" ms (proxy round trip)" : blockedDetail
      });
      rows.push({label:"Live Check latency",status:"OK",detail:(Date.now()-startedAt)+" ms (browser round trip)"});
      rows.push({label:"Versions · UI / Proxy / Apps Script",status:snap && snap.proxy_version===KK_ADMIN_UI_VERSION && snap.backend_version===EXPECTED_BACKEND_VERSION ? "OK" : "WARN",detail:KK_ADMIN_UI_VERSION+" / "+(snap?.proxy_version||"unknown")+" / "+(snap?.backend_version||"unknown"),suggestion:"Inspect deployed source on mismatch; never deploy repo 9_5_8 over deployed 9_5_9."});
      state.systemHealth={generated_at:new Date().toISOString(),rows,summary:{fail:rows.filter(r=>r.status==="FAIL").length,warn:rows.filter(r=>r.status==="WARN").length}};
      renderSystemGuard();
      const fail=(state.systemHealth && state.systemHealth.summary && state.systemHealth.summary.fail)||0;
      const warn=(state.systemHealth && state.systemHealth.summary && state.systemHealth.summary.warn)||0;
      showNotice(fail?`System Guard พบ ${fail} root/independent failure และ ${warn} จุดผลกระทบ/ควรเช็ก`:(warn?`System Guard พบ ${warn} จุดที่ควรเช็ก`:`System Guard ผ่านทั้งหมด`), fail?"bad":(warn?"warn":"ok"));
    }catch(e){
      showNotice(e.message,"bad");
    }finally{
      if(btn) setBusy(btn,false);
    }
  }

  function fillSelects(){
    const data=state.data||{};
    $$('select[data-source="events"]').forEach(sel=>{
      const current=sel.value;
      const isBooking=!!sel.closest("#bookingForm");
      const isOverride=!!sel.closest("#eventPriceOverrideForm");
      const isEditEvent=!!sel.closest("#eventUpdateForm");
      const rows=(data.events||[])
        .filter(e=>String(e.event_id||"").trim())
        // Booking: show only current/upcoming open events that still have bookable packages.
        .filter(e=>!isBooking || (isActiveEvent(e) && isTodayOrFuture(e.event_date) && eventHasBookablePackage(e.event_id)))
        // Price override: show only current/upcoming open events, not past/closed/draft events.
        .filter(e=>!isOverride || (isActiveEvent(e) && isTodayOrFuture(e.event_date)))
        // Edit Event: show only current/upcoming open events to prevent accidental edits on past events.
        .filter(e=>!isEditEvent || (isActiveEvent(e) && isTodayOrFuture(e.event_date)))
        .filter(e=>(isBooking||isOverride||isEditEvent) || String(e.status||"").toLowerCase().trim()!=="closed")
        .sort(compareEventsByDateAsc);
      const placeholder=isBooking ? "เลือกงานที่ยังว่าง" : (isOverride ? "เลือกงานวันนี้/อนาคต" : (isEditEvent ? "เลือกงานวันนี้/อนาคต" : "เลือกงาน"));
      const emptyText=isBooking ? "ไม่มีงานที่ว่างให้จอง" : (isOverride ? "ไม่มีงานวันนี้/อนาคตให้แก้ราคา" : (isEditEvent ? "ไม่มีงานวันนี้/อนาคตให้แก้ไข" : placeholder));
      sel.innerHTML=`<option value="">${esc(rows.length ? placeholder : emptyText)}</option>`+
        rows.map(e=>opt(e.event_id, `${e.event_name} · ${fmtDate(e.event_date)}`)).join('');
      if(current && rows.some(e=>String(e.event_id)===String(current))) sel.value=current;
    });
    $$('select[data-source="packages"]').forEach(sel=>{
      if(sel.closest("#bookingForm")) return;
      const current=sel.value;
      sel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(data.packages||[])
        .filter(p=>p.active!==false)
        .map(p=>opt(p.template_id, `${p.display_name||p.template_id} · ${money(p.standard_price)}฿`)).join('');
      if(current) sel.value=current;
    });
    populateBookingPackages();
    populateEventOverrideForm();
    populateEventUpdateForm();
    populatePackageUpdateForm();
    populateBookingEditForm();
    renderCreateEventPriceOverrides();
  }


  function normalizePriceGroup(v){
    const s=String(v||"").toUpperCase().trim().replace(/\s+/g,"_");
    if(["ZEISS_2_35X","ZEISS_235X","ZEISS_2.35X","G1","LENS_VIVO","LENS_VIVO_2_35X"].includes(s)) return "LENS_VIVO_2_35X";
    if(!s || s==="NONE" || s==="-") return "NONE";
    return s;
  }
  function canonicalPackageKey(row){
    const type=String(row && (row.package_type||row.type) || "").toLowerCase().trim();
    const model=String(row && (row.model_group||row.phone_group) || "").toUpperCase().trim() || "NONE";
    const lens=normalizePriceGroup(row && (row.lens_group||row.lensGroup));
    return [type, model, lens].join("|");
  }
  function latestOverride(eventId, templateId){
    const d=state.data||{};
    const eid=String(eventId||"").trim();
    const tpl=String(templateId||"").trim();
    const rows=(d.overrides||[]).filter(o=>String(o.event_id||"").trim()===eid && String(o.template_id||"").trim()===tpl);
    return rows.length ? rows[rows.length-1] : null;
  }
  function latestOverrideByCanonical(eventId, pkg){
    const exact=latestOverride(eventId, pkg && pkg.template_id);
    if(exact) return exact;
    const d=state.data||{};
    const eid=String(eventId||"").trim();
    const key=canonicalPackageKey(pkg||{});
    const packageByTemplate={};
    (d.packages||[]).forEach(p=>{ packageByTemplate[String(p.template_id||"").trim()]=p; });
    const rows=(d.overrides||[]).filter(o=>{
      if(String(o.event_id||"").trim()!==eid) return false;
      const base=packageByTemplate[String(o.template_id||"").trim()];
      return base && canonicalPackageKey(base)===key;
    });
    return rows.length ? rows[rows.length-1] : null;
  }
  function webPackageFor(eventId, pkg){
    const eid=String(eventId||"").trim();
    const tpl=String(pkg && pkg.template_id || "").trim();
    const rows=webPackagesForEvent(eid);
    return rows.find(w=>templateIdFromWebPackage(w)===tpl) || rows.find(w=>canonicalPackageKey(w)===canonicalPackageKey(pkg||{})) || null;
  }
  function expectedPriceFor(eventId, pkg){
    const o=latestOverrideByCanonical(eventId, pkg);
    const raw=o && o.override_price!==undefined && o.override_price!==null && String(o.override_price).trim()!=="" ? o.override_price : pkg.standard_price;
    return toNum(raw);
  }
  function pricingRows(data){
    const d=data||{};
    const events=(d.events||[]).filter(e=>isActiveEvent(e) && isTodayOrFuture(e.event_date)).slice().sort(compareEventsByDateAsc);
    const packages=(d.packages||[]).filter(p=>p.active!==false && String(p.template_id||"").trim());
    if(!state.pricingEventFilter && events.length) state.pricingEventFilter=events[0].event_id;
    const q=String(state.pricingSearch||"").trim().toLowerCase();
    const rows=[];
    events.forEach(e=>{
      packages.forEach(pkg=>{
        const o=latestOverrideByCanonical(e.event_id, pkg);
        const wp=webPackageFor(e.event_id, pkg);
        const master=toNum(pkg.standard_price);
        const expected=expectedPriceFor(e.event_id, pkg);
        const publicPrice=wp ? toNum(wp.price) : 0;
        const overrideHasPrice=!!(o && o.override_price!==undefined && o.override_price!==null && String(o.override_price).trim()!=="");
        const activeOverride=o && o.active_override!==undefined && o.active_override!==null && String(o.active_override).trim()!=="" ? String(o.active_override).trim() : "";
        const hiddenByOverride=activeOverride.toLowerCase()==="false";
        const isMismatch=wp ? (publicPrice!==expected) : false;
        const status=hiddenByOverride ? "HIDDEN" : (!wp ? "NO WEB ROW" : (isMismatch ? "CHECK" : "OK"));
        const row={event:e, pkg, override:o, web:wp, master, expected, publicPrice, overrideHasPrice, activeOverride, hiddenByOverride, isMismatch, status};
        const hay=[e.event_name,e.event_id,pkg.display_name,pkg.template_id,pkg.package_type,pkg.model_group,pkg.lens_group,master,expected,publicPrice,status].join(" ").toLowerCase();
        if(q && !hay.includes(q)) return;
        rows.push(row);
      });
    });
    let filtered=rows;
    if(state.pricingScope==="mismatch") filtered=rows.filter(r=>r.status!=="OK" && r.status!=="HIDDEN");
    else if(state.pricingScope!=="upcoming") filtered=rows.filter(r=>String(r.event.event_id)===String(state.pricingEventFilter));
    return filtered;
  }
  function renderPricingCenter(data){
    const eventSel=$("#pricingEventFilter");
    if(eventSel){
      const events=(data.events||[]).filter(e=>isActiveEvent(e) && isTodayOrFuture(e.event_date)).slice().sort(compareEventsByDateAsc);
      if(!state.pricingEventFilter && events.length) state.pricingEventFilter=events[0].event_id;
      const current=state.pricingEventFilter;
      eventSel.innerHTML=events.length ? events.map(e=>opt(e.event_id, `${e.event_name} · ${fmtDate(e.event_date)}`)).join("") : '<option value="">ไม่มีงานเปิดอยู่</option>';
      if(current && events.some(e=>String(e.event_id)===String(current))) eventSel.value=current;
      else if(events[0]){ eventSel.value=events[0].event_id; state.pricingEventFilter=events[0].event_id; }
    }
    const rows=pricingRows(data||{});
    const allRows=pricingRows(Object.assign({}, data||{}));
    const mismatch=allRows.filter(r=>r.status!=="OK" && r.status!=="HIDDEN").length;
    const overrides=allRows.filter(r=>r.overrideHasPrice || r.activeOverride).length;
    const visible=rows.filter(r=>r.web && !r.hiddenByOverride).length;
    if($("#pricingKpis")) $("#pricingKpis").innerHTML=[
      [rows.length,"แถวที่แสดง"], [overrides,"ราคาเฉพาะงาน"], [mismatch,"ควรเช็ก"], [visible,"แพ็กเกจบนเว็บ"]
    ].map(x=>`<div><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></div>`).join("");
    if($("#pricingCenterCount")) $("#pricingCenterCount").textContent=`${rows.length} รายการ · CHECK ${mismatch}`;
    table($("#pricingCenterTable"),[
      {label:"งาน",render:r=>`<strong>${esc(r.event.event_name)}</strong><br><small>${esc(fmtDate(r.event.event_date))}</small>`},
      {label:"แพ็กเกจ",render:r=>`<strong>${esc(r.pkg.display_name||r.pkg.template_id)}</strong><br><small>${esc(r.pkg.package_type||"")} · ${esc(r.pkg.template_id||"")}</small>`},
      {label:"ราคาหลัก",render:r=>`${esc(money(r.master))}฿`},
      {label:"Override",render:r=>r.overrideHasPrice ? `<strong>${esc(money(r.override.override_price))}฿</strong><br><small>${esc(r.activeOverride||"ไม่เปลี่ยน")}</small>` : `<span class="muted">ใช้ราคาหลัก</span>`},
      {label:"ลูกค้าเห็นจริง",render:r=>r.web ? `<strong>${esc(money(r.publicPrice))}฿</strong><br><small>เหลือ ${esc(r.web.available_count||0)} · ${esc(r.web.package_status||"")}</small>` : `<span class="pill warn">ไม่มี Web row</span>`},
      {label:"สถานะ",render:r=>`<span class="pill ${r.status==="OK"?"ok":(r.status==="HIDDEN"?"warn":"bad")}">${esc(r.status)}</span><br><small>ควรเป็น ${esc(money(r.expected))}฿</small>`},
      {label:"Action",render:r=>`<div class="row-actions"><button class="btn tiny ghost" type="button" data-pricing-edit="${esc(r.event.event_id)}|${esc(r.pkg.template_id)}">เปิดฟอร์ม</button>${r.override?`<button class="btn tiny secondary" type="button" data-pricing-apply="${esc(r.event.event_id)}|${esc(r.pkg.template_id)}">Apply</button>`:""}</div>`}
    ], rows.slice(0,120));
  }
  function pricingSummaryText(){
    return pricingRows(state.data||{}).map(r=>[
      r.status,
      r.event.event_name,
      fmtDate(r.event.event_date),
      r.pkg.display_name||r.pkg.template_id,
      `master=${money(r.master)}`,
      `override=${r.overrideHasPrice?money(r.override.override_price):"-"}`,
      `public=${r.web?money(r.publicPrice):"NO_WEB_ROW"}`
    ].join(" | ")).join("\n");
  }

  function activeAssetReservations(bookings, assetId, assetType){
    const key=assetType==="lens" ? "lens_asset_id" : "phone_asset_id";
    return (bookings||[])
      .filter(b=>isActiveBookingStatus(b.booking_status) && String(b[key]||"").trim()===String(assetId||"").trim())
      .slice()
      .sort((a,b)=>{
        const da=parseLocalDate(a.event_date), db=parseLocalDate(b.event_date);
        return (da?da.getTime():0)-(db?db.getTime():0);
      });
  }
  function renderAssetReservation(asset, bookings){
    const rows=activeAssetReservations(bookings, asset.asset_id, String(asset.asset_type||"").toLowerCase());
    if(!rows.length) return `<span class="pill ok">ยังไม่ถูกจัดให้ Booking</span><br><small>สถานะ available หมายถึงสภาพอุปกรณ์พร้อมใช้งาน ไม่ใช่คิวว่างทุกวัน</small>`;
    const first=rows[0];
    const more=rows.length>1 ? ` +${rows.length-1} คิว` : "";
    return `<span class="pill warn">จอง ${esc(fmtDate(first.event_date))}${esc(more)}</span><br><small>${esc(first.event_name||first.event_id||"-")} · ${esc(first.customer_name||"-")} · ${esc(bookingLifecycleLabel(first.booking_status))}</small>`;
  }


  function populateEntrySuggestions(data){
    const d=data||{};
    const venueList=$("#venueOptions");
    if(venueList){
      const seen=new Set();
      const venues=(d.events||[])
        .map(e=>String(e&&e.venue||"").trim())
        .filter(Boolean)
        .filter(v=>{const key=v.toLocaleLowerCase("en-US");if(seen.has(key))return false;seen.add(key);return true;})
        .sort((a,b)=>a.localeCompare(b,"en"));
      venueList.replaceChildren(...venues.map(v=>{
        const o=document.createElement("option");
        o.value=v;
        return o;
      }));
    }

    function fillAssetList(id,type){
      const list=$(id);
      if(!list)return;
      const rows=(d.assets||[])
        .filter(a=>String(a&&a.asset_type||"").toLowerCase()===type)
        .sort((a,b)=>{
          const ar=String(a&&a.status||"").toLowerCase()==="available"?0:1;
          const br=String(b&&b.status||"").toLowerCase()==="available"?0:1;
          return ar-br || String(a&&a.asset_id||"").localeCompare(String(b&&b.asset_id||""));
        });
      list.replaceChildren(...rows.map(a=>{
        const o=document.createElement("option");
        o.value=String(a.asset_id||"").trim();
        const model=String(a.model_display||a.model_group||"").trim();
        const status=String(a.status||"-").trim();
        const rentable=a.rentable===false?"not rentable":"rentable";
        o.label=[model,status,rentable].filter(Boolean).join(" · ");
        return o;
      }).filter(o=>o.value));
    }
    fillAssetList("#phoneAssetOptions","phone");
    fillAssetList("#lensAssetOptions","lens");
  }

  function render(){
    const d=state.data||{};
    populateEntrySuggestions(d);
    ["reportRange","reportStart","reportEnd","reportStatusMode"].forEach(id=>{ const el=$("#"+id); if(el && state[id]!==undefined && el.value!==state[id]) el.value=state[id]; });
    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=versionDiagnosticsRows(d).concat(d.health||[]), today=KKSnapshotHealth.todayBookings(d), customers=d.customers||[];
    const currentBookings=KKSnapshotHealth.currentBookings(d);
    const openEventRowsAll=sortedOpenEvents(events);
    const bookingRowsAll=sortedBookings(currentBookings);
    const eventsQ=($("#eventsSearch") && $("#eventsSearch").value) || "";
    const bookingsQ=($("#bookingsSearch") && $("#bookingsSearch").value) || "";
    const openEventRows=openEventRowsAll.filter(r=>containsQuery(r,["event_name","venue","event_id"],eventsQ));
    const bookingRows=bookingRowsAll.filter(r=>containsQuery(r,["customer_name","customer_phone","customer_contact","event_name","event_id","package_display","package_type"],bookingsQ));
    const actionRows=buildActionRows(d);
    const shownActionRows=filterActionRows(actionRows);
    renderActionToolbar(actionRows);
    const customerHistory=customerHistoryRows(bookings, customers);
    const openEvents=openEventRowsAll.length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const reservedPhoneAssets=new Set(bookings.filter(b=>isActiveBookingStatus(b.booking_status) && String(b.phone_asset_id||"").trim()).map(b=>String(b.phone_asset_id).trim())).size;
    const reservedLensAssets=new Set(bookings.filter(b=>isActiveBookingStatus(b.booking_status) && String(b.lens_asset_id||"").trim()).map(b=>String(b.lens_asset_id).trim())).size;
    const activeBookings=currentBookings.filter(b=>isWorkflowOpenStatus(b.booking_status)).length;
    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือพร้อมใช้งาน"],[reservedPhoneAssets,"มือถือถูกจัดให้ Booking"],[lenses,"เลนส์พร้อมใช้งาน"],[reservedLensAssets,"เลนส์ถูกจัดให้ Booking"],[activeBookings,"Booking active"],[today.length,"งานที่ต้องทำวันนี้"],[customerHistory.length,"ลูกค้าที่มีประวัติ"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');

    const actionStats=$("#actionStats");
    if(actionStats){
      actionStats.innerHTML=[
        [actionRows.filter(r=>r.type==="payment").length,"ต้องตามเงิน"],
        [actionRows.filter(r=>r.type==="prep").length,"เตรียม/ส่งมอบ"],
        [actionRows.filter(r=>r.type==="return").length,"รอรับคืน"],
        [actionRows.filter(r=>r.type==="upload" || r.type==="close").length,"อัปโหลด/ปิดงาน"],
        [actionRows.filter(r=>r.type==="data").length,"ข้อมูลต้องเช็ก"]
      ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    }
    if($("#actionCount")) $("#actionCount").textContent=shownActionRows.length+" / "+actionRows.length+" รายการที่ควรเช็ก";
    table($("#actionTable"),[
      {label:"Priority",render:r=>{ const p=actionPriority(r); return `<span class="pill ${p.cls}" title="${esc(p.title)}">${esc(p.label)}</span>`; }},
      {label:"ประเภท",render:r=>`<span class="pill ${actionSeverity(r.type)}">${esc(actionTypeLabel(r.type))}</span>`},
      {label:"วันที่",render:r=>esc(fmtDate(r.date))},
      {label:"เวลารับ",render:r=>esc(fmtPickupTime(r.pickup_time) || "-")},
      {label:"รายการ",render:r=>`<strong>${esc(r.title)}</strong><br><small>${esc(r.package_display||'')}</small>`},
      {label:"Asset",render:r=>esc(r.asset || "-")},
      {label:"ลูกค้า/ติดต่อ",render:r=>`<strong>${esc(r.customer)}</strong><br><small>${esc(r.contact||'-')}</small>`},
      {label:"สถานะ",render:r=>`${esc(bookingLifecycleLabel(r.booking_status||''))}<br><small>Payment: ${esc(r.payment_status||'-')}</small>`},
      {label:"สิ่งที่ต้องทำ",render:r=>esc(r.task)},
      {label:"Action",render:r=>actionButtons(r)}
    ], shownActionRows.slice(0,60));

    $("#eventsCount").textContent=(openEventRows.length===openEventRowsAll.length?openEventRows.length:(openEventRows.length+" / "+openEventRowsAll.length))+" รายการ";
    table($("#eventsTable"),[
      {label:"วันที่",render:r=>esc(fmtDate(r.event_date))},
      {label:"งาน",key:"event_name"},
      {label:"สถานที่",key:"venue"},
      {label:"สถานะ",render:r=>`<span class="pill ${r.status==='open'?'ok':'bad'}">${esc(r.status)}</span>`},
      {label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}
    ], openEventRows.slice(0,50));

    $("#bookingsCount").textContent=(bookingRows.length===bookingRowsAll.length?bookingRows.length:(bookingRows.length+" / "+bookingRowsAll.length))+" รายการ";
    table($("#bookingsTable"),[
      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},
      {label:"ชื่อลูกค้า",key:"customer_name"},
      {label:"เบอร์โทร",render:r=>esc(r.customer_phone || "-")},
      {label:"ชื่องาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || "")},
      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},
      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},
      {label:"สถานะ",render:r=>{ const st=String(r.booking_status||'').toLowerCase(); const cls=['cancelled','no_show'].includes(st)?'bad':(['returned','uploaded','completed'].includes(st)?'ok':'warn'); return `<span class="pill ${cls}">${esc(bookingLifecycleLabel(r.booking_status))}</span>`; }},
      {label:"วันที่บันทึก",render:r=>esc(fmtDate(r.created_at))},
      {label:"CRM",render:r=>`<button class="mini-btn" type="button" data-customer-key="${esc(bookingCustomerKey(r))}">ดูประวัติ</button>`}
    ], bookingRows.slice(0,50));

    const todayStats=$("#todayStats");
    if(todayStats){
      todayStats.innerHTML=[
        [today.length,"Booking วันนี้"],
        [today.filter(b=>["pending","confirmed","prepared"].includes(String(b.booking_status||"").toLowerCase())).length,"เตรียม/ส่งมอบ"],
        [today.filter(b=>String(b.booking_status||"").toLowerCase()==="picked_up").length,"รอรับคืน"],
        [unpaidToday,"ยังไม่ paid"]
      ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    }
    if($("#todayCount")) $("#todayCount").textContent=(d.today_key?("วันที่ "+fmtDate(d.today_key)+" · "):"")+today.length+" รายการ";
    table($("#todayTable"),[
      {label:"งาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"ลูกค้า",key:"customer_name"},
      {label:"ติดต่อ",render:r=>esc([r.customer_contact,r.customer_phone].filter(Boolean).join(" / "))},
      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},
      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},
      {label:"Pickup",render:r=>esc(fmtPickupTime(r.pickup_time) || "-")},
      {label:"Payment",render:r=>`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>`},
      {label:"สิ่งที่ต้องทำ",key:"work_task"},
      {label:"Note",key:"note"}
    ], today);

    $("#assetsCount").textContent=assets.length+" รายการ";
    const assetStatusOptions=["available","repair","inactive"];
    const renderAssetStatus=r=>{
      const current=String(r.status||"available").toLowerCase().trim() || "available";
      const opts=assetStatusOptions.map(st=>`<option value="${esc(st)}" ${current===st?'selected':''}>${esc(st)}</option>`).join('');
      return `<select class="mini-select asset-status-select" data-asset-status="${esc(r.asset_id||'')}">${opts}</select>`;
    };
    const renderAssetRentable=r=>{
      const raw = r.rentable_setting;
      const checked = raw === false ? "" : "checked";
      const effective = r.rentable===false ? "not rentable" : "rentable";
      return `<label class="asset-rentable-toggle"><input type="checkbox" data-asset-rentable="${esc(r.asset_id||'')}" ${checked} /> <span>${esc(effective)}</span></label>`;
    };
    table($("#assetsTable"),[
      {label:"ID",key:"asset_id"},
      {label:"Type",key:"asset_type"},
      {label:"Model Display",render:r=>esc(r.model_display || r.model_group || "")},
      {label:"Group",key:"model_group"},
      {label:"Serial",key:"serial"},
      {label:"สภาพอุปกรณ์",render:renderAssetStatus},
      {label:"การจองตามวันงาน",render:r=>renderAssetReservation(r, bookings)},
      {label:"Rentable",render:renderAssetRentable},
      {label:"Action",render:r=>`<div class="inline-actions asset-actions"><button class="mini-btn" type="button" data-update-asset="${esc(r.asset_id||'')}">บันทึก</button><button class="mini-btn danger-soft" type="button" data-delete-asset="${esc(r.asset_id||'')}">ลบ</button></div>`}
    ], assets.slice(0,80));

    table($("#healthTable"),[
      {label:"Check",key:"check"},{label:"Status",render:r=>`<span class="pill ${String(r.status).toLowerCase().includes('ok')?'ok':String(r.status).toLowerCase().includes('check')?'bad':''}">${esc(r.status||'')}</span>`},{label:"Detail",key:"detail"},{label:"Note",key:"note"}
    ], health);
    renderSystemGuard();

    if($("#customerStatsCount")) $("#customerStatsCount").textContent=customerHistory.length+" รายการ";
    table($("#customerStatsTable"),[
      {label:"ลูกค้า",key:"customer_name"},
      {label:"ติดต่อ",render:r=>esc([r.customer_contact,r.customer_phone].filter(Boolean).join(" / "))},
      {label:"เช่าแล้ว",render:r=>esc(r.rental_count||0)},
      {label:"เช่าล่าสุด",render:r=>esc(fmtDate(r.last_rental_date))},
      {label:"งานล่าสุด",key:"last_event_name"},
      {label:"CRM",render:r=>`<button class="mini-btn" type="button" data-customer-key="${esc(r.customer_key)}">ดูประวัติ</button>`}
    ], customerHistory.slice(0,50));

    const q=String((document.getElementById("customerSearch")||{}).value||"").trim().toLowerCase();
    const filteredCustomers=customerHistory.filter(c=>{
      const hay=[c.customer_name,c.customer_contact,c.customer_phone,c.last_event_name].join(" ").toLowerCase();
      return !q || hay.includes(q);
    });
    table($("#customersTable"),[
      {label:"ลูกค้า",key:"customer_name"},
      {label:"เบอร์/LINE",render:r=>esc([r.customer_phone,r.customer_contact].filter(Boolean).join(" / "))},
      {label:"เช่าแล้ว",render:r=>`<strong>${esc(r.rental_count||0)}</strong> ครั้ง`},
      {label:"เช่าล่าสุด",render:r=>esc(fmtDate(r.last_rental_date))},
      {label:"งานล่าสุด",key:"last_event_name"},
      {label:"ดู",render:r=>`<button class="mini-btn${String(state.selectedCustomerKey)===String(r.customer_key)?' active':''}" type="button" data-customer-key="${esc(r.customer_key)}">ดูประวัติ</button>`}
    ], filteredCustomers.slice(0,100));
    renderCustomerDetail(customerHistory);
    renderReports(d);
    renderPricingCenter(d);
    renderRentalAnalytics();

    fillSelects();
  }

  function compactSnapshotWarnings(warnings){
    return (Array.isArray(warnings)?warnings:[])
      .map(w=>String(w||"").replace(/;\\s*sample\\b.*$/i,"").trim())
      .filter(Boolean);
  }

  function renderSnapshotStatus(){
    const el=$("#snapshotStatus");
    if(!el) return;
    const h=snapshotState.health;
    const counts=h ? Object.entries(h.counts).map(([k,v])=>k+": "+(v===null?"invalid":v)).join(" · ") : "";
    const fullWarnings=h && Array.isArray(h.warnings) ? h.warnings : [];
    const compactWarnings=compactSnapshotWarnings(fullWarnings);
    el.hidden=false;
    el.style.borderColor=snapshotState.stale ? "#dc2626" : (compactWarnings.length ? "#d97706" : "#64748b");
    el.title=fullWarnings.join("\n");
    const degraded=!!(state.data && state.data.degraded_read_only);
    el.textContent=(snapshotState.stale ? (state.data ? "กำลังแสดง Last Known Good Snapshot — ข้อมูลเก่า ห้ามใช้ยืนยันความว่างจน Refresh สำเร็จ" : "โหลด Snapshot ไม่สำเร็จ — ยังยืนยันไม่ได้ว่าระบบไม่มีข้อมูล") : (degraded ? "โหมดอ่านอย่างเดียว — โหลดข้อมูลตรงจาก Google Sheet สำเร็จ แต่การบันทึกถูกปิดจนกว่า Apps Script จะกลับมา" : "Snapshot ล่าสุดผ่านการตรวจ"))+
      " | สำเร็จล่าสุด: "+(snapshotState.goodAt ? new Date(snapshotState.goodAt).toLocaleString("th-TH") : "ยังไม่มี")+
      " | เวลาเรียกจริง: "+(snapshotState.latencyMs ?? "-")+" ms | "+counts+
      (snapshotState.error ? " | "+snapshotState.error : "")+
      (compactWarnings.length ? " | คำเตือนข้อมูล "+compactWarnings.length+" รายการ: "+compactWarnings.join(" · ") : "");
  }

  async function refresh(){
    if(state.loading) return;
    state.loading=true;
    const startedAt=Date.now();
    try{
      const data=await api("snapshot");
      const health=KKSnapshotHealth.assess(data.data, state.data);
      snapshotState.checkedAt=new Date().toISOString();
      snapshotState.health=health;
      if(!health.ok) throw new Error("Snapshot rejected: "+health.issues.join("; "));
      state.data=data.data;
      snapshotState.stale=false;
      snapshotState.error="";
      snapshotState.goodAt=snapshotState.checkedAt;
      snapshotState.latencyMs=Date.now()-startedAt;
      renderSnapshotStatus();
      render();
      loadRentalAnalytics();
      const backendVersion = state.data.admin_api_version || (state.data.phase1_diagnostics && state.data.phase1_diagnostics.admin_api_version) || "";
      if(backendVersion && backendVersion !== EXPECTED_BACKEND_VERSION){
        showNotice("Version ไม่ตรงกัน: Admin UI "+KK_ADMIN_UI_VERSION+" / Expected Apps Script "+EXPECTED_BACKEND_VERSION+" แต่ Apps Script จริงคือ "+backendVersion, "bad");
      }
      if(state.data.spreadsheet_id && state.data.frontend_sheet_id && state.data.spreadsheet_id !== state.data.frontend_sheet_id){
        showNotice("GOOGLE_SHEET_ID ใน Vercel ไม่ตรงกับ Spreadsheet ที่ Apps Script ใช้", "bad");
      }
    } catch(err) {
      snapshotState.checkedAt=new Date().toISOString();
      snapshotState.stale=true;
      snapshotState.error=err.message;
      snapshotState.latencyMs=Date.now()-startedAt;
      if(err.httpStatus===401 || err.httpStatus===403){
        state.data=null;
        $("#appPanel").classList.add("hidden");
        $("#loginPanel").classList.remove("hidden");
      }
      renderSnapshotStatus();
      throw err;
    } finally {
      state.loading=false;
    }
  }

  async function uploadPosterFromInput(fileInput, form){
    const input = typeof fileInput === "string" ? $(fileInput) : fileInput;
    const file = input && input.files && input.files[0];
    if(!file) return "";
    if(file.size>3*1024*1024) throw new Error("รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 3MB");
    if(file.type && !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) throw new Error("รองรับเฉพาะรูป JPG, PNG หรือ WEBP");

    const base64=await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||"").split(',')[1]||"");
      r.onerror=()=>reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      r.readAsDataURL(file);
    });

    state.posterWarning = "";
    const res=await api("uploadPoster",{fileName:file.name,mimeType:file.type||"image/jpeg",base64});
    if(res.sharing_warning){
      state.posterWarning = res.sharing_warning;
      console.warn("KK poster public warning", res.sharing_warning);
    }
    const url = res.url || res.poster_url || res.view_url || "";
    if(!url) throw new Error("อัปโหลดรูปแล้ว แต่ไม่ได้รับ poster URL กลับมา");

    if(form && form.elements && form.elements.poster_url){
      form.elements.poster_url.value = url;
    }
    return url;
  }

  function bind(){
    $$(".nav[data-tab]").forEach(btn=>{
      btn.setAttribute("aria-controls", "tab-"+btn.dataset.tab);
      btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
      btn.addEventListener("click",()=>{
        $$(".nav[data-tab]").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-pressed","false"); });
        btn.classList.add("active"); btn.setAttribute("aria-pressed","true");
        $$(".tab-panel").forEach(p=>p.classList.remove("active"));
        const panel=$("#tab-"+btn.dataset.tab);
        if(panel) panel.classList.add("active");
        window.scrollTo({top:0,behavior:"smooth"});
      });
    });
    document.addEventListener("click", ev=>{
      const jump=ev.target.closest("[data-tab-jump]");
      if(!jump) return;
      const tab=jump.getAttribute("data-tab-jump");
      const nav=$(`.nav[data-tab="${tab}"]`);
      if(nav) nav.click();
    });
    const loginBtn=$("#loginBtn");
    if(loginBtn) loginBtn.addEventListener("click", async()=>{
      if(state.pin!==$("#pinInput").value.trim()){ state.data=null; snapshotState.goodAt=null; }
      state.pin=$("#pinInput").value.trim(); if(!state.pin) return alert("กรุณากรอก PIN");
      sessionStorage.setItem("kk_admin_pin",state.pin);
      try{ await refresh(); updateUiLastRefresh(); $("#loginPanel").classList.add("hidden"); $("#appPanel").classList.remove("hidden"); showNotice("โหลดข้อมูลสำเร็จ"); }
      catch(e){ showNotice(e.message,"bad"); }
    });
    const logoutBtn=$("#logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click",()=>{ sessionStorage.removeItem("kk_admin_pin"); location.reload(); });
    const refreshBtn=$("#refreshBtn");
    if(refreshBtn) refreshBtn.addEventListener("click",()=>refresh().then(()=>{ updateUiLastRefresh(); showNotice("Refresh แล้ว"); }).catch(e=>showNotice(e.message,"bad")));
    const rentalAnalyticsRefreshBtn=$("#rentalAnalyticsRefreshBtn");
    if(rentalAnalyticsRefreshBtn) rentalAnalyticsRefreshBtn.addEventListener("click",()=>loadRentalAnalytics());
    const densityBtn=$("#densityBtn");
    if(densityBtn) densityBtn.addEventListener("click",()=>{
      const current=localStorage.getItem("kk_admin_compact_mode")==="1";
      localStorage.setItem("kk_admin_compact_mode", current ? "0" : "1");
      applyDensityMode();
    });
    document.addEventListener("keydown", ev=>{
      const tag=(ev.target && ev.target.tagName || "").toLowerCase();
      const typing=tag==="input" || tag==="textarea" || tag==="select" || (ev.target && ev.target.isContentEditable);
      if((ev.key==="/" && !typing) || ((ev.ctrlKey||ev.metaKey) && String(ev.key).toLowerCase()==="k")){
        ev.preventDefault();
        focusSmartSearch();
      }
    });
    ["#eventsSort","#bookingsSort"].forEach(sel=>{
      const el=$(sel);
      if(el) el.addEventListener("change",()=>render());
    });
    ["#eventsSearch","#bookingsSearch"].forEach(sel=>{
      const el=$(sel);
      if(el) el.addEventListener("input",()=>render());
    });
    document.addEventListener("click", ev=>{
      const btn=ev.target.closest("[data-action-filter]");
      if(!btn) return;
      state.actionFilter=btn.getAttribute("data-action-filter")||"all";
      render();
    });
    document.addEventListener("input", ev=>{
      if(ev.target && ev.target.id==="actionSearch"){
        state.actionSearch=ev.target.value||"";
        render();
        const el=$("#actionSearch");
        if(el){ el.focus(); const n=el.value.length; try{ el.setSelectionRange(n,n); }catch(_){} }
      }
    });
    [["reportRange","reportRange"],["reportStart","reportStart"],["reportEnd","reportEnd"],["reportStatusMode","reportStatusMode"]].forEach(([id,key])=>{
      const el=$("#"+id);
      if(!el) return;
      el.addEventListener("change",()=>{ state[key]=el.value||""; render(); });
      el.addEventListener("input",()=>{ state[key]=el.value||""; render(); });
    });

    [["pricingEventFilter","pricingEventFilter"],["pricingSearch","pricingSearch"],["pricingScope","pricingScope"]].forEach(([id,key])=>{
      const el=$("#"+id);
      if(!el) return;
      el.addEventListener(id==="pricingSearch" ? "input" : "change",()=>{ state[key]=el.value||""; render(); });
    });
    const pricingRefreshBtn=$("#pricingRefreshBtn");
    if(pricingRefreshBtn) pricingRefreshBtn.addEventListener("click",()=>refresh().then(()=>showNotice("Refresh Pricing Center แล้ว")).catch(e=>showNotice(e.message,"bad")));
    const pricingCopyBtn=$("#pricingCopyBtn");
    if(pricingCopyBtn) pricingCopyBtn.addEventListener("click",async()=>{
      const text=pricingSummaryText();
      try{ await navigator.clipboard.writeText(text); showNotice("Copy Pricing Summary แล้ว"); }
      catch(_){ showNotice(text||"ไม่มีข้อมูลราคา", "warn"); }
    });
    document.addEventListener("click",async ev=>{
      const edit=ev.target.closest("[data-pricing-edit]");
      const apply=ev.target.closest("[data-pricing-apply]");
      if(!edit && !apply) return;
      ev.preventDefault(); ev.stopPropagation();
      const raw=(edit||apply).getAttribute(edit?"data-pricing-edit":"data-pricing-apply")||"";
      const [eventId, templateId]=raw.split("|");
      const pkg=findPackageByTemplateId(templateId);
      const override=latestOverrideByCanonical(eventId, pkg||{template_id:templateId});
      if(edit){
        const nav=$('.nav[data-tab="packages"]'); if(nav) nav.click();
        const form=$("#eventPriceOverrideForm");
        if(form){ form.elements.event_id.value=eventId||""; form.elements.template_id.value=templateId||""; populateEventOverrideForm(); form.scrollIntoView({behavior:"smooth",block:"center"}); }
        return;
      }
      if(!override) return showNotice("รายการนี้ยังไม่มี override ให้ Apply", "warn");
      const btn=apply; setBusy(btn,true);
      try{
        await api("upsertEventOverride", {
          event_id:eventId,
          template_id:templateId,
          override_price: override.override_price ?? "",
          active_override: override.active_override ?? "",
          override_note: override.override_note ?? "",
          sort_order_override: override.sort_order_override ?? "",
          use_case_override: override.use_case_override ?? ""
        });
        await refresh();
        showNotice("Apply ราคาเข้า Web Packages แล้ว");
      }catch(e){ showNotice(e.message,"bad"); }
      finally{ setBusy(btn,false); }
    });

    const customerSearch=$("#customerSearch");
    if(customerSearch) customerSearch.addEventListener("input",()=>render());
    document.addEventListener("click",ev=>{
      const btn=ev.target.closest("[data-customer-key]");
      if(!btn) return;
      const key=btn.getAttribute("data-customer-key")||"";
      if(!key) return;
      ev.preventDefault();
      ev.stopPropagation();
      setActiveCustomer(key);
    });
    document.addEventListener("click",async ev=>{
      const assetBtn=ev.target.closest("[data-update-asset]");
      if(assetBtn){
        ev.preventDefault(); ev.stopPropagation();
        const assetId=assetBtn.getAttribute("data-update-asset")||"";
        if(!assetId) return showNotice("ไม่พบ asset_id ที่ต้องการอัปเดต", "bad");
        const statusEl=$$('[data-asset-status]').find(el=>el.getAttribute('data-asset-status')===assetId);
        const rentableEl=$$('[data-asset-rentable]').find(el=>el.getAttribute('data-asset-rentable')===assetId);
        const payload={asset_id:assetId, status:statusEl ? statusEl.value : "available", rentable: rentableEl ? rentableEl.checked : true};
        setBusy(assetBtn,true);
        try{
          const res=await api("updateAsset", payload);
          await refresh();
          showNotice(`อัปเดต Asset ${assetId} สำเร็จ${res.active_booking_warning ? ' · หมายเหตุ: '+res.active_booking_warning : ''}`, res.active_booking_warning ? "warn" : "ok");
        }catch(e){ showNotice(e.message,"bad"); }
        finally{ setBusy(assetBtn,false); }
        return;
      }
      const deleteAssetBtn=ev.target.closest("[data-delete-asset]");
      if(deleteAssetBtn){
        ev.preventDefault(); ev.stopPropagation();
        const assetId=deleteAssetBtn.getAttribute("data-delete-asset")||"";
        if(!assetId) return showNotice("ไม่พบ asset_id ที่ต้องการลบ", "bad");
        const ok=confirm(`ต้องการลบ Asset ${assetId} ใช่ไหม?\n\nระบบจะลบได้เฉพาะ asset ที่ยังไม่เคยถูกใช้ใน booking เท่านั้น ถ้าเคยใช้งานแล้วควรเปลี่ยนเป็น inactive แทนเพื่อเก็บประวัติให้ถูกต้อง`);
        if(!ok) return;
        setBusy(deleteAssetBtn,true);
        try{
          await api("deleteAsset", {asset_id:assetId});
          await refresh();
          showNotice(`ลบ Asset ${assetId} สำเร็จ`);
        }catch(e){ showNotice(e.message,"bad"); }
        finally{ setBusy(deleteAssetBtn,false); }
        return;
      }
      const editBtn=ev.target.closest("[data-edit-booking-row]");
      if(editBtn){
        ev.preventDefault(); ev.stopPropagation();
        openBookingEdit(editBtn.getAttribute("data-edit-booking-row"));
        return;
      }
      const copyBtn=ev.target.closest("[data-copy-line]");
      if(copyBtn){
        ev.preventDefault(); ev.stopPropagation();
        const b=findBookingByRow(copyBtn.getAttribute("data-row"));
        if(!b) return showNotice("ไม่พบ booking สำหรับ copy message", "bad");
        const msg=crmLineMessage(b, copyBtn.getAttribute("data-copy-line"));
        try{ await navigator.clipboard.writeText(msg); showNotice("Copy ข้อความ LINE แล้ว"); }
        catch(_){ showNotice(msg, "warn"); }
        return;
      }
      const quick=ev.target.closest("[data-quick-action]");
      if(!quick) return;
      ev.preventDefault(); ev.stopPropagation();
      const action=quick.getAttribute("data-quick-action");
      const row=quick.getAttribute("data-row");
      const b=findBookingByRow(row);
      if(!b) return showNotice("ไม่พบ booking ที่ต้องการอัปเดต", "bad");
      let payload={row_number:row};
      let label="";
      if(action==="paid"){
        if(toNum(b.amount_received)<=0 && !confirm("Booking นี้ยอดรับแล้วยังเป็น 0 ต้องการเปลี่ยนสถานะเป็น paid อยู่ใช่ไหม?")) return;
        payload.payment_status="paid"; label="สถานะชำระเงินเป็น paid";
      }else if(action==="prepared"){
        payload.booking_status="prepared"; label="สถานะเป็นเตรียมอุปกรณ์แล้ว และจัด Asset ให้ booking";
      }else if(action==="assign_assets"){
        payload.booking_status=String(b.booking_status||"prepared").toLowerCase().trim() || "prepared"; label="จัด Asset ให้ booking แล้ว";
      }else if(action==="picked_up"){
        payload.booking_status="picked_up"; label="สถานะเป็นรับเครื่องแล้ว";
      }else if(action==="returned"){
        payload.booking_status="returned"; label="สถานะเป็นคืนเครื่องแล้ว";
      }else if(action==="uploaded"){
        payload.booking_status="uploaded"; label="สถานะเป็นอัปโหลดไฟล์แล้ว";
      }else if(action==="completed"){
        if(!confirm("ปิดงานนี้เป็น completed ใช่ไหม? รายการจะหายจาก Action Center")) return;
        payload.booking_status="completed"; label="ปิดงาน completed";
      }else if(action==="no_show"){
        if(!confirm("เปลี่ยน booking นี้เป็น no_show ใช่ไหม?")) return;
        payload.booking_status="no_show"; label="สถานะเป็น no_show";
      }else if(action==="cancelled"){
        if(!confirm("ยกเลิก booking นี้ใช่ไหม?")) return;
        payload.booking_status="cancelled"; label="สถานะเป็น cancelled";
      }else return;
      setBusy(quick,true);
      try{ await api("updateBooking", payload); await refresh(); showNotice("อัปเดตสำเร็จ: "+label); }
      catch(e){ showNotice(e.message,"bad"); }
      finally{ setBusy(quick,false); }
    });
    const bookingEventSelect=$("#bookingForm select[name='event_id']");
    if(bookingEventSelect) bookingEventSelect.addEventListener("change", ()=>{ populateBookingPackages(); autofillBookingAmountFromPackage(); });
    const bookingPackageSelect=$("#bookingForm select[name='template_id']");
    if(bookingPackageSelect) bookingPackageSelect.addEventListener("change", autofillBookingAmountFromPackage);
    const bookingAmountInput=$("#bookingForm input[name='amount_received']");
    if(bookingAmountInput) bookingAmountInput.addEventListener("input", ()=>updateBookingAmountHint(bookingSelectedPackagePrice()));
    const eventUpdateSelect=$("#eventUpdateForm select[name='event_id']");
    if(eventUpdateSelect) eventUpdateSelect.addEventListener("change", populateEventUpdateForm);
    const packageUpdateSelect=$("#packageUpdateForm select[name='template_id']");
    if(packageUpdateSelect) packageUpdateSelect.addEventListener("change", populatePackageUpdateForm);
    const bookingEditSelect=$("#bookingEditForm select[name='row_number']");
    if(bookingEditSelect) bookingEditSelect.addEventListener("change", populateBookingEditForm);
    const cleanupBtn=$("#cleanupBtn");
    if(cleanupBtn){
      cleanupBtn.addEventListener("click", async()=>{
        if(!confirm("ย้าย booking/event เก่ากว่า 30 วันไป Archive และอัปเดต Customer Stats ใช่ไหม?")) return;
        setBusy(cleanupBtn,true);
        try{
          const res=await api("cleanupOldData",{});
          await refresh();
          showNotice(`Cleanup สำเร็จ: bookings ${res.archived_bookings||0}, events ${res.archived_events||0}, overrides ${res.archived_overrides||0}, customer stats ${res.customer_stats_updated||0}`);
        }catch(e){ showNotice(e.message,"bad"); }
        finally{ setBusy(cleanupBtn,false); }
      });
    }

    const systemGuardBtn=$("#runSystemGuardBtn");
    if(systemGuardBtn) systemGuardBtn.addEventListener("click",()=>runSystemGuard(systemGuardBtn));
    const copySystemGuardBtn=$("#copySystemGuardBtn");
    if(copySystemGuardBtn) copySystemGuardBtn.addEventListener("click",async()=>{
      const rows=currentSystemGuardRows();
      const text=rows.map(r=>`${r.status||''} | ${r.label||r.check||r.key||''} | ${r.detail||''} | ${r.suggestion||r.note||''}`).join("\n");
      try{ await navigator.clipboard.writeText(text); showNotice("Copy System Guard result แล้ว"); }
      catch(_){ showNotice(text,"warn"); }
    });

    const overrideForm=$("#eventPriceOverrideForm");
    if(overrideForm){
      // Only event/package selectors should reload the saved override.
      // Do NOT bind active_override here; otherwise selecting "เปิดขาย" / "ซ่อน"
      // immediately calls populateEventOverrideForm() and resets the user's choice back to the saved value.
      [overrideForm.elements.event_id, overrideForm.elements.template_id].filter(Boolean).forEach(sel=>{
        sel.addEventListener("change", populateEventOverrideForm);
      });
      overrideForm.addEventListener("submit",async ev=>{
        ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
        try{ await api("upsertEventOverride",formData(ev.target)); await refresh(); showNotice("บันทึกราคาเฉพาะงานสำเร็จ"); }
        catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
      });

      $$("[data-bulk-event-visibility]", overrideForm).forEach(btn=>{
        btn.addEventListener("click",async()=>{
          const eventId=String(overrideForm.elements.event_id && overrideForm.elements.event_id.value || "").trim();
          if(!eventId) return showNotice("กรุณาเลือกงานก่อนจัดการแพ็กเกจทั้งงาน","warn");
          const mode=String(btn.getAttribute("data-bulk-event-visibility")||"").trim();
          const label=mode==="hide" ? "ซ่อนทุกแพ็กเกจ" : (mode==="show" ? "เปิดทุกแพ็กเกจ" : "คืนสถานะตามแพ็กเกจหลัก");
          const event=((state.data&&state.data.events)||[]).find(e=>String(e.event_id||"")===eventId);
          const eventName=event ? (event.event_name||eventId) : eventId;
          const detail=mode==="hide"
            ? "ลูกค้าจะไม่เห็นแพ็กเกจใดของงานนี้บนหน้าบ้าน"
            : (mode==="show"
              ? "ทุกแพ็กเกจหลักที่เปิดใช้งานจะถูกเปิดในงานนี้"
              : "ระบบจะล้างเฉพาะสถานะเปิด/ซ่อนของงานนี้ แล้วกลับไปใช้สถานะจากแพ็กเกจหลัก");
          if(!window.confirm(`${label}\nงาน: ${eventName}\n\n${detail}\n\nราคาและข้อความ override เดิมจะยังอยู่`)) return;
          setBusy(btn,true);
          try{
            const res=await api("bulkSetEventPackageVisibility",{event_id:eventId,mode});
            await refresh();
            const count=Number(res.packages_updated||0);
            showNotice(`${label}สำเร็จ ${count} แพ็กเกจ`);
          }catch(e){ showNotice(e.message,"bad"); }
          finally{ setBusy(btn,false); }
        });
      });
    }

    const eventForm=$("#eventForm");
    if(eventForm) eventForm.addEventListener("submit",async ev=>{
      ev.preventDefault();
      const p=formData(ev.target);
      if(!confirmEventNameLint(p.event_name)) return;
      const btn=ev.submitter; setBusy(btn,true);
      try{
        if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);
        const uploaded=await uploadPosterFromInput("#posterFile", ev.target);
        if(uploaded) p.poster_url=uploaded;
        p.event_price_overrides=collectCreateEventPriceOverrides();
        const res=await api("createEvent",p);
        ev.target.reset();
        const toggle=$("#eventPriceToggle");
        if(toggle) toggle.checked=false;
        resetCreateEventPriceOverrides();
        await refresh();
        const priceText=res.overrides_created ? ` · บันทึกราคาเฉพาะงาน ${res.overrides_created} แพ็กเกจ` : "";
        showNotice("สร้างงานสำเร็จ" + priceText + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));
        state.posterWarning = "";
      }
      catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
    });
    const resetCreateEventPrices=$("#resetCreateEventPrices");
    if(resetCreateEventPrices) resetCreateEventPrices.addEventListener("click", resetCreateEventPriceOverrides);
    const eventPriceToggle=$("#eventPriceToggle");
    if(eventPriceToggle) eventPriceToggle.addEventListener("change", updateCreateEventPriceUi);
    if(eventForm) eventForm.addEventListener("reset",()=>setTimeout(updateCreateEventPriceUi,0));

    const eventUpdateForm=$("#eventUpdateForm");
    if(eventUpdateForm) eventUpdateForm.addEventListener("submit",async ev=>{
      ev.preventDefault();
      const p=formData(ev.target);
      if(p.event_name && !confirmEventNameLint(p.event_name)) return;
      const btn=ev.submitter; setBusy(btn,true);
      try{
        if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);
        const uploaded=await uploadPosterFromInput("#updatePosterFile", ev.target);
        if(uploaded) p.poster_url=uploaded;
        const res=await api("updateEvent",p);
        if($("#updatePosterFile")) $("#updatePosterFile").value="";
        await refresh();
        showNotice("แก้งานสำเร็จ" + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));
        state.posterWarning = "";
      }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);}
    });
    const packageForm=$("#packageForm");
    if(packageForm) packageForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("createPackage",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่มแพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const packageUpdateForm=$("#packageUpdateForm");
    if(packageUpdateForm) packageUpdateForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updatePackage",formData(ev.target)); await refresh(); showNotice("แก้แพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const assetForm=$("#assetForm");
    if(assetForm) assetForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("addAssets",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่ม asset สำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const bookingForm=$("#bookingForm");
    if(bookingForm) bookingForm.addEventListener("submit",async ev=>{
      ev.preventDefault();
      const btn=ev.submitter;
      setBusy(btn,true);
      try{
        if(String(ev.target.elements.amount_received && ev.target.elements.amount_received.value || "").trim()==="") autofillBookingAmountFromPackage();
        const payload=formData(ev.target);
        if(hasWebPackageSource()){
          if(!eventHasBookablePackage(payload.event_id)) throw new Error("งานนี้เต็มแล้วหรือไม่มีแพ็กเกจว่าง กรุณา Refresh แล้วเลือกงานใหม่");
          const okPkg=bookableWebPackagesForEvent(payload.event_id).some(p=>String(templateIdFromWebPackage(p))===String(payload.template_id));
          if(!okPkg) throw new Error("แพ็กเกจนี้เต็มแล้วหรือถูกซ่อน กรุณาเลือกแพ็กเกจที่ยังว่าง");
        }
        const res=await api("createBooking",payload);
        ev.target.reset();
        await refresh();
        showNotice(`บันทึก Booking สำเร็จ: Phone ${res.phone_asset_id||'-'} / Lens ${res.lens_asset_id||'-'}`);
      }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);}
    });
    const bookingEditForm=$("#bookingEditForm");
    if(bookingEditForm){
      bookingEditForm.addEventListener("submit",async ev=>{
        ev.preventDefault();
        const btn=ev.submitter;
        setBusy(btn,true);
        try{
          const payload=formData(ev.target);
          if(!payload.row_number) throw new Error("กรุณาเลือก Booking ที่ต้องการแก้");
          const res=await api("updateBooking", payload);
          await refresh();
          showNotice(`แก้ Booking สำเร็จ: row ${res.row_number}`);
        }catch(e){ showNotice(e.message,"bad"); }finally{ setBusy(btn,false); }
      });
    }
  }

  applyDensityMode();
  updateUiLastRefresh();
  bind();
  if(state.pin && $("#pinInput") && $("#loginBtn")){
    $("#pinInput").value=state.pin;
    // /admin/app is already protected by the signed server session. Reveal the
    // workspace shell immediately so a slow/degraded snapshot cannot strand the
    // operator on a blank authenticated page. Auth failures still hide it in refresh().
    if(state.pin==="__SESSION__"){
      $("#loginPanel").classList.add("hidden");
      $("#appPanel").classList.remove("hidden");
    }
    $("#loginBtn").click();
  }
})();
