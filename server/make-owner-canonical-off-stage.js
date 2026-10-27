'use strict';
// Pure source compiler. Supplied normalized readback is a prerequisite, never a
// live lookup or permission to install, execute, activate or send anything.
const {isDeepStrictEqual}=require('node:util');
const Adapter=require('./make-owner-telegram-adapter');
const ENDPOINT=Adapter.ENDPOINT;
const LEGACY={5:['scenario-service:StartSubscenario',2],6:['http:MakeRequest',4],8:['telegram:SendReplyMessage',1],9:['http:MakeRequest',4],10:['scenario-service:ReturnData',2]};
const ROLES=['poll','iterator','admit','prepare','provider','report','reject','project','projectReject','commit'];
const HTTP_ROLES=['poll','admit','prepare','project','projectReject'];
const ADAPTER_ROLES=['provider','report','reject'];
const ROUTES=['parent','onError','errorHandler','routes'];
const TRIGGER={moduleId:5,module:'scenario-service:StartSubscenario',kind:'on-demand',scheduling:{type:'on-demand'}};
function fail(code){throw Object.assign(new Error(code),{code});}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function exactKeys(value,keys){return plain(value)&&isDeepStrictEqual(Object.keys(value).sort(),keys.slice().sort());}
function hasAny(value,keys){return keys.some(key=>Object.hasOwn(value,key));}

