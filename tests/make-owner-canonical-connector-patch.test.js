'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Stage=require('../server/make-owner-canonical-real-acceptance-stage');
const {toConnectorRequest}=require('../server/make-owner-canonical-connector-patch');
const {fixture,OFF}=require('./helpers/make-owner-real-stage-fixture');
function prepared(){const {snapshot,binding}=fixture();return {snapshot,stage:Stage.prepareRealAcceptanceStage(snapshot,binding)};}
function applyConnectorLocally(snapshot,request){
 const local={...request,expectedSnapshotSha256:Stage.snapshotDigest(snapshot),operations:[],interface:null};
 for(const op of request.operations){
  if(op.op==='interface_set'){assert.equal(local.interface,null);local.interface=op.interface;}
  else local.operations.push(op.op==='filter_set'&&Object.keys(op.filter).length===0?{op:'filter_set',moduleId:op.moduleId,remove:true}:op);
 }
 return local;
}
test('compiled forward uses exact observed connector contract and no side effects',()=>{
 const {snapshot,stage}=prepared(),copy=structuredClone(stage),before=structuredClone(snapshot),r=toConnectorRequest(snapshot,stage.patch);
 assert.deepEqual(Object.keys(r).sort(),['expectedLastEdit','operations','scenarioId']);
 assert.equal(r.scenarioId,6176241);assert.equal(r.expectedLastEdit,snapshot.lastEdit);
 assert.deepEqual(r.operations[0],{op:'interface_set',interface:stage.after.interface});
 assert.equal(r.operations.some(o=>Object.hasOwn(o,'remove')),false);
 assert.deepEqual(r.operations.filter(o=>o.op==='module_disabled_set').map(o=>o.moduleId),OFF);
 const local=applyConnectorLocally(snapshot,r);local.expectedAfterSnapshotSha256=stage.after_sha256;
 assert.deepEqual(Stage.applyStagePatch(snapshot,local),stage.after);
 assert.deepEqual(stage,copy);assert.deepEqual(snapshot,before);
});
test('inverse restores absent filters with empty objects and exact original interface',()=>{
 const {snapshot,stage}=prepared(),current={...structuredClone(stage.after),lastEdit:'2026-11-04T09:00:00.000Z'};
 const inverse=Stage.prepareInversePatch(stage,current,current.lastEdit),r=toConnectorRequest(current,inverse);
 assert.deepEqual(r.operations[0],{op:'interface_set',interface:snapshot.interface});
 assert.deepEqual(r.operations.filter(o=>o.op==='filter_set'&&Object.keys(o.filter).length===0).map(o=>o.moduleId),[26,31]);
 const local=applyConnectorLocally(current,r);local.expectedAfterSnapshotSha256=inverse.expectedAfterSnapshotSha256;
 assert.deepEqual(Stage.applyStagePatch(current,local),{...snapshot,lastEdit:current.lastEdit});
});
test('fresh before CAS and complete target fingerprints are required',()=>{
 for(const mutate of [p=>p.expectedLastEdit='2026-01-01T00:00:00.000Z',p=>p.expectedSnapshotSha256='0'.repeat(64),p=>p.expectedAfterSnapshotSha256='0'.repeat(64)]){
  const {snapshot,stage}=prepared();mutate(stage.patch);assert.throws(()=>toConnectorRequest(snapshot,stage.patch));
 }
});
test('dangerous fields and foreign ops cannot leak through serialization',()=>{
 const changes=[p=>p.operations[0].hook={},p=>p.operations.push({op:'scheduling_set',scheduling:{type:'daily'}}),p=>p.operations.push({op:'module_disabled_set',moduleId:11,disabled:false}),p=>p.operations.push({op:'module_disabled_set',moduleId:999,disabled:true}),p=>p.operations.push({op:'module_config_set',moduleId:11,config:{mapper:{}}}),p=>p.operations.push({op:'filter_set',moduleId:8,remove:true}),p=>p.operations.push({op:'filter_set',moduleId:31,remove:true,filter:{}})];
 for(const mutate of changes){const {snapshot,stage}=prepared();mutate(stage.patch);assert.throws(()=>toConnectorRequest(snapshot,stage.patch),/MAKE_CONNECTOR_PATCH_INVALID/);}
});
test('explicit local empty-filter intent is not confused with remove intent',()=>{
 const {snapshot,stage}=prepared();stage.patch.operations.push({op:'filter_set',moduleId:31,filter:{}});
 assert.throws(()=>toConnectorRequest(snapshot,stage.patch),/MAKE_CONNECTOR_PATCH_INVALID/);
});
test('unsupported scenario or missing operations fails closed',()=>{
 const {snapshot,stage}=prepared();assert.throws(()=>toConnectorRequest(snapshot,null));assert.throws(()=>toConnectorRequest(snapshot,{}));
 assert.throws(()=>toConnectorRequest(snapshot,{...stage.patch,scenarioId:1}));
});
test('every save explicitly reasserts each of the eleven OFF flags',()=>{
 const {snapshot,stage}=prepared();
 stage.patch.operations=stage.patch.operations.filter(o=>o.op!=='module_disabled_set');
 assert.throws(()=>toConnectorRequest(snapshot,stage.patch),/MAKE_CONNECTOR_PATCH_INVALID/);
});
test('duplicate OFF operations do not replace complete explicit OFF coverage',()=>{
 const {snapshot,stage}=prepared();stage.patch.operations.push({op:'module_disabled_set',moduleId:11,disabled:true});
 assert.throws(()=>toConnectorRequest(snapshot,stage.patch),/MAKE_CONNECTOR_PATCH_INVALID/);
});
