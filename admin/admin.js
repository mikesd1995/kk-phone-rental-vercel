(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null };

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

  function table(el, cols, rows){
    if(!el) return;
    if(!rows || !rows.length){ el.innerHTML='<tr><td class="muted">ไม่มีข้อมูล</td></tr>'; return; }
    el.innerHTML='<thead><tr>'+cols.map(c=>`<th>${c.label}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c.render?c.render(r):(r[c.key]??"")}</td>`).join('')+'</tr>').join('')+'</tbody>';
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
  }

  function render(){
    const d=state.data||{};
    const events=d.events||[], packages=d.packages||[], assets=d.assets||[], bookings=d.bookings||[], health=d.health||[];
    const openEvents=events.filter(e=>String(e.status||"").toLowerCase()==="open" && e.active_on_web!==false).length;
    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;
    const activeBookings=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;
    $("#statsGrid").innerHTML=[
      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[phones,"มือถือ available"],[lenses,"เลนส์ available"],[activeBookings,"Booking active"]
    ].map(s=>`<div class="card stat"><strong>${s[0]}</strong><span>${s[1]}</span></div>`).join('');

    $("#eventsCount").textContent=events.length+" รายการ";
    table($("#eventsTable"),[
      {label:"วันที่",render:r=>fmtDate(r.event_date)},{label:"งาน",key:"event_name"},{label:"สถานที่",key:"venue"},{label:"สถานะ",render:r=>`<span class="pill ${r.status==='open'?'ok':'bad'}">${r.status}</span>`},{label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}
    ], events.slice(0,30));

    $("#bookingsCount").textContent=bookings.length+" รายการ";
    table($("#bookingsTable"),[
      {label:"วันที่บันทึก",render:r=>fmtDate(r.created_at)},{label:"ลูกค้า",key:"customer_name"},{label:"งาน",key:"event_id"},{label:"แพ็กเกจ",key:"package_type"},{label:"Phone",key:"phone_asset_id"},{label:"Lens",key:"lens_asset_id"},{label:"สถานะ",key:"booking_status"}
    ], bookings.slice(0,30));

    $("#assetsCount").textContent=assets.length+" รายการ";
    table($("#assetsTable"),[
      {label:"ID",key:"asset_id"},{label:"Type",key:"asset_type"},{label:"Group",key:"model_group"},{label:"Serial",key:"serial"},{label:"Status",key:"status"},{label:"Rentable",render:r=>r.rentable===false?'FALSE':'TRUE'}
    ], assets.slice(0,80));

    table($("#healthTable"),[
      {label:"Check",key:"check"},{label:"Status",render:r=>`<span class="pill ${String(r.status).toLowerCase().includes('ok')?'ok':String(r.status).toLowerCase().includes('check')?'bad':''}">${r.status||''}</span>`},{label:"Detail",key:"detail"},{label:"Note",key:"note"}
    ], health);

    fillSelects();
  }

  async function refresh(){
    const data=await api("snapshot"); state.data=data.data; render();
  }

  async function uploadPosterIfAny(){
    const file=$("#posterFile") && $("#posterFile").files[0];
    if(!file) return "";
    if(file.size>3*1024*1024) throw new Error("รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 3MB");
    const base64=await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.onerror=reject; r.readAsDataURL(file); });
    const res=await api("uploadPoster",{fileName:file.name,mimeType:file.type,base64});
    return res.url;
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

    $("#eventForm").addEventListener("submit",async ev=>{
      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
      try{ const p=formData(ev.target); const uploaded=await uploadPosterIfAny(); if(uploaded) p.poster_url=uploaded; await api("createEvent",p); ev.target.reset(); await refresh(); showNotice("สร้างงานสำเร็จ"); }
      catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
    });
    $("#eventUpdateForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updateEvent",formData(ev.target)); await refresh(); showNotice("แก้งานสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#packageForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("createPackage",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่มแพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#packageUpdateForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updatePackage",formData(ev.target)); await refresh(); showNotice("แก้แพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#assetForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("addAssets",formData(ev.target)); ev.target.reset(); await refresh(); showNotice("เพิ่ม asset สำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    $("#bookingForm").addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ const res=await api("createBooking",formData(ev.target)); ev.target.reset(); await refresh(); showNotice(`บันทึก Booking สำเร็จ: Phone ${res.phone_asset_id||'-'} / Lens ${res.lens_asset_id||'-'}`); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
  }

  bind();
  if(state.pin){ $("#pinInput").value=state.pin; $("#loginBtn").click(); }
})();
