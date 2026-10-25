'use strict';
// Offline migration compiler. It never contacts Make, creates connections,
// assigns live module IDs, changes a schedule or activates a provider.
const ENDPOINT='https://kk-phone-rental.vercel.app/api/kk-make-owner-notify';
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
  if(!Number.isInteger(id)||Object.hasOwn(old,id)||!m||m.module!==type||m.version!==version)fail('MAKE_CANONICAL_ASSIGNED_IDS_REQUIRED');
 }
 // Additional modules or error routes require a fresh design; do not retain an
 // unknown path that can bypass admission or replay a provider operation.
 if(modules.length!==9||modules.some(m=>m.parent||m.onError||m.errorHandler||m.routes))fail('MAKE_CANONICAL_UNREVIEWED_ROUTE');
 const http=(id,follows,body)=>({id,module:'http:MakeRequest',version:4,...(follows?{follows}:{root:'main'}),config:{parameters:{authenticationType:'apiKeyConnection',apiKeyAccount:binding.gatewayConnectionId},mapper:{url:ENDPOINT,method:'post',contentType:'json',inputMethod:'jsonString',jsonStringBodyContent:body,parseResponse:true,stopOnHttpError:true,timeout:30,allowRedirects:false,shareCookies:false,requestCompressedContent:false}}});
 const poll=http(ids.poll,null,JSON.stringify({stage:'canonical-poll',version:'v2'}));
 const iterator={id:ids.iterator,module:'builtin:BasicFeeder',version:1,follows:ids.poll,config:{parameters:{},mapper:{array:'{{'+ids.poll+'.data.tickets}}'}}};
 const admit=http(ids.admit,ids.iterator,'{"stage":"canonical-admit","version":"v2","ticket":"{{'+ids.iterator+'.ticket}}"}');
 const envelope='{{'+ids.admit+'.data.envelope_json}}';
 const reserve=http(6,ids.admit,'{"stage":"canonical-prepare","envelope":'+envelope+'}');
 const provider=structuredClone(by.get(8));provider.follows=6;delete provider.root;provider.disabled=true;
 provider.config.mapper={...provider.config.mapper,chatId:'{{6.data.target_chat_id}}',text:'{{6.data.text}}',parseMode:'',replyMarkup:''};
 // Replace old on-demand references atomically with original-envelope guards.
 provider.filter={name:'Canonical receipt lease and original deadline',conditions:[[
  {a:'{{6.data.send_allowed}}',o:'boolean:equal',b:true},
  {a:'{{6.data.receipt_id}}',o:'exist'},
  {a:'{{parseDate('+ids.admit+'.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',o:'date:greater',b:'{{addSeconds(now; 15)}}'}
 ]]};
 const ack=http(9,8,'{"stage":"canonical-ack","envelope":'+envelope+',"receipt_id":"{{6.data.receipt_id}}","provider_message_id":"{{8.message_id}}"}');
 const project=http(ids.project,9,'{"stage":"canonical-project","envelope":'+envelope+'}');
 return {version:'kk-owner-canonical-make-draft-v2',scenario_id:'6176241',expectedLastEdit:snapshot.lastEdit,active:false,activation_allowed:false,
  settings:{sequential:true,dlq:false},schedule:{type:'indefinitely',interval:900},input:[],output:[],removeModuleIds:[5,10],modules:[poll,iterator,admit,reserve,provider,ack,project],
  required_readback:{active:false,provider_module_8_disabled:true,incomplete_executions:0,sequential:true,dlq:false,provider_filter:['6.data.send_allowed = true','13.data.envelope.expires_at > now + 15 seconds'].map(x=>x.replace('13.',ids.admit+'.'))},
  release_status:'OFF_DRAFT_REQUIRES_SCHEMA_VALIDATION_AND_FRESH_BINDING_READBACK',
  apply_order:['Refresh same617 inactive snapshot and expectedLastEdit. Never save credentials in a blueprint.','Add inert HTTP/iterator modules under separately approved mutation, then use actual returned IDs and refreshed lastEdit with this compiler.','Validate desired flat graph and native scheduling/interface payload against current Make tools. Schedule/interface tool operations are deliberately not invented here.','Apply module edits with documented operations and expectedLastEdit; keep active false and module8 disabled.','Read back graph, exact filters, interval900, empty input/output, sequential and dlq false; require zero incomplete executions and no retry/Break/error routes.','Do not activate or run. Unknown/expired provider attempts require reconciliation; projection repair uses canonical-project only.']};
}
module.exports={ENDPOINT,prepare};
