'use strict';

const Bridge=require('./event-lineage-bridge.js');

const VERSION='tracker-core-promotion-gate-v1';
const PROMOTABLE_STATUSES=new Set(['ACTIVE','VERIFIED']);

function text(v){return String(v===undefined||v===null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function normalizeName(v){
  return text(v).toLowerCase().normalize('NFKC').replace(/\s+/g,' ').trim();
}
function bool(v){return v===true||['1','true','yes','on'].includes(text(v).toLowerCase());}

function eventId(row){return text(row&&row.event_id);}
function coreEventDate(row){
  const raw=text(row&&(row.event_date||row.date));
  if(!raw) return '';
  try{return Bridge.normalizeEventDate(raw);}catch(_){return '';}
}
function coreEventName(row){return normalizeName(row&&(row.event_name||row.name));}

function identityCollision(coreEvents,trackerEvent){
  const date=Bridge.normalizeEventDate(trackerEvent.event_date);
  const name=normalizeName(trackerEvent.event_name);
  return (coreEvents||[]).filter(row=>coreEventDate(row)===date&&coreEventName(row)===name);
}

function directWriterCanUpdate(state){
  if(!state||!state.ready) return false;
  const actions=Array.isArray(state.configured_actions)?state.configured_actions:[];
  return actions.includes('updateEvent')&&state.create_event_routed===false;
}

function baseResult(trackerEvent){
  return {
    version:VERSION,
    event_family_id:text(trackerEvent.event_family_id),
    tracker_show_id:text(trackerEvent.tracker_show_id),
    event_date:Bridge.normalizeEventDate(trackerEvent.event_date),
    event_name:text(trackerEvent.event_name),
    canonical_status:upper(trackerEvent.canonical_status||trackerEvent.status),
    verifier_confirmed:bool(trackerEvent.verifier_confirmed),
    production_writes:0
  };
}

function evaluatePromotion({trackerEvent,lineageRows=[],coreEvents=[],directWriterState={}}={}){
  if(!trackerEvent||typeof trackerEvent!=='object'){
    throw Object.assign(new Error('trackerEvent is required'),{code:'PROMOTION_TRACKER_EVENT_REQUIRED'});
  }

  const out=baseResult(trackerEvent);
  if(!out.event_family_id.startsWith('FAM|')){
    throw Object.assign(new Error('event_family_id must start with FAM|'),{code:'PROMOTION_IDENTITY_INVALID'});
  }
  if(!(out.tracker_show_id.startsWith('SHOW|')||out.tracker_show_id.startsWith('SHOWSET|'))){
    throw Object.assign(new Error('tracker_show_id must start with SHOW| or SHOWSET|'),{code:'PROMOTION_IDENTITY_INVALID'});
  }
  if(!out.event_name){
    throw Object.assign(new Error('event_name is required'),{code:'PROMOTION_EVENT_NAME_REQUIRED'});
  }

  if(!out.verifier_confirmed){
    return Object.assign(out,{
      decision:'BLOCKED',
      reason:'VERIFIER_CONFIRMATION_REQUIRED',
      ready_for_execution:false
    });
  }
  if(!PROMOTABLE_STATUSES.has(out.canonical_status)){
    return Object.assign(out,{
      decision:'BLOCKED',
      reason:'CANONICAL_STATUS_NOT_PROMOTABLE',
      ready_for_execution:false
    });
  }

  let mappedCoreId;
  try{
    mappedCoreId=Bridge.resolveCoreEventId(lineageRows,{
      event_family_id:out.event_family_id,
      tracker_show_id:out.tracker_show_id,
      event_date:out.event_date
    });
  }catch(err){
    return Object.assign(out,{
      decision:'BLOCKED',
      reason:'LINEAGE_AMBIGUOUS_OR_INVALID',
      error_code:text(err&&err.code)||'LINEAGE_VALIDATION_FAILED',
      ready_for_execution:false
    });
  }

  if(mappedCoreId){
    const matches=(coreEvents||[]).filter(row=>eventId(row)===mappedCoreId);
    if(matches.length!==1){
      return Object.assign(out,{
        decision:'BLOCKED',
        reason:matches.length?'CORE_EVENT_ID_AMBIGUOUS':'LINEAGE_POINTS_TO_MISSING_CORE',
        core_event_id:mappedCoreId,
        ready_for_execution:false
      });
    }
    const updateReady=directWriterCanUpdate(directWriterState);
    return Object.assign(out,{
      decision:updateReady?'READY_UPDATE_EXISTING':'UPDATE_EXISTING_GATED',
      reason:updateReady?'EXPLICIT_LINEAGE_AND_WRITER_ACCEPTED':'DIRECT_WRITER_UPDATE_EVENT_NOT_ACCEPTED',
      core_event_id:mappedCoreId,
      action:'updateEvent',
      ready_for_execution:updateReady,
      payload:{
        action:'updateEvent',
        event_id:mappedCoreId,
        event_name:out.event_name,
        event_date:out.event_date,
        venue:text(trackerEvent.venue),
        status:'active'
      }
    });
  }

  const collisions=identityCollision(coreEvents,trackerEvent);
  if(collisions.length){
    return Object.assign(out,{
      decision:'RECONCILE_LINEAGE_REQUIRED',
      reason:collisions.length===1?'EXISTING_CORE_IDENTITY_MATCH_WITHOUT_EXPLICIT_LINEAGE':'MULTIPLE_CORE_IDENTITY_MATCHES',
      candidate_core_event_ids:collisions.map(eventId).filter(Boolean),
      ready_for_execution:false
    });
  }

  return Object.assign(out,{
    decision:'CREATE_EVENT_AUTHORITY_REQUIRED',
    reason:'NO_EXPLICIT_LINEAGE_AND_NO_SAFE_EXISTING_CORE_MATCH',
    action:'createEvent',
    ready_for_execution:false,
    create_event_routed:false
  });
}

function summarize(decisions){
  const counts={};
  for(const row of decisions||[]){
    const key=text(row&&row.decision)||'UNKNOWN';
    counts[key]=(counts[key]||0)+1;
  }
  return {
    version:VERSION,
    total:(decisions||[]).length,
    counts,
    production_writes:0
  };
}

module.exports={
  VERSION,
  PROMOTABLE_STATUSES,
  normalizeName,
  identityCollision,
  directWriterCanUpdate,
  evaluatePromotion,
  summarize
};
