'use strict';
const VERSION='KK_ULTRA_DEEP_FANDOM_SUBEVENT_V1';
function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'');}
function sameDate(a,b){return text(a).slice(0,10)===text(b).slice(0,10);}
function venueQualifier(v){
  const s=text(v).toLowerCase();
  const m=s.match(/(hall|ฮอลล์|room|ห้อง|zone|โซน|stage|เวที)\s*(\d+)/iu);
  return m?{kind:m[1],number:m[2]}:null;
}
function genericVenue(v){
  return norm(text(v).toLowerCase().replace(/(hall|ฮอลล์|room|ห้อง|zone|โซน|stage|เวที)\s*\d+/giu,'$1'));
}
function sameVenue(a,b){
  const x=norm(a),y=norm(b);
  if(!x||!y) return false;
  if(x===y||x.includes(y)||y.includes(x)) return true;
  const qa=venueQualifier(a),qb=venueQualifier(b);
  // A numbered sub-hall may attach to a generic parent venue, but two
  // explicitly different hall/room/zone numbers are distinct boundaries.
  if(qa&&qb) return qa.number===qb.number&&genericVenue(a)===genericVenue(b);
  if(Boolean(qa)!==Boolean(qb)) return genericVenue(a)===genericVenue(b);
  return false;
}

function classify(child={},parent={}){
  if(!text(parent.event_id)) return {version:VERSION,decision:'SEPARATE_CANDIDATE',reason:'NO_PARENT_IDENTITY'};
  const dateMatch=sameDate(child.event_date,parent.event_date);
  const venueMatch=sameVenue(child.venue,parent.venue);
  const separateOperationalBoundary=
    child.separate_admission===true||
    child.separate_pickup_window===true||
    child.separate_venue===true||
    child.separate_date===true;

  if(separateOperationalBoundary||!dateMatch||!venueMatch){
    return {version:VERSION,decision:'SEPARATE_CANDIDATE',reason:'DISTINCT_OPERATIONAL_EVENT',parent_event_id:text(parent.event_id)};
  }
  if(parent.owner_hidden===true||parent.tombstone_locked===true||text(parent.history_state).toUpperCase()==='LOCKED'||parent.active_on_web===false){
    return {version:VERSION,decision:'ATTACH_EVIDENCE_ONLY',reason:'HIGH_DEMAND_CHILD_ON_HIDDEN_PARENT',parent_event_id:text(parent.event_id),may_reopen_parent:false};
  }
  return {version:VERSION,decision:'ATTACH_TO_PARENT',reason:'SAME_DATE_VENUE_PARENT_EVENT',parent_event_id:text(parent.event_id),may_reopen_parent:false};
}

function aggregate(parentScoring={},children=[]){
  const keys=['competitor_rental_activity','social_engagement','ticket_demand','fandom_photo_intent','venue_capture_value','historical_market_rental'];
  const external=children.map(x=>x&&x.external_scoring||{});
  const max=(key)=>{
    const xs=external.map(x=>Number(x[key])).filter(Number.isFinite);
    return xs.length?Math.max(...xs):null;
  };
  const out=Object.fromEntries(keys.filter(key=>Number.isFinite(Number(parentScoring[key]))).map(key=>[key,Number(parentScoring[key])]));
  for(const key of keys){
    const childMax=max(key),base=Number(parentScoring[key]);
    if(Number.isFinite(childMax)) out[key]=Number.isFinite(base)?Math.max(base,childMax):childMax;
  }
  return {version:VERSION,external_scoring:out,child_evidence_count:children.length,internal_business_signals_affect_score:false};
}
module.exports={VERSION,classify,aggregate};
