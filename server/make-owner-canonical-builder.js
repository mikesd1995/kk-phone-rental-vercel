'use strict';
// Offline migration compiler. It never contacts Make, creates connections,
// assigns live module IDs, changes a schedule or activates a provider.
const ENDPOINT='https://kk-phone-rental.vercel.app/api/kk-make-owner-notify';
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
function fail(code){throw Object.assign(new Error(code),{code});}
function prepare(snapshot,binding){
 if(snapshot?.scenario_id!=='6176241'||snapshot.active!==false||snapshot.incompleteExecutions!==0||typeof snapshot.lastEdit!=='string'||snapshot.lastEdit!==binding?.expectedLastEdit)fail('MAKE_CANONICAL_FRESH_OFF_SNAPSHOT_REQUIRED');
 if(!Number.isInteger(binding.gatewayConnectionId)||binding.gatewayConnectionId<1||binding.connectionAllowedUrl!==ENDPOINT)fail('MAKE_CANONICAL_CONNECTION_UNBOUND');
 const modules=snapshot.modules;if(!Array.isArray(modules))fail('MAKE_CANONICAL_GRAPH_INVALID');
 const by=new Map(modules.map(m=>[m.id,m]));if(by.size!==modules.length)fail('MAKE_CANONICAL_GRAPH_INVALID');
 const old={5:['scenario-service:StartSubscenario',2],6:['http:MakeRequest',4],8:['telegram:SendReplyMessage',1],9:['http:MakeRequest',4],10:['scenario-service:ReturnData',2]};
 for(const [id,[module,version]]of Object.entries(old)){const m=by.get(Number(id));if(!m||m.module!==module||m.version!==version)fail('MAKE_CANONICAL_GRAPH_CHANGED');}
 if(by.get(8).disabled!==true||by.get(8).config?.parameters?.__IMTCONN__!==10356915)fail('MAKE_CANONICAL_PROVIDER_MUST_REMAIN_DISABLED');
 const ids=binding.assignedIds;if(!ids||Object.keys(ids).sort().join(',')!=='admit,iterator,poll,project'||new Set(Object.values(ids)).size!==4)fail('MAKE_CANONICAL_ASSIGNED_IDS_REQUIRED');
 for(const role of Object.keys(ids)){
  const id=ids[role],m=by.get(id),type=role==='iterator'?'builtin:BasicFeeder':'http:MakeRequest',version=role==='iterator'?1:4;
  if(!Number.isInteger(id)||id<1||Object.hasOwn(old,id)||!m||m.module!==type||m.version!==version)fail('MAKE_CANONICAL_ASSIGNED_IDS_REQUIRED');
 }
 const http=(id,follows,body)=>({id,module:'http:MakeRequest',version:4,...(follows?{follows}:{root:'main'}),config:{parameters:{authenticationType:'apiKeyConnection',apiKeyAccount:binding.gatewayConnectionId},mapper:{url:ENDPOINT,method:'post',contentType:'json',inputMethod:'jsonString',jsonStringBodyContent:body,parseResponse:true,stopOnHttpError:true,timeout:30,allowRedirects:false,shareCookies:false,requestCompressedContent:false}}});
 // A negative route can only be carried forward from an independently reviewed
 // native module-8 snapshot. Expressions and Make error-schema keys are never
 // guessed here. A digest is a release binding, not proof of live capture.
 const capture=binding.capture;
 if(by.get(8).parent||by.get(8).onError||by.get(8).routes||by.get(8).errorHandler)fail('MAKE_CANONICAL_UNREVIEWED_ROUTE');
 let errorModules=[];
 if(capture||modules.length!==9){
  if(!capture||typeof capture!=='object'||Array.isArray(capture)||Object.keys(capture).sort().join(',')!=='error_module_ids,field_mappings,profile_id,provider_route_sha256,review_sha256,schema_sha256'||
    capture.profile_id!=='native-telegram-617-module8-v1'||!/^[a-f0-9]{64}$/.test(capture.schema_sha256||'')||!/^[a-f0-9]{64}$/.test(capture.review_sha256||'')||
    binding.reviewedCaptureSha256!==capture.review_sha256||!/^[a-f0-9]{64}$/.test(capture.provider_route_sha256||''))fail('MAKE_CANONICAL_CAPTURE_UNVERIFIED');
  if(!Array.isArray(capture.error_module_ids)||capture.error_module_ids.length!==3||new Set(capture.error_module_ids).size!==3||
    capture.error_module_ids.some(id=>!Number.isInteger(id)||id<1||Object.hasOwn(old,id)||Object.values(ids).includes(id))||modules.length!==12)fail('MAKE_CANONICAL_CAPTURE_ROUTE_INVALID');
  errorModules=capture.error_module_ids.map(id=>by.get(id));
  const [rejectModule,projectModule,commitModule]=errorModules;
  if(!rejectModule||!projectModule||!commitModule||
    rejectModule.module!=='http:MakeRequest'||rejectModule.version!==4||!isDeepStrictEqual(rejectModule.parent,{moduleId:8,kind:'errorHandler'})||
    projectModule.module!=='http:MakeRequest'||projectModule.version!==4||projectModule.follows!==rejectModule.id||
    commitModule.module!=='builtin:Commit'||commitModule.version!==1||commitModule.follows!==projectModule.id||
    !isDeepStrictEqual(commitModule,{id:commitModule.id,module:'builtin:Commit',version:1,follows:projectModule.id,config:{parameters:{},mapper:{}}})||
    crypto.createHash('sha256').update(JSON.stringify(errorModules)).digest('hex')!==capture.provider_route_sha256)fail('MAKE_CANONICAL_CAPTURE_ROUTE_INVALID');
  const fields=capture.field_mappings;
  const captureKeys=['profile_id','scenario_id','module_id','connection_id','source_notification_id','attempt_id','attempt_no','receipt_id','descriptor_sha256','http_status','telegram_response'];
  if(!fields||Object.keys(fields).sort().join(',')!==captureKeys.slice().sort().join(',')||Object.values(fields).some(v=>typeof v!=='string'||!v||/[\u0000-\u001f]/.test(v))||
    fields.profile_id!==capture.profile_id||fields.scenario_id!=='6176241'||fields.module_id!=='8'||fields.connection_id!=='10356915')fail('MAKE_CANONICAL_CAPTURE_MAPPING_INVALID');
  // The Sheet ID may contain JSON-reserved characters and is not the ks1_
  // transport identity. Use the gateway's JSON-escaped scalar without quotes.
  const expected={source_notification_id:'{{'+ids.admit+'.data.source_notification_id_json}}',attempt_id:'{{'+ids.admit+'.data.attempt_id}}',attempt_no:'{{'+ids.admit+'.data.attempt_no}}',receipt_id:'{{6.data.receipt_id}}',descriptor_sha256:'{{6.data.descriptor_sha256}}'};
  if(Object.entries(expected).some(([k,v])=>fields[k]!==v)||!/^\{\{8\.[^{}\r\n]+\}\}$/.test(fields.http_status)||!/^\{\{toString\(8\.[^{}\r\n;()]+\)\}\}$/.test(fields.telegram_response))fail('MAKE_CANONICAL_CAPTURE_MAPPING_INVALID');
  const digest=require('./make-owner-canonical').captureProfileDigest({id:capture.profile_id,scenario_id:'6176241',module_id:8,connection_id:10356915,schema_sha256:capture.schema_sha256,provider_route_sha256:capture.provider_route_sha256,field_mappings:fields});
  if(digest!==capture.review_sha256)fail('MAKE_CANONICAL_CAPTURE_REVIEW_MISMATCH');
  const envelope='{{'+ids.admit+'.data.envelope_json}}';
  const rejection='{"stage":"canonical-reject","envelope":'+envelope+',"attempt_id":'+JSON.stringify(fields.attempt_id)+',"receipt_id":'+JSON.stringify(fields.receipt_id)+',"capture":{"profile_id":'+JSON.stringify(fields.profile_id)+',"scenario_id":'+JSON.stringify(fields.scenario_id)+',"module_id":8,"connection_id":10356915,"source_notification_id":'+fields.source_notification_id+',"attempt_id":'+JSON.stringify(fields.attempt_id)+',"attempt_no":'+fields.attempt_no+',"receipt_id":'+JSON.stringify(fields.receipt_id)+',"descriptor_sha256":'+JSON.stringify(fields.descriptor_sha256)+',"http_status":'+fields.http_status+',"telegram_response":'+fields.telegram_response+'}}';
  const projection='{"stage":"canonical-project-rejection","attempt_id":'+JSON.stringify(fields.attempt_id)+',"envelope":'+envelope+'}';
  const expectedReject=http(rejectModule.id,null,rejection);delete expectedReject.root;expectedReject.parent={moduleId:8,kind:'errorHandler'};
  if(!isDeepStrictEqual(rejectModule,expectedReject)||!isDeepStrictEqual(projectModule,http(projectModule.id,rejectModule.id,projection)))fail('MAKE_CANONICAL_CAPTURE_ROUTE_INVALID');
 }
 if(modules.some(m=>m.id!==8&&!errorModules.includes(m)&&(m.parent||m.onError||m.errorHandler||m.routes)))fail('MAKE_CANONICAL_UNREVIEWED_ROUTE');
 const poll=http(ids.poll,null,JSON.stringify({stage:'canonical-poll',version:'v2'}));
 const iterator={id:ids.iterator,module:'builtin:BasicFeeder',version:1,follows:ids.poll,config:{parameters:{},mapper:{array:'{{'+ids.poll+'.data.tickets}}'}}};
 const admit=http(ids.admit,ids.iterator,'{"stage":"canonical-admit","version":"v2","ticket":"{{'+ids.iterator+'.ticket}}"}');
 const envelope='{{'+ids.admit+'.data.envelope_json}}';
 const attempt='{{'+ids.admit+'.data.attempt_id}}';
 const reserve=http(6,ids.admit,'{"stage":"canonical-prepare","attempt_id":"'+attempt+'","envelope":'+envelope+'}');
 const provider=structuredClone(by.get(8));provider.follows=6;delete provider.root;provider.disabled=true;
 provider.config.mapper={...provider.config.mapper,chatId:'{{6.data.target_chat_id}}',text:'{{6.data.text}}',parseMode:'',replyMarkup:''};
 // Replace old on-demand references atomically with original-envelope guards.
 provider.filter={name:'Canonical receipt lease and original deadline',conditions:[[
  {a:'{{6.data.send_allowed}}',o:'boolean:equal',b:true},
  {a:'{{6.data.receipt_id}}',o:'exist'},
  {a:'{{parseDate('+ids.admit+'.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',o:'date:greater',b:'{{addSeconds(now; 15)}}'}
 ]]};
 const ack=http(9,8,'{"stage":"canonical-ack","attempt_id":"'+attempt+'","envelope":'+envelope+',"receipt_id":"{{6.data.receipt_id}}","provider_message_id":"{{8.message_id}}"}');
 const project=http(ids.project,9,'{"stage":"canonical-project","attempt_id":"'+attempt+'","envelope":'+envelope+'}');
 return {version:'kk-owner-canonical-make-draft-v2',scenario_id:'6176241',expectedLastEdit:snapshot.lastEdit,active:false,activation_allowed:false,
  settings:{sequential:true,dlq:false},schedule:{type:'indefinitely',interval:900},input:[],output:[],removeModuleIds:[5,10],modules:[poll,iterator,admit,reserve,provider,ack,project,...errorModules.map(m=>structuredClone(m))],
  required_readback:{active:false,provider_module_8_disabled:true,incomplete_executions:0,sequential:true,dlq:false,provider_filter:['6.data.send_allowed = true','13.data.envelope.expires_at > now + 15 seconds'].map(x=>x.replace('13.',ids.admit+'.')),...(capture?{provider_error_route_sha256:capture.provider_route_sha256,capture_review_sha256:capture.review_sha256}: {})},
  capture_profile_required:capture?{profile_id:capture.profile_id,schema_sha256:capture.schema_sha256,review_sha256:capture.review_sha256,provider_route_sha256:capture.provider_route_sha256}:null,
  release_status:capture?'OFF_DRAFT_REQUIRES_LIVE_CAPTURE_SCHEMA_AND_BINDING_READBACK':'OFF_DRAFT_POSITIVE_ROUTE_ONLY_NEGATIVE_CAPTURE_UNVERIFIED',
  apply_order:['Refresh same617 inactive snapshot and expectedLastEdit. Never save credentials in a blueprint.','Add inert HTTP/iterator modules under separately approved mutation, then use actual returned IDs and refreshed lastEdit with this compiler.','Validate desired graph and native scheduling/interface payload against current Make tools. Schedule/interface tool operations are deliberately not invented here.','For a negative path, independently verify and hash exact native module8 structured response bindings before compiling; current public logs cannot supply this proof.','Apply module edits with documented operations and expectedLastEdit; keep active false and module8 disabled.','Read back graph, exact filters, interval900, empty input/output, sequential and dlq false; require zero incomplete executions and no Make retry/Break/Resume/sleep.','Do not activate or run. Unknown/expired provider attempts require reconciliation; positive and negative projections are repair only.']};
}
function prepareAdapter(snapshot,binding){
 const A=require('./make-owner-telegram-adapter'),adapter=A.validateBinding(binding?.adapterBinding),assigned=binding?.assignedIds;
 const roles=['poll','iterator','admit','project','provider','report','reject','projectReject','commit'];
 if(!assigned||Object.keys(assigned).sort().join(',')!==roles.slice().sort().join(',')||new Set(Object.values(assigned)).size!==roles.length||roles.some(r=>!Number.isSafeInteger(assigned[r])||assigned[r]<1)||assigned.provider!==adapter.module_id)fail('MAKE_CANONICAL_ASSIGNED_IDS_REQUIRED');
 const by=new Map(snapshot?.modules?.map(m=>[m.id,m])||[]);if(by.size!==snapshot?.modules?.length||by.size!==14)fail('MAKE_CANONICAL_GRAPH_INVALID');
 for(const [role,type,version] of [['provider',adapter.app_name+':sendCapturedMessage',1],['report',adapter.app_name+':reportCapturedOutcome',1],['reject',adapter.app_name+':reportCapturedOutcome',1],['projectReject','http:MakeRequest',4],['commit','builtin:Commit',1]]){
  const m=by.get(assigned[role]);if([5,6,8,9,10].includes(assigned[role])||!m||m.module!==type||m.version!==version||m.parent||m.follows||m.errorHandler||m.routes)fail('MAKE_CANONICAL_ADAPTER_GRAPH_UNVERIFIED');
  if(['provider','report','reject'].includes(role)&&(m.disabled!==true||m.config?.parameters?.__IMTCONN__!==adapter.connection_id))fail('MAKE_CANONICAL_ADAPTER_GRAPH_UNVERIFIED');
 }
 const baseIds=Object.fromEntries(['poll','iterator','admit','project'].map(k=>[k,assigned[k]]));
 const base=prepare({...snapshot,modules:snapshot.modules.filter(m=>[5,6,8,9,10,...Object.values(baseIds)].includes(m.id))},{...binding,assignedIds:baseIds,capture:undefined});
 const envelope='{{'+assigned.admit+'.data.envelope_json}}',attempt='{{'+assigned.admit+'.data.attempt_id}}';
 const mapper={envelope_json:envelope,attempt_id:attempt,receipt_id:'{{6.data.receipt_id}}'};
 const provider={id:assigned.provider,module:adapter.app_name+':sendCapturedMessage',version:1,follows:6,disabled:true,config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,provider_binding_sha256:A.bindingDigest(adapter)}},filter:structuredClone(base.modules.find(m=>m.id===8).filter)};
 provider.filter.name='Adapter reservation readiness and original deadline';provider.filter.conditions[0][0].a='{{6.data.adapter_ready}}';
 const report={id:assigned.report,module:adapter.app_name+':reportCapturedOutcome',version:1,follows:provider.id,disabled:true,config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,outcome_frame:'{{'+provider.id+'.outcome_frame}}'}}};
 const rejection={...structuredClone(report),id:assigned.reject,parent:{moduleId:provider.id,kind:'errorHandler'},config:{parameters:{__IMTCONN__:adapter.connection_id},mapper:{...mapper,outcome_frame:'{{'+provider.id+'.error.message}}'}}};delete rejection.follows;
 const project=base.modules.find(m=>m.id===assigned.project);project.follows=report.id;
 const projectReject={...structuredClone(project),id:assigned.projectReject,follows:rejection.id};projectReject.config.mapper.jsonStringBodyContent='{"stage":"canonical-project-rejection","attempt_id":"'+attempt+'","envelope":'+envelope+'}';
 const oldProvider=base.modules.find(m=>m.id===8);oldProvider.root='orphan';delete oldProvider.follows;
 return {...base,version:'kk-owner-canonical-make-capture-adapter-v1',removeModuleIds:[5,9,10],modules:[...base.modules.filter(m=>![8,9].includes(m.id)),provider,report,rejection,projectReject,{id:assigned.commit,module:'builtin:Commit',version:1,follows:projectReject.id,config:{parameters:{},mapper:{}}},oldProvider],adapter_binding:adapter,
  adapter_manifest_sha256:A.MANIFEST_SHA256,required_readback:{...base.required_readback,provider_filter:['6.data.adapter_ready = true',assigned.admit+'.data.envelope.expires_at > now + 15 seconds'],adapter_module_id:provider.id,adapter_provider_disabled:true,adapter_reporters_disabled:true,adapter_connection_id:adapter.connection_id,old_native8_disabled:true,no_unhandled_or_incomplete_provider_retry:true},
  release_status:'OFF_SOURCE_ADAPTER_REQUIRES_INSTALLATION_BOT_AND_ENGINE_RETRY_READBACK',capture_profile_required:null,
  apply_order:[...base.apply_order,'Install the reviewed custom app/secure connection separately; attest getMe bot identity and actual engine retry granularity. Never copy native10356915 credentials or synthetic mappings.','Use actual assigned adapter module IDs and exact secure connection metadata. Keep both providers and reporters disabled; native8 remains a disabled orphan until an approved cutover.']};
}
module.exports={ENDPOINT,prepare,prepareAdapter};
