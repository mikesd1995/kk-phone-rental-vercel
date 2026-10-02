'use strict';

const Router=require('../server/kk-agent-task-router.js');
const Platform=require('../server/kk-openai-platform.js');

const VERSION='KK_OPENAI_STAGING_RUNTIME_PROBE_V1';
const EXPECTED_BRANCH='feat/openai-platform-agent-layer-v1';

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body||{}));
}

async function readJson(req){
  const chunks=[];
  let size=0;
  for await (const chunk of req){
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
    status:String(result.status||''),
    ai_status:String(ai&&ai.status||''),
    model:String(ai&&ai.model||''),
    blocker:String(ai&&ai.blocker||''),
    http_status:Number(ai&&ai.http_status)||0,
    provider_error_type:String(ai&&ai.provider_error_type||''),
    provider_error_code:String(ai&&ai.provider_error_code||''),
    request_id:String(ai&&ai.request_id||''),
    production_writes:Number(result.production_writes)||0
  };
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,status:'METHOD_NOT_ALLOWED',version:VERSION,production_writes:0});

  const env=process.env;
  const vercelEnv=String(env.VERCEL_ENV||'').trim().toLowerCase();
  const branch=String(env.VERCEL_GIT_COMMIT_REF||'').trim();
  if(vercelEnv!=='preview'||branch!==EXPECTED_BRANCH){
    return json(res,404,{ok:false,status:'PREVIEW_ONLY',version:VERSION,production_writes:0});
  }

  if(!String(req.headers&&req.headers['x-vercel-protection-bypass']||'').trim()){
    return json(res,403,{ok:false,status:'PROTECTED_AUTOMATION_REQUIRED',version:VERSION,production_writes:0});
  }

  let body;
  try{body=await readJson(req);}catch(_){
    return json(res,400,{ok:false,status:'INVALID_REQUEST',version:VERSION,production_writes:0});
  }
  if(String(body&&body.confirm||'')!=='RUN_OPENAI_STAGING_PROBE'){
    return json(res,400,{ok:false,status:'CONFIRMATION_REQUIRED',version:VERSION,production_writes:0});
  }

  const config=Platform.configState(env);
  const keyShape=Platform.apiKeyDiagnostics(env.OPENAI_API_KEY);
  const base={
    version:VERSION,
    preview:true,
    branch,
    commit_sha:String(env.VERCEL_GIT_COMMIT_SHA||''),
    platform_enabled:config.enabled,
    api_key_present:config.api_key_present,
    api_key_diagnostics:keyShape,
    customer_data_allowed:config.allow_customer_data,
    production_writes:0
  };

  if(!config.enabled) return json(res,503,{ok:false,status:'OPENAI_PLATFORM_DISABLED',...base});
  if(config.allow_customer_data) return json(res,409,{ok:false,status:'CUSTOMER_DATA_GATE_MUST_STAY_DISABLED',...base});
  if(!config.api_key_present) return json(res,503,{ok:false,status:'OPENAI_API_KEY_MISSING',...base});
  if(!keyShape.starts_with_sk||!keyShape.ascii_token_charset||keyShape.normalized_length<20){
    return json(res,503,{ok:false,status:'OPENAI_API_KEY_SHAPE_INVALID',...base});
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
    ...base,
    storefront:storefrontSafe,
    discovery:discoverySafe
  });
};

module.exports.VERSION=VERSION;
module.exports.EXPECTED_BRANCH=EXPECTED_BRANCH;
module.exports.safeAi=safeAi;
