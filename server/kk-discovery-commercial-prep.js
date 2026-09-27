'use strict';

const VERSION='KK_DISCOVERY_COMMERCIAL_PREP_V1';
const MIN_EXACT_COMPETITORS=3;

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function httpsUrl(v){
  try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}
}
function median(values=[]){
  const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function normalizeCompetitor(row={}){
  return {
    competitor_id:text(row.competitor_id||row.account||row.shop),
    event_key:text(row.event_key),
    package_type:text(row.package_type).toUpperCase(),
    price:money(row.price),
    source_url:httpsUrl(row.source_url),
    observed_at:text(row.observed_at),
    exact_event:row.exact_event===true
  };
}
function priceEvidence(candidate={},rows=[]){
  const key=text(candidate.event_key||candidate.candidate_id);
  const normalized=rows.map(normalizeCompetitor).filter(r=>
    r.exact_event&&r.event_key===key&&r.competitor_id&&r.price&&r.source_url
  );
  const byCompetitor=new Map();
  for(const r of normalized){
    const k=r.competitor_id.toLowerCase()+'|'+r.package_type;
    if(!byCompetitor.has(k))byCompetitor.set(k,r);
  }
  const unique=[...byCompetitor.values()];
  const shops=new Set(unique.map(r=>r.competitor_id.toLowerCase()));
  const prices=unique.map(r=>r.price);
  const complete=shops.size>=MIN_EXACT_COMPETITORS;
  return {
    evidence_type:'EXACT_EVENT_COMPETITOR_PRICE',
    minimum_independent_competitors:MIN_EXACT_COMPETITORS,
    independent_competitors:shops.size,
    complete,
    market_median:complete?median(prices):null,
    market_min:complete?Math.min(...prices):null,
    market_max:complete?Math.max(...prices):null,
    evidence:unique
  };
}
function posterEvidence(candidate={},posters=[]){
  const key=text(candidate.event_key||candidate.candidate_id);
  const valid=posters.map((p={})=>({
    event_key:text(p.event_key),
    source_tier:text(p.source_tier).toUpperCase(),
    source_url:httpsUrl(p.source_url),
    image_url:httpsUrl(p.image_url),
    official:p.official===true,
    verified:p.verified===true
  })).filter(p=>p.event_key===key&&p.source_url&&p.image_url&&p.verified);
  valid.sort((a,b)=>Number(b.official)-Number(a.official));
  const selected=valid[0]||null;
  return {complete:!!selected,selected,evidence:valid};
}
function prepareCandidate(candidate={},input={}){
  const pricing=priceEvidence(candidate,input.competitor_prices||[]);
  const poster=posterEvidence(candidate,input.posters||[]);
  const blockers=[];
  if(!text(candidate.title))blockers.push('EVENT_TITLE_REQUIRED');
  if(!text(candidate.event_date))blockers.push('EVENT_DATE_REQUIRED');
  if(!text(candidate.venue))blockers.push('EVENT_VENUE_REQUIRED');
  if(!pricing.complete)blockers.push('EXACT_EVENT_COMPETITOR_PRICE_EVIDENCE_INCOMPLETE');
  if(!poster.complete)blockers.push('VERIFIED_POSTER_EVIDENCE_MISSING');
  return {
    schema_version:VERSION,
    candidate_id:text(candidate.candidate_id),
    event_key:text(candidate.event_key||candidate.candidate_id),
    title:text(candidate.title),
    event_date:text(candidate.event_date),
    venue:text(candidate.venue),
    artist:Array.isArray(candidate.artist)?candidate.artist.map(text).filter(Boolean):[],
    pricing,
    poster,
    status:blockers.length?'HOLD_FOR_COMMERCIAL_EVIDENCE':'READY_FOR_FINAL_VERIFIER',
    blockers,
    authoritative:false,
    verifier_required:true,
    final_price_write_allowed:false,
    production_writes:0,
    publishes:0
  };
}
function prepareBatch(input={}){
  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const prepared=candidates.map(c=>prepareCandidate(c,input));
  return {
    schema_version:VERSION,
    status:prepared.length&&prepared.every(x=>x.status==='READY_FOR_FINAL_VERIFIER')?'READY_FOR_FINAL_VERIFIER':'HOLD_FOR_COMMERCIAL_EVIDENCE',
    candidates:prepared,
    ready_count:prepared.filter(x=>x.status==='READY_FOR_FINAL_VERIFIER').length,
    hold_count:prepared.filter(x=>x.status!=='READY_FOR_FINAL_VERIFIER').length,
    production_writes:0,
    publishes:0
  };
}
module.exports={VERSION,MIN_EXACT_COMPETITORS,median,normalizeCompetitor,priceEvidence,posterEvidence,prepareCandidate,prepareBatch};
