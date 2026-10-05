'use strict';

const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Controller=require('./kk-ultra-deep-phase2-controller.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');

const VERSION='KK_ULTRA_DEEP_PHASE2_RUNNER_V1';
const DEFAULT_MAX_ROUNDS=3;
const SEARCH_PROVIDERS=Object.freeze(['LIVENATION_PUBLIC','DDGS_TRAFILATURA','BING_RSS','DDG_HTML','BING_HTML']);
const REJECT_BLOCKERS=new Set(['OUTSIDE_TARGET_MONTH','HTTPS_SOURCE_REQUIRED','EVENT_DATE_REQUIRED']);

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function unique(xs){return [...new Set(xs.map(text).filter(Boolean))];}
function canonicalCandidate(c={}){
 const candidate_id=text(c.candidate_id)||Verifier.eventKey(c);
 return {...c,candidate_id};
}
function freezePool(candidates=[]){
 const out=[];const seen=new Set();
 for(const raw of arr(candidates)){
  const c=canonicalCandidate(raw);
  if(seen.has(c.candidate_id))continue;
  seen.add(c.candidate_id);out.push(c);
 }
 return {frozen:true,count:out.length,candidate_ids:out.map(x=>x.candidate_id),candidates:out};
}
function reasonFromBlockers(blockers=[]){
 const b=arr(blockers).map(x=>text(x).toUpperCase());
 if(b.some(x=>x.includes('IDENTITY')||x.includes('GENERIC')||x.includes('TITLE')))return 'identity ambiguity';
 if(b.some(x=>x.includes('DATE')||x.includes('VENUE')||x.includes('MONTH')))return 'field conflict or incomplete official fields';
 if(b.some(x=>x.includes('FETCH')||x.includes('AUTHORITATIVE')||x.includes('SOURCE')))return 'official source gap';
 return 'official source gap';
}
function disposition(candidate={},verification={}){
 const source=text((verification.candidate&&verification.candidate.source_url)||candidate.source_url);
 const evidence=unique([source]);
 const status=text(verification.event_status).toUpperCase();
 if(verification.verified===true){
  if(['CANCELLED','POSTPONED','RESCHEDULED'].includes(status)){
   return {candidate_id:candidate.candidate_id,title:text((verification.candidate||{}).title)||text(candidate.title),event_date:text((verification.candidate||{}).event_date)||text(candidate.event_date),disposition:'STATUS_CHANGED',reason:status,evidence,status};
  }
  return {candidate_id:candidate.candidate_id,title:text((verification.candidate||{}).title)||text(candidate.title),event_date:text((verification.candidate||{}).event_date)||text(candidate.event_date),disposition:'VERIFIED',reason:'authoritative identity/date/venue verified',evidence,status:status||'ACTIVE_OR_UNCHANGED'};
 }
 const blockers=arr(verification.blockers);
 if(blockers.some(x=>REJECT_BLOCKERS.has(text(x).toUpperCase()))){
  return {candidate_id:candidate.candidate_id,title:text(candidate.title),event_date:text(candidate.event_date),disposition:'REJECT_WITH_REASON',reason:blockers.join(','),evidence};
 }
 return {candidate_id:candidate.candidate_id,title:text(candidate.title),event_date:text(candidate.event_date),disposition:'VERIFY_REQUIRED',reason:reasonFromBlockers(blockers),evidence:evidence.length?evidence:['NO_AUTHORITATIVE_EVIDENCE'],blockers};
}
async function mapLimit(rows,limit,fn){
 const out=new Array(rows.length);let next=0;
 async function worker(){while(true){const i=next++;if(i>=rows.length)return;out[i]=await fn(rows[i],i);}}
 await Promise.all(Array.from({length:Math.min(Math.max(1,limit),rows.length||1)},()=>worker()));
 return out;
}
async function verifyPool(pool,context={},options={}){
 const results=await mapLimit(pool.candidates,Number(options.concurrency||4),async c=>{
  const verification=await Verifier.verifyCandidate(c,{...context,verification_scope:'PHASE2_IDENTITY_STATUS'},{fetchFn:options.fetchImpl||global.fetch,timeout_ms:Number(options.timeout_ms||9000)});
  return {candidate:c,verification,row:disposition(c,verification)};
 });
 return results;
}
const STOPWORDS=new Set(['concert','live','tour','world','bangkok','thailand','official','event','festival','fan','meeting','fanmeeting','fancon','showcase','the','in','at','and','2026']);
function titleTokens(v){
 return text(v).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').split(/\s+/).filter(x=>x.length>1&&!STOPWORDS.has(x));
}
function identityCompatible(original={},verified={}){
 const od=text(original.event_date),vd=text(verified.event_date);
 if(od&&vd&&od!==vd)return false;
 const a=new Set(titleTokens(original.title||original.event_name));
 const b=new Set(titleTokens(verified.title||verified.event_name));
 if(!a.size||!b.size)return false;
 let hit=0;for(const t of a)if(b.has(t))hit++;
 const ratio=hit/Math.min(a.size,b.size);
 const an=[...a].join(' '),bn=[...b].join(' ');
 return ratio>=0.5||an.includes(bn)||bn.includes(an);
}
function recoveryQueries(candidate={}){
 const title=text(candidate.title||candidate.event_name);
 const date=text(candidate.event_date);
 const venue=text(candidate.venue);
 const artist=arr(candidate.artist).map(text).filter(Boolean);
 return unique([
  title+' official '+date,
  title+' official ticket '+date,
  title+' official venue '+date,
  title+' Bangkok '+date,
  ...artist.map(a=>a+' official '+title+' '+date),
  venue?venue+' '+title+' '+date:'',
  'site:thaiticketmajor.com '+title,
  'site:eventpop.me '+title,
  'site:livenationtero.co.th '+title,
  'site:impact.co.th '+title,
  'site:paragonhall.com '+title
 ]);
}
async function recoverCandidate(candidate={},context={},options={}){
 const providers=PublicWeb.createProviders({
  fetchFn:options.fetchImpl||global.fetch,
  ddgs_trafilatura_enabled:true,
  ddg_timeout_ms:Number(options.search_timeout_ms||7000),
  bing_timeout_ms:Number(options.search_timeout_ms||7000),
  bing_rss_timeout_ms:Number(options.search_timeout_ms||7000),
  ddgs_timeout_ms:Number(options.search_timeout_ms||9000)
 });
 const queries=recoveryQueries(candidate);
 const seen=new Set();
 const attempts=[];
 for(const provider of SEARCH_PROVIDERS){
  const fn=providers[provider];if(typeof fn!=='function'){attempts.push({provider,status:'NOT_BOUND'});continue;}
  for(const query of queries){
   let rows=[];
   try{rows=arr(await fn({query,date_window:{start:text(candidate.event_date),end:text(candidate.event_date)}}));}
   catch(error){attempts.push({provider,status:'PROVIDER_ERROR',query,error_class:text(error&&(error.code||error.name))});continue;}
   attempts.push({provider,status:rows.length?'EVIDENCE_FOUND':'NO_EVIDENCE',query,count:rows.length});
   for(const row of rows.slice(0,10)){
    const url=text(row.source_url);if(!url||seen.has(url))continue;seen.add(url);
    const probe={...candidate,title:text(row.title)||text(candidate.title),event_date:text(row.event_date)||text(candidate.event_date),source_url:url};
    const verification=await Verifier.verifyCandidate(probe,{...context,verification_scope:'PHASE2_IDENTITY_STATUS'},{fetchFn:options.fetchImpl||global.fetch,timeout_ms:Number(options.timeout_ms||9000)});
    if(verification.verified===true&&identityCompatible(candidate,verification.candidate||probe)){
      return {recovered:true,verification,attempts};
    }
   }
  }
 }
 return {recovered:false,attempts};
}
async function run(input={},options={}){
 const context={month:text(input.month),location:text(input.location)||'Bangkok Thailand'};
 const pool=freezePool(input.candidates);
 if(!pool.count)return {version:VERSION,status:'PHASE2_HOLD',blockers:['CANDIDATE_MASTER_POOL_EMPTY'],pool,rounds:[],production_writes:0,phase3_started:false};
 const maxRounds=Math.max(1,Math.min(5,Number(input.max_rounds||DEFAULT_MAX_ROUNDS)));
 let verified=await verifyPool(pool,context,options);
 let rows=verified.map(x=>x.row);
 const rounds=[];
 for(let round=1;round<=maxRounds;round++){
  const gate=Controller.next({round,max_rounds:maxRounds,expected_candidate_count:pool.count,expected_candidate_ids:pool.candidate_ids,candidate_master_pool_frozen:true,production_writes:0,results:rows});
  rounds.push({round,status:gate.status,blockers:gate.blockers,learning_misses:gate.learning_misses,recovery_queries:gate.recovery_queries||[],mandatory_expansion:gate.mandatory_expansion||[]});
  if(gate.status==='PHASE2_ACCEPTED')return {version:VERSION,status:'PHASE2_ACCEPTED',pool,results:rows,rounds,controller:gate,production_writes:0,phase3_started:false};
  if(round>=maxRounds)return {version:VERSION,status:'PHASE2_HOLD',pool,results:rows,rounds,controller:gate,unresolved:rows.filter(x=>x.disposition==='VERIFY_REQUIRED'),production_writes:0,phase3_started:false};
  const unresolved=rows.filter(x=>x.disposition==='VERIFY_REQUIRED');
  if(!unresolved.length)continue;
  const byId=new Map(pool.candidates.map(c=>[c.candidate_id,c]));
  const recovered=await mapLimit(unresolved,Number(options.recovery_concurrency||2),async row=>{
   const candidate=byId.get(row.candidate_id);if(!candidate)return {candidate_id:row.candidate_id,recovered:false};
   const out=await recoverCandidate(candidate,context,options);
   return {candidate_id:row.candidate_id,...out};
  });
  const recoveredById=new Map(recovered.filter(x=>x.recovered).map(x=>[x.candidate_id,x]));
  rows=rows.map(row=>{
   const hit=recoveredById.get(row.candidate_id);
   return hit?disposition(byId.get(row.candidate_id),hit.verification):row;
  });
 }
 return {version:VERSION,status:'PHASE2_HOLD',pool,results:rows,rounds,unresolved:rows.filter(x=>x.disposition==='VERIFY_REQUIRED'),production_writes:0,phase3_started:false};
}
module.exports={VERSION,DEFAULT_MAX_ROUNDS,SEARCH_PROVIDERS,freezePool,reasonFromBlockers,disposition,verifyPool,titleTokens,identityCompatible,recoveryQueries,recoverCandidate,run};
