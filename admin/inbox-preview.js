(function(){
'use strict';
const VERSION='KK_ADMIN_INBOX_V7_PRIVATE_LINE_IMAGES';
const POLL_MS=4000;
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const MESSAGE_TYPE_LABELS=Object.freeze({
 text:'ข้อความ',sticker:'สติกเกอร์',image:'รูปภาพ',video:'วิดีโอ',audio:'เสียง',
 file:'ไฟล์',location:'ตำแหน่ง',flex:'การ์ด',template:'การ์ด',imagemap:'รูปภาพแบบโต้ตอบ'
});
let selected='',selectedRow=null,outboundEnabled=false,hydrating=false,sending=false,renaming=false;
let searchTimer=null,pollTimer=null,pollBusy=false,lastRefreshAt=0;
// Read-only request version for the displayed conversation; prevents stale replies.
let threadRequestSeq=0;
let listRequestSeq=0;
let inboxImageUrls=[];

function pin(){try{return sessionStorage.getItem('kk_admin_pin')||''}catch(_){return ''}}
function rowLabel(row){return String(row?.owner_label||row?.display_name||row?.external_user_id||'').trim()}
function providerLabel(row){return String(row?.display_name||row?.external_user_id||'').trim()}
function hasCustomLabel(row){return !!String(row?.owner_label||'').trim()}
function typeLabel(value){
 const type=String(value||'text').trim().toLowerCase();
 return MESSAGE_TYPE_LABELS[type]||type||'ข้อความ';
}
function messagePreview(row){
 const body=String(row?.last_message_text||'').trim();
 return body||typeLabel(row?.last_message_type||'text');
}
function messageBody(message){
 const body=String(message?.body_text||'').trim();
 if(body)return body;
 const type=String(message?.message_type||'text').trim().toLowerCase();
 if(type==='image')return 'รูปภาพ (ไม่มีไฟล์ภาพที่เปิดได้)';
 if(type==='video')return 'วิดีโอ (ยังเปิดดูไฟล์จาก Inbox นี้ไม่ได้)';
 if(type==='audio')return 'ข้อความเสียง (ยังเปิดฟังจาก Inbox นี้ไม่ได้)';
 if(type==='file')return 'ไฟล์แนบ (ยังเปิดจาก Inbox นี้ไม่ได้)';
 return typeLabel(type);
}
function fmtMessageTime(value){
 const raw=String(value||'').trim();
 if(!raw)return '';
 const d=new Date(raw);
 if(Number.isNaN(d.getTime()))return raw;
 try{
  return new Intl.DateTimeFormat('th-TH',{
   timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'2-digit',
   hour:'2-digit',minute:'2-digit',second:'2-digit'
  }).format(d);
 }catch(_){return raw}
}
function conversationVersion(row){
 if(!row)return '';
 return [
  String(row.last_message_at||''),
  String(row.updated_at||''),
  String(row.unread_count||0),
  String(row.last_message_type||''),
  String(row.last_message_text||'')
 ].join('|');
}
function isInboxActive(){
 const panel=$('#tab-inbox');
 return !!(panel&&panel.classList.contains('active')&&!document.hidden);
}
function liveStatus(textValue,state=''){
 const el=$('#inboxLiveStatus');if(!el)return;
 el.textContent=textValue;
 el.dataset.state=state;
}
function markRefreshed(){
 lastRefreshAt=Date.now();
 const t=new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(lastRefreshAt));
 liveStatus('อัปเดตอัตโนมัติ · ล่าสุด '+t,'ok');
}
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
  const unread=Math.max(0,Number(r.unread_count||0));
  const unreadBadge=unread?'<i>'+unread+' ใหม่</i>':'';
  return '<button type="button" class="inbox-conversation'+(r.conversation_id===selected?' active':'')+'" data-inbox-id="'+esc(r.conversation_id)+'">'+
   '<span><b>'+esc(label)+'</b><em>'+esc(channel)+'</em></span>'+
   providerRow+
   '<small class="inbox-last-message">'+esc(messagePreview(r))+'</small>'+
   unreadBadge+'</button>';
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
  if(Number(d.hydrated||0)>0) await loadList(false,{silent:true,refreshSelected:true});
 }catch(_){}
 finally{hydrating=false}
}
function releaseInboxImages(){
 for(const url of inboxImageUrls)URL.revokeObjectURL(url);
 inboxImageUrls=[];
}
async function openInboxImage(node,conversationId,messageId){
 const status=node.querySelector('.inbox-image-status');
 if(status)status.textContent='กำลังโหลดรูปภาพ…';
 try{
  const response=await fetch('/api/kk-admin-guard',{
   method:'POST',cache:'no-store',credentials:'same-origin',
   headers:{'Content-Type':'application/json','X-Admin-Pin':pin()},
   body:JSON.stringify({action:'inboxGetImage',conversation_id:conversationId,message_id:messageId})
  });
  if(!response.ok){
   const failure=await response.json().catch(()=>({}));
   const e=new Error('เปิดภาพไม่สำเร็จ');e.code=failure.error_code||'';throw e;
  }
  const mime=String(response.headers.get('content-type')||'').split(';')[0];
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(mime))throw new Error('ชนิดรูปภาพไม่ถูกต้อง');
  const imageBlob=await response.blob();
  if(imageBlob.size>8*1024*1024||!imageBlob.size)throw new Error('ขนาดไฟล์รูปภาพไม่ถูกต้อง');
  const url=URL.createObjectURL(imageBlob);
  if(!node.isConnected||selected!==conversationId){URL.revokeObjectURL(url);return;}
  inboxImageUrls.push(url);
  const button=document.createElement('button');
  button.type='button';button.className='inbox-image-open';button.title='แตะเพื่อเปิดรูปขนาดเต็ม';
  const img=document.createElement('img');
  img.src=url;img.alt='รูปภาพจากลูกค้าผ่าน LINE';img.className='inbox-media-image';img.loading='lazy';
  button.append(img);
  button.addEventListener('click',()=>window.open(url,'_blank','noopener,noreferrer'));
  node.replaceChildren(button);
 }catch(err){
  if(!node.isConnected||selected!==conversationId)return;
  const missing=['INBOX_MEDIA_NOT_ARCHIVED','INBOX_LINE_MEDIA_EXPIRED','INBOX_LINE_MEDIA_ID_MISSING'].includes(err.code);
  node.textContent=missing?'รูปภาพเก่าไม่มีไฟล์สำรองในระบบ':'เปิดรูปไม่สำเร็จ ';
  if(!missing){
   const retry=document.createElement('button');retry.type='button';retry.textContent='ลองใหม่';
   retry.className='inbox-image-retry';retry.addEventListener('click',()=>openInboxImage(node,conversationId,messageId));
   node.append(retry);
  }
 }
}
function hydrateInboxImages(container,conversationId){
 container.querySelectorAll('[data-inbox-image]').forEach(node=>
  openInboxImage(node,conversationId,node.dataset.inboxImage));
}

