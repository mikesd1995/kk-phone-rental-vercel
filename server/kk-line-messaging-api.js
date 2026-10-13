'use strict';

const PROFILE_URL='https://api.line.me/v2/bot/profile/';
const PUSH_URL='https://api.line.me/v2/bot/message/push';
const VERSION='KK_LINE_MESSAGING_API_V2_EXPLICIT_RETRY_KEY';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(value,name){
  const s=String(value||'').trim();
  if(!s) throw Object.assign(new Error(name+' required'),{code:'LINE_MESSAGING_CONFIG_REQUIRED'});
  return s;
}
function safeText(value,max){
  const s=String(value==null?'':value).trim();
  return max?s.slice(0,max):s;
}
async function getProfile(userId,token,fetchImpl=fetch){
  const id=required(userId,'LINE userId');
  const auth=required(token,'LINE channel access token');
  const r=await fetchImpl(PROFILE_URL+encodeURIComponent(id),{
    method:'GET',
    headers:{Authorization:'Bearer '+auth,'User-Agent':'KK-Admin-Inbox/1.0'}
  });
  if(r.status===400||r.status===404) return null;
  const body=await r.text();
  if(!r.ok) throw Object.assign(new Error('LINE profile failed '+r.status),{code:'LINE_PROFILE_FAILED',status:r.status,provider_body:body.slice(0,200)});
  let parsed={};
  try{parsed=body?JSON.parse(body):{};}catch(_){}
  const displayName=safeText(parsed.displayName,160);
  if(!displayName) return null;
  return {user_id:id,display_name:displayName,picture_url:safeText(parsed.pictureUrl,1000)};
}
async function pushText(input={},options={}){
  const to=required(input.to,'LINE recipient');
  const text=safeText(input.text,5000);
  if(!text) throw Object.assign(new Error('LINE message text required'),{code:'LINE_TEXT_REQUIRED'});
  const token=required(options.token||process.env.LINE_CHANNEL_ACCESS_TOKEN,'LINE channel access token');
  const fetchImpl=options.fetchImpl||fetch;
  // A caller must supply an already durable retry key; never mint one here.
  const retryKey=safeText(options.retryKey,80);
  if(!UUID.test(retryKey))throw Object.assign(new Error('Pre-reserved LINE retry key required'),{code:'LINE_RETRY_KEY_REQUIRED'});
  const r=await fetchImpl(PUSH_URL,{
    method:'POST',
    headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'application/json',
      'X-Line-Retry-Key':retryKey,
      'User-Agent':'KK-Admin-Inbox/1.0'
    },
    body:JSON.stringify({to,messages:[{type:'text',text}]})
  });
  const raw=await r.text();
  let parsed={};
  try{parsed=raw?JSON.parse(raw):{};}catch(_){}
  if(!r.ok){
    throw Object.assign(new Error('LINE push failed '+r.status),{
      code:r.status===409?'LINE_PUSH_RETRY_ACCEPTED':'LINE_PUSH_FAILED',
      status:r.status,
      retry_key:retryKey,
      provider_body:raw.slice(0,300)
    });
  }
  const sent=Array.isArray(parsed.sentMessages)&&parsed.sentMessages[0]?parsed.sentMessages[0]:{};
  const requestId=String(r.headers&&r.headers.get?r.headers.get('x-line-request-id')||'':'').trim();
  return {
    ok:true,
    // Missing sentMessages[0].id is an uncertain receipt, never impersonate
    // provider confirmation by substituting a local retry-key UUID.
    provider_confirmed:!!safeText(sent.id),
    external_message_id:safeText(sent.id,200),
    provider_request_id:requestId,
    retry_key:retryKey,
    sent_at:new Date().toISOString()
  };
}
module.exports={VERSION,PROFILE_URL,PUSH_URL,getProfile,pushText};
