'use strict';
const VERSION='KK_INBOX_POSTGREST_STORE_V1';
function required(v,name){const s=String(v||'').trim();if(!s)throw Object.assign(new Error(name+' required'),{code:'INBOX_STORE_CONFIG_REQUIRED'});return s;}
function createPostgrestStore(options={}){
 const base=required(options.url||process.env.KK_INBOX_SUPABASE_URL,'KK_INBOX_SUPABASE_URL').replace(/\/$/,'');
 const key=required(options.serviceKey||process.env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY,'KK_INBOX_SUPABASE_SERVICE_ROLE_KEY');
 const fetchImpl=options.fetchImpl||fetch;
 async function rpc(name,payload){
  const r=await fetchImpl(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const body=await r.text();
  if(!r.ok) throw Object.assign(new Error('inbox persistence failed '+r.status),{code:'INBOX_PERSISTENCE_FAILED',status:r.status,provider_body:body.slice(0,200)});
  return body?JSON.parse(body):null;
 }
 async function persistInbound(message){
  const result=await rpc('kk_inbox_persist_inbound',{p_message:message});
  const row=Array.isArray(result)?result[0]:result;
  return {ok:true,duplicate:Boolean(row&&row.duplicate),message_id:message.message_id,writes:Number(row&&row.writes||0)};
 }
 return {VERSION,persistInbound};
}
module.exports={VERSION,createPostgrestStore};
