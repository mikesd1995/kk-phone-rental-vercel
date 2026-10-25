'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Builder=require('../server/make-owner-canonical-builder');
const crypto=require('node:crypto');
function snapshot(){return {scenario_id:'6176241',active:false,lastEdit:'2026-10-23T09:56:20.706Z',incompleteExecutions:0,modules:[{id:5,module:'scenario-service:StartSubscenario',version:2},{id:6,module:'http:MakeRequest',version:4,config:{parameters:{},mapper:{}}},{id:8,module:'telegram:SendReplyMessage',version:1,disabled:true,config:{parameters:{__IMTCONN__:10356915},mapper:{chatId:'original-config',text:'old'}},filter:{name:'old',conditions:[[{a:'{{5.envelope}}',o:'exist'}]]}},{id:9,module:'http:MakeRequest',version:4,config:{parameters:{},mapper:{}}},{id:10,module:'scenario-service:ReturnData',version:2},{id:11,module:'http:MakeRequest',version:4},{id:12,module:'builtin:BasicFeeder',version:1},{id:13,module:'http:MakeRequest',version:4},{id:14,module:'http:MakeRequest',version:4}]};}
const binding={expectedLastEdit:'2026-10-23T09:56:20.706Z',gatewayConnectionId:456,connectionAllowedUrl:'https://kk-phone-rental.vercel.app/api/kk-make-owner-notify',assignedIds:{poll:11,iterator:12,admit:13,project:14}};
test('same617 OFF compiler produces JIT iterator graph preserving provider connection and receipt-bound ACK',()=>{
 const input=snapshot(),before=JSON.stringify(input),p=Builder.prepare(input,binding);assert.equal(JSON.stringify(input),before);assert.equal(p.active,false);assert.equal(p.expectedLastEdit,binding.expectedLastEdit);
 const by=Object.fromEntries(p.modules.map(m=>[m.id,m]));assert.equal(by[11].root,'main');assert.equal(by[12].config.mapper.array,'{{11.data.tickets}}');assert.equal(by[13].follows,12);
 assert.match(by[13].config.mapper.jsonStringBodyContent,/12.ticket/);assert.match(by[6].config.mapper.jsonStringBodyContent,/13.data.envelope_json/);assert.equal(by[8].disabled,true);assert.equal(by[8].config.parameters.__IMTCONN__,10356915);
 assert.doesNotMatch(JSON.stringify(p.modules),/\{\{5\./);assert.match(JSON.stringify(by[8].filter),/receipt_id/);assert.match(JSON.stringify(by[8].filter),/addSeconds\(now; 15\)/);
 assert.match(by[9].config.mapper.jsonStringBodyContent,/8.message_id/);assert.match(by[9].config.mapper.jsonStringBodyContent,/6.data.receipt_id/);assert.equal(by[14].follows,9);assert.match(by[14].config.mapper.jsonStringBodyContent,/canonical-project/);
 assert.deepEqual(p.removeModuleIds,[5,10]);assert.equal(p.settings.sequential,true);assert.equal(p.settings.dlq,false);assert.equal(p.activation_allowed,false);
});
test('compiler refuses active/provider-enabled, stale edit, incomplete runs, missing connection and invented IDs',()=>{
 for(const mutate of [s=>s.active=true,s=>s.modules.find(m=>m.id===8).disabled=false,s=>s.lastEdit='changed',s=>s.incompleteExecutions=1,s=>s.modules=s.modules.filter(m=>m.id!==12),s=>s.modules[2].config.parameters.__IMTCONN__=123,s=>s.modules[2].parent={kind:'errorHandler',moduleId:6}]){const s=snapshot();mutate(s);assert.throws(()=>Builder.prepare(s,binding));}
 for(const b of [{...binding,gatewayConnectionId:null},{...binding,connectionAllowedUrl:'https://attacker.invalid'},{...binding,assignedIds:{...binding.assignedIds,poll:6}}])assert.throws(()=>Builder.prepare(snapshot(),b));
});
test('negative path remains uncompiled without independently reviewed exact module8 capture route',()=>{
 const s=snapshot();s.modules.find(m=>m.id===8).errorHandler={sourceModuleId:8,handlerModuleIds:[15,16],terminal:'Commit'};
 assert.throws(()=>Builder.prepare(s,binding),/UNREVIEWED|CAPTURE/);
 const digest=crypto.createHash('sha256').update(JSON.stringify(s.modules.find(m=>m.id===8).errorHandler)).digest('hex');
 const capture={profile_id:'native-telegram-617-module8-v1',schema_sha256:'a'.repeat(64),review_sha256:'b'.repeat(64),provider_route_sha256:digest,error_module_ids:[15,16],field_mappings:{profile_id:'native-telegram-617-module8-v1',scenario_id:'6176241',module_id:'8',connection_id:'10356915',source_notification_id:'observed-native-source',attempt_id:'observed-admit-attempt',attempt_no:'observed-attempt-number',receipt_id:'observed-reservation-receipt',descriptor_sha256:'observed-native-descriptor-digest',http_status:'observed-http-status',telegram_response:'observed-original-structured-response'}};
 assert.throws(()=>Builder.prepare(s,{...binding,capture}),/CAPTURE|ASSIGNED|ROUTE/);
 const negativeBody='{"stage":"canonical-reject","envelope":{{observed-original-envelope}},"attempt_id":"{{observed-admit-attempt}}","receipt_id":"{{observed-reservation-receipt}}","capture":{"profile_id":"native-telegram-617-module8-v1","scenario_id":"6176241","module_id":8,"connection_id":10356915,"source_notification_id":"{{observed-native-source}}","attempt_id":"{{observed-admit-attempt}}","attempt_no":"{{observed-attempt-number}}","receipt_id":"{{observed-reservation-receipt}}","descriptor_sha256":"{{observed-native-descriptor-digest}}","http_status":"{{observed-http-status}}","telegram_response":{{observed-original-structured-response}}}}';
 s.modules.push({id:15,module:'http:MakeRequest',version:4,config:{mapper:{url:Builder.ENDPOINT,jsonStringBodyContent:negativeBody}}});
 s.modules.push({id:16,module:'http:MakeRequest',version:4,config:{mapper:{url:Builder.ENDPOINT,jsonStringBodyContent:'{"stage":"canonical-project-rejection","envelope":{{observed-original-envelope}},"attempt_id":"{{observed-admit-attempt}}"}'}}});
 capture.review_sha256=require('../server/make-owner-canonical').captureProfileDigest({id:capture.profile_id,scenario_id:'6176241',module_id:8,connection_id:10356915,schema_sha256:capture.schema_sha256,provider_route_sha256:capture.provider_route_sha256,field_mappings:capture.field_mappings});
 const forged={...capture,review_sha256:'f'.repeat(64)};assert.throws(()=>Builder.prepare(s,{...binding,capture:forged,reviewedCaptureSha256:forged.review_sha256}),/CAPTURE/);
 const compiled=Builder.prepare(s,{...binding,capture,reviewedCaptureSha256:capture.review_sha256});
 assert.equal(compiled.modules.find(m=>m.id===8).disabled,true);assert.deepEqual(compiled.modules.find(m=>m.id===8).errorHandler,s.modules.find(m=>m.id===8).errorHandler);
 assert.deepEqual(compiled.modules.filter(m=>[15,16].includes(m.id)),s.modules.filter(m=>[15,16].includes(m.id)));
 assert.equal(compiled.activation_allowed,false);
});
