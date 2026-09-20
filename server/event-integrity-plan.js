'use strict';

const Health=require('../admin/snapshot-health.js');

function normalizedIdentityGroup(events){
  const groups=[];
  for(const row of Array.isArray(events)?events:[]){
    const eventId=String(row&&row.event_id||'').trim();
    const eventName=String(row&&row.event_name||'').trim();
    const eventDate=Health.normalizeEventDate(row&&row.event_date);
    const venue=String(row&&row.venue||'').trim();
    const normalizedName=Health.normalizeEventIdentityText(eventName);
    const normalizedVenue=Health.normalizeEventIdentityText(venue);
    if(!normalizedName||!eventDate) continue;

    let group=groups.find(g=>{
      if(g.normalized_name!==normalizedName||g.event_date!==eventDate) return false;
      if(g.normalized_venue&&normalizedVenue&&g.normalized_venue!==normalizedVenue) return false;
      return true;
    });
    if(!group){
      group={
        normalized_name:normalizedName,
        normalized_venue:normalizedVenue,
        event_date:eventDate,
        event_name:eventName,
        venue,
        event_ids:[]
      };
      groups.push(group);
    }
    group.event_ids.push(eventId||'(missing event_id)');
  }
  return groups.filter(g=>g.event_ids.length>1);
}

function dateDrift(events){
  const out=[];
  for(const row of Array.isArray(events)?events:[]){
    const eventId=String(row&&row.event_id||'').trim();
    const eventDate=Health.normalizeEventDate(row&&row.event_date);
    const m=eventId.match(/^EVT-(\d{4})(\d{2})(\d{2})-/);
    if(!m||!eventDate) continue;
    const idDate=`${m[1]}-${m[2]}-${m[3]}`;
    if(idDate!==eventDate) out.push({event_id:eventId,id_date:idDate,event_date:eventDate});
  }
  return out;
}

function proposeDateAlignedEventId(event){
  const eventId=String(event&&event.event_id||'').trim();
  const eventDate=Health.normalizeEventDate(event&&event.event_date);
  const m=eventId.match(/^EVT-\d{8}-(.+)$/);
  if(!m||!eventDate) return '';
  return `EVT-${eventDate.replace(/-/g,'')}-${m[1]}`;
}

function collectReferences(snapshot,eventId){
  const target=String(eventId||'').trim();
  if(!target) return [];
  const refs=[];
  const seen=new Set();

  function add(dataset,path,kind,value){
    const key=[dataset,path,kind].join('|');
    if(seen.has(key)) return;
    seen.add(key);
    refs.push({dataset,path,kind,value});
  }

  function walk(value,dataset,path){
    if(value===null||value===undefined) return;
    if(typeof value==='string'){
      if(value===target) add(dataset,path,'exact_event_id',value);
      else if(value.startsWith(target+'-TPL-')) add(dataset,path,'derived_package_id',value);
      return;
    }
    if(Array.isArray(value)){
      value.forEach((item,i)=>walk(item,dataset,`${path}[${i}]`));
      return;
    }
    if(typeof value==='object'){
      for(const [key,next] of Object.entries(value)){
        walk(next,dataset,path?`${path}.${key}`:key);
      }
    }
  }

  for(const [dataset,value] of Object.entries(snapshot&&typeof snapshot==='object'?snapshot:{})){
    if(dataset==='events') continue;
    walk(value,dataset,dataset);
  }
  return refs;
}

function buildPlan(snapshot){
  const data=snapshot&&typeof snapshot==='object'?snapshot:{};
  const events=Array.isArray(data.events)?data.events:[];
  const eventById=new Map(events.map(e=>[String(e&&e.event_id||'').trim(),e]));
  const eventIds=new Set(eventById.keys());

  const drift=dateDrift(events).map(item=>{
    const event=eventById.get(item.event_id)||{};
    const proposedEventId=proposeDateAlignedEventId(event);
    const collision=!!(proposedEventId&&proposedEventId!==item.event_id&&eventIds.has(proposedEventId));
    return Object.assign({},item,{
      proposed_event_id:proposedEventId,
      status:collision?'BLOCKED_COLLISION':'SAFE_CANDIDATE',
      collision,
      references:collectReferences(data,item.event_id)
    });
  });

  const duplicates=normalizedIdentityGroup(events).map(group=>({
    event_ids:group.event_ids.slice(),
    event_name:group.event_name,
    event_date:group.event_date,
    venue:group.venue,
    status:'REVIEW_REQUIRED',
    automatic_canonical_selection:false,
    references:group.event_ids.map(eventId=>({
      event_id:eventId,
      references:collectReferences(data,eventId)
    }))
  }));

  return {
    mode:'DRY_RUN',
    mutates:false,
    event_count:events.length,
    id_date_drift_count:drift.length,
    logical_duplicate_group_count:duplicates.length,
    id_date_drift:drift,
    logical_duplicate_groups:duplicates,
    blockers:{
      collision_count:drift.filter(x=>x.collision).length,
      duplicate_review_count:duplicates.length
    }
  };
}

module.exports={
  normalizedIdentityGroup,
  dateDrift,
  proposeDateAlignedEventId,
  collectReferences,
  buildPlan
};
