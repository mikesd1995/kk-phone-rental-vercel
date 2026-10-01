'use strict';

const VERSION='KK_X_SIGNAL_DETECTOR_V2';
const CURRENT_WINDOW_HOURS=48;
const EARLY_WINDOW_HOURS=1;

const SOURCE_GROUPS=Object.freeze({
  kk_actual:'owned',
  official:'official',
  organizer:'official',
  fandom:'community',
  media:'community',
  rental_market:'market',
  ticket_market:'market',
  unknown:'unknown'
});

function cleanText(value){
  return String(value===undefined||value===null?'':value).replace(/\s+/g,' ').trim();
}

function finiteNonNegative(value){
  if(value===undefined||value===null||value==='') return null;
  const normalized=typeof value==='string'?value.replace(/,/g,''):value;
  const n=Number(normalized);
  return Number.isFinite(n)&&n>=0?n:null;
}

function clamp(value,min=0,max=100){
  return Math.max(min,Math.min(max,value));
}

function parseTime(value){
  if(!value) return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
}

function normalizeSourceType(value){
  const raw=cleanText(value).toLowerCase().replace(/[\s-]+/g,'_');
  if(Object.prototype.hasOwnProperty.call(SOURCE_GROUPS,raw)) return raw;
  if(['kk','kk_phone_rental','owned','store','store_actual'].includes(raw)) return 'kk_actual';
  if(['promoter','venue_official','artist_official'].includes(raw)) return 'official';
  if(['fan','fanclub','fan_project','community'].includes(raw)) return 'fandom';
  if(['news','publisher','press'].includes(raw)) return 'media';
  if(['competitor_rental','rental','phone_rental'].includes(raw)) return 'rental_market';
  if(['resale','ticketing','ticket_service','ticket'].includes(raw)) return 'ticket_market';
  return 'unknown';
}

function metricEntry(signal,name){
  const metrics=signal&&signal.metrics&&typeof signal.metrics==='object'?signal.metrics:{};
  const raw=Object.prototype.hasOwnProperty.call(metrics,name)?metrics[name]:signal&&signal[name];
  const globalConfirmed=signal&&(
    signal.metric_labels_confirmed===true ||
    ['structured','explicit_labels','api_structured'].includes(cleanText(signal.metric_provenance).toLowerCase())
  );
  let value=raw;
  let confirmed=globalConfirmed || Boolean(signal&&signal[name+'_label_confirmed']===true);
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    value=raw.value;
    confirmed=confirmed || raw.label_confirmed===true;
  }
  const parsed=finiteNonNegative(value);
  if(parsed===null) return {value:null,confirmed:false,present:value!==undefined&&value!==null&&value!==''};
  return {value:confirmed?parsed:null,confirmed,present:true,raw_value:parsed};
}

function freshnessBand(ageHours){
  if(ageHours===null) return 'UNKNOWN';
  if(ageHours<0) return 'INVALID_FUTURE';
  if(ageHours<=6) return 'HOT';
  if(ageHours<=24) return 'FRESH';
  if(ageHours<=CURRENT_WINDOW_HOURS) return 'RECENT';
  return 'HISTORICAL';
}

function freshnessWeight(band){
  if(band==='HOT') return 1;
  if(band==='FRESH') return 0.8;
  if(band==='RECENT') return 0.5;
  if(band==='HISTORICAL') return 0.15;
  return 0;
}

function reachScore(velocity,band){
  if(velocity===null||velocity<0) return null;
  const base=clamp((Math.log10(velocity+1)/4)*100);
  return Number((base*freshnessWeight(band)).toFixed(2));
}

function engagementScore(rate){
  if(rate===null||rate<0) return null;
  return Number(clamp((rate/0.08)*100).toFixed(2));
}

