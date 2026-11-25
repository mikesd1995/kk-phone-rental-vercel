'use strict';
// Dedicated control-row consumption only. This path cannot arm, reset, refund,
// access notification records or select an RPC. A lost reply is never retried.
const Bridge=require('./runtime-ledger-oidc-bridge');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RECEIPT_KEYS=['ok','authenticated','probe','version','send_allowed','provider_sends','claimed','attempt_id','nonce','source_sha','deployment_id','environment','control_writes','business_writes'];
const unknown=()=>({claimed:false,error_code:'GAS_HEALTH_ATTEMPT_OUTCOME_UNKNOWN'});
function configured(cfg){
 return typeof cfg?.gasHealthAttemptId==='string'&&UUID.test(cfg.gasHealthAttemptId)&&
  typeof cfg.deploymentSourceSha==='string'&&/^[0-9a-f]{40}$/.test(cfg.deploymentSourceSha)&&
  typeof cfg.deploymentId==='string'&&/^dpl_[A-Za-z0-9]{1,196}$/.test(cfg.deploymentId)&&cfg.deploymentEnvironment==='production';
}
function exact(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))return false;
 const fields=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
 return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(fields[k],'value')&&fields[k].enumerable);
}
function active(signal,action){
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(new Error('health attempt unavailable'));
  if(signal.aborted)return abort();
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(()=>{if(signal.aborted)throw new Error('health attempt unavailable');return action();}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
async function boundedJson(reply,signal){
 if(typeof reply?.body?.getReader!=='function')throw new Error('health attempt unavailable');
 const reader=reply.body.getReader(),chunks=[];let bytes=0,cancelled=false;
 const cancel=()=>{if(cancelled)return;cancelled=true;try{Promise.resolve(reader.cancel()).catch(()=>{});}catch(_){}};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  if(reply.redirected||!/^application\/json(?:\s*;|$)/i.test(reply.headers?.get('content-type')||'')||!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(reply.headers?.get('cache-control')||''))throw new Error('health attempt unavailable');
  const length=reply.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>16384))throw new Error('health attempt unavailable');
  for(;;){const part=await active(signal,()=>reader.read());if(part.done)break;const chunk=Buffer.from(part.value);bytes+=chunk.length;if(bytes>16384)throw new Error('health attempt unavailable');chunks.push(chunk);}
  if(signal.aborted)throw new Error('health attempt unavailable');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }finally{signal.removeEventListener('abort',cancel);cancel();}
}
async function claim(body,cfg,{fetchImpl=global.fetch,getTokenImpl=Bridge.officialVercelOidcToken,signal}={}){
 if(!configured(cfg))return {claimed:false,error_code:'GAS_HEALTH_ATTEMPT_UNCONFIGURED'};
 const field=body&&typeof body==='object'?Object.getOwnPropertyDescriptor(body,'nonce'):null;
 if(!field||!Object.hasOwn(field,'value')||typeof field.value!=='string'||!UUID.test(field.value))return {claimed:false,error_code:'GAS_HEALTH_ATTEMPT_REQUEST_INVALID'};
 if(!signal||signal.aborted||typeof fetchImpl!=='function'||typeof getTokenImpl!=='function')return unknown();
 const nonce=field.value,request={probe:'owner-health-attempt-claim',version:'v1',attempt_id:cfg.gasHealthAttemptId,nonce,source_sha:cfg.deploymentSourceSha,deployment_id:cfg.deploymentId};
 let requestSignal;
 try{
  const remote=await active(signal,()=>Bridge.request(request,{
   getTokenImpl:async()=>{
    const token=await active(signal,getTokenImpl);
    return typeof token==='string'&&token.length>=1&&token.length<=8192&&/^[\x21-\x7e]+$/.test(token)?token:'';
   },
   fetchImpl:async(url,init)=>{
    if(url!==Bridge.endpoint()||init.method!=='POST'||Buffer.byteLength(init.body)>8192)throw new Error('health attempt unavailable');
    requestSignal=AbortSignal.any([signal,init.signal]);
    const reply=await active(requestSignal,()=>fetchImpl(url,{...init,signal:requestSignal,redirect:'error',cache:'no-store',headers:{...init.headers,'Cache-Control':'no-store'}}));
    // The bridge owns token authentication and JSON result handling. Its generic
    // body reader is replaced here so this new control surface stays bounded.
    return {ok:reply.ok&&reply.status===200,status:reply.status,json:()=>boundedJson(reply,requestSignal)};
   }
  }));
  if(signal.aborted||requestSignal?.aborted)return unknown();
  if(!remote.ok||remote.remote_status!==200)return remote.remote_status===200?{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_RESPONSE_INVALID'}:unknown();
  const r=remote.body;
  if(!exact(r,RECEIPT_KEYS)||r.ok!==true||r.authenticated!==true||r.probe!==request.probe||r.version!=='v1'||r.send_allowed!==false||r.provider_sends!==0||r.business_writes!==0||r.attempt_id!==request.attempt_id||r.nonce!==nonce||r.source_sha!==request.source_sha||r.deployment_id!==request.deployment_id||r.environment!=='production'||typeof r.claimed!=='boolean'||r.control_writes!==(r.claimed?1:0))return {claimed:false,error_code:'GAS_HEALTH_ATTEMPT_RESPONSE_INVALID'};
  return r.claimed?{claimed:true}:{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_DENIED'};
 }catch(_){return unknown();}
}
module.exports={configured,claim};
