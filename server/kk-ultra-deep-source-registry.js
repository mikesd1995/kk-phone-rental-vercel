'use strict';

const VERSION='KK_ULTRA_DEEP_SOURCE_REGISTRY_V1';

const REGISTRY=Object.freeze({
  OFFICIAL:Object.freeze([
    {source_id:'official-organizer-sites',label:'Official organizer sites',required:true},
    {source_id:'official-artist-sites',label:'Official artist/group sites',required:true}
  ]),
  TICKETING:Object.freeze([
    {source_id:'thaiticketmajor',label:'ThaiTicketMajor',domain:'thaiticketmajor.com',required:true},
    {source_id:'ticketmelon',label:'Ticketmelon',domain:'ticketmelon.com',required:true},
    {source_id:'eventpop',label:'Eventpop',domain:'eventpop.me',required:true},
    {source_id:'zipevent',label:'Zipevent',domain:'zipeventapp.com',required:true},
    {source_id:'allticket',label:'AllTicket',domain:'allticket.com',required:true},
    {source_id:'megatix',label:'Megatix',domain:'megatix.in.th',required:false}
  ]),
  VENUE:Object.freeze([
    {source_id:'impact-thunderdome',label:'IMPACT / Thunder Dome',required:true},
    {source_id:'bitec',label:'BITEC / BITEC LIVE',required:true},
    {source_id:'union-hall-mall',label:'Union Hall / Union Mall',required:true},
    {source_id:'iconsiam-hall',label:'ICONSIAM Hall',required:true},
    {source_id:'mcc-hall',label:'MCC Hall',required:true},
    {source_id:'paragon-hall',label:'Paragon Hall',required:true},
    {source_id:'the-mall-m-grand-hall',label:'The Mall Lifestore / M Grand Hall',required:true}
  ]),
  ARTIST_AGENCY:Object.freeze([
    {source_id:'gmmtv',label:'GMMTV',domain:'gmmtv.com',required:true},
    {source_id:'one31',label:'one31',domain:'one31.net',required:true},
    {source_id:'thai-artist-agencies',label:'Thai artist agencies',required:true},
    {source_id:'international-promoters',label:'International promoters',required:true}
  ]),
  BRAND_SPONSOR:Object.freeze([
    {source_id:'watsons-campaigns',label:'Watsons campaigns',required:true},
    {source_id:'wetv-campaigns',label:'WeTV campaigns',required:true},
    {source_id:'smtrue-campaigns',label:'SM True campaigns',required:true},
    {source_id:'mall-brand-campaigns',label:'Mall / retail brand campaigns',required:true},
    {source_id:'lucky-fan-top-spender',label:'Lucky fan / top spender campaigns',required:true}
  ]),
  SOCIAL:Object.freeze([
    {source_id:'x-public',label:'X public discovery',required:true},
    {source_id:'instagram-public',label:'Instagram public discovery',required:true},
    {source_id:'facebook-public',label:'Facebook public discovery',required:true}
  ]),
  COMPETITOR:Object.freeze([
    {source_id:'competitor-core-watchlist',label:'KK competitor core watchlist',required:true},
    {source_id:'competitor-new-account-discovery',label:'New competitor account discovery',required:true}
  ]),
  PUBLIC_CALENDAR:Object.freeze([
    {source_id:'public-event-calendars',label:'Public event calendars',required:true},
    {source_id:'venue-event-calendars',label:'Venue event calendars',required:true}
  ])
});

const ACCEPTED_STATUSES=new Set(['EVIDENCE_FOUND','NO_EVIDENCE','VALIDATED','EXECUTED_NO_MATCH','UNCHANGED']);

function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}

function allSources(){
  const out=[];
  for(const [tier,rows] of Object.entries(REGISTRY)){
    for(const row of rows) out.push({...row,source_tier:tier});
  }
  return out;
}

function buildUniversePlan(input={}){
  const month=text(input.month);
  const location=text(input.location)||'Bangkok Thailand';
  const tasks=allSources().map(row=>({
    source_id:row.source_id,
    source_tier:row.source_tier,
    required:row.required===true,
    label:row.label,
    domain:row.domain||null,
    query:[row.label,month,location,'concert fanmeeting event lucky fan fansign'].filter(Boolean).join(' '),
    providers:['SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
    evidence_required:true
  }));
  return {version:VERSION,month:month||null,location,tasks,production_writes:0,authoritative:false,verifier_required:true};
}

function buildUniverseProof(receipts=[]){
  const byId=new Map();
  for(const row of Array.isArray(receipts)?receipts:[]){
    const id=text(row&&row.source_id);
    if(!id) continue;
    byId.set(id,row);
  }
  const sources=allSources().map(source=>{
    const receipt=byId.get(source.source_id);
    const status=upper(receipt&&receipt.status);
    const executed=receipt&&receipt.executed===true;
    const pass=!!receipt && executed && ACCEPTED_STATUSES.has(status);
    return {
      source_id:source.source_id,
      source_tier:source.source_tier,
      required:source.required===true,
      status:status||'MISSING',
      executed:!!executed,
      pass
    };
  });
  const required=sources.filter(x=>x.required);
  const missing=required.filter(x=>!x.pass).map(x=>x.source_id);
  const by_tier={};
  for(const tier of Object.keys(REGISTRY)){
    const rows=sources.filter(x=>x.source_tier===tier && x.required);
    by_tier[tier]={required:rows.length,passed:rows.filter(x=>x.pass).length,complete:rows.length>0&&rows.every(x=>x.pass)};
  }
  return {
    version:VERSION,
    complete:missing.length===0,
    missing_required_sources:missing,
    required_source_count:required.length,
    passed_required_source_count:required.filter(x=>x.pass).length,
    by_tier,
    sources,
    production_writes:0
  };
}

module.exports={VERSION,REGISTRY,ACCEPTED_STATUSES,allSources,buildUniversePlan,buildUniverseProof};
