'use strict';

// Owner-authorized poster-only workflow contract.
// Planning and acceptance here are deterministic/read-only; actual SOT mutation
// belongs to the authenticated connector/governed writer following the runbook.
const VERSION = 'KK_OWNER_POSTER_OPS_V1';
const ID = /^EVT-\d{8}-[A-Z0-9-]+$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{15,100}$/;
const isoDate = value => {
  const raw=String(value||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return '';
  let y=Number(m[3]); if(y>2500)y-=543;
  return String(y).padStart(4,'0')+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
};
const text = value => String(value==null?'':value).trim();
function canonicalPoster(fileId) {
  if(!DRIVE_ID.test(text(fileId)))return '';
  return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(text(fileId))+'&sz=w1200';
}
function posterFileId(url){
  const s=text(url);
  const m=s.match(/[?&]id=([A-Za-z0-9_-]{15,100})(?:&|$)/)
   || s.match(/\/file\/d\/([A-Za-z0-9_-]{15,100})(?:\/|$)/);
  return m?m[1]:'';
}
function findExact(rows,id){
  const hits=(Array.isArray(rows)?rows:[]).filter(r=>text(r.event_id)===id);
  return hits.length===1?hits[0]:null;
}
// Strictly routes imperative owner poster requests, not questions/status checks.
function detectOwnerPosterRequest(message){
  const s=text(message).toLowerCase(); // Preserve Thai vowel code points: NFKC breaks literal intent phrases.
  if(!s||/(ไม่ต้อง|อย่า|ห้าม).{0,20}(เปลี่ยน|แก้|อัปเดต|อัพเดต|ใส่|รูป|โปสเตอร์)/.test(s))return false;
  if(/(ควร|ดีไหม|หรือยัง|เปลี่ยนแล้ว|สำเร็จไหม|why|should|how to)/.test(s))return false;
  const action=/(เปลี่ยน|แก้|อัปเดต|อัพเดต|อัพเดท|ใส่|replace|update|swap|change)/.test(s);
  const media=/(โปสเตอร์|รูป|ภาพ|poster|artwork|image)/.test(s);
  const unrelated=/(ทวิตเตอร์|twitter|โพสต์บน x|โพสลง x)/.test(s)&&!/(หน้าบ้าน|หน้าเว็บ|storefront)/.test(s);
  return action&&media&&!unrelated;
}
function validateTargets(input={}){
  const targets=Array.isArray(input.targets)?input.targets:[];
  const core=Array.isArray(input.core_events)?input.core_events:[];
  const blockers=[];
  if(!input.owner_authorized)blockers.push('OWNER_AUTHORIZATION_REQUIRED');
  if(!targets.length)blockers.push('NO_TARGETS');
  const seen=new Set();
  const plans=targets.map((target,index)=>{
    const eventId=text(target.event_id);
    const date=isoDate(target.event_date);
    const row=findExact(core,eventId);
    const prefix='TARGET_'+(index+1)+'_';
    if(!ID.test(eventId))blockers.push(prefix+'INVALID_EVENT_ID');
    if(seen.has(eventId))blockers.push(prefix+'DUPLICATE_EVENT_ID');
    seen.add(eventId);
    if(!date||!eventId.includes(date.replace(/-/g,'')))blockers.push(prefix+'DATE_IDENTITY_MISMATCH');
    if(!row)blockers.push(prefix+'EXACT_CORE_ROW_REQUIRED');
    if(row&&isoDate(row.event_date)!==date)blockers.push(prefix+'CORE_DATE_MISMATCH');
    if(!text(target.uploaded_image_ref)&&!text(target.drive_file_id))blockers.push(prefix+'IMAGE_REQUIRED');
    if(target.drive_file_id&&!DRIVE_ID.test(text(target.drive_file_id)))blockers.push(prefix+'INVALID_DRIVE_FILE_ID');
    if(target.drive_file_id&&row&&posterFileId(row.poster_image_url)===text(target.drive_file_id))blockers.push(prefix+'REUSE_OLD_DRIVE_ID_FORBIDDEN');
    if(target.drive_file_id&&target.drive_access_verified!==true)blockers.push(prefix+'DRIVE_VISIBILITY_UNVERIFIED');
    const driveId=DRIVE_ID.test(text(target.drive_file_id))?text(target.drive_file_id):'';
    return {
      event_id:eventId,event_date:date,event_name:row?text(row.event_name):'',
      old_poster_url:row?text(row.poster_image_url):'',new_drive_file_id:driveId,
      new_poster_url:canonicalPoster(driveId),
      canonical_field:'01_Events.poster_image_url',
      derived_readback:'08_Web_Ready.poster_image_url'
    };
  });
  const missingMedia=plans.some(p=>!p.new_drive_file_id);
  const status=blockers.length?'BLOCKED_PRECONDITION':missingMedia?'AWAITING_IMMUTABLE_DRIVE_UPLOAD':'READY_FOR_OWNER_GOVERNED_POSTER_ONLY_WRITE';
  return {
    schema_version:VERSION,status,blockers,targets:plans,
    procedure:'docs/OWNER_POSTER_UPDATE_RUNBOOK.md',
    next_step:status==='AWAITING_IMMUTABLE_DRIVE_UPLOAD'
      ?'Upload supplied originals as NEW Drive files, verify file access, then re-run plan with fresh drive_file_id'
      :status==='READY_FOR_OWNER_GOVERNED_POSTER_ONLY_WRITE'
        ?'Use owner-authorized bounded writer/connector; change only exact 01_Events poster_image_url, then run readback acceptance'
        :'Resolve blocked identity/authority/media evidence before any write',
    safety:{agent_production_writes:0,price_writes:0,booking_writes:0,visibility_writes:0,inventory_writes:0,auto_deploy:false,auto_publish:false}
  };
}
function acceptReadback(input={}){
  const targets=Array.isArray(input.targets)?input.targets:[];
  const core=Array.isArray(input.core_events)?input.core_events:[];
  const ready=Array.isArray(input.web_ready)?input.web_ready:[];
  const feed=Array.isArray(input.production_feed)?input.production_feed:[];
  const visual=Array.isArray(input.visual_evidence)?input.visual_evidence:[];
  const issues=[],verified=[];
  if(!targets.length)issues.push('NO_TARGETS');
  for(const target of targets){
    const id=text(target.event_id), driveId=text(target.drive_file_id);
    const expect=canonicalPoster(driveId);
    const old=text(target.old_poster_url);
    const coreRow=findExact(core,id),webRow=findExact(ready,id),feedRow=findExact(feed,id);
    if(!ID.test(id)||!expect||!isoDate(target.event_date)||!id.includes(isoDate(target.event_date).replace(/-/g,'')))issues.push('INVALID_TARGET_'+id);
    if(!coreRow||!webRow)issues.push('MISSING_CANONICAL_READBACK_'+id);
    if(coreRow&&text(coreRow.poster_image_url)!==expect)issues.push('CORE_POSTER_MISMATCH_'+id);
    if(webRow&&text(webRow.poster_image_url)!==expect)issues.push('WEB_READY_POSTER_MISMATCH_'+id);
    if(old&&old===expect)issues.push('OLD_DRIVE_ID_REUSED_'+id);
    if(coreRow&&isoDate(coreRow.event_date)!==isoDate(target.event_date))issues.push('EVENT_DATE_CHANGED_'+id);
    if(coreRow&&target.event_name&&text(coreRow.event_name)!==text(target.event_name))issues.push('EVENT_NAME_CHANGED_'+id);
    if(coreRow&&target.venue!=null&&text(coreRow.venue)!==text(target.venue))issues.push('VENUE_CHANGED_'+id);
    if(coreRow&&target.event_status!=null&&text(coreRow.event_status)!==text(target.event_status))issues.push('EVENT_STATUS_CHANGED_'+id);
    if(coreRow&&target.active_on_web!=null&&String(coreRow.active_on_web)!==String(target.active_on_web))issues.push('VISIBILITY_CHANGED_'+id);
    if(feed.length&&(!feedRow||text(feedRow.poster_image_url)!==expect))issues.push('PRODUCTION_FEED_MISMATCH_'+id);
    const v=visual.find(x=>text(x.event_id)===id);
    if(v&&v.image_loaded!==true)issues.push('VISUAL_IMAGE_NOT_LOADED_'+id);
    if(v&&v.not_cropped!==true)issues.push('VISUAL_POSTER_CROPPED_OR_UNVERIFIED_'+id);
    verified.push({event_id:id,new_drive_file_id:driveId,canonical:!!coreRow&&text(coreRow.poster_image_url)===expect,derived:!!webRow&&text(webRow.poster_image_url)===expect,production_feed:!!feedRow&&text(feedRow.poster_image_url)===expect,visual:!!v&&v.image_loaded===true&&v.not_cropped===true});
  }
  const canonicalPassed=issues.length===0&&verified.every(x=>x.canonical&&x.derived);
  const allProduction=feed.length>0&&verified.every(x=>x.production_feed);
  const allVisual=visual.length>0&&verified.every(x=>x.visual);
  return {
    schema_version:VERSION,
    status:!canonicalPassed?'BLOCKED_READBACK_MISMATCH':!allProduction?'BACKEND_DONE_PRODUCTION_UNVERIFIED':!allVisual?'BACKEND_DONE_BUT_VISUAL_UNVERIFIED':'COMPLETE_VERIFIED',
    issues,verified,
    safety:{production_writes:0,price_writes:0,booking_writes:0,visibility_writes:0,inventory_writes:0}
  };
}
module.exports={VERSION,isoDate,canonicalPoster,posterFileId,detectOwnerPosterRequest,validateTargets,acceptReadback};
