'use strict';

const path=require('node:path');
const {execFile}=require('node:child_process');

const VERSION='KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V8';
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
 if(Date.now()<ddgCircuitOpenUntil)return [];
 const interval=Number.isFinite(Number(options.ddg_min_interval_ms))?Number(options.ddg_min_interval_ms):DDG_MIN_INTERVAL_MS;
 if(interval>0){const wait=Math.max(0,ddgLastRequestAt+interval-Date.now());if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));ddgLastRequestAt=Date.now();}
 const u=new URL('https://html.duckduckgo.com/html/');u.searchParams.set('q',q);
 try{
  const body=await fetchPage(u.toString(),{...options,timeout_ms:Number(options.ddg_timeout_ms||options.timeout_ms||8000)});
  return parseDuckDuckGoHtml(body,q);
 }catch(error){
  ddgCircuitOpenUntil=Date.now()+Math.max(1000,Number(options.ddg_circuit_ms||60000));
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


function parseRssItems(body,query=''){
 const out=[];const seen=new Set();
 const raw=String(body||'');
 for(const m of raw.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const item=m[1]||'';
  const title=cleanHtml((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'')||text(query)||null;
  const linkRaw=decodeHtmlEntities(cleanHtml((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''));
  const sourceUrl=https(linkRaw);if(!sourceUrl)continue;
  const description=cleanHtml((item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)||[])[1]||'');
  const dates=[...new Set([...inferSearchEventDates(title),...inferSearchEventDates(description)])].slice(0,7);
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
 return !/[\d/]$/.test(before)&&!/^\d/.test(after)&&
  !/\d\s*(?:-|ถึง|to)\s*$/i.test(before)&&!/^\s*(?:-|ถึง|to)\s*\d/i.test(after);
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
 for(const match of s.matchAll(dayMonth)) add(isoDate(match[3],SEARCH_MONTHS[match[2].toLowerCase()],match[1]));

 const monthDay=new RegExp('\\b('+monthPattern+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b','ig');
 for(const match of s.matchAll(monthDay)) add(isoDate(match[3],SEARCH_MONTHS[match[1].toLowerCase()],match[2]));

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
  const title=text(r.title)||q;
  // A result title is the identity-bearing evidence for a specific event page.
  // Do not cross-product a title-specific date with other dates mentioned in the snippet body.
  const titleDates=inferSearchEventDates(r.title);
  const bodyText=text(r.body);
  const bodyDates=inferSearchEventDates(bodyText);
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
 return out;
}
module.exports={VERSION,MAX_BYTES,DEFAULT_TIMEOUT_MS,DEFAULT_SEARXNG_ENDPOINT,DDG_MIN_INTERVAL_MS,DEFAULT_DDGS_TIMEOUT_MS,DEFAULT_DDGS_MAX_RESULTS,LIVENATION_EVENTS_ENDPOINT,decodeHtmlEntities,cleanHtml,decodeEntities,extractAnchors,ddgResultUrl,bingResultUrl,parseDuckDuckGoHtml,parseBingHtml,parseRssItems,bingRss,candidateFromPage,fetchPage,officialDirect,rssOrPublicFeed,duckDuckGoHtml,bingHtml,LIVENATION_GENERIC_TOKENS,liveNationTargetMonth,liveNationSpecificTokens,liveNationCanonicalUrl,normalizeLiveNationDocument,fetchLiveNationRows,liveNationPublic,searxng,execFileJson,runDdgsSearch,inferSearchEventDates,inferSearchEventDate,ddgsTrafilatura,createProviders};
