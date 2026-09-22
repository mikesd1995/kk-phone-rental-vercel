'use strict';

const crypto=require('crypto');

const TOKEN_URL='https://oauth2.googleapis.com/token';
const WRITE_SCOPE='https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const TOKEN_TIMEOUT_MS=10000;
const GOOGLE_API_TIMEOUT_MS=8000;
let tokenCache={token:'',expiresAt:0,fingerprint:''};

function isTrue(value){
  return ['1','true','yes','on'].includes(String(value||'').trim().toLowerCase());
}

function b64url(input){
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function normalizePrivateKey(value){
  return String(value||'').replace(/\\n/g,'\n').trim();
}

function credentialsFromEnv(env=process.env){
  let email=String(env.GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL||'').trim();
  let privateKey=normalizePrivateKey(env.GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY||'');
  const rawJson=String(env.GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_JSON||'').trim();
  if(rawJson){
    try{
      const parsed=JSON.parse(rawJson);
      email=email||String(parsed.client_email||'').trim();
      privateKey=privateKey||normalizePrivateKey(parsed.private_key||'');
    }catch(_err){
      return null;
    }
  }
  if(!email||!privateKey) return null;
  return {email,privateKey};
}

function configState(env=process.env){
  const sheetId=String(env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  const creds=credentialsFromEnv(env);
  return {
    enabled:isTrue(env.KK_ADMIN_DIRECT_WRITER_ENABLED),
    sheetId,
    credentialsReady:!!creds,
    configured:!!(sheetId&&creds),
    authMode:creds?'dedicated_service_account':'none',
    scope:WRITE_SCOPE
  };
}

function credentialFingerprint(creds){
  return crypto.createHash('sha256').update(creds.email+'\n'+creds.privateKey.slice(0,64)).digest('hex');
}

function createAssertion(creds,nowSeconds=Math.floor(Date.now()/1000)){
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({
    iss:creds.email,
    scope:WRITE_SCOPE,
    aud:TOKEN_URL,
    iat:nowSeconds,
    exp:nowSeconds+3600
  }));
  const unsigned=header+'.'+claims;
  const signer=crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature=signer.sign(creds.privateKey).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return unsigned+'.'+signature;
}

async function getAccessToken({env=process.env,fetchImpl=global.fetch}={}){
  const creds=credentialsFromEnv(env);
  if(!creds) throw Object.assign(new Error('Dedicated Admin Google Sheets writer credentials are not configured'),{code:'ADMIN_WRITER_NOT_CONFIGURED'});
  if(typeof fetchImpl!=='function') throw new Error('fetch is not available');
  const fingerprint=credentialFingerprint(creds);
  const now=Date.now();
  if(tokenCache.token&&tokenCache.fingerprint===fingerprint&&tokenCache.expiresAt-now>120000) return tokenCache.token;

  const assertion=createAssertion(creds);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TOKEN_TIMEOUT_MS);
  try{
    const res=await fetchImpl(TOKEN_URL,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),
      signal:controller.signal
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok||!body.access_token) throw Object.assign(new Error('Dedicated Admin writer token exchange failed'),{code:'ADMIN_WRITER_TOKEN_EXCHANGE_FAILED'});
    const ttl=Math.max(300,Number(body.expires_in||3600));
    tokenCache={token:String(body.access_token),expiresAt:now+ttl*1000,fingerprint};
    return tokenCache.token;
  }finally{
    clearTimeout(timer);
  }
}

async function googleJson(url,options={},{
  env=process.env,
  fetchImpl=global.fetch
}={}){
  const token=await getAccessToken({env,fetchImpl});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),GOOGLE_API_TIMEOUT_MS);
  try{
    const res=await fetchImpl(url,Object.assign({},options,{
      headers:Object.assign({
        Authorization:`Bearer ${token}`,
        Accept:'application/json'
      },options.headers||{}),
      signal:controller.signal
    }));
    const body=await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error('Dedicated Admin Google Sheets request failed'),{
      code:'ADMIN_WRITER_GOOGLE_REQUEST_FAILED',
      httpStatus:res.status
    });
    return body;
  }finally{
    clearTimeout(timer);
  }
}

async function readValues({sheetId,range,env=process.env,fetchImpl=global.fetch}={}){
  const sid=String(sheetId||env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  if(!sid) throw Object.assign(new Error('Core Google Sheet ID is missing'),{code:'ADMIN_WRITER_SHEET_ID_MISSING'});
  if(!range) throw new Error('range is required');
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const body=await googleJson(url,{method:'GET'},{env,fetchImpl});
  return Array.isArray(body.values)?body.values:[];
}

async function updateValues({sheetId,range,values,env=process.env,fetchImpl=global.fetch}={}){
  if(!configState(env).enabled) throw Object.assign(new Error('Direct Admin writer is disabled'),{code:'ADMIN_DIRECT_WRITER_DISABLED'});
  const sid=String(sheetId||env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  if(!sid||!range||!Array.isArray(values)) throw new Error('sheetId, range and values are required');
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED&includeValuesInResponse=true&responseValueRenderOption=FORMATTED_VALUE`;
  return googleJson(url,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({majorDimension:'ROWS',values})
  },{env,fetchImpl});
}

async function appendValues({sheetId,range,values,env=process.env,fetchImpl=global.fetch}={}){
  if(!configState(env).enabled) throw Object.assign(new Error('Direct Admin writer is disabled'),{code:'ADMIN_DIRECT_WRITER_DISABLED'});
  const sid=String(sheetId||env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  if(!sid||!range||!Array.isArray(values)) throw new Error('sheetId, range and values are required');
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&includeValuesInResponse=true&responseValueRenderOption=FORMATTED_VALUE`;
  return googleJson(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({majorDimension:'ROWS',values})
  },{env,fetchImpl});
}

async function health({env=process.env,fetchImpl=global.fetch}={}){
  const state=configState(env);
  if(!state.configured){
    return Object.assign({},state,{ok:false,error_code:'ADMIN_WRITER_NOT_CONFIGURED'});
  }
  try{
    const values=await readValues({
      sheetId:state.sheetId,
      range:"'10_Admin_Health_Check'!A1:B5",
      env,fetchImpl
    });
    return Object.assign({},state,{
      ok:Array.isArray(values)&&values.length>0,
      read_probe_rows:Array.isArray(values)?values.length:0,
      error_code:''
    });
  }catch(err){
    return Object.assign({},state,{
      ok:false,
      error_code:String(err&&err.code||'ADMIN_WRITER_HEALTH_FAILED')
    });
  }
}

function resetTokenCache(){
  tokenCache={token:'',expiresAt:0,fingerprint:''};
}

module.exports={
  TOKEN_URL,
  WRITE_SCOPE,
  DEFAULT_CORE_SHEET_ID,
  TOKEN_TIMEOUT_MS,
  GOOGLE_API_TIMEOUT_MS,
  credentialsFromEnv,
  configState,
  createAssertion,
  getAccessToken,
  readValues,
  updateValues,
  appendValues,
  health,
  resetTokenCache
};
