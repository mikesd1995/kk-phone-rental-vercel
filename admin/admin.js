(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false };

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
  function dateToInput(v){
    if(!v) return "";
    const d=new Date(v); if(isNaN(d)) return String(v).slice(0,10);
    return d.toISOString().slice(0,10);
  }
  function fmtDate(v){
    if(!v) return "";
    const d=new Date(v); if(isNaN(d)) return String(v);
    return d.toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit"});
  }
  function money(v){ const n=Number(v||0); return n.toLocaleString("th-TH"); }
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
  function table(el, cols, rows){
    if(!el) return;
    if(!rows || !rows.length){ el.innerHTML='<tr><td class="muted">ไม่มีข้อมูล</td></tr>'; return; }
    el.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c.render?c.render(r):esc(r[c.key]??"")}</td>`).join('')+'</tr>').join('')+'</tbody>';
  }

  function fillSelects(){
    const data=state.data||{};
    $$('select[data-source="events"]').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML='<option value="">เลือกงาน</option>'+(data.events||[]).filter(e=>String(e.status||"").toLowerCase()!=="closed").map(e=>`<option value="${e.event_id}">${e.event_name} · ${fmtDate(e.event_date)}</option>`).join('');
      if(current) sel.value=current;
    });
    $$('select[data-source="packages"]').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(data.packages||[]).filter(p=>p.active!==false).map(p=>`<option value="${p.template_id}">${p.display_name||p.template_id} · ${money(p.standard_price)}฿</option>`).join('');
      if(current) sel.value=current;
    });
    populateEventOverrideForm();
  }

  function render(){
    const d=state.data||{};
    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=d.health||[], today=d.today_working||[], customers=d.customers||[];
    const openEvents=events.filter(e=>String(e.status||"").toLowerCase()==="open" && e.active_on_web!==false).length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const activeBookings=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;
    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือ available"],[lenses,"เลนส์ available"],[activeBookings,"Booking active"],[today.length,"งานที่ต้องทำวันนี้"],[customers.length,"ลูกค้าที่มีประวัติ"]
    ].map(s=>`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join('');

    $("#eventsCount").textContent=events.length+" รายการ";
    table($("#eventsTable"),[
      {label:"วันที่",render:r=>esc(fmtDate(r.event_date))},{label:"งาน",key:"event_name"},{label:"สถานที่",key:"venue"},{label:"สถานะ",render:r=>`<span class="pill ${r.status==='open'?'ok':'bad'}">${esc(r.status)}</span>`},{label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}
    ], events.slice(0,30));

    $("#bookingsCount").textContent=bookings.length+" รายการ";
    table($("#bookingsTable"),[
      {label:"วันที่บันทึก",render:r=>esc(fmtDate(r.created_at))},
      {label:"ลูกค้า",key:"customer_name"},
      {label:"ชื่องาน",render:r=>esc(r.event_name || r.event_id || "")},
      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || "")},
      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},
      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},
      {label:"สถานะ",render:r=>`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status)}</span>`}
    ], bookings.slice(0,30));

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
    } finally {
      state.loading=false;
    }
  }

  async function uploadPosterFromInput(fileInput, form){
    const input = typeof fileInput === "string" ? $(fileInput) : fileInput;
    const file = input && input.files && input.files[0];
    if(!file) return "";
    if(file.size>3*1024*1024) throw new Error("รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 3MB");

    const base64=await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||"").split(',')[1]||"");
      r.onerror=()=>reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      r.readAsDataURL(file);
    });

    const res=await api("uploadPoster",{fileName:file.name,mimeType:file.type||"image/jpeg",base64});
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
        const uploaded=await uploadPosterFromInput("#posterFile", ev.target);
        if(uploaded) p.poster_url=uploaded;
        const res=await api("createEvent",p);
        ev.target.reset();
        await refresh();
        showNotice("สร้างงานสำเร็จ" + (res.poster_url ? " และบันทึกรูปเข้า 01_Events แล้ว" : ""));
      }
      catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
    });
    $("#eventUpdateForm").addEventListener("submit",async ev=>{
      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
      try{
        const p=formData(ev.target);
        const uploaded=await uploadPosterFromInput("#updatePosterFile", ev.target);
        if(uploaded) p.poster_url=uploaded;
        const res=await api("updateEvent",p);
        if($("#updatePosterFile")) $("#updatePosterFile").value="";
        await refresh();
        showNotice("แก้งานสำเร็จ" + (res.poster_url ? " และบันทึกรูปเข้า 01_Events แล้ว" : ""));
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
