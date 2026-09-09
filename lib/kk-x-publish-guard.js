'use strict';
const crypto=require('crypto');
const {evidenceTrue,evidenceTimestamp}=require('./kk-evidence-validation');

/**
 * Final X provider boundary.
 * Authorization and provider verification are intentionally separate so a
 * local/synthetic PASS can never be promoted to provider PUBLISHED.
 */
function text(v){ return String(v == null ? '' : v).trim(); }
const asTrue=evidenceTrue;
function sha256(v){ return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function isSha256(v){ return /^[a-f0-9]{64}$/i.test(text(v)); }
function canonicalXPost(postId,postUrl){
  const id=text(postId), raw=text(postUrl);
  if(!id || !raw) throw new Error('provider post_id and post_url required');
  let u;
  try{ u=new URL(raw); }catch(_){ throw new Error('provider post_url invalid'); }
  if(u.protocol!=='https:' || u.hostname.toLowerCase()!=='x.com' || u.username || u.password || u.port) throw new Error('provider post_url must be canonical x.com HTTPS URL');
  const m=u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]+)\/?$/);
  if(!m) throw new Error('provider post_url must match /<account>/status/<post_id>');
  if(m[2]!==id) throw new Error('provider post_url/post_id mismatch');
  if(u.search || u.hash) throw new Error('provider post_url must not contain query/hash');
  return {post_id:id,post_url:`https://x.com/${m[1]}/status/${id}`,account:m[1]};
}
function publishScope(input){
  const c=input.content||{}, a=input.creative_binding||{};
  const versionId=text(c.version_id), fp=text(c.approval_fingerprint), body=c.selected_body;
  const creativeHash=text(a.creative_hash).toLowerCase();
  const sourceHash=text(a.source_asset_hash).toLowerCase();
  const canvaId=text(a.canva_design_id);
  const account=text(input.target_account).replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_]{1,15}$/.test(account)) throw new Error('target_account required and must be a valid X handle');
  if(!versionId || !fp || typeof body!=='string' || !body.trim()) throw new Error('approved version/fingerprint/body required');
  if(!isSha256(fp)) throw new Error('approval_fingerprint must be SHA-256');
  if(!isSha256(creativeHash)) throw new Error('creative_hash must be SHA-256');
  if(!isSha256(sourceHash)) throw new Error('source_asset_hash must be SHA-256');
  if(!canvaId) throw new Error('canva_design_id required');
  const exactTextSha256=sha256(body);
  const scope={target_account:account,content_version_id:versionId,approval_fingerprint:fp.toLowerCase(),exact_text_sha256:exactTextSha256,creative_hash:creativeHash,source_asset_hash:sourceHash,canva_design_id:canvaId};
  return {...scope,publish_scope_fingerprint:sha256(JSON.stringify(scope)),exact_text:body};
}
function authorizeXPublish(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  const c=input.content||{}, a=input.creative_binding||{};
  if(text(c.status)!=='APPROVED') throw new Error('content must be APPROVED');
  if(!asTrue(c.external_send_authorized)) throw new Error('EXTERNAL_SEND_AUTHORIZED must be true');
  if(!asTrue(c.production_publish_authorized)) throw new Error('PRODUCTION_PUBLISH_AUTHORIZED must be true');
  if(text(a.status)!=='CREATIVE_BOUND_READY') throw new Error('creative binding not ready');
  const scope=publishScope(input);
  if(text(a.content_version_id)!==scope.content_version_id) throw new Error('creative/content version mismatch');
  if(text(a.approval_fingerprint).toLowerCase()!==scope.approval_fingerprint) throw new Error('creative/content fingerprint mismatch');
  const bindingTextHash=text(a.selected_body_sha256).toLowerCase();
  if(!isSha256(bindingTextHash) || bindingTextHash!==scope.exact_text_sha256) throw new Error('creative/content exact body hash mismatch');
  const key=text(input.idempotency_key);
  if(!key) throw new Error('idempotency_key required');
  if(!Array.isArray(input.prior_publish_records)) throw new Error('prior publish records readback required, including explicit empty result');
  const prior=input.prior_publish_records.filter(r=>text(r.idempotency_key)===key || text(r.publish_scope_fingerprint)===scope.publish_scope_fingerprint);
  if(prior.length>1) throw new Error('publish idempotency conflict');
  if(prior.length===1){
    const p=prior[0];
    const priorScope=text(p.publish_scope_fingerprint);
    if(!priorScope) throw new Error('prior publish record missing scope fingerprint; reconcile before retry');
    if(priorScope!==scope.publish_scope_fingerprint) throw new Error('publish idempotency scope mismatch');
    const receipt=canonicalXPost(p.post_id,p.post_url);
    if(receipt.account.toLowerCase()!==scope.target_account) throw new Error('prior provider account mismatch');
    if(!text(p.provider_evidence_ref)) throw new Error('prior publish record missing provider evidence');
    return {decision:'DUPLICATE_NO_PUBLISH',idempotency_key:key,publish_scope_fingerprint:scope.publish_scope_fingerprint,post_id:receipt.post_id,post_url:receipt.post_url,provider_evidence_ref:text(p.provider_evidence_ref)};
  }
  return {
    decision:'PUBLISH_AUTHORIZED',
    target_account:scope.target_account,
    idempotency_key:key,
    publish_scope_fingerprint:scope.publish_scope_fingerprint,
    content_version_id:scope.content_version_id,
    approval_fingerprint:scope.approval_fingerprint,
    exact_text:scope.exact_text,
    exact_text_sha256:scope.exact_text_sha256,
    creative_hash:scope.creative_hash,
    canva_design_id:scope.canva_design_id,
    source_asset_hash:scope.source_asset_hash,
    provider_write_required:true
  };
}
function verifyProviderPublish(request,response){
  if(!request || request.decision!=='PUBLISH_AUTHORIZED') throw new Error('authorized publish request required');
  if(!response || response.ok!==true) throw new Error('provider acknowledgment required');
  const receipt=canonicalXPost(response.post_id,response.post_url);
  if(!text(request.target_account) || receipt.account.toLowerCase()!==request.target_account) throw new Error('provider account readback mismatch');
  const received=text(response.received_at);
  if(!evidenceTimestamp(received)) throw new Error('provider received_at invalid');
  const evidence=text(response.provider_evidence_ref);
  if(!evidence) throw new Error('provider_evidence_ref required');
  const providerTextHash=text(response.exact_text_sha256).toLowerCase();
  const providerCreativeHash=text(response.creative_hash).toLowerCase();
  if(!isSha256(providerTextHash)) throw new Error('provider exact_text_sha256 required');
  if(!isSha256(providerCreativeHash)) throw new Error('provider creative_hash required');
  if(providerTextHash!==text(request.exact_text_sha256).toLowerCase()) throw new Error('provider text readback hash mismatch');
  if(providerCreativeHash!==text(request.creative_hash).toLowerCase()) throw new Error('provider creative readback hash mismatch');
  return {
    status:'PUBLISHED',
    target_account:request.target_account,
    idempotency_key:request.idempotency_key,
    publish_scope_fingerprint:request.publish_scope_fingerprint,
    content_version_id:request.content_version_id,
    approval_fingerprint:request.approval_fingerprint,
    exact_text_sha256:request.exact_text_sha256,
    creative_hash:request.creative_hash,
    source_asset_hash:request.source_asset_hash,
    canva_design_id:request.canva_design_id,
    post_id:receipt.post_id,
    post_url:receipt.post_url,
    provider_received_at:received,
    provider_evidence_ref:evidence
  };
}
module.exports={authorizeXPublish,verifyProviderPublish};
