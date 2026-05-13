// KK Phone Rental Admin CRM v16.2_FULL_AUDIT_STABLE — Phase 1 stability baseline
(function(){
  const KK_ADMIN_UI_VERSION = "v16.2_FULL_AUDIT_STABLE";
  const EXPECTED_BACKEND_VERSION = "v16.2_FULL_AUDIT_STABLE";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false, posterWarning: "" };

  function showNotice(msg, type="ok"){
    const n=$("#notice");
    if(!n) return alert(msg);
    n.textContent=msg; n.className="notice "+type;
    clearTimeout(showNotice.t); showNotice.t=setTimeout(()=>n.classList.add("hidden"),7000);
  }
  function setBusy(btn, busy){ if(!btn) return; btn.disabled=!!busy; btn.dataset.old=btn.dataset.old||btn.textContent; btn.textContent=busy?"กำลังบันทึก...":btn.dataset.old; }
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
  function sortedOpenEvents(events){
    const sort=($("#eventsSort") && $("#eventsSort").value) || "date_asc";
    const rows=(events||[])
      .filter(e=>String(e.status||"").toLowerCase()==="open" && e.active_on_web!==false)
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
    rows.push({check:"Version · Admin UI", status: KK_ADMIN_UI_VERSION===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:KK_ADMIN_UI_VERSION, note:"Expected "+EXPECTED_BACKEND_VERSION});
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
      sel.innerHTML='<option value="">เลือกงาน</option>'+(data.events||[])
        .filter(e=>String(e.status||"").toLowerCase()!=="closed")
        .map(e=>opt(e.event_id, `${e.event_name} · ${fmtDate(e.event_date)}`)).join('');
      if(current) sel.value=current;
    });
    $$('select[data-source="packages"]').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(data.packages||[])
        .filter(p=>p.active!==false)
        .map(p=>opt(p.template_id, `${p.display_name||p.template_id} · ${money(p.standard_price)}฿`)).join('');
      if(current) sel.value=current;
    });
    populateEventOverrideForm();
  }

  function render(){
    const d=state.data||{};
    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=versionDiagnosticsRows(d).concat(d.health||[]), today=d.today_working||[], customers=d.customers||[];
    const openEventRows=sortedOpenEvents(events);
    const bookingRows=sortedBookings(bookings);
    const openEvents=openEventRows.length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const activeBookings=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;
    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือ available"],[lenses,"เลนส์ available"],[activeBookings,"Booking active"],[today.length,"งานที่ต้องทำวันนี้"],[customers.length,"ลูกค้าที่มีประวัติ"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');

    $("#eventsCount").textContent=openEventRows.length+" รายการ";
    table($("#eventsTable"),[
      {label:"วันที่",render:r=>esc(fmtDate(r.event_date))},
      {label:"งาน",key:"event_name"},
      {label:"สถานที่",key:"venue"},
      {label:"สถานะ",render:r=>`<span class="pill ${r.status==='open'?'ok':'bad'}">${esc(r.status)}</span>`},
      {label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}
    ], openEventRows.slice(0,50));

    $("#bookingsCount").textContent=bookingRows.length+" รายการ";
    table($("#bookingsTable"),[
      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},
      {label:"ชื่อลูกค้า",key:"customer_name"},
      {label:"เบอร์โทร",render:r=>esc(r.customer_phone || "-")},
      {label:"ชื่องาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || "")},
      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},
      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},
      {label:"สถานะ",render:r=>`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status)}</span>`},
      {label:"วันที่บันทึก",render:r=>esc(fmtDate(r.created_at))}
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

    if($("#customerStatsCount")) $("#customerStatsCount").textContent=customers.length+" รายการ";
    table($("#customerStatsTable"),[
      {label:"ลูกค้า",key:"customer_name"},
      {label:"ติดต่อ",render:r=>esc([r.customer_contact,r.customer_phone].filter(Boolean).join(" / "))},
      {label:"เช่าแล้ว",render:r=>esc(r.rental_count||0)},
      {label:"เช่าล่าสุด",render:r=>esc(fmtDate(r.last_rental_date))},
      {label:"งานล่าสุด",key:"last_event_name"}
    ], customers.slice(0,50));

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
        showNotice("Version ไม่ตรงกัน: Admin UI "+EXPECTED_BACKEND_VERSION+" แต่ Apps Script "+backendVersion, "bad");
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
    $$(".nav[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
      $$(".nav").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
      $$(".tab-panel").forEach(p=>p.classList.remove("active")); $("#tab-"+btn.dataset.tab).classList.add("active");
    }));
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
    $("#bookingForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ const res=await api("createBooking",formData(ev.target)); ev.target.reset(); await refresh(); showNotice(`บันทึก Booking สำเร็จ: Phone ${res.phone_asset_id||'-'} / Lens ${res.lens_asset_id||'-'}`); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
  }

  bind();
  if(state.pin){ $("#pinInput").value=state.pin; $("#loginBtn").click(); }
})();
