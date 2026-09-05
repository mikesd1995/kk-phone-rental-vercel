'use strict';

/**
 * KK Phone Rental — v4.9.4 competitor reverse-discovery/source-persistence contract.
 *
 * This module is deliberately side-effect free. It turns raw competitor/source
 * observations into governed routing decisions that Scanner runtime can apply.
 * It never writes Candidate, monthly, pricing, notification, booking, or task state.
 */

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function normalizeAlias(v){
  return text(v).toLowerCase().replace(/[#@]/g,'').replace(/[^a-z0-9ก-๙]+/g,' ').replace(/\s+/g,' ').trim();
}
function normalizeUrl(v){
  const raw=text(v); if(!raw) return '';
  try{ const u=new URL(raw); u.hash=''; return u.toString().replace(/\/$/,''); }catch(_){ return raw.replace(/\/$/,''); }
}
function eventIdentity(signal){
  const name=normalizeAlias(signal && (signal.event_name || signal.eventName || signal.hashtag));
  const date=text(signal && (signal.event_date || signal.eventDate));
  const venue=normalizeAlias(signal && signal.venue);
  return {name,date,venue,key:[name,date,venue].join('|')};
}
function classifyCompetitorSignal(signal, options={}){
  if(!signal || typeof signal!=='object') throw new Error('signal required');
  const source=text(signal.source_account || signal.sourceAccount || signal.source_url || signal.sourceUrl);
  const id=eventIdentity(signal);
  const access=upper(signal.access_state || signal.accessState || 'CHECKED');
  const knownKeys=new Set((options.known_event_keys||[]).map(text));
  const reasons=[];
  if(!source) reasons.push('MISSING_SOURCE');
  if(!id.name) reasons.push('MISSING_EVENT_SIGNAL');
  if(!['CHECKED','BLOCKED','NOT_ACCESSIBLE','PARTIAL'].includes(access)) reasons.push('INVALID_ACCESS_STATE');
  if(reasons.length) return {decision:'HOLD',reasons,access_state:access,event_identity:id};
  if(access==='BLOCKED'||access==='NOT_ACCESSIBLE') return {decision:'ACCESS_ONLY',reasons:[],access_state:access,event_identity:id};
  return {
    decision:knownKeys.has(id.key)?'KNOWN_EVENT_SIGNAL':'UNKNOWN_EVENT_SIGNAL',
    reasons:[],access_state:access,event_identity:id,
    next_step:knownKeys.has(id.key)?'KNOWN_EVENT_PRICE_AVAILABILITY_PATH':'NORMALIZE_DEDUP_GEO_THEN_AUTHORITY_VERIFY'
  };
}
function geoRoute(signal){
  const status=upper(signal && (signal.geo_status || signal.geoStatus));
  if(status==='IN_AREA') return {route:'CANDIDATE_AUTHORITY_VERIFY',business_eligible:true};
  if(status==='OUT_OF_AREA') return {route:'OBSERVABILITY_ONLY',business_eligible:false};
  return {route:'GEO_UNRESOLVED_HOLD',business_eligible:false};
}
function sourcePersistenceDecision(source, existingSources=[]){
  if(!source || typeof source!=='object') throw new Error('source required');
  const verified=source.official_verified===true || source.officialVerified===true;
  const recurring=source.recurring===true;
  const directUrl=normalizeUrl(source.direct_url || source.directUrl);
  const sourceName=text(source.source_name || source.sourceName);
  const mediaRoute=text(source.media_route || source.mediaRoute);
  if(!verified) return {decision:'DO_NOT_PERSIST',reason:'OFFICIAL_NOT_VERIFIED'};
  if(!recurring) return {decision:'DO_NOT_PERSIST',reason:'NOT_RECURRING_SOURCE'};
  if(!sourceName || !directUrl) return {decision:'HOLD',reason:'MISSING_CANONICAL_SOURCE_IDENTITY'};
  const existing=new Set((existingSources||[]).map(r=>normalizeUrl(r.direct_url || r.directUrl || r.DirectURL || r['Direct URL'])).filter(Boolean));
  if(existing.has(directUrl)) return {decision:'ALREADY_PRESENT',direct_url:directUrl};
  return {decision:'UPSERT_DIRECT_SOURCE_MAP',source_name:sourceName,direct_url:directUrl,media_route:mediaRoute||null,requires_exact_readback:true};
}
function discoveryCoverage(activeSources, attempts){
  const active=(activeSources||[]).filter(s=>s && s.active!==false && upper(s.active)!=='FALSE');
  const byId=new Map();
  for(const a of attempts||[]){
    const id=text(a.source_id || a.sourceId || a.account || a.source);
    if(!id) continue;
    byId.set(id,upper(a.result || a.status));
  }
  const allowed=new Set(['FOUND_NEW_EVENT','NO_NEW_EVENT','PARTIAL','BLOCKED']);
  const missing=[]; const invalid=[];
  for(const s of active){
    const id=text(s.source_id || s.sourceId || s.account || s.source || s.name);
    const result=byId.get(id);
    if(!result) missing.push(id);
    else if(!allowed.has(result)) invalid.push({source_id:id,result});
  }
  return {
    active_source_count:active.length,
    attempted_source_count:active.length-missing.length,
    complete:missing.length===0 && invalid.length===0,
    missing,invalid,
    scan_state:(missing.length||invalid.length)?'PARTIAL':'COMPLETE'
  };
}
function learnedMissGate(miss){
  const status=upper(miss && miss.status);
  const correction=text(miss && (miss.correction_ref || miss.correctionRef || miss.registry_action || miss.registryAction));
  const readback=miss && (miss.exact_readback===true || miss.exactReadback===true);
  if(status!=='LEARNED') return {ok:true,status:status||'OPEN_REPAIR'};
  if(!correction || !readback) return {ok:false,status:'OPEN_REPAIR',reason:'LEARNED_REQUIRES_CONCRETE_CORRECTION_AND_EXACT_READBACK'};
  return {ok:true,status:'LEARNED'};
}

module.exports={normalizeAlias,eventIdentity,classifyCompetitorSignal,geoRoute,sourcePersistenceDecision,discoveryCoverage,learnedMissGate};
