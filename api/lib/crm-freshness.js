'use strict';

function manifestMap(values){
  const out={};
  for(const row of (values||[]).slice(1)){
    const key=String((row&&row[0])||'').trim();
    if(!key) continue;
    out[key]={value:String((row&&row[1])||''),status:String((row&&row[2])||''),note:String((row&&row[3])||'')};
  }
  return out;
}

function maxAgeMinutes(env=process.env){
  const raw=Number(String((env&&env.KK_CRM_MAX_STALENESS_MINUTES)||'30').trim());
  if(!Number.isFinite(raw)) return 30;
  return Math.min(1440,Math.max(5,Math.round(raw)));
}

function normalizeTimestamp(value){
  const s=String(value||'').trim();
  if(!s) return null;
  const direct=Date.parse(s);
  if(Number.isFinite(direct)) return direct;
  const normalized=s.replace(' ','T');
  const n=Date.parse(normalized);
  return Number.isFinite(n)?n:null;
}

function assessManifest(values,{nowMs=Date.now(),maxAgeMin=30}={}){
  const manifest=manifestMap(values);
  const sync=manifest.last_synced_at||null;
  const syncState=String((manifest.sync_state&&manifest.sync_state.value)||(manifest.auto_sync&&manifest.auto_sync.value)||(sync&&sync.status)||'').trim().toUpperCase();
  const ts=sync?normalizeTimestamp(sync.value):null;
  const base={
    manifest,
    last_synced_at:sync?sync.value:'',
    sync_state:syncState,
    max_age_minutes:maxAgeMin,
    age_minutes:null,
    fresh:false,
    code:''
  };
  if(!sync || !String(sync.value||'').trim()) return Object.assign(base,{code:'CRM_SYNC_TIMESTAMP_MISSING'});
  if(!Number.isFinite(ts)) return Object.assign(base,{code:'CRM_SYNC_TIMESTAMP_INVALID'});
  const age=Math.max(0,(nowMs-ts)/60000);
  base.age_minutes=Math.round(age*10)/10;
  if(syncState && !['OK','READY','ACTIVE','SYNCED'].includes(syncState)) return Object.assign(base,{code:'CRM_SYNC_STATE_NOT_READY'});
  if(age>maxAgeMin) return Object.assign(base,{code:'CRM_SYNC_STALE'});
  return Object.assign(base,{fresh:true,code:'CRM_SYNC_FRESH'});
}

module.exports={manifestMap,maxAgeMinutes,normalizeTimestamp,assessManifest};
