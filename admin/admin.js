// KK Phone Rental Admin CRM — Snapshot Resilience 1
(function(){
  const KK_ADMIN_UI_VERSION = KKSnapshotHealth.VERSION;
  const EXPECTED_BACKEND_VERSION = KKSnapshotHealth.BACKEND;
  const EXPECTED_PROXY_VERSION = KKSnapshotHealth.VERSION;
  let snapshotState = { stale: false, checkedAt: null, goodAt: null, health: null, error: "" };
  const $ = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  function safeSessionGet(key){
    try{ return sessionStorage.getItem(key) || ""; }catch(_){ return ""; }
  }
  function safeSessionSet(key,value){
    try{ sessionStorage.setItem(key,value); return true; }catch(_){ return false; }
  }
  function safeSessionRemove(key){
    try{ sessionStorage.removeItem(key); return true; }catch(_){ return false; }
  }
  function safeLocalGet(key){
    try{ return localStorage.getItem(key) || ""; }catch(_){ return ""; }
  }
  function safeLocalSet(key,value){
    try{ localStorage.setItem(key,value); return true; }catch(_){ return false; }
  }
  function safeLocalRemove(key){
    try{ localStorage.removeItem(key); return true; }catch(_){ return false; }
  }
  const signedSession = typeof window!=="undefined" && window.KK_ADMIN_SIGNED_SESSION===true;
  const state = {
    pin: safeSessionGet("kk_admin_pin") || (signedSession ? "__SESSION__" : ""),
    data: null, loading: false, posterWarning: "", selectedCustomerKey: "", editBookingId: "",
    actionFilter: "all", actionSearch: "", reportRange: "all", reportStart: "", reportEnd: "",
    reportStatusMode: "active_revenue", systemHealth: null, pricingEventFilter: "", pricingSearch: "",
    pricingScope: "selected", rentalAnalytics: null, rentalAnalyticsError: "", rentalAnalyticsLoading: false,
    actionLimit:60, eventLimit:50, bookingLimit:50, pricingLimit:120,
    eventControlLimit:30, eventControlFilter:"needs_action", eventControlSearch:"",
    eventControlMonth:safeSessionGet("kk_admin_event_control_month") || "", eventControlSort:"date_asc",
    eventControlSelectedOnly:false, eventControlSelected:new Set(), lastUndo:null, mutationAction:""
  };
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
  function showAdminClientRecovery(id,kind){
    const box=$("#adminClientRecovery");
    if(!box) return;
    const title=$("#adminClientRecoveryTitle");
    const detail=$("#adminClientRecoveryDetail");
    if(title) title.textContent=(kind==="async" ? "Admin async error " : "Admin client error ")+String(id||"");
    if(detail) detail.textContent="Session ยังอยู่ได้ แต่ UI บางส่วนอาจทำงานไม่ครบ กดลองโหลดข้อมูลใหม่ก่อน Refresh ทั้งหน้า";
    box.classList.remove("hidden");
  }
  function hideAdminClientRecovery(){
    const box=$("#adminClientRecovery");
    if(box) box.classList.add("hidden");
  }
  function rawHealthAttentionRows(){
    return (((state.data||{}).health)||[]).filter(r=>{
      const status=String(r.status||"").trim().toUpperCase();
      const check=String(r.check||"").trim();
      if(!["CHECK","WARN","FAIL"].includes(status)) return false;
      if(/^Source count/i.test(check)) return false;
      return true;
    });
  }
  function healthSeverity(rows){
    const statuses=(rows||[]).map(r=>String(r&&r.status||"").trim().toUpperCase());
    if(statuses.includes("FAIL")) return "FAIL";
    if(statuses.includes("WARN")) return "WARN";
    return "CHECK";
  }
  function currentRentablePhoneCount(){
    return (((state.data||{}).assets)||[]).filter(a=>{
      const type=String(a&&a.asset_type||"").trim().toLowerCase();
      const status=String(a&&a.status||"").trim().toLowerCase();
      if(type!=="phone" || status==="inactive") return false;
      if(a&&a.rentable===false) return false;
      if(String(a&&a.rentable_setting||"").trim() && !["1","true","yes","on"].includes(String(a.rentable_setting).trim().toLowerCase())) return false;
      return ["available","ready"].includes(status) || a&&a.rentable===true;
    }).length;
  }
  function healthTriageRows(){
    const raw=rawHealthAttentionRows();
    const used=new Set();
    const out=[];
    const normalized=r=>String(r&&r.check||"").trim().toLowerCase();
    const timing=raw.filter(r=>{
      const c=normalized(r);
      return c==="spreadsheet timezone" || c==="atomic reservation timing readiness";
    });
    if(timing.length){
      timing.forEach(r=>used.add(r));
      const sheet=timing.find(r=>normalized(r)==="spreadsheet timezone");
      const zone=String(sheet&&sheet.detail||sheet&&sheet.count||"unknown").trim()||"unknown";
      out.push({
        key:"apps_script_timing_authority",
        check:"Apps Script timing verification",
        title:"Apps Script timing verification",
        status:healthSeverity(timing),
        gate:"EXTERNAL_AUTH",
        detail:`Spreadsheet timezone = ${zone} · Atomic timing รอหลักฐานจาก gate เดียวกัน`,
        action:"อ่าน Project Settings → Time zone และ Triggers ของ bound Apps Script แบบ authenticated ก่อน mutation; ห้ามเปลี่ยน timezone, reinstall trigger หรือ deploy repo Code.gs เพียงเพื่อทำให้ CHECK เขียว"
      });
    }
    raw.forEach(r=>{
      if(used.has(r)) return;
      const c=normalized(r);
      if(c==="accessory kit capacity shortfall"){
        const count=Math.max(0,Number(r&&r.count||r&&r.detail||0)||0);
        const phones=currentRentablePhoneCount();
        out.push({
          key:"accessory_kit_capacity",
          check:"Accessory kit capacity",
          title:"Accessory kit capacity",
          status:String(r.status||"CHECK").trim().toUpperCase(),
          gate:"PHYSICAL_STOCK",
          detail:`Health ระบุขาด ${count||1} ชุด${phones?" · rentable phones "+phones+" เครื่อง":""}`,
          action:"ตรวจ powerbank + phone_bag ของจริงก่อน ถ้ามีของจริงมากกว่าในชีตค่อยอัปเดต 06_Accessory_Stock; ถ้าไม่มี ห้ามเพิ่มตัวเลขเดาเพื่อปิด CHECK"
        });
        return;
      }
      out.push({
        key:"health_"+String(r.check||"check").toLowerCase().replace(/[^a-z0-9]+/g,"_"),
        check:r.check||"Health check",
        title:r.check||"Health check",
        status:String(r.status||"CHECK").trim().toUpperCase(),
        gate:"DATA_REVIEW",
        detail:String(r.detail||r.count||"ควรตรวจ"),
        action:String(r.note||"ตรวจหลักฐานต้นทางก่อนแก้ข้อมูล")
      });
    });
    return out;
  }
  function healthAttentionRows(){
    return healthTriageRows();
  }
  function renderHealthTriage(){
    const rows=healthTriageRows();
    const summary=$("#healthTriageSummary"), list=$("#healthTriageList");
    if(summary){
      const external=rows.filter(r=>r.gate==="EXTERNAL_AUTH").length;
      const physical=rows.filter(r=>r.gate==="PHYSICAL_STOCK").length;
      const fail=rows.filter(r=>r.status==="FAIL").length;
      summary.innerHTML=[
        [rows.length,"Root causes"],
        [external,"ต้องใช้ Auth"],
        [physical,"ต้องเช็กของจริง"],
        [fail,"FAIL"]
      ].map(s=>`<div class="card stat ${s[1]==="FAIL"&&s[0]?"danger":""}"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>`).join("");
    }
    if(list){
      if(!rows.length){
        list.innerHTML='<div class="health-triage-empty"><strong>ไม่มี CHECK/WARN/FAIL ที่ต้องไล่ต่อ</strong><span>Health snapshot ปัจจุบันไม่มี root cause ที่เปิดอยู่</span></div>';
      }else{
        list.innerHTML=rows.map(r=>`<article class="health-triage-item">
          <div class="health-triage-head">
            <span class="pill ${r.status==="FAIL"?"bad":"warn"}">${esc(r.status)}</span>
            <strong>${esc(r.title)}</strong>
            <span class="health-gate">${esc(r.gate)}</span>
          </div>
          <p>${esc(r.detail)}</p>
          <small>${esc(r.action)}</small>
        </article>`).join("");
      }
    }
  }
  function healthTriageClipboardText(){
    const rows=healthTriageRows();
    if(!rows.length) return "KK Health Root Cause Triage: no open CHECK/WARN/FAIL";
    return rows.map((r,i)=>`${i+1}. [${r.status}] ${r.title}\n   Gate: ${r.gate}\n   Evidence: ${r.detail}\n   Next: ${r.action}`).join("\n\n");
  }
  function renderOperationalAttention(){
    const box=$("#operationalAttention");
    if(!box) return;
    const rows=healthAttentionRows();
    if(!rows.length){ box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const title=$("#operationalAttentionTitle");
    if(title) title.textContent=`มี ${rows.length} root cause ที่ควรตรวจ`;
    const items=$("#operationalAttentionItems");
    if(items){
      items.innerHTML=rows.slice(0,4).map(r=>`<span class="pill ${String(r.status||"").toUpperCase()==="FAIL"?"bad":"warn"}">${esc(r.title||r.check||"Check")}: ${esc(r.detail||"ควรตรวจ")}</span>`).join("");
      if(rows.length>4) items.innerHTML+=`<span class="pill">+${rows.length-4} รายการ</span>`;
    }
  }
  function setAdminUndo(label,undo){
    state.lastUndo=typeof undo==="function" ? {label:String(label||"ย้อนกลับการเปลี่ยนแปลง"),undo} : null;
    const bar=$("#adminUndoBar"), textEl=$("#adminUndoText");
    if(!bar) return;
    if(!state.lastUndo){ bar.classList.add("hidden"); return; }
    if(textEl) textEl.textContent=state.lastUndo.label;
    bar.classList.remove("hidden");
    clearTimeout(setAdminUndo.t);
    setAdminUndo.t=setTimeout(()=>{ state.lastUndo=null; bar.classList.add("hidden"); },20000);
  }
  async function runAdminUndo(){
    const item=state.lastUndo;
    if(!item || typeof item.undo!=="function") return;
    state.lastUndo=null;
    const bar=$("#adminUndoBar"); if(bar)bar.classList.add("hidden");
    const btn=$("#adminUndoBtn"); if(btn)setBusy(btn,true);
    try{ await item.undo(); await refresh(); showNotice("Undo สำเร็จ"); }
    catch(e){ showNotice("Undo ไม่สำเร็จ: "+e.message,"bad"); }
    finally{ if(btn)setBusy(btn,false); }
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
    const compact=safeLocalGet("kk_admin_compact_mode")==="1";
    document.body.classList.toggle("compact-mode", compact);
    const btn=$("#densityBtn");
    if(btn) btn.textContent=compact ? "Comfort" : "Compact";
  }
  function focusSmartSearch(){
    const activePanel=$(".tab-panel.active");
    const target=(activePanel && activePanel.querySelector('input[type="search"], #actionSearch')) || $("#eventsSearch") || $("#customerSearch");
    if(target){ target.focus(); target.select && target.select(); }
  }
  function dirtyForms(){
    return qsa('#appPanel form[data-dirty="1"]');
  }
  function dirtyFormsInActivePanel(){
    const panel=$(".tab-panel.active");
    return panel ? qsa('form[data-dirty="1"]',panel) : [];
  }
  function updateUnsavedBadge(){
    const badge=$("#unsavedBadge");
    if(!badge)return;
    const count=dirtyForms().length;
    badge.classList.toggle("hidden",count===0);
    badge.textContent=count ? `ยังไม่บันทึก ${count} ฟอร์ม` : "มีข้อมูลยังไม่บันทึก";
  }
  function markFormDirty(form){
    if(!form || form.id==="loginPanel")return;
    form.dataset.dirty="1";
    updateUnsavedBadge();
  }
  function markFormClean(form){
    if(!form)return;
    delete form.dataset.dirty;
    updateUnsavedBadge();
  }
  function confirmDiscardDirty(targetTab){
    const dirty=dirtyFormsInActivePanel();
    if(!dirty.length)return true;
    const target=String(targetTab||"").trim();
    const ok=window.confirm(`มีข้อมูลที่ยังไม่ได้บันทึก ${dirty.length} ฟอร์ม\n\nออกจากหน้านี้ไป ${target||"เมนูอื่น"} โดยไม่บันทึกใช่ไหม?`);
    if(ok) dirty.forEach(markFormClean);
    return ok;
  }
  function setupUnsavedGuards(){
    qsa("#appPanel form").forEach(form=>{
      if(form.dataset.unsavedBound==="1")return;
      form.dataset.unsavedBound="1";
      ["input","change"].forEach(type=>form.addEventListener(type,ev=>{
        if(ev.target && ["BUTTON"].includes(ev.target.tagName))return;
        markFormDirty(form);
      }));
      form.addEventListener("reset",()=>setTimeout(()=>markFormClean(form),0));
    });
    updateUnsavedBadge();
  }
  function adminSnapshotIsStale(){
    if(!snapshotState.goodAt)return true;
    return Date.now()-new Date(snapshotState.goodAt).getTime()>3*60*1000;
  }
  function commandSearchRows(query){
    const q=String(query||"").trim().toLocaleLowerCase("th-TH");
    if(!q || !state.data)return [];
    const out=[];
    ((state.data.events)||[]).forEach(e=>{
      const hay=[e.event_name,e.venue,e.event_id].join(" ").toLocaleLowerCase("th-TH");
      if(hay.includes(q)) out.push({kind:"event",title:e.event_name||e.event_id,sub:[fmtDate(e.event_date),e.venue].filter(Boolean).join(" · "),id:e.event_id});
    });
    ((state.data.bookings)||[]).forEach(b=>{
      const hay=[b.customer_name,b.customer_contact,b.customer_phone,b.event_name,b.event_id,b.row_number].join(" ").toLocaleLowerCase("th-TH");
      if(hay.includes(q)) out.push({kind:"booking",title:`${b.customer_name||"Booking"} · ${b.event_name||b.event_id||""}`,sub:`Booking ${b.booking_id||b.row_number||"-"} · ${bookingLifecycleLabel(b.booking_status)}`,id:b.booking_id||b.row_number});
    });
    ((state.data.customer_history)||[]).forEach(c=>{
      const hay=[c.customer_name,c.customer_contact,c.customer_phone,c.last_event_name].join(" ").toLocaleLowerCase("th-TH");
      if(hay.includes(q)) out.push({kind:"customer",title:c.customer_name||c.customer_key||"ลูกค้า",sub:[c.customer_contact,c.customer_phone,c.last_event_name].filter(Boolean).join(" · "),id:c.customer_key});
    });
    return out.slice(0,14);
  }
  function renderCommandResults(){
    const box=$("#globalAdminSearchResults"), input=$("#globalAdminSearch");
    if(!box||!input)return;
    const rows=commandSearchRows(input.value);
    if(!String(input.value||"").trim()){box.innerHTML='<div class="command-empty">พิมพ์ชื่องาน ลูกค้า เบอร์ หรือ Event ID</div>';return;}
    if(!rows.length){box.innerHTML='<div class="command-empty">ไม่พบรายการที่ตรงกัน</div>';return;}
    box.innerHTML=rows.map(r=>`<button class="command-result" type="button" data-command-kind="${esc(r.kind)}" data-command-id="${esc(r.id)}"><strong>${esc(r.title)}</strong><span>${esc(r.sub||"")}</span><em>${esc(r.kind==="event"?"EVENT":r.kind==="booking"?"BOOKING":"CUSTOMER")}</em></button>`).join("");
  }
  function openCommandPalette(){
    const overlay=$("#commandPalette");
    if(!overlay)return focusSmartSearch();
    overlay.classList.remove("hidden");
    const input=$("#globalAdminSearch");
    if(input){input.value="";renderCommandResults();setTimeout(()=>input.focus(),0);}
  }
  function closeCommandPalette(){
    const overlay=$("#commandPalette"); if(overlay)overlay.classList.add("hidden");
  }
  function activeTabId(){
    const nav=$(".nav[data-tab].active");
    return nav ? String(nav.dataset.tab||"overview") : "overview";
  }
  function activateTab(tab,{scroll=false,writeHash=true,force=false}={}){
    const id=String(tab||"overview").replace(/^#/,"");
    const nav=$(`.nav[data-tab="${id}"]`);
    const panel=$("#tab-"+id);
    if(!nav || !panel) return false;
    if(!force && activeTabId()!==id && !confirmDiscardDirty(nav.textContent||id)) return false;
    qsa(".nav[data-tab]").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-pressed","false"); });
    nav.classList.add("active"); nav.setAttribute("aria-pressed","true");
    qsa(".tab-panel").forEach(p=>p.classList.remove("active"));
    panel.classList.add("active");
    if(writeHash){
      try{ history.replaceState(null,"",location.pathname+location.search+"#"+id); }catch(_){}
    }
    if(scroll) window.scrollTo({top:0,behavior:"smooth"});
    return true;
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
    qsa('input[type="checkbox"]',form).forEach(i=>out[i.name]=i.checked);
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
  function editBookingDateSortValue(b){
    const t=dateValue(b && b.event_date);
    return t || Number.MAX_SAFE_INTEGER;
  }
  function compareEditBookingsByEventDate(a,b){
    return (editBookingDateSortValue(a)-editBookingDateSortValue(b)) ||
      textValue(a && (a.event_name||a.event_id)).localeCompare(textValue(b && (b.event_name||b.event_id)),"th") ||
      textValue(a && a.customer_name).localeCompare(textValue(b && b.customer_name),"th") ||
      (Number(a && a.row_number || Number.MAX_SAFE_INTEGER)-Number(b && b.row_number || Number.MAX_SAFE_INTEGER));
  }
  function sortedEditableBookings(bookings){
    return (bookings||[]).slice().sort(compareEditBookingsByEventDate);
  }
  function editBookingMonthKey(v){
    const d=parseLocalDate(v);
    if(!d) return "unknown";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function editBookingMonthLabel(v){
    const d=parseLocalDate(v);
    if(!d) return "ไม่ระบุวันที่";
    return d.toLocaleDateString("th-TH",{month:"long",year:"numeric"});
  }
  function renderEditBookingOptions(rows){
    let html='<option value="">เลือก Booking ที่ยังต้องแก้ / ยกเลิก</option>';
    let openGroup="";
    (rows||[]).forEach(b=>{
      const key=editBookingMonthKey(b.event_date);
      if(key!==openGroup){
        if(openGroup) html+="</optgroup>";
        html+=`<optgroup label="${esc(editBookingMonthLabel(b.event_date))}">`;
        openGroup=key;
      }
      html+=opt(b.row_number, bookingLabel(b));
    });
    if(openGroup) html+="</optgroup>";
    return html;
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
      if(['picked_up','returned','uploaded'].includes(st) && isUnpaidPayment(b.payment_status)){
        pushBooking(b,{type:"payment", priority:1, task:"ตรวจยอดรับตอนส่งเครื่อง", risk_flag:true});
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
  function findBookingById(bookingId){
    const id=String(bookingId||'').trim();
    return ((state.data||{}).bookings||[]).find(b=>String(b.booking_id||'').trim()===id) || null;
  }
  function findBookingByIdentity(identity){
    const value=String(identity||'').trim();
    return findBookingById(value) || findBookingByRow(value);
  }
  function bookingMutationIdentity(b,rowNumber){
    const bookingId=String(b&&b.booking_id||"").trim();
    const row=String(rowNumber||b&&b.row_number||"").trim();
    // Never send a GViz-derived row hint alongside a stable booking_id.
    // Legacy Apps Script versions prioritize row_number when both are present.
    if(bookingId) return {booking_id:bookingId};
    return row ? {row_number:row} : {};
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
    const reportableStatuses=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded','completed']);
    const reportable=rows.filter(b=>reportableStatuses.has(String(b.booking_status||'').toLowerCase()));
    const paid=reportable.filter(b=>String(b.payment_status||'').toLowerCase()==='paid');
    const unpaidActive=active.filter(b=>String(b.booking_status||'').toLowerCase()==='picked_up' && isUnpaidPayment(b.payment_status));
    const upcoming=rows.filter(b=>{ const d=daysFromToday(b.event_date); return d!==null && d>=0 && activeStatuses.includes(String(b.booking_status||'').toLowerCase()); });
    const missingContact=rows.filter(b=>!String(b.customer_phone||'').trim() && !String(b.customer_contact||'').trim());
    const missingPickup=upcoming.filter(b=>!String(b.pickup_time||'').trim());
    const missingAsset=upcoming.filter(b=>!String(b.phone_asset_id||'').trim() && /phone/i.test(String(b.package_type||'')));
    const totalRevenue=reportable.reduce((sum,b)=>sum+toNum(b.amount_received),0);
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
    if(type==='payment') return `สวัสดีค่ะ ${name} ยืนยันชำระค่าเช่างาน ${event} วันที่ ${date} โดยชำระเต็มจำนวนตอนรับเครื่องตามนัดนะคะ ร้านไม่เก็บมัดจำค่ะ`;
    if(type==='pickup') return `สวัสดีค่ะ ${name} ยืนยันนัดรับเครื่องสำหรับงาน ${event} วันที่ ${date} เวลา ${pickup} นะคะ`;
    if(type==='return') return `สวัสดีค่ะ ${name} หลังจบงาน ${event} รบกวนคืนเครื่องตามจุดนัดหมาย และรอแอดมินตรวจเครื่อง/เลนส์ก่อนปิดงานนะคะ`;
    if(type==='upload') return `สวัสดีค่ะ ${name} แอดมินกำลังอัปโหลดไฟล์จากงาน ${event} วันที่ ${date} ให้นะคะ หากเสร็จแล้วจะส่งลิงก์ Google Drive ให้ค่ะ`;
    if(type==='close') return `สวัสดีค่ะ ${name} แอดมินส่งลิงก์ไฟล์งาน ${event} เรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ`;
    if(type==='prep') return `สวัสดีค่ะ ${name} แอดมินขอยืนยัน booking งาน ${event} วันที่ ${date} เวลารับ ${pickup} นะคะ`;
    return `สวัสดีค่ะ ${name} ขอสรุป booking งาน ${event} วันที่ ${date} เวลารับ ${pickup} ค่ะ`;
  }
  function openBookingEdit(identity){
    const target=findBookingByIdentity(identity);
    state.editBookingId=target ? String(target.booking_id||"").trim() : "";
    const nav=$('.nav[data-tab="edit-booking"]');
    if(nav) nav.click();
    setTimeout(()=>{
      const form=$('#bookingEditForm');
      if(!form || !form.elements.row_number) return;
      form.elements.row_number.value=target ? String(target.row_number||"") : "";
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
    if(['picked_up','returned','uploaded'].includes(st) && isUnpaidPayment(r.payment_status)) buttons.push(`<button class="mini-btn warn-soft" type="button" data-edit-booking-row="${esc(r.row_number)}">ตรวจยอดรับเงินจริง</button>`);
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
      [money(analytics.total_revenue),"มูลค่าคิวที่นับในรายงาน"],
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
        [m.reportable_bookings??m.non_cancelled_bookings??0,"คิวที่นับในรายงาน"],
        [m.completed_bookings||0,"Completed"],
        [m.active_bookings||0,"Active"],
        [m.repeat_customers||0,"ลูกค้าเช่าซ้ำ"],
        [Number(m.avg_bookings_per_customer||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}),"เฉลี่ยครั้ง / ลูกค้า"],
        [money(m.actual_revenue||0)+"฿","รายรับจริง · งานปิดแล้ว"],
        [money(m.future_revenue||0)+"฿","รายรับในอนาคต · Booking"],
        [money(m.forecast_revenue||0)+"฿","คาดการณ์รายรับรวม"],
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
      {label:"คาดการณ์รวม",render:r=>esc(money(r.forecast_revenue??r.amount_received??0))+"฿"}
    ],(d.top_events||[]).slice(0,15));
    table($("#rentalOrganizerTable"),[
      {label:"ค่าย / สังกัดศิลปิน",render:r=>`<strong>${esc(r.affiliation||'-')}</strong><br><small>${esc(r.mapping_summary||'')}</small>`},
      {label:"ลูกค้า",render:r=>esc(r.customers||0)},
      {label:"Booking",render:r=>esc(r.bookings||0)},
      {label:"งาน",render:r=>esc(r.events||0)},
      {label:"คาดการณ์รวม",render:r=>esc(money(r.forecast_revenue??r.amount_received??0))+"฿"}
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
  function packageVisibilityState(eventId){
    const id=String(eventId||'').trim();
    if(!id) return {kind:"none",total:0,hidden:0,visible:0};
    const rows=webPackagesForEvent(id);
    if(!rows.length) return {kind:"unknown",total:0,hidden:0,visible:0};
    const hidden=rows.filter(p=>{
      const st=String(p&&p.package_status||"").toLowerCase().trim();
      return st==="hidden" || st==="hide";
    }).length;
    const total=rows.length;
    const visible=total-hidden;
    return {
      kind:hidden===total ? "hidden" : (hidden===0 ? "visible" : "mixed"),
      total,
      hidden,
      visible
    };
  }
  function packageVisibilityLabel(stateInfo){
    const s=stateInfo||{kind:"unknown",total:0,hidden:0,visible:0};
    if(s.kind==="hidden") return {tone:"ok",icon:"🟢",text:`ซ่อนแล้วทุกแพ็กเกจ · ${s.hidden}/${s.total}`};
    if(s.kind==="mixed") return {tone:"warn",icon:"🟡",text:`ซ่อนบางส่วน · ${s.hidden}/${s.total}`};
    if(s.kind==="visible") return {tone:"bad",icon:"🔴",text:`ยังมีแพ็กเกจแสดง · ${s.visible}/${s.total}`};
    if(s.kind==="none") return {tone:"",icon:"⚪",text:"เลือกงานก่อน"};
    return {tone:"",icon:"⚪",text:"ยังไม่มีข้อมูล Web Package"};
  }
  function renderEventPackageVisibilityStatus(eventId){
    const box=$("#eventPackageVisibilityStatus");
    const form=$("#eventPriceOverrideForm");
    if(!box || !form) return;
    const info=packageVisibilityState(eventId);
    const label=packageVisibilityLabel(info);
    box.innerHTML=`<span class="pill ${label.tone}">${label.icon} ${esc(label.text)}</span><small>${
      info.kind==="hidden" ? "กดซ่อนซ้ำไม่ได้แล้ว · เปิดกลับได้ด้วยปุ่มเปิดทุกแพ็กเกจ" :
      info.kind==="mixed" ? `ยังเหลือแพ็กเกจแสดงอยู่ ${info.visible} รายการ` :
      info.kind==="visible" ? "ยังไม่ได้ซ่อนแพ็กเกจของงานนี้" :
      "ระบบจะเช็กจาก 09_Web_Packages หลังเลือกงาน"
    }</small>`;
    const hideBtn=form.querySelector('[data-bulk-event-visibility="hide"]');
    const showBtn=form.querySelector('[data-bulk-event-visibility="show"]');
    const inheritBtn=form.querySelector('[data-bulk-event-visibility="inherit"]');
    if(hideBtn){
      hideBtn.disabled=info.kind==="none" || info.kind==="hidden";
      hideBtn.textContent=info.kind==="hidden" ? "ซ่อนแล้ว ✓" : "ซ่อนทุกแพ็กเกจ";
    }
    if(showBtn){
      showBtn.disabled=info.kind==="none" || info.kind==="visible";
      showBtn.textContent=info.kind==="visible" ? "เปิดอยู่แล้ว ✓" : "เปิดทุกแพ็กเกจ";
    }
    if(inheritBtn) inheritBtn.disabled=info.kind==="none";
  }
  function eventVisibilityPayload(eventId,nextActive){
    const payload={event_id:String(eventId||'').trim(),active_on_web:nextActive===true};
    if(nextActive===true) payload.visibility_owner_intent='explicit_owner_reopen';
    return payload;
  }
  function renderEventVisibilityControl(eventId){
    const form=$("#eventPriceOverrideForm");
    const btn=$("#eventVisibilityToggleBtn");
    if(!form || !btn) return;
    const event=findEventById(eventId);
    if(!event){
      btn.disabled=true;
      btn.textContent="เลือกงานก่อน";
      btn.className="btn danger-soft";
      return;
    }
    const hidden=event.active_on_web===false;
    btn.disabled=false;
    btn.textContent=hidden ? "เปิดงานบนหน้าบ้าน" : "ซ่อนงานจากหน้าบ้าน";
    btn.className=hidden ? "btn secondary" : "btn danger-soft";
    btn.dataset.nextActive=hidden ? "true" : "false";
  }
  function webReadyForEvent(eventId){
    const id=String(eventId||"").trim();
    return (((state.data||{}).web_ready)||[]).find(r=>String(r.event_id||"").trim()===id) || null;
  }
  function eventMonthKey(v){
    const d=parseLocalDate(v);
    if(!d) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function eventMonthLabel(key){
    if(key==="all") return "ทุกเดือน";
    const m=String(key||"").match(/^(\d{4})-(\d{2})$/);
    if(!m) return key||"ทุกเดือน";
    return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString("th-TH",{month:"long",year:"numeric"});
  }
  function eventDayKey(v){
    const d=parseLocalDate(v);
    if(!d) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function eventDateDisplay(v){
    const d=parseLocalDate(v);
    if(!d) return fmtDate(v);
    return `${d.toLocaleDateString("th-TH",{day:"numeric",month:"short"})} · ${d.toLocaleDateString("th-TH",{weekday:"short"})}`;
  }
  function webReadyForEvent(eventId){
    const id=String(eventId||"").trim();
    return (((state.data||{}).web_ready)||[]).find(r=>String(r.event_id||"").trim()===id) || null;
  }
  function effectiveStorefrontState(event,web){
    if(!event) return {kind:"blocked_event",tone:"bad",icon:"⚠️",label:"ไม่พบ Event"};
    if(event.active_on_web===false) return {kind:"owner_hidden",tone:"bad",icon:"⛔",label:"เจ้าของซ่อน"};
    const health=String(event.data_health||"").trim().toUpperCase();
    if(health && health!=="OK") return {kind:"blocked_health",tone:"bad",icon:"⚠️",label:"Data Health"};
    if(!web) return {kind:"blocked_web",tone:"bad",icon:"⚠️",label:"ไม่มี Web Ready"};
    const poster=String(web.poster_image_url||"").trim();
    if(!poster) return {kind:"blocked_poster",tone:"bad",icon:"⚠️",label:"ไม่มี Poster"};
    const action=String(web.action_for_web||"").trim().toLowerCase();
    if(!action || action==="hide") return {kind:"blocked_web",tone:"bad",icon:"⚠️",label:action==="hide"?"Web Ready = hide":"Web Ready ไม่พร้อม"};
    return {kind:"visible",tone:"ok",icon:"👁",label:"แสดงจริง"};
  }
  function eventControlRows(){
    const events=((state.data||{}).events||[])
      .filter(e=>isEventOpen(e) && isTodayOrFuture(e.event_date))
      .slice()
      .sort(compareEventsByDateAsc);
    return events.map(event=>{
      const id=String(event.event_id||"").trim();
      const pkg=packageVisibilityState(id);
      const web=webReadyForEvent(id);
      const phones=toNum(web&&web.available_phone_count);
      const lenses=toNum(web&&web.available_lens_count);
      // Lens add-on stock does not reopen a fully booked phone rental date.
      const full=phones<=0 || String(web&&web.action_for_web||"").toLowerCase()==="show_full";
      const posterUrl=String(web&&web.poster_image_url||"").trim();
      const sourcePoster=String(event.poster_url||"").trim();
      const effective=effectiveStorefrontState(event,web);
      return {
        event_id:id,event_name:event.event_name||id,event_date:event.event_date,venue:event.venue||"",
        month_key:eventMonthKey(event.event_date),day_key:eventDayKey(event.event_date),
        event_hidden:event.active_on_web===false,effective,pkg,phones,lenses,full,
        poster_url:posterUrl,source_poster_url:sourcePoster,
        poster_state:posterUrl ? "web_ready" : (sourcePoster ? "source_only" : "missing"),
        needs_action:pkg.kind==="mixed" || pkg.kind==="unknown" || String(effective.kind).startsWith("blocked_")
      };
    });
  }
  function eventControlMonths(rows){
    const counts=new Map();
    (rows||[]).forEach(r=>{ if(r.month_key) counts.set(r.month_key,(counts.get(r.month_key)||0)+1); });
    return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  }
  function ensureEventControlMonth(rows){
    const months=eventControlMonths(rows).map(x=>x[0]);
    if(state.eventControlMonth==="all") return months;
    if(state.eventControlMonth && months.includes(state.eventControlMonth)) return months;
    const current=eventMonthKey(startOfToday());
    state.eventControlMonth=months.includes(current) ? current : (months[0]||"all");
    safeSessionSet("kk_admin_event_control_month",state.eventControlMonth);
    return months;
  }
  function syncEventControlMonthSelect(allRows){
    const sel=$("#eventControlMonth");
    if(!sel) return;
    const months=ensureEventControlMonth(allRows);
    const counts=new Map(eventControlMonths(allRows));
    sel.innerHTML='<option value="all">ทุกเดือน ('+allRows.length+')</option>'+
      months.map(key=>opt(key,`${eventMonthLabel(key)} (${counts.get(key)||0})`)).join("");
    sel.value=state.eventControlMonth||"all";
  }
  function scopedEventControlRows(){
    const all=eventControlRows();
    ensureEventControlMonth(all);
    const q=String(state.eventControlSearch||"").trim().toLocaleLowerCase("th-TH");
    return all.filter(r=>{
      if(state.eventControlMonth && state.eventControlMonth!=="all" && r.month_key!==state.eventControlMonth) return false;
      if(q && ![r.event_name,r.venue,r.event_id].join(" ").toLocaleLowerCase("th-TH").includes(q)) return false;
      return true;
    });
  }
  function eventControlAttentionRank(r){
    if(String(r.effective&&r.effective.kind||"").startsWith("blocked_")) return 0;
    if(r.pkg.kind==="unknown") return 1;
    if(r.pkg.kind==="mixed") return 2;
    if(r.pkg.kind==="visible") return 3;
    return 4;
  }
  function filteredEventControlRows(){
    const filter=state.eventControlFilter||"needs_action";
    let rows=scopedEventControlRows().filter(r=>{
      if(filter==="all") return true;
      if(filter==="all_hidden") return r.pkg.kind==="hidden";
      if(filter==="partial") return r.pkg.kind==="mixed";
      if(filter==="visible") return r.pkg.kind==="visible";
      if(filter==="event_hidden") return r.effective.kind!=="visible";
      if(filter==="full") return r.full;
      return r.needs_action;
    });
    if(state.eventControlSelectedOnly) rows=rows.filter(r=>state.eventControlSelected.has(r.event_id));
    const sort=state.eventControlSort||"date_asc";
    rows=rows.slice().sort((a,b)=>{
      if(sort==="date_desc") return compareEventsByDateAsc(b,a);
      if(sort==="package_attention") return eventControlAttentionRank(a)-eventControlAttentionRank(b) || compareEventsByDateAsc(a,b);
      return compareEventsByDateAsc(a,b);
    });
    return rows;
  }
  function eventControlStatusPill(r){
    if(r.pkg.kind==="hidden") return '<span class="pill ok">🟢 ซ่อนครบ '+esc(r.pkg.hidden)+'/'+esc(r.pkg.total)+'</span>';
    if(r.pkg.kind==="mixed") return '<span class="pill warn">🟡 ซ่อน '+esc(r.pkg.hidden)+'/'+esc(r.pkg.total)+'</span>';
    if(r.pkg.kind==="visible") return '<span class="pill bad">🔴 ยังแสดง '+esc(r.pkg.visible)+'/'+esc(r.pkg.total)+'</span>';
    return '<span class="pill">⚪ ไม่มี Web Package</span>';
  }
  function storefrontStatusPill(r){
    const e=r.effective||{tone:"bad",icon:"⚠️",label:"ไม่ทราบสถานะ"};
    return `<span class="pill ${esc(e.tone)}">${esc(e.icon)} ${esc(e.label)}</span>`;
  }
  function posterStatusPill(r){
    if(r.poster_state==="web_ready") return '<span class="pill ok">มี URL</span>';
    if(r.poster_state==="source_only") return '<span class="pill warn">ยังไม่เข้า Web Ready</span>';
    return '<span class="pill bad">ขาด URL</span>';
  }
  function eventControlFilterLabel(){
    const sel=$("#eventControlFilter");
    const option=sel&&sel.options&&sel.selectedIndex>=0 ? sel.options[sel.selectedIndex] : null;
    return option ? option.textContent : (state.eventControlFilter||"ทั้งหมด");
  }
  function clearEventControlSelection({render=true}={}){
    state.eventControlSelected.clear();
    state.eventControlSelectedOnly=false;
    if(render) renderEventControlCenter();
  }
  function renderEventControlCenter(){
    const tableEl=$("#eventControlTable");
    if(!tableEl || !state.data) return;
    const all=eventControlRows();
    syncEventControlMonthSelect(all);
    const filterSelect=$("#eventControlFilter"); if(filterSelect) filterSelect.value=state.eventControlFilter||"needs_action";
    const sortSelect=$("#eventControlSort"); if(sortSelect) sortSelect.value=state.eventControlSort||"date_asc";
    const scoped=scopedEventControlRows();
    const rows=filteredEventControlRows();
    const shownRaw=rows.slice(0,state.eventControlLimit);
    const shown=shownRaw.map((r,i)=>{
      const prev=i>0 ? shownRaw[i-1] : null;
      return Object.assign({},r,{__rowClass:!prev || prev.day_key!==r.day_key ? "event-date-group-start" : ""});
    });
    const stats=$("#eventControlStats");
    if(stats){
      const hidden=scoped.filter(r=>r.pkg.kind==="hidden").length;
      const partial=scoped.filter(r=>r.pkg.kind==="mixed").length;
      const visible=scoped.filter(r=>r.pkg.kind==="visible").length;
      const cardsHidden=scoped.filter(r=>r.effective.kind!=="visible").length;
      const items=[
        ["all_hidden",hidden,"🟢 Package ซ่อนครบ"],
        ["partial",partial,"🟡 ซ่อนบางส่วน"],
        ["visible",visible,"🔴 ยังแสดง"],
        ["event_hidden",cardsHidden,"⛔ การ์ดไม่แสดง"]
      ];
      stats.innerHTML=items.map(s=>`<button type="button" class="card stat event-control-stat ${state.eventControlFilter===s[0]?"active":""}" data-control-stat-filter="${esc(s[0])}"><strong>${esc(s[1])}</strong><span>${esc(s[2])}</span></button>`).join("");
    }
    const monthText=eventMonthLabel(state.eventControlMonth||"all");
    const summary=$("#eventControlSummary");
    if(summary){
      const searchText=String(state.eventControlSearch||"").trim();
      summary.textContent=`${monthText} · ${eventControlFilterLabel()}${searchText?" · ค้นหา “"+searchText+"”":""} · ${rows.length} งาน`;
    }
    if($("#eventControlCount")) $("#eventControlCount").textContent=`${Math.min(shown.length,rows.length)} / ${rows.length} งาน`;
    const selectedCount=state.eventControlSelected.size;
    if($("#eventControlSelectedCount")) $("#eventControlSelectedCount").textContent=`เลือก ${selectedCount} / 12 งาน`;
    const sticky=$("#eventControlStickyActions");
    if(sticky) sticky.classList.toggle("hidden",selectedCount===0);
    if($("#eventControlStickyCount")) $("#eventControlStickyCount").textContent=`เลือก ${selectedCount} / 12 งาน`;
    const selectedOnlyBtn=$("#eventControlSelectedOnly");
    if(selectedOnlyBtn){
      selectedOnlyBtn.disabled=selectedCount===0;
      selectedOnlyBtn.textContent=state.eventControlSelectedOnly ? "แสดงทั้งหมดใน Filter" : "ดูเฉพาะที่เลือก";
      selectedOnlyBtn.classList.toggle("active",state.eventControlSelectedOnly);
    }
    const clearBtn=$("#eventControlClearSelected");
    if(clearBtn) clearBtn.disabled=selectedCount===0;
    const selectVisible=$("#eventControlSelectVisible");
    if(selectVisible){
      const shownIds=shown.map(r=>r.event_id);
      const selectedShown=shownIds.filter(id=>state.eventControlSelected.has(id)).length;
      selectVisible.checked=shownIds.length>0 && selectedShown===shownIds.length;
      selectVisible.indeterminate=selectedShown>0 && selectedShown<shownIds.length;
      selectVisible.disabled=!shownIds.length;
    }
    table(tableEl,[
      {label:"เลือก",render:r=>`<input type="checkbox" data-control-select="${esc(r.event_id)}" ${state.eventControlSelected.has(r.event_id)?"checked":""} aria-label="เลือก ${esc(r.event_name)}" />`},
      {label:"วันที่",render:r=>`<strong>${esc(eventDateDisplay(r.event_date))}</strong>`},
      {label:"งาน",render:r=>`<strong>${esc(r.event_name)}</strong><br><small>${esc(r.venue||r.event_id)}</small>`},
      {label:"การ์ดจริง",render:r=>storefrontStatusPill(r)},
      {label:"Package",render:r=>eventControlStatusPill(r)},
      {label:"คิว",render:r=>r.full?'<span class="pill warn">เต็ม / Waitlist</span>':`<span class="pill ok">Phone ${esc(r.phones)} · Lens ${esc(r.lenses)}</span>`},
      {label:"Poster",render:r=>posterStatusPill(r)},
      {label:"Action",render:r=>{
        const pkgMode=r.pkg.kind==="hidden" ? "show" : "hide";
        const pkgLabel=r.pkg.kind==="hidden" ? "เปิด Package" : (r.pkg.kind==="mixed" ? "ซ่อนให้ครบ" : "ซ่อน Package");
        const preview=r.effective.kind==="visible"
          ? `<button class="mini-btn" type="button" data-control-preview-event="${esc(r.event_id)}">ดูหน้าเว็บ</button>`
          : `<button class="mini-btn" type="button" disabled title="${esc(r.effective.label)}">ดูหน้าเว็บ</button>`;
        return `<div class="inline-actions">
          <button class="mini-btn" type="button" data-control-open-override="${esc(r.event_id)}">แก้ราคา/Package</button>
          <button class="mini-btn" type="button" data-control-toggle-packages="${esc(r.event_id)}" data-mode="${pkgMode}">${esc(pkgLabel)}</button>
          <button class="mini-btn ${r.event_hidden?"":"warn-soft"}" type="button" data-control-toggle-event="${esc(r.event_id)}">${r.event_hidden?"เปิดการ์ด":"ซ่อนการ์ด"}</button>
          ${preview}
        </div>`;
      }}
    ],shown);
    const more=$("#eventControlLoadMoreBtn");
    if(more){ more.hidden=shown.length>=rows.length; more.textContent=`แสดงเพิ่ม (${Math.max(0,rows.length-shown.length)})`; }
  }
  function selectedEventControlIds(){
    return [...state.eventControlSelected].filter(id=>eventControlRows().some(r=>r.event_id===id));
  }
  function confirmBatchPreview({actionLabel,ids,skipped,rowsById,detail}){
    const dialog=$("#batchPreviewDialog");
    if(!dialog || typeof dialog.showModal!=="function"){
      return Promise.resolve(confirm(`${actionLabel} ${ids.length} งานใช่ไหม?\nข้าม ${skipped} งานที่อยู่สถานะนี้แล้ว\n\n${detail}`));
    }
    $("#batchPreviewTitle").textContent=`${actionLabel} · ${ids.length} งาน`;
    $("#batchPreviewImpact").textContent=detail;
    $("#batchPreviewSkipped").textContent=skipped ? `ข้าม ${skipped} งานที่อยู่สถานะเป้าหมายแล้ว` : "ไม่มีงานซ้ำที่ต้องข้าม";
    $("#batchPreviewList").innerHTML=ids.map(id=>{
      const r=rowsById.get(id)||{};
      return `<div class="batch-preview-item"><strong>${esc(r.event_name||id)}</strong><span>${esc(eventDateDisplay(r.event_date)||"")} · ${esc(r.venue||"")}</span></div>`;
    }).join("");
    $("#batchPreviewConfirm").textContent=`ยืนยัน ${ids.length} งาน`;
    return new Promise(resolve=>{
      const yes=$("#batchPreviewConfirm"), no=$("#batchPreviewCancel");
      const finish=value=>{yes.onclick=null;no.onclick=null;try{dialog.close();}catch(_){}resolve(value);};
      yes.onclick=()=>finish(true); no.onclick=()=>finish(false);
      dialog.oncancel=ev=>{ev.preventDefault();finish(false);};
      dialog.showModal();
    });
  }
  async function runEventControlBatch(kind){
    const selected=selectedEventControlIds();
    if(!selected.length) return showNotice("เลือกงานก่อนทำ Batch action","warn");
    const rowsById=new Map(eventControlRows().map(r=>[r.event_id,r]));
    const shouldChange=id=>{
      const r=rowsById.get(id); if(!r)return false;
      if(kind==="hide_packages") return r.pkg.kind!=="hidden" && r.pkg.kind!=="unknown";
      if(kind==="show_packages") return r.pkg.kind!=="visible" && r.pkg.kind!=="unknown";
      if(kind==="hide_events") return !r.event_hidden;
      if(kind==="show_events") return r.event_hidden;
      return false;
    };
    const ids=selected.filter(shouldChange);
    const skipped=selected.length-ids.length;
    if(!ids.length) return showNotice("งานที่เลือกอยู่ในสถานะนี้แล้วทั้งหมด — ไม่ส่งคำสั่งซ้ำ","ok");
    if(ids.length>12) return showNotice("เพื่อความปลอดภัย Batch ที่ต้องเปลี่ยนจริงได้ครั้งละไม่เกิน 12 งาน กรุณาแบ่งทำเป็นชุด","warn");
    const isPackage=kind==="hide_packages" || kind==="show_packages";
    const actionLabel=kind==="hide_packages"?"ซ่อน Package":kind==="show_packages"?"เปิด Package":kind==="hide_events"?"ซ่อนการ์ดงาน":"เปิดการ์ดงาน";
    const detail=isPackage
      ? (kind==="hide_packages"?"Package จะหาย แต่การ์ดงานยังอยู่เพื่อรับคิวหลุด":"เปิด Package กลับตามสถานะ stock ปัจจุบัน")
      : (kind==="hide_events"?"การ์ดงานจะหายจากหน้าบ้านทั้งหมด":"การ์ดงานจะกลับมา โดยสถานะ Package คงเดิม");
    if(!(await confirmBatchPreview({actionLabel,ids,skipped,rowsById,detail}))) return;
    const before=ids.map(id=>({id,row:rowsById.get(id)}));
    let ok=0;
    try{
      for(const id of ids){
        if(isPackage) await api("bulkSetEventPackageVisibility",{event_id:id,mode:kind==="hide_packages"?"hide":"show"});
        else await api("updateEvent",eventVisibilityPayload(id,kind==="show_events"));
        ok++;
      }
      clearEventControlSelection({render:false});
      await refresh();
      activateTab("packages",{scroll:false});
      showNotice(`${actionLabel}สำเร็จ ${ok}/${ids.length} งาน · ข้าม ${skipped} งานซ้ำ`);
      if(!isPackage){
        setAdminUndo(`ทำ ${actionLabel} ${ids.length} งานแล้ว · Undo ได้ 20 วินาที`,async()=>{
          for(const item of before) await api("updateEvent",eventVisibilityPayload(item.id,!item.row.event_hidden));
        });
      }
    }catch(e){
      await refresh().catch(()=>{});
      activateTab("packages",{scroll:false});
      showNotice(`${actionLabel}สำเร็จ ${ok}/${ids.length} ก่อนหยุด: ${e.message}`,"bad");
    }
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
      hint.textContent=`ราคาอ้างอิง ${money(info.price)}฿ (${info.source}) · ร้านไม่เก็บมัดจำ ยอดรับแล้วเป็น 0 จนกว่าจะส่งเครื่องและรับเงินจริง`;
      hint.classList.remove("warn");
    }else{
      hint.textContent="เลือกแพ็กเกจเพื่อดูราคาอ้างอิง · ยอดรับแล้วเป็น 0 เมื่อจอง (รับเงินตอนส่งเครื่อง)";
      hint.classList.add("warn");
    }
  }

  function autofillBookingAmountFromPackage(){
    const form=$("#bookingForm");
    if(!form || !form.elements.amount_received) return;
    const info=bookingSelectedPackagePrice();
    updateBookingAmountHint(info);
    // The package price is a quote, never a receipt. Core booking column X
    // maintains the authoritative quoted package price independently.
    form.elements.amount_received.value="0";
    form.elements.amount_received.dataset.autoPrice="";
    form.elements.amount_received.dataset.autoPriceSource="no-deposit";
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
    renderEventPackageVisibilityStatus(eventId);
    renderEventVisibilityControl(eventId);
  }

  function activeMasterPackages(){
    const d=state.data||{};
    return (d.packages||[])
      .filter(p=>String(p.template_id||"").trim() && p.active!==false)
      .slice()
      .sort((a,b)=>String(a.package_type||"").localeCompare(String(b.package_type||"")) || String(a.display_name||a.template_id).localeCompare(String(b.display_name||b.template_id),"th"));
  }
  function eventBulkOverrideState(o){
    const src=o||{};
    const val=k=>src[k]===undefined || src[k]===null ? "" : String(src[k]);
    return {
      override_price:val("override_price"),
      active_override:val("active_override"),
      override_note:val("override_note"),
      sort_order_override:val("sort_order_override"),
      use_case_override:val("use_case_override")
    };
  }
  function readEventBulkPriceRow(row){
    let initial={};
    try{ initial=JSON.parse(row.dataset.initialOverride||"{}")||{}; }catch(_){ initial={}; }
    const get=f=>{ const el=row.querySelector(`[data-field="${f}"]`); return el ? String(el.value||"").trim() : ""; };
    return {
      template_id:String(row.dataset.templateId||"").trim(),
      override_price:get("override_price"),
      active_override:get("active_override"),
      override_note:get("override_note"),
      sort_order_override:String(initial.sort_order_override||""),
      use_case_override:String(initial.use_case_override||"")
    };
  }
  function collectEventBulkPriceChanges(){
    return qsa("#bulkEventPriceOverrides .create-price-row").map(row=>{
      const current=readEventBulkPriceRow(row);
      let initial={};
      try{ initial=JSON.parse(row.dataset.initialOverride||"{}")||{}; }catch(_){ initial={}; }
      const changed=["override_price","active_override","override_note"].some(k=>String(current[k]||"")!==String(initial[k]||""));
      return changed ? current : null;
    }).filter(Boolean);
  }
  function updateEventBulkPriceUi(){
    const form=$("#eventPriceOverrideForm");
    const box=$("#bulkEventPriceOverrides");
    const summary=$("#bulkEventPriceSummary");
    const save=$("#saveBulkEventPrices");
    const reset=$("#resetBulkEventPrices");
    if(!form || !box) return;
    const eventId=String(form.elements.event_id && form.elements.event_id.value || "").trim();
    const rows=qsa("#bulkEventPriceOverrides .create-price-row");
    const changes=collectEventBulkPriceChanges();
    if(summary){
      summary.textContent=!eventId
        ? "เลือกงานก่อน แล้วแก้ราคาได้หลายแพ็กเกจในครั้งเดียว"
        : (!rows.length ? "งานนี้ยังไม่มีแพ็กเกจหลักที่เปิดใช้งาน" : `พร้อมแก้ ${rows.length} แพ็กเกจ · เปลี่ยนแปลง ${changes.length} รายการ`);
    }
    if(save){
      save.disabled=!eventId || changes.length===0;
      save.textContent=changes.length ? `บันทึกทั้งหมด (${changes.length})` : "บันทึกทั้งหมด";
    }
    if(reset) reset.disabled=!eventId || changes.length===0;
  }
  function renderEventBulkPriceEditor(eventId){
    const box=$("#bulkEventPriceOverrides");
    if(!box || !state.data) return;
    const id=String(eventId||"").trim();
    box.dataset.eventId=id;
    if(!id){
      box.innerHTML='<div class="empty-state compact-empty">เลือกงานก่อนเพื่อโหลดราคาเฉพาะงานของทุกแพ็กเกจ</div>';
      updateEventBulkPriceUi();
      return;
    }
    const rows=activeMasterPackages();
    if(!rows.length){
      box.innerHTML='<div class="empty-state compact-empty">ยังไม่มีแพ็กเกจหลักที่เปิดใช้งาน กรุณาเพิ่มแพ็กเกจก่อน</div>';
      updateEventBulkPriceUi();
      return;
    }
    box.innerHTML=rows.map(p=>{
      const tpl=String(p.template_id||"").trim();
      const label=p.display_name||tpl;
      const type=p.package_type||"package";
      const standard=money(p.standard_price||0);
      const current=eventBulkOverrideState(findOverride(id,tpl));
      const initial=esc(JSON.stringify(current));
      return `<div class="create-price-row compact" data-template-id="${esc(tpl)}" data-initial-override="${initial}">
        <div class="create-price-meta">
          <strong>${esc(label)}</strong>
          <small>${esc(type)} · ราคาหลัก ${standard}฿</small>
        </div>
        <label class="mini-field"><span>ราคาเฉพาะงาน</span><input data-field="override_price" type="number" min="0" step="1" value="${esc(current.override_price)}" placeholder="${esc(p.standard_price||'1290')}" /></label>
        <label class="mini-field"><span>สถานะ</span>
          <select data-field="active_override">
            <option value=""${current.active_override===""?" selected":""}>ใช้ค่าหลัก</option>
            <option value="true"${current.active_override==="true"?" selected":""}>เปิดขาย</option>
            <option value="false"${current.active_override==="false"?" selected":""}>ซ่อน</option>
          </select>
        </label>
        <label class="mini-field note-field"><span>Note</span><input data-field="override_note" value="${esc(current.override_note)}" placeholder="โปร/เงื่อนไข" /></label>
      </div>`;
    }).join("");
    qsa("#bulkEventPriceOverrides input, #bulkEventPriceOverrides select").forEach(el=>{
      el.addEventListener("input",updateEventBulkPriceUi);
      el.addEventListener("change",updateEventBulkPriceUi);
    });
    updateEventBulkPriceUi();
  }
  function restoreEventBulkPriceDraft(items){
    (items||[]).forEach(item=>{
      const row=qsa("#bulkEventPriceOverrides .create-price-row").find(r=>String(r.dataset.templateId||"")===String(item.template_id||""));
      if(!row) return;
      ["override_price","active_override","override_note"].forEach(k=>{
        const el=row.querySelector(`[data-field="${k}"]`);
        if(el) el.value=item[k]===undefined || item[k]===null ? "" : String(item[k]);
      });
    });
    updateEventBulkPriceUi();
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
    qsa("#createEventPriceOverrides input, #createEventPriceOverrides select").forEach(el=>{
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
    const changed=qsa("#createEventPriceOverrides .create-price-row").filter(row=>{
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
    qsa("#createEventPriceOverrides input, #createEventPriceOverrides select").forEach(el=>{ el.value=""; });
    updateCreateEventPriceUi();
  }
  function collectCreateEventPriceOverrides(){
    if(!eventPriceToggleEnabled()) return [];
    return qsa("#createEventPriceOverrides .create-price-row").map(row=>{
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
    // Edit Booking has its own deterministic operational order.
    // Do not reuse the report/table sorter: changing another Booking view must never reshuffle this selector.
    const rows=sortedEditableBookings((state.data.bookings||[]).filter(shouldShowInEditBooking));
    const currentRow=String(sel.value||"");
    const currentId=String(state.editBookingId||"").trim();
    sel.innerHTML=renderEditBookingOptions(rows);
    // Preserve the same booking across refreshes by stable booking_id. GViz row
    // numbers can shift when physical blank rows are added/removed.
    const preserved=currentId
      ? rows.find(b=>String(b.booking_id||"").trim()===currentId)
      : rows.find(b=>String(b.row_number||"")===currentRow);
    sel.value=preserved ? String(preserved.row_number||"") : "";
    const b=preserved || null;
    state.editBookingId=b ? String(b.booking_id||"").trim() : "";
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
    set("pickup_time", fmtPickupTime(b.pickup_time));
    set("phone_asset_id", b.phone_asset_id || "");
    set("lens_asset_id", b.lens_asset_id || "");
    set("booking_note", b.note || "");
  }

  function directPhase1ActionAvailable(action){
    const s=state.data && state.data.direct_writer_phase1_state;
    return !!(s && s.writer_ready && Array.isArray(s.configured_actions) && s.configured_actions.includes(String(action||"")));
  }

  function adminRequestId(){
    try{
      if(window.crypto && typeof window.crypto.randomUUID==="function") return window.crypto.randomUUID();
    }catch(_){}
    return "web-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
  }

  function writeAdmission(action){
    const direct=directPhase1ActionAvailable(action);
    if(globalThis.KKAdminWritePolicy && typeof globalThis.KKAdminWritePolicy.admission==="function"){
      return globalThis.KKAdminWritePolicy.admission(state.data,direct,action);
    }
    if(direct) return {allowed:true,mode:"direct"};
    if(!state.data || state.data.degraded_read_only!==true) return {allowed:true,mode:"verified"};
    return {allowed:false,mode:"blocked"};
  }

  function mutationOutcomeUncertain(err){
    const code=String(err&&err.code||"");
    if(err && (err.mutationOutcomeUncertain===true || err.mutationMayHaveCommitted===true)) return true;
    if(code==="UPSTREAM_TIMEOUT" || code==="UPSTREAM_ERROR") return true;
    return !!(err && err.name==="TypeError" && /fetch|network|load/i.test(String(err.message||"")));
  }

  async function reconcileUncertainBookingMutation(action,outbound,beforeSnapshot,originalError){
    if(!globalThis.KKAdminWritePolicy || typeof globalThis.KKAdminWritePolicy.verifyBookingMutation!=="function") throw originalError;
    if(action!=="createBooking" && action!=="updateBooking"){
      const err=new Error("คำสั่งถูกส่งไปแล้วแต่ไม่ได้รับผลยืนยันจาก write transport — ระบบจะไม่ retry อัตโนมัติ กรุณา Refresh และตรวจข้อมูลก่อนกดบันทึกซ้ำ");
      err.code="MUTATION_OUTCOME_UNCERTAIN";
      err.cause=originalError;
      throw err;
    }
    await new Promise(resolve=>setTimeout(resolve,1200));
    let snap;
    try{
      snap=await api("snapshot");
    }catch(readErr){
      const err=new Error("ส่งคำสั่งบันทึกแล้วแต่ผลตอบกลับไม่แน่ชัด และตรวจ readback ไม่สำเร็จ — ห้ามกดบันทึกซ้ำทันที กรุณา Refresh แล้วตรวจข้อมูลก่อน");
      err.code="MUTATION_OUTCOME_UNCERTAIN";
      err.cause=originalError;
      throw err;
    }
    const afterSnapshot=snap&&snap.data;
    const check=globalThis.KKAdminWritePolicy.verifyBookingMutation(action,outbound,{},beforeSnapshot,afterSnapshot);
    if(check.status==="committed"){
      const rows=(afterSnapshot&&afterSnapshot.bookings)||[];
      const row=(check.booking_id
        ? rows.find(b=>String(b.booking_id||"").trim()===String(check.booking_id||"").trim())
        : rows.find(b=>String(b.row_number||"")===String(check.row_number||"")))||{};
      return {
        ok:true,
        row_number:check.row_number||row.row_number||"",
        booking_id:check.booking_id||row.booking_id||"",
        phone_asset_id:row.phone_asset_id||"",
        lens_asset_id:row.lens_asset_id||"",
        mutation_reconciled:true,
        mutation_readback:check.reason||"committed"
      };
    }
    if(check.status==="ambiguous"){
      const err=new Error("ส่งคำสั่งบันทึกแล้วแต่พบข้อมูลใหม่มากกว่า 1 รายการที่ตรงกัน — ห้ามกดซ้ำ กรุณาตรวจ Booking ล่าสุดก่อน");
      err.code="MUTATION_OUTCOME_AMBIGUOUS";
      err.readback=check;
      throw err;
    }
    const err=new Error("คำสั่งบันทึกไม่ได้รับผลยืนยัน และตรวจ readback แล้วไม่พบการเปลี่ยนแปลงที่ตรงกัน กรุณา Refresh แล้วตรวจอีกครั้งก่อนกดซ้ำ");
    err.code="MUTATION_NOT_CONFIRMED";
    err.readback=check;
    throw err;
  }

  async function api(action, payload={}){
    const readOnlyActions=["snapshot","snapshotHealth","systemHealth","phase1Health"];
    const isMutation=!readOnlyActions.includes(action);
    if(isMutation && state.mutationAction){
      const err=new Error("มีคำสั่งกำลังบันทึกอยู่ ("+state.mutationAction+") กรุณารอให้เสร็จก่อนกดคำสั่งถัดไป");
      err.code="ADMIN_MUTATION_IN_FLIGHT";
      throw err;
    }
    if(isMutation) state.mutationAction=action;
    try{
      const admission=isMutation ? writeAdmission(action) : {allowed:true,mode:"read"};
      if(isMutation && !admission.allowed) throw new Error("ระบบเขียนถูกปิดเพราะพบปัญหา write transport แบบ deterministic/ยังไม่ผ่านการยืนยัน กรุณาแก้ System Guard ก่อนบันทึก");
      if(snapshotState.stale && isMutation) throw new Error("ข้อมูลเก่า: กรุณา Refresh ให้สำเร็จก่อนบันทึก");
      const beforeSnapshot=isMutation ? state.data : null;
      const outbound=Object.assign({action},payload);
      if(!readOnlyActions.includes(action) && !outbound.request_id) outbound.request_id=adminRequestId();
      const maxAttempts=action==="snapshot" ? 2 : 1;
      let lastError=null;
      for(let attempt=1; attempt<=maxAttempts; attempt++){
        try{
          const res=await fetch("/api/kk-admin",{
            method:"POST",
            headers:{"Content-Type":"application/json","X-Admin-Pin":state.pin},
            body:JSON.stringify(outbound)
          });
          const data=await res.json().catch(()=>({ok:false,error:"Invalid server response"}));
          if(!res.ok || (!data.ok && !(action==="systemHealth" && data.data && data.data.rows))){
            const err=new Error(data.error||"Request failed");
            err.code=data.error_code||"";
            err.httpStatus=res.status;
            err.upstreamStatus=Number(data.upstream_status||0);
            err.upstreamFailureClass=String(data.upstream_failure_class||"");
            err.retryable=data.retryable===true;
            err.mutationOutcomeUncertain=data.mutation_outcome_uncertain===true;
            err.mutationMayHaveCommitted=data.mutation_may_have_committed===true;
            err.action=data.action||action;
            throw err;
          }
          return data;
        }catch(err){
          lastError=err;
          if(isMutation && mutationOutcomeUncertain(err)){
            // Never retry a mutation automatically. The request may already have committed.
            // Booking writes get one direct-Sheet readback reconciliation instead.
            return reconcileUncertainBookingMutation(action,outbound,beforeSnapshot,err);
          }
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
    }finally{
      if(isMutation && state.mutationAction===action) state.mutationAction="";
    }
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
    const readerSnapshot=d.phase1_diagnostics?.fallback_mode===true;
    rows.push({check:"Version · Admin UI", status:"OK", detail:KK_ADMIN_UI_VERSION, note:"Line-by-line audited frontend/admin package"});
    rows.push({check:"Version · Vercel Proxy", status: proxyVersion===EXPECTED_PROXY_VERSION ? "OK" : "CHECK", detail:proxyVersion || "missing", note:"Expected "+EXPECTED_PROXY_VERSION});
    rows.push({check:"Version · Apps Script", status: !readerSnapshot && backendVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:readerSnapshot ? "ยังไม่ยืนยันจาก Apps Script" : backendVersion || "missing", note:"Expected "+EXPECTED_BACKEND_VERSION+". Verify the deployed source; never overwrite deployed 9_5_9 with repository 9_5_8"});
    rows.push({check:"Sheet ID · Frontend vs Apps Script", status: !readerSnapshot && sameSheet ? "OK" : "CHECK", detail:readerSnapshot ? "ยังไม่ยืนยันจาก Apps Script" : (frontendSheetId||"missing")+" / "+(spreadsheetId||"missing"), note:readerSnapshot ? "Snapshot reader identity does not independently verify Apps Script binding" : sameSheet ? "Same backend" : "GOOGLE_SHEET_ID may not match Apps Script spreadsheet"});
    if(readerSnapshot){
      rows.push({check:"Version · Snapshot Reader",status:"INFO",detail:backendVersion||"ยังไม่ยืนยัน",note:"Read-source version; not the deployed Apps Script revision"});
      rows.push({check:"Sheet ID · Read Source",status:sameSheet?"OK":"CHECK",detail:(frontendSheetId||"missing")+" / "+(spreadsheetId||"missing"),note:"Configured frontend and snapshot read-source binding only"});
    }
    if(d.phase1_diagnostics){
      const x=d.phase1_diagnostics;
      const folderKnown=typeof x.poster_folder_id_set==="boolean",logsKnown=typeof x.log_sheets_ready==="boolean",fallbackKnown=typeof x.direct_fallback_disabled==="boolean";
      rows.push({check:"ENV · KK_POSTER_FOLDER_ID", status:folderKnown && x.poster_folder_id_set ? "OK" : "CHECK", detail:folderKnown ? x.poster_folder_id_set ? "set" : "missing" : "ยังไม่ยืนยัน", note:folderKnown ? "Needed for Upload Poster" : "รอผลตรวจค่าจาก Apps Script; ไม่สรุปว่าโฟลเดอร์ขาด"});
      rows.push({check:"Log Sheets", status:logsKnown && x.log_sheets_ready ? "OK" : "CHECK", detail:logsKnown ? x.log_sheets_ready ? "15/16 logs ready" : "missing" : "ยังไม่ยืนยัน", note:logsKnown ? x.log_sheets_ready ? "15/16 logs ready" : "Run KK Admin > Setup/Repair Named Ranges" : "รอผลตรวจจาก Apps Script; ไม่สรุปว่า Log ขาด"});
      rows.push({check:"Read fallback", status:fallbackKnown && !x.direct_fallback_disabled ? "OK" : "CHECK", detail:fallbackKnown ? x.direct_fallback_disabled ? "disabled" : "emergency fallback available" : "ยังไม่ยืนยัน", note:fallbackKnown ? x.direct_fallback_disabled ? "Public website may go blank if /api/kk-data fails" : "API-first, but site can recover if Vercel ENV/API fails" : "รอผลตรวจการตั้งค่า fallback จาก Apps Script"});
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
    el.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+'</tr></thead><tbody>'+
      rows.map(r=>`<tr class="${esc(r&&r.__rowClass||"")}">`+cols.map(c=>`<td data-label="${esc(c.label)}">${c.render?c.render(r):esc(r[c.key]??"")}</td>`).join('')+'</tr>').join('')+'</tbody>';
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

  function bookingClosureGuardRows(data){
    const rows=[];
    const closure=data&&data.booking_closure_evidence_shadow;
    if(closure && closure.issues && closure.counts){
      const old=Number(closure.issues.historical_completed_missing_evidence||0);
      const quote=Number(closure.issues.confirmed_unpaid_with_amount_field||0);
      const missingQuote=Number(closure.issues.active_missing_package_price||0);
      const refunds=Number(closure.issues.cancelled_paid_refund_review||0);
      rows.push({label:"Booking · หลักฐานปิดงาน",status:old?"WARN":"OK",
        detail:old+" completed ยังไม่มีหลักฐานคืนเครื่อง/อัปโหลด/Drive ครบ",
        suggestion:old?"ตรวจหลักฐานจริงก่อน backfill; ห้ามแก้สถานะย้อนหลังอัตโนมัติ":""});
      if(quote)rows.push({label:"Booking · ยอดเสนอราคาเทียบยอดรับ",status:"WARN",
        detail:quote+" confirmed/unpaid มียอดในช่อง amount_received",
        suggestion:"ตรวจแยกราคาเสนอจากยอดรับเงินจริงก่อนส่งมอบเครื่อง"});
      if(missingQuote)rows.push({label:"Booking · ราคาจองยังไม่ครบ",status:"WARN",
        detail:missingQuote+" active booking ไม่มีราคาจองจาก Master คอลัมน์ X",
        suggestion:"ตรวจ package_price ใน Master ก่อนอ้างยอด Future; ห้ามใช้ amount_received แทนราคาเสนอ"});
      if(refunds)rows.push({label:"Booking · ยกเลิกแต่บันทึก paid",status:"WARN",
        detail:refunds+" รายการต้องกระทบยอด",suggestion:"ตรวจหลักฐานกับเจ้าของก่อนคืนเงินหรือปรับยอด"});
    }
    return rows;
  }

  function buildSnapshotGuardRows(data){
    const d=data||{};
    const diag=d.phase1_diagnostics||{};
    const readerSnapshot=diag.fallback_mode===true;
    const rows=[];
    const backendVersion=d.admin_api_version || diag.admin_api_version || "";
    const proxyVersion=d.frontend_proxy_version || "";
    const spreadsheetId=d.spreadsheet_id || diag.spreadsheet_id || "";
    const frontendSheetId=d.frontend_sheet_id || diag.frontend_sheet_id || "";
    rows.push({label:"Admin UI Version",status:"OK",detail:KK_ADMIN_UI_VERSION,suggestion:""});
    rows.push({label:"Apps Script Version",status:!readerSnapshot && backendVersion===EXPECTED_BACKEND_VERSION?"OK":"WARN",detail:readerSnapshot?"ยังไม่ยืนยันจาก Apps Script":backendVersion||"missing",suggestion:!readerSnapshot && backendVersion===EXPECTED_BACKEND_VERSION?"":"Verify deployed source; do not deploy repository 9_5_8 over 9_5_9"});
    rows.push({label:"Vercel Proxy Version",status:proxyVersion===EXPECTED_PROXY_VERSION?"OK":"WARN",detail:proxyVersion||"missing",suggestion:proxyVersion===EXPECTED_PROXY_VERSION?"":"Redeploy Vercel with latest api/kk-admin.js"});
    rows.push({label:"Sheet ID Match",status:readerSnapshot?"WARN":(spreadsheetId&&frontendSheetId&&spreadsheetId===frontendSheetId)?"OK":"FAIL",detail:readerSnapshot?"ยังไม่ยืนยันจาก Apps Script":(spreadsheetId||"missing")+" / "+(frontendSheetId||"missing"),suggestion:"GOOGLE_SHEET_ID in Vercel must match Apps Script spreadsheet"});
    if(readerSnapshot)rows.push({label:"Snapshot Reader",status:"INFO",detail:backendVersion||"ยังไม่ยืนยัน",suggestion:"Read-source version only; Apps Script health remains separate"});
    const folderKnown=typeof diag.poster_folder_id_set==="boolean",logsKnown=typeof diag.log_sheets_ready==="boolean";
    rows.push({label:"Poster Folder",status:folderKnown && diag.poster_folder_id_set?"OK":"WARN",detail:folderKnown?diag.poster_folder_id_set?"set":"missing":"ยังไม่ยืนยัน",suggestion:folderKnown ? diag.poster_folder_id_set?"":"Set Script Property KK_POSTER_FOLDER_ID before uploading posters":"รอผลตรวจค่าจาก Apps Script"});
    rows.push({label:"Audit/Error Logs",status:logsKnown && diag.log_sheets_ready?"OK":"WARN",detail:logsKnown?diag.log_sheets_ready?"ready":"missing":"ยังไม่ยืนยัน",suggestion:logsKnown ? diag.log_sheets_ready?"":"Run setup/repair in Google Sheet menu":"รอผลตรวจค่าจาก Apps Script"});
    const h=KKSnapshotHealth.assess(d);
    for(const key of KKSnapshotHealth.KEYS) rows.push({label:"Snapshot · "+key,status:h.counts[key]===null ? "FAIL" : h.counts[key]===0 ? "WARN" : "OK",detail:String(h.counts[key] ?? "invalid")+" rows",suggestion:""});
    rows.push(...storefrontGuardRows(h.storefront_integrity));
    rows.push(...bookingClosureGuardRows(d));
    rows.push({label:"Snapshot freshness",status:snapshotState.stale ? "FAIL" : "OK",detail:snapshotState.error || snapshotState.goodAt || "Not loaded",suggestion:snapshotState.stale ? "Refresh successfully before making changes" : ""});
    return rows;
  }

  function currentSystemGuardRows(){
    // Live System Health must not silently hide Booking warnings in the
    // fallback snapshot. Append the same aggregate facts exactly once.
    if(state.systemHealth && state.systemHealth.rows){
      return state.systemHealth.rows.concat(bookingClosureGuardRows(state.data||{}));
    }
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
      const readerVersion=String(snap?.backend_version||"").startsWith("admin-direct-sheet-readonly-fallback-");
      rows.push({label:readerVersion?"Versions · UI / Proxy / Snapshot Reader":"Versions · UI / Proxy / Apps Script",status:!readerVersion && snap && snap.proxy_version===KK_ADMIN_UI_VERSION && snap.backend_version===EXPECTED_BACKEND_VERSION ? "OK" : "WARN",detail:KK_ADMIN_UI_VERSION+" / "+(snap?.proxy_version||"unknown")+" / "+(snap?.backend_version||"unknown"),suggestion:readerVersion?"Read-source version only; Apps Script revision remains unverified":"Inspect deployed source on mismatch; never deploy repo 9_5_8 over deployed 9_5_9."});
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

  function normalizeSearchText(value){
    return String(value||"").normalize("NFKC").toLocaleLowerCase("th-TH").replace(/\s+/g," ").trim();
  }
  function ensureEventSelectSearch(sel,rows,labelFor){
    if(!sel || !Array.isArray(rows) || rows.length<25) return;
    let input=sel.previousElementSibling;
    if(!(input && input.classList && input.classList.contains("event-select-search"))){
      input=document.createElement("input");
      input.type="search";
      input.className="event-select-search";
      input.placeholder="ค้นหางานก่อนเลือก";
      input.setAttribute("aria-label","ค้นหารายการงาน");
      sel.parentNode.insertBefore(input,sel);
      input.addEventListener("input",()=>{
        const all=Array.isArray(sel.__kkEventRows)?sel.__kkEventRows:[];
        const q=normalizeSearchText(input.value);
        const selected=String(sel.value||"");
        const matches=!q?all:all.filter(e=>normalizeSearchText(sel.__kkEventLabelFor(e)).includes(q));
        const visible=matches.slice(0,80);
        const selectedRow=selected && all.find(e=>String(e.event_id)===selected);
        if(selectedRow && !visible.some(e=>String(e.event_id)===selected)) visible.unshift(selectedRow);
        const placeholder=sel.__kkPlaceholder||"เลือกงาน";
        sel.innerHTML=`<option value="">${esc(matches.length?placeholder:"ไม่พบงานที่ค้นหา")}</option>`+
          visible.map(e=>opt(e.event_id,sel.__kkEventLabelFor(e))).join("");
        if(selected && visible.some(e=>String(e.event_id)===selected)) sel.value=selected;
      });
    }
    sel.__kkEventRows=rows.slice();
    sel.__kkEventLabelFor=labelFor;
    sel.__kkPlaceholder=sel.options&&sel.options[0]?sel.options[0].textContent:"เลือกงาน";
    input.hidden=false;
    if(String(input.value||"").trim()) input.dispatchEvent(new Event("input"));
  }

  function fillSelects(){
    const data=state.data||{};
    qsa('select[data-source="events"]').forEach(sel=>{
      const current=sel.value;
      const isBooking=!!sel.closest("#bookingForm");
      const isOverride=!!sel.closest("#eventPriceOverrideForm");
      const isEditEvent=!!sel.closest("#eventUpdateForm");
      const rows=(data.events||[])
        .filter(e=>String(e.event_id||"").trim())
        // Booking: show only current/upcoming open events that still have bookable packages.
        .filter(e=>!isBooking || (isActiveEvent(e) && isTodayOrFuture(e.event_date) && eventHasBookablePackage(e.event_id)))
        // Price override: show only current/upcoming open events, not past/closed/draft events.
        .filter(e=>!isOverride || (isEventOpen(e) && isTodayOrFuture(e.event_date)))
        // Edit Event: show only current/upcoming open events to prevent accidental edits on past events.
        .filter(e=>!isEditEvent || (isEventOpen(e) && isTodayOrFuture(e.event_date)))
        .filter(e=>(isBooking||isOverride||isEditEvent) || String(e.status||"").toLowerCase().trim()!=="closed")
        .sort(compareEventsByDateAsc);
      const placeholder=isBooking ? "เลือกงานที่ยังว่าง" : (isOverride ? "เลือกงานวันนี้/อนาคต" : (isEditEvent ? "เลือกงานวันนี้/อนาคต" : "เลือกงาน"));
      const emptyText=isBooking ? "ไม่มีงานที่ว่างให้จอง" : (isOverride ? "ไม่มีงานวันนี้/อนาคตให้แก้ราคา" : (isEditEvent ? "ไม่มีงานวันนี้/อนาคตให้แก้ไข" : placeholder));
      const labelFor=e=>{
        let packageMarker="";
        if(isOverride){
          const info=packageVisibilityState(e.event_id);
          packageMarker=info.kind==="hidden" ? " · 🟢 ซ่อนแล้ว" :
            (info.kind==="mixed" ? ` · 🟡 ซ่อน ${info.hidden}/${info.total}` :
              (info.kind==="visible" ? " · 🔴 ยังแสดง" : " · ⚪ ไม่มี Web Package"));
        }
        const eventMarker=isOverride ? (e.active_on_web===false ? " · ⛔ การ์ดซ่อน" : " · 👁 การ์ดแสดง") : "";
        return `${e.event_name} · ${fmtDate(e.event_date)}${packageMarker}${eventMarker}${isEditEvent && e.active_on_web===false ? " · ซ่อนเว็บ" : ""}`;
      };
      sel.innerHTML=`<option value="">${esc(rows.length ? placeholder : emptyText)}</option>`+rows.map(e=>opt(e.event_id,labelFor(e))).join('');
      if(current && rows.some(e=>String(e.event_id)===String(current))) sel.value=current;
      ensureEventSelectSearch(sel,rows,labelFor);
    });
    qsa('select[data-source="packages"]').forEach(sel=>{
      if(sel.closest("#bookingForm")) return;
      const current=sel.value;
      sel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(data.packages||[])
        .filter(p=>p.active!==false)
        .map(p=>opt(p.template_id, `${p.display_name||p.template_id} · ${money(p.standard_price)}฿`)).join('');
      if(current) sel.value=current;
    });
    populateBookingPackages();
    populateEventOverrideForm();
    {
      const bulkForm=$("#eventPriceOverrideForm");
      renderEventBulkPriceEditor(bulkForm && bulkForm.elements.event_id ? bulkForm.elements.event_id.value : "");
    }
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
    if($("#pricingCenterCount")) $("#pricingCenterCount").textContent=`${Math.min(state.pricingLimit,rows.length)} / ${rows.length} รายการ · CHECK ${mismatch}`;
    const pricingMore=$("#pricingLoadMoreBtn");
    if(pricingMore){
      pricingMore.hidden=Math.min(state.pricingLimit,rows.length)>=rows.length;
      if(!pricingMore.hidden) pricingMore.textContent=`แสดงราคาเพิ่ม (${Math.max(0,rows.length-state.pricingLimit)})`;
    }
    table($("#pricingCenterTable"),[
      {label:"งาน",render:r=>`<strong>${esc(r.event.event_name)}</strong><br><small>${esc(fmtDate(r.event.event_date))}</small>`},
      {label:"แพ็กเกจ",render:r=>`<strong>${esc(r.pkg.display_name||r.pkg.template_id)}</strong><br><small>${esc(r.pkg.package_type||"")} · ${esc(r.pkg.template_id||"")}</small>`},
      {label:"ราคาหลัก",render:r=>`${esc(money(r.master))}฿`},
      {label:"Override",render:r=>r.overrideHasPrice ? `<strong>${esc(money(r.override.override_price))}฿</strong><br><small>${esc(r.activeOverride||"ไม่เปลี่ยน")}</small>` : `<span class="muted">ใช้ราคาหลัก</span>`},
      {label:"ลูกค้าเห็นจริง",render:r=>r.web ? `<strong>${esc(money(r.publicPrice))}฿</strong><br><small>เหลือ ${esc(r.web.available_count||0)} · ${esc(r.web.package_status||"")}</small>` : `<span class="pill warn">ไม่มี Web row</span>`},
      {label:"สถานะ",render:r=>`<span class="pill ${r.status==="OK"?"ok":(r.status==="HIDDEN"?"warn":"bad")}">${esc(r.status)}</span><br><small>ควรเป็น ${esc(money(r.expected))}฿</small>`},
      {label:"Action",render:r=>`<div class="row-actions"><button class="btn tiny ghost" type="button" data-pricing-edit="${esc(r.event.event_id)}|${esc(r.pkg.template_id)}">เปิดฟอร์ม</button>${r.override?`<button class="btn tiny secondary" type="button" data-pricing-apply="${esc(r.event.event_id)}|${esc(r.pkg.template_id)}">Apply</button>`:""}</div>`}
    ], rows.slice(0,state.pricingLimit));
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
    if($("#actionCount")) $("#actionCount").textContent=Math.min(state.actionLimit,shownActionRows.length)+" / "+shownActionRows.length+" รายการที่ควรเช็ก";
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
    ], shownActionRows.slice(0,state.actionLimit));

    $("#eventsCount").textContent=Math.min(state.eventLimit,openEventRows.length)+" / "+openEventRows.length+" รายการ";
    table($("#eventsTable"),[
      {label:"วันที่",render:r=>esc(fmtDate(r.event_date))},
      {label:"งาน",key:"event_name"},
      {label:"สถานที่",key:"venue"},
      {label:"สถานะ",render:r=>`<span class="pill ${r.status==='open'?'ok':'bad'}">${esc(r.status)}</span>`},
      {label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}
    ], openEventRows.slice(0,state.eventLimit));

    $("#bookingsCount").textContent=Math.min(state.bookingLimit,bookingRows.length)+" / "+bookingRows.length+" รายการ";
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
    ], bookingRows.slice(0,state.bookingLimit));

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
    renderHealthTriage();
    renderOperationalAttention();

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
    renderEventControlCenter();

    const setMore=(id,shown,total)=>{
      const btn=$(id);
      if(!btn) return;
      btn.hidden=shown>=total;
      if(!btn.hidden) btn.textContent=`แสดงเพิ่ม (${Math.max(0,total-shown)})`;
    };
    setMore("#actionLoadMoreBtn",Math.min(state.actionLimit,shownActionRows.length),shownActionRows.length);
    setMore("#eventsLoadMoreBtn",Math.min(state.eventLimit,openEventRows.length),openEventRows.length);
    setMore("#bookingsLoadMoreBtn",Math.min(state.bookingLimit,bookingRows.length),bookingRows.length);

    fillSelects();
  }

  function compactSnapshotWarnings(warnings){
    return (Array.isArray(warnings)?warnings:[])
      .map(w=>String(w||"").replace(/;\\s*sample\\b.*$/i,"").trim())
      .filter(Boolean);
  }

  function friendlySnapshotWarning(value){
    const raw=String(value||"").trim();
    const lower=raw.toLowerCase();
    const count=(raw.match(/\b(\d+)\b/)||[])[1]||"";
    if(lower.includes("published past events")) return "มีงานเก่ายังเปิดหน้าเว็บ"+(count?" "+count+" งาน":"");
    if(lower.includes("venue naming variants")) return "ชื่อสถานที่มีหลายรูปแบบ"+(count?" "+count+" รายการ":"");
    if(lower.includes("missing poster")) return "บางงานยังไม่มีโปสเตอร์"+(count?" "+count+" งาน":"");
    return raw;
  }

  function renderSnapshotStatus(){
    const el=$("#snapshotStatus");
    if(!el) return;
    const h=snapshotState.health;
    const fullWarnings=h && Array.isArray(h.warnings) ? h.warnings : [];
    const compactWarnings=compactSnapshotWarnings(fullWarnings).map(friendlySnapshotWarning);
    const degraded=!!(state.data && state.data.degraded_read_only);
    const directState=state.data && state.data.direct_writer_phase1_state;
    const directActions=directState && directState.writer_ready && Array.isArray(directState.configured_actions) ? directState.configured_actions : [];
    const admission=writeAdmission("__status__");
    const transientAttempt=degraded && admission.mode==="transient-attempt";
    const stale=!!snapshotState.stale;
    const failed=stale && !state.data;
    const tone=failed ? "bad" : (stale || (degraded && !transientAttempt && !directActions.length) ? "warn" : (compactWarnings.length ? "warn" : "ok"));
    let title="ระบบพร้อมใช้งาน";
    let subtitle="เชื่อมต่อ Google Sheet และอ่านข้อมูลล่าสุดแล้ว";
    let technical="Read path พร้อมใช้งาน";
    if(stale){
      title=state.data ? "ข้อมูลเก่า — กรุณา Refresh" : "โหลดข้อมูลไม่สำเร็จ";
      subtitle=state.data ? "กำลังแสดง Last Known Good Snapshot ชั่วคราว" : "ยังยืนยันสถานะข้อมูลล่าสุดไม่ได้";
      technical=subtitle;
    }else if(degraded && directActions.length){
      title="ระบบพร้อมใช้งานบางส่วน";
      subtitle="อ่านข้อมูลได้ และ Direct Writer พร้อมบางคำสั่ง";
      technical="Mixed mode — Direct Writer actions: "+directActions.join(", ");
    }else if(transientAttempt){
      title="บันทึกได้แบบปลอดภัย";
      subtitle="Write transport ตอบช้า — ระบบส่งคำสั่งครั้งเดียวและไม่ retry อัตโนมัติ";
      technical="Transient write health — single-attempt only; no automatic retry";
    }else if(degraded){
      title="อ่านข้อมูลได้ • การบันทึกบางส่วนถูกปิด";
      subtitle="ตรวจ System Guard ก่อนบันทึก";
      technical="Deterministic write transport failure / writer acceptance pending";
    }
    const countLabels={events:"งาน",bookings:"Booking",current_bookings:"กำลังดำเนินการ",assets:"Asset"};
    const countChips=h && h.counts ? Object.entries(h.counts).map(([key,value])=>{
      const label=countLabels[key]||key;
      return `<span><b>${esc(value===null?"—":value)}</b>${esc(label)}</span>`;
    }).join("") : "";
    const lastGood=snapshotState.goodAt ? new Date(snapshotState.goodAt) : null;
    const lastTime=lastGood ? lastGood.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) : "—";
    const latency=snapshotState.latencyMs==null ? "—" : Math.round(Number(snapshotState.latencyMs));
    const warningSummary=compactWarnings.length ? `<span class="snapshot-warning-count">${esc(compactWarnings.length)} จุดควรตรวจ</span>` : "";
    const warningList=compactWarnings.length ? `<div class="snapshot-warning-list"><strong>จุดที่ควรตรวจ</strong>${compactWarnings.map(w=>`<span>${esc(w)}</span>`).join("")}</div>` : "";
    const errorRow=snapshotState.error ? `<div class="snapshot-error">${esc(snapshotState.error)}</div>` : "";
    el.hidden=false;
    el.className=`card snapshot-status snapshot-${tone}`;
    el.title=title;
    const markup=`
      <div class="snapshot-status-main">
        <div class="snapshot-state">
          <span class="snapshot-dot" aria-hidden="true"></span>
          <div><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div>
        </div>
        <div class="snapshot-inline-meta">
          <span>อัปเดต ${esc(lastTime)}</span>
          <span>${esc(latency)} ms</span>
          ${warningSummary}
        </div>
        <details class="snapshot-details">
          <summary>รายละเอียด</summary>
          <div class="snapshot-detail-body">
            <div class="snapshot-counts">${countChips}</div>
            <div class="snapshot-technical">${esc(technical)}</div>
            ${warningList}
            ${errorRow}
          </div>
        </details>
      </div>`;
    if("innerHTML" in el) el.innerHTML=markup;
    else el.textContent=title+" — "+subtitle;
  }

  async function refresh({waitForActive=false}={}){
    // A mutation must never accept an older in-flight snapshot as its readback.
    // Wait for that read to finish, then issue a new snapshot after the write.
    if(state.loading){
      if(!waitForActive) return;
      while(state.loading) await new Promise(resolve=>setTimeout(resolve,25));
    }
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
      hideAdminClientRecovery();
      renderSnapshotStatus();
      render();
      loadRentalAnalytics();
      const backendVersion = state.data.admin_api_version || (state.data.phase1_diagnostics && state.data.phase1_diagnostics.admin_api_version) || "";
      if(state.data.phase1_diagnostics?.fallback_mode!==true && backendVersion && backendVersion !== EXPECTED_BACKEND_VERSION){
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
    qsa(".nav[data-tab]").forEach(btn=>{
      btn.setAttribute("aria-controls", "tab-"+btn.dataset.tab);
      btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
      btn.addEventListener("click",()=>activateTab(btn.dataset.tab,{scroll:true,writeHash:true}));
    });
    document.addEventListener("click", ev=>{
      const jump=ev.target.closest("[data-tab-jump]");
      if(!jump) return;
      const tab=jump.getAttribute("data-tab-jump");
      const nav=$(`.nav[data-tab="${tab}"]`);
      if(nav) nav.click();
    });
    const recoveryRetry=$("#adminClientRetryBtn");
    if(recoveryRetry) recoveryRetry.addEventListener("click",async()=>{
      setBusy(recoveryRetry,true);
      try{
        if(!state.pin) return location.reload();
        await refresh();
        updateUiLastRefresh();
        hideAdminClientRecovery();
        showNotice("โหลดข้อมูลใหม่สำเร็จ");
      }catch(e){
        showNotice("Retry ไม่สำเร็จ: "+e.message,"bad");
      }finally{
        setBusy(recoveryRetry,false);
      }
    });
    const loginBtn=$("#loginBtn");
    if(loginBtn) loginBtn.addEventListener("click", async()=>{
      if(state.pin!==$("#pinInput").value.trim()){ state.data=null; snapshotState.goodAt=null; }
      state.pin=$("#pinInput").value.trim(); if(!state.pin) return alert("กรุณากรอก PIN");
      safeSessionSet("kk_admin_pin",state.pin);
      try{ await refresh(); updateUiLastRefresh(); $("#loginPanel").classList.add("hidden"); $("#appPanel").classList.remove("hidden"); showNotice("โหลดข้อมูลสำเร็จ"); }
      catch(e){ showNotice(e.message,"bad"); }
    });
    const logoutBtn=$("#logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click",()=>{ safeSessionRemove("kk_admin_pin"); location.reload(); });
    const refreshBtn=$("#refreshBtn");
    if(refreshBtn) refreshBtn.addEventListener("click",()=>refresh().then(()=>{ updateUiLastRefresh(); showNotice("Refresh แล้ว"); }).catch(e=>showNotice(e.message,"bad")));
    const rentalAnalyticsRefreshBtn=$("#rentalAnalyticsRefreshBtn");
    if(rentalAnalyticsRefreshBtn) rentalAnalyticsRefreshBtn.addEventListener("click",()=>loadRentalAnalytics());
    const densityBtn=$("#densityBtn");
    if(densityBtn) densityBtn.addEventListener("click",()=>{
      const current=safeLocalGet("kk_admin_compact_mode")==="1";
      safeLocalSet("kk_admin_compact_mode", current ? "0" : "1");
      applyDensityMode();
    });
    document.addEventListener("keydown", ev=>{
      const tag=(ev.target && ev.target.tagName || "").toLowerCase();
      const typing=tag==="input" || tag==="textarea" || tag==="select" || (ev.target && ev.target.isContentEditable);
      if((ev.ctrlKey||ev.metaKey) && String(ev.key).toLowerCase()==="k"){
        ev.preventDefault(); openCommandPalette(); return;
      }
      if(ev.key==="/" && !typing){ev.preventDefault();focusSmartSearch();return;}
      if(ev.key==="Escape") closeCommandPalette();
    });
    const commandInput=$("#globalAdminSearch");
    if(commandInput) commandInput.addEventListener("input",renderCommandResults);
    const commandClose=$("#commandPaletteClose");
    if(commandClose) commandClose.addEventListener("click",closeCommandPalette);
    const commandOverlay=$("#commandPalette");
    if(commandOverlay) commandOverlay.addEventListener("click",ev=>{if(ev.target===commandOverlay)closeCommandPalette();});
    document.addEventListener("click",ev=>{
      const result=ev.target.closest&&ev.target.closest("[data-command-kind]");
      if(!result)return;
      const kind=result.getAttribute("data-command-kind"), id=result.getAttribute("data-command-id");
      closeCommandPalette();
      if(kind==="event"){
        activateTab("packages",{scroll:true,writeHash:true});
        state.eventControlSearch=String(id||"");
        const input=$("#eventControlSearch"); if(input)input.value=state.eventControlSearch;
        state.eventControlFilter="all"; state.eventControlMonth="all"; renderEventControlCenter();
      }else if(kind==="booking"){
        activateTab("edit-booking",{scroll:true,writeHash:true});
        openBookingEdit(id);
      }else if(kind==="customer"){
        activateTab("customers",{scroll:true,writeHash:true});
        state.selectedCustomerKey=id; renderCustomerDetail((state.data&&state.data.customer_history)||[]);
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
    [["actionLoadMoreBtn","actionLimit",40],["eventsLoadMoreBtn","eventLimit",50],["bookingsLoadMoreBtn","bookingLimit",50],["pricingLoadMoreBtn","pricingLimit",120],["eventControlLoadMoreBtn","eventControlLimit",30]].forEach(([id,key,step])=>{
      const el=$("#"+id);
      if(el) el.addEventListener("click",()=>{ state[key]+=step; render(); });
    });
    const resetEventControlScope=()=>{
      state.eventControlLimit=30;
      clearEventControlSelection({render:false});
    };
    const controlSearch=$("#eventControlSearch");
    if(controlSearch) controlSearch.addEventListener("input",()=>{
      state.eventControlSearch=controlSearch.value||"";
      resetEventControlScope();
      renderEventControlCenter();
    });
    const controlMonth=$("#eventControlMonth");
    if(controlMonth) controlMonth.addEventListener("change",()=>{
      state.eventControlMonth=controlMonth.value||"all";
      safeSessionSet("kk_admin_event_control_month",state.eventControlMonth);
      resetEventControlScope();
      renderEventControlCenter();
    });
    const controlFilter=$("#eventControlFilter");
    if(controlFilter) controlFilter.addEventListener("change",()=>{
      state.eventControlFilter=controlFilter.value||"needs_action";
      resetEventControlScope();
      renderEventControlCenter();
    });
    const controlSort=$("#eventControlSort");
    if(controlSort) controlSort.addEventListener("change",()=>{
      state.eventControlSort=controlSort.value||"date_asc";
      state.eventControlLimit=30;
      renderEventControlCenter();
    });
    const selectVisible=$("#eventControlSelectVisible");
    if(selectVisible) selectVisible.addEventListener("change",()=>{
      const rows=filteredEventControlRows().slice(0,state.eventControlLimit);
      if(selectVisible.checked){
        const remaining=Math.max(0,12-state.eventControlSelected.size);
        const addable=rows.filter(r=>!state.eventControlSelected.has(r.event_id));
        addable.slice(0,remaining).forEach(r=>state.eventControlSelected.add(r.event_id));
        if(addable.length>remaining) showNotice("เลือกได้สูงสุด 12 งานต่อรอบ — เลือกให้เฉพาะ 12 งานแรก","warn");
      }else{
        rows.forEach(r=>state.eventControlSelected.delete(r.event_id));
      }
      renderEventControlCenter();
    });
    const clearSelected=$("#eventControlClearSelected");
    if(clearSelected) clearSelected.addEventListener("click",()=>clearEventControlSelection());
    const selectedOnly=$("#eventControlSelectedOnly");
    if(selectedOnly) selectedOnly.addEventListener("click",()=>{
      if(!state.eventControlSelected.size) return showNotice("ยังไม่ได้เลือกงาน","warn");
      state.eventControlSelectedOnly=!state.eventControlSelectedOnly;
      state.eventControlLimit=30;
      renderEventControlCenter();
    });
    document.addEventListener("change",ev=>{
      const cb=ev.target && ev.target.closest && ev.target.closest("[data-control-select]");
      if(!cb) return;
      const id=String(cb.getAttribute("data-control-select")||"");
      if(cb.checked){
        if(!state.eventControlSelected.has(id) && state.eventControlSelected.size>=12){
          cb.checked=false;
          showNotice("เลือกได้สูงสุด 12 งานต่อรอบ กรุณาทำ Batch ชุดนี้ก่อน","warn");
          return renderEventControlCenter();
        }
        state.eventControlSelected.add(id);
      }else state.eventControlSelected.delete(id);
      if(!state.eventControlSelected.size) state.eventControlSelectedOnly=false;
      renderEventControlCenter();
    });
    document.addEventListener("click",ev=>{
      const stat=ev.target.closest && ev.target.closest("[data-control-stat-filter]");
      if(!stat) return;
      state.eventControlFilter=stat.getAttribute("data-control-stat-filter")||"all";
      const filterEl=$("#eventControlFilter"); if(filterEl) filterEl.value=state.eventControlFilter;
      resetEventControlScope();
      renderEventControlCenter();
    });
    qsa("[data-event-control-batch]").forEach(el=>{
      el.addEventListener("click",()=>runEventControlBatch(el.getAttribute("data-event-control-batch")||""));
    });
    document.addEventListener("click",async ev=>{
      const openBtn=ev.target.closest && ev.target.closest("[data-control-open-override]");
      if(openBtn){
        const id=openBtn.getAttribute("data-control-open-override")||"";
        const form=$("#eventPriceOverrideForm");
        if(form && form.elements.event_id){ form.elements.event_id.value=id; populateEventOverrideForm(); form.scrollIntoView({behavior:"smooth",block:"start"}); }
        return;
      }
      const preview=ev.target.closest && ev.target.closest("[data-control-preview-event]");
      if(preview){
        const id=preview.getAttribute("data-control-preview-event")||"";
        if(id) window.open("/?event="+encodeURIComponent(id),"_blank","noopener");
        return;
      }
      const pkgToggle=ev.target.closest && ev.target.closest("[data-control-toggle-packages]");
      if(pkgToggle){
        const id=pkgToggle.getAttribute("data-control-toggle-packages")||"";
        const mode=pkgToggle.getAttribute("data-mode")==="show" ? "show" : "hide";
        const event=findEventById(id);
        if(!event) return showNotice("ไม่พบงานที่เลือก","bad");
        const info=packageVisibilityState(id);
        if(mode==="hide" && info.kind==="hidden") return showNotice("งานนี้ซ่อน Package ครบอยู่แล้ว","ok");
        if(mode==="show" && info.kind==="visible") return showNotice("งานนี้เปิด Package อยู่แล้ว","ok");
        if(!confirm((mode==="hide"?"ซ่อน":"เปิด")+" Package ทั้งงาน "+(event.event_name||id)+" ใช่ไหม?")) return;
        setBusy(pkgToggle,true);
        try{
          await api("bulkSetEventPackageVisibility",{event_id:id,mode});
          await refresh();
          activateTab("packages",{scroll:false});
          showNotice((mode==="hide"?"ซ่อน":"เปิด")+" Package สำเร็จ");
        }catch(e){ showNotice(e.message,"bad"); }
        finally{ setBusy(pkgToggle,false); }
        return;
      }
      const toggle=ev.target.closest && ev.target.closest("[data-control-toggle-event]");
      if(!toggle) return;
      const id=toggle.getAttribute("data-control-toggle-event")||"";
      const event=findEventById(id);
      if(!event) return showNotice("ไม่พบงานที่เลือก","bad");
      const next=event.active_on_web===false;
      if(!confirm((next?"เปิด":"ซ่อน")+"การ์ดงาน "+(event.event_name||id)+" ใช่ไหม?")) return;
      setBusy(toggle,true);
      api("updateEvent",eventVisibilityPayload(id,next))
        .then(()=>refresh())
        .then(()=>{
          activateTab("packages",{scroll:false});
          showNotice((next?"เปิด":"ซ่อน")+"การ์ดงานสำเร็จ");
          setAdminUndo(`${next?"เปิด":"ซ่อน"}การ์ดงานแล้ว · Undo ได้ 20 วินาที`,async()=>{
            await api("updateEvent",eventVisibilityPayload(id,!next));
          });
        })
        .catch(e=>showNotice(e.message,"bad"))
        .finally(()=>setBusy(toggle,false));
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
        const statusEl=qsa('[data-asset-status]').find(el=>el.getAttribute('data-asset-status')===assetId);
        const rentableEl=qsa('[data-asset-rentable]').find(el=>el.getAttribute('data-asset-rentable')===assetId);
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
      let payload=bookingMutationIdentity(b,row);
      let label="";
      if(action==="paid"){
        // Legacy shortcut must never mark a receipt paid without handover evidence.
        openBookingEdit(b.booking_id || row);
        return showNotice("ร้านรับเงินตอนส่งเครื่อง: กรุณาตรวจยอดรับเงินจริงและบันทึกหลักฐานใน Edit Booking ก่อนเปลี่ยนสถานะ", "warn");
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
    setupUnsavedGuards();
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
    if(bookingEditSelect) bookingEditSelect.addEventListener("change", ()=>{
      const selected=findBookingByRow(bookingEditSelect.value);
      state.editBookingId=selected ? String(selected.booking_id||"").trim() : "";
      populateBookingEditForm();
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

    const undoBtn=$("#adminUndoBtn");
    if(undoBtn) undoBtn.addEventListener("click",runAdminUndo);
    const systemGuardBtn=$("#runSystemGuardBtn");
    if(systemGuardBtn) systemGuardBtn.addEventListener("click",()=>runSystemGuard(systemGuardBtn));
    const copySystemGuardBtn=$("#copySystemGuardBtn");
    if(copySystemGuardBtn) copySystemGuardBtn.addEventListener("click",async()=>{
      const rows=currentSystemGuardRows();
      const text=rows.map(r=>`${r.status||''} | ${r.label||r.check||r.key||''} | ${r.detail||''} | ${r.suggestion||r.note||''}`).join("\n");
      try{ await navigator.clipboard.writeText(text); showNotice("Copy System Guard result แล้ว"); }
      catch(_){ showNotice(text,"warn"); }
    });
    const copyHealthTriageBtn=$("#copyHealthTriageBtn");
    if(copyHealthTriageBtn) copyHealthTriageBtn.addEventListener("click",async()=>{
      const text=healthTriageClipboardText();
      try{ await navigator.clipboard.writeText(text); showNotice("Copy Root Cause Checklist แล้ว"); }
      catch(_){ showNotice(text,"warn"); }
    });

    const overrideForm=$("#eventPriceOverrideForm");
    if(overrideForm){
      // Only event/package selectors should reload the saved override.
      // Do NOT bind active_override here; otherwise selecting "เปิดขาย" / "ซ่อน"
      // immediately calls populateEventOverrideForm() and resets the user's choice back to the saved value.
      if(overrideForm.elements.event_id) overrideForm.elements.event_id.addEventListener("change",()=>{
        populateEventOverrideForm();
        renderEventBulkPriceEditor(overrideForm.elements.event_id.value);
      });
      if(overrideForm.elements.template_id) overrideForm.elements.template_id.addEventListener("change",populateEventOverrideForm);
      overrideForm.addEventListener("submit",async ev=>{
        ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);
        try{ await api("upsertEventOverride",formData(ev.target)); markFormClean(ev.target); await refresh(); showNotice("บันทึกราคาเฉพาะงานสำเร็จ"); }
        catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }
      });

      const bulkPriceSave=$("#saveBulkEventPrices");
      if(bulkPriceSave) bulkPriceSave.addEventListener("click",async()=>{
        const eventId=String(overrideForm.elements.event_id && overrideForm.elements.event_id.value || "").trim();
        if(!eventId) return showNotice("กรุณาเลือกงานก่อน","warn");
        const changes=collectEventBulkPriceChanges();
        if(!changes.length) return showNotice("ยังไม่มีราคาที่เปลี่ยน","warn");
        const event=findEventById(eventId);
        if(!window.confirm(`บันทึกราคา/สถานะพร้อมกัน ${changes.length} แพ็กเกจ\nงาน: ${event ? (event.event_name||eventId) : eventId}\n\nระบบจะเขียนเฉพาะแพ็กเกจที่มีการเปลี่ยนแปลง`)) return;
        setBusy(bulkPriceSave,true);
        const failed=[];
        let saved=0;
        try{
          for(const item of changes){
            try{
              await api("upsertEventOverride",Object.assign({event_id:eventId},item));
              saved++;
            }catch(err){
              failed.push({item,error:err && err.message ? err.message : String(err)});
            }
          }
          await refresh();
          renderEventBulkPriceEditor(eventId);
          if(failed.length){
            restoreEventBulkPriceDraft(failed.map(x=>x.item));
            const first=failed[0];
            showNotice(`บันทึกได้ ${saved}/${changes.length} รายการ · เหลือ ${failed.length} รายการให้ลองใหม่${first ? " · "+first.error : ""}`,"bad");
          }else{
            showNotice(`บันทึกราคาหลายแพ็กเกจสำเร็จ ${saved} รายการ`);
          }
        }catch(e){
          restoreEventBulkPriceDraft(changes);
          showNotice(e.message||String(e),"bad");
        }finally{
          setBusy(bulkPriceSave,false);
          updateEventBulkPriceUi();
        }
      });

      const bulkPriceReset=$("#resetBulkEventPrices");
      if(bulkPriceReset) bulkPriceReset.addEventListener("click",()=>{
        const changes=collectEventBulkPriceChanges();
        if(changes.length && !window.confirm(`ทิ้งการแก้ไข ${changes.length} รายการ แล้วคืนค่าที่บันทึกล่าสุดใช่ไหม?`)) return;
        const eventId=String(overrideForm.elements.event_id && overrideForm.elements.event_id.value || "").trim();
        renderEventBulkPriceEditor(eventId);
      });

      const eventVisibilityBtn=$("#eventVisibilityToggleBtn");
      if(eventVisibilityBtn) eventVisibilityBtn.addEventListener("click",async()=>{
        const eventId=String(overrideForm.elements.event_id && overrideForm.elements.event_id.value || "").trim();
        if(!eventId) return showNotice("กรุณาเลือกงานก่อน","warn");
        const event=findEventById(eventId);
        if(!event) return showNotice("ไม่พบข้อมูลงาน กรุณา Refresh แล้วลองใหม่","bad");
        const nextActive=event.active_on_web===false;
        const actionText=nextActive ? "เปิดงานบนหน้าบ้าน" : "ซ่อนงานจากหน้าบ้าน";
        const detail=nextActive
          ? "การ์ดงานจะกลับมาแสดง โดยสถานะแพ็กเกจยังคงเดิม"
          : "การ์ดงานจะหายจากหน้าบ้านทั้งหมด แต่ Package, ราคา, Booking และ Stock จะไม่ถูกลบหรือแก้";
        if(!window.confirm(`${actionText}\nงาน: ${event.event_name||eventId}\n\n${detail}`)) return;
        setBusy(eventVisibilityBtn,true);
        try{
          await api("updateEvent",eventVisibilityPayload(eventId,nextActive));
          await refresh();
          showNotice(actionText+"สำเร็จ");
          setAdminUndo(actionText+"แล้ว · Undo ได้ 20 วินาที",async()=>{
            await api("updateEvent",eventVisibilityPayload(eventId,!nextActive));
          });
        }catch(e){showNotice(e.message,"bad");}
        finally{setBusy(eventVisibilityBtn,false);}
      });

      qsa("[data-bulk-event-visibility]", overrideForm).forEach(btn=>{
        btn.addEventListener("click",async()=>{
          const eventId=String(overrideForm.elements.event_id && overrideForm.elements.event_id.value || "").trim();
          if(!eventId) return showNotice("กรุณาเลือกงานก่อนจัดการแพ็กเกจทั้งงาน","warn");
          const mode=String(btn.getAttribute("data-bulk-event-visibility")||"").trim();
          const currentVisibility=packageVisibilityState(eventId);
          if(mode==="hide" && currentVisibility.kind==="hidden"){
            renderEventPackageVisibilityStatus(eventId);
            return showNotice("🟢 งานนี้ซ่อนทุกแพ็กเกจอยู่แล้ว — ไม่ส่งคำสั่งซ้ำ","ok");
          }
          if(mode==="show" && currentVisibility.kind==="visible"){
            renderEventPackageVisibilityStatus(eventId);
            return showNotice("🔴 งานนี้เปิดทุกแพ็กเกจอยู่แล้ว — ไม่ส่งคำสั่งซ้ำ","ok");
          }
          const label=mode==="hide" ? "ซ่อนทุกแพ็กเกจ" : (mode==="show" ? "เปิดทุกแพ็กเกจ" : "คืนสถานะตามแพ็กเกจหลัก");
          const event=((state.data&&state.data.events)||[]).find(e=>String(e.event_id||"")===eventId);
          const eventName=event ? (event.event_name||eventId) : eventId;
          const detail=mode==="hide"
            ? "ลูกค้าจะไม่เห็นแพ็กเกจที่ซ่อน แต่การ์ดงานยังอยู่บนหน้าบ้านในสถานะคิวเต็มเพื่อให้จองคิวหลุดได้"
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
        markFormClean(ev.target);
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
    if(eventUpdateForm){
      eventUpdateForm.addEventListener("submit",async ev=>{
        ev.preventDefault();
        const p=formData(ev.target);
        const currentEvent=findEventById(p.event_id);
        if(currentEvent && currentEvent.active_on_web===false && String(p.active_on_web||"").toLowerCase()==="true"){
          p.visibility_owner_intent="explicit_owner_reopen";
        }
        if(p.event_name && !confirmEventNameLint(p.event_name)) return;
        const btn=ev.submitter; setBusy(btn,true);
        try{
          if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);
          const uploaded=await uploadPosterFromInput("#updatePosterFile", ev.target);
          if(uploaded) p.poster_url=uploaded;
          const res=await api("updateEvent",p);
          if($("#updatePosterFile")) $("#updatePosterFile").value="";
          markFormClean(ev.target);
          await refresh();
          showNotice("แก้งานสำเร็จ" + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));
          state.posterWarning = "";
        }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);}
      });

    }
    const packageForm=$("#packageForm");
    if(packageForm) packageForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("createPackage",formData(ev.target)); ev.target.reset(); markFormClean(ev.target); await refresh(); showNotice("เพิ่มแพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const packageUpdateForm=$("#packageUpdateForm");
    if(packageUpdateForm) packageUpdateForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updatePackage",formData(ev.target)); markFormClean(ev.target); await refresh(); showNotice("แก้แพ็กเกจสำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const assetForm=$("#assetForm");
    if(assetForm) assetForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("addAssets",formData(ev.target)); ev.target.reset(); markFormClean(ev.target); await refresh(); showNotice("เพิ่ม asset สำเร็จ"); }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);} });
    const bookingForm=$("#bookingForm");
    if(bookingForm) bookingForm.addEventListener("submit",async ev=>{
      ev.preventDefault();
      const btn=ev.submitter;
      setBusy(btn,true);
      try{
        if(String(ev.target.elements.amount_received && ev.target.elements.amount_received.value || "").trim()==="") autofillBookingAmountFromPackage();
        const payload=formData(ev.target);
        // Client check complements the authenticated server-side no-deposit rule.
        payload.payment_status="unpaid";
        if(String(payload.amount_received||"").trim()!=="" && toNum(payload.amount_received)!==0)
          throw new Error("ร้านไม่เก็บมัดจำ: ยอดรับแล้วต้องเป็น 0 เมื่อสร้าง Booking (รับเงินตอนส่งเครื่อง)");
        payload.amount_received="0";
        if(hasWebPackageSource()){
          if(!eventHasBookablePackage(payload.event_id)) throw new Error("งานนี้เต็มแล้วหรือไม่มีแพ็กเกจว่าง กรุณา Refresh แล้วเลือกงานใหม่");
          const okPkg=bookableWebPackagesForEvent(payload.event_id).some(p=>String(templateIdFromWebPackage(p))===String(payload.template_id));
          if(!okPkg) throw new Error("แพ็กเกจนี้เต็มแล้วหรือถูกซ่อน กรุณาเลือกแพ็กเกจที่ยังว่าง");
        }
        const res=await api("createBooking",payload);
        ev.target.reset();
        markFormClean(ev.target);
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
          const selected=findBookingByRow(payload.row_number);
          if(!selected) throw new Error("ไม่พบ Booking ล่าสุด กรุณา Refresh แล้วเลือกใหม่");
          Object.assign(payload,bookingMutationIdentity(selected,payload.row_number));
          const res=await api("updateBooking", payload);
          markFormClean(ev.target);
          await refresh({waitForActive:true});
          activateTab("edit-booking",{scroll:false,writeHash:true});
          const closed=["cancelled","no_show","completed"].includes(String(payload.booking_status||"").toLowerCase());
          showNotice(closed
            ? `อัปเดต Booking สำเร็จ: ${payload.booking_status} · นำออกจากรายการแก้ Booking แล้ว`
            : `แก้ Booking สำเร็จ: row ${res.row_number}`);
        }catch(e){ showNotice(e.message,"bad"); }finally{ setBusy(btn,false); }
      });
    }
  }

  if(typeof window!=="undefined" && window.addEventListener){
    window.addEventListener("beforeunload",ev=>{
      if(!dirtyForms().length)return;
      ev.preventDefault(); ev.returnValue="";
    });
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState!=="visible" || !state.pin || state.loading || !adminSnapshotIsStale())return;
      if(dirtyForms().length){showNotice("ข้อมูล Snapshot อาจเก่า แต่ยังไม่ Refresh เพราะมีฟอร์มที่ยังไม่ได้บันทึก","warn");return;}
      refresh().then(()=>showNotice("อัปเดตข้อมูลล่าสุดอัตโนมัติแล้ว")).catch(()=>{});
    });
    window.addEventListener("error",()=>{
      const id="ADM-"+Date.now().toString(36).toUpperCase();
      window.__KK_ADMIN_LAST_CLIENT_ERROR_ID__=id;
      showAdminClientRecovery(id,"client");
      showNotice(`Admin client error ${id} · กด “ลองโหลดข้อมูลใหม่” ก่อน Refresh ทั้งหน้า`,"bad");
    });
    window.addEventListener("unhandledrejection",()=>{
      const id="ADM-"+Date.now().toString(36).toUpperCase();
      window.__KK_ADMIN_LAST_CLIENT_ERROR_ID__=id;
      showAdminClientRecovery(id,"async");
      showNotice(`Admin async error ${id} · กด “ลองโหลดข้อมูลใหม่” ก่อน Refresh ทั้งหน้า`,"bad");
    });
  }
  applyDensityMode();
  updateUiLastRefresh();
  bind();
  const requestedTab=String(location.hash||"").replace(/^#/,"");
  if(requestedTab) activateTab(requestedTab,{scroll:false,writeHash:false});
  // /admin/app is already authenticated by the signed HttpOnly cookie. The
  // session bridge reveals the shell immediately; this fallback keeps bootstrap
  // working even when browser sessionStorage is unavailable.
  if(!state.pin && signedSession) state.pin="__SESSION__";
  if(signedSession){
    $("#loginPanel") && $("#loginPanel").classList.add("hidden");
    $("#appPanel") && $("#appPanel").classList.remove("hidden");
  }
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
