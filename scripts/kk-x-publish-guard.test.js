'use strict';
const assert=require('assert');
const crypto=require('crypto');
const {authorizeXPublish,verifyProviderPublish}=require('../lib/kk-x-publish-guard');
const h=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
function fixture(overrides={}){
  const body='exact approved body';
  const base={
    content:{status:'APPROVED',version_id:'CONTENT|NONT|V2',approval_fingerprint:'a'.repeat(64),selected_body:body,external_send_authorized:true,production_publish_authorized:true},
    creative_binding:{status:'CREATIVE_BOUND_READY',content_version_id:'CONTENT|NONT|V2',approval_fingerprint:'a'.repeat(64),creative_hash:'c'.repeat(64),canva_design_id:'DA_TEST',source_asset_hash:'b'.repeat(64)},
    idempotency_key:'X|CONTENT|NONT|V2|1',prior_publish_records:[]
  };
  return {...base,...overrides};
}
let count=0;function test(name,fn){fn();count++;}
test('pass authorize',()=>{const o=authorizeXPublish(fixture());assert.equal(o.decision,'PUBLISH_AUTHORIZED');assert.equal(o.exact_text,'exact approved body');assert.equal(o.exact_text_sha256,h('exact approved body'));assert.match(o.publish_scope_fingerprint,/^[a-f0-9]{64}$/);});
test('external flag',()=>{const x=fixture();x.content={...x.content,external_send_authorized:false};assert.throws(()=>authorizeXPublish(x),/EXTERNAL_SEND_AUTHORIZED/);});
test('production flag',()=>{const x=fixture();x.content={...x.content,production_publish_authorized:false};assert.throws(()=>authorizeXPublish(x),/PRODUCTION_PUBLISH_AUTHORIZED/);});
test('creative status',()=>{const x=fixture();x.creative_binding={...x.creative_binding,status:'DRAFT'};assert.throws(()=>authorizeXPublish(x),/binding not ready/);});
test('version exact',()=>{const x=fixture();x.creative_binding={...x.creative_binding,content_version_id:'V1'};assert.throws(()=>authorizeXPublish(x),/version mismatch/);});
test('fingerprint exact',()=>{const x=fixture();x.creative_binding={...x.creative_binding,approval_fingerprint:'d'.repeat(64)};assert.throws(()=>authorizeXPublish(x),/fingerprint mismatch/);});
test('approval hash required',()=>{const x=fixture();x.content={...x.content,approval_fingerprint:'bad'};assert.throws(()=>authorizeXPublish(x),/approval_fingerprint/);});
test('creative hash required',()=>{const x=fixture();x.creative_binding={...x.creative_binding,creative_hash:''};assert.throws(()=>authorizeXPublish(x),/creative_hash/);});
test('source hash required',()=>{const x=fixture();x.creative_binding={...x.creative_binding,source_asset_hash:''};assert.throws(()=>authorizeXPublish(x),/source_asset_hash/);});
test('canva id required',()=>{const x=fixture();x.creative_binding={...x.creative_binding,canva_design_id:''};assert.throws(()=>authorizeXPublish(x),/canva_design_id/);});
test('prior duplicate same scope',()=>{const x=fixture();const req=authorizeXPublish(x);x.prior_publish_records=[{idempotency_key:x.idempotency_key,publish_scope_fingerprint:req.publish_scope_fingerprint,post_id:'123',post_url:'https://x.com/kk/status/123',provider_evidence_ref:'XPROVIDER|123'}];const o=authorizeXPublish(x);assert.equal(o.decision,'DUPLICATE_NO_PUBLISH');assert.equal(o.post_url,'https://x.com/kk/status/123');});
test('prior scope fingerprint required',()=>{const x=fixture({prior_publish_records:[{idempotency_key:'X|CONTENT|NONT|V2|1',post_id:'123',post_url:'https://x.com/kk/status/123',provider_evidence_ref:'XPROVIDER|123'}]});assert.throws(()=>authorizeXPublish(x),/missing scope fingerprint/);});
test('prior scope mismatch',()=>{const x=fixture({prior_publish_records:[{idempotency_key:'X|CONTENT|NONT|V2|1',publish_scope_fingerprint:'f'.repeat(64),post_id:'123',post_url:'https://x.com/kk/status/123',provider_evidence_ref:'XPROVIDER|123'}]});assert.throws(()=>authorizeXPublish(x),/scope mismatch/);});
test('prior evidence required',()=>{const x=fixture();const req=authorizeXPublish(x);x.prior_publish_records=[{idempotency_key:x.idempotency_key,publish_scope_fingerprint:req.publish_scope_fingerprint,post_id:'123',post_url:'https://x.com/kk/status/123'}];assert.throws(()=>authorizeXPublish(x),/missing provider evidence/);});
test('provider receipt pass',()=>{const req=authorizeXPublish(fixture());const o=verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'XPROVIDER|123',exact_text_sha256:req.exact_text_sha256,creative_hash:req.creative_hash});assert.equal(o.status,'PUBLISHED');assert.equal(o.post_id,'123');});
test('provider ack',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:false}),/acknowledgment/);});
test('canonical host',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://twitter.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'e',exact_text_sha256:req.exact_text_sha256,creative_hash:req.creative_hash}),/canonical x.com/);});
test('post id URL match',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/999',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'e',exact_text_sha256:req.exact_text_sha256,creative_hash:req.creative_hash}),/post_url\/post_id mismatch/);});
test('provider evidence explicit',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'',exact_text_sha256:req.exact_text_sha256,creative_hash:req.creative_hash}),/provider_evidence_ref/);});
test('text hash match',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'e',exact_text_sha256:'d'.repeat(64),creative_hash:req.creative_hash}),/text readback hash mismatch/);});
test('creative hash match',()=>{const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'e',exact_text_sha256:req.exact_text_sha256,creative_hash:'d'.repeat(64)}),/creative readback hash mismatch/);});
console.log(`kk-x-publish-guard: ${count}/${count} PASS`);
