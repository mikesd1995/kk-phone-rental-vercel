'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const COOKIE_NAME='__Host-kk_admin_session';
const SESSION_TTL_SECONDS=8*60*60;
const FAILURE_WINDOW_MS=15*60*1000;
const FAILURE_LIMIT=5;
const BLOCK_MS=15*60*1000;
const attempts=new Map();
const ADMIN_ROOT=path.resolve(process.cwd(),'admin');
const TYPES={
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.woff':'font/woff',
  '.woff2':'font/woff2'
};
let cachedAdminHtml='';
let cachedSigningSource='';
let cachedSigningKey=null;

function signingKey(){
  const sessionSecret=String(process.env.KK_ADMIN_SESSION_SECRET||'').trim();
  const pin=String(process.env.KK_ADMIN_PIN||'').trim();
  const source=sessionSecret ? `secret:${sessionSecret}` : (pin ? `pin:${pin}` : '');
  if(!source) return null;
  if(source===cachedSigningSource && cachedSigningKey) return cachedSigningKey;

  let key;
  if(sessionSecret){
    key=crypto.createHash('sha256').update('kk-admin-session-secret-v2\0').update(sessionSecret).digest();
  }else{
    // Backward-compatible rollout when a dedicated session secret is not yet
    // provisioned. A slow KDF materially raises the cost of offline guessing
    // compared with using a human-entered PIN directly as an HMAC key.
    key=crypto.scryptSync(pin,'kk-phone-rental-admin-session-v2',32,{
      N:16384,r:8,p:1,maxmem:64*1024*1024
    });
  }
  cachedSigningSource=source;
  cachedSigningKey=key;
  return key;
}

