'use strict';
const crypto=require('node:crypto');
const Stage=require('../../server/make-owner-canonical-real-acceptance-stage');
const Adapter=require('../../server/make-owner-telegram-adapter');
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

module.exports={fixture,IDS,OFF,at,digest};
