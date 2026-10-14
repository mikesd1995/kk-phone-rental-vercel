'use strict';
const {REGISTRY}=require('./kk-ultra-deep-source-registry.js');
const OneBangkok=require('./kk-onebangkok-event-detail.js');
const REGISTERED=new Set(Object.values(REGISTRY).flat().map(row=>row.domain).filter(Boolean));
const GENERIC=new Set(['concert','concerts','fanmeeting','fanmeet','fan','meet','meeting','fancon','fansign','showcase','festival','halloween','calendar','schedule','performance','guide','event','events','live','tour','tickets','ticket','official','bangkok','thailand','eventpop','deehuphouse','dee','hup','house','www','com','co','th','me','คอนเสิร์ต','กรุงเทพ','กรุงเทพมหานคร','ประเทศไทย','แฟนมีต','แฟนคอน','แฟนไซน์','เทศกาล']);
const EVENT_RE=/(concert|fan\s*-?\s*meet|fanmeet|fancon|fansign|festival|showcase|live\s+in|tour|halloween|คอนเสิร์ต|แฟนมีต|แฟนคอน|แฟนไซน์|เทศกาล)/i;
const MONTH_WORDS=new Set(['january','february','march','april','may','june','july','august','september','october','november','december','jan','feb','mar','apr','jun','jul','aug','sep','sept','oct','nov','dec']);
function text(value){return String(value==null?'':value).trim();}
function tokens(value){return text(value).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').split(/\s+/).filter(token=>token.length>=3&&!/^\d+$/.test(token)&&!GENERIC.has(token));}
function specificTitle(value){return EVENT_RE.test(text(value))&&tokens(value).some(token=>token.length>=4);}
function queryRelevantTitle(title,query){
 const q=text(query).replace(/\bBangkok\s+Metropolitan\s+Region\s+Thailand\s*$/i,' ')
  .replace(/\bmini\s+concert\b/gi,' ').replace(/(?:^|[\s(])[-+]?site:[^\s)]*\)?/gi,' ');
 const wanted=tokens(q).filter(token=>token.length>=4&&!MONTH_WORDS.has(token));
 const have=new Set(tokens(title));return !wanted.length||wanted.some(token=>have.has(token));
}
function compatibleTitle(lead,page){
 const wanted=[...new Set(tokens(lead))],have=new Set(tokens(page));
 return specificTitle(lead)&&specificTitle(page)&&wanted.length>0&&wanted.length===have.size&&wanted.every(token=>have.has(token));
}
function publicDetailUrl(value){
 const oneBangkok=OneBangkok.publicEventUrl(value);if(oneBangkok)return oneBangkok;
 try{
  const u=new URL(text(value)),host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(u.protocol!=='https:'||u.username||u.password||u.port||!REGISTERED.has(host))return null;
  if(u.pathname.includes('%'))return null;
  if(/(?:^|\/)(?:account|auth|login|logout|checkout|orders?|payment|queue|step|vieworders)(?:[/.\-]|$)/i.test(u.pathname))return null;
  if(host==='eventpop.me'){
   if(!/^\/(?:e\/\d+(?:\/[^/]+|-[^/]+)?\/?|u\/\d+-[^/]+)\/?$/i.test(u.pathname))return null;
  }else if(host==='deehuphouse.com'){
   if(u.pathname!=='/')return null;
  }else return null;
  for(const [key,value] of u.searchParams){
   if(key==='locale'&&/^(en|th)$/i.test(value))continue;
   if(!/^(aff|utm_[a-z_]+)$/i.test(key))return null;
  }
  for(const key of [...u.searchParams.keys()])if(key!=='locale')u.searchParams.delete(key);
  u.hash='';return u.toString();
 }catch(_){return null;}
}
function bounded(value,fallback,max){const n=Number(value);return value===undefined||!Number.isFinite(n)?fallback:Math.max(0,Math.min(max,Math.floor(n)));}
function createFollowup(readPage,options={}){
 const enabled=options.detail_followup_enabled!==false;
 const maxRequests=bounded(options.detail_max_requests,24,24),maxPerCall=bounded(options.detail_max_per_call,2,2);
 const timeout=bounded(options.detail_timeout_ms,2000,2000),maxElapsed=bounded(options.detail_max_elapsed_ms,5000,5000);
 const cache=new Map(),waiters=[],receipts=[];
 const counts={http_requests:0,cache_hits:0,hydrated_rows:0,skipped_rows:0,budget_deferred:0,failed_reads:0,identity_mismatch:0,field_conflicts:0,peak_concurrency:0};
 let active=0,deadline=null;
 const now=()=>Date.now();
 function debt(){counts.budget_deferred++;}
 function checkTime(){if(deadline!==null&&now()>=deadline){const e=new Error('DETAIL_DEADLINE');e.code='DETAIL_DEADLINE';throw e;}}
 async function acquire(){
  while(active>=2)await new Promise(resolve=>waiters.push(resolve));
  checkTime();active++;counts.peak_concurrency=Math.max(counts.peak_concurrency,active);
 }
 function release(){active--;const resolve=waiters.shift();if(resolve)resolve();}
 async function load(url){
  let acquired=false;
  try{
   if(deadline===null)deadline=now()+maxElapsed;
   await acquire();acquired=true;
   const host=new URL(url).hostname.replace(/^www\./,'');
   const result=await readPage(url,{
    timeout_ms:Math.max(1,Math.min(timeout,deadline-now())),
    redirect_guard:next=>{const safe=publicDetailUrl(next);return !!safe&&new URL(safe).hostname.replace(/^www\./,'')===host;},
    redirect_normalize:publicDetailUrl,
    before_request:()=>{checkTime();if(counts.http_requests>=maxRequests){const e=new Error('DETAIL_REQUEST_BUDGET');e.code='DETAIL_REQUEST_BUDGET';throw e;}counts.http_requests++;},
    max_redirects:2,require_html:true
   });
   checkTime();
   const receipt={source_url:url,final_url:result.final_url,observed_at:new Date().toISOString(),status:'PAGE_READ',body_sha256:result.body_sha256};
   if(typeof options.on_detail_receipt==='function'){
    let auditTimer;
    try{
     await Promise.race([Promise.resolve(options.on_detail_receipt(receipt)),new Promise((resolve,reject)=>{auditTimer=setTimeout(()=>{const e=new Error('DETAIL_DEADLINE');e.code='DETAIL_DEADLINE';reject(e);},Math.max(1,deadline-now()));})]);
    }catch(error){if(error&&error.code==='DETAIL_DEADLINE')throw error;const e=new Error('DETAIL_RECEIPT_ERROR');e.code='DETAIL_RECEIPT_ERROR';throw e;}
    finally{clearTimeout(auditTimer);}
   }
   checkTime();
   receipts.push(receipt);return {candidate:result.candidate};
  }catch(error){
   const raw=text(error&&error.code)||text(error&&error.name);
   const code=/^(?:HTTP_\d{3}|HTTPS_URL_REQUIRED|RESPONSE_TOO_LARGE|DETAIL_(?:DEADLINE|REQUEST_BUDGET|REDIRECT_NOT_ALLOWED|REDIRECT_LIMIT|REDIRECT_MISSING|NOT_HTML|RECEIPT_ERROR)|AbortError)$/.test(raw)?raw:'DETAIL_READ_ERROR';
   if(['DETAIL_REQUEST_BUDGET','DETAIL_DEADLINE','AbortError'].includes(code))debt();
   counts.failed_reads++;receipts.push({source_url:url,status:'READ_FAILED',error_class:code.slice(0,80),observed_at:new Date().toISOString()});
   return {candidate:null};
  }finally{if(acquired)release();}
 }
 async function enrich(rows,task={}){
  if(!enabled)return rows;
  const out=[];let newReads=0;
  for(const row of Array.isArray(rows)?rows:[]){
   if(!row||text(row.event_date)||!specificTitle(row.title)||!queryRelevantTitle(row.title,task.query)){counts.skipped_rows++;out.push(row);continue;}
   const url=publicDetailUrl(row.source_url);
   if(!url){counts.skipped_rows++;out.push(row);continue;}
   let pending=cache.get(url);
   if(pending)counts.cache_hits++;
   else{
    if(newReads>=maxPerCall||cache.size>=24||counts.http_requests>=maxRequests||(deadline!==null&&now()>=deadline)||timeout===0||maxElapsed===0){debt();out.push(row);continue;}
    pending=load(url);cache.set(url,pending);newReads++;
   }
   const {candidate}=await pending;
   if(!candidate||!text(candidate.event_date)){out.push(row);continue;}
   if(!compatibleTitle(row.title,candidate.title)){counts.identity_mismatch++;out.push(row);continue;}
   const conflict=(a,b)=>text(a)&&text(b)&&text(a).toLowerCase()!==text(b).toLowerCase();
   if(conflict(row.event_time,candidate.event_time)||conflict(row.venue,candidate.venue)){counts.field_conflicts++;out.push(row);continue;}
   out.push({...row,event_date:candidate.event_date,event_time:row.event_time||candidate.event_time||null,venue:row.venue||candidate.venue||null});
   counts.hydrated_rows++;
  }
  return out;
 }
 return {enrich,readback:()=>({enabled,complete:counts.budget_deferred===0&&counts.failed_reads===0&&counts.identity_mismatch===0&&counts.field_conflicts===0,counts:{...counts},cache_entries:cache.size,receipts:receipts.map(row=>({...row})),authoritative:false,verifier_required:true,production_writes:0})};
}
module.exports={publicDetailUrl,specificTitle,compatibleTitle,createFollowup};
