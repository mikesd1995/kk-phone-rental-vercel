'use strict';

const VERSION='KK_ULTRA_DEEP_SOURCE_REGISTRY_V2';
const SEARCH_PROVIDERS=Object.freeze(['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);

const REGISTRY=Object.freeze({
  OFFICIAL:Object.freeze([
    {source_id:'official-organizer-sites',label:'Official organizer sites',required:true},
    {source_id:'official-artist-sites',label:'Official artist/group sites',required:true}
  ]),
  TICKETING:Object.freeze([
    {source_id:'thaiticketmajor',label:'ThaiTicketMajor',domain:'thaiticketmajor.com',required:true,seed_urls:['https://www.thaiticketmajor.com/'],feed_urls:['https://www.thaiticketmajor.com/variety/feed.php']},
    {source_id:'ticketmelon',label:'Ticketmelon',domain:'ticketmelon.com',required:true,seed_urls:['https://www.ticketmelon.com/']},
    {source_id:'eventpop',label:'Eventpop',domain:'eventpop.me',required:true,seed_urls:['https://www.eventpop.me/']},
    {source_id:'zipevent',label:'Zipevent',domain:'zipeventapp.com',required:true,seed_urls:['https://www.zipeventapp.com/']},
    {source_id:'allticket',label:'AllTicket',domain:'allticket.com',required:true,seed_urls:['https://www.allticket.com/']},
    {source_id:'megatix',label:'Megatix',domain:'megatix.in.th',required:false,seed_urls:['https://megatix.in.th/']}
  ]),
  VENUE:Object.freeze([
    {source_id:'impact-thunderdome',label:'IMPACT / Thunder Dome',required:true,seed_urls:['https://www.impact.co.th/en/visitors/event-calendar','https://www.thunderdome.biz/en/events']},
    {source_id:'bitec',label:'BITEC / BITEC LIVE',required:true,seed_urls:['https://www.bitec.co.th/whats-on']},
    {source_id:'union-hall-mall',label:'Union Hall / Union Mall',required:true,seed_urls:['https://unionhallthailand.com/events/']},
    {source_id:'iconsiam-hall',label:'ICONSIAM Hall',required:true,domain:'iconsiam.com'},
    {source_id:'mcc-hall',label:'MCC Hall',required:true,domain:'themall.co.th'},
    {source_id:'paragon-hall',label:'Paragon Hall',required:true,seed_urls:['https://www.paragonhall.com/en/events']},
    {source_id:'the-mall-m-grand-hall',label:'The Mall Lifestore / M Grand Hall',required:true,seed_urls:['https://www.mcardmall.com/en/promotions']}
  ]),
  ARTIST_AGENCY:Object.freeze([
    {source_id:'gmmtv',label:'GMMTV',domain:'gmmtv.com',required:true,seed_urls:['https://www.gmm-tv.com/']},
    {source_id:'one31',label:'one31',domain:'one31.net',required:true,seed_urls:['https://www.one31.net/']},
    {source_id:'thai-artist-agencies',label:'Thai artist agencies',required:true},
    {source_id:'international-promoters',label:'International promoters Thailand',required:true}
  ]),
  BRAND_SPONSOR:Object.freeze([
    {source_id:'watsons-campaigns',label:'Watsons artist campaigns',domain:'watsons.co.th',required:true,seed_urls:['https://www.watsons.co.th/th/']},
    {source_id:'wetv-campaigns',label:'WeTV / WeSpark artist campaigns',domain:'wetv.vip',required:true,seed_urls:['https://wetv.vip/en']},
    {source_id:'smtrue-campaigns',label:'SM True artist campaigns',domain:'smtruethailand.com',required:true},
    {source_id:'mall-brand-campaigns',label:'Mall / retail brand artist campaigns',required:true,seed_urls:['https://www.mcardmall.com/en/promotions']},
    {source_id:'lucky-fan-top-spender',label:'Lucky fan / top spender artist campaigns',required:true}
  ]),
  SOCIAL:Object.freeze([
    {source_id:'x-public',label:'X public artist event discovery',domain:'x.com',required:true},
    {source_id:'instagram-public',label:'Instagram public artist event discovery',domain:'instagram.com',required:true},
    {source_id:'facebook-public',label:'Facebook public artist event discovery',domain:'facebook.com',required:true}
  ]),
  COMPETITOR:Object.freeze([
    {source_id:'competitor-core-watchlist',label:'KK phone-rental competitor core watchlist',required:true},
    {source_id:'competitor-new-account-discovery',label:'New phone-rental competitor account discovery',required:true}
  ]),
  PUBLIC_CALENDAR:Object.freeze([
    {source_id:'public-event-calendars',label:'Bangkok public event calendars',required:true},
    {source_id:'venue-event-calendars',label:'Bangkok venue event calendars',required:true}
  ])
});

const ACCEPTED_EXECUTION_STATUSES=new Set(['HEALTH_OK','EVIDENCE_FOUND','EXECUTED_NO_MATCH']);

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
  const tasks=allSources().map(row=>{
    const seed_urls=Array.isArray(row.seed_urls)?row.seed_urls:[];
    const feed_urls=Array.isArray(row.feed_urls)?row.feed_urls:[];
    const health_only=seed_urls.length>0||feed_urls.length>0;
    const providers=feed_urls.length
      ? ['RSS_OR_PUBLIC_FEED','OFFICIAL_DIRECT',...SEARCH_PROVIDERS]
      : (seed_urls.length?['OFFICIAL_DIRECT',...SEARCH_PROVIDERS]:[...SEARCH_PROVIDERS]);
    return {
      source_id:row.source_id,
      source_tier:row.source_tier,
      required:row.required===true,
      label:row.label,
      domain:row.domain||null,
      seed_urls,
      feed_urls,
      health_only,
      proof_mode:health_only?'SOURCE_HEALTH':'DISCOVERY_EXECUTION',
      query:[row.domain?('site:'+row.domain):'',row.label,month,location,'concert fanmeeting event lucky fan fansign'].filter(Boolean).join(' '),
      providers,
      evidence_required:true
    };
  });
  return {
    version:VERSION,
    month:month||null,
    location,
    tasks,
    production_writes:0,
    authoritative:false,
    verifier_required:true
  };
}

function buildUniverseProof(receipts=[]){
  const byId=new Map();
  for(const row of Array.isArray(receipts)?receipts:[]){
    const id=text(row&&row.source_id);
    if(id)byId.set(id,row);
  }
  const sources=allSources().map(source=>{
    const receipt=byId.get(source.source_id);
    const status=upper(receipt&&receipt.status);
    const executed=receipt&&receipt.executed===true;
    const pass=!!receipt&&executed&&ACCEPTED_EXECUTION_STATUSES.has(status);
    return {
      source_id:source.source_id,
      source_tier:source.source_tier,
      required:source.required===true,
      proof_mode:text(receipt&&receipt.proof_mode)||null,
      status:status||'MISSING',
      executed:!!executed,
      pass
    };
  });
  const required=sources.filter(x=>x.required);
  const missing=required.filter(x=>!x.pass).map(x=>x.source_id);
  const by_tier={};
  for(const tier of Object.keys(REGISTRY)){
    const rows=sources.filter(x=>x.source_tier===tier&&x.required);
    by_tier[tier]={
      required:rows.length,
      executed:rows.filter(x=>x.executed).length,
      passed:rows.filter(x=>x.pass).length,
      complete:rows.length>0&&rows.every(x=>x.pass)
    };
  }
  return {
    version:VERSION,
    execution_complete:missing.length===0,
    complete:missing.length===0,
    missing_required_sources:missing,
    required_source_count:required.length,
    executed_required_source_count:required.filter(x=>x.executed).length,
    passed_required_source_count:required.filter(x=>x.pass).length,
    by_tier,
    sources,
    production_writes:0
  };
}

module.exports={
  VERSION,SEARCH_PROVIDERS,REGISTRY,ACCEPTED_EXECUTION_STATUSES,
  allSources,buildUniversePlan,buildUniverseProof
};
