'use strict';
const assert=require('assert');
const {authorizeXPublish,verifyProviderPublish}=require('../lib/kk-x-publish-guard');
function fixture(overrides={}){
  const base={
    content:{status:'APPROVED',version_id:'CONTENT|NONT|V2',approval_fingerprint:'a'.repeat(64),selected_body:'exact approved body',external_send_authorized:true,production_publish_authorized:true},
    creative_binding:{status:'CREATIVE_BOUND_READY',content_version_id:'CONTENT|NONT|V2',approval_fingerprint:'a'.repeat(64),creative_hash:'c'.repeat(64),canva_design_id:'DA_TEST',source_asset_hash:'b'.repeat(64)},
    idempotency_key:'X|CONTENT|NONT|V2|1',prior_publish_records:[]
  };
  return {...base,...overrides};
}
(function pass(){const o=authorizeXPublish(fixture());assert.equal(o.decision,'PUBLISH_AUTHORIZED');assert.equal(o.exact_text,'exact approved body');})();
(function externalFlag(){const x=fixture();x.content={...x.content,external_send_authorized:false};assert.throws(()=>authorizeXPublish(x),/EXTERNAL_SEND_AUTHORIZED/);})();
(function productionFlag(){const x=fixture();x.content={...x.content,production_publish_authorized:false};assert.throws(()=>authorizeXPublish(x),/PRODUCTION_PUBLISH_AUTHORIZED/);})();
(function creativeRequired(){const x=fixture();x.creative_binding={...x.creative_binding,status:'DRAFT'};assert.throws(()=>authorizeXPublish(x),/binding not ready/);})();
(function versionExact(){const x=fixture();x.creative_binding={...x.creative_binding,content_version_id:'V1'};assert.throws(()=>authorizeXPublish(x),/version mismatch/);})();
(function fingerprintExact(){const x=fixture();x.creative_binding={...x.creative_binding,approval_fingerprint:'z'};assert.throws(()=>authorizeXPublish(x),/fingerprint mismatch/);})();
(function duplicate(){const x=fixture({prior_publish_records:[{idempotency_key:'X|CONTENT|NONT|V2|1',post_id:'123',post_url:'https://x.com/kk/status/123'}]});const o=authorizeXPublish(x);assert.equal(o.decision,'DUPLICATE_NO_PUBLISH');})();
(function priorWithoutEvidenceFails(){const x=fixture({prior_publish_records:[{idempotency_key:'X|CONTENT|NONT|V2|1'}]});assert.throws(()=>authorizeXPublish(x),/missing provider evidence/);})();
(function providerReceipt(){const req=authorizeXPublish(fixture());const o=verifyProviderPublish(req,{ok:true,post_id:'123',post_url:'https://x.com/kk/status/123',received_at:'2026-09-04T17:30:00+07:00',provider_evidence_ref:'XPROVIDER|123'});assert.equal(o.status,'PUBLISHED');assert.equal(o.post_id,'123');})();
(function providerMustAck(){const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:false}),/acknowledgment required/);})();
(function providerEvidenceRequired(){const req=authorizeXPublish(fixture());assert.throws(()=>verifyProviderPublish(req,{ok:true,post_id:'',post_url:'',received_at:'2026-09-04T17:30:00+07:00'}),/post_id and post_url required/);})();
console.log('kk-x-publish-guard: 11/11 PASS');
