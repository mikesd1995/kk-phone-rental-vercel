'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
let Off={};
try{Off=require('../server/make-owner-canonical-off-stage');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}

test('independent OFF stage exposes a pure compiler separate from future cutover',()=>{
 assert.equal(typeof Off.prepareAdapterOff,'function');
});

const Adapter=require('../server/make-owner-telegram-adapter');
// IDs and bot identity below are synthetic unit-test data, never installer defaults.
function fixture(){
 const ids={poll:101,iterator:102,admit:103,prepare:104,provider:111,report:112,reject:113,project:114,projectReject:115,commit:116};
 const adapter={kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-test',module_id:111,connection_id:222222,bot_id:'123456',manifest_sha256:Adapter.MANIFEST_SHA256};
 const http=(id,follows,stage)=>({id,module:'http:MakeRequest',version:4,follows,config:{parameters:{authenticationType:'apiKeyConnection',apiKeyAccount:333333},mapper:{url:Adapter.ENDPOINT,method:'post',headers:[{name:'X-Audit-Context',value:'sanitized-test'}],jsonStringBodyContent:JSON.stringify({stage,envelope:'{{5.envelope}}'}),parseResponse:true}},metadata:{designer:{x:id*20,y:100}}});
 const legacy=[
  {id:5,module:'scenario-service:StartSubscenario',version:2,root:'main',config:{parameters:{},mapper:{}},metadata:{designer:{x:0,y:0},label:'Existing legacy entry'}},
  {...http(6,5,'prepare'),filter:{name:'Legacy channel',conditions:[[{a:'{{5.envelope}}',o:'exist'}]]}},
  {id:8,module:'telegram:SendReplyMessage',version:1,follows:6,disabled:true,config:{parameters:{__IMTCONN__:10356915},mapper:{chatId:'{{6.data.target_chat_id}}',text:'{{6.data.text}}',parseMode:'',replyMarkup:''}},filter:{name:'Legacy receipt guard',conditions:[[{a:'{{6.data.send_allowed}}',o:'boolean:equal',b:true}]]},metadata:{designer:{x:160,y:50}}},
  http(9,8,'ack'),
  {id:10,module:'scenario-service:ReturnData',version:2,follows:9,config:{parameters:{},mapper:{status:'{{9.data.status}}',receipt_id:'{{6.data.receipt_id}}'}}},
 ];
 const canonical=Object.entries(ids).map(([role,id])=>{
  const module=['provider','report','reject'].includes(role)?'app#'+adapter.app_name+':'+(role==='provider'?'sendCapturedMessage':'reportCapturedOutcome'):role==='iterator'?'builtin:BasicFeeder':role==='commit'?'builtin:Commit':'http:MakeRequest';
  return {id,module,version:['iterator','commit','provider','report','reject'].includes(role)?1:4,root:'orphan',disabled:true,config:{parameters:['provider','report','reject'].includes(role)?{__IMTCONN__:adapter.connection_id}:{},mapper:{}},metadata:{designer:{x:id,y:200}}};
 });
 const snapshot={scenario_id:'6176241',active:false,incompleteExecutions:0,lastEdit:'2026-10-27T00:01:02.003Z',
  trigger:{moduleId:5,module:'scenario-service:StartSubscenario',kind:'on-demand',scheduling:{type:'on-demand'}},
  interface:{input:[{name:'envelope',type:'text',required:true}],output:[{name:'status',type:'text'},{name:'receipt_id',type:'text'}]},
  settings:{sequential:true,dlq:false,autoCommit:true,unknownFutureSetting:{preserved:['exactly']}},modules:[...legacy,...canonical]};
 const binding={expectedLastEdit:snapshot.lastEdit,assignedIds:ids,adapterBinding:adapter,gatewayConnection:{id:333333,type:'account:http-v4-apikey',allowedUrl:Adapter.ENDPOINT}};
 return {snapshot,binding,ids};
}
function compile(snapshot,binding){return Off.prepareAdapterOff(snapshot,binding);}
function at(snapshot,id){return snapshot.modules.find(m=>m.id===id);}
function rejected(mutate,pattern){const {snapshot,binding,ids}=fixture();mutate(snapshot,binding,ids);assert.throws(()=>compile(snapshot,binding),pattern);}

test('OFF compilation deep-clones the complete rich legacy path and exact observed scenario contract',()=>{
 const {snapshot,binding}=fixture(),before=structuredClone(snapshot),beforeBinding=structuredClone(binding);
 const out=compile(snapshot,binding);
 assert.deepEqual(snapshot,before);assert.deepEqual(binding,beforeBinding);
 for(const id of [5,6,8,9,10]){assert.deepEqual(at(out,id),at(before,id));assert.notEqual(at(out,id),at(snapshot,id));}
 assert.deepEqual(out.trigger,before.trigger);assert.deepEqual(out.interface,before.interface);assert.deepEqual(out.settings,before.settings);
 assert.notEqual(out.settings,snapshot.settings);assert.notEqual(out.interface,snapshot.interface);assert.notEqual(out.trigger,snapshot.trigger);
 assert.equal(Object.hasOwn(out,'schedule'),false);assert.equal(Object.hasOwn(out,'input'),false);assert.equal(Object.hasOwn(out,'output'),false);
 assert.deepEqual(out.removeModuleIds,[]);assert.equal(out.modules.length,15);assert.equal(out.active,false);assert.equal(out.activation_allowed,false);assert.equal(out.send_allowed,false);
 assert.equal(out.staging_status,'SOURCE_ONLY_OFF_GRAPH_NOT_RUNTIME_VERIFIED');
 for(const gate of ['RELEASE','NATIVE','GAS','HTTP_ENGINE','PROVIDER','ACK','SHEET'])assert.ok(out.unresolved_gates.includes(gate));
 // Mutating the result must not mutate either input, including binding metadata.
 at(out,6).config.mapper.headers[0].value='changed';out.interface.input[0].name='changed';out.adapter_binding.app_name='changed';
 assert.deepEqual(snapshot,before);assert.deepEqual(binding,beforeBinding);
});

test('optional normalized schedule preserves exact agreement and refuses drift',()=>{
 const {snapshot,binding}=fixture();snapshot.schedule={type:'on-demand'};
 const out=compile(snapshot,binding);assert.deepEqual(out.schedule,snapshot.schedule);assert.notEqual(out.schedule,snapshot.schedule);
 rejected(s=>s.schedule={type:'indefinitely',interval:900});
 rejected(s=>s.schedule={type:'on-demand',interval:900});
});

test('all ten canonical modules remain disabled in a separate orphan component with exact positive and error edges',()=>{
 const {snapshot,binding,ids}=fixture(),out=compile(snapshot,binding);
 for(const id of Object.values(ids))assert.equal(at(out,id).disabled,true);
 assert.equal(at(out,ids.poll).root,'orphan');assert.equal(Object.hasOwn(at(out,ids.poll),'follows'),false);
 for(const [role,previous]of [['iterator','poll'],['admit','iterator'],['prepare','admit'],['provider','prepare'],['report','provider'],['project','report'],['projectReject','reject'],['commit','projectReject']]){
  assert.equal(at(out,ids[role]).follows,ids[previous]);assert.equal(Object.hasOwn(at(out,ids[role]),'root'),false);
 }
 assert.deepEqual(at(out,ids.reject).parent,{moduleId:ids.provider,kind:'errorHandler'});
 assert.equal(Object.hasOwn(at(out,ids.reject),'root'),false);assert.equal(Object.hasOwn(at(out,ids.reject),'follows'),false);
 const reachable=new Set([5]);let grew=true;while(grew){grew=false;for(const m of out.modules)if((reachable.has(m.follows)||reachable.has(m.parent?.moduleId))&&!reachable.has(m.id)){reachable.add(m.id);grew=true;}}
 assert.deepEqual([...reachable].sort((a,b)=>a-b),[5,6,8,9,10]);
 assert.doesNotMatch(JSON.stringify(out.modules.filter(m=>Object.values(ids).includes(m.id))),/builtin:(?:Break|Resume)|sleep|retry/i);
});

test('canonical receipts use the assigned prepare and JSON-safe adapter envelopes retain the unchanged raw binding digest',()=>{
 const {snapshot,binding,ids}=fixture(),out=compile(snapshot,binding),provider=at(out,ids.provider),report=at(out,ids.report),reject=at(out,ids.reject);
 const canonicalText=JSON.stringify(out.modules.filter(m=>Object.values(ids).includes(m.id)));
 assert.doesNotMatch(canonicalText,/\{\{6\.|\{\{5\.|botToken|consumerBearer|Authorization/);
 assert.equal(provider.config.mapper.receipt_id,'{{104.data.receipt_id}}');assert.equal(report.config.mapper.receipt_id,'{{104.data.receipt_id}}');assert.equal(reject.config.mapper.receipt_id,'{{104.data.receipt_id}}');
 assert.equal(provider.config.mapper.envelope_json,'{{103.data.envelope_json}}');
 assert.equal(provider.config.mapper.provider_binding_sha256,Adapter.bindingDigest(binding.adapterBinding));
 assert.deepEqual(out.adapter_binding,binding.adapterBinding);assert.equal(out.adapter_manifest_sha256,Adapter.MANIFEST_SHA256);
 assert.equal(report.config.mapper.outcome_frame,'{{111.outcome_frame}}');assert.equal(reject.config.mapper.outcome_frame,'{{111.error.message}}');
 assert.deepEqual(provider.filter.conditions,[[
  {a:'{{104.data.adapter_ready}}',o:'boolean:equal',b:true},{a:'{{104.data.receipt_id}}',o:'exist'},
  {a:'{{parseDate(103.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',o:'date:greater',b:'{{addSeconds(now; 15)}}'},
 ]]);
 for(const role of ['poll','admit','prepare','project','projectReject']){
  const m=at(out,ids[role]);assert.deepEqual(m.config.parameters,{authenticationType:'apiKeyConnection',apiKeyAccount:333333});
  assert.equal(m.config.mapper.url,Adapter.ENDPOINT);assert.equal(m.config.mapper.method,'post');assert.equal(m.config.mapper.inputMethod,'jsonString');
  assert.equal(m.config.mapper.allowRedirects,false);assert.equal(Object.hasOwn(m.config.mapper,'headers'),false);
 }
 const originalEnvelope={text:'quote " and \\ and ไทย',expires_at:'2026-10-27T00:03:00.000Z'};
 const prepareBody=at(out,ids.prepare).config.mapper.jsonStringBodyContent.replace('{{103.data.attempt_id}}','attempt-fixture').replace('{{103.data.envelope_json}}',JSON.stringify(originalEnvelope));
 assert.deepEqual(JSON.parse(prepareBody),{stage:'canonical-prepare',attempt_id:'attempt-fixture',envelope:originalEnvelope});
 assert.match(at(out,ids.projectReject).config.mapper.jsonStringBodyContent,/canonical-project-rejection/);
});

test('freshness and full explicit scenario metadata fail closed',()=>{
 for(const mutate of [s=>s.scenario_id=6176241,s=>s.active=true,s=>delete s.active,s=>s.incompleteExecutions=1,s=>delete s.incompleteExecutions,s=>s.lastEdit='',s=>s.lastEdit='not-a-date',s=>s.lastEdit='2026-10-27T00:02:00.000Z',
  s=>delete s.trigger,s=>s.trigger.kind='scheduled',s=>s.trigger.moduleId=101,s=>s.trigger.module='http:MakeRequest',s=>s.trigger.scheduling={type:'on-demand',interval:900},s=>s.trigger.extra=true,
  s=>delete s.interface,s=>delete s.interface.input,s=>delete s.interface.output,s=>s.interface.input={},s=>delete s.settings,s=>delete s.settings.sequential,s=>delete s.settings.dlq,s=>s.settings.sequential=false,s=>s.settings.dlq=true])rejected(mutate);
});

test('exact role cardinality, safe IDs and full module membership are mandatory',()=>{
 for(const mutate of [(s,b)=>delete b.assignedIds.prepare,(s,b)=>b.assignedIds.extra=999,(s,b)=>b.assignedIds.prepare=6,(s,b)=>b.assignedIds.prepare=9,(s,b)=>b.assignedIds.prepare=b.assignedIds.admit,
  (s,b)=>b.assignedIds.prepare=Number.MAX_SAFE_INTEGER+1,(s,b)=>b.assignedIds.prepare='104',(s,b)=>b.assignedIds.prepare=0,(s,b)=>b.assignedIds.provider=104,
  s=>s.modules.pop(),s=>s.modules.push({id:999,module:'http:MakeRequest',version:4}),s=>s.modules[14].id=5])rejected(mutate);
 for(const role of Object.keys(fixture().ids)){
  rejected((s,b,ids)=>at(s,ids[role]).module='unreviewed:Module');
  rejected((s,b,ids)=>at(s,ids[role]).version=999);
  rejected((s,b,ids)=>at(s,ids[role]).disabled=false);
  rejected((s,b,ids)=>delete at(s,ids[role]).disabled);
 }
});

test('canonical helpers must be explicit disabled orphans without injected routing',()=>{
 for(const role of Object.keys(fixture().ids)){
  for(const edge of ['follows','parent','onError','errorHandler','routes'])rejected((s,b,ids)=>at(s,ids[role])[edge]=edge==='follows'?5:{});
  rejected((s,b,ids)=>at(s,ids[role]).root='main');
  rejected((s,b,ids)=>delete at(s,ids[role]).root);
 }
});

test('legacy topology and native provider identity reject drift before cloning',()=>{
 for(const id of [5,6,8,9,10]){
  rejected(s=>at(s,id).module='unreviewed:Module');rejected(s=>at(s,id).version=999);
  for(const edge of ['parent','onError','errorHandler','routes'])rejected(s=>at(s,id)[edge]={});
 }
 rejected(s=>at(s,5).root='orphan');rejected(s=>at(s,5).follows=101);
 for(const id of [6,8,9,10]){rejected(s=>at(s,id).follows=101);rejected(s=>at(s,id).root='orphan');}
 rejected(s=>at(s,8).disabled=false);rejected(s=>delete at(s,8).disabled);rejected(s=>at(s,8).config.parameters.__IMTCONN__=222222);
});

test('secure HTTP metadata is required, exact and distinct from native and adapter connections',()=>{
 for(const mutate of [(s,b)=>delete b.gatewayConnection,(s,b)=>delete b.gatewayConnection.type,(s,b)=>b.gatewayConnection.type='account:http-v4-noauth',(s,b)=>b.gatewayConnection.type='account:http-v3-apikey',
  (s,b)=>b.gatewayConnection.allowedUrl='https://attacker.invalid',(s,b)=>b.gatewayConnection.allowedUrl=Adapter.ENDPOINT+'/',(s,b)=>b.gatewayConnection.id=222222,(s,b)=>b.gatewayConnection.id=10356915,(s,b)=>b.gatewayConnection.id='333333',
  (s,b)=>b.gatewayConnection.id=0,(s,b)=>b.gatewayConnection.id=Number.MAX_SAFE_INTEGER+1,(s,b)=>b.gatewayConnection.token='must-not-be-serialized',
  (s,b)=>b.gatewayConnectionId=987654,(s,b)=>b.connectionAllowedUrl='https://attacker.invalid'])rejected(mutate,/MAKE_CANONICAL_CONNECTION_UNBOUND/);
 const {snapshot,binding}=fixture();binding.gatewayConnectionId=333333;binding.connectionAllowedUrl=Adapter.ENDPOINT;assert.equal(compile(snapshot,binding).active,false);
});

test('observed helper and adapter connection conflicts fail closed',()=>{
 for(const role of ['poll','admit','prepare','project','projectReject']){
  rejected((s,b,ids)=>at(s,ids[role]).config.parameters={authenticationType:'noAuth'});
  rejected((s,b,ids)=>at(s,ids[role]).config.parameters={authenticationType:'apiKeyConnection',apiKeyAccount:987654});
  rejected((s,b,ids)=>at(s,ids[role]).config.parameters={__IMTCONN__:222222});
 }
 for(const role of ['provider','report','reject']){
  rejected((s,b,ids)=>at(s,ids[role]).config.parameters.__IMTCONN__=10356915);
  rejected((s,b,ids)=>delete at(s,ids[role]).config.parameters.__IMTCONN__);
  rejected((s,b,ids)=>at(s,ids[role]).module=at(s,ids[role]).module.replace('app#',''));
 }
 rejected((s,b)=>b.adapterBinding.manifest_sha256='a'.repeat(64));
 rejected((s,b)=>b.adapterBinding.app_name='kk-telegram-response-adapter-wrong');
});

test('native omitted empty config domains compile without mutating or fabricating the actual readback',()=>{
 // Actual Make readback: new HTTP/Iterator/Commit modules have config:{},
 // while existing SDK modules have only their observed connection parameters.
 const {snapshot,binding,ids}=fixture();
 for(const role of Object.keys(ids)){
  const config=at(snapshot,ids[role]).config;
  delete config.mapper;
  if(!['provider','report','reject'].includes(role))delete config.parameters;
 }
 const before=structuredClone(snapshot),out=compile(snapshot,binding);
 assert.deepEqual(snapshot,before);
 for(const role of Object.keys(ids)){
  assert.equal(Object.hasOwn(at(snapshot,ids[role]).config,'mapper'),false);
  assert.equal(Object.hasOwn(at(snapshot,ids[role]).config,'parameters'),['provider','report','reject'].includes(role));
  assert.equal(at(out,ids[role]).disabled,true);
 }
 assert.deepEqual(at(out,ids.poll).config.parameters,{authenticationType:'apiKeyConnection',apiKeyAccount:333333});
 assert.equal(at(out,ids.poll).config.mapper.jsonStringBodyContent,'{"stage":"canonical-poll","version":"v2"}');
 assert.equal(at(out,ids.iterator).config.mapper.array,'{{101.data.tickets}}');
 assert.equal(at(out,ids.provider).config.parameters.__IMTCONN__,222222);
 assert.equal(at(out,ids.provider).config.mapper.receipt_id,'{{104.data.receipt_id}}');
 assert.equal(at(out,ids.provider).follows,104);
 assert.deepEqual(at(out,ids.reject).parent,{moduleId:111,kind:'errorHandler'});
 assert.deepEqual(at(out,ids.commit).config,{parameters:{},mapper:{}});
 for(const id of [5,6,8,9,10])assert.deepEqual(at(out,id),at(before,id));
 assert.deepEqual(out.trigger,before.trigger);assert.deepEqual(out.interface,before.interface);assert.deepEqual(out.settings,before.settings);
 assert.equal(out.active,false);assert.equal(out.activation_allowed,false);assert.equal(out.send_allowed,false);
});

test('native omission compatibility never accepts a present malformed domain or missing SDK connection',()=>{
 for(const role of Object.keys(fixture().ids)){
  for(const domain of ['parameters','mapper']){
   for(const value of [undefined,null,[],false,0,'',new Date()]){
    rejected((s,b,ids)=>{at(s,ids[role]).config[domain]=value;},/MAKE_CANONICAL_OFF_ORPHAN_GRAPH_REQUIRED/);
   }
  }
  rejected((s,b,ids)=>{at(s,ids[role]).config=null;},/MAKE_CANONICAL_OFF_ORPHAN_GRAPH_REQUIRED/);
 }
 for(const role of ['provider','report','reject']){
  rejected((s,b,ids)=>{delete at(s,ids[role]).config.parameters;},/MAKE_CANONICAL_ADAPTER_GRAPH_UNVERIFIED/);
  rejected((s,b,ids)=>{at(s,ids[role]).config.parameters={};},/MAKE_CANONICAL_ADAPTER_GRAPH_UNVERIFIED/);
 }
});

test('absent HTTP domains do not waive conflicting authentication TLS or proxy parameters',()=>{
 for(const role of ['poll','admit','prepare','project','projectReject']){
  for(const parameters of [{authenticationType:'noAuth'},{authenticationType:'apiKeyConnection',apiKeyAccount:999999},{tlsType:'mTls'},{proxyKeychain:999999},{caCertificateKeychain:999999}]){
   rejected((s,b,ids)=>{const config=at(s,ids[role]).config;delete config.mapper;config.parameters=parameters;},/MAKE_CANONICAL_CONNECTION_UNBOUND/);
  }
 }
});
