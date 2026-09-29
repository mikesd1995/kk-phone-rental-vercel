'use strict';

const OWNER_REOPEN_INTENT='explicit_owner_reopen';

function text(v){return String(v===undefined||v===null?'':v).trim();}

function normalizeIdentityText(value){
  return String(value===undefined||value===null?'':value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[\s\-_.,/\\()[\]{}:;'"\`<>“”‘’]+/g,'');
}

function normalizeEventDate(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const raw=text(value);
  if(!raw) return '';
  if(/^\d+(?:\.\d+)?$/.test(raw)){
    const n=Number(raw);
    if(n>1000&&n<100000){
      const ms=Date.UTC(1899,11,30)+Math.round(n*86400000);
      return new Date(ms).toISOString().slice(0,10);
    }
  }
  let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m){
    let y=Number(m[1]); if(y>2500)y-=543;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  }
  m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if(m){
    let y=Number(m[3]); if(y>2500)y-=543;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}

function eventIdentityKey(event={}){
  const name=normalizeIdentityText(event.event_name||event.title);
  const date=normalizeEventDate(event.event_date||event.event_date_text);
  const venue=normalizeIdentityText(event.venue);
  return name&&date?`${name}|${date}|${venue}`:'';
}

function lockRows(snapshot={}){
  const rows=snapshot.visibility_locks||snapshot.event_visibility_locks||snapshot.visibility_history||[];
  return Array.isArray(rows)?rows:[];
}

function lockState(row={}){
  return text(row.lock_state||row.state).toUpperCase();
}

function findVisibilityHistory(snapshot={},event={}){
  const rows=lockRows(snapshot);
  const eventId=text(event.event_id);
  const name=normalizeIdentityText(event.event_name||event.title);
  const date=normalizeEventDate(event.event_date||event.event_date_text);
  const venue=normalizeIdentityText(event.venue);
  const byId=eventId?rows.find(row=>text(row.event_id)===eventId):null;
  if(byId) return Object.assign({match_kind:'EVENT_ID'},byId);
  if(!name||!date) return null;
  const sameNameDate=rows.filter(row=>
    normalizeIdentityText(row.event_name)===name &&
    normalizeEventDate(row.event_date)===date
  );
  if(!sameNameDate.length) return null;
  const exact=sameNameDate.find(row=>{
    const existingVenue=normalizeIdentityText(row.venue);
    return !venue||!existingVenue||existingVenue===venue;
  });
  return Object.assign({match_kind:exact?'IDENTITY':'NAME_DATE_HISTORY_CONFLICT'},exact||sameNameDate[0]);
}

function findLockedVisibility(snapshot={},event={}){
  const hit=findVisibilityHistory(snapshot,event);
  return hit&&lockState(hit)==='LOCKED'?hit:null;
}

function evaluateCreateAgainstHistory(snapshot={},payload={}){
  const hit=findVisibilityHistory(snapshot,payload);
  if(!hit) return {ok:true,code:'NO_EVENT_HISTORY_CONFLICT',history:null};
  if(lockState(hit)==='LOCKED'){
    return {ok:false,code:'EVENT_VISIBILITY_TOMBSTONE_LOCKED',history:hit};
  }
  return {ok:false,code:'EVENT_HISTORY_RECREATE_PROHIBITED',history:hit};
}

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
  const next=requestedVisibility(payload);
  const locked=findLockedVisibility(snapshot,event);
  if(next===true&&locked&&!hasExplicitOwnerReopen(payload)){
    return {
      ok:false,
      code:'EVENT_VISIBILITY_TOMBSTONE_LOCKED',
      error:'Event is protected by a persistent owner-hidden tombstone.',
      event_id:text(payload.event_id),
      current_active_on_web:currentVisibility(event),
      requested_active_on_web:true,
      owner_reopen:false,
      visibility_lock:locked
    };
  }
  const checked=evaluateTransition(event,payload);
  if(checked.ok&&next===true&&locked&&hasExplicitOwnerReopen(payload)){
    checked.code='OWNER_REOPEN_CONFIRMED_TOMBSTONE';
    checked.owner_reopen=true;
    checked.visibility_lock=locked;
  }
  return Object.assign({event_id:text(payload.event_id)},checked);
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
  normalizeIdentityText,
  normalizeEventDate,
  eventIdentityKey,
  lockRows,
  lockState,
  findVisibilityHistory,
  findLockedVisibility,
  evaluateCreateAgainstHistory,
  evaluateTransition,
  evaluateSnapshotTransition,
  assertTransition,
  preserveOwnerHidden,
  findEvent
};
