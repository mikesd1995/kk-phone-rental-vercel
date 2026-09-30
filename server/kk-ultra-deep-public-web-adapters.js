'use strict';

const VERSION='KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V4';
const MAX_BYTES=1024*1024;
const DEFAULT_TIMEOUT_MS=12000;
const DEFAULT_SEARXNG_ENDPOINT='';
const DDG_MIN_INTERVAL_MS=250;
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
function parseDuckDuckGoHtml(body,query=''){
 const out=[];const seen=new Set();
 const re=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for(const m of String(body||'').matchAll(re)){
   const url=ddgResultUrl(m[1]);if(!url||seen.has(url))continue;
   seen.add(url);
   out.push({title:cleanHtml(m[2])||text(query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null});
   if(out.length>=25)break;
 }
 return out;
}
async function duckDuckGoHtml(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const interval=Number.isFinite(Number(options.ddg_min_interval_ms))?Number(options.ddg_min_interval_ms):DDG_MIN_INTERVAL_MS;
 if(interval>0){
   const wait=Math.max(0,ddgLastRequestAt+interval-Date.now());
   if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
   ddgLastRequestAt=Date.now();
 }
 const u=new URL('https://html.duckduckgo.com/html/');
 u.searchParams.set('q',q);
 const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.ddg_timeout_ms||options.timeout_ms||8000)});
 return parseDuckDuckGoHtml(body,q);
}


function parseBingHtml(body,query=''){
 const out=[];const seen=new Set();
 const blockRe=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
 for(const block of String(body||'').matchAll(blockRe)){
   const m=block[1].match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
   if(!m)continue;
   const url=https(decodeHtmlEntities(m[1]));if(!url||seen.has(url))continue;
   try{const u=new URL(url);if(/(^|\.)bing\.com$/i.test(u.hostname))continue;}catch(_){continue;}
   seen.add(url);
   out.push({title:cleanHtml(m[2])||text(query)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null});
   if(out.length>=25)break;
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
function createProviders(options={}){const out={OFFICIAL_DIRECT:t=>officialDirect(t,options),RSS_OR_PUBLIC_FEED:t=>rssOrPublicFeed(t,options)};if(options.ddg_enabled!==false)out.DDG_HTML=t=>duckDuckGoHtml(t,options);if(options.bing_enabled!==false)out.BING_HTML=t=>bingHtml(t,options);const endpoint=https(options.searxng_endpoint||process.env.KK_SEARXNG_ENDPOINT||DEFAULT_SEARXNG_ENDPOINT);if(endpoint)out.SEARXNG=t=>searxng(t,{...options,searxng_endpoint:endpoint});return out;}
module.exports={VERSION,MAX_BYTES,DEFAULT_TIMEOUT_MS,DEFAULT_SEARXNG_ENDPOINT,DDG_MIN_INTERVAL_MS,decodeHtmlEntities,cleanHtml,decodeEntities,ddgResultUrl,parseDuckDuckGoHtml,parseBingHtml,candidateFromPage,fetchPage,officialDirect,rssOrPublicFeed,duckDuckGoHtml,bingHtml,searxng,createProviders};
