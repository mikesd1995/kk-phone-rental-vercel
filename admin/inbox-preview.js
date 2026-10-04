(function(){
'use strict';
const VERSION='KK_ADMIN_INBOX_V4_OWNER_LABEL';
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected='',selectedRow=null,outboundEnabled=false,hydrating=false,sending=false,renaming=false;

function pin(){try{return sessionStorage.getItem('kk_admin_pin')||''}catch(_){return ''}}
function rowLabel(row){return String(row?.owner_label||row?.display_name||row?.external_user_id||'').trim()}
function providerLabel(row){return String(row?.display_name||row?.external_user_id||'').trim()}
function hasCustomLabel(row){return !!String(row?.owner_label||'').trim()}
async function api(action,params={}){
 const body=Object.assign({action},params);
 const r=await fetch('/api/kk-admin-guard',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':pin()},body:JSON.stringify(body),cache:'no-store'});
 const d=await r.json().catch(()=>({ok:false,error:'Invalid Inbox response'}));
 if(!r.ok||!d.ok){const e=new Error(d.error||'Inbox request failed');e.code=d.error_code||'';throw e}
 return d;
}
function showError(e){
 const list=$('#inboxConversationList');
 if(list)list.innerHTML='<div class="inbox-placeholder"><strong>โหลด Inbox ไม่สำเร็จ</strong><span>'+esc(e.message)+'</span></div>';
}
function composeState(message){
 const box=$('#inboxComposeText'),btn=$('#inboxSendBtn'),status=$('#inboxComposeStatus');
 const canSend=!!selectedRow&&String(selectedRow.channel||'').toLowerCase()==='line'&&outboundEnabled&&!sending;
 if(box)box.disabled=!canSend;
 if(btn)btn.disabled=!canSend;
 if(status)status.textContent=message||(canSend?'พร้อมส่งผ่าน LINE · ต้องยืนยันทุกครั้งก่อนส่ง':(selectedRow&&String(selectedRow.channel||'').toLowerCase()!=='line'?'ยังไม่เปิดส่งสำหรับช่องทางนี้':'เลือกแชท LINE เพื่อเริ่มตอบลูกค้า'));
}
function renderThreadHeader(){
 const title=$('#inboxThreadTitle'),meta=$('#inboxThreadMeta'),rename=$('#inboxRenameBtn');
 if(!selectedRow){
  if(title)title.textContent='เลือกบทสนทนา';
  if(meta)meta.textContent='LINE / X';
  if(rename)rename.disabled=true;
  return;
 }
 const custom=hasCustomLabel(selectedRow);
 if(title)title.textContent=rowLabel(selectedRow)||'บทสนทนา';
 if(meta){
  const channel=String(selectedRow.channel||'').toUpperCase();
  const provider=providerLabel(selectedRow);
  meta.textContent=custom&&provider&&provider!==rowLabel(selectedRow)?channel+' · ชื่อโปรไฟล์: '+provider:channel;
 }
 if(rename)rename.disabled=false;
}
function renderList(rows){
 const list=$('#inboxConversationList'),count=$('#inboxCount');
 if(count)count.textContent=rows.length+' รายการ';
 if(!list)return;
 if(!rows.length){
  list.innerHTML='<div class="inbox-placeholder"><strong>ยังไม่มีบทสนทนา</strong><span>ข้อความ LINE/X ที่ผ่าน signed webhook จะปรากฏที่นี่</span></div>';
  return;
 }
 list.innerHTML=rows.map(r=>{
  const custom=hasCustomLabel(r),provider=providerLabel(r),label=rowLabel(r),channel=String(r.channel||'').toUpperCase();
  const providerRow=custom&&provider&&provider!==label?'<small class="inbox-provider-name">'+esc(channel)+': '+esc(provider)+'</small>':'';
  return '<button type="button" class="inbox-conversation'+(r.conversation_id===selected?' active':'')+'" data-inbox-id="'+esc(r.conversation_id)+'">'+
   '<span><b>'+esc(label)+'</b><em>'+esc(String(r.channel||'').toUpperCase())+'</em></span>'+
   providerRow+
   '<small class="inbox-last-message">'+esc(r.last_message_text||r.last_message_type||'')+'</small>'+
   '<i>'+Number(r.unread_count||0)+' unread</i></button>';
 }).join('');
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
   if(refreshed)selectedRow=refreshed;
  }
  renderThreadHeader();
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
 renderThreadHeader();
 composeState();
 try{
  const d=await api('inboxListMessages',{conversation_id:id,limit:'200'});
  outboundEnabled=d.outbound_enabled===true;
  renderThread(d.messages||[]);
  composeState();
 }catch(e){
  $('#inboxThread').innerHTML='<div class="inbox-placeholder">'+esc(e.message)+'</div>';
  composeState('โหลดข้อความไม่สำเร็จ');
 }
}
function updateRenameCount(){
 const input=$('#inboxRenameInput'),count=$('#inboxRenameCount');
 if(count)count.textContent=Array.from(String(input?.value||'')).length+'/80';
}
function openRenameDialog(){
 if(!selectedRow)return;
 const dialog=$('#inboxRenameDialog'),input=$('#inboxRenameInput'),error=$('#inboxRenameError'),profile=$('#inboxRenameProfile');
 if(!dialog||!input)return;
 input.value=String(selectedRow.owner_label||selectedRow.display_name||'').trim();
 if(error){error.textContent='';error.hidden=true}
 if(profile)profile.textContent='ชื่อจาก '+String(selectedRow.channel||'LINE').toUpperCase()+': '+(providerLabel(selectedRow)||'ไม่พบชื่อโปรไฟล์');
 updateRenameCount();
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 setTimeout(()=>{input.focus();input.select()},0);
}
function closeRenameDialog(){
 const dialog=$('#inboxRenameDialog');
 if(!dialog)return;
 if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
}
async function saveOwnerLabel(){
 if(renaming||!selectedRow)return;
 const input=$('#inboxRenameInput'),save=$('#inboxRenameSave'),error=$('#inboxRenameError');
 const value=String(input?.value||'').normalize('NFKC').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
 if(Array.from(value).length>80){
  if(error){error.textContent='ชื่อที่ร้านตั้งต้องไม่เกิน 80 ตัวอักษร';error.hidden=false}
  return;
 }
 renaming=true;if(save)save.disabled=true;
 try{
  const d=await api('inboxSetOwnerLabel',{conversation_id:selected,owner_label:value});
  if(d.conversation)selectedRow=d.conversation;
  closeRenameDialog();
  renderThreadHeader();
  await loadList(false);
 }catch(e){
  if(error){error.textContent='บันทึกชื่อไม่สำเร็จ: '+e.message;error.hidden=false}
 }finally{renaming=false;if(save)save.disabled=false}
}
async function resetOwnerLabel(){
 const input=$('#inboxRenameInput');
 if(input)input.value='';
 updateRenameCount();
 await saveOwnerLabel();
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
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>loadList(),180)}
function bind(){
 ['#inboxChannelFilter','#inboxStatusFilter'].forEach(s=>$(s)?.addEventListener('change',()=>loadList()));
 $('#inboxSearch')?.addEventListener('input',schedule);
 $('#inboxSendBtn')?.addEventListener('click',sendMessage);
 $('#inboxComposeText')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();sendMessage()}});
 $('#inboxRenameBtn')?.addEventListener('click',openRenameDialog);
 $('#inboxRenameCancel')?.addEventListener('click',closeRenameDialog);
 $('#inboxRenameCancelBottom')?.addEventListener('click',closeRenameDialog);
 $('#inboxRenameSave')?.addEventListener('click',saveOwnerLabel);
 $('#inboxRenameReset')?.addEventListener('click',resetOwnerLabel);
 $('#inboxRenameInput')?.addEventListener('input',updateRenameCount);
 $('#inboxRenameInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveOwnerLabel()}});
 $('#inboxRenameDialog')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeRenameDialog()});
 document.querySelectorAll('[data-tab="inbox"],[data-tab-jump="inbox"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>loadList(),0)));
 document.documentElement.dataset.kkInboxPreview=VERSION;
 renderThreadHeader();
 composeState();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.KKInboxPreview=Object.freeze({VERSION,mode:'owner-approved-line-send-with-owner-label',autoMerge:false,reload:loadList,get outboundEnabled(){return outboundEnabled}});
})();
