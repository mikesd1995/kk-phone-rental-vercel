'use strict';

const VERSION='kk-ai-observability-v1';
const PROVIDERS=new Set(['LANGFUSE','OTEL','LOCAL']);
const ROLES=new Set(['SCANNER','VERIFIER','CANARY','EVAL']);
const KINDS=new Set(['START','END','ERROR','DECISION','TOOL']);
const ALLOWED_ATTRIBUTES=new Set([
  'run_id','occurrence_id','role','component','operation','provider','source_tier',
  'source_host','candidate_id','event_id','status','latency_ms','input_tokens',
  'output_tokens','cost_usd','model','error_code','decision','confidence',
  'trace_parent','fixture_id'
]);
const FORBIDDEN_AUTHORITY_KEYS=new Set([
  'final_truth','final_truth_mutation','verified','approved','authoritative',
  'business_write','business_writes','production_write','production_writes',
  'sheet_write','machine_sot_write','pricing_write','booking_write',
  'inventory_write','notification_send','notification_sends'
]);
const SENSITIVE_KEYS=/customer|phone|email|line_id|contact|address|note|raw_text|prompt|response|evidence_body|secret|token|cookie|authorization/i;

function text(value){ return String(value==null?'':value).trim(); }

function finiteNumber(value,name,{min=0,max=Number.MAX_SAFE_INTEGER}={}){
  if(value===undefined || value===null || value==='') return undefined;
  const n=Number(value);
  if(!Number.isFinite(n) || n<min || n>max){
    throw Object.assign(new Error(name+' is invalid'),{code:'OBSERVABILITY_NUMBER_INVALID'});
  }
  return n;
}

function sanitizeAttributes(input={}){
  if(!input || typeof input!=='object' || Array.isArray(input)){
    throw Object.assign(new Error('attributes must be an object'),{code:'OBSERVABILITY_ATTRIBUTES_INVALID'});
  }
  const output={};
  for(const [key,value] of Object.entries(input)){
    if(SENSITIVE_KEYS.test(key)){
      throw Object.assign(new Error('sensitive attribute is forbidden: '+key),{code:'OBSERVABILITY_SENSITIVE_FIELD'});
    }
    if(FORBIDDEN_AUTHORITY_KEYS.has(key)){
      throw Object.assign(new Error('authority/write attribute is forbidden: '+key),{code:'OBSERVABILITY_AUTHORITY_FIELD'});
    }
    if(!ALLOWED_ATTRIBUTES.has(key)) continue;
    if(value===undefined || value===null || value==='') continue;
    if(['latency_ms','input_tokens','output_tokens'].includes(key)){
      output[key]=finiteNumber(value,key,{min:0,max:1e9});
      continue;
    }
    if(key==='cost_usd' || key==='confidence'){
      output[key]=finiteNumber(value,key,{min:0,max:1e6});
      continue;
    }
    output[key]=text(value).slice(0,256);
  }
  return output;
}

function buildTraceEvent(input={}){
  const provider=text(input.provider).toUpperCase();
  const role=text(input.role).toUpperCase();
  const kind=text(input.kind).toUpperCase();
  const traceId=text(input.trace_id);
  const spanId=text(input.span_id);
  const name=text(input.name);
  const observedAt=text(input.observed_at || new Date().toISOString());

  if(!PROVIDERS.has(provider)) throw Object.assign(new Error('unsupported observability provider'),{code:'OBSERVABILITY_PROVIDER_INVALID'});
  if(!ROLES.has(role)) throw Object.assign(new Error('unsupported observability role'),{code:'OBSERVABILITY_ROLE_INVALID'});
  if(!KINDS.has(kind)) throw Object.assign(new Error('unsupported observability kind'),{code:'OBSERVABILITY_KIND_INVALID'});
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(traceId)) throw Object.assign(new Error('trace_id format invalid'),{code:'OBSERVABILITY_TRACE_ID_INVALID'});
  if(!/^[A-Za-z0-9._:-]{4,128}$/.test(spanId)) throw Object.assign(new Error('span_id format invalid'),{code:'OBSERVABILITY_SPAN_ID_INVALID'});
  if(!name || name.length>120) throw Object.assign(new Error('trace name invalid'),{code:'OBSERVABILITY_NAME_INVALID'});
  if(Number.isNaN(Date.parse(observedAt))) throw Object.assign(new Error('observed_at invalid'),{code:'OBSERVABILITY_TIME_INVALID'});

  return {
    version:VERSION,
    provider,
    trace_id:traceId,
    span_id:spanId,
    parent_span_id:text(input.parent_span_id) || null,
    role,
    kind,
    name,
    observed_at:new Date(observedAt).toISOString(),
    attributes:sanitizeAttributes(input.attributes || {}),
    authoritative:false,
    verifier_required:role==='SCANNER' || role==='EVAL',
    production_writes:0,
    final_truth_mutation:false,
    notification_sends:0
  };
}

async function emitTrace(event,options={}){
  const validated=buildTraceEvent(event);
  if(options.enabled!==true){
    return {sent:false,reason:'DISABLED',event:validated};
  }
  if(typeof options.sender!=='function'){
    throw Object.assign(new Error('explicit sender required when observability is enabled'),{code:'OBSERVABILITY_SENDER_REQUIRED'});
  }
  const result=await options.sender(validated);
  return {sent:true,reason:'SENT',event:validated,result:result===undefined?null:result};
}

module.exports={
  VERSION,
  PROVIDERS,
  ROLES,
  KINDS,
  ALLOWED_ATTRIBUTES,
  sanitizeAttributes,
  buildTraceEvent,
  emitTrace
};
