// KK Phone Rental Admin CRM v16.7.0_CRM_PRO_PHASE3 — Reports & Asset Intelligence
(function(){
  const KK_ADMIN_UI_VERSION = "v16.7.0_CRM_PRO_PHASE3";
  const EXPECTED_BACKEND_VERSION = "v16.7.0_CRM_PRO_PHASE3";
  const EXPECTED_PROXY_VERSION = "v16.6.2_LINE_AUDITED";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false, posterWarning: "", selectedCustomerKey: "", actionFilter: "all", actionSearch: "", reportRange: "all", reportStart: "", reportEnd: "", reportStatusMode: "active_revenue" };
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
      .filter(e=>String(e.status||"").toLowerCase()==="open" && e.active_on_web!==false)
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
        pickup_time:b.pickup_time||"",
        package_display:b.package_display||b.package_type||"",
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
      if(isActiveBookingStatus(st) && diff!==null && diff>=0 && diff<=7 && !String(b.pickup_time||"").trim()){
        pushBooking(b,{type:"data", priority:2, task:"ยังไม่มีเวลารับเครื่อง", risk_flag:true});
      }
      if(["pending","confirmed","prepared"].includes(st) && diff!==null && diff>=0 && diff<=7){
        const task=st==="pending" ? "ยืนยัน booking / นัดเวลา" : (st==="prepared" ? "พร้อมส่งมอบ / รอลูกค้ารับ" : (diff===0 ? "งานวันนี้: เตรียมส่งมอบ" : "งานใน "+diff+" วัน: เตรียมเครื่อง"));
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
    const pickup=b.pickup_time || '-';
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
          <span>${esc(bookingLifecycleLabel(b.booking_status))} · ${esc(b.package_display||b.package_type||'-')} · รับ ${esc(b.pickup_time||'-')}</span>
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
      {label:"เวลารับ",render:r=>esc(r.pickup_time || "-")},
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
    if(missingPickup) rows.push({level:"warn", title:"ยังมี booking ไม่มีเวลารับเครื่อง", detail:`พบ ${missingPickup} booking ในช่วงรายงานที่ควรใส่ pickup_time เพื่อลดการลืมส่งมอบ`});
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

  function startOfToday(){
    const d=new Date();
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
    return (d.overrides||[]).find(o=>String(o.event_id)===String(eventId)&&String(o.template_id)===String(templateId));
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
      ["booking_status","customer_name","customer_contact","customer_phone","contact_channel","payment_status","amount_received","pickup_time","phone_asset_id","lens_asset_id","booking_note"].forEach(k=>set(k,""));
      return;
    }
    set("booking_status", b.booking_status || "confirmed");
    set("customer_name", b.customer_name || "");
    set("customer_contact", b.customer_contact || "");
    set("customer_phone", b.customer_phone || "");
    set("contact_channel", b.contact_channel || "LINE");
    set("payment_status", b.payment_status || "unpaid");
    set("amount_received", b.amount_received || 0);
    set("pickup_time", b.pickup_time || "");
    set("phone_asset_id", b.phone_asset_id || "");
    set("lens_asset_id", b.lens_asset_id || "");
    set("booking_note", b.note || "");
  }

  async function api(action, payload={}){
    const res=await fetch("/api/kk-admin",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Admin-Pin":state.pin},
      body:JSON.stringify(Object.assign({action},payload))
    });
    const data=await res.json().catch(()=>({ok:false,error:"Invalid server response"}));
    if(!data.ok) throw new Error(data.error||"Request failed");
    return data;
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
    rows.push({check:"Version · Apps Script", status: backendVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:backendVersion || "missing", note:"Expected "+EXPECTED_BACKEND_VERSION+". Deploy Apps Script latest version if not matching"});
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
  }

  function render(){
    const d=state.data||{};
    ["reportRange","reportStart","reportEnd","reportStatusMode"].forEach(id=>{ const el=$("#"+id); if(el && state[id]!==undefined && el.value!==state[id]) el.value=state[id]; });
    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=versionDiagnosticsRows(d).concat(d.health||[]), today=d.today_working||[], customers=d.customers||[];
    const currentBookings=(d.current_bookings&&d.current_bookings.length?d.current_bookings:bookings.filter(shouldShowInEditBooking));
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
    const openEvents=openEventRows.length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const activeBookings=currentBookings.filter(b=>isWorkflowOpenStatus(b.booking_status)).length;
    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือ available"],[lenses,"เลนส์ available"],[activeBookings,"Booking active"],[today.length,"งานที่ต้องทำวันนี้"],[customerHistory.length,"ลูกค้าที่มีประวัติ"]
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
      {label:"เวลารับ",render:r=>esc(r.pickup_time || "-")},
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
      {label:"Pickup",render:r=>esc(r.pickup_time || "-")},
      {label:"Payment",render:r=>`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>`},
      {label:"สิ่งที่ต้องทำ",key:"work_task"},
      {label:"Note",key:"note"}
    ], today);

    $("#assetsCount").textContent=assets.length+" รายการ";
    table($("#assetsTable"),[
      {label:"ID",key:"asset_id"},{label:"Type",key:"asset_type"},{label:"Model Display",render:r=>esc(r.model_display || r.model_group || "")},{label:"Group",key:"model_group"},{label:"Serial",key:"serial"},{label:"Status",key:"status"},{label:"Rentable",render:r=>r.rentable===false?'FALSE':'TRUE'}
    ], assets.slice(0,80));

    table($("#healthTable"),[
      {label:"Check",key:"check"},{label:"Status",render:r=>`<span class="pill ${String(r.status).toLowerCase().includes('ok')?'ok':String(r.status).toLowerCase().includes('check')?'bad':''}">${esc(r.status||'')}</span>`},{label:"Detail",key:"detail"},{label:"Note",key:"note"}
    ], health);

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

    fillSelects();
  }

  async function refresh(){
    if(state.loading) return;
    state.loading=true;
    try{
      const data=await api("snapshot");
      state.data=data.data||{};
      render();
      const backendVersion = state.data.admin_api_version || (state.data.phase1_diagnostics && state.data.phase1_diagnostics.admin_api_version) || "";
      if(backendVersion && backendVersion !== EXPECTED_BACKEND_VERSION){
        showNotice("Version ไม่ตรงกัน: Admin UI "+KK_ADMIN_UI_VERSION+" / Expected Apps Script "+EXPECTED_BACKEND_VERSION+" แต่ Apps Script จริงคือ "+backendVersion, "bad");
      }
      if(state.data.spreadsheet_id && state.data.frontend_sheet_id && state.data.spreadsheet_id !== state.data.frontend_sheet_id){
        showNotice("GOOGLE_SHEET_ID ใน Vercel ไม่ตรงกับ Spreadsheet ที่ Apps Script ใช้", "bad");
      }
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
      state.pin=$("#pinInput").value.trim(); if(!state.pin) return alert("กรุณากรอก PIN");
      sessionStorage.setItem("kk_admin_pin",state.pin);
      try{ await refresh(); $("#loginPanel").classList.add("hidden"); $("#appPanel").classList.remove("hidden"); showNotice("โหลดข้อมูลสำเร็จ"); }
      catch(e){ showNotice(e.message,"bad"); }
    });
    const logoutBtn=$("#logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click",()=>{ sessionStorage.removeItem("kk_admin_pin"); location.reload(); });
    const refreshBtn=$("#refreshBtn");
    if(refreshBtn) refreshBtn.addEventListener("click",()=>refresh().then(()=>showNotice("Refresh แล้ว")).catch(e=>showNotice(e.message,"bad")));
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
        payload.booking_status="prepared"; label="สถานะเป็นเตรียมเครื่องแล้ว";
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
    if(bookingEventSelect) bookingEventSelect.addEventListener("change", populateBookingPackages);
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

    const overrideForm=$("#eventPriceOverrideForm");
    if(overrideForm){
      $$('select', overrideForm).forEach(sel=>sel.addEventListener("change", populateEventOverrideForm));
      overrideForm.addEventListener("submit",async ev=>{
        ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
        try{ await api("upsertEventOverride",formData(ev.target)); await refresh(); showNotice("บันทึกราคาเฉพาะงานสำเร็จ"); }
        catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
      });
    }

    const eventForm=$("#eventForm");
    if(eventForm) eventForm.addEventListener("submit",async ev=>{
      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
      try{
        const p=formData(ev.target);
        if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);
        const uploaded=await uploadPosterFromInput("#posterFile", ev.target);
        if(uploaded) p.poster_url=uploaded;
        const res=await api("createEvent",p);
        ev.target.reset();
        await refresh();
        showNotice("สร้างงานสำเร็จ" + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));
        state.posterWarning = "";
      }
      catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
    });
    const eventUpdateForm=$("#eventUpdateForm");
    if(eventUpdateForm) eventUpdateForm.addEventListener("submit",async ev=>{
      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
      try{
        const p=formData(ev.target);
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

  bind();
  if(state.pin && $("#pinInput") && $("#loginBtn")){ $("#pinInput").value=state.pin; $("#loginBtn").click(); }
})();
