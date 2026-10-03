(function(){
'use strict';
const VERSION='KK_ADMIN_INBOX_READ_V2';
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected='';
function pin(){try{return sessionStorage.getItem('kk_admin_pin')||''}catch(_){return ''}}
async function api(params={}){
 const body=Object.assign({action:params.conversation_id?'inboxListMessages':'inboxListConversations'},params);
 const r=await fetch('/api/kk-admin-guard',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':pin()},body:JSON.stringify(body),cache:'no-store'});
 const d=await r.json().catch(()=>({ok:false,error:'Invalid Inbox response'})); if(!r.ok||!d.ok)throw new Error(d.error||'โหลด Inbox ไม่สำเร็จ'); return d;
}
function showError(e){const list=$('#inboxConversationList');if(list)list.innerHTML='<div class="inbox-placeholder"><strong>โหลด Inbox ไม่สำเร็จ</strong><span>'+esc(e.message)+'</span></div>'}
function renderList(rows){
 const list=$('#inboxConversationList'),count=$('#inboxCount'); if(count)count.textContent=rows.length+' รายการ';
 if(!list)return;if(!rows.length){list.innerHTML='<div class="inbox-placeholder"><strong>ยังไม่มีบทสนทนา</strong><span>ข้อความ LINE/X ที่ผ่าน signed webhook จะปรากฏที่นี่</span></div>';return}
 list.innerHTML=rows.map(r=>'<button type="button" class="inbox-conversation'+(r.conversation_id===selected?' active':'')+'" data-inbox-id="'+esc(r.conversation_id)+'"><span><b>'+esc(r.display_name||r.external_user_id)+'</b><em>'+esc(String(r.channel||'').toUpperCase())+'</em></span><small>'+esc(r.last_message_text||r.last_message_type||'')+'</small><i>'+Number(r.unread_count||0)+' unread</i></button>').join('');
 list.querySelectorAll('[data-inbox-id]').forEach(el=>el.addEventListener('click',()=>loadThread(el.dataset.inboxId,rows.find(r=>r.conversation_id===el.dataset.inboxId))));
}
async function loadList(){
 try{const d=await api({channel:$('#inboxChannelFilter')?.value||'',status:$('#inboxStatusFilter')?.value||'',search:$('#inboxSearch')?.value||'',limit:'100'});renderList(d.conversations||[])}catch(e){showError(e)}
}
async function loadThread(id,row){selected=id;$('#inboxThreadTitle').textContent=row?.display_name||row?.external_user_id||'บทสนทนา';$('#inboxThreadMeta').textContent=String(row?.channel||'').toUpperCase();
 try{const d=await api({conversation_id:id,limit:'200'}),n=$('#inboxThread');n.innerHTML=(d.messages||[]).map(m=>'<div class="inbox-message '+esc(m.direction||'inbound')+'"><small>'+esc(m.message_type||'text')+'</small><p>'+esc(m.body_text||'')+'</p><time>'+esc(m.received_at||m.sent_at||m.created_at||'')+'</time></div>').join('')||'<div class="inbox-placeholder">ยังไม่มีข้อความ</div>'}catch(e){$('#inboxThread').innerHTML='<div class="inbox-placeholder">'+esc(e.message)+'</div>'}
}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(loadList,180)}
function bind(){['#inboxChannelFilter','#inboxStatusFilter'].forEach(s=>$(s)?.addEventListener('change',loadList));$('#inboxSearch')?.addEventListener('input',schedule);document.querySelectorAll('[data-tab="inbox"],[data-tab-jump="inbox"]').forEach(el=>el.addEventListener('click',()=>setTimeout(loadList,0)));document.documentElement.dataset.kkInboxPreview=VERSION}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.KKInboxPreview=Object.freeze({VERSION,mode:'authenticated-read-only',productionWrites:0,outboundEnabled:false,autoMerge:false,reload:loadList});
})();