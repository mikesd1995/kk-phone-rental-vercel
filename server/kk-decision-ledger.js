'use strict';

const crypto=require('crypto');
const RuntimeLedger=require('./runtime-ledger.js');

const TABLE='kk_decision_events';
const EVENT_TYPES=new Set(['RECOMMENDATION','OWNER_DECISION','OUTCOME','LESSON']);
const DECISION_TYPES=new Set(['event_opportunity','content','pricing','customer','engineering','operations','storefront','system']);
const OWNER_ACTIONS=new Set(['','APPROVED','REJECTED','MODIFIED','DEFERRED']);
const ALLOWED_METRICS=new Set([
  'impressions','engagements','profile_visits','link_clicks','inquiries','bookings','revenue_thb',
  'spend_thb','booking_velocity','inventory_utilization','conversion_rate','engagement_rate',
  'consideration_rate','response_rate','resolution_minutes','error_count','latency_ms'
]);

function text(value){ return String(value==null?'':value).trim(); }
function bool(value){ return ['1','true','yes','on'].includes(text(value).toLowerCase()); }
function hash(value){ return crypto.createHash('sha256').update(String(value||'')).digest('hex'); }
function configState(env=process.env){
  const enabled=text(env.KK_DECISION_LEDGER_ENABLED)
    ? bool(env.KK_DECISION_LEDGER_ENABLED)
    : bool(env.KK_RUNTIME_LEDGER_ENABLED);
  const url=text(env.SUPABASE_URL).replace(/\/+$/,'');
  const serverKey=RuntimeLedger.resolveServerKey(env);
  const expected=text(env.KK_DECISION_LEDGER_PROJECT_REF||env.KK_RUNTIME_LEDGER_PROJECT_REF).toLowerCase();
  const actual=RuntimeLedger.projectRefFromUrl(url);
  return {
    enabled,
    configured:enabled && !!url && !!serverKey.value && !!expected && actual===expected,
    url_configured:!!url,
    server_key_configured:!!serverKey.value,
    project_binding_matches:!!expected && actual===expected,
    table:TABLE
  };
}
function headers(env){
  const key=RuntimeLedger.resolveServerKey(env).value;
  return {apikey:key,Authorization:'Bearer '+key};
}
function sanitizeMetrics(value){
  const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const out={};
  for(const [key,raw] of Object.entries(input)){
    if(!ALLOWED_METRICS.has(key)) continue;
    const n=Number(raw);
    if(Number.isFinite(n) && n>=0) out[key]=n;
  }
  return out;
}
function validHash(value){ return /^[0-9a-f]{64}$/.test(text(value)); }
function safeSubjectRef(value){
  const v=text(value);
  if(!/^[A-Za-z0-9_.:-]{0,160}$/.test(v)) return false;
  if(/^\+?[0-9]{8,15}$/.test(v)) return false;
  return true;
}
function normalizeRow(row={}){
  const decisionId=text(row.decision_id);
  const eventType=text(row.event_type).toUpperCase();
  const decisionType=text(row.decision_type).toLowerCase();
  const ownerAction=text(row.owner_action).toUpperCase();
  const evidenceHash=validHash(row.evidence_hash)?text(row.evidence_hash):hash(JSON.stringify(row.evidence||{}));
  const eventId=text(row.event_id)||('dle_'+hash([decisionId,eventType,evidenceHash].join('|')).slice(0,40));
  return {
    event_id:eventId,
    decision_id:decisionId,
    event_type:eventType,
    decision_type:decisionType,
    subject_ref:text(row.subject_ref),
    recommendation_code:text(row.recommendation_code).toUpperCase(),
    owner_action:ownerAction,
    confidence:row.confidence==null?null:Number(row.confidence),
    expected_score:row.expected_score==null?null:Number(row.expected_score),
    outcome_score:row.outcome_score==null?null:Number(row.outcome_score),
    evidence_hash:evidenceHash,
    metrics:sanitizeMetrics(row.metrics),
    lesson_code:text(row.lesson_code).toUpperCase(),
    source:text(row.source||'KK_OPERATING_PARTNER_V1'),
    source_commit_sha:text(row.source_commit_sha||process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||''),
    production_writes:0,
    publishes:0
  };
}
function validateRow(input={}){
  const row=normalizeRow(input);
  const errors=[];
  if(!/^dle_[A-Za-z0-9_-]{16,96}$/.test(row.event_id)) errors.push('EVENT_ID_INVALID');
  if(!/^dec_[A-Za-z0-9_-]{8,96}$/.test(row.decision_id)) errors.push('DECISION_ID_INVALID');
  if(!EVENT_TYPES.has(row.event_type)) errors.push('EVENT_TYPE_INVALID');
  if(!safeSubjectRef(row.subject_ref)) errors.push('SUBJECT_REF_UNSAFE');
  if(!DECISION_TYPES.has(row.decision_type)) errors.push('DECISION_TYPE_INVALID');
  if(!OWNER_ACTIONS.has(row.owner_action)) errors.push('OWNER_ACTION_INVALID');
  for(const [key,value] of [['confidence',row.confidence],['expected_score',row.expected_score],['outcome_score',row.outcome_score]]){
    if(value!=null && (!Number.isFinite(value) || value<0 || value>100)) errors.push(key.toUpperCase()+'_INVALID');
  }
  if(!validHash(row.evidence_hash)) errors.push('EVIDENCE_HASH_INVALID');
  if(row.event_type==='OWNER_DECISION' && !row.owner_action) errors.push('OWNER_ACTION_REQUIRED');
  if(row.event_type==='OUTCOME' && row.outcome_score==null && Object.keys(row.metrics).length===0) errors.push('OUTCOME_EVIDENCE_REQUIRED');
  if(Number(input.production_writes||0)!==0) errors.push('PRODUCTION_WRITES_NONZERO');
  if(Number(input.publishes||0)!==0) errors.push('PUBLISHES_NONZERO');
  return {row,errors};
}
async function parseJsonSafe(response){
  try{return await response.json();}catch(_){return null;}
}
async function recordEvent({env=process.env,fetchImpl=global.fetch,row}={}){
  const cfg=configState(env);
  if(!cfg.enabled) throw Object.assign(new Error('decision ledger disabled'),{code:'DECISION_LEDGER_DISABLED'});
  if(!cfg.configured) throw Object.assign(new Error('decision ledger not configured'),{code:'DECISION_LEDGER_NOT_CONFIGURED'});
  if(typeof fetchImpl!=='function') throw Object.assign(new Error('fetch unavailable'),{code:'DECISION_LEDGER_FETCH_UNAVAILABLE'});
  const checked=validateRow(row);
  if(checked.errors.length) throw Object.assign(new Error('decision event invalid'),{code:'DECISION_EVENT_INVALID',blockers:checked.errors});
  const endpoint=text(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/'+TABLE+'?on_conflict=event_id';
  const response=await fetchImpl(endpoint,{
    method:'POST',
    headers:{...headers(env),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify([checked.row])
  });
  const body=await parseJsonSafe(response);
  if(!response.ok) throw Object.assign(new Error('decision ledger write failed'),{code:'DECISION_LEDGER_WRITE_FAILED',status:response.status,remote_code:body&&body.code||''});
  const inserted=Array.isArray(body)&&body.length>0;
  return {ok:true,inserted,idempotent_duplicate:!inserted,event_id:checked.row.event_id,decision_id:checked.row.decision_id};
}
async function listEvents({env=process.env,fetchImpl=global.fetch,limit=200,decision_id=''}={}){
  const cfg=configState(env);
  if(!cfg.enabled) throw Object.assign(new Error('decision ledger disabled'),{code:'DECISION_LEDGER_DISABLED'});
  if(!cfg.configured) throw Object.assign(new Error('decision ledger not configured'),{code:'DECISION_LEDGER_NOT_CONFIGURED'});
  const params=new URLSearchParams({
    select:'event_id,decision_id,occurred_at,event_type,decision_type,subject_ref,recommendation_code,owner_action,confidence,expected_score,outcome_score,evidence_hash,metrics,lesson_code,source,source_commit_sha,production_writes,publishes',
    order:'occurred_at.asc',
    limit:String(Math.max(1,Math.min(Number(limit)||200,500)))
  });
  if(text(decision_id)) params.set('decision_id','eq.'+text(decision_id));
  const endpoint=text(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/'+TABLE+'?'+params.toString();
  const response=await fetchImpl(endpoint,{method:'GET',headers:{...headers(env),Accept:'application/json'}});
  const body=await parseJsonSafe(response);
  if(!response.ok || !Array.isArray(body)) throw Object.assign(new Error('decision ledger read failed'),{code:'DECISION_LEDGER_READ_FAILED',status:response.status});
  return {ok:true,rows:body};
}

module.exports={
  TABLE,EVENT_TYPES,DECISION_TYPES,OWNER_ACTIONS,ALLOWED_METRICS,
  configState,sanitizeMetrics,safeSubjectRef,normalizeRow,validateRow,recordEvent,listEvents
};
