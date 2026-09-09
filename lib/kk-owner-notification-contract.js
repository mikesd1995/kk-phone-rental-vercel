'use strict';
const {evidenceCount,evidenceTimestamp}=require('./kk-evidence-validation');

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }

function sameIdentity(a={},b={}){
  const keys=['event_key','competitor_key','package_key'];
  return keys.every(k=>text(a[k])&&text(a[k])===text(b[k]));
}

function classifyPriceChange(previous={},current={}){
  const p=Number(previous.price), c=Number(current.price);
  const changed=sameIdentity(previous,current)&&Number.isFinite(p)&&Number.isFinite(c)&&p>0&&c>0&&p!==c;
  return {price_changed:changed,new_market_evidence:!sameIdentity(previous,current)&&Number.isFinite(c)&&c>0,delta:changed?c-p:null};
}

function morningBriefPlan(input={}){
  const date=text(input.bangkok_date);
  if(!evidenceTimestamp(date+'T00:00:00+07:00')) throw new Error('bangkok_date YYYY-MM-DD required');
  const counts=input.counts||{};
  const keys=['new_events','new_p0_p1','competitor_price_changed','ticket_state_changed','other_material'];
  if(keys.some(k=>evidenceCount(counts[k])===null)) throw new Error('MORNING_BRIEF_COUNTS_UNVERIFIED');
  const businessChanges=keys.reduce((s,k)=>s+evidenceCount(counts[k]),0);
  if(!Number.isSafeInteger(businessChanges)) throw new Error('MORNING_BRIEF_COUNTS_UNVERIFIED');
  return {
    line_required:true,
    line_notification_id:`KK-BRIEF-${date.replace(/-/g,'')}-AM`,
    telegram_detail_required:businessChanges>0,
    zero_change:businessChanges===0,
    business_change_count:businessChanges
  };
}

const CRITICAL=new Set(['CANCELLED','POSTPONED','DATE_CHANGE','VENUE_CHANGE','SAME_DAY_P0_MISSED_OPPORTUNITY']);
function ownerRoute(changeType){
  const t=upper(changeType);
  if(CRITICAL.has(t)) return {line:'CONCISE_IMMEDIATE_OR_QUIET_HOURS_RULE',telegram:'DETAIL',critical:true};
  return {line:'MORNING_SUMMARY',telegram:'DETAIL_IF_COMMERCIALLY_USEFUL',critical:false};
}

function providerAckTransition(input={}){
  const prior=upper(input.prior_status||'QUEUED');
  const count=evidenceCount(input.attempt_count);
  if(count===null || count===Number.MAX_SAFE_INTEGER) throw new Error('INVALID_ATTEMPT_COUNT');
  const providerId=text(input.provider_message_id||input.provider_accepted_id);
  const acceptedAt=text(input.accepted_at||input.sent_at);
  const error=text(input.error);
  const validTime=evidenceTimestamp(acceptedAt);
  if(prior==='SENT') {
    if(!providerId || !validTime) throw new Error('SENT_RECEIPT_RECONCILIATION_REQUIRED');
    return {status:'SENT',attempt_count:count,provider_message_id:providerId,accepted_at:acceptedAt,last_error:''};
  }
  if(!['QUEUED','RETRY_WAIT','SENDING'].includes(prior)) throw new Error('NOTIFICATION_STATE_NOT_SEND_ELIGIBLE');
  const attempts=count+1;
  if(providerId&&validTime&&!error){
    return {status:'SENT',attempt_count:attempts,provider_message_id:providerId,accepted_at:acceptedAt,last_error:''};
  }
  return {status:'RETRY_WAIT',attempt_count:attempts,provider_message_id:'',accepted_at:'',last_error:error||'PROVIDER_ACK_MISSING',prior_status:prior};
}

function telegramConsumerDesignAudit(design={}){
  const reasons=[];
  const proven=v=>v===true || v==='TRUE';
  if(!proven(design.ledger_only)) reasons.push('NOT_LEDGER_ONLY');
  if(!proven(design.queued_only)) reasons.push('NOT_QUEUED_ONLY');
  if(!proven(design.provider_id_on_sent)) reasons.push('SENT_WITHOUT_PROVIDER_ID_GUARD');
  if(!proven(design.failure_updates_retry_wait)) reasons.push('NO_FAILURE_TO_RETRY_WAIT_PATH');
  if(!proven(design.attempt_count_increments)) reasons.push('ATTEMPT_COUNT_NOT_INCREMENTAL');
  return {pass:reasons.length===0,reasons};
}

module.exports={classifyPriceChange,morningBriefPlan,ownerRoute,providerAckTransition,telegramConsumerDesignAudit};
