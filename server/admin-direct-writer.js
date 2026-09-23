'use strict';

// KK Phone Rental — staged authenticated Google Sheets writer foundation.
// This module is deliberately NOT wired into Admin business actions yet.
// Activation requires explicit enable + acceptance + write-probe gates and the
// canonical Core Sheet identity. Public GViz is never used for writes.
// Writer credentials are intentionally isolated from the generic read-only reader namespace.

const crypto=require('node:crypto');
const dedicatedWriter=require('../api/lib/admin-google-sheets-writer.js');

const VERSION='admin-direct-google-writer-foundation-v2-dedicated-identity';
const CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const WRITE_SCOPE='https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL='https://oauth2.googleapis.com/token';

let tokenCache={token:'',expiresAt:0,fingerprint:''};

function isTrue(value){
  return ['1','true','yes','on'].includes(String(value||'').trim().toLowerCase());
}

function b64url(input){
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function credentialFingerprint(creds){
  return crypto.createHash('sha256').update(creds.email+'\n'+creds.privateKey.slice(0,64)).digest('hex');
}

function state(env=process.env){
  const creds=dedicatedWriter.credentialsFromEnv(env);
  const sheetId=String(env.GOOGLE_SHEET_ID||CORE_SHEET_ID).trim();
  const enabled=isTrue(env.KK_ADMIN_DIRECT_WRITER_ENABLED);
  const accepted=isTrue(env.KK_ADMIN_DIRECT_WRITER_ACCEPTED);
  const writeProbePassed=isTrue(env.KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED);
  const canonicalSheet=sheetId===CORE_SHEET_ID;
  return {
    version:VERSION,
    auth_mode:creds?'dedicated_service_account':'none',
    credentials_ready:!!creds,
    enabled,
    accepted,
    write_probe_passed:writeProbePassed,
    canonical_sheet:canonicalSheet,
    ready:!!(creds&&enabled&&accepted&&writeProbePassed&&canonicalSheet)
  };
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
  const sig=signer.sign(creds.privateKey).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return unsigned+'.'+sig;
}

async function getAccessToken({env=process.env,fetchImpl=global.fetch}={}){
  const s=state(env);
  if(!s.credentials_ready) throw Object.assign(new Error('Direct Google writer credentials are not configured'),{code:'DIRECT_WRITER_NOT_CONFIGURED'});
  if(typeof fetchImpl!=='function') throw new Error('fetch is not available');
  const creds=dedicatedWriter.credentialsFromEnv(env);
  const fingerprint=credentialFingerprint(creds);
  const now=Date.now();
  if(tokenCache.token&&tokenCache.fingerprint===fingerprint&&tokenCache.expiresAt-now>120000) return tokenCache.token;
  const assertion=createAssertion(creds);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetchImpl(TOKEN_URL,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),
      signal:controller.signal
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok||!body.access_token) throw Object.assign(new Error('Direct Google writer token exchange failed'),{code:'DIRECT_WRITER_TOKEN_EXCHANGE_FAILED',httpStatus:res.status});
    const ttl=Math.max(300,Number(body.expires_in||3600));
    tokenCache={token:String(body.access_token),expiresAt:now+ttl*1000,fingerprint};
    return tokenCache.token;
  }finally{clearTimeout(timer);}
}

const ACTION_SHEETS=Object.freeze({
  createBooking:'00_Master_Booking',
  updateBooking:'00_Master_Booking',
  createEvent:'01_Events',
  updateEvent:'01_Events',
  upsertEventOverride:'04_Event_Overrides',
  auditLog:'15_Admin_Audit_Log'
});

function columnNumber(label){
  const s=String(label||'').trim().toUpperCase();
  if(!/^[A-Z]+$/.test(s)) return 0;
  let n=0;
  for(const ch of s) n=n*26+(ch.charCodeAt(0)-64);
  return n;
}

function validateTarget(action,range){
  const sheet=ACTION_SHEETS[String(action||'')];
  if(!sheet) return {ok:false,code:'DIRECT_WRITER_ACTION_NOT_ALLOWED'};
  const value=String(range||'').trim();
  const m=value.match(/^'?([^'!]+)'?!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if(!m||m[1]!==sheet) return {ok:false,code:'DIRECT_WRITER_RANGE_NOT_ALLOWED'};
  const startCol=columnNumber(m[2]),endCol=columnNumber(m[4]);
  const startRow=Number(m[3]),endRow=Number(m[5]);
  if(!startCol||!endCol||startCol>endCol||!Number.isInteger(startRow)||!Number.isInteger(endRow)||startRow<1||endRow<startRow||endRow-startRow>50){
    return {ok:false,code:'DIRECT_WRITER_RANGE_NOT_ALLOWED'};
  }
  const bounds={
    createBooking:[2,20],updateBooking:[2,20],
    createEvent:[1,8],updateEvent:[1,8],
    upsertEventOverride:[1,7],auditLog:[1,10]
  }[action];
  if(!bounds||startCol<bounds[0]||endCol>bounds[1]){
    return {ok:false,code:'DIRECT_WRITER_RANGE_NOT_ALLOWED'};
  }
  return {ok:true,sheet,range:value};
}

function requireActivated(env=process.env){
  const s=state(env);
  if(!s.canonical_sheet) throw Object.assign(new Error('Direct writer refused non-canonical Core Sheet'),{code:'DIRECT_WRITER_SHEET_MISMATCH'});
  if(!s.credentials_ready) throw Object.assign(new Error('Direct writer credentials are not configured'),{code:'DIRECT_WRITER_NOT_CONFIGURED'});
  if(!s.enabled) throw Object.assign(new Error('Direct writer is disabled'),{code:'DIRECT_WRITER_DISABLED'});
  if(!s.accepted) throw Object.assign(new Error('Direct writer acceptance gate is open'),{code:'DIRECT_WRITER_NOT_ACCEPTED'});
  if(!s.write_probe_passed) throw Object.assign(new Error('Direct writer write-probe acceptance has not passed'),{code:'DIRECT_WRITER_WRITE_PROBE_REQUIRED'});
  return s;
}

async function updateValues({action,range,values,env=process.env,fetchImpl=global.fetch,tokenProvider=getAccessToken}={}){
  requireActivated(env);
  const target=validateTarget(action,range);
  if(!target.ok) throw Object.assign(new Error(target.code),{code:target.code});
  if(!Array.isArray(values)||!values.length) throw Object.assign(new Error('values are required'),{code:'DIRECT_WRITER_VALUES_REQUIRED'});
  const token=await tokenProvider({env,fetchImpl});
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(CORE_SHEET_ID)+'/values/'+encodeURIComponent(target.range)+'?valueInputOption=USER_ENTERED';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetchImpl(url,{
      method:'PUT',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({range:target.range,majorDimension:'ROWS',values}),
      signal:controller.signal
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error('Direct Google Sheets write failed'),{code:'DIRECT_WRITER_WRITE_FAILED',httpStatus:res.status});
    return {ok:true,updated_range:String(body.updatedRange||target.range),updated_rows:Number(body.updatedRows||0),updated_cells:Number(body.updatedCells||0)};
  }finally{clearTimeout(timer);}
}

function resetTokenCache(){tokenCache={token:'',expiresAt:0,fingerprint:''};}

module.exports={
  VERSION,CORE_SHEET_ID,WRITE_SCOPE,ACTION_SHEETS,
  isTrue,state,createAssertion,getAccessToken,columnNumber,validateTarget,requireActivated,updateValues,resetTokenCache
};
