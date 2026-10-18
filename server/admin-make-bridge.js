'use strict';

const crypto=require('node:crypto');

const VERSION='admin-make-write-bridge-v1';
const PROTOCOL='kk-admin-write-v1';
const CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
// Legacy commercial writer is prohibited independently of routing/config toggles.
// Use the governed single-writer lane and durable notification outbox instead.
const LEGACY_TRANSPORT_QUARANTINED=true;
const WEBHOOK_URL=null; // retired, never keep a Make webhook capability in source
const MAX_CLOCK_SKEW_MS=2*60*1000;
const ALLOWED_ACTIONS=new Set([
  'healthProbe',
  'createEvent','updateEvent',
  'createPackage','updatePackage',
  'upsertEventOverride','bulkSetEventPackageVisibility',
  'addAssets','updateAsset','deleteAsset',
  'createBooking','updateBooking'
]);

function sha256(value){
  return crypto.createHash('sha256').update(String(value||'')).digest('hex');
}

function stableValuesHash(value){
  let parsed=value;
  if(typeof parsed==='string'){
    try{ parsed=JSON.parse(parsed); }catch(_){ parsed=value; }
  }
  return sha256(JSON.stringify(parsed===undefined?null:parsed));
}

function canonical(envelope){
  const e=envelope||{};
  return [
    String(e.protocol||''),
    String(e.request_id||''),
    String(e.timestamp||''),
    String(e.action||''),
    String(e.read_url||''),
    String(e.write_method||''),
    String(e.write_url||''),
    sha256(String(e.write_body_json||'')),
    String(e.before_hash||''),
    String(e.after_hash||'')
  ].join('\n');
}

function sign(envelope,key){
  return crypto.createHmac('sha256',String(key||'')).update(canonical(envelope)).digest('hex');
}

function timingSafeHexEqual(a,b){
  const left=Buffer.from(String(a||''),'utf8');
  const right=Buffer.from(String(b||''),'utf8');
  return left.length===right.length && crypto.timingSafeEqual(left,right);
}

function normalizePath(value){
  return String(value||'').trim().replace(/^\/+/, '');
}

const ACTION_SHEETS={
  healthProbe:'10_Admin_Health_Check',
  createEvent:'01_Events',updateEvent:'01_Events',
  createPackage:'03_Packages',updatePackage:'03_Packages',
  upsertEventOverride:'04_Event_Overrides',bulkSetEventPackageVisibility:'04_Event_Overrides',
  addAssets:'02_Assets',updateAsset:'02_Assets',deleteAsset:'02_Assets',
  createBooking:'00_Master_Booking',updateBooking:'00_Master_Booking'
};

function pathTargetsSheet(url,sheet){
  const needle="/values/'"+String(sheet)+"'!";
  return String(url||'').includes(needle);
}

function validatePlan(plan){
  const p=plan||{};
  const action=String(p.action||'').trim();
  if(!ALLOWED_ACTIONS.has(action)) return {ok:false,code:'BRIDGE_ACTION_NOT_ALLOWED'};
  const readUrl=normalizePath(p.read_url);
  const writeUrl=normalizePath(p.write_url);
  const prefix='spreadsheets/'+CORE_SHEET_ID+'/values/';
  if(!readUrl.startsWith(prefix)||!writeUrl.startsWith(prefix)) return {ok:false,code:'BRIDGE_SHEET_PATH_NOT_ALLOWED'};
  const expectedSheet=ACTION_SHEETS[action];
  if(!expectedSheet||!pathTargetsSheet(readUrl,expectedSheet)||!pathTargetsSheet(writeUrl,expectedSheet)) return {ok:false,code:'BRIDGE_ACTION_SHEET_MISMATCH'};
  const method=String(p.write_method||'').trim().toUpperCase();
  if(action==='healthProbe'){
    if(method!=='GET'||readUrl!==writeUrl) return {ok:false,code:'BRIDGE_HEALTH_PLAN_INVALID'};
  }else if(!['PUT','POST'].includes(method)){
    return {ok:false,code:'BRIDGE_WRITE_METHOD_NOT_ALLOWED'};
  }
  return {ok:true,action,read_url:readUrl,write_url:writeUrl,write_method:method};
}

