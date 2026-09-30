'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Tee=require('../server/kk-line-inbox-tee.js');

function msg(id,user='U1',text='hello'){
 return {type:'message',webhookEventId:id,timestamp:1790726400000,source:{type:'user',userId:user},message:{id:'provider-'+id,type:'text',text}};
}
test('verified tee is disabled safely without a durable store',async()=>{
 const r=await Tee.persistVerifiedEvents([msg('e1')]);
 assert.equal(r.status,'DISABLED_NO_STORE'); assert.equal(r.writes,0);
});
test('verified tee preserves idempotent duplicate receipts',async()=>{
 const seen=[];
 const r=await Tee.persistVerifiedEvents([msg('e1'),msg('e1')],async m=>{seen.push(m);return {duplicate:seen.length>1};});
 assert.equal(r.writes,1); assert.equal(r.duplicates,1); assert.equal(r.errors.length,0);
 assert.equal(seen[0].external_message_id,'e1');
});
test('one malformed event does not poison valid verified events',async()=>{
 const r=await Tee.persistVerifiedEvents([
  {type:'message',webhookEventId:'bad',source:{},message:{id:'bad',type:'text',text:'bad'}},
  msg('good')
 ],async()=>({duplicate:false}));
 assert.equal(r.writes,1); assert.equal(r.skipped,1); assert.equal(r.errors.length,0);
});
test('persistence failure is isolated and later events continue',async()=>{
 let n=0;
 const r=await Tee.persistVerifiedEvents([msg('e1'),msg('e2')],async()=>{n++;if(n===1)throw Object.assign(new Error('db down'),{code:'INBOX_PERSISTENCE_FAILED'});return {duplicate:false};});
 assert.equal(r.status,'PARTIAL'); assert.equal(r.writes,1); assert.equal(r.errors.length,1);
 assert.equal(r.errors[0].code,'INBOX_PERSISTENCE_FAILED');
});
