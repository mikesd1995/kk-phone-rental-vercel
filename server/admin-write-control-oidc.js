'use strict';

const CONTROL_PROJECT_REF='mxjnjujqjybqughsnqbz';
const CONTROL_FUNCTION='kk-admin-write-control';
const CONTROL_TIMEOUT_MS=5000;

function text(value){
  return String(value==null?'':value).trim();
}

function endpoint(){
  return `https://${CONTROL_PROJECT_REF}.supabase.co/functions/v1/${CONTROL_FUNCTION}`;
}

async function officialVercelOidcToken(){
  let oidc;
  try{
    oidc=require('@vercel/functions/oidc');
  }catch(_err){
    return '';
  }
  if(!oidc || typeof oidc.getVercelOidcToken!=='function') return '';
  try{
    return text(await oidc.getVercelOidcToken());
  }catch(_err){
    return '';
  }
}

async function resolveOidcToken({getTokenImpl=officialVercelOidcToken}={}){
  if(typeof getTokenImpl!=='function') return '';
  try{return text(await getTokenImpl());}catch(_err){return '';}
}

async function parseJsonSafe(response){
  try{return await response.json();}catch(_err){return null;}
}

function safeRemote(body,status){
  const out={
    ok:body&&body.ok===true,
    authenticated:body&&body.authenticated===true,
    remote_status:Number.isInteger(status)?status:null,
    business_writes:0,
    google_sheet_writes:0
  };
  const fields=['error_code','version','configured','scope','fencing_token','lock_held','acquired','lease_until','released','committed','failed','completed','receipt','command','status','phase','month','start','end','receipt_hash','receipts','read_only'];
  for(const key of fields){
    if(body && Object.prototype.hasOwnProperty.call(body,key)) out[key]=body[key];
  }
  return out;
}

async function call(action,payload={},{
  fetchImpl=global.fetch,
  getTokenImpl=officialVercelOidcToken
}={}){
  const token=await resolveOidcToken({getTokenImpl});
  if(!token){
    return {
      attempted:false,
      ok:false,
      error_code:'VERCEL_OIDC_TOKEN_MISSING',
      business_writes:0,
      google_sheet_writes:0
    };
  }
  if(typeof fetchImpl!=='function'){
    return {
      attempted:false,
      ok:false,
      error_code:'WRITE_CONTROL_FETCH_UNAVAILABLE',
      business_writes:0,
      google_sheet_writes:0
    };
  }

  let response;
  try{
    response=await fetchImpl(endpoint(),{
      method:'POST',
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify(Object.assign({version:'v1',action},payload||{})),
      signal:AbortSignal.timeout(CONTROL_TIMEOUT_MS)
    });
  }catch(err){
    return {
      attempted:true,
      ok:false,
      error_code:String(err&&err.name)==='TimeoutError'?'WRITE_CONTROL_TIMEOUT':'WRITE_CONTROL_TRANSPORT_FAILED',
      business_writes:0,
      google_sheet_writes:0
    };
  }

  const body=await parseJsonSafe(response);
  if(!response.ok || !body || typeof body!=='object'){
    return Object.assign({
      attempted:true,
      ok:false,
      error_code:text(body&&body.error_code)||'WRITE_CONTROL_REMOTE_FAILED'
    },safeRemote(body,response.status));
  }
  return Object.assign({attempted:true},safeRemote(body,response.status));
}

async function health(options){
  return call('health',{},options);
}

async function acquire(requestId,{leaseSeconds=60,...options}={}){
  return call('acquire',{request_id:text(requestId),lease_seconds:leaseSeconds},options);
}

async function release(requestId,fencingToken,options){
  return call('release',{request_id:text(requestId),fencing_token:fencingToken},options);
}

async function receiptGet(requestId,options){
  return call('receiptGet',{request_id:text(requestId)},options);
}

async function receiptPrepare(requestId,writeAction,payloadHash,fencingToken,options){
  return call('receiptPrepare',{
    request_id:text(requestId),
    write_action:text(writeAction),
    payload_hash:text(payloadHash),
    fencing_token:fencingToken
  },options);
}

async function receiptCommit(requestId,fencingToken,resultHash,resultMeta={},options){
  return call('receiptCommit',{
    request_id:text(requestId),
    fencing_token:fencingToken,
    result_hash:text(resultHash),
    result_meta:resultMeta
  },options);
}

async function receiptFail(requestId,fencingToken,errorCode,options){
  return call('receiptFail',{
    request_id:text(requestId),
    fencing_token:fencingToken,
    error_code:text(errorCode)
  },options);
}

function shardReceiptStore(commandId,receipt,options={}){
  return call('shardReceiptStore',{
    request_id:'ultradeep-shard:'+text(commandId)+':'+text(receipt&&receipt.phase)+':'+String(receipt&&receipt.start),
    command_id:text(commandId),receipt
  },options);
}
function shardReceiptList(commandId,phase,options={}){
  return call('shardReceiptList',{
    request_id:'ultradeep-shards-list:'+text(commandId)+':'+text(phase),
    command_id:text(commandId),phase:text(phase)
  },options);
}
module.exports={
  CONTROL_PROJECT_REF,
  CONTROL_FUNCTION,
  CONTROL_TIMEOUT_MS,
  endpoint,
  officialVercelOidcToken,
  resolveOidcToken,
  call,
  health,
  acquire,
  release,
  receiptGet,
  receiptPrepare,
  receiptCommit,
  receiptFail,
  shardReceiptStore,
  shardReceiptList
};
