'use strict';
const VERSION='KK_INBOX_STORE_V1';

function clone(v){return JSON.parse(JSON.stringify(v));}
function createMemoryStore(seed={}){
 const messages=new Map(), conversations=new Map(), audits=[];
 for(const m of seed.messages||[]) messages.set(String(m.message_id),clone(m));
 for(const c of seed.conversations||[]) conversations.set(String(c.conversation_id),clone(c));

 async function persistInbound(message){
  const id=String(message&&message.message_id||'').trim();
  if(!id) throw Object.assign(new Error('message_id required'),{code:'INBOX_STORE_MESSAGE_ID_REQUIRED'});
  if(messages.has(id)) return {ok:true,duplicate:true,message_id:id,writes:0};
  const now=new Date().toISOString();
  const row=clone(message); messages.set(id,row);
  const cid=String(row.conversation_id||'').trim();
  const current=conversations.get(cid)||{
   conversation_id:cid,channel:row.channel,external_user_id:row.external_user_id,
   display_name:row.display_name||'',status:'new',linked_customer_id:'',linked_booking_id:'',created_at:now
  };
  current.last_message_at=row.received_at||now;
  current.last_message_text=row.text||'';
  current.last_message_type=row.message_type||'';
  current.unread_count=Math.max(0,Number(current.unread_count||0))+1;
  current.updated_at=now;
  conversations.set(cid,current);
  audits.push({action:'inbound_persisted',conversation_id:cid,message_id:id,at:now});
  return {ok:true,duplicate:false,message_id:id,writes:1};
 }
 function listConversations(options={}){
  const channel=String(options.channel||'').trim().toLowerCase();
  const status=String(options.status||'').trim().toLowerCase();
  const search=String(options.search||'').trim().toLowerCase();
  const limit=Math.min(200,Math.max(1,Number(options.limit||50)||50));
  return [...conversations.values()].filter(c=>{
   if(channel&&c.channel!==channel)return false;
   if(status&&c.status!==status)return false;
   if(search&&!([c.display_name,c.external_user_id,c.last_message_text,c.linked_customer_id,c.linked_booking_id].join(' ').toLowerCase().includes(search)))return false;
   return true;
  }).sort((a,b)=>String(b.last_message_at||'').localeCompare(String(a.last_message_at||''))).slice(0,limit).map(clone);
 }
 function listMessages(conversationId,options={}){
  const cid=String(conversationId||'').trim();
  const limit=Math.min(500,Math.max(1,Number(options.limit||100)||100));
  return [...messages.values()].filter(m=>m.conversation_id===cid)
   .sort((a,b)=>String(a.received_at||a.sent_at||'').localeCompare(String(b.received_at||b.sent_at||'')))
   .slice(-limit).map(clone);
 }
 function snapshot(options={}){
  const rows=listConversations(options);
  return {schema_version:VERSION,generated_at:new Date().toISOString(),counts:{conversations:rows.length,unread:rows.reduce((n,c)=>n+Number(c.unread_count||0),0)},conversations:rows};
 }
 return {persistInbound,listConversations,listMessages,snapshot,_test:{messages,conversations,audits}};
}
module.exports={VERSION,createMemoryStore};
