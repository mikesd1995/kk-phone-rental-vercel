'use strict';

const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');

const VERSION='KK_ULTRA_DEEP_COMPETITOR_PRICE_SCANNER_V3';
const COMPETITORS=Object.freeze([
 'minibestt','fundaybuddy','thisisyour3','fejay4rent','by_minnymicky',
 'npforrent','mcjmgoods','winkwink_rent','khaw4rent_2nd'
]);

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,' ').replace(/\s+/g,' ').trim();}
function tokens(v){return norm(v).split(' ').filter(x=>x.length>=3);}
function titleOverlap(candidateTitle,evidenceText){
 const wanted=tokens(candidateTitle);
 if(!wanted.length)return 0;
 const hay=new Set(tokens(evidenceText));
 const hits=wanted.filter(x=>hay.has(x)).length;
 return hits/wanted.length;
}
function competitorFromUrl(url){
 try{
  const u=new URL(text(url));
  if(!/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(u.hostname))return '';
  const handle=(u.pathname.split('/').filter(Boolean)[0]||'').toLowerCase();
  return COMPETITORS.includes(handle)?handle:'';
 }catch(_){return '';}
}
function parsePrice(value){
 const s=text(value).replace(/,/g,'');
 const patterns=[
  /฿\s*(\d{3,4})(?!\d)/gi,
  /(\d{3,4})\s*(?:บาท|thb|฿|\.-)/gi,
  /(?:ราคา|price)\s*[:=]?\s*(\d{3,4})(?!\d)/gi
 ];
 const vals=[];
 for(const re of patterns){
  for(const m of s.matchAll(re)){
   const n=Number(m[1]);
   if(Number.isFinite(n)&&n>=300&&n<=2500)vals.push(n);
  }
 }
 return vals.length?Math.min(...vals):null;
}
function packageType(value){
 const raw=text(value);
 const s=norm(raw);
 const hasLens=/(lens|เลนส์|2\.35|zeiss)/i.test(s);
 const hasPhone=/(phone|มือถือ|x300|vivo|เครื่อง)/i.test(s);
 const lensAddon=/(?:lens|เลนส์|zeiss)[^0-9]{0,16}\+\s*\d{2,3}/i.test(raw);
 if(hasLens&&hasPhone&&lensAddon)return 'PHONE_ONLY';
 if(hasLens&&hasPhone)return 'PHONE_LENS';
 if(hasLens)return 'LENS_ONLY';
 return 'PHONE_ONLY';
}
function shortenTitle(title){
 return text(title).replace(/[|•].*$/,'').replace(/\s+/g,' ').slice(0,110);
}
function buildQueries(candidate={}){
 const title=shortenTitle(candidate.title);
 const generic=[
  `"${title}" เช่ามือถือ vivo X300`,
  `"${title}" เช่าโทรศัพท์ lens ราคา`,
  `"${title}" phone rental bangkok`
 ];
 const perCompetitor=COMPETITORS.map(handle=>`site:x.com @${handle} "${title}" เช่ามือถือ`);
 return [...generic,...perCompetitor];
}
function rowToEvidence(row,candidate={}){
 const url=text(row.source_url||row.href||row.url);
 const competitor=competitorFromUrl(url);
 if(!competitor)return null;
 const evidence=[row.title,row.body,row.snippet].filter(Boolean).join(' ');
 // A ticket-price announcement retweeted by a rental shop is NOT a rental quote.
 if(!/(เช่า(?:มือถือ|โทรศัพท์|เครื่อง)|ให้เช่า|phone\s*rental|rental\s*(?:phone|vivo)|เช่า\s*(?:vivo|samsung|s2\d|x300))/i.test(evidence))return null;
 const price=parsePrice(evidence);
 if(!price)return null;
 const overlap=titleOverlap(candidate.title,evidence);
 if(overlap<0.34)return null;
 return {
  competitor_id:competitor,
  event_key:text(candidate.event_key||candidate.candidate_id),
  package_type:packageType(evidence),
  price,
  source_url:url,
  observed_at:new Date().toISOString(),
  exact_event:true,
  title_overlap:Number(overlap.toFixed(3))
 };
}
async function scanCandidate(candidate={},options={}){
 const runner=typeof options.ddgs_runner==='function'?options.ddgs_runner:PublicWeb.runDdgsSearch;
 const out=[];const seen=new Set();
 for(const query of buildQueries(candidate)){
  let rows=[];
  try{
   rows=await runner({query,max_results:Number(options.max_results||20),region:'th-th',backend:text(options.backend||'auto')},options);
  }catch(_){continue;}
  for(const row of Array.isArray(rows)?rows:[]){
   const e=rowToEvidence(row,candidate);if(!e)continue;
   const k=e.competitor_id+'|'+e.package_type+'|'+e.price+'|'+e.source_url;
   if(seen.has(k))continue;seen.add(k);out.push(e);
  }
  if(new Set(out.map(x=>x.competitor_id)).size>=3)break;
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
 return {
  version:VERSION,
  candidate_count:rows.length,
  competitor_universe:[...COMPETITORS],
  competitor_universe_count:COMPETITORS.length,
  query_strategy:'GENERIC_PLUS_PER_COMPETITOR_X',
  evidence_count:evidence.length,
  competitor_count:new Set(evidence.map(x=>x.competitor_id)).size,
  evidence,
  production_writes:0
 };
}

module.exports={VERSION,COMPETITORS,text,norm,tokens,titleOverlap,competitorFromUrl,parsePrice,packageType,shortenTitle,buildQueries,rowToEvidence,scanCandidate,scanBatch};
