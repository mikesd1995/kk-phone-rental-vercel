'use strict';
// Read-only, finite deployed health diagnostic. It cannot select operational
// functions, invoke native storage, change flags or call a provider.
const Readiness=require('./make-owner-canonical-readiness');
const Legacy=require('./make-owner-ledger-bridge');
const DEPLOYMENT_ID='AKfycbyHqSoCTQtOWjvcl_2Q73RC5W5oQwPOcbJigm88jTMlA3mRDmdXFCmAiN4kPfhoDhHQkw';
const HEALTH_FIELDS=['transport_enabled','send_not_before','telegram_configured','line_configured','uat_armed','uat_target_count','trigger_count','trigger_handlers','ledger_sheet'];
const MAX_RESPONSE_BYTES=16384;
const TIMEOUT_MS=10000;
function bare(status,error_code){return {status,body:{mode:'canonical-gas-health',version:'v1',send_allowed:false,error_code}};}
function fail(code){throw Object.assign(new Error(code),{code});}
function plainData(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))return false;
 const d=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
 return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(d[k],'value')&&d[k].enumerable);
}
function validBody(body){
 if(!plainData(body,['stage','version','nonce','bot_id','provider_binding_sha256']))return false;
 return body.stage==='canonical-gas-health'&&Readiness.validBody({stage:'canonical-readiness',version:body.version,nonce:body.nonce,bot_id:body.bot_id,provider_binding_sha256:body.provider_binding_sha256});
}
function strictClock(value){
 if(typeof value!=='string'||value.length>40)return false;if(value==='')return true;
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
 const local=value.slice(0,19),parsed=Date.parse(local+'Z');
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,19)===local;
}
function normalizeHealth(value){
 if(!plainData(value,HEALTH_FIELDS)||!['transport_enabled','telegram_configured','line_configured','uat_armed'].every(k=>typeof value[k]==='boolean')||!strictClock(value.send_not_before)||!['uat_target_count','trigger_count'].every(k=>Number.isInteger(value[k])&&value[k]>=0&&value[k]<=100)||!Array.isArray(value.trigger_handlers)||value.trigger_handlers.length!==value.trigger_count||value.trigger_handlers.some(h=>!['runKKLineMonitor','runCoreV1Notifier'].includes(h))||value.ledger_sheet!=='_Notification_Ledger')fail('GAS_HEALTH_RESPONSE_INVALID');
 if(value.transport_enabled||value.uat_armed)fail('GAS_HEALTH_OFF_STATE_CONFLICT');
 return {transport_enabled:false,telegram_configured:value.telegram_configured,line_configured:value.line_configured,uat_armed:false,uat_target_count:value.uat_target_count,trigger_count:value.trigger_count,trigger_handlers:[...value.trigger_handlers],ledger_sheet:'_Notification_Ledger',send_not_before_configured:value.send_not_before!==''};
}
async function readBoundedJson(reply,signal){
 if(!reply||typeof reply.body?.getReader!=='function'||!/^application\/json(?:\s*;|$)/i.test(reply.headers?.get('content-type')||''))fail('GAS_HEALTH_RESPONSE_INVALID');
 const declared=reply.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_RESPONSE_BYTES))fail('GAS_HEALTH_RESPONSE_INVALID');
 const reader=reply.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch(_){}};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  if(signal.aborted)fail('GAS_HEALTH_OUTCOME_UNKNOWN');
  for(;;){const part=await reader.read();if(signal.aborted)fail('GAS_HEALTH_OUTCOME_UNKNOWN');if(part.done)break;const buffer=Buffer.from(part.value);bytes+=buffer.length;if(bytes>MAX_RESPONSE_BYTES)fail('GAS_HEALTH_RESPONSE_INVALID');chunks.push(buffer);}
  let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch(_){fail('GAS_HEALTH_RESPONSE_INVALID');}
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))fail('GAS_HEALTH_RESPONSE_INVALID');return parsed;
 }finally{signal.removeEventListener('abort',cancel);cancel();}
}
async function evaluate(body,cfg,authorization,{fetchImpl=global.fetch}={}){
 if(!validBody(body))return bare(400,'BODY_INVALID');
 if(!Readiness.authenticate(cfg,authorization))return bare(401,'UNAUTHENTICATED');
 if(cfg.enabled||cfg.canonicalEnabled||cfg.producerEnabled)return bare(409,'OFF_STATE_CONFLICT');
 const equivalent={stage:'canonical-readiness',version:'v1',nonce:body.nonce,bot_id:body.bot_id,provider_binding_sha256:body.provider_binding_sha256};
 const readiness=Readiness.evaluate(equivalent,cfg,authorization);
 if(readiness.status!==200||readiness.body.off_configuration_ready!==true||cfg.storeMode!=='vercel-oidc'||cfg.expectedRef!==Legacy.PROJECT_REF||cfg.gasProjectId!==Legacy.SCRIPT_PROJECT_ID||cfg.gasDeploymentId!==DEPLOYMENT_ID)return bare(503,'GAS_HEALTH_DISABLED_OR_UNBOUND');
 const oauthRequest=new URLSearchParams({grant_type:'refresh_token',client_id:cfg.gasClientId,client_secret:cfg.gasClientSecret,refresh_token:cfg.gasRefreshToken}).toString();
 if(Buffer.byteLength(oauthRequest)>32768)return bare(503,'GAS_HEALTH_DISABLED_OR_UNBOUND');
 const controller=new AbortController();let timer;
 const operation=async()=>{
  const signal=controller.signal;
  const oauthReply=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:oauthRequest});
  if(!oauthReply.ok)fail('GAS_HEALTH_OAUTH_REJECTED');
  const oauth=await readBoundedJson(oauthReply,signal);
  if(typeof oauth.access_token!=='string'||oauth.access_token.length<1||oauth.access_token.length>8192||!/^[\x21-\x7e]+$/.test(oauth.access_token)||oauth.token_type!=='Bearer'||!Number.isInteger(oauth.expires_in)||oauth.expires_in<30)fail('GAS_HEALTH_OAUTH_INVALID');
  if(signal.aborted)fail('GAS_HEALTH_OUTCOME_UNKNOWN');
  const gasReply=await fetchImpl('https://script.googleapis.com/v1/scripts/'+DEPLOYMENT_ID+':run',{method:'POST',redirect:'error',signal,headers:{Authorization:'Bearer '+oauth.access_token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({function:'getCoreV1NotifierHealth',parameters:[],devMode:false})});
  if(!gasReply.ok)fail('GAS_HEALTH_GAS_REJECTED');
  const outcome=await readBoundedJson(gasReply,signal);
  if(outcome.done!==true||Object.hasOwn(outcome,'error')||!outcome.response||typeof outcome.response!=='object'||Array.isArray(outcome.response)||!Object.hasOwn(outcome.response,'result'))fail('GAS_HEALTH_GAS_OUTCOME_UNKNOWN');
  const health=normalizeHealth(outcome.response.result);
  return {status:200,body:{mode:'canonical-gas-health',version:'v1',authenticated:true,nonce:body.nonce,observed_at:new Date().toISOString(),send_allowed:false,transport_enabled:false,canonical_enabled:false,producer_enabled:false,oauth_refresh_accepted:true,gas_health_executed:true,off_health_verified:true,notifier_trigger_binding_match:health.trigger_count===1&&health.trigger_handlers[0]==='runKKLineMonitor',provider_sends:0,business_writes:0,health}};
 };
 try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('GAS_HEALTH_OUTCOME_UNKNOWN'),{code:'GAS_HEALTH_OUTCOME_UNKNOWN'}));},TIMEOUT_MS);})]);}
 catch(error){const code=['GAS_HEALTH_OAUTH_REJECTED','GAS_HEALTH_OAUTH_INVALID','GAS_HEALTH_GAS_REJECTED','GAS_HEALTH_GAS_OUTCOME_UNKNOWN','GAS_HEALTH_RESPONSE_INVALID','GAS_HEALTH_OFF_STATE_CONFLICT','GAS_HEALTH_OUTCOME_UNKNOWN'].includes(error?.code)?error.code:'GAS_HEALTH_OUTCOME_UNKNOWN';return bare(code==='GAS_HEALTH_OFF_STATE_CONFLICT'?409:503,code);}
 finally{clearTimeout(timer);controller.abort();}
}
module.exports={evaluate,validBody};
