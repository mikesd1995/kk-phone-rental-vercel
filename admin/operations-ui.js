(function(){
  'use strict';
  if(window.__kkOperationsUiLoaded) return;
  window.__kkOperationsUiLoaded=true;
  const E=window.KKOperationsEngine;
  if(!E) return;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state={data:window.__KK_LAST_SNAPSHOT||null,from:'',to:''};

  function todayBangkok(){
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const o=Object.fromEntries(p.map(x=>[x.type,x.value])); return `${o.year}-${o.month}-${o.day}`;
  }
  function plusDays(day,n){ const d=new Date(day+'T00:00:00+07:00'); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function fmtDay(d){ if(!d)return '-'; return new Date(d+'T00:00:00+07:00').toLocaleDateString('th-TH',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); }
  function badge(s){ return `<span class="kkops-badge ${esc(s)}">${esc(s||'-')}</span>`; }

  function installStyles(){
    if(document.getElementById('kkops-style')) return;
    const s=document.createElement('style'); s.id='kkops-style'; s.textContent=`
      #tab-operations .kkops-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px}
      #tab-operations .kkops-toolbar label{display:grid;gap:4px;font-size:12px;font-weight:700}
      #tab-operations .kkops-toolbar input{padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px}
      .kkops-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
      .kkops-kpi{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff}.kkops-kpi span{display:block;color:#64748b;font-size:12px}.kkops-kpi strong{font-size:24px}
      .kkops-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.kkops-card{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff;margin-bottom:14px}
      .kkops-day{border-top:1px solid #e2e8f0;padding:10px 0}.kkops-day:first-child{border-top:0}.kkops-day h3{display:flex;justify-content:space-between;gap:12px;margin:0 0 8px;font-size:15px}.kkops-day h3 span{color:#64748b;font-size:12px}
      .kkops-booking{padding:10px;border-radius:12px;background:#f8fafc;margin:7px 0}.kkops-booking-top{display:flex;justify-content:space-between;gap:8px}.kkops-muted{color:#64748b;font-size:12px;margin-top:3px}
      .kkops-badge{font-size:11px;padding:3px 7px;border-radius:999px;background:#e2e8f0}.kkops-badge.confirmed,.kkops-badge.prepared,.kkops-badge.picked_up{background:#dcfce7;color:#166534}.kkops-badge.pending{background:#fef3c7;color:#92400e}
      .kkops-table{width:100%;border-collapse:collapse;font-size:12px}.kkops-table th,.kkops-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.kkops-table small{display:block;color:#64748b}.kkops-danger{background:#fff1f2}.kkops-bad{color:#b91c1c}.kkops-warn{color:#a16207}.kkops-good{color:#15803d}.kkops-empty{padding:20px;text-align:center;color:#64748b}
      @media(max-width:900px){.kkops-grid{grid-template-columns:1fr}.kkops-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `; document.head.appendChild(s);
  }

  function buildUi(){
    if(document.getElementById('tab-operations')) return;
    installStyles();
    const nav=document.querySelector('.admin-nav');
    if(nav){
      const btn=document.createElement('button'); btn.className='nav'; btn.type='button'; btn.dataset.icon='OP'; btn.textContent='ปฏิทิน / Availability'; btn.id='kkopsNav'; nav.insertBefore(btn,nav.querySelector('#logoutBtn')||null);
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active')); document.getElementById('tab-operations').classList.add('active'); render();
      });
    }
    const app=document.querySelector('#appPanel'); if(!app)return;
    const panel=document.createElement('section'); panel.className='tab-panel'; panel.id='tab-operations';
    panel.innerHTML=`<div class="kkops-card"><div><span class="eyebrow">P1 Operations</span><h2>Booking Calendar · Smart Availability · Collision Guard</h2><p class="hint">Read-only operational view จาก snapshot เดียวกับ Admin; ไม่แก้ Booking อัตโนมัติ</p></div>
      <div class="kkops-toolbar"><label>จาก<input id="kkopsFrom" type="date"></label><label>ถึง<input id="kkopsTo" type="date"></label><button class="btn secondary" id="kkopsApply" type="button">อัปเดตช่วง</button></div><div class="kkops-kpis" id="kkopsKpis"></div></div>
      <div class="kkops-grid"><div class="kkops-card"><h2>Booking Calendar</h2><div id="kkopsCalendar"></div></div><div class="kkops-card"><h2>Smart Availability</h2><div class="table-wrap"><table class="kkops-table"><thead><tr><th>วัน</th><th>Booking</th><th>Phone</th><th>Lens</th><th>Bundle</th><th>Unassigned</th><th>สถานะ</th></tr></thead><tbody id="kkopsAvailability"></tbody></table></div></div></div>
      <div class="kkops-card"><div class="card-head"><div><h2>Asset Collision Guard</h2><p class="hint">ตรวจ day-level double-booking, capacity, asset หาย/ผิดประเภท/ไม่ rentable</p></div><small id="kkopsCollisionCount"></small></div><div class="table-wrap"><table class="kkops-table"><thead><tr><th>ระดับ</th><th>วัน</th><th>Code</th><th>Asset</th><th>Booking</th><th>รายละเอียด</th></tr></thead><tbody id="kkopsCollisions"></tbody></table></div></div>`;
    app.appendChild(panel);
    const t=todayBangkok(); state.from=t; state.to=plusDays(t,30); document.getElementById('kkopsFrom').value=t; document.getElementById('kkopsTo').value=state.to;
    document.getElementById('kkopsApply').addEventListener('click',()=>{state.from=document.getElementById('kkopsFrom').value;state.to=document.getElementById('kkopsTo').value;render();});
  }

  function render(){
    if(!state.data||!document.getElementById('tab-operations')) return;
    const inv=E.inventory(state.data.assets||[]); const issues=E.collisions(state.data); const cal=E.calendar(state.data,{from:state.from,to:state.to});
    document.getElementById('kkopsKpis').innerHTML=[['Booking ในช่วง',cal.length],['Phone rentable',inv.phones.length],['Lens rentable',inv.lenses.length],['Error',issues.filter(x=>x.severity==='error').length]].map(([k,v])=>`<div class="kkops-kpi"><span>${k}</span><strong>${v}</strong></div>`).join('');
    const groups=new Map(); cal.forEach(r=>{if(!groups.has(r.date))groups.set(r.date,[]);groups.get(r.date).push(r);});
    document.getElementById('kkopsCalendar').innerHTML=cal.length?[...groups].map(([day,items])=>`<div class="kkops-day"><h3>${fmtDay(day)}<span>${items.length} booking</span></h3>${items.map(r=>`<div class="kkops-booking"><div class="kkops-booking-top"><b>${esc(r.event_name)}</b>${badge(r.status)}</div><div>${esc(r.booking_id)} · ${esc(r.customer_name||'-')}</div><div class="kkops-muted">${esc(r.package_type)} · รับ ${esc(r.pickup_time||'-')} · คืน ${esc(r.return_time||'-')}</div><div class="kkops-muted">📱 ${esc(r.phone_asset_id||'ยังไม่ assign')} · 🔭 ${esc(r.lens_asset_id||'—')} · เงิน ${esc(r.payment_status||'-')}</div></div>`).join('')}</div>`).join(''):'<div class="kkops-empty">ไม่มี Booking ในช่วงนี้</div>';
    const avail=E.availabilityMatrix(state.data,{from:state.from,to:state.to});
    document.getElementById('kkopsAvailability').innerHTML=avail.map(r=>`<tr class="${r.overbooked?'kkops-danger':''}"><td>${fmtDay(r.date)}</td><td>${r.booking_count}</td><td>${r.phone_free}/${r.phone_total}<small>demand ${r.phone_demand}</small></td><td>${r.lens_free}/${r.lens_total}<small>demand ${r.lens_demand}</small></td><td>${r.bundle_free}</td><td>${r.phone_unassigned+r.lens_unassigned}</td><td>${r.overbooked?'<b class="kkops-bad">OVERBOOK</b>':'<b class="kkops-good">OK</b>'}</td></tr>`).join('')||'<tr><td colspan="7">ไม่มีข้อมูล</td></tr>';
    const visible=issues.filter(x=>(!state.from||x.date>=state.from)&&(!state.to||x.date<=state.to)); document.getElementById('kkopsCollisionCount').textContent=`${visible.length} รายการ`;
    document.getElementById('kkopsCollisions').innerHTML=visible.map(x=>`<tr><td>${x.severity==='error'?'<b class="kkops-bad">ERROR</b>':'<b class="kkops-warn">WARN</b>'}</td><td>${fmtDay(x.date)}</td><td><code>${esc(x.code)}</code></td><td>${esc(x.asset_id||'-')}</td><td>${esc(x.booking_ids.join(', ')||'-')}</td><td>${esc(x.message)}</td></tr>`).join('')||'<tr><td colspan="6"><b class="kkops-good">ไม่พบ collision ในช่วงนี้</b></td></tr>';
  }

  function init(){ buildUi(); if(window.__KK_LAST_SNAPSHOT){state.data=window.__KK_LAST_SNAPSHOT;render();} window.addEventListener('kk:snapshot',e=>{state.data=e.detail;render();}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();