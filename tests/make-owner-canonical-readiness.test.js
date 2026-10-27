'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Readable}=require('node:stream');
const Gateway=require('../server/kk-make-owner-notify');
const Adapter=require('../server/make-owner-telegram-adapter');
const Legacy=require('../server/make-owner-ledger-bridge');
const secret='consumer-secret-'.repeat(3),nonce='123e4567-e89b-42d3-a456-426614174000';
const binding={kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-test',module_id:11,connection_id:11956776,bot_id:'8903740881',manifest_sha256:Adapter.MANIFEST_SHA256};
const env={KK_OWNER_CANONICAL_CONSUMER_SECRET:secret,KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'signing-secret-'.repeat(3),KK_OWNER_CANONICAL_SECRET:'canonical-secret-'.repeat(3),KK_OWNER_LEDGER_PRODUCER_SECRET:'producer-secret-'.repeat(3),KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Legacy.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_OWNER_TELEGRAM_CHAT_ID:'-123456789',KK_OWNER_CANONICAL_GAS_PROJECT_ID:Legacy.SCRIPT_PROJECT_ID,KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID:'deployment-0123456789',KK_OWNER_CANONICAL_OAUTH_CLIENT_ID:'client',KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET:'oauth-secret',KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN:'refresh-token',KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:JSON.stringify(binding)};
const body={stage:'canonical-readiness',version:'v1',nonce,bot_id:binding.bot_id,provider_binding_sha256:Adapter.bindingDigest(binding)};
function request(payload=body,marker='readiness-v1',bearer=secret){const r=Readable.from([Buffer.from(JSON.stringify(payload))]);r.method='POST';r.headers={'x-kk-canonical-probe':marker,authorization:'Bearer '+bearer};return r;}
function response(){return {statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(v){this.body=String(v);},data(){return JSON.parse(this.body);}};}
async function call(input=request(),cfg=env){let io=0;const output=response();await Gateway._test.processRequest(input,output,cfg,async()=>{io++;throw Error('unexpected external I/O');});assert.equal(io,0);assert.equal(output.data().send_allowed,false);return output;}
test('authenticated OFF readiness echoes nonce and reports configuration only',async()=>{const r=await call();assert.equal(r.statusCode,200);assert.deepEqual(r.data(),{mode:'canonical-readiness',version:'v1',authenticated:true,nonce,observed_at:r.data().observed_at,send_allowed:false,transport_enabled:false,canonical_enabled:false,producer_enabled:false,signing_secret_configured:true,canonical_secret_configured:true,producer_secret_configured:true,gas_project_configured:true,gas_deployment_configured:true,gas_oauth_configured:true,durable_store_configured:true,owner_chat_configured:true,adapter_binding_configured:true,adapter_binding_match:true,off_configuration_ready:true});assert.ok(!Number.isNaN(Date.parse(r.data().observed_at)));assert.doesNotMatch(JSON.stringify(r.data()),new RegExp(secret));});
test('binding mismatch and incomplete settings authenticate but never report OFF ready',async()=>{for(const [payload,cfg,field] of [[{...body,provider_binding_sha256:'a'.repeat(64)},env,'adapter_binding_match'],[body,{...env,KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:'null'},'adapter_binding_configured'],[body,{...env,KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID:''},'gas_deployment_configured']]){const r=await call(request(payload),cfg);assert.equal(r.statusCode,200);assert.equal(r.data()[field],false);assert.equal(r.data().off_configuration_ready,false);}});
test('missing wrong short or reused consumer keys fail generically before metadata',async()=>{for(const [cfg,bearer] of [[env,'wrong-secret-'.repeat(3)],[{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:'short'},'short'],[{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:env.KK_OWNER_CANONICAL_SECRET},env.KK_OWNER_CANONICAL_SECRET],[{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:env.KK_OWNER_LEDGER_PRODUCER_SECRET},env.KK_OWNER_LEDGER_PRODUCER_SECRET],[env,'']]){const r=await call(request(body,'readiness-v1',bearer),cfg);assert.equal(r.statusCode,401);assert.deepEqual(r.data(),{mode:'canonical-readiness',version:'v1',send_allowed:false,error_code:'UNAUTHENTICATED'});}});
test('any enabled execution flag returns OFF conflict and never invokes work',async()=>{for(const name of ['KK_MAKE_OWNER_TRANSPORT_ENABLED','KK_OWNER_CANONICAL_ENABLED','KK_OWNER_LEDGER_PRODUCER_ENABLED']){const r=await call(request(),{...env,[name]:'true'});assert.equal(r.statusCode,409);assert.deepEqual(r.data(),{mode:'canonical-readiness',version:'v1',send_allowed:false,error_code:'OFF_STATE_CONFLICT'});}});
test('probe rejects operational stages, extra fields, malformed values and own-data violations',async()=>{for(const payload of [{...body,stage:'canonical-dispatch-start'},{...body,extra:true},{...body,nonce:'bad'},{...body,bot_id:8903740881},{...body,provider_binding_sha256:'A'.repeat(64)},{...body,nonce:['x']},{...body,nonce:'x'.repeat(5000)}]){const r=await call(request(payload));assert.equal(r.statusCode,400);}for(const payload of [Object.assign({...body},{[Symbol('extra')]:1}),Object.defineProperty({...body},'nonce',{get(){throw Error('getter invoked');},enumerable:true})]){const input=request();input.body=payload;const r=await call(input);assert.equal(r.statusCode,400);}const bad=request();bad.body='{"stage":';assert.equal((await call(bad)).statusCode,400);});
test('POST and marker are exact while legacy absent or wrong marker stays OFF503',async()=>{for(const marker of [undefined,'wrong']){const input=request();if(marker===undefined)delete input.headers['x-kk-canonical-probe'];else input.headers['x-kk-canonical-probe']=marker;const r=await call(input);assert.equal(r.statusCode,503);assert.equal(r.data().error_code,'MAKE_OWNER_TRANSPORT_DISABLED_OR_UNBOUND');}const get=request();get.method='GET';assert.equal((await call(get)).statusCode,405);});
test('diagnostic export is fixed single gateway request and independent of capture manifest',()=>{const R=require('../server/make-owner-canonical-readiness');const m=R.READINESS_MODULE;assert.deepEqual(require('../make/telegram-response-adapter/readiness.v1.json'),m);assert.equal(R.READINESS_MODULE_SHA256,crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex'));assert.equal(Adapter.MANIFEST_SHA256,'35f3a0e0909b29e1dd796b9a0ec3fecabc13ed1498e943a891ecdbbe12a8d1ce');assert.equal(m.communication.url,Adapter.ENDPOINT);assert.equal(m.communication.method,'POST');assert.equal(m.communication.headers['X-KK-Canonical-Probe'],'readiness-v1');assert.equal(m.communication.headers.Authorization,'Bearer {{connection.consumerBearer}}');assert.equal(m.communication.body.bot_id,'{{toString(connection.botId)}}');assert.equal(m.communication.body.nonce,'{{parameters.nonce}}');assert.equal(m.communication.body.provider_binding_sha256,'{{parameters.provider_binding_sha256}}');assert.doesNotMatch(JSON.stringify(m),/api\.telegram\.org|sendMessage|dispatch-start|envelope|receipt_id|connection\.botToken/);});

test('pure helper revalidates malformed and incomplete adapter bindings without throwing',()=>{
 const R=require('../server/make-owner-canonical-readiness'),cfg=Gateway._test.config(env);
 for(const adapterBinding of [{}, {...binding,module_id:8}, {...binding,manifest_sha256:'a'.repeat(64)}, {...binding,extra:true}, null]){
  const result=R.evaluate(body,{...cfg,adapterBinding},'Bearer '+secret);
  assert.equal(result.status,200);
  assert.equal(result.body.adapter_binding_configured,false);
  assert.equal(result.body.adapter_binding_match,false);
  assert.equal(result.body.off_configuration_ready,false);
 }
 const mismatch=R.evaluate({...body,bot_id:'1234567890'},cfg,'Bearer '+secret);
 assert.equal(mismatch.body.adapter_binding_configured,true);
 assert.equal(mismatch.body.adapter_binding_match,false);
 assert.equal(mismatch.body.off_configuration_ready,false);
});

test('every missing configuration dependency keeps authenticated OFF readiness false',async()=>{
 for(const [key,field] of [
  ['KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET','signing_secret_configured'],
  ['KK_OWNER_CANONICAL_SECRET','canonical_secret_configured'],
  ['KK_OWNER_LEDGER_PRODUCER_SECRET','producer_secret_configured'],
  ['KK_OWNER_CANONICAL_GAS_PROJECT_ID','gas_project_configured'],
  ['KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID','gas_deployment_configured'],
  ['KK_OWNER_CANONICAL_OAUTH_CLIENT_ID','gas_oauth_configured'],
  ['KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET','gas_oauth_configured'],
  ['KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN','gas_oauth_configured'],
  ['KK_MAKE_OWNER_TRANSPORT_PROJECT_REF','durable_store_configured'],
  ['KK_OWNER_TELEGRAM_CHAT_ID','owner_chat_configured']
 ]){
  const r=await call(request(),{...env,[key]:''});
  assert.equal(r.statusCode,200,key);
  assert.equal(r.data()[field],false,key);
  assert.equal(r.data().off_configuration_ready,false,key);
 }
 const direct=await call(request(),{...env,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'direct'});
 assert.equal(direct.data().durable_store_configured,false);
});

test('missing and signing-reused consumer keys and malformed Authorization are generic 401',async()=>{
 for(const [cfg,authorization] of [
  [{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:''},'Bearer '+secret],
  [{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET},'Bearer '+env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET],
  [env,undefined],[env,['Bearer '+secret]],[env,'bearer '+secret],[env,'Basic '+secret]
 ]){
  const input=request();input.headers.authorization=authorization;
  const r=await call(input,cfg);
  assert.equal(r.statusCode,401);
  assert.deepEqual(Object.keys(r.data()).sort(),['error_code','mode','send_allowed','version']);
 }
});

test('pure helper rejects non-data bodies without evaluating accessors',()=>{
 const R=require('../server/make-owner-canonical-readiness'),cfg=Gateway._test.config(env);
 let getters=0;
 const accessor=Object.defineProperty({...body},'nonce',{get(){getters++;return nonce;},enumerable:true});
 const hidden=Object.defineProperty({...body},'nonce',{value:nonce,enumerable:false});
 const symbol=Object.assign({...body},{[Symbol('extra')]:true});
 for(const payload of [null,undefined,1,'text',[],new Date(),Object.create(body),accessor,hidden,symbol,{...body,bot_id:{}},{...body,provider_binding_sha256:[]}]){
  assert.equal(R.validBody(payload),false);
  assert.deepEqual(R.evaluate(payload,cfg,'Bearer '+secret),{status:400,body:{mode:'canonical-readiness',version:'v1',send_allowed:false,error_code:'BODY_INVALID'}});
 }
 assert.equal(getters,0);
 assert.equal(R.evaluate(Object.assign(Object.create(null),body),cfg,'Bearer '+secret).status,200);
});

test('probe enforces 4096 raw bytes for string and chunked bodies plus strict UTF-8',async()=>{
 const raw=JSON.stringify(body),sized=n=>raw+' '.repeat(n-Buffer.byteLength(raw));
 for(const bytes of [4096,4097]){
  const input=request();input.body=sized(bytes);
  assert.equal((await call(input)).statusCode,bytes===4096?200:400);
  const chunked=Readable.from([Buffer.from(sized(bytes).slice(0,100)),Buffer.from(sized(bytes).slice(100))]);
  chunked.method='POST';chunked.headers={...input.headers};
  assert.equal((await call(chunked)).statusCode,bytes===4096?200:400);
 }
 const invalid=Readable.from([Buffer.from([0xff,0xfe])]);invalid.method='POST';invalid.headers={...request().headers};
 assert.equal((await call(invalid)).statusCode,400);
 for(const payload of [null,[],true,42,'not-json','{"stage":']){
  const input=request();input.body=payload;
  assert.equal((await call(input)).statusCode,400);
 }
});

test('probe path cannot call canonical, durable store, GAS, provider, HTTP or log secrets',async(t)=>{
 const Canonical=require('../server/make-owner-canonical');
 const Oidc=require('../server/runtime-ledger-oidc-bridge');
 const spies=[];
 for(const [target,name] of [[Canonical,'handle'],[Canonical,'executeGas'],[Canonical,'store'],[Legacy,'storeRpc'],[Oidc,'request'],[global,'fetch'],[require('node:http'),'request'],[require('node:https'),'request'],[console,'log'],[console,'warn'],[console,'error']]){
  spies.push(t.mock.method(target,name,()=>{throw Error('forbidden readiness side effect');}));
 }
 const on={...env,KK_MAKE_OWNER_TRANSPORT_ENABLED:'true',KK_OWNER_CANONICAL_ENABLED:'true',KK_OWNER_LEDGER_PRODUCER_ENABLED:'true'};
 for(const cfg of [env,on]){
  await call(request(),cfg);
  for(const stage of ['canonical-dispatch-start','canonical-adapter-result','canonical-poll','prepare','ack','admit']){
   assert.equal((await call(request({...body,stage}),cfg)).statusCode,400);
  }
 }
 for(const spy of spies)assert.equal(spy.mock.callCount(),0);
});

test('responses never expose stored or supplied credentials, headers, key digests or send readiness',async()=>{
 const credentials=[secret,env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET,env.KK_OWNER_CANONICAL_SECRET,env.KK_OWNER_LEDGER_PRODUCER_SECRET,env.KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET,env.KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN,'wrong-credential-'.repeat(3)];
 for(const input of [request(),request(body,'readiness-v1',credentials.at(-1)),request({...body,extra:credentials.at(-1)})]){
  const r=await call(input);
  for(const credential of credentials){
   assert.ok(!r.body.includes(credential));
   assert.ok(!r.body.includes(crypto.createHash('sha256').update(credential).digest('hex')));
  }
  assert.doesNotMatch(r.body,/ready_to_send|authorization|Bearer|consumerBearer|provider_binding_sha256/i);
  assert.equal(r.headers['Cache-Control'],'no-store, no-cache, must-revalidate, max-age=0');
 }
});

test('wrong markers preserve the legacy response without reading the probe body',async()=>{
 for(const marker of ['', 'READINESS-V1','readiness-v1 ',['readiness-v1']]){
  const input=request();input.headers['x-kk-canonical-probe']=marker;
  Object.defineProperty(input,'body',{get(){throw Error('legacy OFF path must not parse body');}});
  const r=await call(input);
  assert.equal(r.statusCode,503);
  assert.equal(r.data().error_code,'MAKE_OWNER_TRANSPORT_DISABLED_OR_UNBOUND');
 }
});
