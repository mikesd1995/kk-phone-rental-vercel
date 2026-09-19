'use strict';

const Bridge=require('../server/admin-make-bridge.js');

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(Object.assign({bridge_version:Bridge.VERSION},body||{})));
}

function readBody(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>512*1024){reject(new Error('Request too large'));req.destroy();}
    });
    req.on('end',()=>resolve(raw));
    req.on('error',reject);
  });
}

function parseBody(raw,contentType){
  const type=String(contentType||'').toLowerCase();
  if(type.includes('application/json')){
    const parsed=raw?JSON.parse(raw):{};
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('Invalid JSON object');
    return parsed;
  }
  const params=new URLSearchParams(String(raw||''));
  return Object.fromEntries(params.entries());
}

function extractWriteValues(raw){
  let parsed=raw;
  if(typeof parsed==='string') parsed=JSON.parse(parsed||'{}');
  if(!parsed||typeof parsed!=='object') return null;
  if(parsed.updatedData&&Array.isArray(parsed.updatedData.values)) return parsed.updatedData.values;
  if(Array.isArray(parsed.values)) return parsed.values;
  return null;
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});
  let input;
  try{
    const raw=await readBody(req);
    input=parseBody(raw,req.headers&&req.headers['content-type']);
  }catch(_){
    return json(res,400,{ok:false,error_code:'BRIDGE_REQUEST_INVALID'});
  }

  const verified=Bridge.verifyEnvelope(input,String(process.env.KK_ADMIN_API_KEY||''));
  if(!verified.ok){
    return json(res,401,{ok:false,error_code:verified.code||'BRIDGE_VERIFICATION_FAILED'});
  }

  const stage=String(input.stage||'authorize');
  if(stage==='authorize'){
    return json(res,200,{ok:true,stage,action:verified.action,request_id:String(input.request_id||'')});
  }

  if(stage==='precondition'){
    if(verified.action==='healthProbe'){
      return json(res,200,{ok:true,stage,action:verified.action,request_id:String(input.request_id||'')});
    }
    const expected=String(input.before_hash||'');
    if(!expected) return json(res,409,{ok:false,error_code:'BRIDGE_PRECONDITION_MISSING'});
    let actualHash;
    try{actualHash=Bridge.stableValuesHash(String(input.actual_values_json||'[]'));}catch(_){
      return json(res,409,{ok:false,error_code:'BRIDGE_PRECONDITION_UNREADABLE'});
    }
    if(actualHash!==expected){
      return json(res,409,{ok:false,error_code:'BRIDGE_PRECONDITION_CHANGED'});
    }
    return json(res,200,{ok:true,stage,action:verified.action,request_id:String(input.request_id||'')});
  }

  if(stage==='readback'){
    let values;
    try{values=extractWriteValues(String(input.write_response_json||'{}'));}catch(_){values=null;}
    if(verified.action==='healthProbe'){
      if(!Array.isArray(values)) return json(res,502,{ok:false,error_code:'BRIDGE_HEALTH_READBACK_INVALID'});
      return json(res,200,{ok:true,stage,action:verified.action,request_id:String(input.request_id||'')});
    }
    if(!Array.isArray(values)) return json(res,502,{ok:false,error_code:'BRIDGE_READBACK_MISSING'});
    const expected=String(input.after_hash||'');
    if(expected){
      const actualHash=Bridge.stableValuesHash(values);
      if(actualHash!==expected) return json(res,502,{ok:false,error_code:'BRIDGE_READBACK_MISMATCH'});
    }
    return json(res,200,{ok:true,stage,action:verified.action,request_id:String(input.request_id||''),values_returned:values.length});
  }

  return json(res,400,{ok:false,error_code:'BRIDGE_STAGE_INVALID'});
};

module.exports._test={parseBody,extractWriteValues};