function prepareAdapterOff(snapshot,binding){
 if(!plain(snapshot)||!plain(binding)||snapshot.scenario_id!=='6176241'||snapshot.active!==false||snapshot.incompleteExecutions!==0||
  typeof snapshot.lastEdit!=='string'||!snapshot.lastEdit.trim()||!Number.isFinite(Date.parse(snapshot.lastEdit))||snapshot.lastEdit!==binding.expectedLastEdit)fail('MAKE_CANONICAL_FRESH_OFF_SNAPSHOT_REQUIRED');
 // scenario_get's actual trigger/interface shape is retained. A separately
 // normalized schedule is optional but cannot disagree with that observation.
 if(!isDeepStrictEqual(snapshot.trigger,TRIGGER)||
  (Object.hasOwn(snapshot,'schedule')&&!isDeepStrictEqual(snapshot.schedule,TRIGGER.scheduling))||
  !plain(snapshot.interface)||!Array.isArray(snapshot.interface.input)||!Array.isArray(snapshot.interface.output)||
  !plain(snapshot.settings)||snapshot.settings.sequential!==true||snapshot.settings.dlq!==false)fail('MAKE_CANONICAL_OFF_SCENARIO_CONTRACT_REQUIRED');
 const adapter=Adapter.validateBinding(binding.adapterBinding),connection=binding.gatewayConnection;
 if(!exactKeys(connection,['id','type','allowedUrl'])||!Number.isSafeInteger(connection.id)||connection.id<1||
  connection.type!=='account:http-v4-apikey'||connection.allowedUrl!==ENDPOINT||connection.id===10356915||connection.id===adapter.connection_id||
  (Object.hasOwn(binding,'gatewayConnectionId')&&binding.gatewayConnectionId!==connection.id)||
  (Object.hasOwn(binding,'connectionAllowedUrl')&&binding.connectionAllowedUrl!==ENDPOINT))fail('MAKE_CANONICAL_CONNECTION_UNBOUND');
 const ids=binding.assignedIds;
 if(!exactKeys(ids,ROLES)||new Set(Object.values(ids)).size!==ROLES.length||
  ROLES.some(role=>!Number.isSafeInteger(ids[role])||ids[role]<1||Object.hasOwn(LEGACY,ids[role]))||ids.provider!==adapter.module_id)fail('MAKE_CANONICAL_ASSIGNED_IDS_REQUIRED');
 if(!Array.isArray(snapshot.modules)||snapshot.modules.length!==15||snapshot.modules.some(m=>!plain(m)||!Number.isSafeInteger(m.id)))fail('MAKE_CANONICAL_GRAPH_INVALID');
 const by=new Map(snapshot.modules.map(m=>[m.id,m]));
 if(by.size!==15||[...by.keys()].some(id=>!Object.hasOwn(LEGACY,id)&&!Object.values(ids).includes(id)))fail('MAKE_CANONICAL_GRAPH_INVALID');
 for(const [key,[module,version]]of Object.entries(LEGACY)){
  const id=Number(key),m=by.get(id);
  if(!m||m.module!==module||m.version!==version||hasAny(m,ROUTES)||
   (id===5?(m.root!=='main'||Object.hasOwn(m,'follows')):(m.follows!==({6:5,8:6,9:8,10:9}[id])||Object.hasOwn(m,'root'))))fail('MAKE_CANONICAL_LEGACY_GRAPH_CHANGED');
 }
 if(by.get(8).disabled!==true||by.get(8).config?.parameters?.__IMTCONN__!==10356915)fail('MAKE_CANONICAL_PROVIDER_MUST_REMAIN_DISABLED');
 for(const role of ROLES){
  const m=by.get(ids[role]);
  const module=ADAPTER_ROLES.includes(role)?'app#'+adapter.app_name+':'+(role==='provider'?'sendCapturedMessage':'reportCapturedOutcome'):role==='iterator'?'builtin:BasicFeeder':role==='commit'?'builtin:Commit':'http:MakeRequest';
  const version=HTTP_ROLES.includes(role)?4:1;
  if(!m||m.module!==module||m.version!==version||m.disabled!==true||m.root!=='orphan'||hasAny(m,[...ROUTES,'follows'])||
   !plain(m.config)||!plain(m.config.parameters)||!plain(m.config.mapper))fail('MAKE_CANONICAL_OFF_ORPHAN_GRAPH_REQUIRED');
  if(ADAPTER_ROLES.includes(role)&&m.config.parameters.__IMTCONN__!==adapter.connection_id)fail('MAKE_CANONICAL_ADAPTER_GRAPH_UNVERIFIED');
  // Empty HTTP parameters are an inert initial module; any observed binding
  // must already agree. Never overwrite a conflicting/noAuth connection.
  if(HTTP_ROLES.includes(role)){
   const p=m.config.parameters;
   if(Object.keys(p).some(k=>!['authenticationType','apiKeyAccount'].includes(k))||
    (Object.hasOwn(p,'authenticationType')&&p.authenticationType!=='apiKeyConnection')||
    (Object.hasOwn(p,'apiKeyAccount')&&p.apiKeyAccount!==connection.id))fail('MAKE_CANONICAL_CONNECTION_UNBOUND');
  }
 }
 const http=(id,follows,body)=>({id,module:'http:MakeRequest',version:4,disabled:true,...(follows?{follows}:{root:'orphan'}),
  config:{parameters:{authenticationType:'apiKeyConnection',apiKeyAccount:connection.id},mapper:{url:ENDPOINT,method:'post',contentType:'json',inputMethod:'jsonString',jsonStringBodyContent:body,
   parseResponse:true,stopOnHttpError:true,timeout:30,allowRedirects:false,shareCookies:false,requestCompressedContent:false}}});
 const envelope='{{'+ids.admit+'.data.envelope_json}}',attempt='{{'+ids.admit+'.data.attempt_id}}',receipt='{{'+ids.prepare+'.data.receipt_id}}';
 const poll=http(ids.poll,null,JSON.stringify({stage:'canonical-poll',version:'v2'}));
 const iterator={id:ids.iterator,module:'builtin:BasicFeeder',version:1,follows:ids.poll,disabled:true,config:{parameters:{},mapper:{array:'{{'+ids.poll+'.data.tickets}}'}}};
 const admit=http(ids.admit,ids.iterator,'{"stage":"canonical-admit","version":"v2","ticket":"{{'+ids.iterator+'.ticket}}"}');
 const prepare=http(ids.prepare,ids.admit,'{"stage":"canonical-prepare","attempt_id":"'+attempt+'","envelope":'+envelope+'}');
 const mapper={envelope_json:envelope,attempt_id:attempt,receipt_id:receipt};
 const provider={id:ids.provider,module:'app#'+adapter.app_name+':sendCapturedMessage',version:1,follows:ids.prepare,disabled:true,
  config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,provider_binding_sha256:Adapter.bindingDigest(adapter)}},
  filter:{name:'Adapter reservation readiness and original deadline',conditions:[[
   {a:'{{'+ids.prepare+'.data.adapter_ready}}',o:'boolean:equal',b:true},
   {a:receipt,o:'exist'},
   {a:'{{parseDate('+ids.admit+'.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',o:'date:greater',b:'{{addSeconds(now; 15)}}'},
  ]]}};
 const report={id:ids.report,module:'app#'+adapter.app_name+':reportCapturedOutcome',version:1,follows:ids.provider,disabled:true,
  config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,outcome_frame:'{{'+ids.provider+'.outcome_frame}}'}}};
 const reject={id:ids.reject,module:report.module,version:1,parent:{moduleId:ids.provider,kind:'errorHandler'},disabled:true,
  config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,outcome_frame:'{{'+ids.provider+'.error.message}}'}}};
 const project=http(ids.project,ids.report,'{"stage":"canonical-project","attempt_id":"'+attempt+'","envelope":'+envelope+'}');
 const projectReject=http(ids.projectReject,ids.reject,'{"stage":"canonical-project-rejection","attempt_id":"'+attempt+'","envelope":'+envelope+'}');
 const commit={id:ids.commit,module:'builtin:Commit',version:1,follows:ids.projectReject,disabled:true,config:{parameters:{},mapper:{}}};
 const legacy=[5,6,8,9,10].map(id=>structuredClone(by.get(id)));
 return {version:'kk-owner-canonical-independent-off-stage-v1',scenario_id:'6176241',expectedLastEdit:snapshot.lastEdit,
  active:false,activation_allowed:false,send_allowed:false,removeModuleIds:[],
  trigger:structuredClone(snapshot.trigger),interface:structuredClone(snapshot.interface),settings:structuredClone(snapshot.settings),
  ...(Object.hasOwn(snapshot,'schedule')?{schedule:structuredClone(snapshot.schedule)}:{}),
  modules:[...legacy,poll,iterator,admit,prepare,provider,report,reject,project,projectReject,commit],
  adapter_binding:structuredClone(adapter),adapter_manifest_sha256:Adapter.MANIFEST_SHA256,
  staging_status:'SOURCE_ONLY_OFF_GRAPH_NOT_RUNTIME_VERIFIED',
  unresolved_gates:['RELEASE','HTTP_CONNECTION_LIVE_READBACK','NATIVE','GAS','HTTP_ENGINE','PROVIDER','ACK','SHEET','NATURAL_RUNTIME'],
  required_readback:{active:false,incomplete_executions:0,all_canonical_modules_disabled:true,canonical_poll_root:'orphan',legacy_full_objects_preserved:true,
   trigger_interface_settings_preserved:true,provider_binding_sha256:Adapter.bindingDigest(adapter)},
 };
}
module.exports={ENDPOINT,prepareAdapterOff};
