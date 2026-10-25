'use strict';
// Server-only verification endpoint. Remains disabled without explicit env and
// pre-seeded canonical outbox rows; cannot create a booking, publish X or price.
const Contract=require('./make-owner-transport-contract.js');
const Runtime=require('./runtime-ledger.js');
const LedgerBridge=require('./make-owner-ledger-bridge.js');
const crypto=require('node:crypto');

function t(v){ return String(v==null?'':v).trim(); }
function enabled(v){ return /^(1|true|yes|on)$/i.test(t(v)); }
function captureProfile(env){
  try{
    const profile=JSON.parse(env.KK_OWNER_CANONICAL_CAPTURE_PROFILE_JSON||'null');
    if(!profile||typeof profile!=='object'||Array.isArray(profile)||profile.id!=='native-telegram-617-module8-v1'||profile.scenario_id!=='6176241'||profile.module_id!==8||profile.connection_id!==10356915||
      !/^[a-f0-9]{64}$/.test(profile.schema_sha256||'')||!/^[a-f0-9]{64}$/.test(profile.profile_digest||'')||profile.profile_digest!==env.KK_OWNER_CANONICAL_CAPTURE_REVIEW_SHA256)return null;
    return profile;
  }catch(_){return null;}
}
function config(env=process.env){
  const ref=Runtime.projectRefFromUrl(env.SUPABASE_URL);
  const expected=t(env.KK_MAKE_OWNER_TRANSPORT_PROJECT_REF);
  const key=Runtime.resolveServerKey(env).value;
  const secret=t(env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET);
  const ownerChatId=t(env.KK_OWNER_TELEGRAM_CHAT_ID);
  const storeMode=t(env.KK_MAKE_OWNER_TRANSPORT_STORE_MODE||'direct');
  const storeReady=storeMode==='vercel-oidc'?expected===LedgerBridge.PROJECT_REF:
    storeMode==='direct'&&!!ref&&!!expected&&ref===expected&&!!key;
  return {
    enabled:enabled(env.KK_MAKE_OWNER_TRANSPORT_ENABLED),
    ready:enabled(env.KK_MAKE_OWNER_TRANSPORT_ENABLED)&&storeReady&&secret.length>=32&&/^-?[0-9]{4,25}$/.test(ownerChatId),
    url:t(env.SUPABASE_URL).replace(/\/+$/,''),
    key,secret,ownerChatId,storeMode,expectedRef:expected,
    producerEnabled:enabled(env.KK_OWNER_LEDGER_PRODUCER_ENABLED),
    producerSecret:String(env.KK_OWNER_LEDGER_PRODUCER_SECRET||''),
    canonicalEnabled:enabled(env.KK_OWNER_CANONICAL_ENABLED),
    canonicalSecret:String(env.KK_OWNER_CANONICAL_SECRET||''),
    canonicalConsumerSecret:String(env.KK_OWNER_CANONICAL_CONSUMER_SECRET||''),
    captureProfile:captureProfile(env),captureProfileReviewSha256:t(env.KK_OWNER_CANONICAL_CAPTURE_REVIEW_SHA256),
    gasProjectId:t(env.KK_OWNER_CANONICAL_GAS_PROJECT_ID),gasDeploymentId:t(env.KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID),
    gasClientId:t(env.KK_OWNER_CANONICAL_OAUTH_CLIENT_ID),gasClientSecret:String(env.KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET||''),
    gasRefreshToken:String(env.KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN||''),
    bindingMatches:storeMode==='vercel-oidc'?expected===LedgerBridge.PROJECT_REF:!!ref&&!!expected&&ref===expected
  };
}
function response(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify({transport_version:Contract.VERSION,...body}));
}
async function readJson(req,maxBytes=10000){
  let parsed;
  if(req.body!==undefined&&typeof req.body!=='string'){
    if(!Contract.isPlainObject(req.body)) throw new Error('not an object');
    if(Buffer.byteLength(JSON.stringify(req.body))>maxBytes) throw new Error('too large');
    parsed=req.body;
  }else{
    const chunks=[];
    let bytes=0;
    if(typeof req.body==='string'){
      const chunk=Buffer.from(req.body,'utf8');
      bytes=chunk.length;chunks.push(chunk);
    }else{
      for await(const chunk of req){
        const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
        bytes+=buffer.length;
        if(bytes>maxBytes) throw new Error('too large');
        chunks.push(buffer);
      }
    }
    if(bytes>maxBytes) throw new Error('too large');
    // Decode once: HTTP chunks may split a multibyte Thai character.
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
    parsed=JSON.parse(raw||'{}');
  }
  if(!Contract.isPlainObject(parsed)) throw new Error('not an object');
  return parsed;
}
async function rpc(name,body,cfg,fetchImpl=global.fetch){
  const headers={apikey:cfg.key,'Content-Type':'application/json',Accept:'application/json'};
  // New sb_secret_ keys authenticate through apikey. Do not send opaque keys
  // as JWT Bearer credentials; legacy service_role JWTs still require Bearer.
  if(!/^sb_secret_/.test(cfg.key)) headers.Authorization='Bearer '+cfg.key;
  const controller=new AbortController();
  let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      reject(Object.assign(new Error('owner transport durable store timed out'),{code:'DURABLE_STORE_TIMEOUT'}));
      controller.abort();
    },5000);
  });
  const operation=async()=>{
    const reply=await fetchImpl(cfg.url+'/rest/v1/rpc/'+name,{
      method:'POST',headers,redirect:'error',signal:controller.signal,
      body:JSON.stringify(body)
    });
    if(!reply.ok) throw Object.assign(new Error('owner transport durable store rejected'),{code:'DURABLE_STORE_REJECTED',http:reply.status});
    const value=await reply.json();
    if(!Array.isArray(value)) throw Object.assign(new Error('owner transport response invalid'),{code:'DURABLE_STORE_RESPONSE_INVALID'});
    return value;
  };
  try{return await Promise.race([operation(),deadline]);}
  finally{clearTimeout(timer);}
}
async function processRequest(req,res,env=process.env,fetchImpl=global.fetch,options={}){
  if(req.method!=='POST') return response(res,405,{ok:false,send_allowed:false,error_code:'METHOD_NOT_ALLOWED'});
  const cfg=config(env);
  // No DB call or Telegram send when disabled / improperly project-bound.
  if(!cfg.ready) return response(res,503,{ok:false,send_allowed:false,error_code:'MAKE_OWNER_TRANSPORT_DISABLED_OR_UNBOUND'});
  let body;
  try{body=await readJson(req,cfg.producerEnabled?280000:10000);}catch(_){return response(res,400,{ok:false,send_allowed:false,error_code:'BODY_INVALID'});}
  const fields=Object.getOwnPropertyDescriptors(body);
  if(Object.values(fields).some(field=>!Object.prototype.hasOwnProperty.call(field,'value'))){
    return response(res,400,{ok:false,send_allowed:false,error_code:'BODY_INVALID'});
  }
  const stage=body.stage;
  if(typeof stage==='string'&&stage.startsWith('canonical-')){
    if(cfg.canonicalEnabled){
      const expected=cfg.canonicalConsumerSecret,authorization=req.headers?.authorization||'',provided=typeof authorization==='string'&&authorization.startsWith('Bearer ')?authorization.slice(7):'';
      if(expected.length<32||expected===cfg.secret||expected===cfg.canonicalSecret||!provided||!crypto.timingSafeEqual(crypto.createHash('sha256').update(expected).digest(),crypto.createHash('sha256').update(provided).digest()))return response(res,401,{ok:false,send_allowed:false,error_code:'CANONICAL_CONSUMER_UNAUTHENTICATED'});
      cfg.consumerAuthenticated=true;
    }
    try{return response(res,200,await require('./make-owner-canonical').handle(body,cfg,{fetchImpl,...options}));}
    catch(e){return response(res,503,{ok:false,send_allowed:false,error_code:typeof e?.code==='string'?e.code:'CANONICAL_UNAVAILABLE'});}
  }
  if(stage==='admit'||stage==='readback'){
    if(Object.keys(fields).length!==2||!Object.hasOwn(fields,'attestation'))return response(res,400,{ok:false,send_allowed:false,error_code:'BODY_INVALID'});
    try{
      const result=await LedgerBridge[stage](body.attestation,cfg,{fetchImpl,...options});
      return response(res,200,result);
    }catch(e){
      const code=typeof e?.code==='string'?e.code:'OWNER_LEDGER_BRIDGE_UNAVAILABLE';
      const local=/^(PRODUCER_|OWNER_UAT_|EXACT_|DUPLICATE_|LEDGER_|CLOCK_|IMMUTABLE_|DEDUP_|NOTIFICATION_|INPUT_|STRING_|ROW_|MAPPING_)/.test(code);
      return response(res,local?401:503,{ok:false,send_allowed:false,error_code:code});
    }
  }
  if(Buffer.byteLength(JSON.stringify(body))>10000)return response(res,400,{ok:false,send_allowed:false,error_code:'BODY_INVALID'});
  if(stage!=='prepare'&&stage!=='ack') return response(res,400,{ok:false,send_allowed:false,error_code:'TRANSPORT_STAGE_FORBIDDEN'});
  const allowed=stage==='prepare'?['stage','envelope']:['stage','envelope','receipt_id','provider_message_id'];
  if(Object.keys(fields).some(key=>!allowed.includes(key))) return response(res,400,{ok:false,send_allowed:false,error_code:'BODY_INVALID'});
  const envelope=body.envelope;
  const verified=Contract.verifyEnvelope(envelope,cfg.secret);
  if(!verified.ok) return response(res,401,{ok:false,send_allowed:false,error_code:verified.error_code});
  const storeCall=(name,input)=>cfg.storeMode==='vercel-oidc'
    ?LedgerBridge.storeRpc(name,input,cfg,{fetchImpl,...options}):rpc(name,input,cfg,fetchImpl);
  if(stage==='prepare'){
    const result=await Contract.prepareDispatch(envelope,{
      secret:cfg.secret,ownerChatId:cfg.ownerChatId,
      claimFn:async input=>{
        const rows=await storeCall('kk_make_owner_notification_claim',{
          p_notification_id:input.notification_id,p_request_id:input.request_id,
          p_event_type:input.event_type,p_entity_id:input.entity_id,
          p_content_version:input.content_version,p_text_sha256:input.text_sha256,
          p_expires_at:input.expires_at
        });
        return rows.length===1&&Contract.isPlainObject(rows[0])?rows[0]:null;
      }
    });
    return response(res,result.send_allowed?200:409,result);
  }
  if(stage==='ack'){
    const receipt=body.receipt_id,providerMessage=body.provider_message_id;
    if(!Contract.isReceiptId(receipt)||typeof providerMessage!=='string'||!/^[0-9]{1,20}$/.test(providerMessage)){
      return response(res,400,{ok:false,send_allowed:false,error_code:'DELIVERY_RECEIPT_INVALID'});
    }
    try{
      const rows=await storeCall('kk_make_owner_notification_ack',{
        p_notification_id:verified.notification_id,
        p_receipt_id:receipt,
        p_provider_message_id:providerMessage
      });
      if(cfg.storeMode==='vercel-oidc'){
        const tuple=require('./make-owner-ledger-plan').decodeLedgerIdentity({notification_id:envelope.notification_id,request_id:envelope.request_id,entity_id:envelope.entity_id});
        const durable=LedgerBridge.validatePersisted(await storeCall('kk_make_owner_notification_readback',{p_source_notification_id:tuple.notification_id}),tuple.notification_id);
        const row=durable.outbox;
        if(durable.descriptor.content_version!==envelope.content_version||durable.descriptor.text!==envelope.text||row.status!=='SENT'||row.receipt_id!==receipt||row.provider_message_id!==providerMessage){
          return response(res,409,{ok:false,send_allowed:false,error_code:'DELIVERY_ACK_NOT_RESERVED'});
        }
        return response(res,200,{ok:true,send_allowed:false,status:'SENT',notification_id:verified.notification_id,receipt_id:receipt,provider_message_id:providerMessage,api_accepted_at:row.delivered_at,delivery_confirmed:false,idempotent:rows.length===0});
      }
      if(rows.length!==1||!Contract.isPlainObject(rows[0])||rows[0].status!=='SENT'||rows[0].provider_message_id!==providerMessage){
        return response(res,409,{ok:false,send_allowed:false,error_code:'DELIVERY_ACK_NOT_RESERVED'});
      }
      return response(res,200,{ok:true,send_allowed:false,status:'SENT',notification_id:verified.notification_id});
    }catch(_){
      return response(res,503,{ok:false,send_allowed:false,error_code:'DELIVERY_ACK_STORE_UNAVAILABLE'});
    }
  }
  return response(res,400,{ok:false,send_allowed:false,error_code:'TRANSPORT_STAGE_FORBIDDEN'});
}
module.exports=async function handler(req,res){
  try{await processRequest(req,res);}catch(_){
    response(res,503,{ok:false,send_allowed:false,error_code:'OWNER_TRANSPORT_STORE_UNAVAILABLE'});
  }
};
module.exports._test={config,response,readJson,rpc,processRequest};
