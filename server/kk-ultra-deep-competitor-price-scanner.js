'use strict';

const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');

const VERSION='KK_ULTRA_DEEP_COMPETITOR_PRICE_SCANNER_V6';
const BASE_COMPETITORS=Object.freeze([
 'faleem_rent2','minibestt','fundaybuddy','thisisyour3','fejay4rent','by_minnymicky',
 'npforrent','mcjmgoods','winkwink_rent','khaw4rent_2nd'
]);
const DEFAULT_TARGET_COMPETITOR_UNIVERSE=20;
const MAX_COMPETITOR_UNIVERSE=50;
const DEFAULT_DESIRED_EVENT_COMPETITORS=5;
const MAX_DESIRED_EVENT_COMPETITORS=8;
const X_EPOCH_MS=1288834974657n;
const RENTAL_SHOP_SIGNAL=/(?:เช่า|rent(?:al)?|phone|มือถือ|เครื่อง|vivo|x300|lens|เลนส์)/i;

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,' ').replace(/\s+/g,' ').trim();}
function tokens(v){return norm(v).split(' ').filter(x=>x.length>=3);}
function amount(v,min=0,max=Infinity){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
function money(v){const n=amount(v,300,2500);return n&&!(n>=2020&&n<=2035)?n:null;}
function sanitizeNumericContext(v){
 return text(v)
  .replace(/vivo\s*x300\s*pro/gi,'VIVO_MODEL')
  .replace(/vivo\s*x300/gi,'VIVO_MODEL')
  .replace(/vivo\s*x200\s*pro/gi,'VIVO_MODEL')
  .replace(/\b2\.35x?\b/gi,'LENS_MODEL');
}
function titleOverlap(candidateTitle,evidenceText){
 const wanted=tokens(candidateTitle);
 if(!wanted.length)return 0;
 const hay=new Set(tokens(evidenceText));
 const hits=wanted.filter(x=>hay.has(x)).length;
 return hits/wanted.length;
}
function configuredUniverse(options={}){
 const supplied=[
  ...(Array.isArray(options.competitor_universe)?options.competitor_universe:[]),
  ...(Array.isArray(options.learned_competitors)?options.learned_competitors:[])
 ].map(x=>text(x).replace(/^@/,'').toLowerCase()).filter(Boolean);
 return [...new Set([...BASE_COMPETITORS,...supplied])].slice(0,MAX_COMPETITOR_UNIVERSE);
}
function xHandle(url){
 try{
  const u=new URL(text(url));
  if(!/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(u.hostname))return '';
  return (u.pathname.split('/').filter(Boolean)[0]||'').toLowerCase();
 }catch(_){return '';}
}
function xStatusTimestamp(url){
 try{
  const u=new URL(text(url));
  if(!/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(u.hostname))return '';
  const parts=u.pathname.split('/').filter(Boolean);
  const i=parts.findIndex(x=>x==='status');
  if(i<0||!/^\d{10,}$/.test(parts[i+1]||''))return '';
  const ms=(BigInt(parts[i+1])>>22n)+X_EPOCH_MS;
  const d=new Date(Number(ms));
  return Number.isFinite(d.getTime())?d.toISOString():'';
 }catch(_){return '';}
}
function sourceTimestamp(row={},url=''){
 const raw=text(row.source_published_at||row.published_at||row.publishedAt||row.created_at||row.timestamp||row.date);
 if(raw){
  const d=new Date(raw);
  if(Number.isFinite(d.getTime()))return d.toISOString();
 }
 return xStatusTimestamp(url);
}
function competitorFromUrl(url,universe=BASE_COMPETITORS,evidenceText=''){
 const handle=xHandle(url);if(!handle)return '';
 const known=(Array.isArray(universe)?universe:BASE_COMPETITORS).map(x=>text(x).toLowerCase());
 if(known.includes(handle))return handle;
 return RENTAL_SHOP_SIGNAL.test(text(evidenceText))?handle:'';
}
function allAmountMentions(value,min=0,max=Infinity){
 const s=sanitizeNumericContext(value).replace(/,/g,'');
 const re=/(?:฿\s*)?(\d{2,4})(?:\s*(?:บาท|thb|฿|\.-))?/gi;
 const out=[];
 for(const m of s.matchAll(re)){
  const raw=Number(m[1]);
  if(raw>=2020&&raw<=2035)continue;
  const n=amount(raw,min,max);if(n!==null)out.push({value:n,index:m.index||0,raw:m[0]});
 }
 return out;
}
function allMoneyMentions(value){return allAmountMentions(value,300,2500);}
function keywordAmount(value,keywordRe,maxGap=28,min=0,max=Infinity){
 const s=sanitizeNumericContext(value).replace(/,/g,'');
 const out=[];
 const re=new RegExp(keywordRe.source,'gi');
 for(const m of s.matchAll(re)){
  const tail=s.slice((m.index||0)+m[0].length,(m.index||0)+m[0].length+maxGap);
  const matches=allAmountMentions(tail,min,max);
  if(matches.length)out.push({value:matches[0].value,index:(m.index||0),keyword:m[0]});
 }
 return out;
}
function keywordMoney(value,keywordRe,maxGap=28){return keywordAmount(value,keywordRe,maxGap,300,2500);}
function parseRentalOffer(value){
 const raw=text(value);const s=raw.replace(/,/g,'');
 const deposits=keywordAmount(s,/(?:มัดจำ|deposit|ประกัน)/i,24,100,5000);
 const lensAdds=keywordAmount(s,/(?:lens|เลนส์|zeiss)/i,24,50,1000).filter(x=>{
  const around=s.slice(x.index,Math.min(s.length,x.index+32));return /\+/.test(around)||x.value<500;
 });
 const explicitRental=[
  ...keywordMoney(s,/(?:ราคาเช่า|ค่าเช่า|เช่า|rental|rent|เครื่อง)/i,34),
  ...keywordMoney(s,/(?:phone|มือถือ|vivo\s*x300(?:\s*pro)?)/i,28)
 ];
 const excluded=new Set([...deposits,...lensAdds].map(x=>x.value));
 let rental=explicitRental.map(x=>x.value).find(v=>!excluded.has(v))||null;
 if(!rental){
  const candidates=allMoneyMentions(s).map(x=>x.value).filter(v=>!excluded.has(v));
  rental=candidates.length?candidates[0]:null;
 }
 const bundle=/(?:พร้อม|รวม|with)[^\n]{0,20}(?:lens|เลนส์|zeiss)|(?:lens|เลนส์|zeiss)[^\n]{0,20}(?:พร้อม|รวม|bundle)/i.test(s);
 const additive=/(?:lens|เลนส์|zeiss)[^0-9]{0,18}\+\s*\d{2,4}/i.test(s);
 const lensAddon=lensAdds.length?lensAdds[0].value:null;
 const package_type=bundle&&!additive?'PHONE_LENS':'PHONE_ONLY';
 return {
  rental_price:rental,
  deposit:deposits.length?deposits[0].value:null,
  lens_addon:lensAddon,
  package_type,
  semantic_confidence:explicitRental.length?'HIGH':(rental?'MEDIUM':'NONE')
 };
}
function parsePrice(value){return parseRentalOffer(value).rental_price;}
function packageType(value){return parseRentalOffer(value).package_type;}
function deviceModel(value){
 const s=text(value);
 if(/vivo\s*x300\s*pro/i.test(s))return 'VIVO_X300_PRO';
 if(/vivo\s*x300/i.test(s))return 'VIVO_X300';
 if(/vivo\s*x200\s*pro/i.test(s))return 'VIVO_X200_PRO';
 if(/iphone\s*1[5-9]/i.test(s))return 'IPHONE';
 if(/samsung|galaxy\s*s\d+/i.test(s))return 'SAMSUNG';
 return 'UNKNOWN';
}
function deviceCompatible(value,target='VIVO_X300_PRO'){
 const model=deviceModel(value);
 if(model==='UNKNOWN')return null;
 return model===text(target).toUpperCase();
}
function shortenTitle(title){return text(title).replace(/[|•].*$/,'').replace(/\s+/g,' ').slice(0,110);}
function buildQueries(candidate={},options={}){
 const title=shortenTitle(candidate.title);
 const universe=configuredUniverse(options);
 const generic=[
  `"${title}" เช่ามือถือ vivo X300 Pro`,
  `"${title}" เช่าโทรศัพท์ lens ราคา`,
  `"${title}" phone rental bangkok`,
  `site:x.com "${title}" เช่ามือถือ`
 ];
 const perCompetitor=universe.map(handle=>`site:x.com/${handle} "${title}" เช่า`);
 const key=text(candidate.event_key||candidate.candidate_id);
 const extras=[
  ...(Array.isArray(options.extra_queries)?options.extra_queries:[]),
  ...(options.extra_queries_by_candidate&&Array.isArray(options.extra_queries_by_candidate[key])?options.extra_queries_by_candidate[key]:[])
 ];
 return [...new Set([...generic,...perCompetitor,...extras.map(text).filter(Boolean)])];
}
function rowToEvidence(row,candidate={},options={}){
 const url=text(row.source_url||row.href||row.url);
 const evidence=[row.title,row.body,row.snippet].filter(Boolean).join(' ');
 const competitor=competitorFromUrl(url,configuredUniverse(options),evidence);
 if(!competitor)return null;
 const offer=parseRentalOffer(evidence);
 if(!offer.rental_price)return null;
 const overlap=titleOverlap(candidate.title,evidence);
 if(overlap<Number(options.minimum_title_overlap||0.34))return null;
 const compatible=deviceCompatible(evidence,options.target_device||'VIVO_X300_PRO');
 if(compatible===false)return null;
 const now=new Date(options.now||Date.now());
 const published=sourceTimestamp(row,url);
 const ageDays=published?Math.max(0,(now.getTime()-new Date(published).getTime())/86400000):null;
 return {
  competitor_id:competitor,
  event_key:text(candidate.event_key||candidate.candidate_id),
  package_type:offer.package_type,
  price:offer.rental_price,
  deposit:offer.deposit,
  lens_addon:offer.lens_addon,
  semantic_confidence:offer.semantic_confidence,
  device_model:deviceModel(evidence),
  device_compatible:compatible,
  source_url:url,
  source_published_at:published||null,
  observed_at:now.toISOString(),
  source_age_days:ageDays===null?null:Number(ageDays.toFixed(2)),
  exact_event:true,
  title_overlap:Number(overlap.toFixed(3))
 };
}
async function scanCandidate(candidate={},options={}){
 const runner=typeof options.ddgs_runner==='function'?options.ddgs_runner:PublicWeb.runDdgsSearch;
 const out=[];const seen=new Set();
 const desired=Math.max(3,Math.min(MAX_DESIRED_EVENT_COMPETITORS,Number(options.desired_independent_competitors||DEFAULT_DESIRED_EVENT_COMPETITORS)||DEFAULT_DESIRED_EVENT_COMPETITORS));
 for(const query of buildQueries(candidate,options)){
  let rows=[];
  try{rows=await runner({query,max_results:Number(options.max_results||20),region:'th-th',backend:text(options.backend||'auto')},options);}
  catch(_){continue;}
  for(const row of Array.isArray(rows)?rows:[]){
   const e=rowToEvidence(row,candidate,options);if(!e)continue;
   const k=e.competitor_id+'|'+e.package_type+'|'+e.price+'|'+e.source_url;
   if(seen.has(k))continue;seen.add(k);out.push(e);
  }
  if(new Set(out.map(x=>x.competitor_id)).size>=desired)break;
 }
 return out;
}
async function scanBatch(candidates=[],options={}){
 const rows=Array.isArray(candidates)?candidates:[];
 const results=[];let next=0;
 const concurrency=Math.max(1,Math.min(Number(options.concurrency||3)||3,4));
 async function worker(){
  while(true){
   const i=next++;if(i>=rows.length)return;
   const evidence=await scanCandidate(rows[i],options);
   results[i]={event_key:text(rows[i].event_key||rows[i].candidate_id),evidence};
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,rows.length||1)},()=>worker()));
 const evidence=results.flatMap(x=>x&&x.evidence||[]);
 const configured=configuredUniverse(options);
 const discovered=[...new Set(evidence.map(x=>x.competitor_id).filter(x=>!configured.includes(x)))];
 const universe=[...new Set([...configured,...discovered])].slice(0,MAX_COMPETITOR_UNIVERSE);
 return {
  version:VERSION,
  candidate_count:rows.length,
  competitor_universe:universe,
  competitor_universe_count:universe.length,
  base_competitor_count:BASE_COMPETITORS.length,
  target_competitor_universe:Number(options.target_competitor_universe||DEFAULT_TARGET_COMPETITOR_UNIVERSE),
  desired_independent_competitors_per_event:Math.max(3,Math.min(MAX_DESIRED_EVENT_COMPETITORS,Number(options.desired_independent_competitors||DEFAULT_DESIRED_EVENT_COMPETITORS)||DEFAULT_DESIRED_EVENT_COMPETITORS)),
  max_competitor_universe:MAX_COMPETITOR_UNIVERSE,
  competitor_universe_expandable:true,
  discovered_competitors:discovered,
  query_strategy:'GENERIC_DISCOVERY_PLUS_EXPANDABLE_PER_COMPETITOR_X',
  evidence_count:evidence.length,
  competitor_count:new Set(evidence.map(x=>x.competitor_id)).size,
  evidence,
  production_writes:0
 };
}

const COMPETITORS=BASE_COMPETITORS;
module.exports={
 VERSION,BASE_COMPETITORS,COMPETITORS,DEFAULT_TARGET_COMPETITOR_UNIVERSE,MAX_COMPETITOR_UNIVERSE,
 DEFAULT_DESIRED_EVENT_COMPETITORS,MAX_DESIRED_EVENT_COMPETITORS,X_EPOCH_MS,RENTAL_SHOP_SIGNAL,
 text,norm,tokens,amount,money,sanitizeNumericContext,titleOverlap,configuredUniverse,xHandle,xStatusTimestamp,sourceTimestamp,competitorFromUrl,
 allAmountMentions,allMoneyMentions,keywordAmount,keywordMoney,parseRentalOffer,parsePrice,packageType,deviceModel,deviceCompatible,
 shortenTitle,buildQueries,rowToEvidence,scanCandidate,scanBatch
};