function renderThread(messages,{preserveScroll=false}={}){
 const n=$('#inboxThread');if(!n)return {wasNearBottom:true};
 releaseInboxImages();
 const oldTop=n.scrollTop;
 const wasNearBottom=(n.scrollHeight-n.scrollTop-n.clientHeight)<96;
 n.innerHTML=(messages||[]).map(m=>
  '<div class="inbox-message '+esc(m.direction||'inbound')+'">'+
   '<small>'+esc(typeLabel(m.message_type||'text'))+'</small>'+
   (m.message_type==='image'&&m.channel==='line'&&m.direction==='inbound' ?
    '<div class="inbox-image-slot" data-inbox-image="'+esc(m.message_id||'')+'"><span class="inbox-image-status">กำลังโหลดรูปภาพ…</span></div>' :
    '<p>'+esc(messageBody(m))+'</p>')+
   '<time title="'+esc(String(m.received_at||m.sent_at||m.created_at||''))+'">'+esc(fmtMessageTime(m.received_at||m.sent_at||m.created_at||''))+'</time>'+
  '</div>'
 ).join('')||'<div class="inbox-placeholder">ยังไม่มีข้อความ</div>';
 hydrateInboxImages(n,selected);
 if(!preserveScroll||wasNearBottom)n.scrollTop=n.scrollHeight;
 else n.scrollTop=oldTop;
 return {wasNearBottom};
}
function clearUnreadBadge(conversationId){
 const button=[...document.querySelectorAll('[data-inbox-id]')].find(el=>String(el.dataset.inboxId||'')===String(conversationId||''));
 if(button){
  const badge=button.querySelector('i');
  if(badge)badge.remove();
 }
}
async function markConversationRead(conversationId){
 if(!selectedRow||String(selectedRow.conversation_id||'')!==String(conversationId||'')||Number(selectedRow.unread_count||0)<=0)return;
 try{
  const d=await api('inboxMarkRead',{conversation_id:conversationId});
  if(selected!==String(conversationId||''))return;
  if(d.conversation)selectedRow=d.conversation;
  else selectedRow=Object.assign({},selectedRow,{unread_count:0});
  clearUnreadBadge(conversationId);
  renderThreadHeader();
 }catch(_){
  // Mark-read is convenience metadata; never hide an otherwise readable thread on failure.
 }
}
async function loadThread(id,row,options={}){
 const requestId=String(id||'');
 const requestSeq=++threadRequestSeq;
 selected=requestId;selectedRow=row||selectedRow||null;
 renderThreadHeader();
 composeState();
 try{
  const d=await api('inboxListMessages',{conversation_id:requestId,limit:'200'});
  if(selected!==requestId||requestSeq!==threadRequestSeq)return;
  outboundEnabled=d.outbound_enabled===true;
  const renderState=renderThread(d.messages||[],{preserveScroll:options.preserveScroll===true});
  const shouldMarkRead=options.markRead!==false&&(!options.preserveScroll||renderState.wasNearBottom);
  if(shouldMarkRead)await markConversationRead(requestId);
  if(selected!==requestId||requestSeq!==threadRequestSeq)return;
  composeState();
  if(options.markRefresh!==false)markRefreshed();
 }catch(e){
  // An older failing request must not replace a newer successful thread.
  if(selected!==requestId||requestSeq!==threadRequestSeq)return;
  if(options.silent){
   liveStatus('กำลังเชื่อมต่อใหม่…','warn');
   return;
  }
  if(selected===requestId)$('#inboxThread').innerHTML='<div class="inbox-placeholder">'+esc(e.message)+'</div>';
  composeState('โหลดข้อความไม่สำเร็จ');
 }
}
async function loadList(runHydration=true,options={}){
 const requestSeq=++listRequestSeq;
 try{
  const d=await api('inboxListConversations',{channel:$('#inboxChannelFilter')?.value||'',status:$('#inboxStatusFilter')?.value||'',search:$('#inboxSearch')?.value||'',limit:'100'});
  // Overlapping search/poll/manual requests must not overwrite newer lists.
  if(requestSeq!==listRequestSeq)return null;
  const previousVersion=conversationVersion(selectedRow);
  outboundEnabled=d.outbound_enabled===true;
  const rows=d.conversations||[];
  renderList(rows);
  let selectedChanged=false;
  if(selected){
   const refreshed=rows.find(r=>r.conversation_id===selected);
   if(refreshed){
    selectedChanged=conversationVersion(refreshed)!==previousVersion;
    selectedRow=refreshed;
   }
  }
  renderThreadHeader();
  composeState();
  if((options.forceSelected===true||options.refreshSelected===true&&selectedChanged)&&selected&&selectedRow){
   await loadThread(selected,selectedRow,{preserveScroll:true,silent:options.silent===true,markRefresh:false});
  }
  markRefreshed();
  if(runHydration)hydrateMissingProfiles(rows,d.profile_hydration_enabled===true);
  return rows;
 }catch(e){
  if(requestSeq!==listRequestSeq)return null;
  if(options.silent){
   liveStatus('กำลังเชื่อมต่อใหม่…','warn');
   return null;
  }
  showError(e);composeState('Inbox ยังไม่พร้อม: '+e.message);
  liveStatus('อัปเดตไม่สำเร็จ','error');
  return null;
 }
}
async function refreshInboxNow({forceThread=false,silent=true}={}){
 if(!isInboxActive())return;
 if(pollBusy)return;
 pollBusy=true;
 try{
  await loadList(false,{silent,refreshSelected:true,forceSelected:forceThread});
 }finally{pollBusy=false}
}
async function pollInbox(){
 if(!isInboxActive()||pollBusy||sending||renaming)return;
 await refreshInboxNow({forceThread:false,silent:true});
}
function startPolling(){
 if(pollTimer)return;
 pollTimer=setInterval(pollInbox,POLL_MS);
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
  await loadList(false,{silent:true,forceSelected:false});
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
 const conversationId=String(selected||'');
 const box=$('#inboxComposeText'),originalDraft=String(box?.value||''),body=originalDraft.trim();
 if(!conversationId||!body){composeState('กรอกข้อความก่อนส่ง');return}
 if(!window.confirm('ยืนยันส่งข้อความนี้ถึงลูกค้าผ่าน LINE?'))return;
 sending=true;composeState('กำลังส่งผ่าน LINE…');
 try{
  // Keep the approved recipient and draft stable while LINE is in flight.
  await api('inboxSendLineMessage',{conversation_id:conversationId,text:body,owner_approved:true});
  if(selected===conversationId){
   if(box&&box.value===originalDraft)box.value='';
   composeState('ส่งสำเร็จและบันทึกใน Inbox แล้ว');
   await loadThread(conversationId,selectedRow,{preserveScroll:false,markRead:true});
  }
  await loadList(false,{silent:true});
 }catch(e){
  if(selected===conversationId)composeState('ส่งไม่สำเร็จ: '+e.message);
 }finally{sending=false;composeState()}
}
function scheduleSearch(){
 clearTimeout(searchTimer);
 searchTimer=setTimeout(()=>loadList(false,{silent:true,refreshSelected:true}),180);
}
function bind(){
 ['#inboxChannelFilter','#inboxStatusFilter'].forEach(s=>$(s)?.addEventListener('change',()=>loadList(false,{silent:true,refreshSelected:true})));
 $('#inboxSearch')?.addEventListener('input',scheduleSearch);
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
 document.querySelectorAll('[data-tab="inbox"],[data-tab-jump="inbox"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>refreshInboxNow({forceThread:true,silent:true}),0)));
 $('#refreshBtn')?.addEventListener('click',()=>{if(isInboxActive())refreshInboxNow({forceThread:true,silent:true})});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInboxNow({forceThread:true,silent:true})});
 window.addEventListener('focus',()=>refreshInboxNow({forceThread:true,silent:true}));
 window.addEventListener('online',()=>refreshInboxNow({forceThread:true,silent:true}));
 document.documentElement.dataset.kkInboxPreview=VERSION;
 renderThreadHeader();
 composeState();
 liveStatus('อัปเดตอัตโนมัติทุก 4 วินาที','idle');
 startPolling();
 setTimeout(()=>refreshInboxNow({forceThread:true,silent:true}),0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.KKInboxPreview=Object.freeze({
 VERSION,
 mode:'owner-approved-line-send-owner-label-live-refresh-read-state',
 autoMerge:false,
 pollMs:POLL_MS,
 reload:()=>refreshInboxNow({forceThread:true,silent:false}),
 get outboundEnabled(){return outboundEnabled},
 get lastRefreshAt(){return lastRefreshAt}
});
})();
