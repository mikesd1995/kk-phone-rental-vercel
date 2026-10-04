'use strict';

const VERSION='KK_PUBLIC_EVENT_INDEX_PROVIDER_V1';
const DEFAULT_URLS=Object.freeze([
  'https://www.eventpop.me/g/concert?locale=en',
  'https://www.thaiticketmajor.com/search/'
]);
const MAX_ROWS=50;
const GENERIC_TOKENS=new Set([
  'bangkok','thailand','metro','metropolitan','region',
  'concert','concerts','event','events','calendar','ticket','tickets',
  'artist','artists','fanmeeting','fancon','festival','showcase','live',
  'กรุงเทพ','กรุงเทพมหานคร','ประเทศไทย','คอนเสิร์ต','งาน','กิจกรรม',
  'ศิลปิน','แฟนมีต','แฟนคอน','เทศกาล','โชว์เคส','ตุลาคม'
]);
const EN_MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const TH_MONTHS={'ม.ค.':1,'มกราคม':1,'ก.พ.':2,'กุมภาพันธ์':2,'มี.ค.':3,'มีนาคม':3,'เม.ย.':4,'เมษายน':4,'พ.ค.':5,'พฤษภาคม':5,'มิ.ย.':6,'มิถุนายน':6,'ก.ค.':7,'กรกฎาคม':7,'ส.ค.':8,'สิงหาคม':8,'ก.ย.':9,'กันยายน':9,'ต.ค.':10,'ตุลาคม':10,'พ.ย.':11,'พฤศจิกายน':11,'ธ.ค.':12,'ธันวาคม':12};

