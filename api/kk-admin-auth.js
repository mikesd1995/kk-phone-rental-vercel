'use strict';

const auth = require('./lib/admin-session.js');

function json(res,status,body){
  auth.noStore(res);
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sameOrigin(req){
  const origin = String(req.headers && req.headers.origin || '').trim();
  if(!origin) return true;
  const host = String(req.headers && (req.headers['x-forwarded-host'] || req.headers.host) || '').trim();
  if(!host) return false;
  try{ return new URL(origin).host === host; }
  catch(_){ return false; }
}

async function bodyOf(req){
  if(req.body && typeof req.body === 'object') return req.body;
  if(typeof req.body === 'string' && req.body.trim()){
    try{ return JSON.parse(req.body); }catch(_){ return {}; }
  }
  let raw='';
  for await (const chunk of req){
    raw += chunk;
    if(raw.length > 4096) throw new Error('request_too_large');
  }
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch(_){ return {}; }
}

module.exports = async function handler(req,res){
  auth.noStore(res);

  if(req.method === 'GET'){
    return json(res,200,{ok:true,authenticated:auth.hasValidSession(req)});
  }

  if(req.method !== 'POST'){
    res.setHeader('Allow','GET, POST');
    return json(res,405,{ok:false,error:'Method not allowed'});
  }

  if(!sameOrigin(req)) return json(res,403,{ok:false,error:'Request rejected'});

  let payload;
  try{ payload = await bodyOf(req); }
  catch(_){ return json(res,413,{ok:false,error:'Request rejected'}); }

  if(String(payload.action || '').toLowerCase() === 'logout'){
    res.setHeader('Set-Cookie',auth.clearSessionCookie());
    return json(res,200,{ok:true,authenticated:false});
  }

  const rate = auth.rateState(req);
  if(!rate.allowed){
    res.setHeader('Retry-After',String(rate.retryAfter));
    return json(res,429,{ok:false,error:'ลองใหม่ภายหลัง'});
  }

  const expected = String(process.env.KK_ADMIN_PIN || '').trim();
  const provided = String(payload.pin || '').trim();
  if(!expected){
    return json(res,503,{ok:false,error:'Admin access is unavailable'});
  }

  if(!auth.safeEqual(provided,expected)){
    const next = auth.recordFailure(req);
    if(!next.allowed) res.setHeader('Retry-After',String(next.retryAfter));
    return json(res,next.allowed ? 401 : 429,{ok:false,error:next.allowed ? 'PIN ไม่ถูกต้อง' : 'ลองใหม่ภายหลัง'});
  }

  auth.clearFailures(req);
  res.setHeader('Set-Cookie',auth.sessionCookie(auth.issueToken()));
  return json(res,200,{ok:true,authenticated:true});
};

module.exports._test = {sameOrigin,bodyOf};
