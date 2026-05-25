// KK Phone Rental Admin CRM v16.4.14_EDIT_BOOKING_PAST_FILTER — Hide closed past bookings from Edit Booking
(function(){
  const KK_ADMIN_UI_VERSION = "v16.4.14_EDIT_BOOKING_PAST_FILTER";
  const EXPECTED_BACKEND_VERSION = "v16.4.5_ADMIN_EDIT_BOOKING_FILTER_FIX";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false, posterWarning: "", selectedCustomerKey: "" };

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
    return ["pending","confirmed","picked_up"].includes(String(status||"").toLowerCase().trim());
  }
  function isClosedBookingStatus(status){
    return ["cancelled","returned"].includes(String(status||"").toLowerCase().trim());
  }
  function shouldShowInEditBooking(b){
    // Edit Booking should stay focused on work that can still change operations.
    // Hide past bookings that are already closed (returned/cancelled), but keep overdue active rows
    // so admins can still mark them returned/cancelled if they forgot to update the status.
    if(!b) return false;
    if(isTodayOrFuture(b.event_date)) return true;
    return !isClosedBookingStatus(b.booking_status);
  }
  function isUnpaidPayment(status){
    const s=String(status||"").toLowerCase().trim();
    // Blank payment status should still be treated as unpaid, otherwise Action Center misses follow-up items.
    return !["paid","refunded"].includes(s);
  }
  function actionSeverity(type){
    if(type==="payment" || type==="return" || type==="data") return "bad";
    if(type==="upcoming") return "warn";
    return "ok";
  }
  function buildActionRows(data){
    const d=data||{};
    const rows=[];
    const bookings=d.bookings||[];
    const events=d.events||[];
    bookings.forEach(b=>{
      const st=String(b.booking_status||"").toLowerCase().trim();
      if(st==="cancelled" || st==="returned") return;
      if(isUnpaidPayment(b.payment_status)){
        rows.push({type:"payment", priority:1, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone].filter(Boolean).join(" / "), task:"ตามชำระเงิน", ref:bookingCustomerKey(b)});
      }
      if(st==="picked_up"){
        rows.push({type:"return", priority:2, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone].filter(Boolean).join(" / "), task:"รอรับคืน / ตรวจเครื่อง", ref:bookingCustomerKey(b)});
      }
      const diff=daysFromToday(b.event_date);
      if(isActiveBookingStatus(st) && diff!==null && diff>=0 && diff<=7){
        rows.push({type:"upcoming", priority:3, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone].filter(Boolean).join(" / "), task:diff===0?"งานวันนี้":"งานใน "+diff+" วัน", ref:bookingCustomerKey(b)});
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
        rows.push({type:"data", priority:4, date:e.event_date, title:e.event_name||e.event_id||"", customer:"-", contact:"-", task:missing.join(" / "), ref:""});
      }
    });
    return rows.sort((a,b)=>(a.priority-b.priority) || (dateValue(a.date)-dateValue(b.date)) || String(a.title).localeCompare(String(b.title),"th"));
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
      if(st==="cancelled") return;
      const key=customerKeyFromRecord(b.customer_name,b.customer_contact,b.customer_phone);
      if(!key) return;
      const item=ensure(key);
      item.customer_name=b.customer_name||item.customer_name;
      item.customer_contact=b.customer_contact||item.customer_contact;
      item.customer_phone=b.customer_phone||item.customer_phone;
      item.rental_count+=1;
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
    if(!detailName || !checklist || !tableEl) return;
    const rows=customerHistory||[];
    let customer=rows.find(c=>String(c.customer_key)===String(state.selectedCustomerKey));
    if(!customer && rows.length){
      customer=rows[0];
      state.selectedCustomerKey=String(customer.customer_key||"");
    }
    if(!customer){
      detailName.textContent="ยังไม่มีประวัติลูกค้า";
      if(detailMeta) detailMeta.textContent="เมื่อมี booking ระบบจะแสดงประวัติและจำนวนครั้งที่เช่าตรงนี้";
      checklist.innerHTML="";
      table(tableEl,[{label:"ข้อมูล",render:()=>"ยังไม่มีข้อมูล"}],[]);
      return;
    }
    const bookings=customerBookings(customer);
    const active=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;
    const cancelled=bookings.filter(b=>String(b.booking_status||"").toLowerCase()==="cancelled").length;
    const paid=bookings.filter(b=>String(b.payment_status||"").toLowerCase()==="paid").length;
    detailName.textContent=customer.customer_name || "ไม่ระบุชื่อ";
    if(detailMeta) detailMeta.textContent=[customer.customer_phone, customer.customer_contact].filter(Boolean).join(" / ") || "ไม่มีเบอร์หรือ LINE ในระบบ";
    checklist.innerHTML=[
      [customer.rental_count||0,"เช่ารวม"],
      [bookings.length,"booking ที่พบ"],
      [active,"กำลัง active"],
      [cancelled,"ยกเลิก"],
      [paid,"paid"],
      [fmtDate(customer.last_rental_date)||"-","เช่าล่าสุด"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    table(tableEl,[
      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},
      {label:"งาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || r.template_id || "")},
      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},
      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},
      {label:"Booking",render:r=>`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status||'')}</span>`},
      {label:"Payment",render:r=>`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>`},
      {label:"รับแล้ว",render:r=>esc(money(r.amount_received||0))},
      {label:"Note",render:r=>esc(r.note || r.booking_note || "")}
    ], bookings);
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
      ["booking_status","customer_name","customer_contact","customer_phone","contact_channel","payment_status","amount_received","pickup_time","booking_note"].forEach(k=>set(k,""));
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
    rows.push({check:"Version · Admin UI", status:"OK", detail:KK_ADMIN_UI_VERSION, note:"Admin-only patch; backend expected "+EXPECTED_BACKEND_VERSION});
    rows.push({check:"Version · Vercel Proxy", status: proxyVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:proxyVersion || "missing", note:"Expected "+EXPECTED_BACKEND_VERSION});
    rows.push({check:"Version · Apps Script", status: backendVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:backendVersion || "missing", note:"Deploy Apps Script latest version if not matching"});
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
    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=versionDiagnosticsRows(d).concat(d.health||[]), today=d.today_working||[], customers=d.customers||[];
    const openEventRowsAll=sortedOpenEvents(events);
    const bookingRowsAll=sortedBookings(bookings);
    const eventsQ=($("#eventsSearch") && $("#eventsSearch").value) || "";
    const bookingsQ=($("#bookingsSearch") && $("#bookingsSearch").value) || "";
    const openEventRows=openEventRowsAll.filter(r=>containsQuery(r,["event_name","venue","event_id"],eventsQ));
    const bookingRows=bookingRowsAll.filter(r=>containsQuery(r,["customer_name","customer_phone","customer_contact","event_name","event_id","package_display","package_type"],bookingsQ));
    const actionRows=buildActionRows(d);
    const customerHistory=customerHistoryRows(bookings, customers);
    const openEvents=openEventRows.length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const activeBookings=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;
    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือ available"],[lenses,"เลนส์ available"],[activeBookings,"Booking active"],[today.length,"งานที่ต้องทำวันนี้"],[customerHistory.length,"ลูกค้าที่มีประวัติ"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');

    const actionStats=$("#actionStats");
    if(actionStats){
      actionStats.innerHTML=[
        [actionRows.filter(r=>r.type==="payment").length,"ต้องตามเงิน"],
        [actionRows.filter(r=>r.type==="return").length,"รอรับคืน"],
        [actionRows.filter(r=>r.type==="upcoming").length,"งานใน 7 วัน"],
        [actionRows.filter(r=>r.type==="data").length,"ข้อมูลต้องเช็ก"]
      ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');
    }
    if($("#actionCount")) $("#actionCount").textContent=actionRows.length+" รายการที่ควรเช็ก";
    table($("#actionTable"),[
      {label:"ประเภท",render:r=>`<span class="pill ${actionSeverity(r.type)}">${esc(r.type==="payment"?"ตามเงิน":r.type==="return"?"รับคืน":r.type==="upcoming"?"ใกล้ถึง":"ข้อมูล")}</span>`},
      {label:"วันที่",render:r=>esc(fmtDate(r.date))},
      {label:"รายการ",render:r=>esc(r.title)},
      {label:"ลูกค้า",render:r=>esc(r.customer)},
      {label:"ติดต่อ",render:r=>esc(r.contact)},
      {label:"สิ่งที่ต้องทำ",render:r=>esc(r.task)},
      {label:"CRM",render:r=>r.ref?`<button class="mini-btn" type="button" data-customer-key="${esc(r.ref)}">ดูลูกค้า</button>`:"-"}
    ], actionRows.slice(0,30));

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
      {label:"สถานะ",render:r=>`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status)}</span>`},
      {label:"วันที่บันทึก",render:r=>esc(fmtDate(r.created_at))},
      {label:"CRM",render:r=>`<button class="mini-btn" type="button" data-customer-key="${esc(bookingCustomerKey(r))}">ดูประวัติ</button>`}
    ], bookingRows.slice(0,50));

    const todayStats=$("#todayStats");
    if(todayStats){
      todayStats.innerHTML=[
        [today.length,"Booking วันนี้"],
        [today.filter(b=>["pending","confirmed"].includes(String(b.booking_status||"").toLowerCase())).length,"ต้องเตรียมส่งมอบ"],
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
    $("#loginBtn").addEventListener("click", async()=>{
      state.pin=$("#pinInput").value.trim(); if(!state.pin) return alert("กรุณากรอก PIN");
      sessionStorage.setItem("kk_admin_pin",state.pin);
      try{ await refresh(); $("#loginPanel").classList.add("hidden"); $("#appPanel").classList.remove("hidden"); showNotice("โหลดข้อมูลสำเร็จ"); }
      catch(e){ showNotice(e.message,"bad"); }
    });
    $("#logoutBtn").addEventListener("click",()=>{ sessionStorage.removeItem("kk_admin_pin"); location.reload(); });
    $("#refreshBtn").addEventListener("click",()=>refresh().then(()=>showNotice("Refresh แล้ว")).catch(e=>showNotice(e.message,"bad")));
    ["#eventsSort","#bookingsSort"].forEach(sel=>{
      const el=$(sel);
      if(el) el.addEventListener("change",()=>render());
    });
    ["#eventsSearch","#bookingsSearch"].forEach(sel=>{
      const el=$(sel);
      if(el) el.addEventListener("input",()=>render());
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

    $("#eventForm").addEventListener("submit",async ev=>{
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
    $("#eventUpdateForm").addEventListener("submit",async ev=>{
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
    $("#packageForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("createPackage",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่มแพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#packageUpdateForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updatePackage",formData(ev.target)); await refresh(); showNotice("แก้แพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#assetForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("addAssets",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่ม asset สำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#bookingForm").addEventListener("submit",async ev=>{
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
  if(state.pin){ $("#pinInput").value=state.pin; $("#loginBtn").click(); }
})();