function text(v){return String(v==null?'':v).trim();}
function cleanHtml(raw){return text(raw).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function resolveHttps(base,raw){try{const u=new URL(text(raw),text(base));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function isoDate(y,m,d){
 y=Number(y);m=Number(m);d=Number(d);
 if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||y<2000||y>2100||m<1||m>12||d<1||d>31)return '';
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
function thaiYear(y){y=Number(y);return y>=2400?y-543:y;}
function addRange(out,y,m,a,b){
 a=Number(a);b=Number(b||a);
 if(!Number.isInteger(a)||!Number.isInteger(b)||b<a||b-a>6)return;
 for(let d=a;d<=b;d++){const v=isoDate(y,m,d);if(v&&!out.includes(v))out.push(v);}
}
function inferDates(value){
 const s=cleanHtml(value).replace(/[–—]/g,'-');
 const out=[];let m;
 for(const x of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)){const v=isoDate(x[1],x[2],x[3]);if(v&&!out.includes(v))out.push(v);}
 const en='Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
 for(const x of s.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*-\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+('+en+')\\s*,?\\s*(20\\d{2})\\b','ig'))){
   addRange(out,x[4],EN_MONTHS[x[3].toLowerCase()],x[1],x[2]);
 }
 for(const x of s.matchAll(new RegExp('\\b('+en+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*-\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s*,?\\s*(20\\d{2})\\b','ig'))){
   addRange(out,x[4],EN_MONTHS[x[1].toLowerCase()],x[2],x[3]);
 }
 const thNames=Object.keys(TH_MONTHS).sort((a,b)=>b.length-a.length).map(v=>v.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')).join('|');
 for(const x of s.matchAll(new RegExp('(\\d{1,2})(?:\\s*-\\s*(\\d{1,2}))?\\s*('+thNames+')\\s*(\\d{4})','g'))){
   addRange(out,thaiYear(x[4]),TH_MONTHS[x[3]],x[1],x[2]);
 }
 return out;
}
function allowedEventUrl(value){
 try{
  const u=new URL(text(value));const host=u.hostname.toLowerCase(),path=u.pathname.toLowerCase();
  if(host==='eventpop.me'||host.endsWith('.eventpop.me'))return /^\/e\/[^/]+/.test(path);
  if(host==='thaiticketmajor.com'||host.endsWith('.thaiticketmajor.com')){
    if(/^\/(?:search|live)(?:\/|$)/.test(path)||/(?:^|\/)index\.(?:html|php)$/.test(path)||/\.(?:png|jpe?g|gif|webp|svg|css|js|ico)$/i.test(path))return false;
    return path.split('/').filter(Boolean).length>=1;
  }
  return false;
 }catch(_){return false;}
}
function bestTitle(inner,context){
 const direct=cleanHtml(inner);
 if(direct&&!/^(buy|buy tickets?|ซื้อบัตร|view|details?|more)$/i.test(direct)&&direct.length>=4)return direct.slice(0,220);
 const headings=[...String(context||'').matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map(m=>cleanHtml(m[1])).filter(Boolean);
 return (headings[headings.length-1]||'').slice(0,220);
}
function parseListing(baseUrl,body){
 const raw=String(body||'');const out=[];const seen=new Set();
 for(const m of raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const attrs=m[1]||'';const href=(attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
  const url=resolveHttps(baseUrl,href);if(!url||!allowedEventUrl(url))continue;
  const start=Math.max(0,(m.index||0)-700),end=Math.min(raw.length,(m.index||0)+m[0].length+900),context=raw.slice(start,end);
  const title=bestTitle(m[2],context);if(!title)continue;
  const dates=inferDates(context);const rows=dates.length?dates.slice(0,7):[''];
  for(const eventDate of rows){
    const key=url+'|'+eventDate+'|'+title.toLowerCase();if(seen.has(key))continue;seen.add(key);
    out.push({title,event_date:eventDate||null,event_time:null,venue:null,artist:[],source_url:url,confidence:null});
    if(out.length>=MAX_ROWS)return out;
  }
 }
 return out;
}
async function fetchPage(url,options={}){
 const safe=https(url);if(!safe)throw Object.assign(new Error('HTTPS_URL_REQUIRED'),{code:'HTTPS_URL_REQUIRED'});
 const fetchFn=options.fetchFn||global.fetch;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Number(options.timeout_ms||7000));
 try{
  const r=await fetchFn(safe,{method:'GET',redirect:'follow',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; KKPhoneRentalDiscovery/2.0)'}});
  if(!r||!r.ok)throw Object.assign(new Error('HTTP_'+String(r&&r.status||0)),{code:'HTTP_'+String(r&&r.status||0)});
  return await r.text();
 }finally{clearTimeout(timer);}
}
async function buildIndex(options={}){
 const urls=(Array.isArray(options.urls)&&options.urls.length?options.urls:DEFAULT_URLS).map(https).filter(Boolean).slice(0,4);
 const pages=await Promise.all(urls.map(async url=>{try{return {url,body:await fetchPage(url,options)};}catch(_){return null;}}));
 const out=[];const seen=new Set();
 for(const page of pages.filter(Boolean)){
  for(const row of parseListing(page.url,page.body)){
   const key=text(row.source_url)+'|'+text(row.event_date)+'|'+text(row.title).toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(row);
   if(out.length>=MAX_ROWS)return out;
  }
 }
 return out;
}
function querySite(value){const m=text(value).match(/\bsite:([a-z0-9.-]+)/i);return m?m[1].toLowerCase():'';}
function targetMonth(task={},query=''){
 const start=text(task.date_window&&task.date_window.start);if(/^\d{4}-\d{2}/.test(start))return start.slice(0,7);
 const iso=text(query).match(/\b(20\d{2})-(\d{2})\b/);if(iso)return iso[1]+'-'+iso[2];
 const en=text(query).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
 if(en)return en[2]+'-'+String(EN_MONTHS[en[1].toLowerCase()]).padStart(2,'0');
 return '';
}
function specificTokens(value){
 return text(value).toLowerCase().replace(/\bsite:[a-z0-9.-]+/g,' ').replace(/20\d{2}(?:-\d{2})?/g,' ').replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ')
  .split(/\s+/).filter(Boolean).filter(v=>v.length>=3&&!GENERIC_TOKENS.has(v));
}
function hostOf(url){try{return new URL(text(url)).hostname.toLowerCase();}catch(_){return '';}}
function searchRows(rows,task={}){
 const q=text(task.query||task.search_query||task.source_tier);if(!q)return [];
 const sourceId=text(task.source_id).toLowerCase();
 const hostHint=querySite(q)||(sourceId==='eventpop'?'eventpop.me':sourceId==='thaiticketmajor'?'thaiticketmajor.com':'');
 const month=targetMonth(task,q),tokens=specificTokens(q),out=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const host=hostOf(row.source_url);if(!host)continue;
  if(hostHint&&!host.endsWith(hostHint))continue;
  if(month&&row.event_date&&!text(row.event_date).startsWith(month+'-'))continue;
  if(tokens.length){
   const hay=text(row.title).toLowerCase();const hits=tokens.filter(t=>hay.includes(t)).length;
   if(hits<Math.min(2,tokens.length))continue;
  }
  out.push(row);if(out.length>=25)break;
 }
 return out;
}
function create(options={}){
 let promise=null;
 return async task=>{
  if(!promise)promise=buildIndex(options);
  return searchRows(await promise,task);
 };
}
module.exports={VERSION,DEFAULT_URLS,MAX_ROWS,GENERIC_TOKENS,EN_MONTHS,TH_MONTHS,cleanHtml,https,resolveHttps,isoDate,inferDates,allowedEventUrl,parseListing,fetchPage,buildIndex,querySite,targetMonth,specificTokens,searchRows,create};
