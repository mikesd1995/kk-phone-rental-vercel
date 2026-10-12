'use strict';
const VERSION='KK_INBOX_POSTGREST_STORE_V4';
function required(v,name){const s=String(v||'').trim();if(!s)throw Object.assign(new Error(name+' required'),{code:'INBOX_STORE_CONFIG_REQUIRED'});return s;}
function createPostgrestStore(options={}){
 const base=required(options.url||process.env.KK_INBOX_SUPABASE_URL,'KK_INBOX_SUPABASE_URL').replace(/\/$/,'');
 const key=required(options.serviceKey||process.env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY,'KK_INBOX_SUPABASE_SERVICE_ROLE_KEY');
 const fetchImpl=options.fetchImpl||fetch;
 async function rpc(name,payload,code='INBOX_PERSISTENCE_FAILED'){
  const r=await fetchImpl(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const body=await r.text();
  if(!r.ok) throw Object.assign(new Error('inbox rpc failed '+r.status),{code,status:r.status,provider_body:body.slice(0,200)});
  return body?JSON.parse(body):null;
 }
 async function listConversations(query={}){
  return rpc('kk_inbox_list_conversations',{p_channel:String(query.channel||''),p_status:String(query.status||''),p_search:String(query.search||''),p_limit:Number(query.limit||100)},'INBOX_READ_FAILED');
 }
 async function listMessages(conversationId,query={}){
  return rpc('kk_inbox_list_messages',{p_conversation_id:String(conversationId||''),p_limit:Number(query.limit||200)},'INBOX_READ_FAILED');
 }
 async function getMediaMetadata(conversationId,messageId){
  // Only server-side service-role RPC can confirm exact conversation ownership.
  // Never expose provider media IDs or storage metadata directly to a browser.
  const result=await rpc('kk_inbox_media_metadata',{
   p_conversation_id:String(conversationId||'').trim(),
   p_message_id:String(messageId||'').trim()
  },'INBOX_MEDIA_METADATA_FAILED');
  return Array.isArray(result)?(result[0]||null):(result||null);
 }
 async function getConversation(conversationId){
  return rpc('kk_inbox_get_conversation',{p_conversation_id:String(conversationId||'')},'INBOX_READ_FAILED');
 }
 async function persistInbound(message){
  const result=await rpc('kk_inbox_persist_inbound',{p_message:message});
  const row=Array.isArray(result)?result[0]:result;
  return {ok:true,duplicate:Boolean(row&&row.duplicate),message_id:message.message_id,writes:Number(row&&row.writes||0)};
 }
 async function updateLineProfile(externalUserId,displayName){
  const result=await rpc('kk_inbox_update_line_profile',{p_external_user_id:String(externalUserId||''),p_display_name:String(displayName||'')});
  const row=Array.isArray(result)?result[0]:result;
  return {ok:true,updated:Boolean(row&&row.updated),writes:Number(row&&row.writes||0)};
 }
 async function setOwnerLabel(conversationId,ownerLabel,actor='owner'){
  return rpc('kk_inbox_set_owner_label',{
   p_conversation_id:String(conversationId||''),
   p_owner_label:String(ownerLabel==null?'':ownerLabel),
   p_actor:String(actor||'owner')
  },'INBOX_LABEL_UPDATE_FAILED');
 }
 async function markRead(conversationId,actor='owner'){
  return rpc('kk_inbox_mark_read',{
   p_conversation_id:String(conversationId||''),
   p_actor:String(actor||'owner')
  },'INBOX_MARK_READ_FAILED');
 }
 async function recordOutbound(message){
  const result=await rpc('kk_inbox_record_outbound',{p_message:message});
  const row=Array.isArray(result)?result[0]:result;
  return {ok:true,duplicate:Boolean(row&&row.duplicate),writes:Number(row&&row.writes||0)};
 }
 return {VERSION,persistInbound,listConversations,listMessages,getMediaMetadata,getConversation,updateLineProfile,setOwnerLabel,markRead,recordOutbound};
}
module.exports={VERSION,createPostgrestStore};
