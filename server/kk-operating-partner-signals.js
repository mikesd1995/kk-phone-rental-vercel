'use strict';

const SIGNAL_TYPES=Object.freeze([
  'event_demand',
  'competitor_market',
  'inventory_capacity',
  'booking_velocity',
  'content_performance',
  'revenue',
  'customer_cohort',
  'system_health',
  'storefront_behavior'
]);

const SOURCE_CLASSES=Object.freeze([
  'OFFICIAL',
  'VERIFIED_INTERNAL',
  'MEASURED_ANALYTICS',
  'COMPETITOR_EVIDENCE',
  'SYSTEM_OBSERVABILITY'
]);

const TTL_MINUTES=Object.freeze({
  event_demand:1440,
  competitor_market:720,
  inventory_capacity:60,
  booking_velocity:180,
  content_performance:10080,
  revenue:180,
  customer_cohort:60,
  system_health:30,
  storefront_behavior:1440
});

const METRIC_WHITELIST=Object.freeze({
  event_demand:Object.freeze([
    'demand_score','content_reach_score','source_count','official_source_count',
    'days_to_event','engagement_index'
  ]),
  competitor_market:Object.freeze([
    'competition_gap_score','margin_signal_score','competitor_count','exact_price_sample_count',
    'median_price_thb','kk_price_thb'
  ]),
  inventory_capacity:Object.freeze([
    'inventory_fit_score','capacity_total','capacity_available','utilization_rate'
  ]),
  booking_velocity:Object.freeze([
    'timing_urgency_score','demand_score','bookings_24h','bookings_72h','days_to_event'
  ]),
  content_performance:Object.freeze([
    'content_reach_score','impressions','engagements','profile_visits','link_clicks',
    'inquiries','bookings','revenue_thb','engagement_rate','consideration_rate','conversion_rate'
  ]),
  revenue:Object.freeze([
    'actual_revenue_thb','future_revenue_thb','forecast_revenue_thb'
  ]),
  customer_cohort:Object.freeze([
    'cohort_size','followup_due_count','pickup_due_count','return_due_count',
    'upload_due_count','review_opportunity_count','repeat_customer_count','response_rate'
  ]),
  system_health:Object.freeze([
    'severity_score','error_count','warning_count','latency_ms','failed_checks','total_checks'
  ]),
  storefront_behavior:Object.freeze([
    'search_count','zero_result_search_count','event_detail_views','booking_cta_clicks',
    'search_success_rate','booking_cta_rate'
  ])
});

const SCORE_FIELDS=Object.freeze({
  event_demand:Object.freeze({
    demand_score:'demand_signal',
    content_reach_score:'content_reach'
  }),
  competitor_market:Object.freeze({
    competition_gap_score:'competition_gap',
    margin_signal_score:'margin_signal'
  }),
  inventory_capacity:Object.freeze({
    inventory_fit_score:'inventory_fit'
  }),
  booking_velocity:Object.freeze({
    timing_urgency_score:'timing_urgency',
    demand_score:'demand_signal'
  }),
  content_performance:Object.freeze({
    content_reach_score:'content_reach'
  })
});

