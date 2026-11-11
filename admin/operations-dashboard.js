/* KK Phone Rental — authenticated read-only operations view. No business writes. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else factory().mount(root.document,root);
})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const AUTH='/api/kk-admin-auth', SNAPSHOT='/api/kk-admin?action=operationsSnapshot';
const MAX_AGE_MS=180000;
const CLOSED=new Set(['completed','complete','cancelled','canceled','no_show','rejected','closed']);
const ACTIVE=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const SAFE_LOCK=new Set(['SEEN_CORE','REOPENED']);
const display=(v,max=180)=>String(v??'').slice(0,max);
const amount=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)&&n>=0?n:null};
// Inventory counts must be non-negative whole units, not fractions or overflow values.
const stockCount=v=>{const n=amount(v);return n!==null&&Number.isSafeInteger(n)?n:null};
function isoDate(v){
 const s=display(v,40).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(!m){const d=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(d)m=[s,d[3],d[2],d[1]];}
 if(!m)return '';
 let y=+m[1],month=+m[2],day=+m[3];if(y>2500)y-=543;
 if(!Number.isInteger(y)||month<1||month>12||day<1||day>31)return '';
 const dt=new Date(Date.UTC(y,month-1,day));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)return '';
 return String(y).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function bangkokToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
}
function bangkokClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
const safePoster=s=>{try{const u=new URL(display(s,1000));return u.protocol==='https:'?u.href:'';}catch(_){return ''}};
function text(node,value){node.textContent=display(value,2000);return node}
function node(doc,tag,cls,content){const n=doc.createElement(tag);if(cls)n.className=cls;if(content!==undefined)text(n,content);return n}
function normalize(source,now=new Date()){
 const root=(source&&typeof source==='object')?source:{};
 if(root.ok===false)throw new Error('SNAPSHOT_REJECTED');
 const d=root.data&&typeof root.data==='object'?root.data:root.snapshot&&typeof root.snapshot==='object'?root.snapshot:root;
 // Reject unfiltered Admin snapshots: server must remove customer PII first.
 if(d.projection_version!=='kk-admin-ops-projection-v1')throw new Error('OPS_PROJECTION_REQUIRED');
 // Core arrays are required. Deployed Apps Script's primary snapshot may omit Owner Locks.
 // Missing locks must downgrade every event to HOLD, not hide the entire read-only dashboard.
 const required=['events','web_ready','web_packages','bookings'];
 const locksAvailable=Array.isArray(d.visibility_locks);
 const missing=required.filter(k=>!Array.isArray(d[k]));
 if(missing.length)throw new Error('SOURCE_INCOMPLETE:'+missing.join(','));
 if(!d.web_ready.length||!d.web_packages.length||!d.events.length)throw new Error('SOURCE_EMPTY');
 const sourceTime=String(d.generated_at||'').trim();
 // The Apps Script formatter uses Session.getScriptTimeZone(); owner evidence previously
 // confirmed Asia/Bangkok. The returned timestamp has no UTC offset.
 const localBangkokTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(sourceTime);
 const fetched=Date.parse(localBangkokTime?sourceTime+'+07:00':sourceTime);
 const fresh=Number.isFinite(fetched)&&fetched<=+now+15000&&(+now-fetched)<=MAX_AGE_MS;
 const reader=String(d.fallback_reader||'').trim().toLowerCase();
 const sourceLabel=String(d.snapshot_source||'').trim().toLowerCase();
 const viaPublic=reader==='public-gviz'||sourceLabel.includes('public-gviz');
 // Only a matching, known private transport may assert rentable stock.
 // Unknown/missing/mismatched origins remain visible for audit, but HOLD.
 const privateSourceVerified=!viaPublic&&(
  (reader==='private-service-account'&&(
   sourceLabel==='private-service-account'||sourceLabel==='direct-sheet-private-service-account-readonly-fallback'
  ))||
  (reader==='private-owner-apps-script'&&(
   sourceLabel==='private-owner-apps-script'||sourceLabel==='direct-sheet-private-owner-apps-script-readonly-fallback'
  ))
 );
 const uniqueIds=(rows,key)=>{const seen=new Set();for(const row of rows){const id=String(row&&row[key]||'').trim();if(!id)continue;if(seen.has(id))throw new Error('DUPLICATE_'+key.toUpperCase());seen.add(id);}};
 uniqueIds(d.events,'event_id');uniqueIds(d.web_packages,'package_id');
 const eventById=new Map(d.events.map(e=>[String(e.event_id||''),e]));
 const byPackage=new Map();d.web_packages.forEach(p=>{const id=String(p.event_id||'');if(!id)return;const a=byPackage.get(id)||[];a.push(p);byPackage.set(id,a)});
 const bookingById=new Map(),badBooking=new Set(),seenBookings=new Map();d.bookings.forEach(b=>{
  const id=String(b.event_id||'').trim();if(!id)return;
  const bookingId=String(b.booking_id||'').trim();
  // Never treat records without a unique Booking identity as verified counts.
  if(!bookingId)badBooking.add(id);
  else if(seenBookings.has(bookingId)){badBooking.add(id);badBooking.add(seenBookings.get(bookingId));}
  else seenBookings.set(bookingId,id);
  const status=String(b.booking_status||'').trim().toLowerCase();
  if(!CLOSED.has(status)&&!ACTIVE.has(status))badBooking.add(id);
  const n=bookingById.get(id)||{total:0,active:0};n.total++;if(ACTIVE.has(status))n.active++;bookingById.set(id,n);
 });
 const lockById=new Map();(locksAvailable?d.visibility_locks:[]).forEach(l=>{
  const id=String(l.event_id||'');if(!id)return;
  const v=String(l.lock_state||'').trim().toUpperCase();
  const list=lockById.get(id)||[];list.push(v);lockById.set(id,list);
 });
 const duplicateIds=new Set(),seen=new Set();
 const records=d.web_ready.map(r=>{
  const id=display(r.event_id,120).trim();if(seen.has(id))duplicateIds.add(id);seen.add(id);
  const coreRow=eventById.get(id);
  const sourceEvent=coreRow||{};
  // 01_Events is a separate visibility authority; derived 'show' is not enough.
  const activeValue=sourceEvent.active_on_web;
  const coreActive=activeValue===true||String(activeValue||'').trim().toLowerCase()==='true';
  const coreStatus=String(sourceEvent.status||'').trim().toLowerCase();
  const coreBookable=!!coreRow&&coreActive&&coreStatus==='open';
  const web=String(r.action_for_web||'unknown').trim().toLowerCase();
  const canAdvertiseReady=web==='show'&&coreBookable;
  const packages=byPackage.get(id)||[];
  const phone=packages.filter(p=>p.package_type==='phone_only');
  const bundle=packages.filter(p=>p.package_type==='phone_lens_bundle');
  const p=phone.length===1?phone[0]:null,b=bundle.length===1?bundle[0]:null;
  const pricePhone=p?amount(p.price):null,priceBundle=b?amount(b.price):null;
  const validPrice=pricePhone!==null&&pricePhone>0&&priceBundle!==null&&priceBundle>=pricePhone;
  const countPhone=p?stockCount(p.available_count):null,countBundle=b?stockCount(b.available_count):null;
  const stockClaim=stockCount(r.available_phone_count);
  // Both independent sources must indicate actual rentable phone capacity.
  // A package count cannot reopen a day the canonical Web Ready phone stock says is zero.
  let phoneReady=!!(canAdvertiseReady&&stockClaim!==null&&stockClaim>0&&p&&p.package_status==='available'&&countPhone!==null&&countPhone>0);
  let bundleReady=!!(canAdvertiseReady&&stockClaim!==null&&stockClaim>0&&b&&b.package_status==='available'&&countBundle!==null&&countBundle>0);
  const ambiguous=phone.length>1||bundle.length>1;
  const book=bookingById.get(id)||{total:0,active:0};
  const lockStates=[...new Set(lockById.get(id)||[])];
  const locked=lockStates.some(x=>!SAFE_LOCK.has(x));
  const conflict=lockStates.length>1;
  const webDate=isoDate(r.event_date||r.event_date_text);
  const eventDate=webDate||isoDate(sourceEvent.event_date);
  const guessedDate=id.match(/^EVT-(\d{4})(\d{2})(\d{2})-/);
  const coreDate=isoDate(sourceEvent.event_date);
  const coreVenue=String(sourceEvent.venue||'').trim().normalize('NFKC').toLocaleLowerCase('th');
  const webVenue=String(r.venue||'').trim().normalize('NFKC').toLocaleLowerCase('th');
   // Venue is a required independent identity authority. Empty or unconfirmed
   // Core/Web Ready venue must never be treated as a verified match.
   const unconfirmedVenue=/รอยืนยัน|รอประกาศ|ยังไม่ประกาศ|not yet confirmed|\b(?:tba|tbc|tbd)\b/i;
   const venueRisk=!!coreRow&&(!coreVenue||!webVenue||coreVenue!==webVenue||unconfirmedVenue.test(coreVenue)||unconfirmedVenue.test(webVenue));
   const dateRisk=!webDate||!eventDate||!!(guessedDate&&`${guessedDate[1]}-${guessedDate[2]}-${guessedDate[3]}`!==eventDate)
   ||!!(coreRow&&(!coreDate||coreDate!==eventDate||venueRisk));
  // A stale/contradictory date or venue is not an advertise-ready rental day.
  // A stale/private-source violation must not remain labelled "พร้อม" in the UI.
  // Keep the rows visible for inspection; only readiness claims fail closed.
  const sourceUnverified=!fresh||viaPublic||!privateSourceVerified;
  // A positive package count is not enough to advertise phone readiness.
  // Missing/conflicting Owner Locks, uncertain Booking identity/status, or
  // ambiguous pricing are an audit-only HOLD even when inventory is positive.
  const ownershipUnverified=!locksAvailable||!lockStates.length||lockStates.includes('')||locked||conflict;
  const bookingUnverified=badBooking.has(id);
  const packageUnverified=!validPrice||ambiguous;
  if(dateRisk||sourceUnverified||ownershipUnverified||bookingUnverified||packageUnverified){
   phoneReady=false;bundleReady=false;
  }
  const poster=safePoster(r.poster_image_url||sourceEvent.poster_url||sourceEvent.poster_image_url);
  const badPoster=!poster||/kk-brand-hero|placeholder|default-poster/i.test(poster);
  const qa=[];
  if(web==='show'&&!coreBookable)qa.push('เว็บเปิดแต่ Core ไม่ยืนยันเปิด');
  if(badPoster)qa.push('โปสเตอร์หายหรือเป็นภาพร้าน');
  if(sourceUnverified)qa.push('Snapshot ไม่สดหรือ Reader ไม่ผ่าน');
  if(ownershipUnverified)qa.push('Owner Locks ไม่มีหลักฐาน/ล็อก/สถานะขัดแย้ง');
  if(bookingUnverified)qa.push('Booking ตรวจไม่ผ่าน');
  if(dateRisk||!/\S/.test(r.venue||'')||/รอยืนยัน|not yet confirmed/i.test(r.venue||''))qa.push('วันที่/สถานที่ต้องตรวจ');
  if(!validPrice||ambiguous)qa.push('ราคา/แพ็กเกจไม่ครบหรือกำกวม');
  if(web==='show'&&((!sourceUnverified&&!phoneReady&&!bundleReady)||stockClaim===0||stockClaim===null))qa.push('สถานะเปิดแต่มือถือไม่พร้อม');
  if(eventDate>=bangkokToday(now)&&!book.total)qa.push('ไม่พบบุกกิ้งใน Snapshot');
  qa.push('ยังไม่มีหลักฐานราคาคู่แข่งใน Snapshot');
  const gate=[];
  if(web!=='show')gate.push('หน้าร้านไม่เปิด');
  if(!coreBookable)gate.push('01_Events / Core ไม่อนุญาตเปิดจอง');
  if(!phoneReady&&!bundleReady||stockClaim===0||stockClaim===null)gate.push('มือถือ/แพ็กเกจไม่พร้อม');
  if(!validPrice||ambiguous)gate.push('ราคา/รุ่นไม่ผ่าน');
  if(locked||conflict)gate.push('Owner Lock');
  if(!lockStates.length||lockStates.includes(''))gate.push('Owner Locks ไม่มีหลักฐาน');
  if(badBooking.has(id))gate.push('Booking ไม่ครบ/ID ซ้ำ/สถานะไม่รู้จัก');
  if(badPoster||dateRisk)gate.push('โปสเตอร์/วันที่');
  if(!fresh)gate.push('Snapshot ไม่สด');
  if(viaPublic)gate.push('Source เป็น public GViz fallback');
  if(!privateSourceVerified&&!viaPublic)gate.push('Source ไม่ยืนยัน private reader');
  gate.push('ยังไม่ยืนยัน Production และ X Post Log สด');
  return {id,name:display(r.event_name||sourceEvent.event_name,220),date:eventDate,venue:display(r.venue||sourceEvent.venue,180),poster,web,phone:pricePhone,bundle:priceBundle,phoneReady,bundleReady,stock:stockClaim,bookings:badBooking.has(id)?null:book.active,bookingTotal:badBooking.has(id)?null:book.total,lock:conflict?'CONFLICT':(!lockStates.length||lockStates.includes(''))?'UNKNOWN':locked?'LOCKED':lockStates.join(','),qa,gate,validPrice,ambiguous};
 }).filter(x=>x.id);
 if(duplicateIds.size)throw new Error('DUPLICATE_EVENT_ID');
 return {records,meta:{generatedAt:Number.isFinite(fetched)?new Date(fetched).toISOString():null,fresh,viaPublic,privateSourceVerified,snapshotSource:display(d.snapshot_source||'unknown'),xLogAvailable:false,locksAvailable,complete:missing.length===0&&locksAvailable}};
}
function mount(doc,win){
 const $=id=>doc.getElementById(id);const state={records:[],view:'table',meta:null,plans:[],ratio:60};
 const storageKey='kk_ops_dashboard_v4_draft_only';
 try{const saved=JSON.parse(win.localStorage.getItem(storageKey)||'{}');if(Array.isArray(saved.plans))state.plans=saved.plans.filter(p=>p&&p.status==='draft_pending_live_verification'&&typeof p.reason==='string').slice(0,200);if(Number.isFinite(saved.ratio)&&saved.ratio>=0&&saved.ratio<=100)state.ratio=saved.ratio;}catch(_){ }
 const persist=()=>{try{win.localStorage.setItem(storageKey,JSON.stringify({plans:state.plans.map(p=>({eventId:p.eventId,at:p.at,type:p.type,reason:p.reason,status:'draft_pending_live_verification'})),ratio:state.ratio}));}catch(_){ }};
 const status=(msg,cls='')=>{$('status').className='status '+cls;text($('status'),msg)};
 const addCell=(tr,s)=>tr.appendChild(text(node(doc,'td'),s));
 const tdWith=(tr,child)=>tr.appendChild(node(doc,'td')).appendChild(child);
 const card=(label,value)=>{const b=node(doc,'div','kpi');b.appendChild(node(doc,'strong','',String(value)));b.appendChild(node(doc,'span','',label));return b};
 function setFilters(){
  const months=[...new Set(state.records.map(e=>e.date.slice(0,7)).filter(Boolean))].sort();
  const venues=[...new Set(state.records.map(e=>e.venue).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const month=$('month'),venue=$('venue');const mv=month.value,vv=venue.value;
  month.replaceChildren(new Option('ทุกเดือน',''),...months.map(x=>new Option(x,x)));month.value=months.includes(mv)?mv:'';
  venue.replaceChildren(new Option('ทุกสถานที่',''),...venues.map(x=>new Option(x,x)));venue.value=venues.includes(vv)?vv:'';
 }
 function filtered(){const q=$('search').value.trim().toLocaleLowerCase('th'),m=$('month').value,dt=$('date').value,v=$('venue').value,w=$('visibility').value,st=$('stock').value,bk=$('booking').value,pr=$('price').value;
  return state.records.filter(e=>{
   const ready=e.phoneReady||e.bundleReady;
   const money=e.phone===null||e.bundle===null?'missing':`${e.phone}/${e.bundle}`;
   return (!q||[e.name,e.venue,e.id].join(' ').toLocaleLowerCase('th').includes(q))&&(!m||e.date.startsWith(m))&&(!dt||e.date===dt)&&(!v||e.venue===v)&&(!w||e.web===w)&&(!st||(st==='ready'?ready:st==='full'?(!ready&&e.stock===0):(!ready&&e.stock!==0)))&&(!bk||(bk==='unknown'?e.bookings===null:bk==='yes'?e.bookingTotal>0:e.bookingTotal===0))&&(!pr||(pr==='other'?!['490/590','590/690','790/990','missing'].includes(money):pr===money));
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'th'));
 }
 function openDetails(id){const e=state.records.find(x=>x.id===id);if(!e)return;const root=$('detailBody');root.replaceChildren();
  if(e.poster){const img=node(doc,'img');img.src=e.poster;img.alt='โปสเตอร์ '+e.name;img.referrerPolicy='no-referrer';root.appendChild(img)}
  const div=node(doc,'div','detail-text');div.appendChild(node(doc,'h3','',e.name));
  [e.date+' · '+e.venue,'Event ID: '+e.id,'เว็บ: '+e.web,'มือถือ: '+(e.stock??'ไม่ทราบ')+' · โทรศัพท์ '+(e.phone??'ไม่ระบุ')+' บาท / พร้อมเลนส์ '+(e.bundle??'ไม่ระบุ')+' บาท','บุกกิ้งใน Snapshot: '+(e.bookingTotal??'ไม่ทราบ'),'Owner Lock: '+e.lock,'ประเด็น QA: '+e.qa.join(' / ')].forEach(t=>div.appendChild(node(doc,'p','',t)));
  div.appendChild(node(doc,'h4','','Post safety gate: HOLD'));div.appendChild(node(doc,'p','reasons',e.gate.join(' / ')));
  const link=node(doc,'a','btn','ตรวจหน้าร้านจริง');link.href='https://kk-phone-rental.vercel.app/';link.target='_blank';link.rel='noopener noreferrer';div.appendChild(link);root.appendChild(div);$('details').hidden=false;$('details').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderTable(rows){const tbody=$('rows');tbody.replaceChildren();for(const e of rows.slice(0,450)){
  const tr=node(doc,'tr');const name=node(doc,'td');name.appendChild(node(doc,'div','name',e.name));name.appendChild(node(doc,'div','tiny',e.date));tr.appendChild(name);
  addCell(tr,e.venue);const tag=node(doc,'span','state '+(e.web==='show'?'good':e.web==='show_full'?'bad':'warn'),e.web==='show'?'เปิด':e.web==='show_full'?'เต็ม':e.web==='hide'?'ซ่อน':'ไม่ทราบ');tdWith(tr,tag);
  addCell(tr,(e.phoneReady||e.bundleReady)?`พร้อม ${e.stock??'?'} เครื่อง`:(e.stock===0?'ไม่มีเครื่อง':'ต้องตรวจ'));
  addCell(tr,(e.phone??'—')+' / '+(e.bundle??'—'));addCell(tr,e.bookingTotal===null?'รอตรวจ':String(e.bookingTotal));
  const btn=node(doc,'button','mini-btn',e.qa.length+' QA · ดู');btn.type='button';btn.addEventListener('click',()=>openDetails(e.id));tdWith(tr,btn);tbody.appendChild(tr)
 }if(!rows.length)tbody.appendChild(node(doc,'tr')).appendChild(text(node(doc,'td'), 'ไม่พบรายการ'));
 }
 function renderCalendar(rows){const cal=$('calendar');cal.replaceChildren();const grouped=new Map();for(const e of rows){if(!e.date)continue;const g=grouped.get(e.date)||[];g.push(e);grouped.set(e.date,g)}for(const [date,events] of [...grouped].sort((a,b)=>a[0].localeCompare(b[0]))){const d=node(doc,'div','cal-day');d.appendChild(node(doc,'strong','',date));events.slice(0,12).forEach(e=>{const b=node(doc,'button','',e.name+' · '+e.web);b.type='button';b.addEventListener('click',()=>openDetails(e.id));d.appendChild(b)});cal.appendChild(d)}}
 function renderQa(rows){const qa=$('qa');qa.replaceChildren();const groups=[['โปสเตอร์',x=>x.qa.some(v=>v.includes('โปสเตอร์'))],['วันที่/สถานที่',x=>x.qa.some(v=>v.includes('วันที่/สถานที่'))],['ราคาและแพ็กเกจ',x=>x.qa.some(v=>v.includes('ราคา/แพ็กเกจ'))],['เว็บเปิดแต่สต็อก/Core ไม่พร้อม',x=>x.qa.some(v=>v.includes('สถานะเปิด'))],['Snapshot/Reader ต้องตรวจ',x=>x.qa.some(v=>v.includes('Reader ไม่ผ่าน'))],['Owner Locks ต้องตรวจ',x=>x.qa.some(v=>v.includes('Owner Locks'))],['Booking ผิดปกติ',x=>x.qa.some(v=>v.includes('Booking ตรวจไม่ผ่าน'))],['ไม่มี Booking ใน Snapshot',x=>x.qa.some(v=>v.includes('ไม่พบบุกกิ้ง'))],['ยังไม่มีหลักฐานราคาคู่แข่ง',x=>x.qa.some(v=>v.includes('คู่แข่ง'))]];for(const [title,predicate] of groups){const items=rows.filter(predicate);const item=node(doc,'article','qa-box');item.appendChild(node(doc,'h3','',title+' · '+items.length));items.slice(0,40).forEach(e=>{const b=node(doc,'button','',e.date+' '+e.name);b.type='button';b.addEventListener('click',()=>openDetails(e.id));item.appendChild(b);item.appendChild(node(doc,'p','',e.venue))});if(items.length>40)item.appendChild(node(doc,'p','',`และอีก ${items.length-40} งาน (ใช้ตัวกรองเพื่อลดรายการ)`));qa.appendChild(item)}}
 function renderPlans(){const el=$('plans');el.replaceChildren();for(const p of state.plans){const e=state.records.find(x=>x.id===p.eventId);const card=node(doc,'div','plan-card');card.appendChild(node(doc,'strong','',p.at+' · '+(e?e.name:p.eventId)));card.appendChild(node(doc,'small','', 'ร่างรอตรวจสด · '+(p.type==='near'?'ใกล้วันเช่า':'เพิ่มเอนเกจ')));card.appendChild(node(doc,'div','',p.reason));const b=node(doc,'button','mini-btn','ลบร่าง');b.addEventListener('click',()=>{state.plans=state.plans.filter(x=>x!==p);persist();renderPlans()});card.appendChild(b);el.appendChild(card)} }
 function render(){setFilters();const rows=filtered();$('app').hidden=false;const kpis=$('kpis');kpis.replaceChildren(card('งานทั้งหมด',state.records.length),card('เปิดในชีต',state.records.filter(x=>x.web==='show').length),card('แสดงว่าเต็ม',state.records.filter(x=>x.web==='show_full').length),card('เว็บเปิดแต่ไม่พร้อม',state.records.filter(x=>x.qa.some(z=>z.includes('สถานะเปิด'))).length));$('resultCount').textContent='พบ '+rows.length+' งาน';renderTable(rows);renderCalendar(rows);renderQa(rows);
  const sel=$('postEvent');const old=sel.value;const options=state.records.filter(e=>e.web==='show').sort((a,b)=>a.date.localeCompare(b.date)).map(e=>new Option(e.date+' · '+e.name,e.id));sel.replaceChildren(new Option('เลือกงาน',''),...options);sel.value=state.records.some(e=>e.id===old)?old:'';
  renderPlans();$('ratio').value=state.ratio;$('ratioNear').textContent=state.ratio+'%';$('ratioEng').textContent=(100-state.ratio)+'%';
 }
 async function load(){status('กำลังยืนยันตัวตนและอ่านข้อมูลใหม่...');$('refresh').disabled=true;try{
  const auth=await win.fetch(AUTH,{method:'GET',credentials:'same-origin',cache:'no-store'});
  const identity=await auth.json().catch(()=>null);if(!auth.ok||!identity||identity.authenticated!==true)throw new Error('LOGIN_REQUIRED');
  const response=await win.fetch(SNAPSHOT,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('API_HTTP_'+response.status);
  const payload=await response.json();const data=normalize(payload);
  state.records=data.records;state.meta=data.meta;render();
  const issues=[];if(!data.meta.fresh)issues.push('Snapshot ไม่สดหรือไม่มี generated_at');if(data.meta.viaPublic)issues.push('Reader ยังเป็น public GViz fallback');if(!data.meta.privateSourceVerified&&!data.meta.viaPublic)issues.push('Reader ยังไม่ยืนยันว่าเป็น private transport');if(!data.meta.locksAvailable)issues.push('Owner Locks ไม่อยู่ใน Snapshot: งานทั้งหมด HOLD รอตรวจ');issues.push('ยังไม่มี X Post Log ใน Snapshot และยังไม่ได้ยืนยัน Production ที่ลูกค้าเห็น');
  status('อ่านข้อมูลหลังบ้านสำเร็จ '+data.records.length+' งาน · '+(data.meta.generatedAt||'ไม่ทราบเวลาต้นทาง')+' · '+issues.join(' · '),issues.length?'':'ready');
 }catch(e){state.records=[];state.meta=null;$('app').hidden=true;status('HOLD — ไม่แสดงข้อมูลหลังบ้าน เพราะ '+(e.message==='LOGIN_REQUIRED'?'ยังไม่ได้เข้าสู่ระบบ Admin: เปิด /admin เพื่อเข้าสู่ระบบ':display(e.message,100)),'error')}
 finally{$('refresh').disabled=false}}
 ['search','month','date','venue','visibility','stock','booking','price'].forEach(id=>$(id).addEventListener('input',()=>{const rows=filtered();$('resultCount').textContent='พบ '+rows.length+' งาน';renderTable(rows);renderCalendar(rows);renderQa(rows)}));
 doc.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;doc.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===btn));['table','calendar','qa','x'].forEach(k=>$(k+'View').hidden=k!==state.view)}));
 $('closeDetails').addEventListener('click',()=>{$('details').hidden=true});$('refresh').addEventListener('click',load);
 $('ratio').addEventListener('input',()=>{state.ratio=Number($('ratio').value);$('ratioNear').textContent=state.ratio+'%';$('ratioEng').textContent=100-state.ratio+'%';persist()});
 $('addPost').addEventListener('click',()=>{
  const id=$('postEvent').value,e=state.records.find(x=>x.id===id),at=$('postAt').value,reason=$('postReason').value.trim();
  if(!e||!at||!reason){$('postMessage').textContent='ระบุงาน เวลา และเหตุผลก่อน';return}
  const nowStr=bangkokClock();
  if(at<nowStr||at.slice(0,10)>e.date||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)){$('postMessage').textContent='เวลาโพสต์ย้อนหลังหรือเลยวันงาน';return}
  const blocking=e.gate.filter(v=>v!=='ยังไม่ยืนยัน Production และ X Post Log สด');
  if(blocking.length){$('postMessage').textContent='HOLD: '+blocking.join(' / ');return}
  if(state.plans.some(x=>x.eventId===id)){$('postMessage').textContent='รายการงานนี้มีร่างอยู่แล้ว';return}
  const ms=Date.parse(at+':00+07:00');if(state.plans.some(x=>Math.abs(Date.parse(x.at+':00+07:00')-ms)<1200000)){$('postMessage').textContent='เวลาโพสต์ชนกับร่างอื่น (ห่างกันไม่ถึง 20 นาที)';return}
  state.plans.push({eventId:id,at,reason:display(reason,350),type:$('postType').value,status:'draft_pending_live_verification'});persist();renderPlans();$('postMessage').textContent='บันทึกร่างในเบราว์เซอร์แล้ว ยังไม่อนุมัติให้โพสต์จริง';$('postReason').value='';
 });
 load();return {reload:load,inspect:()=>({meta:state.meta,count:state.records.length,plans:state.plans.length})};
}
return {normalize,isoDate,bangkokToday,bangkokClock,safePoster,mount};
});
