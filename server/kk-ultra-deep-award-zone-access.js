'use strict';

// Award ceremonies can restrict the show floor while allowing a separate fan/red-carpet zone.
// Discovery is never permission to publish. All permissions are independent verified facts.
const VERSION='KK_AWARD_ZONE_ACCESS_GATE_V1';
function str(v){return String(v==null?'':v).trim();}
function isAwardLike(row={}){
 const identity=[row.title,row.event_name,row.event_type,row.event_category,row.source_tier].map(str).join(' ');
 return /\b(?:awards?|red[ -]?carpet)\b|ประกาศรางวัล|พรมแดง/i.test(identity);
}
function validHttps(value){
 try {
  const u=new URL(str(value));
  return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&!u.port&&
   !['localhost','127.0.0.1','::1'].includes(u.hostname.toLowerCase());
 } catch {return false;}
}
function evaluate(row={}){
 if(!isAwardLike(row))return {
  version:VERSION,requires_review:false,decision:'NOT_APPLICABLE',
  zone:'NOT_APPLICABLE',access_clearance:true,missing:[],production_writes:0
 };
 const proof=str(row.official_access_source_url);
 const cameraProof=str(row.official_camera_rules_source_url);
 const checks={
  red_carpet_public_access:row.red_carpet_public_access_verified===true,
  official_public_access_source:row.verified_official_access_source===true&&validHttps(proof),
  phone_photography_allowed:row.phone_photography_allowed_verified===true,
  external_lens_allowed:row.external_lens_allowed_verified===true,
  official_camera_rules_source:row.verified_official_camera_rules_source===true&&validHttps(cameraProof),
  not_owner_blocked:row.owner_hold!==true&&row.owner_hidden!==true&&row.tombstone_locked!==true
 };
 const missing=Object.entries(checks).filter(([,v])=>!v).map(([key])=>key);
 const ok=missing.length===0;
 return {
  version:VERSION,requires_review:true,
  decision:ok?'ZONE_ACCESS_VERIFIED':'VERIFY_ACCESS',
  // A red-carpet clearance never conveys access to the private ceremony.
  zone:checks.red_carpet_public_access?'PUBLIC_RED_CARPET':'PRIVATE_CEREMONY_OR_UNVERIFIED',
  ceremony_access_authorized:false,access_clearance:ok,
  missing,production_writes:0
 };
}
module.exports={VERSION,isAwardLike,validHttps,evaluate};
