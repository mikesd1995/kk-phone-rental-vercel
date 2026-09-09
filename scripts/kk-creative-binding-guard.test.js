'use strict';
const assert=require('assert');
const crypto=require('crypto');
const {bindCreative}=require('../lib/kk-creative-binding-guard');
const FP='a'.repeat(64), SRC='b'.repeat(64), CRE='c'.repeat(64), BODY='exact approved body';
const BODY_HASH=crypto.createHash('sha256').update(BODY).digest('hex');
function fixture(overrides={}){
  const base={
    approved_content:{status:'APPROVED',version_id:'CONTENT|NONT|V2',approval_fingerprint:FP,selected_body:BODY},
    creative_asset:{content_version_id:'CONTENT|NONT|V2',approval_fingerprint:FP,selected_body_sha256:BODY_HASH,source_authority:'OFFICIAL_EVENT',source_asset_ref:'https://official.example/poster.jpg',source_asset_hash:SRC,source_evidence_ref:'EVIDENCE|OFFICIAL|POSTER|001',canva_design_id:'DA_TEST',canva_page_ref:'1',creative_hash:CRE,placeholder_or_generic:false}
  };
  return {...base,...overrides};
}
let n=0;function test(name,fn){fn();n++;}
test('pass',()=>{const o=bindCreative(fixture());assert.equal(o.status,'CREATIVE_BOUND_READY');assert.equal(o.content_version_id,'CONTENT|NONT|V2');assert.equal(o.selected_body_sha256,BODY_HASH);assert.equal(o.source_evidence_ref,'EVIDENCE|OFFICIAL|POSTER|001');assert.match(o.binding_fingerprint,/^[a-f0-9]{64}$/);assert.equal(o.write_boundary,'NO_PROVIDER_PUBLISH');});
test('approved only',()=>{const x=fixture();x.approved_content={...x.approved_content,status:'DRAFT'};assert.throws(()=>bindCreative(x),/must be APPROVED/);});
test('version exact',()=>{const x=fixture();x.creative_asset={...x.creative_asset,content_version_id:'V1'};assert.throws(()=>bindCreative(x),/version mismatch/);});
test('fingerprint exact',()=>{const x=fixture();x.creative_asset={...x.creative_asset,approval_fingerprint:'d'.repeat(64)};assert.throws(()=>bindCreative(x),/fingerprint mismatch/);});
test('body hash required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,selected_body_sha256:''};assert.throws(()=>bindCreative(x),/selected_body_sha256/);});
test('body hash exact',()=>{const x=fixture();x.creative_asset={...x.creative_asset,selected_body_sha256:'d'.repeat(64)};assert.throws(()=>bindCreative(x),/body hash mismatch/);});
test('official source only',()=>{const x=fixture();x.creative_asset={...x.creative_asset,source_authority:'FAN_POST'};assert.throws(()=>bindCreative(x),/authority is not sufficient/);});
test('source ref required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,source_asset_ref:''};assert.throws(()=>bindCreative(x),/source_asset_ref required/);});
test('source evidence required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,source_evidence_ref:''};assert.throws(()=>bindCreative(x),/source_evidence_ref required/);});
test('source hash required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,source_asset_hash:'bad'};assert.throws(()=>bindCreative(x),/sha256 hex/);});
test('creative hash required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,creative_hash:'bad'};assert.throws(()=>bindCreative(x),/sha256 hex/);});
test('canva required',()=>{const x=fixture();x.creative_asset={...x.creative_asset,canva_design_id:''};assert.throws(()=>bindCreative(x),/canva_design_id required/);});
test('generic blocked',()=>{const x=fixture();x.creative_asset={...x.creative_asset,placeholder_or_generic:true};assert.throws(()=>bindCreative(x),/placeholder\/generic/);});
test('body mutation invalidates binding',()=>{const x=fixture();x.approved_content={...x.approved_content,selected_body:'changed after approval'};assert.throws(()=>bindCreative(x),/body hash mismatch/);});
test('approved whitespace is part of the immutable creative lineage',()=>{
  const x=fixture();const body='  exact approved body\n';x.approved_content.selected_body=body;x.creative_asset.selected_body_sha256=crypto.createHash('sha256').update(body).digest('hex');
  assert.equal(bindCreative(x).selected_body,body);
});
console.log(`kk-creative-binding-guard: ${n}/${n} PASS`);
