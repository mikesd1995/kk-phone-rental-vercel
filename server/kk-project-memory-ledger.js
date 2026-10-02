'use strict';

const RuntimeLedger=require('./runtime-ledger.js');
const OidcBridge=require('./runtime-ledger-oidc-bridge.js');
const Memory=require('./kk-project-memory.js');
const TABLE='kk_project_memory_events';

function text(v){return String(v==null?'':v).trim();}
function bool(v){return ['1','true','yes','on'].includes(text(v).toLowerCase());}
function configState(env=process.env){
 const explicit=text(env.KK_PROJECT_MEMORY_LEDGER_ENABLED);
 const url=text(env.SUPABASE_URL).replace(/\/+$/,'');
 const serverKey=RuntimeLedger.resolveServerKey(env);
 const expected=text(env.KK_PROJECT_MEMORY_LEDGER_PROJECT_REF||env.KK_RUNTIME_LEDGER_PROJECT_REF).toLowerCase();
 const actual=RuntimeLedger.projectRefFromUrl(url);
 const projectBindingMatches=!!expected&&actual===expected;
 const productionOidc=text(env.VERCEL_ENV).toLowerCase()==='production';
 const inherited=bool(env.KK_RUNTIME_LEDGER_ENABLED);
 const enabled=explicit?bool(explicit):(inherited||productionOidc);
 const directConfigured=enabled&&!!url&&!!serverKey.value&&projectBindingMatches;
 const oidcCandidate=enabled&&!directConfigured&&productionOidc;
 return {
   enabled,
   configured:directConfigured||oidcCandidate,
   direct_configured:directConfigured,
   oidc_candidate:oidcCandidate,
   project_binding_matches:projectBindingMatches,
   table:TABLE,
   mode:directConfigured?'direct':(oidcCandidate?'oidc':'disabled')
 };
}
function headers(env){const key=RuntimeLedger.resolveServerKey(env).value;return {apikey:key,Authorization:'Bearer '+key};}
async function parseJsonSafe(r){try{return await r.json();}catch(_){return null;}}
function dbRow(item){
 const checked=Memory.normalize(item);
 if(checked.errors.length) throw Object.assign(new Error('project memory invalid'),{code:'PROJECT_MEMORY_EVENT_INVALID',blockers:checked.errors});
 const x=checked.item;
 return {memory_id:x.memory_id,occurred_at:x.occurred_at,kind:x.kind,domain:x.domain,summary:x.summary,evidence_refs:x.evidence_refs,supersedes:x.supersedes[0]||null,status:x.status,source:x.source||'KK_PROJECT_MEMORY_V2',source_commit_sha:text(process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'')};
}
async function listDirect({env,fetchImpl,limit,domains}){
 const params=new URLSearchParams({select:'memory_id,occurred_at,kind,domain,summary,evidence_refs,supersedes,status,source,source_commit_sha',order:'occurred_at.desc',limit:String(Math.max(1,Math.min(Number(limit)||200,500)))});
 const clean=[...new Set((Array.isArray(domains)?domains:[]).map(text).filter(Boolean))];
 if(clean.length) params.set('domain','in.('+clean.join(',')+')');
 const r=await fetchImpl(text(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/'+TABLE+'?'+params,{method:'GET',headers:{...headers(env),Accept:'application/json'}});
 const body=await parseJsonSafe(r);
 if(!r.ok||!Array.isArray(body)) throw Object.assign(new Error('project memory ledger read failed'),{code:'PROJECT_MEMORY_LEDGER_READ_FAILED',status:r.status});
 return body;
}
function normalizeRows(rows){
 return (Array.isArray(rows)?rows:[]).map(x=>({...x,supersedes:Array.isArray(x.supersedes)?x.supersedes:(x.supersedes?[x.supersedes]:[])}));
}
async function listEvents({env=process.env,fetchImpl=global.fetch,getTokenImpl,limit=200,domains=[]}={}){
 const cfg=configState(env);
 if(!cfg.enabled) return {ok:true,enabled:false,mode:'disabled',rows:[]};
 if(typeof fetchImpl!=='function') throw Object.assign(new Error('fetch unavailable'),{code:'PROJECT_MEMORY_LEDGER_FETCH_UNAVAILABLE'});
 if(cfg.direct_configured){
   const rows=await listDirect({env,fetchImpl,limit,domains});
   return {ok:true,enabled:true,mode:'direct',rows:normalizeRows(rows)};
 }
 if(cfg.oidc_candidate){
   const remote=await OidcBridge.readProjectMemory({domains,limit:Math.min(Number(limit)||80,80),fetchImpl,getTokenImpl});
   if(!remote.ok) throw Object.assign(new Error('project memory OIDC read failed'),{code:remote.error_code||'PROJECT_MEMORY_LEDGER_OIDC_UNAVAILABLE',remote_status:remote.remote_status||null});
   return {ok:true,enabled:true,mode:'oidc',rows:normalizeRows(remote.rows)};
 }
 throw Object.assign(new Error('project memory ledger not configured'),{code:'PROJECT_MEMORY_LEDGER_NOT_CONFIGURED'});
}
async function recordEvent({env=process.env,fetchImpl=global.fetch,item}={}){
 const cfg=configState(env);
 if(!cfg.enabled) throw Object.assign(new Error('project memory ledger disabled'),{code:'PROJECT_MEMORY_LEDGER_DISABLED'});
 if(!cfg.direct_configured) throw Object.assign(new Error('project memory ledger write path not configured'),{code:'PROJECT_MEMORY_LEDGER_WRITE_NOT_CONFIGURED'});
 const row=dbRow(item);
 const r=await fetchImpl(text(env.SUPABASE_URL).replace(/\/+$/,'')+'/rest/v1/'+TABLE,{method:'POST',headers:{...headers(env),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify([row])});
 const body=await parseJsonSafe(r);
 if(!r.ok) throw Object.assign(new Error('project memory ledger write failed'),{code:'PROJECT_MEMORY_LEDGER_WRITE_FAILED',status:r.status});
 return {ok:true,memory_id:row.memory_id,inserted:Array.isArray(body)&&body.length===1};
}
module.exports={TABLE,configState,dbRow,listEvents,recordEvent,normalizeRows};
