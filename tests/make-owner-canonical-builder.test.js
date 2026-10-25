'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Builder=require('../server/make-owner-canonical-builder');
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
