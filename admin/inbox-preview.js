(function(){
'use strict';
const VERSION='KK_ADMIN_INBOX_PREVIEW_V1';
function $(s){return document.querySelector(s);}
function safe(v){return String(v==null?'':v);}
function renderEmpty(){
 const list=$('#inboxConversationList'), count=$('#inboxCount');
 if(count) count.textContent='0 รายการ · preview';
 if(list) list.innerHTML='<div class="inbox-placeholder"><strong>ยังไม่มี production conversation</strong><span>รอ durable store + signed LINE webhook route ผ่าน acceptance ก่อน</span></div>';
}
function filterPreview(){
 // Deliberately no network/provider calls in preview mode.
 renderEmpty();
}
function bind(){
 ['#inboxChannelFilter','#inboxStatusFilter','#inboxSearch'].forEach(sel=>{
  const el=$(sel); if(el) el.addEventListener(el.tagName==='INPUT'?'input':'change',filterPreview);
 });
 renderEmpty();
 document.documentElement.dataset.kkInboxPreview=VERSION;
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
window.KKInboxPreview=Object.freeze({VERSION,mode:'read-only-preview',productionWrites:0,outboundEnabled:false,autoMerge:false,safe});
})();
