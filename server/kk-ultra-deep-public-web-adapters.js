'use strict';

const VERSION='KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V1';
const MAX_BYTES=1024*1024;
const DEFAULT_TIMEOUT_MS=12000;
function text(v){return String(v==null?'':v).trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function cleanHtml(raw){return text(raw).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
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
function createProviders(options={}){return {OFFICIAL_DIRECT:t=>officialDirect(t,options),RSS_OR_PUBLIC_FEED:t=>rssOrPublicFeed(t,options)};}
module.exports={VERSION,MAX_BYTES,DEFAULT_TIMEOUT_MS,cleanHtml,candidateFromPage,fetchPage,officialDirect,rssOrPublicFeed,createProviders};
