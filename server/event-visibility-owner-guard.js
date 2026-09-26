'use strict';

const OWNER_REOPEN_INTENT='explicit_owner_reopen';

function text(v){return String(v===undefined||v===null?'':v).trim();}

function boolOrBlank(v){
  if(v===undefined||v===null||v==='') return '';
  if(v===true||v===false) return v;
  const s=text(v).toLowerCase();
  if(['1','true','yes','on'].includes(s)) return true;
  if(['0','false','no','off'].includes(s)) return false;
  return '';
}

function requestedVisibility(payload={}){
  if(!Object.prototype.hasOwnProperty.call(payload,'active_on_web')) return '';
  return boolOrBlank(payload.active_on_web);
}

function currentVisibility(event={}){
  return boolOrBlank(event&&event.active_on_web);
}

function hasExplicitOwnerReopen(payload={}){
  return text(payload.visibility_owner_intent)===OWNER_REOPEN_INTENT;
}

function evaluateTransition(event={},payload={}){
  const next=requestedVisibility(payload);
  const current=currentVisibility(event);
  if(next===''){
    return {
      ok:true,
      code:'VISIBILITY_UNCHANGED',
      current_active_on_web:current,
      requested_active_on_web:next,
      owner_reopen:false
    };
  }

  if(current===false && next===true && !hasExplicitOwnerReopen(payload)){
    return {
      ok:false,
      code:'EVENT_VISIBILITY_OWNER_LOCKED',
      error:'Event is owner-hidden. Re-opening it requires explicit owner intent.',
      current_active_on_web:false,
      requested_active_on_web:true,
      owner_reopen:false
    };
  }

  return {
    ok:true,
    code:current===false&&next===true?'OWNER_REOPEN_CONFIRMED':'VISIBILITY_TRANSITION_ALLOWED',
    current_active_on_web:current,
    requested_active_on_web:next,
    owner_reopen:current===false&&next===true&&hasExplicitOwnerReopen(payload)
  };
}

function findEvent(snapshot,eventId){
  const wanted=text(eventId);
  if(!wanted) return null;
  return ((snapshot&&snapshot.events)||[]).find(row=>text(row&&row.event_id)===wanted)||null;
}

function evaluateSnapshotTransition(snapshot,payload={}){
  const event=findEvent(snapshot,payload.event_id);
  if(!event){
    return {
      ok:false,
      code:'EVENT_VISIBILITY_EVENT_NOT_FOUND',
      error:'Event visibility guard cannot find the target event.',
      event_id:text(payload.event_id)
    };
  }
  return Object.assign({event_id:text(payload.event_id)},evaluateTransition(event,payload));
}

function assertTransition(event,payload={}){
  const checked=evaluateTransition(event,payload);
  if(!checked.ok){
    const err=new Error(checked.error||checked.code);
    err.code=checked.code;
    err.visibility_guard=checked;
    throw err;
  }
  return checked;
}

function preserveOwnerHidden(event={},proposed={}){
  const next=Object.assign({},proposed||{});
  const checked=evaluateTransition(event,next);
  if(!checked.ok){
    next.active_on_web=false;
    delete next.visibility_owner_intent;
    return {
      payload:next,
      preserved:true,
      reason:'OWNER_HIDDEN_PRESERVED',
      guard:checked
    };
  }
  return {payload:next,preserved:false,reason:'NO_OWNER_HIDDEN_CONFLICT',guard:checked};
}

module.exports={
  OWNER_REOPEN_INTENT,
  boolOrBlank,
  requestedVisibility,
  currentVisibility,
  hasExplicitOwnerReopen,
  evaluateTransition,
  evaluateSnapshotTransition,
  assertTransition,
  preserveOwnerHidden,
  findEvent
};
