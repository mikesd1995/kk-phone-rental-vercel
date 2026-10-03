'use strict';

function text(v){return String(v==null?'':v).trim();}
function config(env=process.env){
  const clientId=text(env.KK_X_CLIENT_ID), clientSecret=text(env.KK_X_CLIENT_SECRET);
  const accessToken=text(env.KK_X_USER_ACCESS_TOKEN), refreshToken=text(env.KK_X_REFRESH_TOKEN);
  if(!clientId||!clientSecret||!accessToken||!refreshToken) return null;
  return {clientId,clientSecret,accessToken,refreshToken};
}
async function refreshAccessToken({env=process.env,fetchImpl=fetch}={}){
  const c=config(env); if(!c) throw Object.assign(new Error('X OAuth configuration incomplete'),{code:'X_OAUTH_CONFIG_INCOMPLETE'});
  const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:c.refreshToken,client_id:c.clientId});
  const basic=Buffer.from(c.clientId+':'+c.clientSecret).toString('base64');
  const r=await fetchImpl('https://api.x.com/2/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok||!payload.access_token) throw Object.assign(new Error('X OAuth refresh failed'),{code:'X_OAUTH_REFRESH_FAILED',status:r.status});
  return {accessToken:payload.access_token,refreshToken:payload.refresh_token||c.refreshToken,expiresIn:Number(payload.expires_in||0),scope:text(payload.scope)};
}
module.exports={config,refreshAccessToken};
