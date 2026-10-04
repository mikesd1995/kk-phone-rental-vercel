(function(){
'use strict';
const VERSION='KK_ADMIN_INBOX_V3';
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected='',selectedRow=null,outboundEnabled=false,hydrating=false,sending=false;
function pin(){try{return sessionStorage.getItem('kk_admin_pin')||''}catch(_){return ''}}
async function api(action,params={}){
 const body=Object.assign({action},params);
 const r=await fetch('/api/kk-admin-guard',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':pin()},body:JSON.stringify(body),cache:'no-store'});
 const d=await r.json().catch(()=>({ok:false,error:'Invalid Inbox response'}));
 if(!r.ok||!d.ok){const e=new Error(d.error||'Inbox request failed');e.code=d.error_code||'';throw e}
 return d;
}
function showError(e){const list=$('#inboxConversationList');if(list)list.innerHTML='<div class="inbox-placeholder"><strong>โหลด Inbox ไม่สำเร็จ</strong><span>'+esc(e.message)+'</span></div>'}
function composeState(message){
 const box=$('#inboxComposeText'),btn=$('#inboxSendBtn'),status=$('#inboxComposeStatus');
 const canSend=!!selectedRow&&String(selectedRow.channel||'').toLowerCase()==='line'&&outboundEnabled&&!sending;
 if(box)box.disabled=!canSend;
 if(btn)btn.disabled=!canSend;
 if(status)status.textContent=message||(canSend?'พร้อมส่งผ่าน LINE · ต้องยืนยันทุกครั้งก่อนส่ง':(selectedRow&&String(selectedRow.channel||'').toLowerCase()!=='line'?'ยังไม่เปิดส่งสำหรับช่องทางนี้':'เลือกแชท LINE เพื่อเริ่มตอบลูกค้า'));
}
function renderList(rows){
 const list=$('#inboxConversationList'),count=$('#inboxCount'); if(count)count.textContent=rows.length+' รายการ';
 if(!list)return;
 if(!rows.length){list.innerHTML='<div class="inbox-placeholder"><strong>ยังไม่มีบทสนทนา</strong><span>ข้อความ LINE/X ที่ผ่าน signed webhook จะปรากฏที่นี่</span></div>';return}
 list.innerHTML=rows.map(r=>'<button type="button" class="inbox-conversation'+(r.conversation_id===selected?' active':'')+'" data-inbox-id="'+esc(r.conversation_id)+'"><span><b>'+esc(r.display_name||r.external_user_id)+'</b><em>'+esc(String(r.channel||'').toUpperCase())+'</em></span><small>'+esc(r.last_message_text||r.last_message_type||'')+'</small><i>'+Number(r.unread_count||0)+' unread</i></button>').join('');
 list.querySelectorAll('[data-inbox-id]').forEach(el=>el.addEventListener('click',()=>loadThread(el.dataset.inboxId,rows.find(r=>r.conversation_id===el.dataset.inboxId))));
}
async function hydrateMissingProfiles(rows,enabled){
 if(hydrating||!enabled)return;
 const ids=[...new Set((rows||[]).filter(r=>String(r.channel||'').toLowerCase()==='line'&&!String(r.display_name||'').trim()).map(r=>String(r.external_user_id||'').trim()).filter(Boolean))].slice(0,20);
 if(!ids.length)return;
 hydrating=true;
 try{
  const d=await api('inboxHydrateLineProfiles',{external_user_ids:ids});
  if(Number(d.hydrated||0)>0) await loadList(false);
 }catch(_){}
 finally{hydrating=false}
}
async function loadList(runHydration=true){
 try{
  const d=await api('inboxListConversations',{channel:$('#inboxChannelFilter')?.value||'',status:$('#inboxStatusFilter')?.value||'',search:$('#inboxSearch')?.value||'',limit:'100'});
  outboundEnabled=d.outbound_enabled===true;
  const rows=d.conversations||[];
  renderList(rows);
  if(selected){
    const refreshed=rows.find(r=>r.conversation_id===selected);
    if(refreshed){selectedRow=refreshed;$('#inboxThreadTitle').textContent=refreshed.display_name||refreshed.external_user_id||'บทสนทนา';}
  }
  composeState();
  if(runHydration)hydrateMissingProfiles(rows,d.profile_hydration_enabled===true);
 }catch(e){showError(e);composeState('Inbox ยังไม่พร้อม: '+e.message)}
}
function renderThread(messages){
 const n=$('#inboxThread');if(!n)return;
 n.innerHTML=(messages||[]).map(m=>'<div class="inbox-message '+esc(m.direction||'inbound')+'"><small>'+esc(m.message_type||'text')+'</small><p>'+esc(m.body_text||'')+'</p><time>'+esc(m.received_at||m.sent_at||m.created_at||'')+'</time></div>').join('')||'<div class="inbox-placeholder">ยังไม่มีข้อความ</div>';
 n.scrollTop=n.scrollHeight;
}
async function loadThread(id,row){
 selected=id;selectedRow=row||null;
 $('#inboxThreadTitle').textContent=row?.display_name||row?.external_user_id||'บทสนทนา';
 $('#inboxThreadMeta').textContent=String(row?.channel||'').toUpperCase();
 composeState();
 try{
  const d=await api('inboxListMessages',{conversation_id:id,limit:'200'});
  outboundEnabled=d.outbound_enabled===true;
  renderThread(d.messages||[]);
  composeState();
 }catch(e){$('#inboxThread').innerHTML='<div class="inbox-placeholder">'+esc(e.message)+'</div>';composeState('โหลดข้อความไม่สำเร็จ')}
}
async function sendMessage(){
 if(sending||!selectedRow)return;
 const box=$('#inboxComposeText'),body=String(box?.value||'').trim();
 if(!body){composeState('กรอกข้อความก่อนส่ง');return}
 if(!window.confirm('ยืนยันส่งข้อความนี้ถึงลูกค้าผ่าน LINE?'))return;
 sending=true;composeState('กำลังส่งผ่าน LINE…');
 try{
  await api('inboxSendLineMessage',{conversation_id:selected,text:body,owner_approved:true});
  if(box)box.value='';
  composeState('ส่งสำเร็จและบันทึกใน Inbox แล้ว');
  await loadThread(selected,selectedRow);
  await loadList(false);
 }catch(e){composeState('ส่งไม่สำเร็จ: '+e.message)}
 finally{sending=false;composeState()}
}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(()=>loadList(),180)}
function bind(){
 ['#inboxChannelFilter','#inboxStatusFilter'].forEach(s=>$(s)?.addEventListener('change',()=>loadList()));
 $('#inboxSearch')?.addEventListener('input',schedule);
 $('#inboxSendBtn')?.addEventListener('click',sendMessage);
 $('#inboxComposeText')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();sendMessage()}});
 document.querySelectorAll('[data-tab="inbox"],[data-tab-jump="inbox"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>loadList(),0)));
 document.documentElement.dataset.kkInboxPreview=VERSION;
 composeState();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.KKInboxPreview=Object.freeze({VERSION,mode:'owner-approved-line-send',autoMerge:false,reload:loadList,get outboundEnabled(){return outboundEnabled}});
})();