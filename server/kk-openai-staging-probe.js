'use strict';

const Router=require('./kk-agent-task-router.js');
const Platform=require('./kk-openai-platform.js');

const VERSION='KK_OPENAI_STAGING_RUNTIME_PROBE_V3';
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
  try{
    body=await readJson(req);
  }catch(_){
    return json(res,400,{ok:false,status:'INVALID_REQUEST',...base});
  }
  if(text(body&&body.confirm)!=='RUN_OPENAI_STAGING_PROBE'){
    return json(res,400,{ok:false,status:'CONFIRMATION_REQUIRED',...base});
  }

  const config=Platform.configState(env);
  const keyShape=Platform.apiKeyDiagnostics(env.OPENAI_API_KEY);
  const configBase={
    ...base,
    platform_enabled:config.enabled,
    api_key_present:config.api_key_present,
    api_key_diagnostics:keyShape,
    customer_data_allowed:config.allow_customer_data
  };

  if(!config.enabled) return json(res,503,{ok:false,status:'OPENAI_PLATFORM_DISABLED',...configBase});
  if(config.allow_customer_data) return json(res,409,{ok:false,status:'CUSTOMER_DATA_GATE_MUST_STAY_DISABLED',...configBase});
  if(!config.api_key_present) return json(res,503,{ok:false,status:'OPENAI_API_KEY_MISSING',...configBase});
  if(!keyShape.starts_with_sk||!keyShape.ascii_token_charset||keyShape.normalized_length<20){
    return json(res,503,{ok:false,status:'OPENAI_API_KEY_SHAPE_INVALID',...configBase});
  }

  const storefront=await Router.executeTask('storefront_ai_review',{
    target:'KK Phone Rental protected Preview credential acceptance',
    metrics:{viewport_width_px:390,viewport_height_px:844,event_card_count:4},
    page_text:'Synthetic staging probe. No customer data.',
    owner_observations:'Credential/runtime acceptance only; owner visual acceptance remains separate.'
  },{env,fetchImpl:global.fetch});

  const discovery=await Router.executeTask('ultra_deep_ai_reasoning',{
    candidate:{title:'Synthetic Concert',event_date:'2026-12-31',venue:'Synthetic Hall'},
    observations:[],
    evidence:[{source_tier:'OFFICIAL',source_url:'https://example.com/synthetic-event'}],
    known_events:[]
  },{env,fetchImpl:global.fetch});

  const storefrontSafe=safeAi(storefront);
  const discoverySafe=safeAi(discovery);
  const pass=
    storefrontSafe.ai_status==='READY_FOR_DESIGN_SYNTHESIS' &&
    discoverySafe.ai_status==='ADVISORY_READY_FOR_VERIFIER' &&
    storefrontSafe.production_writes===0 &&
    discoverySafe.production_writes===0;

  return json(res,pass?200:503,{
    ok:pass,
    status:pass?'PASS':'BLOCKED',
    ...configBase,
    storefront:storefrontSafe,
    discovery:discoverySafe
  });
}

module.exports={VERSION,EXPECTED_BRANCH,requestUrl,requested,readJson,safeAi,handle};
