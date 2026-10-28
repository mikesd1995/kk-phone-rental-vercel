'use strict';
// Configuration-only OFF probe. No network, store, provider, or canonical work.
const crypto=require('node:crypto');
const Adapter=require('./make-owner-telegram-adapter');
const Legacy=require('./make-owner-ledger-bridge');
const READINESS_MODULE={name:'checkCanonicalReadiness',typeId:4,connection:'ownerTelegramAdapter',mappable_parameters:[{name:'nonce',type:'text',required:true},{name:'provider_binding_sha256',type:'text',required:true}],communication:{url:Adapter.ENDPOINT,method:'POST',type:'json',headers:{'X-KK-Canonical-Probe':'readiness-v1',Authorization:'Bearer {{connection.consumerBearer}}'},body:{stage:'canonical-readiness',version:'v1',nonce:'{{parameters.nonce}}',bot_id:'{{toString(connection.botId)}}',provider_binding_sha256:'{{parameters.provider_binding_sha256}}'},followRedirect:false,followAllRedirects:false,response:{type:'json',valid:'{{statusCode === 200 && body.mode === "canonical-readiness" && body.version === "v1" && body.authenticated === true && body.nonce === parameters.nonce && body.send_allowed === false}}',output:'{{body}}'},log:{sanitize:['request.headers.authorization','request.headers.Authorization','request.body','response.body']}}};
const READINESS_MODULE_SHA256=crypto.createHash('sha256').update(JSON.stringify(READINESS_MODULE)).digest('hex');
const bare=(status,error_code)=>({status,body:{mode:'canonical-readiness',version:'v1',send_allowed:false,error_code}});
function validBody(body){
 if(body===null||typeof body!=='object'||Array.isArray(body)||(Object.getPrototypeOf(body)!==Object.prototype&&Object.getPrototypeOf(body)!==null))return false;
 const descriptors=Object.getOwnPropertyDescriptors(body);
 if(Reflect.ownKeys(body).length!==5||Object.keys(descriptors).sort().join(',')!=='bot_id,nonce,provider_binding_sha256,stage,version'||Object.values(descriptors).some(d=>!Object.hasOwn(d,'value')||!d.enumerable))return false;
 return body.stage==='canonical-readiness'&&body.version==='v1'&&typeof body.nonce==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.nonce)&&typeof body.bot_id==='string'&&/^[1-9][0-9]{3,19}$/.test(body.bot_id)&&typeof body.provider_binding_sha256==='string'&&/^[0-9a-f]{64}$/.test(body.provider_binding_sha256);
}
function authenticate(cfg,authorization){
 const expected=cfg.canonicalConsumerSecret;
 if(typeof expected!=='string'||expected.length<32||[cfg.secret,cfg.canonicalSecret,cfg.producerSecret].includes(expected)||typeof authorization!=='string'||!authorization.startsWith('Bearer '))return false;
 const provided=authorization.slice(7);
 if(!provided)return false;
 return crypto.timingSafeEqual(crypto.createHash('sha256').update(expected).digest(),crypto.createHash('sha256').update(provided).digest());
}
function evaluate(body,cfg,authorization,observedAt=new Date()){
 if(!validBody(body))return bare(400,'BODY_INVALID');
 if(!authenticate(cfg,authorization))return bare(401,'UNAUTHENTICATED');
 if(cfg.enabled||cfg.canonicalEnabled||cfg.producerEnabled)return bare(409,'OFF_STATE_CONFLICT');
 const signing=typeof cfg.secret==='string'&&cfg.secret.length>=32;
 const canonical=typeof cfg.canonicalSecret==='string'&&cfg.canonicalSecret.length>=32&&cfg.canonicalSecret!==cfg.secret;
 const producer=typeof cfg.producerSecret==='string'&&cfg.producerSecret.length>=32&&cfg.producerSecret!==cfg.secret&&cfg.producerSecret!==cfg.canonicalSecret;
 const project=cfg.gasProjectId===Legacy.SCRIPT_PROJECT_ID;
 const deployment=typeof cfg.gasDeploymentId==='string'&&/^[-_A-Za-z0-9]{16,200}$/.test(cfg.gasDeploymentId);
 const oauth=!!(cfg.gasClientId&&cfg.gasClientSecret&&cfg.gasRefreshToken);
 const store=!!(cfg.bindingMatches&&(cfg.storeMode==='vercel-oidc'||cfg.storeMode==='direct'&&!!cfg.key));
 const owner=typeof cfg.ownerChatId==='string'&&/^-?[0-9]{4,25}$/.test(cfg.ownerChatId);
 // Revalidate here as well as at the gateway config boundary so direct callers
 // cannot mistake an incomplete or stale binding for configured readiness.
 let adapterBinding=null;
 try{adapterBinding=Adapter.validateBinding(cfg.adapterBinding);}catch(_){}
 const binding=!!adapterBinding;
 const match=binding&&adapterBinding.bot_id===body.bot_id&&Adapter.bindingDigest(adapterBinding)===body.provider_binding_sha256;
 return {status:200,body:{mode:'canonical-readiness',version:'v1',authenticated:true,nonce:body.nonce,observed_at:observedAt.toISOString(),send_allowed:false,transport_enabled:false,canonical_enabled:false,producer_enabled:false,signing_secret_configured:signing,canonical_secret_configured:canonical,producer_secret_configured:producer,gas_project_configured:project,gas_deployment_configured:deployment,gas_oauth_configured:oauth,durable_store_configured:store,owner_chat_configured:owner,adapter_binding_configured:binding,adapter_binding_match:match,off_configuration_ready:!!(signing&&canonical&&producer&&project&&deployment&&oauth&&store&&owner&&match)}};
}
module.exports={READINESS_MODULE,READINESS_MODULE_SHA256,evaluate,validBody,authenticate};
