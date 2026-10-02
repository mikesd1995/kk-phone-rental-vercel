'use strict';

const Router=require('./kk-agent-task-router.js');
const Platform=require('./kk-openai-platform.js');

const VERSION='KK_OPENAI_STAGING_RUNTIME_PROBE_V4_ZERO_COST';
const EXPECTED_BRANCH='feat/openai-platform-agent-layer-v1';

function text(v){return String(v==null?'':v).trim();}
function requestUrl(req){
  try{return new URL(text(req&&req.url)||'/api/kk-intelligence-health','https://kk.invalid');}
  catch(_){return null;}
}
function requested(req){
  const u=requestUrl(req);
  return !!u&&u.searchParams.get('mode')==='openai-staging';
}
async function readJson(req){
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>4096) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw=Buffer.concat(chunks).toString('utf8');
  return raw?JSON.parse(raw):{};
}
function safeAi(row){
  const result=row&&row.result||{};
  const ai=result.ai_review||result.ai_reasoning||result;
  return {
    status:text(result.status),
    ai_status:text(ai&&ai.status),
    model:text(ai&&ai.model),
    blocker:text(ai&&ai.blocker),
    http_status:Number(ai&&ai.http_status)||0,
    provider_error_type:text(ai&&ai.provider_error_type),
    provider_error_code:text(ai&&ai.provider_error_code),
    request_id:text(ai&&ai.request_id),
    production_writes:Number(result.production_writes)||0
  };
}
async function handle(req,res,{json}={}){
  if(typeof json!=='function') throw new Error('JSON_WRITER_REQUIRED');

  const env=process.env;
  const vercelEnv=text(env.VERCEL_ENV).toLowerCase();
  const branch=text(env.VERCEL_GIT_COMMIT_REF);
  const base={
    version:VERSION,
    preview:vercelEnv==='preview',
    branch,
    commit_sha:text(env.VERCEL_GIT_COMMIT_SHA),
    production_writes:0
  };

  if(vercelEnv!=='preview'||branch!==EXPECTED_BRANCH){
    return json(res,404,{ok:false,status:'PREVIEW_ONLY',...base});
  }
  if(text(req&&req.method).toUpperCase()!=='POST'){
    return json(res,405,{ok:false,status:'METHOD_NOT_ALLOWED',...base});
  }

  let body;
  try{body=await readJson(req);}
  catch(_){return json(res,400,{ok:false,status:'INVALID_REQUEST',...base});}
  if(text(body&&body.confirm)!=='RUN_OPENAI_STAGING_PROBE'){
    return json(res,400,{ok:false,status:'CONFIRMATION_REQUIRED',...base});
  }

  const config=Platform.configState(env);
  const configBase={
    ...base,
    platform_requested:config.requested,
    platform_enabled:config.enabled,
    paid_external_ai_allowed:config.paid_external_ai_allowed,
    zero_cost_mode:config.zero_cost_mode,
    api_key_present:config.api_key_present,
    customer_data_allowed:config.allow_customer_data
  };

  if(config.allow_customer_data){
    return json(res,409,{ok:false,status:'CUSTOMER_DATA_GATE_MUST_STAY_DISABLED',...configBase});
  }
  if(config.paid_external_ai_allowed){
    return json(res,409,{ok:false,status:'PAID_EXTERNAL_AI_FORBIDDEN_BY_ZERO_COST_POLICY',...configBase});
  }
  if(config.enabled){
    return json(res,409,{ok:false,status:'PAID_PROVIDER_UNEXPECTEDLY_ENABLED',...configBase});
  }

  let providerRequests=0;
  const noPaidFetch=async()=>{
    providerRequests+=1;
    throw new Error('ZERO_COST_PROVIDER_CALL_ATTEMPTED');
  };

  const storefront=await Router.executeTask('storefront_ai_review',{
    target:'KK Phone Rental zero-cost Preview acceptance',
    metrics:{viewport_width_px:390,viewport_height_px:844,event_card_count:4},
    page_text:'Synthetic zero-cost probe. No customer data.',
    owner_observations:'Paid external AI must remain disabled.'
  },{env,fetchImpl:noPaidFetch});

  const discovery=await Router.executeTask('ultra_deep_ai_reasoning',{
    candidate:{title:'Synthetic Concert',event_date:'2026-12-31',venue:'Synthetic Hall'},
    observations:[],
    evidence:[{source_tier:'OFFICIAL',source_url:'https://example.com/synthetic-event'}],
    known_events:[]
  },{env,fetchImpl:noPaidFetch});

  const storefrontSafe=safeAi(storefront);
  const discoverySafe=safeAi(discovery);
  const allowedDisabled=new Set(['DISABLED_ZERO_COST_POLICY','DISABLED_OPENAI_PLATFORM']);
  const pass=
    providerRequests===0 &&
    allowedDisabled.has(storefrontSafe.ai_status) &&
    allowedDisabled.has(discoverySafe.ai_status) &&
    storefrontSafe.production_writes===0 &&
    discoverySafe.production_writes===0;

  return json(res,pass?200:503,{
    ok:pass,
    status:pass?'ZERO_COST_POLICY_ACTIVE':'ZERO_COST_POLICY_VIOLATION',
    provider_requests:providerRequests,
    ...configBase,
    storefront:storefrontSafe,
    discovery:discoverySafe
  });
}

module.exports={VERSION,EXPECTED_BRANCH,requestUrl,requested,readJson,safeAi,handle};