function safeEqual(a,b){
  const aa=Buffer.from(String(a||''),'utf8');
  const bb=Buffer.from(String(b||''),'utf8');
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

function signExpiry(exp,nonce){
  const key=signingKey();
  if(!key||!nonce) return '';
  return crypto.createHmac('sha256',key).update(`kk-admin:v2:${exp}:${nonce}`).digest('hex');
}

function issueToken(nowMs=Date.now()){
  const exp=Math.floor(nowMs/1000)+SESSION_TTL_SECONDS;
  const nonce=crypto.randomBytes(16).toString('base64url');
  return `v2.${exp}.${nonce}.${signExpiry(exp,nonce)}`;
}

function verifyToken(token,nowMs=Date.now()){
  const parts=String(token||'').trim().split('.');
  if(parts.length!==4||parts[0]!=='v2') return false;
  const exp=Number(parts[1]);
  const nonce=String(parts[2]||'');
  if(!Number.isInteger(exp)||!/^[A-Za-z0-9_-]{22}$/.test(nonce)) return false;
  const now=Math.floor(nowMs/1000);
  if(exp<=now||exp>now+SESSION_TTL_SECONDS+60) return false;
  const expected=signExpiry(exp,nonce);
  return !!expected&&safeEqual(parts[3],expected);
}

function parseCookies(req){
  const header=String(req&&req.headers&&req.headers.cookie||'');
  const out={};
  header.split(';').forEach(part=>{
    const i=part.indexOf('=');
    if(i<0) return;
    const key=part.slice(0,i).trim();
    const value=part.slice(i+1).trim();
    if(key) out[key]=value;
  });
  return out;
}

function hasValidSession(req){
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

function hasValidLegacyPin(req){
  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  const provided=String(req&&req.headers&&req.headers['x-admin-pin']||'').trim();
  return !!expected&&safeEqual(provided,expected);
}

function clientKey(req){
  const forwarded=String(req&&req.headers&&req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(req&&req.headers&&req.headers['x-real-ip']||'').trim()||'unknown';
}

function cleanEntry(entry,now){
  if(!entry) return null;
  if(entry.blockedUntil&&entry.blockedUntil<=now) return null;
  if(!entry.blockedUntil&&now-entry.firstFailureAt>FAILURE_WINDOW_MS) return null;
  return entry;
}

function rateState(req,now=Date.now()){
  const key=clientKey(req);
  const entry=cleanEntry(attempts.get(key),now);
  if(!entry){ attempts.delete(key); return {allowed:true,key,retryAfter:0}; }
  if(entry.blockedUntil&&entry.blockedUntil>now){
    return {allowed:false,key,retryAfter:Math.max(1,Math.ceil((entry.blockedUntil-now)/1000))};
  }
  return {allowed:true,key,retryAfter:0};
}

function recordFailure(req,now=Date.now()){
  const key=clientKey(req);
  const entry=cleanEntry(attempts.get(key),now)||{count:0,firstFailureAt:now,blockedUntil:0};
  entry.count+=1;
  if(entry.count>=FAILURE_LIMIT) entry.blockedUntil=now+BLOCK_MS;
  attempts.set(key,entry);
  return rateState(req,now);
}

function clearFailures(req){ attempts.delete(clientKey(req)); }

function sessionCookie(token){
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(){
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function noStore(res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
}

function hardenAdminResponse(res){
  noStore(res);
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Frame-Options','DENY');
}

function json(res,status,body){
  noStore(res);
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sameOrigin(req){
  const origin=String(req&&req.headers&&req.headers.origin||'').trim();
  if(!origin) return true;
  const host=String(req&&req.headers&&(req.headers['x-forwarded-host']||req.headers.host)||'').trim();
  if(!host) return false;
  try{ return new URL(origin).host===host; }
  catch(_){ return false; }
}

async function bodyOf(req){
  if(req.body&&typeof req.body==='object') return req.body;
  if(typeof req.body==='string'&&req.body.trim()){
    try{ return JSON.parse(req.body); }catch(_){ return {}; }
  }
  let raw='';
  for await(const chunk of req){
    raw+=chunk;
    if(raw.length>4096) throw new Error('request_too_large');
  }
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch(_){ return {}; }
}

function gateMode(req){
  if(req&&req.query&&req.query.__kk_gate!==undefined){
    const raw=Array.isArray(req.query.__kk_gate)?req.query.__kk_gate[0]:req.query.__kk_gate;
    return String(raw||'').trim().toLowerCase();
  }
  try{
    const u=new URL(req&&req.url||'/','http://localhost');
    return String(u.searchParams.get('__kk_gate')||'').trim().toLowerCase();
  }catch(_){ return ''; }
}

function queryPath(req){
  if(req&&req.query&&req.query.path!==undefined){
    return Array.isArray(req.query.path)?req.query.path.join('/'):String(req.query.path||'');
  }
  try{
    const u=new URL(req&&req.url||'/','http://localhost');
    return String(u.searchParams.get('path')||'');
  }catch(_){ return ''; }
}

function cleanRelative(input){
  let decoded=String(input||'');
  try{ decoded=decodeURIComponent(decoded); }catch(_){ return ''; }
  decoded=decoded.replace(/^\/+/, '');
  if(!decoded||decoded.includes('\0')||decoded.includes('\\')) return '';
  const normalized=path.posix.normalize(decoded);
  if(normalized==='.'||normalized==='..'||normalized.startsWith('../')||path.posix.isAbsolute(normalized)) return '';
  return normalized;
}

function contentType(file){ return TYPES[path.extname(file).toLowerCase()]||'application/octet-stream'; }

function redirect(res,to){
  hardenAdminResponse(res);
  res.statusCode=307;
  res.setHeader('Location',to);
  return res.end();
}

function loadAdminHtml(){
  if(cachedAdminHtml) return cachedAdminHtml;
  const file=path.join(ADMIN_ROOT,'index.html');
  const source=fs.readFileSync(file,'utf8');
  const scriptMarker='<script src="/admin/snapshot-health.js?v=resilience-1"></script>';
  const loginMarker='<section id="loginPanel" class="card login-card">';
  if(!source.includes(scriptMarker)) throw new Error('Admin bootstrap marker not found');
  if(!source.includes(loginMarker)) throw new Error('Admin login compatibility marker not found');
  cachedAdminHtml=source
    .replace(loginMarker,'<section id="loginPanel" class="card login-card hidden" aria-hidden="true">')
    .replace(scriptMarker,'<script src="/admin/session-bridge.js?v=auth-gate-3"></script>\n  '+scriptMarker);
  return cachedAdminHtml;
}

async function handleAuth(req,res){
  hardenAdminResponse(res);
  if(req.method==='GET') return json(res,200,{ok:true,authenticated:hasValidSession(req)});
  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return json(res,405,{ok:false,error:'Method not allowed'});
  }
  if(!sameOrigin(req)) return json(res,403,{ok:false,error:'Request rejected'});

  let payload;
  try{ payload=await bodyOf(req); }
  catch(_){ return json(res,413,{ok:false,error:'Request rejected'}); }

  if(String(payload.action||'').toLowerCase()==='logout'){
    res.setHeader('Set-Cookie',clearSessionCookie());
    return json(res,200,{ok:true,authenticated:false});
  }

  const rate=rateState(req);
  if(!rate.allowed){
    res.setHeader('Retry-After',String(rate.retryAfter));
    return json(res,429,{ok:false,error:'ลองใหม่ภายหลัง'});
  }

  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  const provided=String(payload.pin||'').trim();
  if(!expected) return json(res,503,{ok:false,error:'Admin access is unavailable'});
  if(!safeEqual(provided,expected)){
    const next=recordFailure(req);
    if(!next.allowed) res.setHeader('Retry-After',String(next.retryAfter));
    return json(res,next.allowed?401:429,{ok:false,error:next.allowed?'PIN ไม่ถูกต้อง':'ลองใหม่ภายหลัง'});
  }

  clearFailures(req);
  res.setHeader('Set-Cookie',sessionCookie(issueToken()));
  return json(res,200,{ok:true,authenticated:true});
}

function handleApp(req,res){
  hardenAdminResponse(res);
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.statusCode=405;
    res.setHeader('Allow','GET, HEAD');
    return res.end('Method not allowed');
  }
  if(!hasValidSession(req)) return redirect(res,'/admin');

  let html;
  try{ html=loadAdminHtml(); }
  catch(_){ res.statusCode=500; return res.end('Admin workspace unavailable'); }
  res.statusCode=200;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(req.method==='HEAD') return res.end();
  return res.end(html);
}

function handleAsset(req,res){
  hardenAdminResponse(res);
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.statusCode=405;
    res.setHeader('Allow','GET, HEAD');
    return res.end('Method not allowed');
  }
  if(!hasValidSession(req)) return redirect(res,'/admin');

  const rel=cleanRelative(queryPath(req));
  if(!rel){ res.statusCode=404; return res.end('Not found'); }
  if(rel==='index.html') return redirect(res,'/admin/app');
  const file=path.resolve(ADMIN_ROOT,rel);
  if(file===ADMIN_ROOT||!file.startsWith(ADMIN_ROOT+path.sep)){
    res.statusCode=404;
    return res.end('Not found');
  }
  let stat;
  try{ stat=fs.statSync(file); }
  catch(_){ res.statusCode=404; return res.end('Not found'); }
  if(!stat.isFile()){ res.statusCode=404; return res.end('Not found'); }
  res.statusCode=200;
  res.setHeader('Content-Type',contentType(file));
  if(req.method==='HEAD') return res.end();
  return fs.createReadStream(file).pipe(res);
}

async function handleGate(req,res,mode){
  const m=String(mode||gateMode(req)||'').toLowerCase();
  if(m==='auth') return handleAuth(req,res);
  if(m==='app') return handleApp(req,res);
  if(m==='asset') return handleAsset(req,res);
  return false;
}

function authorizeApi(req,res){
  noStore(res);
  if(req.method==='OPTIONS') return true;
  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  if(!expected){ json(res,503,{ok:false,error:'Admin access is unavailable'}); return false; }

  if(hasValidSession(req)){
    clearFailures(req);
    req.headers=Object.assign({},req.headers||{}, {'x-admin-pin':expected});
    return true;
  }
  if(hasValidLegacyPin(req)){
    clearFailures(req);
    return true;
  }

  const rate=rateState(req);
  if(!rate.allowed){
    res.setHeader('Retry-After',String(rate.retryAfter));
    json(res,429,{ok:false,error:'Too many authentication attempts'});
    return false;
  }
  const next=recordFailure(req);
  if(!next.allowed) res.setHeader('Retry-After',String(next.retryAfter));
  json(res,next.allowed?401:429,{ok:false,error:'Unauthorized'});
  return false;
}

module.exports={
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  gateMode,
  handleGate,
  authorizeApi,
  hasValidSession,
  hasValidLegacyPin,
  noStore,
  _test:{
    attempts,
    clientKey,
    signingKey,
    signExpiry,
    safeEqual,
    issueToken,
    verifyToken,
    parseCookies,
    rateState,
    recordFailure,
    clearFailures,
    sessionCookie,
    clearSessionCookie,
    sameOrigin,
    bodyOf,
    cleanRelative,
    contentType,
    queryPath,
    loadAdminHtml,
    ADMIN_ROOT
  }
};
