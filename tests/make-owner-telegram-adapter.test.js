'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Adapter=require('../server/make-owner-telegram-adapter');
const vm=require('node:vm');
const uuid=()=>crypto.randomUUID();
const binding=()=>({kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-test',module_id:18,connection_id:456,bot_id:'123456',manifest_sha256:Adapter.MANIFEST_SHA256});
test('Make adapter captures original response in its own RuntimeError frame and has no direct GAS sender',()=>{
 const m=Adapter.MANIFEST,requests=m.module.communication;assert.equal(requests.length,2);assert.equal(m.base.baseUrl,'https://api.telegram.org');assert.equal(m.base.headers,undefined);
 assert.deepEqual(require('../make/telegram-response-adapter/manifest.v1.json'),m,'installable source export cannot drift from reviewed executable manifest');
 assert.match(requests[0].url,/kk-phone-rental\.vercel\.app\/api\/kk-make-owner-notify$/);assert.match(requests[0].headers.Authorization,/consumerBearer/);assert.match(JSON.stringify(requests[0].body),/canonical-dispatch-start/);
 assert.equal(requests[1].url,'/bot{{connection.botToken}}/sendMessage');assert.equal(requests[1].headers.Authorization,undefined);assert.match(requests[1].condition,/dispatch_id/);assert.match(requests[1].condition,/addSeconds\(now, 15\)/);
 assert.equal(requests[1].response.error.type,'RuntimeError');assert.match(requests[1].response.error.message,/KK_TG_CAPTURE_V1\|/);assert.match(requests[1].response.error.message,/createJSON\(body\)/);assert.equal(requests[1].response.valid,undefined);assert.doesNotMatch(JSON.stringify(m),/8\.error\.original_response|script\.googleapis/);
 assert.equal(m.connection.parameters.every(x=>x.type==='password'),true);assert.ok(m.base.log.sanitize.includes('request.url'));
 assert.ok(m.connection.communication.log.sanitize.includes('request.url'));assert.equal(m.connection.communication.response.data.botId,'{{body.result.id}}');assert.match(requests[0].body.bot_id,/connection.botId/);assert.match(requests[1].condition,/provider_binding_sha256/);
});
test('strict full-body frame parser preserves accepted/unknown fields and rejects generic or stale correlation',()=>{
 const id=uuid(),r={ok:false,error_code:429,result:{message_id:123},parameters:{retry_after:600}};
 assert.deepEqual(Adapter.parseFrame('KK_TG_CAPTURE_V1|'+id+'|429|'+JSON.stringify(r),id),{http_status:429,telegram_response:r});
 for(const frame of ['RateLimitError429','KK_TG_CAPTURE_V1|'+uuid()+'|429|'+JSON.stringify(r),'KK_TG_CAPTURE_V1|'+id+'|0429|{}','KK_TG_CAPTURE_V1|'+id+'|429|[]','KK_TG_CAPTURE_V1|'+id+'|429|'+('x'.repeat(17000))])assert.throws(()=>Adapter.parseFrame(frame,id));
});
test('adapter identity binds actual assigned Make module/secure connection/bot and exact source manifest',()=>{
 const b=binding();assert.deepEqual(Adapter.validateBinding(b),b);
 for(const bad of [{...b,module_id:8},{...b,connection_id:10356915},{...b,manifest_sha256:'a'.repeat(64)},{...b,bot_id:'0'},{...b,app_name:'telegram'},{...b,extra:true}])assert.throws(()=>Adapter.validateBinding(bad));
});
test('runtime adapter binding configuration cannot enable a sender and invalid manifests fail closed',async()=>{
 const API=require('../server/kk-make-owner-notify'),V2=require('../server/make-owner-canonical'),b=binding(),env={KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:JSON.stringify(b)};
 const cfg=API._test.config(env);assert.deepEqual(cfg.adapterBinding,b);assert.equal(cfg.ready,false);assert.equal(cfg.canonicalEnabled,false);
 assert.equal(API._test.config({...env,KK_OWNER_CANONICAL_ADAPTER_BINDING_JSON:JSON.stringify({...b,manifest_sha256:'a'.repeat(64)})}).adapterBinding,null);
 let io=0;await assert.rejects(V2.handle({stage:'canonical-dispatch-start'},cfg,{fetchImpl:async()=>{io++;throw Error('unexpected');}}));assert.equal(io,0);
});
test('actual adapter conditions deny malformed stale or refused grants before a provider call in the documented-order model',()=>{
 // A bounded model of documented temp-before-valid ordering and IML helpers;
 // this is not certification of Make's runtime or internal retry engine.
 const requests=Adapter.MANIFEST.module.communication,now=new Date('2026-10-26T05:00:00.000Z'),id=uuid();
 const parameters={attempt_id:uuid(),receipt_id:uuid(),provider_binding_sha256:'a'.repeat(64)},connection={botId:123456};
 const base={ok:true,send_allowed:true,dispatch_id:id,attempt_id:parameters.attempt_id,receipt_id:parameters.receipt_id,provider_binding_sha256:parameters.provider_binding_sha256,bot_id:'123456',text:'ข้อความที่เรนเดอร์แล้ว',target_chat_id:'-123456789',expires_at:new Date(+now+120000).toISOString()};
 const condition=(expression,sandbox)=>vm.runInNewContext(expression.slice(2,-2),{...sandbox,now,toString:String,length:x=>x?.length,trim:x=>String(x).trim(),parseDate:x=>new Date(x),addSeconds:(d,s)=>new Date(+d+s*1000)});
 const calls=(statusCode,body)=>{const temp={grant:body};if(!condition(requests[0].response.valid,{body,temp,parameters,connection,statusCode}))return 0;return condition(requests[1].condition,{temp,parameters,connection})?1:0;};
 assert.equal(calls(200,base),1);
 for(const bad of [{...base,text:undefined},{...base,text:123},{...base,text:'   '},{...base,ok:1},{...base,send_allowed:1},{...base,text:''},{...base,text:'x'.repeat(2049)},{...base,target_chat_id:undefined},{...base,attempt_id:uuid()},{...base,receipt_id:uuid()},{...base,bot_id:'999999'},{...base,provider_binding_sha256:'b'.repeat(64)},{...base,expires_at:new Date(+now+14000).toISOString()},{...base,send_allowed:false}])assert.equal(calls(200,bad),0);
 assert.equal(calls(503,base),0,'temp is populated before validation but a failed response cannot reach provider');
});
module.exports={binding};
test('same617 adapter compiler keeps old provider OFF and uses owned reporter for JSON-safe frame transport',()=>{
 const Builder=require('../server/make-owner-canonical-builder'),b=binding(),ids={poll:11,iterator:12,admit:13,project:14,provider:18,report:19,reject:20,projectReject:21,commit:22};
 const snapshot={scenario_id:'6176241',active:false,lastEdit:'2026-10-23T09:56:20.706Z',incompleteExecutions:0,modules:[{id:5,module:'scenario-service:StartSubscenario',version:2},{id:6,module:'http:MakeRequest',version:4},{id:8,module:'telegram:SendReplyMessage',version:1,disabled:true,config:{parameters:{__IMTCONN__:10356915},mapper:{}}},{id:9,module:'http:MakeRequest',version:4},{id:10,module:'scenario-service:ReturnData',version:2},...['poll','iterator','admit','project'].map(role=>({id:ids[role],module:role==='iterator'?'builtin:BasicFeeder':'http:MakeRequest',version:role==='iterator'?1:4})),...['provider','report','reject'].map(role=>({id:ids[role],module:b.app_name+':'+(role==='provider'?'sendCapturedMessage':'reportCapturedOutcome'),version:1,disabled:true,config:{parameters:{__IMTCONN__:b.connection_id},mapper:{}}})),{id:21,module:'http:MakeRequest',version:4},{id:22,module:'builtin:Commit',version:1}]};
 const cfg={expectedLastEdit:snapshot.lastEdit,gatewayConnectionId:789,connectionAllowedUrl:Adapter.ENDPOINT,assignedIds:ids,adapterBinding:b};
 const result=Builder.prepareAdapter(snapshot,cfg),by=Object.fromEntries(result.modules.map(m=>[m.id,m]));
 assert.equal(result.active,false);assert.equal(result.activation_allowed,false);assert.equal(by[8].disabled,true);assert.equal(by[8].root,'orphan');assert.equal(by[18].disabled,true);assert.equal(by[18].follows,6);assert.equal(by[18].config.mapper.provider_binding_sha256,Adapter.bindingDigest(b));
 assert.equal(by[8].filter.conditions[0][0].a,'{{6.data.send_allowed}}');assert.equal(by[18].filter.conditions[0][0].a,'{{6.data.adapter_ready}}');
 assert.equal(by[19].config.mapper.outcome_frame,'{{18.outcome_frame}}');assert.equal(by[20].config.mapper.outcome_frame,'{{18.error.message}}');assert.deepEqual(by[20].parent,{moduleId:18,kind:'errorHandler'});assert.equal(by[14].follows,19);assert.equal(by[21].follows,20);assert.equal(by[22].follows,21);
 assert.doesNotMatch(JSON.stringify(result),/botToken|consumerBearer|\{\{8\.error|\{\{5\.envelope/);
 for(const mutate of [s=>s.active=true,s=>s.modules.find(m=>m.id===18).disabled=false,s=>s.modules.find(m=>m.id===20).config.parameters.__IMTCONN__=10356915,s=>s.modules.find(m=>m.id===22).module='builtin:Break']){const bad=structuredClone(snapshot);mutate(bad);assert.throws(()=>Builder.prepareAdapter(bad,cfg));}
});
