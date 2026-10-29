'use strict';
// Pure normalized-snapshot compiler and local CAS simulator. This module has no
// Make client, runner, clock, provider or install capability. Scenario-interface
// and filter-removal connector opcodes require separate read-only confirmation.
const crypto=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const Adapter=require('./make-owner-telegram-adapter');
const Round=require('./make-owner-real-acceptance');
const IDS=[5,6,8,9,10,26,31,27,28,11,12,29,13,30,25];
const OFF=[8,26,31,27,28,11,12,29,13,30,25];
const HTTP=[26,27,28,29,30];
const TRIGGER={moduleId:5,module:'scenario-service:StartSubscenario',kind:'on-demand',scheduling:{type:'on-demand'}};
const INPUT=[{name:'round_id',type:'text',required:true},{name:'manifest_sha256',type:'text',required:true}];
const BODY={26:'{"stage":"canonical-poll","version":"v2"}',27:'{"stage":"canonical-admit","version":"v2","ticket":"{{31.ticket}}"}',28:'{"stage":"canonical-prepare","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}',29:'{"stage":"canonical-project","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}',30:'{"stage":"canonical-project-rejection","attempt_id":"{{27.data.attempt_id}}","envelope":{{27.data.envelope_json}}}'};
const ORIGINAL_FILTER={name:'Adapter reservation readiness and original deadline',conditions:[[{a:'{{28.data.adapter_ready}}',b:true,o:'boolean:equal'},{a:'{{28.data.receipt_id}}',o:'exist'},{a:'{{parseDate(27.data.envelope.expires_at; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',b:'{{addSeconds(now; 15)}}',o:'date:greater'}]]};
function fail(code){throw Object.assign(new Error(code),{code});}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));}
function exact(v,keys){return plain(v)&&equal(Reflect.ownKeys(v).sort(),keys.slice().sort());}
function clone(v){return structuredClone(v);}
function stable(v){
 if(v===null||typeof v==='boolean'||typeof v==='string')return v;
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(Array.isArray(v)){if(Object.keys(v).length!==v.length)fail('MAKE_REAL_ACCEPTANCE_JSON_REQUIRED');return v.map(stable);}
 if(!plain(v)||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))fail('MAKE_REAL_ACCEPTANCE_JSON_REQUIRED');
 return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
}
function snapshotDigest(snapshot){return crypto.createHash('sha256').update(JSON.stringify(stable(snapshot)),'utf8').digest('hex');}
function stamp(v){return typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
function withoutClock(s){const out=clone(s);delete out.lastEdit;return snapshotDigest(out);}
function normalizeInstalledSnapshot(raw,settings){
 if(!plain(raw)||!plain(raw.structure)||!plain(raw.structure.scenario)||!plain(raw.configs)||!Array.isArray(raw.structure.modules)||!Array.isArray(raw.configs.modules)||
  !plain(settings)||!['sequential','dlq','confidential','maxErrors','autoCommit','commitTriggerLast'].every(k=>Object.hasOwn(settings,k))||
  typeof settings.confidential!=='boolean'||!Number.isSafeInteger(settings.maxErrors)||settings.maxErrors<1||typeof settings.autoCommit!=='boolean'||typeof settings.commitTriggerLast!=='boolean')fail('MAKE_REAL_ACCEPTANCE_COMPLETE_READBACK_REQUIRED');
 const sc=raw.structure.scenario;
 if(sc.id!==6176241||sc.status!=='inactive'||sc.isLockedForEditing!==false||sc.isWaitingOnIncompleteExecutions!==false||sc.incompleteExecutions!==0||!stamp(sc.lastEdit))fail('MAKE_REAL_ACCEPTANCE_FRESH_INACTIVE_REQUIRED');
 for(const domain of [raw,raw.structure,raw.configs,sc])for(const k of ['errors','modulesTooLarge','modulesOmitted','notFound'])if(Object.hasOwn(domain,k)&&(!Array.isArray(domain[k])||domain[k].length))fail('MAKE_REAL_ACCEPTANCE_INCOMPLETE_READBACK');
 const configs=new Map();for(const c of raw.configs.modules){if(!plain(c)||configs.has(c.id)||!plain(c.config)||c.tooLarge===true)fail('MAKE_REAL_ACCEPTANCE_INCOMPLETE_READBACK');configs.set(c.id,c);}
 if(configs.size!==raw.structure.modules.length)fail('MAKE_REAL_ACCEPTANCE_INCOMPLETE_READBACK');
 const derived=[];
 const modules=raw.structure.modules.map(m=>{
  if(!plain(m)||!configs.has(m.id))fail('MAKE_REAL_ACCEPTANCE_INCOMPLETE_READBACK');const c=configs.get(m.id);
  if(c.module!==m.module||c.version!==m.version)fail('MAKE_REAL_ACCEPTANCE_CONFIG_IDENTITY_MISMATCH');
  if(Object.hasOwn(m,'issues')){
   if(!Array.isArray(m.issues)||m.issues.some(i=>!plain(i)||i.severity!=='warning'||typeof i.message!=='string'))fail('MAKE_REAL_ACCEPTANCE_MODULE_ISSUES');
   if(m.issues.length)derived.push({moduleId:m.id,issues:clone(m.issues)});
  }
  const out=clone(m);delete out.issues;
  if(Object.hasOwn(out,'config')&&!equal(out.config,c.config))fail('MAKE_REAL_ACCEPTANCE_CONFIG_IDENTITY_MISMATCH');out.config=clone(c.config);return out;
 });
 const snapshot={scenario_id:'6176241',active:false,incompleteExecutions:sc.incompleteExecutions,lastEdit:sc.lastEdit,trigger:clone(raw.structure.trigger),interface:clone(raw.structure.interface),settings:clone(settings),modules};
 if(Object.hasOwn(raw.structure,'schedule'))snapshot.schedule=clone(raw.structure.schedule);
 requiredScenario(snapshot);snapshotDigest(snapshot);
 return {snapshot,normalization:{derived_issues:derived,omitted_fields:['modules[].issues'],source_observed_at:raw.observedAt??null}};
}
function requiredScenario(s){
 if(!plain(s)||s.scenario_id!=='6176241'||s.active!==false||s.incompleteExecutions!==0||!stamp(s.lastEdit)||!equal(s.trigger,TRIGGER)||
  (Object.hasOwn(s,'schedule')&&!equal(s.schedule,TRIGGER.scheduling))||!plain(s.settings)||s.settings.sequential!==true||s.settings.dlq!==false||
  !exact(s.interface,['input','output'])||!Array.isArray(s.interface.input)||!Array.isArray(s.interface.output)||
  !Array.isArray(s.modules)||s.modules.length!==15||s.modules.some(m=>!plain(m)||!Number.isSafeInteger(m.id))||new Set(s.modules.map(m=>m.id)).size!==15||s.modules.some(m=>!IDS.includes(m.id)))fail('MAKE_REAL_ACCEPTANCE_SCENARIO_INVALID');
 if(s.modules.some(m=>['onError','errorHandler','routes'].some(k=>Object.hasOwn(m,k))||!plain(m.config)||
  ['parameters','mapper'].some(k=>Object.hasOwn(m.config,k)&&!plain(m.config[k]))||
  (Object.hasOwn(m,'issues')&&(!Array.isArray(m.issues)||m.issues.some(i=>!plain(i)||i.severity!=='warning')))))fail('MAKE_REAL_ACCEPTANCE_MODULE_INVALID');
 for(const id of OFF)if(s.modules.find(m=>m.id===id).disabled!==true)fail('MAKE_REAL_ACCEPTANCE_ALL_OFF_REQUIRED');
}
function validateInstalled(s,b){
 requiredScenario(s);
 if(!plain(b)||b.expectedLastEdit!==s.lastEdit||!stamp(b.expectedLastEdit)||typeof b.expectedSnapshotSha256!=='string'||!/^[a-f0-9]{64}$/.test(b.expectedSnapshotSha256)||snapshotDigest(s)!==b.expectedSnapshotSha256)fail('MAKE_REAL_ACCEPTANCE_SNAPSHOT_CAS_MISMATCH');
 const adapter=Adapter.validateBinding(b.adapterBinding),conn=b.gatewayConnection;
 if(adapter.module_id!==11||adapter.connection_id!==11956776||!exact(conn,['id','type','allowedUrl'])||conn.id!==11963582||conn.type!=='account:http-v4-apikey'||conn.allowedUrl!==Adapter.ENDPOINT)fail('MAKE_REAL_ACCEPTANCE_CONNECTION_MISMATCH');
 const manifest=Round.validateManifest(b.manifest);
 if(b.manifest_sha256!==Round.digest(manifest)||manifest.provider_binding_sha256!==Adapter.bindingDigest(adapter))fail('MAKE_REAL_ACCEPTANCE_MANIFEST_MISMATCH');
 const by=new Map(s.modules.map(m=>[m.id,m]));
 const types={5:['scenario-service:StartSubscenario',2],6:['http:MakeRequest',4],8:['telegram:SendReplyMessage',1],9:['http:MakeRequest',4],10:['scenario-service:ReturnData',2],26:['http:MakeRequest',4],31:['builtin:BasicFeeder',1],27:['http:MakeRequest',4],28:['http:MakeRequest',4],11:['app#'+adapter.app_name+':sendCapturedMessage',1],12:['app#'+adapter.app_name+':reportCapturedOutcome',1],29:['http:MakeRequest',4],13:['app#'+adapter.app_name+':reportCapturedOutcome',1],30:['http:MakeRequest',4],25:['builtin:Commit',1]};
 const edges={5:{root:'main'},6:{follows:5},8:{follows:6},9:{follows:8},10:{follows:9},26:{root:'orphan'},31:{follows:26},27:{follows:31},28:{follows:27},11:{follows:28},12:{follows:11},29:{follows:12},13:{parent:{moduleId:11,kind:'errorHandler'}},30:{follows:13},25:{follows:30}};
 for(const id of IDS){const m=by.get(id),edge=Object.fromEntries(['root','follows','parent'].filter(k=>Object.hasOwn(m,k)).map(k=>[k,m[k]]));
  if(m.module!==types[id][0]||m.version!==types[id][1]||!equal(edge,edges[id]))fail('MAKE_REAL_ACCEPTANCE_GRAPH_CHANGED');
 }
 if(!equal(by.get(8).config.parameters,{__IMTCONN__:10356915})||!equal(by.get(11).filter,ORIGINAL_FILTER)||Object.hasOwn(by.get(26),'filter')||Object.hasOwn(by.get(31),'filter'))fail('MAKE_REAL_ACCEPTANCE_FILTER_OR_LEGACY_CHANGED');
 for(const id of HTTP){const c=by.get(id).config;
  const expected={url:Adapter.ENDPOINT,method:'post',timeout:30,contentType:'json',inputMethod:'jsonString',shareCookies:false,parseResponse:true,allowRedirects:false,stopOnHttpError:true,jsonStringBodyContent:BODY[id],requestCompressedContent:false};
  if(!exact(c,['parameters','mapper'])||!equal(c.parameters,{authenticationType:'apiKeyConnection',apiKeyAccount:11963582})||!equal(c.mapper,expected))fail('MAKE_REAL_ACCEPTANCE_HTTP_CHANGED');
 }
 for(const id of [11,12,13]){
  const expected={attempt_id:'{{27.data.attempt_id}}',receipt_id:'{{28.data.receipt_id}}',envelope_json:'{{27.data.envelope_json}}',...(id===11?{provider_binding_sha256:Adapter.bindingDigest(adapter)}:{outcome_frame:id===12?'{{11.outcome_frame}}':'{{11.error.message}}'})};
  if(!exact(by.get(id).config,['parameters','mapper'])||!equal(by.get(id).config.parameters,{__IMTCONN__:11956776})||!equal(by.get(id).config.mapper,expected))fail('MAKE_REAL_ACCEPTANCE_ADAPTER_CHANGED');
 }
 if(!equal(by.get(31).config,{parameters:{},mapper:{array:'{{26.data.tickets}}'}})||!equal(by.get(25).config,{parameters:{},mapper:{}})||s.interface.input.length!==1||s.interface.input[0]?.name!=='envelope'||s.interface.input[0]?.type!=='text'||s.interface.input[0]?.required!==true)fail('MAKE_REAL_ACCEPTANCE_INPUT_CHANGED');
 return {adapter,manifest};
}
function controls(prefix,m,digest,deadline){return [
 {a:'{{'+prefix+'.round_id}}',o:'text:equal',b:m.round_id},
 {a:'{{'+prefix+'.manifest_sha256}}',o:'text:equal',b:digest},
 ...(deadline?[{a:'{{'+prefix+'.deadline}}',o:'text:equal',b:m.expires_at},{a:'{{parseDate('+prefix+'.deadline; "YYYY-MM-DDTHH:mm:ss.SSSZ")}}',o:'date:greater',b:'{{now}}'}]:[]),
 ];}
function changes(before,after){const result=[];
 function walk(a,b,path){if(equal(a,b))return;
  if((plain(a)&&plain(b))||(Array.isArray(a)&&Array.isArray(b))){for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
   if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))result.push({path:path.concat(key),before_present:Object.hasOwn(a,key),after_present:Object.hasOwn(b,key),...(Object.hasOwn(a,key)?{before:clone(a[key])}:{}),...(Object.hasOwn(b,key)?{after:clone(b[key])}:{})});else walk(a[key],b[key],path.concat(key));
  }}else result.push({path,before_present:true,after_present:true,before:clone(a),after:clone(b)});
 }
 walk(before,after,[]);return result;
}
function operationsBetween(before,after){const operations=[];
 for(const id of IDS){const a=before.modules.find(m=>m.id===id),b=after.modules.find(m=>m.id===id),edge=m=>Object.fromEntries(['root','follows','parent'].filter(k=>Object.hasOwn(m,k)).map(k=>[k,m[k]]));
  if(!equal(edge(a),edge(b)))operations.push({op:'module_move',moduleId:id,...clone(edge(b))});
  if(!equal(a.config,b.config))operations.push({op:'module_config_set',moduleId:id,config:clone(b.config)});
  if(!equal(a.filter,b.filter)||Object.hasOwn(a,'filter')!==Object.hasOwn(b,'filter'))operations.push({op:'filter_set',moduleId:id,...(Object.hasOwn(b,'filter')?{filter:clone(b.filter)}:{remove:true})});
 }
 for(const id of OFF)operations.push({op:'module_disabled_set',moduleId:id,disabled:true});
 return operations;
}
function patchFor(before,after){return {scenarioId:6176241,expectedLastEdit:before.lastEdit,expectedSnapshotSha256:snapshotDigest(before),expectedAfterSnapshotSha256:snapshotDigest(after),
 operations:operationsBetween(before,after),interface:clone(after.interface),
 interface_update:{kind:'SCENARIO_INTERFACE_UPDATE_REQUIRED',value:clone(after.interface),connector_opcode_verified:false},
 connector_ready:false,capability_gates:['SCENARIO_INTERFACE_OPCODE_NOT_VERIFIED',...(operationsBetween(before,after).some(o=>o.remove)?['FILTER_REMOVE_SEMANTICS_NOT_VERIFIED']:[])],
 };}
