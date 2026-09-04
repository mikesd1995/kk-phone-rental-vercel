'use strict';
const assert=require('assert');
const {bindCreative}=require('../lib/kk-creative-binding-guard');
const FP='a'.repeat(64), SRC='b'.repeat(64), CRE='c'.repeat(64);
function fixture(overrides={}){
  const base={
    approved_content:{status:'APPROVED',version_id:'CONTENT|NONT|V2',approval_fingerprint:FP,selected_body:'exact approved body'},
    creative_asset:{content_version_id:'CONTENT|NONT|V2',approval_fingerprint:FP,source_authority:'OFFICIAL_EVENT',source_asset_ref:'https://official.example/poster.jpg',source_asset_hash:SRC,canva_design_id:'DA_TEST',canva_page_ref:'1',creative_hash:CRE,placeholder_or_generic:false}
  };
  return {...base,...overrides};
}
(function pass(){const o=bindCreative(fixture());assert.equal(o.status,'CREATIVE_BOUND_READY');assert.equal(o.content_version_id,'CONTENT|NONT|V2');assert.equal(o.write_boundary,'NO_PROVIDER_PUBLISH');})();
(function approvedOnly(){const x=fixture();x.approved_content={...x.approved_content,status:'DRAFT'};assert.throws(()=>bindCreative(x),/must be APPROVED/);})();
(function versionExact(){const x=fixture();x.creative_asset={...x.creative_asset,content_version_id:'V1'};assert.throws(()=>bindCreative(x),/version mismatch/);})();
(function fingerprintExact(){const x=fixture();x.creative_asset={...x.creative_asset,approval_fingerprint:'d'.repeat(64)};assert.throws(()=>bindCreative(x),/fingerprint mismatch/);})();
(function officialSourceOnly(){const x=fixture();x.creative_asset={...x.creative_asset,source_authority:'FAN_POST'};assert.throws(()=>bindCreative(x),/authority is not sufficient/);})();
(function hashRequired(){const x=fixture();x.creative_asset={...x.creative_asset,source_asset_hash:'bad'};assert.throws(()=>bindCreative(x),/sha256 hex/);})();
(function canvaRequired(){const x=fixture();x.creative_asset={...x.creative_asset,canva_design_id:''};assert.throws(()=>bindCreative(x),/canva_design_id required/);})();
(function genericBlocked(){const x=fixture();x.creative_asset={...x.creative_asset,placeholder_or_generic:true};assert.throws(()=>bindCreative(x),/placeholder\/generic/);})();
console.log('kk-creative-binding-guard: 8/8 PASS');