function normalizeSignal(signal={},options={}){
  const warnings=[];
  const sourceType=normalizeSourceType(signal.source_type||signal.sourceType);
  const sourceGroup=SOURCE_GROUPS[sourceType]||'unknown';
  const nowMs=parseTime(options.now||signal.observed_at||signal.observedAt)||Date.now();
  const publishedMs=parseTime(signal.published_at||signal.publishedAt);
  let ageHours=null;
  if(publishedMs!==null){
    ageHours=(nowMs-publishedMs)/3600000;
    if(ageHours<0) warnings.push('PUBLISHED_AT_IN_FUTURE');
  }else{
    warnings.push('PUBLISHED_AT_MISSING');
  }

  const views=metricEntry(signal,'views');
  if(views.present&&!views.confirmed) warnings.push('UNLABELED_VIEWS_IGNORED');

  const explicitEngagements=metricEntry(signal,'engagements');
  const likes=metricEntry(signal,'likes');
  const reposts=metricEntry(signal,'reposts');
  const replies=metricEntry(signal,'replies');
  const quotes=metricEntry(signal,'quotes');

  let engagementCount=null;
  let engagementComplete=false;
  if(explicitEngagements.confirmed){
    engagementCount=explicitEngagements.value;
    engagementComplete=true;
  }else if(likes.confirmed&&reposts.confirmed&&replies.confirmed){
    engagementCount=likes.value+reposts.value+replies.value+(quotes.confirmed?quotes.value:0);
    engagementComplete=true;
  }else if([likes,reposts,replies,quotes].some(item=>item.present&&!item.confirmed)){
    warnings.push('UNLABELED_ENGAGEMENT_METRICS_IGNORED');
  }else if([likes,reposts,replies].some(item=>item.confirmed)){
    warnings.push('PARTIAL_ENGAGEMENT_METRICS_NOT_SCORED');
  }

  const band=freshnessBand(ageHours);
  const earlyWindow=ageHours!==null&&ageHours>=0&&ageHours<EARLY_WINDOW_HOURS;
  let reachVelocity=null;
  if(views.confirmed&&ageHours!==null&&ageHours>=0){
    const basisHours=Math.max(ageHours,EARLY_WINDOW_HOURS);
    reachVelocity=Number((views.value/basisHours).toFixed(2));
  }

  const eRate=views.confirmed&&views.value>0&&engagementComplete
    ? engagementCount/views.value
    : null;

  const rScore=reachScore(reachVelocity,band);
  const eScore=engagementScore(eRate);

  return {
    schema_version:VERSION,
    source_type:sourceType,
    source_group:sourceGroup,
    source_name:cleanText(signal.source_name||signal.sourceName),
    post_url:cleanText(signal.post_url||signal.url),
    published_at:publishedMs===null?'':new Date(publishedMs).toISOString(),
    observed_at:new Date(nowMs).toISOString(),
    age_hours:ageHours===null?null:Number(ageHours.toFixed(2)),
    freshness:band,
    early_window:earlyWindow,
    metrics:{
      views:views.value,
      engagement_count:engagementCount,
      engagement_rate:eRate===null?null:Number(eRate.toFixed(6)),
      likes:likes.value,
      reposts:reposts.value,
      replies:replies.value,
      quotes:quotes.value,
      reach_velocity_per_hour:reachVelocity
    },
    scores:{
      reach_momentum:rScore,
      engagement_quality:eScore
    },
    metric_quality:{
      views_label_confirmed:views.confirmed,
      engagement_complete:engagementComplete,
      ambiguous_numeric_fragments_ignored:warnings.some(x=>x.startsWith('UNLABELED_'))
    },
    warnings
  };
}

function maxScore(items,path){
  let best=null;
  for(const item of items){
    const value=path(item);
    if(Number.isFinite(value)&&(best===null||value>best)) best=value;
  }
  return best;
}

function weightedAvailable(parts){
  let weighted=0;
  let weight=0;
  for(const part of parts){
    if(!Number.isFinite(part.value)) continue;
    weighted+=part.value*part.weight;
    weight+=part.weight;
  }
  return weight>0?Number((weighted/weight).toFixed(2)):null;
}

