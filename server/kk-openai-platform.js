'use strict';

const VERSION='KK_OPENAI_PLATFORM_V1';
const DEFAULT_BASE_URL='https://api.openai.com/v1';

function clean(v){return String(v==null?'':v).trim();}
function flag(v){return ['1','true','yes','on'].includes(clean(v).toLowerCase());}
function boundedInt(v,fallback,min,max){
  const n=Number(v);
  if(!Number.isFinite(n)) return fallback;
  return Math.max(min,Math.min(max,Math.trunc(n)));
}
function baseUrl(env={}){
  const raw=clean(env.KK_OPENAI_BASE_URL)||DEFAULT_BASE_URL;
  let url;
  try{url=new URL(raw);}catch(_){return DEFAULT_BASE_URL;}
  if(url.protocol!=='https:'||privateHostname(url.hostname)) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/,'');
}
function modelFor(agent,env={}){
  const key=clean(agent).toLowerCase();
  if(key==='storefront') return clean(env.KK_OPENAI_MODEL_STOREFRONT)||'gpt-6-sol';
  if(key==='discovery') return clean(env.KK_OPENAI_MODEL_DISCOVERY)||'gpt-6-luna';
  if(key==='inbox') return clean(env.KK_OPENAI_MODEL_INBOX)||'gpt-6-luna';
  return clean(env.KK_OPENAI_MODEL_DEFAULT)||'gpt-6-luna';
}
function configState(env={}){
  return {
    version:VERSION,
    enabled:flag(env.KK_OPENAI_PLATFORM_ENABLED),
    api_key_present:!!clean(env.OPENAI_API_KEY),
    allow_customer_data:flag(env.KK_OPENAI_ALLOW_CUSTOMER_DATA),
    base_url:baseUrl(env),
    models:{
      storefront:modelFor('storefront',env),
      discovery:modelFor('discovery',env),
      inbox:modelFor('inbox',env)
    },
    production_writes:0
  };
}
function privateHostname(hostname){
  const host=clean(hostname).toLowerCase().replace(/^\[|\]$/g,'');
  if(!host) return true;
  if(host==='localhost'||host==='::1'||host.endsWith('.local')) return true;
  if(/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)) return true;
  const m=host.match(/^172\.(\d{1,3})\./);
  if(m&&Number(m[1])>=16&&Number(m[1])<=31) return true;
  return false;
}
function allowedImageUrl(value){
  const raw=clean(value);
  if(/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(raw)) return true;
  try{
    const url=new URL(raw);
    return url.protocol==='https:'&&!privateHostname(url.hostname);
  }catch(_){return false;}
}
function extractOutputText(payload={}){
  if(clean(payload.output_text)) return clean(payload.output_text);
  const out=Array.isArray(payload.output)?payload.output:[];
  const chunks=[];
  for(const item of out){
    for(const part of Array.isArray(item&&item.content)?item.content:[]){
      if(part&&part.type==='output_text'&&typeof part.text==='string') chunks.push(part.text);
    }
  }
  return chunks.join('').trim();
}
function hasRefusal(payload={}){
  const out=Array.isArray(payload.output)?payload.output:[];
  return out.some(item=>(Array.isArray(item&&item.content)?item.content:[]).some(part=>part&&part.type==='refusal'));
}
function safeUsage(usage={}){
  return {
    input_tokens:Number(usage.input_tokens)||0,
    output_tokens:Number(usage.output_tokens)||0,
    total_tokens:Number(usage.total_tokens)||0
  };
}
function safety(status,extra={}){
  return {
    version:VERSION,
    status,
    ...extra,
    production_writes:0,
    publishes:0,
    auto_merge:false,
    auto_deploy:false
  };
}
async function callStructured(request={},options={}){
  const env=options.env||process.env;
  const cfg=configState(env);
  const agent=clean(request.agent).toLowerCase();
  if(!cfg.enabled) return safety('DISABLED_OPENAI_PLATFORM',{agent,model:modelFor(agent,env)});
  if(agent==='inbox'&&!cfg.allow_customer_data) return safety('BLOCKED_CUSTOMER_DATA_NOT_AUTHORIZED',{agent,model:modelFor(agent,env)});
  if(!cfg.api_key_present) return safety('BLOCKED_OPENAI_CONFIG',{agent,model:modelFor(agent,env),blocker:'OPENAI_API_KEY_MISSING'});

  const fetchImpl=options.fetchImpl||global.fetch;
  if(typeof fetchImpl!=='function') return safety('BLOCKED_OPENAI_RUNTIME',{agent,blocker:'FETCH_UNAVAILABLE'});

  const schema=request.schema&&typeof request.schema==='object'?request.schema:null;
  if(!schema||!clean(request.schema_name)) return safety('BLOCKED_OPENAI_REQUEST',{agent,blocker:'STRICT_SCHEMA_REQUIRED'});

  const imageUrls=(Array.isArray(request.image_urls)?request.image_urls:[])
    .map(clean).filter(allowedImageUrl).slice(0,4);
  const content=[{type:'input_text',text:clean(request.input_text).slice(0,60000)}];
  for(const imageUrl of imageUrls) content.push({type:'input_image',image_url:imageUrl,detail:'high'});

  const body={
    model:modelFor(agent,env),
    store:false,
    instructions:clean(request.instructions).slice(0,12000),
    input:[{role:'user',content}],
    text:{format:{type:'json_schema',name:clean(request.schema_name).slice(0,64),strict:true,schema}},
    max_output_tokens:boundedInt(request.max_output_tokens,agent==='storefront'?2200:1400,256,5000)
  };

  const timeoutMs=boundedInt(env.KK_OPENAI_TIMEOUT_MS,30000,3000,90000);
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetchImpl(baseUrl(env)+'/responses',{
      method:'POST',
      headers:{
        'authorization':'Bearer '+clean(env.OPENAI_API_KEY),
        'content-type':'application/json',
        'user-agent':'kk-phone-rental/'+VERSION
      },
      body:JSON.stringify(body),
      signal:controller?controller.signal:undefined
    });
    const requestId=clean(response&&response.headers&&typeof response.headers.get==='function'?response.headers.get('x-request-id'):'');
    if(!response||!response.ok){
      return safety('BLOCKED_OPENAI_PROVIDER',{
        agent,model:body.model,http_status:Number(response&&response.status)||0,request_id:requestId,
        blocker:'OPENAI_HTTP_ERROR'
      });
    }
    let payload;
    try{payload=await response.json();}catch(_){
      return safety('BLOCKED_OPENAI_PROVIDER',{agent,model:body.model,http_status:Number(response.status)||0,request_id:requestId,blocker:'OPENAI_INVALID_JSON_RESPONSE'});
    }
    if(hasRefusal(payload)) return safety('BLOCKED_OPENAI_REFUSAL',{agent,model:body.model,response_id:clean(payload.id),request_id:requestId,usage:safeUsage(payload.usage)});
    const text=extractOutputText(payload);
    let output;
    try{output=JSON.parse(text);}catch(_){
      return safety('BLOCKED_OPENAI_OUTPUT',{agent,model:body.model,response_id:clean(payload.id),request_id:requestId,usage:safeUsage(payload.usage),blocker:'STRUCTURED_OUTPUT_PARSE_FAILED'});
    }
    return safety('READY',{
      agent,model:body.model,response_id:clean(payload.id),request_id:requestId,usage:safeUsage(payload.usage),output
    });
  }catch(error){
    const code=clean(error&&(error.name||error.code))||'OPENAI_REQUEST_FAILED';
    return safety('BLOCKED_OPENAI_PROVIDER',{agent,model:body.model,blocker:code});
  }finally{
    if(timer) clearTimeout(timer);
  }
}

module.exports={
  VERSION,DEFAULT_BASE_URL,flag,modelFor,configState,privateHostname,allowedImageUrl,extractOutputText,callStructured
};