function prepareRealAcceptanceStage(snapshot,binding){
 const {manifest}=validateInstalled(snapshot,binding),before=clone(snapshot),after=clone(snapshot),at=id=>after.modules.find(m=>m.id===id),md=binding.manifest_sha256;
 delete at(6).follows;at(6).root='orphan';delete at(26).root;at(26).follows=5;
 after.interface.input=clone(INPUT);
 at(26).config.mapper.jsonStringBodyContent=JSON.stringify({stage:'canonical-poll',version:'v2',acceptance_round:{round_id:'{{5.round_id}}',manifest_sha256:'{{5.manifest_sha256}}'}});
 at(26).filter={name:'Exact reviewed bounded round controls',conditions:[controls('5',manifest,md,false)]};
 at(31).filter={name:'Exactly one bounded round ticket before iterator',conditions:[[{a:'{{length(26.data.tickets)}}',o:'number:equal',b:'1'},...controls('26.data.acceptance_round',manifest,md,true)]]};
 at(11).filter={name:'Bounded round and original signed TTL before provider',conditions:[[...clone(ORIGINAL_FILTER.conditions[0]),...controls('27.data.acceptance_round',manifest,md,true)]]};
 const patch=patchFor(before,after);
 return {version:'kk-owner-canonical-real-acceptance-stage-v1',scenario_id:'6176241',activation_allowed:false,send_allowed:false,runtime_verified:false,
  staging_status:'SOURCE_ONLY_OFF_GRAPH_NOT_RUNTIME_VERIFIED',before,after,before_sha256:snapshotDigest(before),after_sha256:snapshotDigest(after),
  manifest_sha256:md,round:clone(manifest),allowed_changes:changes(before,after),patch,
  inverse_template:{expectedLastEdit:null,requires_fresh_lastEdit:true,expected_content_sha256:withoutClock(after),restore_snapshot:clone(before),operations:operationsBetween(after,before),interface:clone(before.interface)},
  unresolved_gates:['LIVE_POLICY','RELEASE','GAS_PARITY','MAKE_CONNECTOR_INTERFACE_OPCODE','MAKE_FILTER_REMOVE_SEMANTICS','ENGINE','PROVIDER','ACK','SHEET','NATURAL_RUNTIME'],
 };
}
// Simulate only; never send this descriptor wholesale to scenario_patch. The
// interface intent is separate until the connector's exact opcode is confirmed.
function applyStagePatch(snapshot,patch){
 requiredScenario(snapshot);
 if(!plain(patch)||patch.scenarioId!==6176241||snapshot.lastEdit!==patch.expectedLastEdit||snapshotDigest(snapshot)!==patch.expectedSnapshotSha256||!Array.isArray(patch.operations)||!plain(patch.interface))fail('MAKE_REAL_ACCEPTANCE_PATCH_CAS_MISMATCH');
 const out=clone(snapshot);
 for(const op of patch.operations){const m=out.modules.find(m=>m.id===op.moduleId);if(!m)fail('MAKE_REAL_ACCEPTANCE_PATCH_INVALID');
  if(op.op==='module_move'){const keys=['root','follows','parent'].filter(k=>Object.hasOwn(op,k));if(keys.length!==1)fail('MAKE_REAL_ACCEPTANCE_PATCH_INVALID');for(const k of ['root','follows','parent'])delete m[k];m[keys[0]]=clone(op[keys[0]]);}
  else if(op.op==='module_config_set'&&plain(op.config))m.config=clone(op.config);
  else if(op.op==='filter_set'&&op.remove===true&&!Object.hasOwn(op,'filter'))delete m.filter;
  else if(op.op==='filter_set'&&plain(op.filter)&&!Object.hasOwn(op,'remove'))m.filter=clone(op.filter);
  else if(op.op==='module_disabled_set'&&OFF.includes(m.id)&&op.disabled===true)m.disabled=true;
  else fail('MAKE_REAL_ACCEPTANCE_PATCH_INVALID');
 }
 out.interface=clone(patch.interface);requiredScenario(out);
 if(snapshotDigest(out)!==patch.expectedAfterSnapshotSha256)fail('MAKE_REAL_ACCEPTANCE_PATCH_RESULT_MISMATCH');return out;
}
function prepareInversePatch(stage,current,expectedLastEdit){
 if(!plain(stage)||snapshotDigest(stage.before)!==stage.before_sha256||snapshotDigest(stage.after)!==stage.after_sha256||!equal(stage.allowed_changes,changes(stage.before,stage.after)))fail('MAKE_REAL_ACCEPTANCE_STAGE_CORRUPT');
 requiredScenario(current);
 if(!stamp(expectedLastEdit)||current.lastEdit!==expectedLastEdit||withoutClock(current)!==withoutClock(stage.after))fail('MAKE_REAL_ACCEPTANCE_INVERSE_CAS_MISMATCH');
 const target=clone(stage.before);target.lastEdit=current.lastEdit;
 return {...patchFor(current,target),restore_snapshot:clone(stage.before)};
}
module.exports={prepareRealAcceptanceStage,snapshotDigest,applyStagePatch,prepareInversePatch,normalizeInstalledSnapshot};
