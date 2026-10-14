'use strict';

const path=require('node:path');
const {execFile}=require('node:child_process');
const DetailFollowup=require('./kk-public-event-detail-followup.js');
const {createHash}=require('node:crypto');

const VERSION='KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V11';
const MAX_BYTES=1024*1024;
const DEFAULT_TIMEOUT_MS=12000;
const DEFAULT_SEARXNG_ENDPOINT='';
const DDG_MIN_INTERVAL_MS=250;
const DEFAULT_DDGS_TIMEOUT_MS=10000;
const DEFAULT_DDGS_MAX_RESULTS=10;
const LIVENATION_EVENTS_ENDPOINT='https://www.livenationtero.co.th/api/search/events?location=bangkok&page=1';
let ddgLastRequestAt=0;
let ddgCircuitOpenUntil=0;
function text(v){return String(v==null?'':v).trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'&&!u.username&&!u.password?u.toString():'';}catch(_){return '';}}
function decodeHtmlEntities(raw,preserveWhitespace=false){
 return (preserveWhitespace===true?String(raw==null?'':raw):text(raw))
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
  .replace(/&#([0-9]+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
  .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function cleanHtml(raw){return decodeHtmlEntities(text(raw).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function htmlAttributes(tag){
 const attrs={};
 for(const m of String(tag||'').matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=decodeHtmlEntities(m[2]===undefined?m[3]:m[2]);
 return attrs;
}
function uniqueValue(values){const rows=[...new Set(values.filter(Boolean))];return rows.length===1?rows[0]:null;}
function labeledShowTime(value){
 const times=[];
 for(const m of text(value).matchAll(/(?:showtime|เวลาแสดง)\s*:?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)){
  let h=Number(m[1]);const minute=Number(m[2]);
  if(minute>59||h>23||(m[3]&&(h<1||h>12)))return null;
  if(m[3])h=(h%12)+(/pm/i.test(m[3])?12:0);
  times.push(String(h).padStart(2,'0')+':'+m[2]);
 }
 return uniqueValue(times);
}
function pageEventFields(body){
 const meta={};
 for(const m of String(body||'').matchAll(/<meta\b[^>]*>/gi)){
  const a=htmlAttributes(m[0]),key=text(a.property||a.name).toLowerCase();
  if(key)(meta[key]||(meta[key]=[])).push(text(a.content));
 }
 const dates=[],times=[],venues=[];let ambiguousTime=false;
 const type=uniqueValue(meta['og:type']||[]);
 if(/^(event|event_detail)$/i.test(type||'')){
  for(const start of meta['og:start_time']||[]){
   const m=start.match(/^(20\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
   const date=m&&isoDate(m[1],m[2],m[3]);
   const zone=m&&m[7],validZone=zone==='Z'||(zone&&Number(zone.slice(1,3))<24&&Number(zone.slice(4,6))<60);
   if(date&&Number(m[4])<24&&Number(m[5])<60&&Number(m[6]||0)<60&&validZone){dates.push(date);times.push(m[4]+':'+m[5]);}
  }
  venues.push(...(meta['og:location']||[]));
 }
 for(const m of String(body||'').matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)){
  const label=cleanHtml(m[1]),value=cleanHtml(m[2]);
  if(/^(show date|event date|วันแสดง|วันที่แสดง|วันจัดงาน)$/i.test(label)){
   const time=labeledShowTime(value);
   if(/(?:showtime|เวลาแสดง)/i.test(value)&&time===null)ambiguousTime=true;
   dates.push(...inferSearchEventDates(value));times.push(time);
  }
  if(/^(venue|สถานที่จัดงาน|สถานที่แสดง)$/i.test(label))venues.push(value);
 }
 const date=uniqueValue(dates);
 return {event_date:date,event_time:date&&!ambiguousTime?uniqueValue(times):null,venue:uniqueValue(venues)};
}
function pageEvidenceMarkup(body){
 const raw=String(body||'').replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,' ');
 let out='',cursor=0,depth=0;
 for(const m of raw.matchAll(/<\/?template\b[^>]*>/gi)){
  if(/^<\//.test(m[0])){
   if(depth>0&&--depth===0)cursor=m.index+m[0].length;
  }else{
   if(depth===0)out+=raw.slice(cursor,m.index);
   depth++;
  }
 }
 return depth>0?out:out+raw.slice(cursor);
}
function candidateFromPage(url,body,task={}){
 const markup=pageEvidenceMarkup(body);
 const title=(markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
 return {title:cleanHtml(title)||null,...pageEventFields(markup),artist:[],source_url:url,confidence:null};
}
async function fetchPage(url,options={}){
 const safe=https(url); if(!safe){const e=new Error('HTTPS_URL_REQUIRED');e.code='HTTPS_URL_REQUIRED';throw e;}
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Number(options.timeout_ms||DEFAULT_TIMEOUT_MS));
 const guarded=typeof options.redirect_guard==='function';let responseForCleanup=null;
 try{
  let target=safe,r,hops=0;
  while(true){
   if(guarded&&typeof options.redirect_normalize==='function')target=options.redirect_normalize(target)||'';
   if(guarded&&options.redirect_guard(target)!==true){const e=new Error('DETAIL_REDIRECT_NOT_ALLOWED');e.code='DETAIL_REDIRECT_NOT_ALLOWED';throw e;}
   if(typeof options.before_request==='function')options.before_request(target);
   r=await (options.fetchFn||fetch)(target,{method:'GET',redirect:guarded?'manual':'follow',signal:controller.signal,headers:{'user-agent':'KKPhoneRental-Discovery/1.0'}});
   responseForCleanup=r;
   if(!guarded||![301,302,303,307,308].includes(r.status))break;
   if(hops++>=Math.min(2,Number(options.max_redirects??2))){const e=new Error('DETAIL_REDIRECT_LIMIT');e.code='DETAIL_REDIRECT_LIMIT';throw e;}
   const location=r.headers&&r.headers.get&&r.headers.get('location');
   if(!location){const e=new Error('DETAIL_REDIRECT_MISSING');e.code='DETAIL_REDIRECT_MISSING';throw e;}
   const next=new URL(location,target).toString();
   if(options.redirect_guard(next)!==true){const e=new Error('DETAIL_REDIRECT_NOT_ALLOWED');e.code='DETAIL_REDIRECT_NOT_ALLOWED';throw e;}
   if(r.body&&typeof r.body.cancel==='function')Promise.resolve(r.body.cancel()).catch(()=>{});
   target=next;
  }
  if(!r.ok||(options.require_status===200&&r.status!==200)){const e=new Error('HTTP_'+r.status);e.code='HTTP_'+r.status;throw e;}
  if(options.require_html===true&&!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(text(r.headers&&r.headers.get&&r.headers.get('content-type')))){const e=new Error('DETAIL_NOT_HTML');e.code='DETAIL_NOT_HTML';throw e;}
  const len=Number(r.headers&&r.headers.get&&r.headers.get('content-length')||0);if(len>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
  let body;
  if(typeof r.arrayBuffer==='function'){
   let bytes;
   if(guarded&&r.body&&typeof r.body.getReader==='function'){
    const reader=r.body.getReader(),chunks=[];let size=0,rejectAbort;
    const aborted=new Promise((resolve,reject)=>{rejectAbort=()=>{const e=new Error('DETAIL_TIMEOUT');e.name='AbortError';reject(e);};controller.signal.addEventListener('abort',rejectAbort,{once:true});});
    try{
     while(true){
      const part=await Promise.race([reader.read(),aborted]);if(part.done)break;
      size+=part.value.byteLength;
      if(size>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
      chunks.push(Buffer.from(part.value));
     }
     bytes=Buffer.concat(chunks,size);
    }catch(error){Promise.resolve(reader.cancel()).catch(()=>{});throw error;}
    finally{controller.signal.removeEventListener('abort',rejectAbort);try{reader.releaseLock();}catch(_){}}
   }else bytes=Buffer.from(await r.arrayBuffer());
   if(bytes.length>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
   const header=text(r.headers&&r.headers.get&&r.headers.get('content-type'));
   const prefix=bytes.subarray(0,2048).toString('latin1');
   const charset=(header.match(/charset\s*=\s*["']?([^\s;"']+)/i)||prefix.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s;"'>]+)/i)||[])[1]||'utf-8';
   try{body=new TextDecoder(charset).decode(bytes);}catch(_){body=new TextDecoder('utf-8').decode(bytes);}
  }else body=await r.text();
  if(Buffer.byteLength(body,'utf8')>MAX_BYTES){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}
  if(typeof options.on_page_read==='function')options.on_page_read({final_url:target,body_sha256:createHash('sha256').update(body).digest('hex')});
  return body;
 }finally{
  clearTimeout(timer);
  if(guarded||options.require_status===200){
   controller.abort();
   try{if(responseForCleanup&&responseForCleanup.body&&!responseForCleanup.body.locked)Promise.resolve(responseForCleanup.body.cancel()).catch(()=>{});}catch(_){}
  }
 }
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
function matchesSearchSiteScope(url,query=''){
 const tokens=[...text(query).matchAll(/(?:^|[\s(])site:([^\s]*)/gi)];
 if(!tokens.length)return true;
 const scopes=tokens.map(m=>{
  try{const scope=new URL('https://'+m[1].replace(/[),;]+$/,''));return scope.username||scope.password?null:scope;}catch(_){return null;}
 });
 if(scopes.some(scope=>!scope))return false;
 try{
  const target=new URL(url),host=target.hostname.replace(/^www\./i,'').toLowerCase();
  return scopes.some(scope=>{
   const wanted=scope.hostname.replace(/^www\./i,'').toLowerCase();
   return (host===wanted||host.endsWith('.'+wanted))&&(scope.pathname==='/'||target.pathname.startsWith(scope.pathname));
  });
 }catch(_){return false;}
}
const NON_SHOW_DATE_RE=/(?:tickets?\s*(?:on\s+sale|sale)|on\s+sale|published(?:\s+on)?|posted(?:\s+on)?|เปิด(?:ขาย|จำหน่าย)บัตร|วัน(?:ที่)?เปิดขาย|วันที่โพสต์)/i;
function searchEventDates(value){
 const s=text(value);
 const named=[...s.matchAll(/(?:show date|event date|วันแสดง|วันที่แสดง|วันจัดงาน)\s*:?\s*([^|;\n]+)/gi)];
 if(named.length)return [...new Set(named.flatMap(m=>inferSearchEventDates(m[1].split(NON_SHOW_DATE_RE)[0])))];
 return NON_SHOW_DATE_RE.test(s)?[]:inferSearchEventDates(s);
}
function parseDuckDuckGoHtml(body,query=''){
 const out=[];const seen=new Set();
 for(const a of extractAnchors(body)){
   if(!/(^|\s)(result__a|result-link)(\s|$)/i.test(a.cls)&&!/duckduckgo\.com\/l\//i.test(a.href))continue;
   const url=ddgResultUrl(a.href);if(!url||seen.has(url)||!matchesSearchSiteScope(url,query))continue;
   try{const u=new URL(url);if(/(^|\.)duckduckgo\.com$/i.test(u.hostname))continue;}catch(_){continue;}
   seen.add(url);out.push({title:a.title||null,event_date:uniqueValue(searchEventDates(a.title)),event_time:null,venue:null,artist:[],source_url:url,confidence:null});if(out.length>=25)break;
 }
 return out;
}


function hasDdgChallenge(body){
 const markup=String(body||''),tags=/<!--[\s\S]*?(?:-->|$)|<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
 let templateDepth=0,match;
 while((match=tags.exec(markup))){
  const tag=match[0];
  if(/^<!--/.test(tag))continue;
  if(/^<plaintext\b/i.test(tag))break;
  const raw=tag.match(/^<(script|style|textarea|title|xmp|iframe|noembed|noframes|noscript)\b/i);
  if(raw){
   const close=new RegExp('<\\/'+raw[1]+'\\s*>','gi');close.lastIndex=tags.lastIndex;
   const end=close.exec(markup);if(!end)break;tags.lastIndex=end.index+end[0].length;continue;
  }
  if(/^<template\b/i.test(tag)){templateDepth++;continue;}
  if(/^<\/template\b/i.test(tag)){templateDepth=Math.max(0,templateDepth-1);continue;}
  if(templateDepth)continue;
  if(!/^<form\b/i.test(tag))continue;
  let id;
  for(const a of tag.matchAll(/\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
   if(a[1].toLowerCase()==='id'&&id===undefined)id=decodeHtmlEntities(a[2]??a[3]??a[4]??'',true);
  }
  if(/^(challenge|anomaly)-form$/i.test(id||''))return true;
 }
 return false;
}
async function duckDuckGoHtml(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const checkCircuit=()=>{if(Date.now()<ddgCircuitOpenUntil){const e=new Error('DDG_CIRCUIT_OPEN');e.code='DDG_CIRCUIT_OPEN';throw e;}};
 checkCircuit();
 const interval=Number.isFinite(Number(options.ddg_min_interval_ms))?Number(options.ddg_min_interval_ms):DDG_MIN_INTERVAL_MS;
 if(interval>0){const wait=Math.max(0,ddgLastRequestAt+interval-Date.now());if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));ddgLastRequestAt=Date.now();}
 checkCircuit();
 const u=new URL('https://html.duckduckgo.com/html/');u.searchParams.set('q',q);
 try{
  const body=await fetchPage(u.toString(),{...options,require_status:200,timeout_ms:Number(options.ddg_timeout_ms||options.timeout_ms||8000)});
  if(hasDdgChallenge(body)){const e=new Error('DDG_CHALLENGE');e.code='DDG_CHALLENGE';throw e;}
  return parseDuckDuckGoHtml(body,q);
 }catch(error){
  const configured=Number(options.ddg_circuit_ms),cooldown=Number.isFinite(configured)?Math.max(1000,Math.min(60000,configured)):60000;
  ddgCircuitOpenUntil=Date.now()+cooldown;
  throw error;
 }
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
   const url=bingResultUrl(a.href);if(!url||seen.has(url)||!matchesSearchSiteScope(url,query))continue;seen.add(url);
   out.push({title:a.title||null,event_date:uniqueValue(searchEventDates(a.title)),event_time:null,venue:null,artist:[],source_url:url,confidence:null});if(out.length>=25)break;
 }
 return out;
}
async function bingHtml(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const u=new URL('https://www.bing.com/search');u.searchParams.set('q',q);u.searchParams.set('count','25');
 const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.bing_timeout_ms||options.timeout_ms||8000)});
 return parseBingHtml(body,q);
}


function parseRssItems(body,query=''){
 const out=[];const seen=new Set();
 const raw=String(body||'');
 for(const m of raw.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const item=m[1]||'';
  const title=cleanHtml((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'')||null;
  const linkRaw=decodeHtmlEntities(cleanHtml((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''));
  const sourceUrl=https(linkRaw);if(!sourceUrl||!matchesSearchSiteScope(sourceUrl,query))continue;
  const description=cleanHtml((item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)||[])[1]||'');
  const titleDates=searchEventDates(title);
  const dates=(titleDates.length?titleDates:searchEventDates(description)).slice(0,7);
  const rows=dates.length?dates:[null];
  for(const eventDate of rows){
   const key=sourceUrl+'|'+String(eventDate||'');if(seen.has(key))continue;seen.add(key);
   out.push({title,event_date:eventDate,event_time:null,venue:null,artist:[],source_url:sourceUrl,confidence:null});
   if(out.length>=25)return out;
  }
 }
 return out;
}
async function bingRss(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const u=new URL('https://www.bing.com/search');u.searchParams.set('format','rss');u.searchParams.set('q',q);u.searchParams.set('count','25');
 const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.bing_rss_timeout_ms||options.timeout_ms||7000)});
 return parseRssItems(body,q);
}


const LIVENATION_GENERIC_TOKENS=new Set([
 'bangkok','thailand','metro','metropolitan','region','concert','concerts','event','events','calendar',
 'ticket','tickets','artist','artists','fanmeeting','fancon','fansign','festival','showcase','live','tour',
 'official','organizer','promoter','venue','hall','mall','agency','appearance','public',
 'january','february','march','april','may','june','july','august','september','october','november','december',
 'กรุงเทพ','กรุงเทพมหานคร','ประเทศไทย','คอนเสิร์ต','งาน','กิจกรรม','ศิลปิน','แฟนมีต','แฟนคอน','แฟนไซน์','เทศกาล','โชว์เคส'
]);
function liveNationTargetMonth(task={},query=''){
 const start=text(task.date_window&&task.date_window.start);
 if(/^\d{4}-\d{2}/.test(start))return start.slice(0,7);
 const iso=text(query).match(/\b(20\d{2})-(\d{2})\b/);if(iso)return iso[1]+'-'+iso[2];
 const m=text(query).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
 if(m){const month=SEARCH_MONTHS[m[1].toLowerCase()];return m[2]+'-'+String(month).padStart(2,'0');}
 return '';
}
function liveNationSpecificTokens(query=''){
 return text(query).toLowerCase().replace(/\bsite:[a-z0-9.-]+/g,' ').replace(/20\d{2}(?:-\d{2}(?:-\d{2})?)?/g,' ')
  .replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').split(/\s+/).filter(Boolean)
  .filter(token=>token.length>=3&&!LIVENATION_GENERIC_TOKENS.has(token));
}
function liveNationCanonicalUrl(doc={}){
 const localizations=Array.isArray(doc.localizations)?doc.localizations:[];
 const preferred=localizations.find(x=>/^en(?:-|$)/i.test(text(x&&x.cultureName)))||localizations[0]||{};
 return https(preferred.url||doc.url||doc.externalUrl);
}
function normalizeLiveNationDocument(doc={}){
 const eventDate=text(doc.eventDate||doc.eventDateUtc).slice(0,10);
 const sourceUrl=liveNationCanonicalUrl(doc);
 const title=text(doc.name||doc.eventName||doc.title);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||!sourceUrl||!title)return null;
 return {
  title,
  event_date:eventDate,
  event_time:text(doc.showTime)||null,
  venue:text(doc.venue&&doc.venue.name)||null,
  artist:(Array.isArray(doc.lineup)?doc.lineup:[]).map(x=>text(x&&x.name)).filter(Boolean).slice(0,20),
  source_url:sourceUrl,
  confidence:null,
  poster_url:https(doc.image)||null
 };
}
async function fetchLiveNationRows(options={}){
 const body=await fetchPage(LIVENATION_EVENTS_ENDPOINT,{...options,timeout_ms:Number(options.livenation_timeout_ms||options.timeout_ms||8000)});
 let parsed;try{parsed=JSON.parse(body);}catch(_){const e=new Error('LIVENATION_INVALID_JSON');e.code='LIVENATION_INVALID_JSON';throw e;}
 if(parsed&&parsed.hasError===true){const e=new Error('LIVENATION_API_ERROR');e.code='LIVENATION_API_ERROR';throw e;}
 return (Array.isArray(parsed&&parsed.documents)?parsed.documents:[]).map(normalizeLiveNationDocument).filter(Boolean).slice(0,100);
}
async function liveNationPublic(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const loader=typeof options.livenation_loader==='function'?options.livenation_loader:()=>fetchLiveNationRows(options);
 const rows=await loader();
 const month=liveNationTargetMonth(task,q);
 const tokens=liveNationSpecificTokens(q);
 const out=[];
 for(const row of Array.isArray(rows)?rows:[]){
  if(month&&!text(row.event_date).startsWith(month+'-'))continue;
  if(tokens.length){
   const hay=[row.title,row.venue,...(Array.isArray(row.artist)?row.artist:[])].map(text).join(' ').toLowerCase();
   const hits=tokens.filter(token=>hay.includes(token)).length;
   const needed=tokens.length<=2?1:Math.min(2,tokens.length);
   if(hits<needed)continue;
  }
  out.push(row);if(out.length>=25)break;
 }
 return out;
}

async function searxng(task={},options={}){
 const endpoint=https(options.searxng_endpoint||process.env.KK_SEARXNG_ENDPOINT||DEFAULT_SEARXNG_ENDPOINT);if(!endpoint)return [];
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const u=new URL(endpoint);u.searchParams.set('q',q);u.searchParams.set('format','json');u.searchParams.set('language',text(task.language||'th-TH'));
 const body=await fetchPage(u.toString(),options);let data;try{data=JSON.parse(body);}catch(_){const e=new Error('SEARXNG_INVALID_JSON');e.code='SEARXNG_INVALID_JSON';throw e;}
 return (Array.isArray(data.results)?data.results:[]).slice(0,25).map(r=>({title:text(r.title)||null,event_date:null,event_time:null,venue:null,artist:[],source_url:https(r.url),confidence:null})).filter(r=>r.source_url);
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

const SEARCH_MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const SEARCH_THAI_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const SEARCH_THAI_MONTH_ABBR=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function explicitThaiYear(value,era){
 const year=Number(value);
 if(era==='พ.ศ.'||(year>=2543&&year<=2643&&era!=='ค.ศ.'))return year-543;
 return era==='ค.ศ.'&&year>2100?NaN:year;
}
function standaloneDateMatch(value,match){
 // Ranges are not expanded by the Thai/numeric parser. Do not silently keep
 // just the final day of an unsupported range or match inside longer numbers.
 const before=value.slice(0,match.index),after=value.slice(match.index+match[0].length);
 const monthNames=[...Object.keys(SEARCH_MONTHS),...SEARCH_THAI_MONTHS,...SEARCH_THAI_MONTH_ABBR].map(v=>v.replace(/\./g,'\\.')).join('|');
 const priorRangeEnd=new RegExp('\\d{1,2}\\s*(?:'+monthNames+')\\s*(?:(?:20|25|26)\\d{2}\\s*)?(?:-|ถึง|to)\\s*$','i');
 return !/[\d/]$/.test(before)&&!/^\d/.test(after)&&
  !/\d\s*(?:-|ถึง|to)\s*$/i.test(before)&&!/^\s*(?:-|ถึง|to)\s*\d/i.test(after)&&!priorRangeEnd.test(before);
}
function isoDate(year,month,day){
 const y=Number(year),m=Number(month),d=Number(day);
 if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||y<2000||y>2100||m<1||m>12||d<1||d>31)return null;
 const dt=new Date(Date.UTC(y,m-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
 return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function expandDayRange(year,month,startDay,endDay){
 const start=Number(startDay),end=Number(endDay);
 if(!Number.isInteger(start)||!Number.isInteger(end)||end<start||end-start>6)return [];
 const out=[];
 for(let day=start;day<=end;day++){const iso=isoDate(year,month,day);if(!iso)return [];out.push(iso);}
 return out;
}
function inferSearchEventDates(value){
 const s=text(value).replace(/[–—]/g,'-');
 const found=[];
 const add=v=>{if(v&&!found.includes(v))found.push(v);};
 const thaiMonths=[...SEARCH_THAI_MONTHS,...SEARCH_THAI_MONTH_ABBR].map(v=>v.replace(/\./g,'\\.')).join('|');
 const thaiDate=new RegExp('(\\d{1,2})\\s*('+thaiMonths+')\\s*(?:(พ\\.ศ\\.|ค\\.ศ\\.)\\s*)?(\\d{4})(?!\\d)','g');
 for(const match of s.matchAll(thaiDate)){
  if(!standaloneDateMatch(s,match))continue;
  const month=SEARCH_THAI_MONTHS.indexOf(match[2])+1||SEARCH_THAI_MONTH_ABBR.indexOf(match[2])+1;
  add(isoDate(explicitThaiYear(match[4],match[3]),month,match[1]));
 }
 for(const match of s.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g)){
  if(standaloneDateMatch(s,match))add(isoDate(explicitThaiYear(match[3]),match[2],match[1]));
 }
 let m;
 const monthPattern='Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

 m=s.match(new RegExp('\\b('+monthPattern+')\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*-\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b','i'));
 if(m){for(const v of expandDayRange(m[4],SEARCH_MONTHS[m[1].toLowerCase()],m[2],m[3]))add(v);}

 m=s.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*-\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+('+monthPattern+')\\s+(20\\d{2})\\b','i'));
 if(m){for(const v of expandDayRange(m[4],SEARCH_MONTHS[m[3].toLowerCase()],m[1],m[2]))add(v);}

 for(const match of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) add(isoDate(match[1],match[2],match[3]));

 const dayMonth=new RegExp('\\b(\\d{1,2})\\s+('+monthPattern+')\\s+(20\\d{2})\\b','ig');
 for(const match of s.matchAll(dayMonth)) if(standaloneDateMatch(s,match))add(isoDate(match[3],SEARCH_MONTHS[match[2].toLowerCase()],match[1]));

 const monthDay=new RegExp('\\b('+monthPattern+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b','ig');
 for(const match of s.matchAll(monthDay)) if(standaloneDateMatch(s,match))add(isoDate(match[3],SEARCH_MONTHS[match[1].toLowerCase()],match[2]));

 return found.filter(Boolean);
}
function inferSearchEventDate(value){
 return inferSearchEventDates(value)[0]||null;
}

async function ddgsTrafilatura(task={},options={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const runner=typeof options.ddgs_runner==='function'?options.ddgs_runner:runDdgsSearch;
 const rows=await runner({query:q,max_results:Number(options.ddgs_max_results||DEFAULT_DDGS_MAX_RESULTS),region:text(task.region||'th-th'),backend:text(options.ddgs_backend||'auto')},options);
 const out=[];
 for(const r of (Array.isArray(rows)?rows:[]).slice(0,25)){
  const sourceUrl=https(r.source_url||r.href||r.url);if(!sourceUrl)continue;
  const title=text(r.title)||null;
  // A result title is the identity-bearing evidence for a specific event page.
  // Do not cross-product a title-specific date with other dates mentioned in the snippet body.
  const titleDates=searchEventDates(r.title);
  const bodyText=text(r.body);
  const bodyDates=searchEventDates(bodyText);
  // Preserve an explicit bounded series range from the snippet (e.g. Date: Oct 11-13),
  // but never combine a title-specific date with unrelated individual dates in prose.
  const explicitBodyRange=/(?:date\s*:\s*)?(?:[A-Za-z]+\s+\d{1,2}\s*-\s*\d{1,2}|\d{1,2}\s*-\s*\d{1,2}\s+[A-Za-z]+)\s*,?\s*20\d{2}/i.test(bodyText);
  const dates=explicitBodyRange&&bodyDates.length>1?bodyDates:(titleDates.length?titleDates:bodyDates);
  if(dates.length){
   for(const eventDate of dates.slice(0,7)) out.push({title,event_date:eventDate,event_time:null,venue:null,artist:[],source_url:sourceUrl,confidence:null});
  }else{
   out.push({title,event_date:null,event_time:null,venue:null,artist:[],source_url:sourceUrl,confidence:null});
  }
 }
 return out.slice(0,50);
}

function createProviders(options={}){
 const out={OFFICIAL_DIRECT:t=>officialDirect(t,options),RSS_OR_PUBLIC_FEED:t=>rssOrPublicFeed(t,options)};
 let liveNationPromise=null;
 if(options.livenation_enabled!==false)out.LIVENATION_PUBLIC=t=>liveNationPublic(t,{...options,livenation_loader:()=>liveNationPromise||(liveNationPromise=fetchLiveNationRows(options))});
 if(options.bing_rss_enabled!==false)out.BING_RSS=t=>bingRss(t,options);
 if(options.ddg_enabled!==false)out.DDG_HTML=t=>duckDuckGoHtml(t,options);
 if(options.bing_enabled!==false)out.BING_HTML=t=>bingHtml(t,options);
 const endpoint=https(options.searxng_endpoint||process.env.KK_SEARXNG_ENDPOINT||DEFAULT_SEARXNG_ENDPOINT);
 if(endpoint)out.SEARXNG=t=>searxng(t,{...options,searxng_endpoint:endpoint});
 const ddgsEnabled=options.ddgs_trafilatura_enabled===true || /^(1|true|yes)$/i.test(text(process.env.KK_DDGS_TRAFILATURA_ENABLED));
 if(ddgsEnabled)out.DDGS_TRAFILATURA=t=>ddgsTrafilatura(t,options);
 const details=DetailFollowup.createFollowup(async(url,guard)=>{
  let meta;
  const body=await fetchPage(url,{...options,...guard,on_page_read:row=>{meta=row;}});
  return {...meta,candidate:candidateFromPage(url,body)};
 },options);
 for(const name of ['BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA']){
  if(typeof out[name]!=='function')continue;
  const search=out[name];out[name]=async task=>details.enrich(await search(task),task);
 }
 Object.defineProperty(out,'detailReadback',{value:details.readback});
 return out;
}
module.exports={VERSION,MAX_BYTES,DEFAULT_TIMEOUT_MS,DEFAULT_SEARXNG_ENDPOINT,DDG_MIN_INTERVAL_MS,DEFAULT_DDGS_TIMEOUT_MS,DEFAULT_DDGS_MAX_RESULTS,LIVENATION_EVENTS_ENDPOINT,decodeHtmlEntities,cleanHtml,decodeEntities,extractAnchors,ddgResultUrl,bingResultUrl,parseDuckDuckGoHtml,parseBingHtml,parseRssItems,bingRss,candidateFromPage,fetchPage,officialDirect,rssOrPublicFeed,duckDuckGoHtml,bingHtml,LIVENATION_GENERIC_TOKENS,liveNationTargetMonth,liveNationSpecificTokens,liveNationCanonicalUrl,normalizeLiveNationDocument,fetchLiveNationRows,liveNationPublic,searxng,execFileJson,runDdgsSearch,inferSearchEventDates,inferSearchEventDate,ddgsTrafilatura,createProviders};
