'use strict';
// Pure serializer for the connector contract confirmed on 6176241 while OFF.
// It does not install, run, authenticate, generate a round, or grant send rights.
const {isDeepStrictEqual:equal}=require('node:util');
const Stage=require('./make-owner-canonical-real-acceptance-stage');
const OFF=[8,26,31,27,28,11,12,29,13,30,25];
const IDS=[5,6,8,9,10,...OFF.filter(id=>id!==8)];
function fail(){throw Object.assign(new Error('MAKE_CONNECTOR_PATCH_INVALID'),{code:'MAKE_CONNECTOR_PATCH_INVALID'});}
function exact(o,keys){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&equal(Reflect.ownKeys(o).sort(),keys.slice().sort());}
function serializeOperation(o){
 if(!o||typeof o!=='object'||!Number.isSafeInteger(o.moduleId))fail();
 if(o.op==='module_move'){
  const edge=['root','follows','parent'].filter(k=>Object.hasOwn(o,k));
  if(![6,26].includes(o.moduleId)||edge.length!==1||!exact(o,['op','moduleId',edge[0]]))fail();
  return structuredClone(o);
 }
 if(o.op==='module_config_set'){
  if(o.moduleId!==26||!exact(o,['op','moduleId','config']))fail();
  return structuredClone(o);
 }
 if(o.op==='filter_set'){
  if(![26,31,11].includes(o.moduleId))fail();
  if(o.remove===true&&exact(o,['op','moduleId','remove']))return {op:'filter_set',moduleId:o.moduleId,filter:{}};
  if(!exact(o,['op','moduleId','filter'])||!o.filter||typeof o.filter!=='object'||Array.isArray(o.filter)||Object.keys(o.filter).length===0)fail();
  return structuredClone(o);
 }
 if(o.op==='module_disabled_set'&&exact(o,['op','moduleId','disabled'])&&OFF.includes(o.moduleId)&&o.disabled===true)return structuredClone(o);
 fail();
}
function toConnectorRequest(snapshot,patch){
 if(!patch||!Array.isArray(patch.operations))fail();
 // Retain the compiler's exact before/after fingerprints and local CAS check.
 const operations=patch.operations.map(serializeOperation);
 const disabledIds=operations.filter(o=>o.op==='module_disabled_set').map(o=>o.moduleId);
 if(!equal(disabledIds.slice().sort((a,b)=>a-b),OFF.slice().sort((a,b)=>a-b)))fail();
 const after=Stage.applyStagePatch(snapshot,patch);
 if(after.active!==false||after.incompleteExecutions!==0||after.modules.length!==15||
  !equal(after.modules.map(m=>m.id).sort((a,b)=>a-b),IDS.slice().sort((a,b)=>a-b))||
  OFF.some(id=>after.modules.find(m=>m.id===id)?.disabled!==true)||
  !equal(after.trigger,snapshot.trigger)||!equal(after.settings,snapshot.settings))fail();
 // The connector wants interface_set inside the same atomic composed request.
 // Local filter remove intent is represented by an empty filter, not remove:true.
 return {scenarioId:6176241,expectedLastEdit:patch.expectedLastEdit,
  operations:[{op:'interface_set',interface:structuredClone(after.interface)},...operations]};
}
module.exports={toConnectorRequest};
