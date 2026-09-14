'use strict';

const auth = require('./admin-session.js');

function json(res,status,body){
  auth.noStore(res);
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function wrap(handler){
  return async function protectedAdminHandler(req,res){
    auth.noStore(res);
    if(req.method === 'OPTIONS') return handler(req,res);

    const viaSession = auth.hasValidSession(req);
    const viaLegacyPin = auth.hasValidLegacyPin(req);
    if(!viaSession && !viaLegacyPin){
      const rate = auth.rateState(req);
      if(!rate.allowed){
        res.setHeader('Retry-After',String(rate.retryAfter));
        return json(res,429,{ok:false,error:'Too many authentication attempts'});
      }
      const next = auth.recordFailure(req);
      if(!next.allowed) res.setHeader('Retry-After',String(next.retryAfter));
      return json(res,next.allowed ? 401 : 429,{ok:false,error:'Unauthorized'});
    }

    auth.clearFailures(req);
    const expected = String(process.env.KK_ADMIN_PIN || '').trim();
    if(!expected) return json(res,503,{ok:false,error:'Admin access is unavailable'});

    req.headers = Object.assign({},req.headers || {},{'x-admin-pin':expected});
    return handler(req,res);
  };
}

module.exports={wrap};
