'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Readable}=require('node:stream');
const Gateway=require('../server/kk-make-owner-notify');
const Adapter=require('../server/make-owner-telegram-adapter');
const Legacy=require('../server/make-owner-ledger-bridge');
const nonce='123e4567-e89b-42d3-a456-426614174000',consumer='consumer-off-health-'.repeat(3);
const deployment='AKfycbyHqSoCTQtOWjvcl_2Q73RC5W5oQwPOcbJigm88jTMlA3mRDmdXFCmAiN4kPfhoDhHQkw';
const binding={kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-test',module_id:11,connection_id:11956776,bot_id:'8903740881',manifest_sha256:Adapter.MANIFEST_SHA256};
const env={KK_OWNER_CANONICAL_CONSUMER_SECRET:consumer,KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'signing-secret-'.repeat(3),KK_OWNER_CANONICAL_SECRET:'canonical-secret-'.repeat(3),KK_OWNER_LEDGER_PRODUCER_SECRET:'producer-secret-'.repeat(3),KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Legacy.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_OWNER_TELEGRAM_CHAT_ID:'-123456789',KK_OWNER_CANONICAL_GAS_PROJECT_ID:Legacy.SCRIPT_PROJECT_ID,KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID:deployment,KK_OWNER_CANONICAL_OAUTH_CLIENT_ID:'test-oauth-client',KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET:'test-oauth-secret',KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN:'test-refresh-token',KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:JSON.stringify(binding)};
const payload={stage:'canonical-gas-health',version:'v1',nonce,bot_id:binding.bot_id,provider_binding_sha256:Adapter.bindingDigest(binding)};
const health={transport_enabled:false,send_not_before:'2026-10-28T00:00:00.000Z',telegram_configured:true,line_configured:true,uat_armed:false,uat_target_count:1,trigger_count:1,trigger_handlers:['runKKLineMonitor'],ledger_sheet:'_Notification_Ledger'};
const token={access_token:'test-access-token',token_type:'Bearer',expires_in:3600,scope:'https://www.googleapis.com/auth/script.scriptapp'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const execution=value=>({done:true,response:{'@type':'type.googleapis.com/google.apps.script.v1.ExecutionResponse',result:value}});
function request(body=payload,marker='gas-health-v1',bearer=consumer){const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';req.headers={'x-kk-canonical-probe':marker,authorization:'Bearer '+bearer};return req;}
function response(){return {statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(v){this.body=String(v);},data(){return JSON.parse(this.body);}};}
async function call({req=request(),cfg=env,replies=[json(token),json(execution(health))],fetchImpl}={}){const calls=[],res=response();await Gateway._test.processRequest(req,res,cfg,fetchImpl||(async(url,init)=>{calls.push({url,init});if(calls.length>replies.length)throw Error('unexpected additional request');const item=replies[calls.length-1];if(item instanceof Error)throw item;return item;}));assert.equal(res.data().send_allowed,false);return {res,calls};}
function noSecretLeaks(res){for(const value of [consumer,...Object.entries(env).filter(([k])=>/SECRET|TOKEN|CLIENT_ID/.test(k)).map(([,v])=>v),token.access_token]){assert.ok(!res.body.includes(value));assert.ok(!res.body.includes(crypto.createHash('sha256').update(value).digest('hex')));}assert.doesNotMatch(res.body,/authorization|Bearer|refresh_token|access_token|client_secret|error_description|stack|ready_to_send/i);}

test('OFF health refreshes OAuth once and executes only the pinned deployed no-argument health function',async()=>{
 const {res,calls}=await call();assert.equal(res.statusCode,200);assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://oauth2.googleapis.com/token');assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.redirect,'error');assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].init.body)),{grant_type:'refresh_token',client_id:'test-oauth-client',client_secret:'test-oauth-secret',refresh_token:'test-refresh-token'});
 assert.equal(calls[1].url,'https://script.googleapis.com/v1/scripts/'+deployment+':run');assert.equal(calls[1].init.redirect,'error');assert.equal(calls[1].init.headers.Authorization,'Bearer test-access-token');assert.deepEqual(JSON.parse(calls[1].init.body),{function:'getCoreV1NotifierHealth',parameters:[],devMode:false});
 assert.deepEqual(res.data(),{mode:'canonical-gas-health',version:'v1',authenticated:true,nonce,observed_at:res.data().observed_at,send_allowed:false,transport_enabled:false,canonical_enabled:false,producer_enabled:false,oauth_refresh_accepted:true,gas_health_executed:true,off_health_verified:true,notifier_trigger_binding_match:true,provider_sends:0,business_writes:0,health:{transport_enabled:false,telegram_configured:true,line_configured:true,uat_armed:false,uat_target_count:1,trigger_count:1,trigger_handlers:['runKKLineMonitor'],ledger_sheet:'_Notification_Ledger',send_not_before_configured:true}});
 assert.ok(!Number.isNaN(Date.parse(res.data().observed_at)));assert.equal(res.headers['cache-control'],'no-store, no-cache, must-revalidate, max-age=0');assert.equal(res.headers['x-content-type-options'],'nosniff');assert.ok(!res.body.includes(health.send_not_before));noSecretLeaks(res);
});

test('wrong consumer or any enabled execution flag stops before Google or any other I/O',async()=>{
 for(const [cfg,bearer,want] of [[env,'wrong',401],[{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:'short'},'short',401],[{...env,KK_OWNER_CANONICAL_CONSUMER_SECRET:env.KK_OWNER_LEDGER_PRODUCER_SECRET},env.KK_OWNER_LEDGER_PRODUCER_SECRET,401],...['KK_MAKE_OWNER_TRANSPORT_ENABLED','KK_OWNER_CANONICAL_ENABLED','KK_OWNER_LEDGER_PRODUCER_ENABLED'].map(k=>[{...env,[k]:'true'},consumer,409])]){const {res,calls}=await call({req:request(payload,'gas-health-v1',bearer),cfg,replies:[]});assert.equal(res.statusCode,want);assert.equal(calls.length,0);noSecretLeaks(res);}
});

test('project deployment OAuth adapter bot and digest mismatches fail closed without refresh',async()=>{
 const cases=[{cfg:{...env,KK_OWNER_CANONICAL_GAS_PROJECT_ID:'wrong-project'}},{cfg:{...env,KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID:'other-deployment-0123456789'}},{cfg:{...env,KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:'wrong-project'}},{cfg:{...env,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'direct'}},{cfg:{...env,KK_OWNER_CANONICAL_OAUTH_CLIENT_ID:''}},{cfg:{...env,KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET:''}},{cfg:{...env,KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN:''}},{cfg:{...env,KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:'null'}},{req:request({...payload,bot_id:'1234567890'})},{req:request({...payload,provider_binding_sha256:'a'.repeat(64)})}];
 for(const c of cases){const {res,calls}=await call({...c,replies:[]});assert.equal(res.statusCode,503);assert.equal(calls.length,0);assert.equal(res.data().error_code,'GAS_HEALTH_DISABLED_OR_UNBOUND');noSecretLeaks(res);}
});

test('health route rejects arbitrary caller work and object traps before network',async()=>{
 const bad=[{...payload,stage:'canonical-poll'},{...payload,url:'https://attacker.invalid'},{...payload,function:'runCoreV1Notifier'},{...payload,parameters:[]},{...payload,deployment_id:'anything'},{...payload,nonce:'bad'},{...payload,bot_id:8903740881},{...payload,provider_binding_sha256:'A'.repeat(64)},null,[],true];
 for(const b of bad){const {res,calls}=await call({req:request(b),replies:[]});assert.equal(res.statusCode,400);assert.equal(calls.length,0);}
 let getters=0;for(const b of [Object.assign({...payload},{[Symbol('extra')]:true}),Object.defineProperty({...payload},'nonce',{get(){getters++;throw Error('accessor');},enumerable:true}),Object.defineProperty({...payload},'nonce',{value:nonce,enumerable:false}),Object.create(payload)]){const req=request();req.body=b;const {res,calls}=await call({req,replies:[]});assert.equal(res.statusCode,400);assert.equal(calls.length,0);}assert.equal(getters,0);
});

test('health request accepts safe structured data but enforces streamed size and UTF-8 bounds',async()=>{
 const req=request();req.body={...payload};assert.equal((await call({req})).res.statusCode,200);
 const raw=JSON.stringify(payload);for(const n of [4096,4097]){const r=request();r.body=raw+' '.repeat(n-Buffer.byteLength(raw));const {res,calls}=await call({req:r});assert.equal(res.statusCode,n===4096?200:400);assert.equal(calls.length,n===4096?2:0);}
 for(const data of [Buffer.from([0xff,0xfe]),Buffer.from('{"stage":'),Buffer.from(JSON.stringify(payload)+' '.repeat(4097))]){const r=Readable.from([data]);r.method='POST';r.headers={...request().headers};const {res,calls}=await call({req:r,replies:[]});assert.equal(res.statusCode,400);assert.equal(calls.length,0);}
});

test('OAuth failures and malformed token metadata are sanitized without a second request or retry',async()=>{
 for(const r of [json({error:'invalid_grant',error_description:'test-refresh-token'},400),json({...token,token_type:'Basic'}),json({...token,access_token:''}),json({...token,access_token:'bad\r\nheader'}),json({...token,expires_in:0}),json({...token,expires_in:'3600'}),new Response('not JSON',{headers:{'Content-Type':'application/json'}}),new Response('moved',{status:302,headers:{Location:'https://attacker.invalid'}}),new Error('test-oauth-secret')]){const {res,calls}=await call({replies:[r]});assert.equal(res.statusCode,503);assert.equal(calls.length,1);noSecretLeaks(res);}
});

test('Google execution failures are UNKNOWN and do not expose response or exception details',async()=>{
 for(const r of [json({error:{code:403,message:'test-access-token'}},403),json({done:true,error:{details:[{errorMessage:'test-oauth-secret'}]}}),json({done:false}),json({done:true,response:{result:null}}),json({done:true,response:{result:health},error:null}),new Response('moved',{status:302,headers:{Location:'https://attacker.invalid'}}),new Error('test-refresh-token')]){const {res,calls}=await call({replies:[json(token),r]});assert.equal(res.statusCode,503);assert.equal(calls.length,2);noSecretLeaks(res);}
});

test('GAS health validates exact fields types clocks handlers tab and OFF flags',async()=>{
 const cases=[{...health,extra:'test-oauth-secret'},{...health,transport_enabled:'false'},{...health,uat_target_count:-1},{...health,trigger_count:2},{...health,trigger_handlers:['runCoreV1NotifierAndSend']},{...health,ledger_sheet:'Other'},{...health,send_not_before:'test-refresh-token'},{...health,send_not_before:'2026-02-31T00:00:00.000Z'},{...health,trigger_count:101,trigger_handlers:Array(101).fill('runKKLineMonitor')},...['transport_enabled','uat_armed'].map(k=>({...health,[k]:true}))];
 for(const h of cases){const {res,calls}=await call({replies:[json(token),json(execution(h))]});assert.equal(res.statusCode,h.transport_enabled===true||h.uat_armed===true?409:503);assert.equal(calls.length,2);assert.equal(res.data().off_health_verified,undefined);noSecretLeaks(res);}
 const {res}=await call({replies:[json(token),json(execution({...health,trigger_handlers:['runCoreV1Notifier']}))]});assert.equal(res.statusCode,200);assert.equal(res.data().notifier_trigger_binding_match,false);assert.equal(res.data().health.trigger_handlers[0],'runCoreV1Notifier');assert.equal(res.data().ready_to_send,undefined);
});

test('legacy strict RFC3339 health clocks accept valid seconds offsets and fractions without echoing them',async()=>{
 for(const send_not_before of ['', '2026-10-28T00:00:00Z','2026-10-28T07:00:00+07:00','2026-10-27T17:00:00-07:00','2026-10-28T00:00:00.1Z','2026-10-28T07:00:00.123456789+07:00']){
  const {res}=await call({replies:[json(token),json(execution({...health,send_not_before}))]});assert.equal(res.statusCode,200,send_not_before);assert.equal(res.data().health.send_not_before_configured,send_not_before!=='');if(send_not_before)assert.ok(!res.body.includes(send_not_before));
 }
 for(const send_not_before of ['2026-02-31T00:00:00+07:00','2026-10-28T24:00:00Z','2026-10-28T00:00:00+24:00','2026-10-28T00:00:00+07:60','2026-10-28T00:00:00.1234567890Z','2026-10-28 00:00:00Z','2026-10-28T00:00Z','arbitrary text']){
  const {res}=await call({replies:[json(token),json(execution({...health,send_not_before}))]});assert.equal(res.statusCode,503,send_not_before);assert.equal(res.data().error_code,'GAS_HEALTH_RESPONSE_INVALID');
 }
});

test('bounded Google response readers reject oversized token or execution bodies',async()=>{
 for(const replies of [[json({...token,extra:'x'.repeat(17000)})],[json(token),json(execution({...health,extra:'x'.repeat(17000)}))]]){const {res,calls}=await call({replies});assert.equal(res.statusCode,503);assert.equal(calls.length,replies.length);noSecretLeaks(res);}
});

test('oversized internal OAuth request is rejected before any credential-bearing request',async()=>{
 const {res,calls}=await call({cfg:{...env,KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN:'x'.repeat(33000)}});assert.equal(res.statusCode,503);assert.equal(res.data().error_code,'GAS_HEALTH_DISABLED_OR_UNBOUND');assert.equal(calls.length,0);
});

test('one overall deadline cancels a stalled response body and never starts GAS or retries',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let cancelled=0,calls=0;
 const stalled=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"access_token":"pending'));},cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}});
 const res=response(),pending=Gateway._test.processRequest(request(),res,env,async()=>{calls++;return stalled;});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);t.mock.timers.tick(10001);await pending;
 assert.equal(res.statusCode,503);assert.equal(res.data().error_code,'GAS_HEALTH_OUTCOME_UNKNOWN');assert.equal(calls,1);assert.equal(cancelled,1);noSecretLeaks(res);
});

test('new health marker does not widen readiness or operational gates and cannot touch native or providers',async(t)=>{
 const spies=[];for(const [target,name] of [[require('../server/make-owner-canonical'),'handle'],[require('../server/make-owner-canonical'),'executeGas'],[require('../server/make-owner-canonical'),'store'],[Legacy,'storeRpc'],[require('../server/runtime-ledger-oidc-bridge'),'request'],[console,'log'],[console,'warn'],[console,'error']])spies.push(t.mock.method(target,name,()=>{throw Error('forbidden diagnostic side effect');}));
 const {res,calls}=await call();assert.equal(res.statusCode,200);assert.equal(calls.length,2);for(const spy of spies)assert.equal(spy.mock.callCount(),0);
 const old={...payload,stage:'canonical-readiness'};const ready=await call({req:request(old,'readiness-v1'),replies:[]});assert.equal(ready.res.statusCode,200);assert.equal(ready.res.data().off_configuration_ready,true);assert.equal(ready.calls.length,0);
 assert.equal((await call({req:request(payload,'readiness-v1'),replies:[]})).res.statusCode,400);
 for(const marker of ['',undefined,'GAS-HEALTH-V1','gas-health-v1 ',['gas-health-v1']]){const req=request();if(marker===undefined)delete req.headers['x-kk-canonical-probe'];else req.headers['x-kk-canonical-probe']=marker;const {res,calls}=await call({req,replies:[]});assert.equal(res.statusCode,503);assert.equal(calls.length,0);}
 const get=request();get.method='GET';assert.equal((await call({req:get,replies:[]})).res.statusCode,405);assert.equal(Adapter.MANIFEST_SHA256,'35f3a0e0909b29e1dd796b9a0ec3fecabc13ed1498e943a891ecdbbe12a8d1ce');
});
