'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
let Stage={};
try{Stage=require('../server/make-owner-canonical-real-acceptance-stage');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const Adapter=require('../server/make-owner-telegram-adapter');
const IDS=[5,6,8,9,10,26,31,27,28,11,13,30,25,12,29];
const OFF=[8,26,31,27,28,11,12,29,13,30,25];
const at=(s,id)=>s.modules.find(m=>m.id===id);
function digest(m){return crypto.createHash('sha256').update(JSON.stringify(['KK_OWNER_REAL_ACCEPTANCE_MANIFEST_V1',m.version,m.round_id,m.source_sha,m.environment,m.cutover_id,m.activated_at,m.not_before,m.slot_id,m.due_at,m.expires_at,m.attempt_budget.TELEGRAM_OWNER_ALERTS,m.attempt_budget.LINE_OWNER_ALERTS,m.provider_binding_sha256])).digest('hex');}
// Exact installed IDs, topology and nonsecret connection references. Rich unknown
// metadata verifies lossless preservation, rather than a replacement blueprint.
function fixture(){
 const adapter={kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-h5mj68',module_id:11,connection_id:11956776,bot_id:'8903740881',manifest_sha256:Adapter.MANIFEST_SHA256};
 const http=(id,edge,body,legacy=false)=>({id,module:'http:MakeRequest',version:4,...edge,...(legacy?{}:{disabled:true}),config:{parameters:legacy?{authenticationType:'noAuth'}:{authenticationType:'apiKeyConnection',apiKeyAccount:11963582},mapper:{url:Adapter.ENDPOINT,method:'post',timeout:legacy?15:30,contentType:'json',inputMethod:'jsonString',shareCookies:false,parseResponse:true,allowRedirects:false,stopOnHttpError:true,jsonStringBodyContent:body,requestCompressedContent:legacy}}});
 const modules=[{id:5,module:'scenario-service:StartSubscenario',version:2,root:'main',config:{}},
  http(6,{follows:5},'{"stage":"prepare","envelope":{{5.envelope}}}',true),
  {id:8,module:'telegram:SendReplyMessage',version:1,follows:6,disabled:true,config:{parameters:{__IMTCONN__:10356915},mapper:{text:'{{6.data.text}}',chatId:'{{6.data.target_chat_id}}'}},filter:{name:'Existing exact legacy filter',conditions:[[{a:'{{6.data.send_allowed}}',o:'boolean:equal',b:true}]]}},
  http(9,{follows:8},'{"stage":"ack","envelope":{{5.envelope}},"receipt_id":"{{6.data.receipt_id}}","provider_message_id":"{{8.message_id}}"}',true),
  {id:10,module:'scenario-service:ReturnData',version:2,follows:9,config:{mapper:{status:'{{9.data.status}}'}}},
  http(26,{root:'orphan'},'{"stage":"canonical-poll","version":"v2"}'),
  {id:31,module:'builtin:BasicFeeder',version:1,follows:26,disabled:true,config:{parameters:{},mapper:{array:'{{26.data.tickets}}'}}},
  http(27,{follows:31},'{"stage":"canonical-admit","version":"v2","ticket":"{{31.ticket}}"}'),
  http(28,{follows:27},'{"stage":"canonical-prepare","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}'),
  ...[11,13,12].map(id=>({id,module:'app#'+adapter.app_name+':'+(id===11?'sendCapturedMessage':'reportCapturedOutcome'),version:1,...(id===13?{parent:{moduleId:11,kind:'errorHandler'}}:{follows:id===11?28:11}),disabled:true,config:{parameters:{__IMTCONN__:11956776},mapper:{attempt_id:'{{27.data.attempt_id}}',receipt_id:'{{28.data.receipt_id}}',envelope_json:'{{27.data.envelope_json}}',...(id===11?{provider_binding_sha256:Adapter.bindingDigest(adapter)}:{outcome_frame:id===12?'{{11.outcome_frame}}':'{{11.error.message}}'})}}})),
  http(30,{follows:13},'{"stage":"canonical-project-rejection","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}'),
  {id:25,module:'builtin:Commit',version:1,follows:30,disabled:true,config:{parameters:{},mapper:{}}},
  http(29,{follows:12},'{"stage":"canonical-project","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}')];
 at({modules},11).filter={name:'Adapter reservation readiness and original deadline',conditions:[[{a:'{{28.data.adapter_ready}}',b:true,o:'boolean:equal'},{a:'{{28.data.receipt_id}}',o:'exist'},{a:'{{parseDate(27.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',b:'{{addSeconds(now; 15)}}',o:'date:greater'}]]};
 modules.sort((a,b)=>IDS.indexOf(a.id)-IDS.indexOf(b.id));
 for(const m of modules)m.metadata={designer:{x:m.id,y:50},preserve:{label:'unchanged '+m.id}};
 const snapshot={scenario_id:'6176241',active:false,incompleteExecutions:0,lastEdit:'2026-10-29T01:01:09.378Z',trigger:{moduleId:5,module:'scenario-service:StartSubscenario',kind:'on-demand',scheduling:{type:'on-demand'}},interface:{input:[{name:'envelope',type:'text',label:'Exact fresh signed owner-UAT envelope',required:true,multiline:true}],output:[{name:'status',type:'text'},{name:'provider_message_id',type:'text'},{name:'receipt_id',type:'text'},{name:'api_accepted_at',type:'text'}]},settings:{sequential:true,dlq:false,confidential:false,maxErrors:3,autoCommit:true,commitTriggerLast:false,unknownFuture:{keep:['all']}},modules};
 const manifest={version:'kk-owner-real-acceptance-round-v1',round_id:'22222222-2222-4222-8222-222222222222',source_sha:'a'.repeat(40),environment:'production',cutover_id:'11111111-1111-4111-8111-111111111111',activated_at:'2026-10-29T02:00:00.000Z',not_before:'2026-10-29T02:00:00.000Z',slot_id:'1',due_at:'2026-10-29T02:15:00.000Z',expires_at:'2026-10-29T02:17:00.000Z',attempt_budget:{TELEGRAM_OWNER_ALERTS:1,LINE_OWNER_ALERTS:1},provider_binding_sha256:Adapter.bindingDigest(adapter)};
 const binding={expectedLastEdit:snapshot.lastEdit,expectedSnapshotSha256:Stage.snapshotDigest?.(snapshot),manifest,manifest_sha256:digest(manifest),adapterBinding:adapter,gatewayConnection:{id:11963582,type:'account:http-v4-apikey',allowedUrl:Adapter.ENDPOINT}};
 return {snapshot,binding};
}
const compile=(s,b)=>Stage.prepareRealAcceptanceStage(s,b);
function rejects(mutate,pattern){const {snapshot,binding}=fixture();mutate(snapshot,binding);assert.throws(()=>compile(snapshot,binding),pattern);}

test('bounded real acceptance exposes a pure exact-snapshot compiler and CAS inverse',()=>{
 for(const name of ['prepareRealAcceptanceStage','snapshotDigest','applyStagePatch','prepareInversePatch'])assert.equal(typeof Stage[name],'function');
});
test('actual fifteen IDs retain all complete objects except explicit move, control and filters',()=>{
 const {snapshot,binding}=fixture(),before=structuredClone(snapshot),bindingBefore=structuredClone(binding),out=compile(snapshot,binding);
 assert.deepEqual(snapshot,before);assert.deepEqual(binding,bindingBefore);
 assert.deepEqual(out.before,before);assert.equal(out.after.modules.length,15);assert.deepEqual(out.after.modules.map(m=>m.id),IDS);
 assert.deepEqual(out.after.trigger,before.trigger);assert.deepEqual(out.after.settings,before.settings);assert.deepEqual(out.after.interface.output,before.interface.output);
 assert.equal(at(out.after,5).root,'main');assert.equal(at(out.after,6).root,'orphan');assert.equal(Object.hasOwn(at(out.after,6),'follows'),false);assert.equal(at(out.after,26).follows,5);assert.equal(Object.hasOwn(at(out.after,26),'root'),false);
 for(const id of [5,8,9,10,27,28,12,29,13,30,25])assert.deepEqual(at(out.after,id),at(before,id));
 for(const id of OFF)assert.equal(at(out.after,id).disabled,true);
 for(const id of IDS)assert.deepEqual(at(out.after,id).config.parameters,at(before,id).config.parameters);
 assert.equal(out.activation_allowed,false);assert.equal(out.send_allowed,false);assert.equal(out.runtime_verified,false);
 assert.equal(out.before_sha256,Stage.snapshotDigest(before));assert.equal(out.after_sha256,Stage.snapshotDigest(out.after));
});
test('temporary entry accepts only non-business round controls and poll passes exact gateway contract',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding);
 assert.deepEqual(out.after.interface.input,[{name:'round_id',type:'text',required:true},{name:'manifest_sha256',type:'text',required:true}]);
 const body=at(out.after,26).config.mapper.jsonStringBodyContent.replace('{{5.round_id}}',binding.manifest.round_id).replace('{{5.manifest_sha256}}',binding.manifest_sha256);
 assert.deepEqual(JSON.parse(body),{stage:'canonical-poll',version:'v2',acceptance_round:{round_id:binding.manifest.round_id,manifest_sha256:binding.manifest_sha256}});
 assert.doesNotMatch(body,/envelope|payload|UAT|dummy/i);
 const conditions=at(out.after,26).filter.conditions;
 assert.equal(conditions.length,1);assert.equal(conditions[0].length,2);
 assert.ok(conditions[0].some(c=>c.a==='{{5.round_id}}'&&c.b===binding.manifest.round_id&&c.o==='text:equal'));
});
test('ticket count equality gates before iterator; round pins and original TTL remain Make conditions',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding),iterator=at(out.after,31).filter.conditions;
 assert.equal(iterator.length,1);assert.ok(iterator[0].some(c=>c.a==='{{length(26.data.tickets)}}'&&c.o==='number:equal'&&String(c.b)==='1'));
 for(const count of [0,1,2])assert.equal(iterator[0].filter(c=>c.o==='number:equal').every(c=>Number(count)===Number(c.b)),count===1);
 const f=at(out.after,11).filter.conditions;
 assert.equal(f.length,1);
 for(const original of at(snapshot,11).filter.conditions[0])assert.ok(f[0].some(c=>assertionEqual(c,original)));
 assert.ok(f[0].some(c=>c.a==='{{parseDate(27.data.acceptance_round.deadline; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}'&&c.o==='date:greater'&&c.b==='{{now}}'));
 assert.ok(f[0].some(c=>c.a==='{{27.data.acceptance_round.deadline}}'&&c.o==='text:equal'&&c.b===binding.manifest.expires_at));
});
function assertionEqual(a,b){try{assert.deepEqual(a,b);return true;}catch{return false;}}
test('forward and newly bound inverse restore the complete normalized snapshot exactly',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding),forward=Stage.applyStagePatch(snapshot,out.patch);
 assert.deepEqual(forward,out.after);
 const fresh=structuredClone(forward);fresh.lastEdit='2026-10-29T03:00:00.000Z';
 const inverse=Stage.prepareInversePatch(out,fresh,fresh.lastEdit),restored=Stage.applyStagePatch(fresh,inverse);
 assert.deepEqual(restored,{...snapshot,lastEdit:fresh.lastEdit});
 assert.deepEqual(inverse.restore_snapshot,snapshot);
 assert.equal(inverse.expectedLastEdit,fresh.lastEdit);assert.equal(inverse.expectedSnapshotSha256,Stage.snapshotDigest(fresh));
 assert.deepEqual(inverse.interface,snapshot.interface);assert.ok(inverse.operations.some(o=>o.op==='module_move'&&o.moduleId===26&&o.root==='orphan'));
});
test('snapshot CAS catches drift in any untouched config, setting, credential, interface and metadata',()=>{
 for(const mutate of [s=>s.lastEdit='2026-10-29T04:00:00.000Z',s=>s.settings.maxErrors=2,s=>s.settings.unknownFuture.keep.push('drift'),s=>s.interface.output.pop(),s=>at(s,9).config.mapper.timeout=99,s=>at(s,11).config.parameters.__IMTCONN__=22,s=>at(s,26).config.parameters.apiKeyAccount=22,s=>at(s,5).metadata.designer.x=100])rejects(mutate);
});
test('reviewed fingerprint cannot waive unsafe topology, disabled, module ID or capability corruption',()=>{
 for(const mutate of [s=>s.active=true,s=>s.incompleteExecutions=1,s=>s.settings.sequential=false,s=>s.settings.dlq=true,s=>s.schedule={type:'indefinitely',interval:900},s=>s.modules.pop(),s=>s.modules.push({...at(s,5),id:999}),s=>at(s,31).id=32,s=>at(s,12).id=13,s=>at(s,26).follows=5,s=>at(s,27).module='http:Unknown',s=>at(s,28).version=99,s=>at(s,13).parent={moduleId:8,kind:'errorHandler'},s=>at(s,8).disabled=false,s=>at(s,11).disabled=false,s=>at(s,28).config.parameters.authenticationType='noAuth',s=>at(s,26).config.mapper.allowRedirects=true,s=>at(s,31).filter={name:'Unexpected',conditions:[]},s=>at(s,25).routes=[],s=>at(s,28).issues=[{severity:'error',message:'missing binding'}]])rejects((s,b)=>{mutate(s);b.expectedSnapshotSha256=Stage.snapshotDigest(s);});
});
test('missing configs and unsafe or conflicting bindings reject even under freshly reviewed hash',()=>{
 for(const id of IDS)rejects((s,b)=>{delete at(s,id).config;b.expectedSnapshotSha256=Stage.snapshotDigest(s);});
 for(const mutate of [(s,b)=>b.gatewayConnection.id=11956776,(s,b)=>b.gatewayConnection.allowedUrl+='/',(s,b)=>b.gatewayConnection.token='do-not-serialize',(s,b)=>b.adapterBinding.connection_id=555,(s,b)=>b.adapterBinding.module_id=12,(s,b)=>b.manifest.provider_binding_sha256='b'.repeat(64)])rejects(mutate);
});
test('manifest exact keys, reviewed digest, timing and budget cannot be widened',()=>{
 for(const mutate of [m=>m.extra=true,m=>m.environment='preview',m=>m.source_sha='A'.repeat(40),m=>m.round_id='not-uuid',m=>m.slot_id=1,m=>m.due_at='2026-10-29T02:15:01.000Z',m=>m.not_before='2026-10-29T01:59:59.000Z',m=>m.expires_at='2026-10-29T02:18:00.000Z',m=>m.attempt_budget.LINE_OWNER_ALERTS=2])rejects((s,b)=>{mutate(b.manifest);b.manifest_sha256=digest(b.manifest);});
 rejects((s,b)=>b.manifest_sha256='b'.repeat(64));rejects((s,b)=>delete b.expectedSnapshotSha256);rejects((s,b)=>delete b.expectedLastEdit);
});
test('forward and inverse patch refuse stale readback and mutation of planned operations',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding),stale=structuredClone(snapshot);stale.settings.autoCommit=false;
 assert.throws(()=>Stage.applyStagePatch(stale,out.patch));
 const bad=structuredClone(out.patch);bad.operations.push({op:'module_disabled_set',moduleId:11,disabled:false});assert.throws(()=>Stage.applyStagePatch(snapshot,bad));
 const after=structuredClone(out.after);after.lastEdit='2026-10-29T03:00:00.000Z';at(after,12).config.mapper.outcome_frame='drift';assert.throws(()=>Stage.prepareInversePatch(out,after,after.lastEdit));
 assert.throws(()=>Stage.prepareInversePatch(out,out.after,'2026-10-29T03:00:00.000Z'));
});
test('normalized object order does not cause false drift and result mutation never changes inputs',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding),reordered=Object.fromEntries(Object.entries(snapshot).reverse());
 assert.equal(Stage.snapshotDigest(reordered),Stage.snapshotDigest(snapshot));
 out.after.settings.unknownFuture.keep.push('edited');out.before.modules[0].metadata.preserve.label='edited';
 assert.deepEqual(snapshot.settings.unknownFuture.keep,['all']);assert.equal(snapshot.modules[0].metadata.preserve.label,'unchanged 5');
});
test('every changed field is enumerated individually and all eleven OFF flags are reasserted in both CAS directions',()=>{
 const {snapshot,binding}=fixture(),out=compile(snapshot,binding);
 assert.ok(out.allowed_changes.some(c=>c.path.join('.')==='modules.1.follows'&&c.before===5&&c.after_present===false));
 assert.ok(out.allowed_changes.some(c=>c.path.join('.')==='modules.5.config.mapper.jsonStringBodyContent'));
 assert.equal(out.allowed_changes.some(c=>c.path.length===1&&c.path[0]==='modules'),false);
 for(const operations of [out.patch.operations,out.inverse_template.operations])for(const id of OFF)assert.ok(operations.some(o=>o.op==='module_disabled_set'&&o.moduleId===id&&o.disabled===true));
 assert.equal(out.patch.connector_ready,false);assert.ok(out.patch.capability_gates.includes('SCENARIO_INTERFACE_OPCODE_NOT_VERIFIED'));
 assert.equal(out.patch.interface_update.connector_opcode_verified,false);
});
function rawFixture(){const {snapshot}=fixture();return {observedAt:'2026-10-29T01:01:57.968Z',structure:{scenario:{id:6176241,status:'inactive',isLockedForEditing:false,isWaitingOnIncompleteExecutions:false,incompleteExecutions:0,lastEdit:snapshot.lastEdit},trigger:snapshot.trigger,interface:snapshot.interface,modules:snapshot.modules.map(({config,...m})=>m)},configs:{modules:snapshot.modules.map(({id,module,version,config})=>({id,module,version,config}))}};}
test('strict actual-readback normalization records derived warnings separately without inventing any config or settings',()=>{
 const raw=rawFixture(),settings=fixture().snapshot.settings,before=structuredClone(raw),warning={severity:'warning',message:'Derived orphan warning'};
 raw.structure.modules.find(m=>m.id===26).issues=[warning];before.structure.modules.find(m=>m.id===26).issues=[warning];
 const out=Stage.normalizeInstalledSnapshot(raw,settings);
 assert.deepEqual(raw,before);assert.deepEqual(out.snapshot,fixture().snapshot);
 assert.deepEqual(out.normalization.derived_issues,[{moduleId:26,issues:[warning]}]);
 assert.deepEqual(out.normalization.omitted_fields,['modules[].issues']);assert.deepEqual(out.snapshot.settings,settings);
 const {binding}=fixture();binding.expectedSnapshotSha256=Stage.snapshotDigest(out.snapshot);const stage=compile(out.snapshot,binding);
 const afterRaw=rawFixture();afterRaw.structure.modules=stage.after.modules.map(({config,...m})=>m);afterRaw.configs.modules=stage.after.modules.map(({id,module,version,config})=>({id,module,version,config}));afterRaw.structure.interface=stage.after.interface;afterRaw.structure.scenario.lastEdit='2026-10-29T03:00:00.000Z';afterRaw.structure.modules.find(m=>m.id===6).issues=[{severity:'warning',message:'New derived orphan warning'}];
 const normalizedAfter=Stage.normalizeInstalledSnapshot(afterRaw,settings).snapshot;
 assert.deepEqual(Stage.applyStagePatch(normalizedAfter,Stage.prepareInversePatch(stage,normalizedAfter,normalizedAfter.lastEdit)),{...out.snapshot,lastEdit:normalizedAfter.lastEdit});
});
test('normalizer refuses partial configs, wrong identity, locks, any errors and unknown severities',()=>{
 for(const mutate of [r=>r.structure.scenario.status='active',r=>r.structure.scenario.isLockedForEditing=true,r=>r.structure.scenario.isWaitingOnIncompleteExecutions=true,r=>delete r.structure.scenario.incompleteExecutions,r=>r.structure.scenario.incompleteExecutions=1,r=>r.structure.scenario.id=99,r=>r.configs.modules.pop(),r=>r.configs.modules.push(r.configs.modules[0]),r=>r.configs.modules[0].version=99,r=>r.configs.modules[0].config=null,r=>r.configs.modulesTooLarge=[5],r=>r.configs.modulesOmitted=[5],r=>r.configs.notFound=[5],r=>r.configs.errors=[{message:'unavailable'}],r=>r.structure.modules[0].issues=[{severity:'error',message:'bad module'}],r=>r.structure.modules[0].issues=[{severity:'info',message:'unknown'}],r=>r.structure.modules[0].issues={},r=>r.structure.errors=[{message:'invalid graph'}]]){
  const raw=rawFixture();mutate(raw);assert.throws(()=>Stage.normalizeInstalledSnapshot(raw,fixture().snapshot.settings));
 }
 for(const settings of [undefined,null,{},[],{sequential:true,dlq:false}])assert.throws(()=>Stage.normalizeInstalledSnapshot(rawFixture(),settings));
});