function clean(value){return String(value==null?'':value).trim();}
function num(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function bounded(value,min,max){
  const n=num(value);
  return n!=null && n>=min && n<=max;
}
function safeRef(value){
  const v=clean(value);
  if(!v || v.length>180) return false;
  if(!/^[A-Za-z0-9_.:@/-]+$/.test(v)) return false;
  if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return false;
  if(/^\+?[0-9]{8,15}$/.test(v.replace(/[ -]/g,''))) return false;
  return true;
}
function normalizeMetrics(signalType,metrics){
  const allow=new Set(METRIC_WHITELIST[signalType]||[]);
  const input=metrics&&typeof metrics==='object'&&!Array.isArray(metrics)?metrics:{};
  const out={};
  const dropped=[];
  for(const [key,raw] of Object.entries(input)){
    if(!allow.has(key)){
      dropped.push(key);
      continue;
    }
    const n=num(raw);
    if(n==null || n<0){
      dropped.push(key);
      continue;
    }
    out[key]=n;
  }
  return {metrics:out,dropped_metrics:dropped.sort()};
}
function freshness(signalType,observedAt,nowMs=Date.now()){
  const parsed=Date.parse(clean(observedAt));
  if(!Number.isFinite(parsed)){
    return {status:'INVALID_TIMESTAMP',age_minutes:null,ttl_minutes:TTL_MINUTES[signalType]||60,fresh:false};
  }
  const age=Math.max(0,(nowMs-parsed)/60000);
  const ttl=TTL_MINUTES[signalType]||60;
  return {
    status:age<=ttl?'FRESH':'STALE',
    age_minutes:Math.round(age*10)/10,
    ttl_minutes:ttl,
    fresh:age<=ttl
  };
}
function normalizeSignal(input={},options={}){
  const type=clean(input.signal_type).toLowerCase();
  const errors=[];
  if(!SIGNAL_TYPES.includes(type)) errors.push('SIGNAL_TYPE_INVALID');
  if(!safeRef(input.signal_id)) errors.push('SIGNAL_ID_UNSAFE');
  if(!safeRef(input.subject_ref)) errors.push('SUBJECT_REF_UNSAFE');
  const sourceClass=clean(input.source_class).toUpperCase();
  if(!SOURCE_CLASSES.includes(sourceClass)) errors.push('SOURCE_CLASS_INVALID');
  if(!safeRef(input.source_ref)) errors.push('SOURCE_REF_UNSAFE');
  const confidence=num(input.confidence);
  if(!bounded(confidence,0,100)) errors.push('CONFIDENCE_INVALID');
  const metricResult=normalizeMetrics(type,input.metrics);
  const fresh=freshness(type,input.observed_at,options.nowMs==null?Date.now():options.nowMs);
  if(fresh.status==='INVALID_TIMESTAMP') errors.push('OBSERVED_AT_INVALID');
  const normalized={
    schema_version:'KK_OPERATING_PARTNER_SIGNAL_V1',
    signal_id:clean(input.signal_id),
    signal_type:type,
    subject_ref:clean(input.subject_ref),
    observed_at:clean(input.observed_at),
    source_class:sourceClass,
    source_ref:clean(input.source_ref),
    confidence:confidence==null?0:confidence,
    metrics:metricResult.metrics,
    dropped_metrics:metricResult.dropped_metrics,
    freshness:fresh,
    advisory_only:true,
    production_writes:0
  };
  return {signal:normalized,errors};
}
function opportunityInputs(signals=[],options={}){
  const valid=[];
  const rejected=[];
  for(const raw of Array.isArray(signals)?signals:[]){
    const checked=normalizeSignal(raw,options);
    if(checked.errors.length || !checked.signal.freshness.fresh){
      rejected.push({
        signal_id:checked.signal.signal_id,
        signal_type:checked.signal.signal_type,
        errors:checked.errors,
        freshness:checked.signal.freshness.status
      });
      continue;
    }
    const mapping=SCORE_FIELDS[checked.signal.signal_type]||{};
    if(!Object.keys(mapping).length){
      rejected.push({
        signal_id:checked.signal.signal_id,
        signal_type:checked.signal.signal_type,
        errors:['NON_OPPORTUNITY_SIGNAL'],
        freshness:checked.signal.freshness.status
      });
      continue;
    }
    valid.push(checked.signal);
  }
  const bySubject=new Map();
  for(const signal of valid){
    if(!bySubject.has(signal.subject_ref)){
      bySubject.set(signal.subject_ref,{
        subject_ref:signal.subject_ref,
        scores:{},
        confidences:[],
        signal_ids:[]
      });
    }
    const item=bySubject.get(signal.subject_ref);
    item.confidences.push(signal.confidence);
    item.signal_ids.push(signal.signal_id);
    const mapping=SCORE_FIELDS[signal.signal_type]||{};
    for(const [metric,opportunityKey] of Object.entries(mapping)){
      const value=signal.metrics[metric];
      if(value==null || !bounded(value,0,100)) continue;
      const current=item.scores[opportunityKey];
      if(!current || signal.confidence>current.confidence){
        item.scores[opportunityKey]={value,confidence:signal.confidence,signal_id:signal.signal_id};
      }
    }
  }
  const subjects=[...bySubject.values()].map(item=>({
    subject_ref:item.subject_ref,
    evidence_confidence:item.confidences.length
      ? Math.round((item.confidences.reduce((a,b)=>a+b,0)/item.confidences.length)*100)/100
      : 0,
    signals:Object.fromEntries(Object.entries(item.scores).map(([key,v])=>[key,v.value])),
    supporting_signal_ids:item.signal_ids.sort()
  }));
  return {
    schema_version:'KK_OPERATING_PARTNER_SIGNAL_PORTFOLIO_V1',
    valid_signal_count:valid.length,
    rejected_signal_count:rejected.length,
    subjects,
    rejected,
    production_writes:0
  };
}

module.exports={
  SIGNAL_TYPES,
  SOURCE_CLASSES,
  TTL_MINUTES,
  METRIC_WHITELIST,
  SCORE_FIELDS,
  clean,
  safeRef,
  normalizeMetrics,
  freshness,
  normalizeSignal,
  opportunityInputs
};
