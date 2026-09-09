'use strict';
const crypto=require('crypto');

/**
 * Exact approved-content -> creative binding gate.
 * A creative is publish-eligible only when it is bound to the exact approved
 * content version/fingerprint/body and to a verifiable official/authorized
 * source asset hash. Generic/unverified placeholder art is not sufficient.
 */
function text(v){ return String(v == null ? '' : v).trim(); }
function bool(v){ return v===true || (typeof v==='string' && v.toLowerCase()==='true'); }
function sha256(v, field){ const s=text(v).toLowerCase(); if(!/^[a-f0-9]{64}$/.test(s)) throw new Error(`${field} must be sha256 hex`); return s; }
function hashText(v){ return crypto.createHash('sha256').update(String(v)).digest('hex'); }
const AUTHORITIES=new Set(['OFFICIAL_EVENT','OFFICIAL_ARTIST','OFFICIAL_ORGANIZER','AUTHORIZED_TICKET_SOURCE']);

function bindCreative(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  const c=input.approved_content||{};
  const a=input.creative_asset||{};
  if(text(c.status)!=='APPROVED') throw new Error('content must be APPROVED');
  const versionId=text(c.version_id), fp=sha256(c.approval_fingerprint,'approval_fingerprint'), body=c.selected_body;
  if(!versionId || typeof body!=='string' || !body.trim()) throw new Error('approved version_id and selected_body required');
  const selectedBodyHash=hashText(body);
  if(text(a.content_version_id)!==versionId) throw new Error('creative content version mismatch');
  if(sha256(a.approval_fingerprint,'creative.approval_fingerprint')!==fp) throw new Error('creative approval fingerprint mismatch');
  if(sha256(a.selected_body_sha256,'creative.selected_body_sha256')!==selectedBodyHash) throw new Error('creative selected body hash mismatch');
  const sourceAuthority=text(a.source_authority).toUpperCase();
  if(!AUTHORITIES.has(sourceAuthority)) throw new Error('creative source authority is not sufficient');
  const sourceRef=text(a.source_asset_ref);
  if(!sourceRef) throw new Error('source_asset_ref required');
  const sourceHash=sha256(a.source_asset_hash,'source_asset_hash');
  const creativeHash=sha256(a.creative_hash,'creative_hash');
  const designId=text(a.canva_design_id);
  if(!designId) throw new Error('canva_design_id required');
  if(bool(a.placeholder_or_generic)) throw new Error('placeholder/generic creative is not publish eligible');
  const sourceEvidenceRef=text(a.source_evidence_ref);
  if(!sourceEvidenceRef) throw new Error('source_evidence_ref required');
  return {
    status:'CREATIVE_BOUND_READY',
    content_version_id:versionId,
    approval_fingerprint:fp,
    selected_body:body,
    selected_body_sha256:selectedBodyHash,
    source_authority:sourceAuthority,
    source_asset_ref:sourceRef,
    source_asset_hash:sourceHash,
    source_evidence_ref:sourceEvidenceRef,
    canva_design_id:designId,
    canva_page_ref:text(a.canva_page_ref)||null,
    creative_hash:creativeHash,
    binding_fingerprint:hashText(JSON.stringify({version_id:versionId,approval_fingerprint:fp,selected_body_sha256:selectedBodyHash,source_asset_hash:sourceHash,creative_hash:creativeHash,canva_design_id:designId})),
    write_boundary:'NO_PROVIDER_PUBLISH'
  };
}
module.exports={bindCreative};