test('historical Oct29 final actual fifteen-module readback compiles offline and rejects an injected engine error',()=>{
 const historical={"observedAt":"2026-10-29T01:01:57.968Z","structure":{"scenario":{"id":6176241,"name":"03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT","description":"HOLD22Oct: same617 consumer; signed Prepare -> Telegram -> durable ACK; KK Agent exact Sheet projection. Legacy row writers removed. Sender disabled pending bindings/provider join. No queue replay or canonical/POLL900 activation.","teamId":2671496,"status":"inactive","isLockedForEditing":false,"isWaitingOnIncompleteExecutions":false,"incompleteExecutions":0,"lastEdit":"2026-10-29T01:01:09.378Z"},"trigger":{"moduleId":5,"module":"scenario-service:StartSubscenario","kind":"on-demand","scheduling":{"type":"on-demand"}},"modules":[{"id":5,"module":"scenario-service:StartSubscenario","version":2,"root":"main"},{"id":6,"module":"http:MakeRequest","version":4,"follows":5},{"id":8,"module":"telegram:SendReplyMessage","version":1,"follows":6,"disabled":true,"filter":{"name":"Exact durable Prepare and signed TTL margin","conditions":[[{"a":"{{6.statusCode}}","b":"200","o":"number:equal"},{"a":"{{6.data.send_allowed}}","b":"true","o":"boolean:equal"},{"a":"{{6.data.receipt_id}}","o":"exist"},{"a":"{{parseDate(6.data.expires_at; \"YYYY-MM-DDTHH:mm:ss.SSSZ\")}}","b":"{{addSeconds(now; 15)}}","o":"date:greater"}]]}},{"id":9,"module":"http:MakeRequest","version":4,"follows":8,"filter":{"name":"Actual Telegram message ID required","conditions":[[{"a":"{{8.message_id}}","o":"exist"}]]}},{"id":10,"module":"scenario-service:ReturnData","version":2,"follows":9,"filter":{"name":"Durable exact ACK confirmed","conditions":[[{"a":"{{9.statusCode}}","b":"200","o":"number:equal"},{"a":"{{9.data.ok}}","b":"true","o":"boolean:equal"},{"a":"{{9.data.status}}","b":"SENT","o":"text:equal"},{"a":"{{9.data.provider_message_id}}","b":"{{toString(8.message_id)}}","o":"text:equal"}]]}},{"id":26,"module":"http:MakeRequest","version":4,"root":"orphan","disabled":true,"issues":[{"severity":"warning","message":"This module is not connected to the flow. This module and everything after it will be skipped during execution. <autoconnect>Link it to your scenario to include them.</autoconnect>"}]},{"id":31,"module":"builtin:BasicFeeder","version":1,"follows":26,"disabled":true},{"id":27,"module":"http:MakeRequest","version":4,"follows":31,"disabled":true},{"id":28,"module":"http:MakeRequest","version":4,"follows":27,"disabled":true},{"id":11,"module":"app#kk-telegram-response-adapter-h5mj68:sendCapturedMessage","version":1,"follows":28,"disabled":true,"filter":{"name":"Adapter reservation readiness and original deadline","conditions":[[{"a":"{{28.data.adapter_ready}}","b":true,"o":"boolean:equal"},{"a":"{{28.data.receipt_id}}","o":"exist"},{"a":"{{parseDate(27.data.envelope.expires_at; \"YYYY-MM-DDTHH:mm:ss.SSSZ\")}}","b":"{{addSeconds(now; 15)}}","o":"date:greater"}]]}},{"id":13,"module":"app#kk-telegram-response-adapter-h5mj68:reportCapturedOutcome","version":1,"parent":{"moduleId":11,"kind":"errorHandler"},"disabled":true},{"id":30,"module":"http:MakeRequest","version":4,"follows":13,"disabled":true},{"id":25,"module":"builtin:Commit","version":1,"follows":30,"disabled":true},{"id":12,"module":"app#kk-telegram-response-adapter-h5mj68:reportCapturedOutcome","version":1,"follows":11,"disabled":true},{"id":29,"module":"http:MakeRequest","version":4,"follows":12,"disabled":true}],"interface":{"input":[{"name":"envelope","type":"text","label":"Exact fresh signed owner-UAT envelope","required":true,"multiline":true}],"output":[{"name":"status","type":"text"},{"name":"provider_message_id","type":"text"},{"name":"receipt_id","type":"text"},{"name":"api_accepted_at","type":"text"}]},"connections":[{"id":10356915,"label":"สิทธิโชค's Telegram Bot connection","app":"telegram","usedByModules":[8],"status":"ok"},{"id":11956776,"label":"KK617 Telegram adapter OFF","app":"app#kk-telegram-response-adapter-h5mj68","usedByModules":[11,13,12],"status":"ok"}]},"configs":{"modules":[{"id":5,"module":"scenario-service:StartSubscenario","version":2,"config":{}},{"id":6,"module":"http:MakeRequest","version":4,"config":{"parameters":{"authenticationType":"noAuth"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":15,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"prepare\",\"envelope\":{{5.envelope}}}","requestCompressedContent":true}}},{"id":8,"module":"telegram:SendReplyMessage","version":1,"config":{"parameters":{"__IMTCONN__":10356915},"mapper":{"text":"{{6.data.text}}","chatId":"{{6.data.target_chat_id}}","parseMode":"","disableNotification":true,"disableWebPagePreview":true,"replyMarkupAssembleType":""}}},{"id":9,"module":"http:MakeRequest","version":4,"config":{"parameters":{"authenticationType":"noAuth"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":15,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"ack\",\"envelope\":{{5.envelope}},\"receipt_id\":\"{{6.data.receipt_id}}\",\"provider_message_id\":\"{{8.message_id}}\"}","requestCompressedContent":true}}},{"id":10,"module":"scenario-service:ReturnData","version":2,"config":{"mapper":{"status":"{{9.data.status}}","receipt_id":"{{9.data.receipt_id}}","api_accepted_at":"{{9.data.api_accepted_at}}","provider_message_id":"{{9.data.provider_message_id}}"}}},{"id":11,"module":"app#kk-telegram-response-adapter-h5mj68:sendCapturedMessage","version":1,"config":{"parameters":{"__IMTCONN__":11956776},"mapper":{"attempt_id":"{{27.data.attempt_id}}","receipt_id":"{{28.data.receipt_id}}","envelope_json":"{{27.data.envelope_json}}","provider_binding_sha256":"e1551c6ede569408cb69e99a039dd91a2456b457ada4464a0a9f85b398c2d4dc"}}},{"id":12,"module":"app#kk-telegram-response-adapter-h5mj68:reportCapturedOutcome","version":1,"config":{"parameters":{"__IMTCONN__":11956776},"mapper":{"attempt_id":"{{27.data.attempt_id}}","receipt_id":"{{28.data.receipt_id}}","envelope_json":"{{27.data.envelope_json}}","outcome_frame":"{{11.outcome_frame}}"}}},{"id":13,"module":"app#kk-telegram-response-adapter-h5mj68:reportCapturedOutcome","version":1,"config":{"parameters":{"__IMTCONN__":11956776},"mapper":{"attempt_id":"{{27.data.attempt_id}}","receipt_id":"{{28.data.receipt_id}}","envelope_json":"{{27.data.envelope_json}}","outcome_frame":"{{11.error.message}}"}}},{"id":25,"module":"builtin:Commit","version":1,"config":{"parameters":{},"mapper":{}}},{"id":26,"module":"http:MakeRequest","version":4,"config":{"parameters":{"apiKeyAccount":11963582,"authenticationType":"apiKeyConnection"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":30,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"canonical-poll\",\"version\":\"v2\"}","requestCompressedContent":false}}},{"id":27,"module":"http:MakeRequest","version":4,"config":{"parameters":{"apiKeyAccount":11963582,"authenticationType":"apiKeyConnection"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":30,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"canonical-admit\",\"version\":\"v2\",\"ticket\":\"{{31.ticket}}\"}","requestCompressedContent":false}}},{"id":28,"module":"http:MakeRequest","version":4,"config":{"parameters":{"apiKeyAccount":11963582,"authenticationType":"apiKeyConnection"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":30,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"canonical-prepare\",\"attempt_id\":\"{{27.data.attempt_id}}\",\"envelope\":{{27.data.envelope_json}}}","requestCompressedContent":false}}},{"id":29,"module":"http:MakeRequest","version":4,"config":{"parameters":{"apiKeyAccount":11963582,"authenticationType":"apiKeyConnection"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":30,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"canonical-project\",\"attempt_id\":\"{{27.data.attempt_id}}\",\"envelope\":{{27.data.envelope_json}}}","requestCompressedContent":false}}},{"id":30,"module":"http:MakeRequest","version":4,"config":{"parameters":{"apiKeyAccount":11963582,"authenticationType":"apiKeyConnection"},"mapper":{"url":"https://kk-phone-rental.vercel.app/api/kk-make-owner-notify","method":"post","timeout":30,"contentType":"json","inputMethod":"jsonString","shareCookies":false,"parseResponse":true,"allowRedirects":false,"stopOnHttpError":true,"jsonStringBodyContent":"{\"stage\":\"canonical-project-rejection\",\"attempt_id\":\"{{27.data.attempt_id}}\",\"envelope\":{{27.data.envelope_json}}}","requestCompressedContent":false}}},{"id":31,"module":"builtin:BasicFeeder","version":1,"config":{"parameters":{},"mapper":{"array":"{{26.data.tickets}}"}}}]}};
 const settings={"sequential":true,"dlq":false,"confidential":false,"maxErrors":3,"autoCommit":true,"commitTriggerLast":false};
 const {snapshot,normalization}=Stage.normalizeInstalledSnapshot(historical,settings);
 const {binding}=fixture();binding.expectedLastEdit=snapshot.lastEdit;binding.expectedSnapshotSha256=Stage.snapshotDigest(snapshot);
 const out=compile(snapshot,binding);assert.equal(out.after.modules.length,15);assert.equal(normalization.derived_issues[0].moduleId,26);
 assert.deepEqual(Stage.applyStagePatch(snapshot,out.patch),out.after);
 const current=structuredClone(out.after);current.lastEdit='2026-10-29T03:00:00.000Z';
 assert.deepEqual(Stage.applyStagePatch(current,Stage.prepareInversePatch(out,current,current.lastEdit)),{...snapshot,lastEdit:current.lastEdit});
 historical.structure.modules.find(m=>m.id===26).issues=[{severity:'error',message:'Unresolved engine error'}];
 assert.throws(()=>Stage.normalizeInstalledSnapshot(historical,settings));
});
