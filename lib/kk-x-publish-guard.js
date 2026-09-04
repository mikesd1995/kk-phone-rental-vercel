'use strict';

/**
 * Final X provider boundary.
 * Authorization and provider verification are intentionally separate so a
 * local/synthetic PASS can never be promoted to provider PUBLISHED.
 */
function text(v){ return String(v == null ? '' : v).trim(); }
function asTrue(v){ return v===true || String(v).toLowerCase()==='true'; }
function authorizeXPublish(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  const c=input.content||{}, a=input.creative_binding||{};
  if(text(c.status)!=='APPROVED') throw new Error('content must be APPROVED');
  if(!asTrue(c.external_send_authorized)) throw new Error('EXTERNAL_SEND_AUTHORIZED must be true');
  if(!asTrue(c.production_publish_authorized)) throw new Error('PRODUCTION_PUBLISH_AUTHORIZED must be true');
  if(text(a.status)!=='CREATIVE_BOUND_READY') throw new Error('creative binding not ready');
  const versionId=text(c.version_id), fp=text(c.approval_fingerprint), body=text(c.selected_body);
  if(!versionId || !fp || !body) throw new Error('approved version/fingerprint/body required');
  if(text(a.content_version_id)!==versionId) throw new Error('creative/content version mismatch');
  if(text(a.approval_fingerprint)!==fp) throw new Error('creative/content fingerprint mismatch');
  const creativeHash=text(a.creative_hash);
  if(!creativeHash) throw new Error('creative_hash required');
  const key=text(input.idempotency_key);
  if(!key) throw new Error('idempotency_key required');
  const prior=(input.prior_publish_records||[]).filter(r=>text(r.idempotency_key)===key);
  if(prior.length>1) throw new Error('publish idempotency conflict');
  if(prior.length===1){
    const p=prior[0];
    if(!text(p.post_id) || !text(p.post_url)) throw new Error('prior publish record missing provider evidence');
    return {decision:'DUPLICATE_NO_PUBLISH',idempotency_key:key,post_id:text(p.post_id),post_url:text(p.post_url)};
  }
  return {
    decision:'PUBLISH_AUTHORIZED',
    idempotency_key:key,
    content_version_id:versionId,
    approval_fingerprint:fp,
    exact_text:body,
    creative_hash:creativeHash,
    canva_design_id:text(a.canva_design_id),
    source_asset_hash:text(a.source_asset_hash),
    provider_write_required:true
  };
}
function verifyProviderPublish(request,response){
  if(!request || request.decision!=='PUBLISH_AUTHORIZED') throw new Error('authorized publish request required');
  if(!response || response.ok!==true) throw new Error('provider acknowledgment required');
  const postId=text(response.post_id), postUrl=text(response.post_url), received=text(response.received_at);
  if(!postId || !postUrl) throw new Error('provider post_id and post_url required');
  if(!Number.isFinite(Date.parse(received))) throw new Error('provider received_at invalid');
  return {
    status:'PUBLISHED',
    idempotency_key:request.idempotency_key,
    content_version_id:request.content_version_id,
    approval_fingerprint:request.approval_fingerprint,
    creative_hash:request.creative_hash,
    post_id:postId,
    post_url:postUrl,
    provider_received_at:received,
    provider_evidence_ref:text(response.provider_evidence_ref)||`X_PROVIDER|${postId}`
  };
}
module.exports={authorizeXPublish,verifyProviderPublish};