function buildEnvelope(plan,key,now=new Date(),requestId){
  const checked=validatePlan(plan);
  if(!checked.ok) throw Object.assign(new Error(checked.code),{code:checked.code});
  if(!key) throw Object.assign(new Error('Bridge signing key missing'),{code:'BRIDGE_SIGNING_KEY_MISSING'});
  const envelope={
    protocol:PROTOCOL,
    request_id:String(requestId||crypto.randomUUID()),
    timestamp:(now instanceof Date?now:new Date(now)).toISOString(),
    action:checked.action,
    read_url:checked.read_url,
    write_method:checked.write_method,
    write_url:checked.write_url,
    write_body_json:String(plan.write_body_json||''),
    before_hash:String(plan.before_hash||''),
    after_hash:String(plan.after_hash||'')
  };
  envelope.signature=sign(envelope,key);
  return envelope;
}

function verifyEnvelope(input,key,now=new Date()){
  const e=input||{};
  if(String(e.protocol||'')!==PROTOCOL) return {ok:false,code:'BRIDGE_PROTOCOL_INVALID'};
  const checked=validatePlan(e);
  if(!checked.ok) return checked;
  const ts=Date.parse(String(e.timestamp||''));
  const current=(now instanceof Date?now:new Date(now)).getTime();
  if(!Number.isFinite(ts)||Math.abs(current-ts)>MAX_CLOCK_SKEW_MS) return {ok:false,code:'BRIDGE_TIMESTAMP_INVALID'};
  if(!/^[0-9a-fA-F-]{16,80}$/.test(String(e.request_id||''))) return {ok:false,code:'BRIDGE_REQUEST_ID_INVALID'};
  if(!key) return {ok:false,code:'BRIDGE_SIGNING_KEY_MISSING'};
  const expected=sign(e,key);
  if(!timingSafeHexEqual(expected,e.signature)) return {ok:false,code:'BRIDGE_SIGNATURE_INVALID'};
  return Object.assign({ok:true},checked);
}

function healthPlan(){
  const url='spreadsheets/'+CORE_SHEET_ID+"/values/'10_Admin_Health_Check'!A4:D8?valueRenderOption=FORMATTED_VALUE";
  return {action:'healthProbe',read_url:url,write_method:'GET',write_url:url,write_body_json:'',before_hash:'',after_hash:''};
}

async function callBridge(plan,options={}){
  // A direct caller must not bypass admin-make-gate's quarantine.
  // Intentionally NOT configurable via environment flags.
  if(LEGACY_TRANSPORT_QUARANTINED){
    const error=new Error('Legacy Make commercial transport is quarantined');
    error.code='BRIDGE_RUNTIME_QUARANTINED';
    throw error;
  }
  const env=options.env||process.env;
  const fetchImpl=options.fetchImpl||global.fetch;
  const timeoutMs=Number(options.timeoutMs||15000);
  const envelope=buildEnvelope(plan,String(env.KK_ADMIN_API_KEY||''),options.now||new Date(),options.requestId);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const started=Date.now();
  try{
    const response=await fetchImpl(WEBHOOK_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','User-Agent':'KK-Admin-Make-Bridge/1'},
      body:JSON.stringify(envelope),
      signal:controller.signal
    });
    const text=await response.text();
    let body=null;
    try{body=JSON.parse(text);}catch(_){}
    return {ok:response.ok,status:Number(response.status||0),body,latency_ms:Date.now()-started,request_id:envelope.request_id};
  }finally{clearTimeout(timer);}
}

module.exports={
  VERSION,PROTOCOL,CORE_SHEET_ID,MAX_CLOCK_SKEW_MS,ALLOWED_ACTIONS,ACTION_SHEETS,
  sha256,stableValuesHash,canonical,sign,timingSafeHexEqual,
  validatePlan,buildEnvelope,verifyEnvelope,healthPlan,callBridge
};
