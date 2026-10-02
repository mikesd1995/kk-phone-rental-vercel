'use strict';

const path=require('node:path');
const {execFile}=require('node:child_process');

const VERSION='KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V5';
const MAX_BYTES=1024*1024;
const DEFAULT_TIMEOUT_MS=12000;
const DEFAULT_SEARXNG_ENDPOINT='';
const DDG_MIN_INTERVAL_MS=250;
const DEFAULT_DDGS_TIMEOUT_MS=10000;
const DEFAULT_DDGS_MAX_RESULTS=10;
let ddgLastRequestAt=0;
function text(v){return String(v==null?'':v).trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function decodeHtmlEntities(raw){
 return text(raw)
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
  .replace(/&#([0-9]+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
  .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function cleanHtml(raw){return decodeHtmlEntities(text(raw).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function candidateFromPage(url,body,task={}){
 const title=(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
 return {title:cleanHtml(title)||text(task.query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null};
}
async function fetchPage(url,options={}){
 const safe=https(url); if(!safe){const e=new Error('HTTPS_URL_REQUIRED');e.code='HTTPS_URL_REQUIRED';throw e;}
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Number(options.timeout_ms||DEFAULT_TIMEOUT_MS));
 try{
  const r=await (options.fetchFn||fetch)(safe,{method:'GET',redirect:'follow',signal:controller.signal,headers:{'user-agent':'KKPhoneRental-Discovery/1.0'}});
  if(!r.ok){const e=new Error('HTTP_'+r.status);e.code='HTTP_'+r.status;throw e;}
  const len=Number(r.headers&&r.headers.get&&r.headers.get('content-length')||0);if(len>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
  const body=await r.text();if(Buffer.byteLength(body,'utf8')>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
  return body;
 }finally{clearTimeout(timer);}
}
async function officialDirect(task={},options={}){
 const urls=[task.source_url,...(Array.isArray(task.seed_urls)?task.seed_urls:[])].map(https).filter(Boolean).slice(0,10);
 const out=[];for(const url of urls){try{const body=await fetchPage(url,options);out.push(candidateFromPage(url,body,task));}catch(_){}}
 return out;
}
async function rssOrPublicFeed(task={},options={}){
 const urls=(Array.isArray(task.feed_urls)?task.feed_urls:[]).map(https).filter(Boolean).slice(0,10);
 const out=[];for(const url of urls){try{const body=await fetchPage(url,options);const links=[...body.matchAll(/<link[^>]*>(?:<!\[CDATA\[)?(https:\/\/[^<\]\s]+)(?:\]\]>)?<\/link>/gi)].map(m=>https(m[1])).filter(Boolean).slice(0,25);for(const link of links)out.push({title:text(task.query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:link,confidence:null});}catch(_){}}
 return out;
}

function decodeEntities(raw){return decodeHtmlEntities(raw);}
function ddgResultUrl(raw){
 const value=decodeEntities(raw);
 try{
  const u=new URL(value.startsWith('//')?'https:'+value:value);
  if(u.hostname==='duckduckgo.com' && u.pathname.startsWith('/l/')){
   const target=u.searchParams.get('uddg');
   return https(target||'');
  }
  return https(u.toString());
 }catch(_){return '';}
}
function extractAnchors(body){
 const out=[];for(const m of String(body||'').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const attrs=m[1]||'';const href=(attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'';const cls=(attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i)||[])[1]||'';if(href)out.push({href,cls,title:cleanHtml(m[2])});}return out;
}
function parseDuckDuckGoHtml(body,query=''){
 const out=[];const seen=new Set();
 for(const a of extractAnchors(body)){
   if(!/(^|\s)(result__a|result-link)(\s|$)/i.test(a.cls)&&!/duckduckgo\.com\/l\//i.test(a.href))continue;
   const url=ddgResultUrl(a.href);if(!url||seen.has(url))continue;
   try{const u=new URL(url);if(/(^|\.)duckduckgo\.com$/i.test(u.hostname))continue;}catch(_){continue;}
   seen.add(url);out.push({title:a.title||text(query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null});if(out.length>=25)break;
 }
 return out;
}


async function duckDuckGoHtml(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const interval=Number.isFinite(Number(options.ddg_min_interval_ms))?Number(options.ddg_min_interval_ms):DDG_MIN_INTERVAL_MS;
 if(interval>0){const wait=Math.max(0,ddgLastRequestAt+interval-Date.now());if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));ddgLastRequestAt=Date.now();}
 const u=new URL('https://html.duckduckgo.com/html/');u.searchParams.set('q',q);
 const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.ddg_timeout_ms||options.timeout_ms||8000)});
 return parseDuckDuckGoHtml(body,q);
}


function bingResultUrl(raw){
 const value=decodeHtmlEntities(raw);const direct=https(value);if(!direct)return '';
 try{const u=new URL(direct);if(!/(^|\.)bing\.com$/i.test(u.hostname))return direct;
   const target=u.searchParams.get('u')||u.searchParams.get('url')||u.searchParams.get('r');
   if(target){try{return https(Buffer.from(target.replace(/^a1/,'').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))||https(target);}catch(_){return https(target);}}
 }catch(_){}
 return '';
}
function parseBingHtml(body,query=''){
 const out=[];const seen=new Set();
 const blocks=[...String(body||'').matchAll(/<(?:li|div)[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|div)>/gi)].map(m=>m[1]);
 for(const block of blocks){
   const anchors=extractAnchors(block);const a=anchors.find(x=>x.href);if(!a)continue;
   const url=bingResultUrl(a.href);if(!url||seen.has(url))continue;seen.add(url);
   out.push({title:a.title||text(query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null});if(out.length>=25)break;
 }
 return out;
}
async function bingHtml(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const u=new URL('https://www.bing.com/search');u.searchParams.set('q',q);u.searchParams.set('count','25');
 const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.bing_timeout_ms||options.timeout_ms||8000)});
 return parseBingHtml(body,q);
}

async function searxng(task={},options={}){
 const endpoint=https(options.searxng_endpoint||process.env.KK_SEARXNG_ENDPOINT||DEFAULT_SEARXNG_ENDPOINT);if(!endpoint)return [];
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const u=new URL(endpoint);u.searchParams.set('q',q);u.searchParams.set('format','json');u.searchParams.set('language',text(task.language||'th-TH'));
 const body=await fetchPage(u.toString(),options);let data;try{data=JSON.parse(body);}catch(_){const e=new Error('SEARXNG_INVALID_JSON');e.code='SEARXNG_INVALID_JSON';throw e;}
 return (Array.isArray(data.results)?data.results:[]).slice(0,25).map(r=>({title:text(r.title)||q,event_date:null,event_time:null,venue:null,artist:[],source_url:https(r.url),confidence:null})).filter(r=>r.source_url);
}

function execFileJson(command,args,options={}){
 const execFileImpl=options.execFileImpl||execFile;
 const timeout=Math.max(1000,Number(options.timeout_ms||DEFAULT_DDGS_TIMEOUT_MS));
 return new Promise((resolve,reject)=>{
  execFileImpl(command,args,{timeout,maxBuffer:512*1024,windowsHide:true},(error,stdout,stderr)=>{
   if(error){
    const err=new Error('DDGS_PROCESS_FAILED');
    err.code='DDGS_PROCESS_FAILED';
    err.detail=text(stderr).slice(0,300);
    reject(err);
    return;
   }
   try{
    const parsed=JSON.parse(String(stdout||'[]'));
    resolve(Array.isArray(parsed)?parsed:[]);
   }catch(_){
    const err=new Error('DDGS_INVALID_JSON');
    err.code='DDGS_INVALID_JSON';
    reject(err);
   }
  });
 });
}

async function runDdgsSearch(input={},options={}){
 const python=text(options.python_bin||process.env.KK_PYTHON_BIN||'python3');
 const script=text(options.ddgs_script_path)||path.resolve(__dirname,'../scripts/kk-ddgs-search.py');
 const maxResults=Math.max(1,Math.min(Number(input.max_results||DEFAULT_DDGS_MAX_RESULTS)||DEFAULT_DDGS_MAX_RESULTS,25));
 const timeoutSeconds=Math.max(2,Math.min(Math.ceil(Number(options.ddgs_timeout_ms||DEFAULT_DDGS_TIMEOUT_MS)/1000),15));
 return execFileJson(python,[
  script,'--query',text(input.query),
  '--max-results',String(maxResults),
  '--region',text(input.region||'th-th'),
  '--backend',text(input.backend||'auto'),
  '--timeout',String(timeoutSeconds)
 ],{...options,timeout_ms:Number(options.ddgs_timeout_ms||DEFAULT_DDGS_TIMEOUT_MS)+3000});
}

function inferSearchEventDate(value){
 const s=text(value);
 let m=s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 if(m)return `${m[1]}-${m[2]}-${m[3]}`;
 const months={jan:'01',january:'01',feb:'02',february:'02',mar:'03',march:'03',apr:'04',april:'04',may:'05',jun:'06',june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',sept:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12'};
 m=s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
 if(m){const mm=months[m[2].toLowerCase()];return `${m[3]}-${mm}-${String(Number(m[1])).padStart(2,'0')}`;}
 m=s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
 if(m){const mm=months[m[1].toLowerCase()];return `${m[3]}-${mm}-${String(Number(m[2])).padStart(2,'0')}`;}
 return null;
}

async function ddgsTrafilatura(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const runner=typeof options.ddgs_runner==='function'?options.ddgs_runner:runDdgsSearch;
 const rows=await runner({query:q,max_results:Number(options.ddgs_max_results||DEFAULT_DDGS_MAX_RESULTS),region:text(task.region||'th-th'),backend:text(options.ddgs_backend||'auto')},options);
 return (Array.isArray(rows)?rows:[]).slice(0,25).map(r=>({
  title:text(r.title)||q,event_date:inferSearchEventDate([r.title,r.body].filter(Boolean).join(' ')),event_time:null,venue:null,artist:[],
  source_url:https(r.source_url||r.href||r.url),confidence:null
 })).filter(r=>r.source_url);
}

function createProviders(options={}){
 const out={OFFICIAL_DIRECT:t=>officialDirect(t,options),RSS_OR_PUBLIC_FEED:t=>rssOrPublicFeed(t,options)};
 if(options.ddg_enabled!==false)out.DDG_HTML=t=>duckDuckGoHtml(t,options);
 if(options.bing_enabled!==false)out.BING_HTML=t=>bingHtml(t,options);
 const endpoint=https(options.searxng_endpoint||process.env.KK_SEARXNG_ENDPOINT||DEFAULT_SEARXNG_ENDPOINT);
 if(endpoint)out.SEARXNG=t=>searxng(t,{...options,searxng_endpoint:endpoint});
 const ddgsEnabled=options.ddgs_trafilatura_enabled===true || /^(1|true|yes)$/i.test(text(process.env.KK_DDGS_TRAFILATURA_ENABLED));
 if(ddgsEnabled)out.DDGS_TRAFILATURA=t=>ddgsTrafilatura(t,options);
 return out;
}
module.exports={VERSION,MAX_BYTES,DEFAULT_TIMEOUT_MS,DEFAULT_SEARXNG_ENDPOINT,DDG_MIN_INTERVAL_MS,DEFAULT_DDGS_TIMEOUT_MS,DEFAULT_DDGS_MAX_RESULTS,decodeHtmlEntities,cleanHtml,decodeEntities,extractAnchors,ddgResultUrl,bingResultUrl,parseDuckDuckGoHtml,parseBingHtml,candidateFromPage,fetchPage,officialDirect,rssOrPublicFeed,duckDuckGoHtml,bingHtml,searxng,execFileJson,runDdgsSearch,inferSearchEventDate,ddgsTrafilatura,createProviders};
