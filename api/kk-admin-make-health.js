'use strict';

const Bridge=require('../server/admin-make-bridge.js');

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(Object.assign({bridge_version:Bridge.VERSION},body||{})));
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='POST') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});
  const started=Date.now();
  try{
    const result=await Bridge.callBridge(Bridge.healthPlan(),{timeoutMs:15000});
    return json(res,result.ok&&result.body&&result.body.ok?200:503,{
      ok:!!(result.ok&&result.body&&result.body.ok),
      transport_status:result.status,
      latency_ms:Date.now()-started,
      bridge_stage:result.body&&result.body.stage||'',
      action:result.body&&result.body.action||'',
      request_id_present:!!result.request_id
    });
  }catch(err){
    return json(res,503,{
      ok:false,
      error_code:err&&err.name==='AbortError'?'BRIDGE_HEALTH_TIMEOUT':'BRIDGE_HEALTH_FAILED',
      latency_ms:Date.now()-started
    });
  }
};