function summarizeEventSignals(signals=[],options={}){
  const normalized=Array.isArray(signals)?signals.map(s=>normalizeSignal(s,options)):[];
  const current=normalized.filter(s=>['HOT','FRESH','RECENT'].includes(s.freshness));
  const historical=normalized.filter(s=>s.freshness==='HISTORICAL');

  const owned=current.filter(s=>s.source_group==='owned');
  const official=current.filter(s=>s.source_group==='official'||s.source_group==='community');
  const market=current.filter(s=>s.source_group==='market');

  const ownedReach=maxScore(owned,s=>s.scores.reach_momentum);
  const officialReach=maxScore(official,s=>s.scores.reach_momentum);
  const marketIntent=maxScore(market,s=>s.scores.reach_momentum);
  const engagement=maxScore(current,s=>s.scores.engagement_quality);
  const historicalScaleViews=maxScore(
    historical.filter(s=>s.metric_quality.views_label_confirmed),
    s=>s.metrics.views
  );

  const priorityScore=weightedAvailable([
    {value:officialReach,weight:0.50},
    {value:marketIntent,weight:0.25},
    {value:ownedReach,weight:0.15},
    {value:engagement,weight:0.10}
  ]);

  const groups=new Set(current.filter(s=>s.metric_quality.views_label_confirmed).map(s=>s.source_group));
  const validCurrent=current.filter(s=>s.metric_quality.views_label_confirmed);
  const confidence=groups.size>=2&&validCurrent.length>=2?'high':validCurrent.length>=1?'medium':'low';
  const warnings=[...new Set(normalized.flatMap(s=>s.warnings))];

  return {
    schema_version:VERSION,
    gate:validCurrent.length>0?'PASS':'INSUFFICIENT_CURRENT_EVIDENCE',
    current_signal_count:current.length,
    labeled_current_signal_count:validCurrent.length,
    historical_signal_count:historical.length,
    confidence,
    dimensions:{
      kk_actual_reach_momentum:ownedReach,
      official_fandom_momentum:officialReach,
      rental_ticket_intent:marketIntent,
      engagement_quality:engagement,
      historical_scale_views:historicalScaleViews
    },
    priority_score:priorityScore,
    normalized_signals:normalized,
    warnings,
    interpretation_rule:'Never compare or sum raw official/fandom views directly with rental-market views. Ranking uses freshness-adjusted normalized dimensions; historical reach is context only and never contributes to current priority_score.'
  };
}

function inventoryGate(input={}){
  const hasRemaining=Object.prototype.hasOwnProperty.call(input,'inventory_remaining')||
    Object.prototype.hasOwnProperty.call(input,'phone_inventory_remaining');
  const remaining=finiteNonNegative(
    Object.prototype.hasOwnProperty.call(input,'inventory_remaining')
      ?input.inventory_remaining
      :input.phone_inventory_remaining
  );
  const lensRemaining=finiteNonNegative(input.lens_remaining);
  const lensOnly=input.lens_only_offer===true;

  if(input.inventory_available===false){
    if(lensOnly&&lensRemaining!==null&&lensRemaining>0){
      return {gate:'LENS_ONLY',phone_remaining:remaining,lens_remaining:lensRemaining,direct_phone_rental_eligible:false};
    }
    return {gate:'BLOCKED_NO_PHONE_INVENTORY',phone_remaining:remaining,lens_remaining:lensRemaining,direct_phone_rental_eligible:false};
  }
  if(hasRemaining&&remaining!==null&&remaining<=0){
    if(lensOnly&&lensRemaining!==null&&lensRemaining>0){
      return {gate:'LENS_ONLY',phone_remaining:remaining,lens_remaining:lensRemaining,direct_phone_rental_eligible:false};
    }
    return {gate:'BLOCKED_NO_PHONE_INVENTORY',phone_remaining:remaining,lens_remaining:lensRemaining,direct_phone_rental_eligible:false};
  }
  return {
    gate:'PASS',
    phone_remaining:remaining,
    lens_remaining:lensRemaining,
    direct_phone_rental_eligible:true
  };
}

module.exports={
  VERSION,
  CURRENT_WINDOW_HOURS,
  EARLY_WINDOW_HOURS,
  SOURCE_GROUPS,
  normalizeSourceType,
  normalizeSignal,
  summarizeEventSignals,
  inventoryGate
};
