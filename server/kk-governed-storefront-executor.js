'use strict';

const Promotion=require('./kk-verifier-storefront-promotion.js');

const VERSION='KK_GOVERNED_STOREFRONT_EXECUTOR_V1';
const DEFAULT_SITE='https://kk-phone-rental.vercel.app';

function text(v){return String(v==null?'':v).trim();}
function enabled(v){return !['0','false','no','off'].includes(text(v).toLowerCase());}

function assertReady(plan){
  if(!plan||plan.status!=='READY_FOR_GOVERNED_ADMIN_CREATE'||plan.admin_action!=='createEvent'||!plan.admin_payload){
    throw Object.assign(new Error('promotion plan is not ready for governed create'),{code:'PROMOTION_PLAN_NOT_READY'});
  }
  if(plan.duplicate_guard_required!==true||plan.exact_storefront_readback_required!==true){
    throw Object.assign(new Error('promotion safety contract missing'),{code:'PROMOTION_SAFETY_CONTRACT_MISSING'});
  }
  return plan;
}

async function adminCreate(plan,{env=process.env,fetchImpl=global.fetch,correlationId=''}={}){
  assertReady(plan);
  if(!enabled(env.KK_GOVERNED_STOREFRONT_EXECUTOR_ENABLED===undefined?'true':env.KK_GOVERNED_STOREFRONT_EXECUTOR_ENABLED)){
    throw Object.assign(new Error('governed storefront executor disabled'),{code:'PROMOTION_EXECUTOR_DISABLED'});
  }
  const pin=text(env.KK_ADMIN_PIN);
  if(!pin) throw Object.assign(new Error('admin credential unavailable'),{code:'PROMOTION_ADMIN_CREDENTIAL_MISSING'});
  if(typeof fetchImpl!=='function') throw Object.assign(new Error('fetch unavailable'),{code:'PROMOTION_FETCH_UNAVAILABLE'});
  const base=text(env.KK_SITE_URL||env.SITE_URL||DEFAULT_SITE).replace(/\/$/,'');
  const payload=Object.assign({},plan.admin_payload,{
    correlation_id:text(correlationId||plan.correlation_id||'')
  });
  const response=await fetchImpl(base+'/api/kk-admin-guard',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-admin-pin':pin,
      'x-kk-promotion-executor':VERSION
    },
    body:JSON.stringify(payload)
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body||body.ok===false){
    const code=text(body&&body.error_code)||('PROMOTION_ADMIN_HTTP_'+String(response.status||0));
    throw Object.assign(new Error(text(body&&body.error)||code),{code,httpStatus:Number(response.status||0),body});
  }
  return body;
}

async function execute(plan,{env=process.env,fetchImpl=global.fetch,readbackFn,correlationId=''}={}){
  assertReady(plan);
  const created=await adminCreate(plan,{env,fetchImpl,correlationId});
  if(typeof readbackFn!=='function'){
    return {
      schema_version:VERSION,
      status:'CREATED_READBACK_REQUIRED',
      create_result:created,
      production_writes:1,
      publishes:1,
      readback_verified:false
    };
  }
  const readback=await readbackFn({plan,created,env,fetchImpl});
  const verified=Promotion.verifyStorefrontReadback(plan,readback||{});
  if(!verified.verified){
    const err=new Error('storefront readback failed');
    err.code='PROMOTION_READBACK_FAILED';
    err.verification=verified;
    throw err;
  }
  return {
    schema_version:VERSION,
    status:'STOREFRONT_PROMOTION_VERIFIED',
    create_result:created,
    verification:verified,
    production_writes:1,
    publishes:1,
    readback_verified:true
  };
}

module.exports={VERSION,DEFAULT_SITE,text,enabled,assertReady,adminCreate,execute};
