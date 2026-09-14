'use strict';

const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
let tokenCache = { token: '', expiresAt: 0, fingerprint: '' };

function b64url(input){
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function normalizePrivateKey(value){
  return String(value || '').replace(/\\n/g,'\n').trim();
}

function credentialsFromEnv(env = process.env){
  let email = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || env.GOOGLE_CLIENT_EMAIL || '').trim();
  let privateKey = normalizePrivateKey(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || env.GOOGLE_PRIVATE_KEY || '');
  const rawJson = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if(rawJson){
    try{
      const parsed = JSON.parse(rawJson);
      email = email || String(parsed.client_email || '').trim();
      privateKey = privateKey || normalizePrivateKey(parsed.private_key || '');
    }catch(_){
      return null;
    }
  }
  if(!email || !privateKey) return null;
  return { email, privateKey };
}

function configState(env = process.env){
  const sheetId = String(env.KK_CRM_SHEET_ID || '').trim();
  const creds = credentialsFromEnv(env);
  return {
    sheetId,
    credentialsReady: !!creds,
    configured: !!(sheetId && creds),
    authMode: creds ? 'service_account' : 'none'
  };
}

function credentialFingerprint(creds){
  return crypto.createHash('sha256').update(creds.email + '\n' + creds.privateKey.slice(0,64)).digest('hex');
}

function createAssertion(creds, nowSeconds = Math.floor(Date.now()/1000)){
  const header = b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims = b64url(JSON.stringify({
    iss: creds.email,
    scope: READONLY_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  }));
  const unsigned = header + '.' + claims;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(creds.privateKey).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return unsigned + '.' + signature;
}

async function getAccessToken({env = process.env, fetchImpl = global.fetch} = {}){
  const creds = credentialsFromEnv(env);
  if(!creds) throw Object.assign(new Error('Private Google Sheets reader credentials are not configured'), {code:'CRM_READER_NOT_CONFIGURED'});
  if(typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const fingerprint = credentialFingerprint(creds);
  const now = Date.now();
  if(tokenCache.token && tokenCache.fingerprint === fingerprint && tokenCache.expiresAt - now > 120000) return tokenCache.token;

  const assertion = createAssertion(creds);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),10000);
  try{
    const res = await fetchImpl(TOKEN_URL,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),
      signal:controller.signal
    });
    const body = await res.json().catch(()=>({}));
    if(!res.ok || !body.access_token) throw Object.assign(new Error('Google service-account token exchange failed'), {code:'CRM_TOKEN_EXCHANGE_FAILED'});
    const ttl = Math.max(300, Number(body.expires_in || 3600));
    tokenCache = {token:String(body.access_token), expiresAt:now + ttl*1000, fingerprint};
    return tokenCache.token;
  }finally{
    clearTimeout(timer);
  }
}

async function readValues({sheetId, range, env = process.env, fetchImpl = global.fetch} = {}){
  const sid = String(sheetId || env.KK_CRM_SHEET_ID || '').trim();
  if(!sid) throw Object.assign(new Error('KK_CRM_SHEET_ID is not configured'), {code:'CRM_SHEET_ID_MISSING'});
  if(!range) throw new Error('range is required');
  const token = await getAccessToken({env,fetchImpl});
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),12000);
  try{
    const res = await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
    const body = await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error('Private Google Sheets read failed'), {code:'CRM_PRIVATE_READ_FAILED',httpStatus:res.status});
    return Array.isArray(body.values) ? body.values : [];
  }finally{
    clearTimeout(timer);
  }
}

function csvEscape(value){
  const s = String(value == null ? '' : value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function valuesToCsv(values){
  return (values || []).map(row=>(row || []).map(csvEscape).join(',')).join('\n');
}

async function readValuesCsv(options){
  return valuesToCsv(await readValues(options));
}

function resetTokenCache(){
  tokenCache = {token:'',expiresAt:0,fingerprint:''};
}

module.exports = {
  READONLY_SCOPE,
  credentialsFromEnv,
  configState,
  createAssertion,
  getAccessToken,
  readValues,
  readValuesCsv,
  valuesToCsv,
  resetTokenCache
};
