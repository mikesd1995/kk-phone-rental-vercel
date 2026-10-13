'use strict';
// Reverse reconciliation: owner-added Core event -> Tracker candidate/monthly/miss.
// Pure review-only plan. NEVER writes Sheets, never invents scanner provenance.
const VERSION='KK_ULTRA_DEEP_OWNER_CORE_LINEAGE_V1';
const THAI_MONTHS=Object.freeze({'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12});
function text(v){return String(v==null?'':v).trim();}
function normalize(v){
 return text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function isoDate(v){
 const s=text(v);
 if(!s)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const dm=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(dm){
  const yyyy=Number(dm[3])>=2400?Number(dm[3])-543:Number(dm[3]);
  return validDate(yyyy,Number(dm[2]),Number(dm[1]));
 }
 const th=s.match(/^(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{4})$/);
 if(th)return validDate(Number(th[3])>=2400?Number(th[3])-543:Number(th[3]),THAI_MONTHS[th[2]],Number(th[1]));
 // Google Sheets sometimes displays dates as serial numbers.
 const serial=Number(s);
 if(/^\d{5}$/.test(s)&&serial>20000&&serial<80000)
  return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
 return '';
}
function validDate(y,m,d){
 if(y<2000||m<1||m>12||d<1||d>31)return '';
 const t=new Date(Date.UTC(y,m-1,d));
 return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?
  String(y)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):'';
}
function rowsToObjects(values=[],headerIndex=0){
 if(!Array.isArray(values)||!Array.isArray(values[headerIndex]))return [];
 const headers=values[headerIndex].map(text);
 return values.slice(headerIndex+1).filter(row=>Array.isArray(row)&&row.some(x=>text(x)))
  .map(row=>Object.fromEntries(headers.filter(Boolean).map((name,i)=>[name,row[headers.indexOf(name)]??''])));
}
function normalizeInput(input={}){
 const required=['events','web_ready','web_packages','visibility_locks','tracker_candidates','tracker_monthly','miss_learning','bookings'];
 const absent=required.filter(k=>!Array.isArray(input[k]));
 if(absent.length)return {complete:false,missing_surfaces:absent};
 return {complete:true,missing_surfaces:[]};
}
function eventIdentity(row={}){
 return [normalize(row.event_name||row['Event Name / Keyword']||row['ชื่องาน']||row['Event Name']),
  isoDate(row.event_date||row.event_date_text||row['Suspected Event Date']||row['วันที่งานจัด']||row['Event Date']),
  normalize(row.venue||row['Suspected Venue']||row['สถานที่จัดงาน']||row['Venue'])].join('|');
}
function nameDate(row={}){
 return [normalize(row.event_name||row['Event Name / Keyword']||row['ชื่องาน']||row['Event Name']),
  isoDate(row.event_date||row.event_date_text||row['Suspected Event Date']||row['วันที่งานจัด']||row['Event Date'])].join('|');
}
function linkedToCore(row={},core={},surface=''){
 // Candidate and Miss Learning have no canonical event-id column. Exact literal
 // event ID in NOTES is an allowed explicit link, otherwise require exact
 // title+date+venue; never fuzzy-match unrelated performer, day or venue.
 const id=text(core.event_id);
 const direct=text(row.event_id);
 if(direct)return direct===id;
 const notes=[row.Notes,row.notes,row['Notes'],row['Show ID'],row['Miss ID']].map(text).join(' ');
 if(notes.includes(id)){
  const suppliedDate=isoDate(row.event_date||row.event_date_text||row['Suspected Event Date']||row['วันที่งานจัด']||row['Event Date']);
  return !suppliedDate||suppliedDate===isoDate(core.event_date);
 }
 return eventIdentity(row)===eventIdentity(core) &&
  nameDate(row).split('|')[0].length>=7&&nameDate(row).split('|')[1]!=='';
}
function findLineage(rows=[],core={}){
 return rows.filter(row=>linkedToCore(row,core));
}
function nameDateConflict(rows=[],core={}){
 const target=nameDate(core);
 return rows.filter(row=>nameDate(row)===target&&eventIdentity(row)!==eventIdentity(core));
}
function compactId(core={}){
 return 'OWNER_CORE_TRACKER|'+text(core.event_id)+'|'+isoDate(core.event_date);
}
function proposalFor(core={},lock={},missing=[]){
 const id=text(core.event_id),date=isoDate(core.event_date);
 const provenance='OWNER_SUPPLIED_NOT_SCANNER_DISCOVERED';
 const base={event_id:id,event_date:date,event_name:text(core.event_name),
  venue:text(core.venue),lineage_key:compactId(core),
  provenance,primary_source_verified:false,scanner_discovered:false,
  requires_owner_review:true,requires_governed_writer:true,auto_apply:false};
 const result=[];
 if(missing.includes('tracker_candidates')){
  result.push({...base,surface:'_Candidate_Queue',action:'REVIEW_CREATE_IF_ABSENT',
   status:'HOLD_OWNER_CORE_LINEAGE_REVIEW',discovery_channel:'OWNER_REVERSE_CORE_NOT_SCANNER',
   discovery_source_url:null,evidence_type:'OWNER_SUPPLIED_POSTER_PRIMARY_SOURCE_PENDING',
   official_verification:'UNVERIFIED_OFFICIAL_EVENT_ANNOUNCEMENT',
   blocked_reason:'SOURCE_AND_PHOTOGRAPHY_ACCESS_POLICY_PENDING',
   note:'EXISTING_CORE_EVENT_ID='+id+'; source_provenance=OWNER_EXPLICIT_ADD; do not create Core/AI READY packet'});
 }
 if(missing.includes('tracker_monthly')){
  result.push({...base,surface:'ต.ค. 2569',action:'REVIEW_EXISTING_CORE_MONTHLY_DISPOSITION',
   status:'HOLD_OWNER_CORE_MONTHLY_LINEAGE_REVIEW',
   proposed_price:null,proposed_visibility:null,proposed_inventory:null,
   note:'EXISTING_CORE_EVENT_ID='+id+'; no date-sorted row insert without governed verifier'});
 }
 if(missing.includes('miss_learning')){
  result.push({...base,surface:'_Miss_Learning',action:'REVIEW_OBSERVED_GAP_NOT_CONFIRMED_SCANNER_MISS',
   miss_id:'MISS|OWNERCORE|'+date.replace(/-/g,'')+'|'+id,
   miss_class:'OWNER_CORE_TRACKER_LINEAGE_GAP',
   status:'PROPOSED_REVIEW_NOT_LEARNED',
   verified_scanner_failure:false,training_eligible:false,
   root_cause:'REVERSE_CORE_LINEAGE_MISSING__SCANNER_MISS_NOT_YET_PROVEN',
   note:'Visibility lock '+text(lock.lock_state)+'; owner poster is not independent official announcement'});
 }
 return result;
}
function prepare(input={}){
 const checked=normalizeInput(input);
 const ids=Array.isArray(input.event_ids)?[...new Set(input.event_ids.map(text).filter(Boolean))]:[];
 const blocking=[];
 if(!ids.length)blocking.push('EXPLICIT_EVENT_IDS_REQUIRED');
 if(!checked.complete)blocking.push('REQUIRED_SNAPSHOT_SURFACE_NOT_READ');
 const selection=[];
 if(checked.complete){
  for(const id of ids){
   const events=input.events.filter(x=>text(x.event_id)===id);
   if(events.length!==1){
    selection.push({event_id:id,status:'HOLD',blockers:[events.length?'CORE_DUPLICATE_EVENT_ID':'CORE_EVENT_NOT_FOUND'],proposals:[]});
    continue;
   }
   const core=events[0],date=isoDate(core.event_date),other=input.events.filter(x=>x!==core&&eventIdentity(x)===eventIdentity(core));
   const lockRows=input.visibility_locks.filter(x=>text(x.event_id)===id);
   const webRows=input.web_ready.filter(x=>text(x.event_id)===id);
   const packageRows=input.web_packages.filter(x=>text(x.event_id)===id);
   const bookRows=input.bookings.filter(x=>text(x.event_id)===id && !['cancelled','canceled','no_show',''].includes(text(x.booking_status).toLowerCase()));
   const lock=lockRows.length===1?lockRows[0]:{};
   const ownerProof=/OWNER_EXPLICIT_ADD/.test(text(core.event_note)) &&
    /OWNER_EXPLICIT_ADD/.test(text(lock.lock_reason));
   const blockers=[];
   if(!date)blockers.push('CORE_DATE_INVALID');
   if(other.length)blockers.push('CORE_DUPLICATE_EVENT_IDENTITY');
   if(webRows.length!==1||webRows[0]&&isoDate(webRows[0].event_date_text)!==date)blockers.push('CORE_WEBREADY_MISMATCH');
   if(lockRows.length!==1)blockers.push('VISIBILITY_LOCK_SNAPSHOT_MISMATCH');
   if(!ownerProof)blockers.push('OWNER_PROVENANCE_NOT_CONFIRMED');
   if(lockRows.length===1&&(isoDate(lock.event_date)!==date||
     normalize(lock.venue)!==normalize(core.venue)))blockers.push('VISIBILITY_LOCK_IDENTITY_CONFLICT');
   if(['LOCKED'].includes(text(lock.lock_state).toUpperCase()))blockers.push('OWNER_TOMBSTONE_LOCKED');
   const typeCount=new Map();
   for(const row of packageRows)typeCount.set(text(row.package_type),(typeCount.get(text(row.package_type))||0)+1);
   if(typeCount.get('phone_only')!==1||typeCount.get('phone_lens_bundle')!==1)
    blockers.push('CORE_PACKAGE_IDENTITY_INCOMPLETE');
   if(typeCount.get('lens_only')===1&&text(packageRows.find(x=>x.package_type==='lens_only').package_status)==='available')
    blockers.push('CORE_LENS_ONLY_NOT_HIDDEN');
   const grouped={
    tracker_candidates:findLineage(input.tracker_candidates,core),
    tracker_monthly:findLineage(input.tracker_monthly,core),
    miss_learning:findLineage(input.miss_learning,core)
   };
   const missing=Object.keys(grouped).filter(k=>grouped[k].length===0);
   for(const [k,rows] of Object.entries(grouped))if(rows.length>1)blockers.push('DUPLICATE_'+k.toUpperCase());
   for(const [k,rows] of Object.entries({
    tracker_candidates:input.tracker_candidates,tracker_monthly:input.tracker_monthly,miss_learning:input.miss_learning
   })){
    if(nameDateConflict(rows,core).length)blockers.push('IDENTITY_CONFLICT_'+k.toUpperCase());
   }
   const proposals=blockers.length?[]:proposalFor(core,lock,missing);
   selection.push({
    event_id:id,event_date:date,event_name:text(core.event_name),
    core_exists:true,core_active_on_web:text(core.active_on_web).toUpperCase()==='TRUE',
    core_webready_action:text(webRows[0]&&webRows[0].action_for_web)||null,
    owner_provenance_confirmed:ownerProof,visibility_lock:text(lock.lock_state)||null,
    active_booking_present:bookRows.length>0,existing_core_packages:packageRows.length,
    lineage_found:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.length])),
    missing_surfaces:missing,
    status:blockers.length?'HOLD_IDENTITY_OR_SAFETY_CONFLICT':
     missing.length?'STAGE_OWNER_CORE_TRACKER_REVIEW':'ALREADY_RECONCILED',
    blockers,proposals,
    known_miss_can_be_auto_accepted:false,scanner_discovered:false,primary_source_verified:false,
    pricing_mutation:false,visibility_mutation:false,inventory_mutation:false,
    production_writes:0
   });
  }
 }
 return {
  version:VERSION,as_of:text(input.as_of)||null,scope_event_ids:ids,
  status:blocking.length?'HOLD_MISSING_REQUIRED_INPUT':
   selection.some(x=>x.blockers.length)?'HOLD_IDENTITY_OR_SAFETY_CONFLICT':
   selection.some(x=>x.missing_surfaces.length)?'STAGED_REVIEW_ONLY':'ALREADY_RECONCILED',
  blockers:blocking,events:selection,
  review_proposal_count:selection.reduce((n,x)=>n+x.proposals.length,0),
  authority:{stage_only:true,approved:false,auto_apply:false,
   tracker_writes:0,backend_writes:0,production_writes:0,
   may_change_price:false,may_change_visibility:false,may_create_core_event:false,
   may_mark_scanner_discovered:false,may_mark_miss_learned:false}
 };
}
module.exports={VERSION,THAI_MONTHS,normalize,isoDate,rowsToObjects,eventIdentity,nameDate,linkedToCore,findLineage,prepare};
