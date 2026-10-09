'use strict';

const VERSION='KK_ULTRA_DEEP_SOURCE_REGISTRY_V11';

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
    {source_id:'kazz-market-activity',label:'KAZZ Magazine event activity ticketing',domain:'kazzmarket.com',required:true},
    {source_id:'megatix',label:'Megatix',domain:'megatix.in.th',required:false}
  ]),
  VENUE:Object.freeze([
    {source_id:'impact-thunderdome',label:'IMPACT / Thunder Dome',required:true},
    {source_id:'bitec',label:'BITEC / BITEC LIVE',required:true},
    {source_id:'union-hall-mall',label:'Union Hall / Union Mall',required:true},
    {source_id:'iconsiam-hall',label:'ICONSIAM Hall',required:true},
    {source_id:'mcc-hall',label:'MCC Hall',required:true},
    {source_id:'paragon-hall',label:'Paragon Hall',required:true},
    {source_id:'the-mall-m-grand-hall',label:'The Mall Lifestore / M Grand Hall',required:true},
    {source_id:'pmcu-siam-square',label:'PMCU Siam Square seasonal free music festivals and stages',domain:'pmcu.co.th',required:true},
    {source_id:'siam-center-free-stage',label:'Siam Center public plaza and POP-Pah free T-Pop programmes',required:true}
  ]),
  ARTIST_AGENCY:Object.freeze([
    {source_id:'gmmtv',label:'GMMTV',domain:'gmmtv.com',required:true},
    {source_id:'one31',label:'one31',domain:'one31.net',required:true},
    {source_id:'domundi-mandee',label:'DOMUNDI / Mandee Work',required:true},
    {source_id:'deehup-house-ticketing',label:'Dee Hup House official fanmeet ticketing',domain:'deehuphouse.com',required:true},
    {source_id:'looke-gelboys',label:'LOOKE / GELBOYS fanmeeting and ticket announcements',required:true},
    {source_id:'change2561',label:'CHANGE2561',required:true},
    {source_id:'idolfactory',label:'IDOLFACTORY',required:true},
    {source_id:'channel3-bl-gl',label:'Channel 3 BL GL artist ecosystem',required:true},
    {source_id:'lingorm-artist-schedule-discovery',label:'LingOrm artist public schedule cross-check (secondary, official verification required)',domain:'lingorm.site',required:true},
    {source_id:'teeteepor-artist-schedule-discovery',label:'TeeTeePor public artist calendar cross-check (secondary, official verification required)',required:true},
    {source_id:'thai-artist-agencies',label:'Thai artist agencies',required:true},
    {source_id:'international-promoters',label:'International promoters',required:true},
    {source_id:'flex1045-radio-promoter',label:'Flex 104.5 / FlexConnect official radio-organized concert and festival announcements',domain:'flexconnect.net',required:true},
    {source_id:'cat-radio-free-festivals',label:'CAT Radio and other station-hosted public music festivals',required:true},
    {source_id:'xoxo-jmnk',label:'XOXO Entertainment and JMNK official concert schedule',required:true},
    {source_id:'open-label-daouoffroad',label:'OPEN LABEL and One31 DaouOffroad added shows / exact date announcements',required:true},
    {source_id:'indie-idol-labels-fansigns',label:'Independent Thai idol labels and release fansign calendars (MINDY, SNS, LE7EL and peer groups)',required:true}
  ]),
  BRAND_SPONSOR:Object.freeze([
    {source_id:'watsons-campaigns',label:'Watsons campaigns',required:true},
    {source_id:'wetv-campaigns',label:'WeTV campaigns',required:true},
    {source_id:'smtrue-campaigns',label:'SM True campaigns',required:true},
    {source_id:'mall-brand-campaigns',label:'Mall / retail brand campaigns',required:true},
    {source_id:'lucky-fan-top-spender',label:'Lucky fan / top spender campaigns',required:true},
    {source_id:'beauty-personal-care-campaigns',label:'Beauty / personal-care artist campaigns',required:true},
    {source_id:'her-hyness-lucky-fan-artist',label:'HER HYNESS top fan / lucky fan artist event campaigns',domain:'herhynessbeauty.com',required:true},
    {source_id:'cathy-doll-artist-event',label:'Cathy Doll artist private experience and brand events (official social required)',required:true},
    {source_id:'nars-thailand-artist-event',label:'NARS Thailand artist top fan and brand events (official social required)',required:true},
    {source_id:'retail-performance-schedules',label:'Retail / mall artist performance schedules',required:true},
    {source_id:'purchase-register-redeem-campaigns',label:'Purchase / register / redeem artist campaigns',required:true},
    {source_id:'brand-private-experience-campaigns',label:'Brand private trip / workshop / talk / polaroid experiences',required:true},
    {source_id:'labx-clinic-idol-private',label:'LABX Clinic artist Top Spender and private-session activities',required:true}
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
    {source_id:'popradar-tpop-small-idol',label:'PopRadar public T-POP and fan-sign discovery (secondary, verify official)',domain:'popradar.app',required:true},
    {source_id:'eveduler-date-calendar',label:'EVEDULER Thai artist date-level and mall-show discovery (secondary, verify official)',domain:'eveduler.com',required:true},
    {source_id:'nekoneko-idol-calendars',label:'Nekoneko idol/cosplay small-venue discovery (secondary, verify official)',domain:'nekoneko.website',required:true},
    {source_id:'natgan-blgl-artist-events',label:'Natgan BL GL fansign and brand activities (secondary, verify official)',domain:'natgan.com',required:true},
    {source_id:'venue-event-calendars',label:'Venue event calendars',required:true}
  ])
});

const ACCEPTED_STATUSES=new Set(['EVIDENCE_FOUND','NO_EVIDENCE','VALIDATED','EXECUTED_NO_MATCH','UNCHANGED']);

function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function monthLabels(value){
  const raw=text(value);const m=raw.match(/^(\d{4})-(\d{2})$/);
  if(!m)return {iso:raw,en:raw,th:raw};
  const year=Number(m[1]),month=Number(m[2]);
  const en=['January','February','March','April','May','June','July','August','September','October','November','December'][month-1]||raw;
  const th=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][month-1]||raw;
  return {iso:raw,en:en+' '+year,th:th+' '+(year+543)};
}

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
  const labels=monthLabels(month);
  const tasks=allSources().map(row=>{
    const domain=row.domain?('site:'+row.domain):'';
    const queries=[
      [domain,row.label,labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'concert fanmeeting',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'artist event lucky fan',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'BL GL fanmeeting final ep first ep fan gathering fansign lucky fan',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [row.label,'ซีรีส์วาย ซีรีส์ยูริ แฟนมีต final ep บวงสรวง รวมพล ลัคกี้แฟน',labels.th,'กรุงเทพ'].filter(Boolean).join(' '),
      [row.label,labels.th,'กรุงเทพ'].filter(Boolean).join(' '),
      [domain,row.label,'Bangkok'].filter(Boolean).join(' '),
      [domain,'concert fanmeeting Bangkok'].filter(Boolean).join(' '),
      [row.label,'Bangkok'].filter(Boolean).join(' ')
    ].filter(Boolean);
    return {
      source_id:row.source_id,
      source_tier:row.source_tier,
      required:row.required===true,
      label:row.label,
      domain:row.domain||null,
      query:queries[0],
      query_variants:[...new Set(queries.slice(1))],
      providers:['BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    };
  });
  return {version:VERSION,month:month||null,location,tasks,production_writes:0,authoritative:false,verifier_required:true};
}

function buildUniverseProof(receipts=[],options={}){
  const strictLive=options.strict_live===true;
  const requiredMonth=text(options.month);
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
    // A bare {executed:true,status:'NO_EVIDENCE'} is not proof of a live month scan.
    // In live mode the receipt must come from an attributable provider attempt
    // with an exact task/source identity and a query recorded at execution time.
    const attempts=Array.isArray(receipt&&receipt.attempts)?receipt.attempts:[];
    // A valid search attempt must execute a query belonging to this source task.
    // Unrelated searches against the same provider cannot complete source coverage.
    const authorizedQueries=new Set([
      text(receipt&&receipt.planned_query),
      ...(Array.isArray(receipt&&receipt.query_variants)?receipt.query_variants.map(text):[])
    ].filter(Boolean));
    const successful=attempts.filter(a=>['NO_EVIDENCE','EVIDENCE_FOUND'].includes(upper(a&&a.status)) &&
      text(a&&a.provider) && authorizedQueries.has(text(a&&a.query)));
    const providerProof=successful.some(a=>text(a.provider)===text(receipt&&receipt.provider) ||
      text(a.provider)===text(receipt&&receipt.executed_provider));
    const liveProvenance=!!receipt && !!requiredMonth &&
      text(receipt.month)===requiredMonth &&
      text(receipt.task_source_id)===source.source_id &&
      !!text(receipt.planned_query) &&
      providerProof &&
      (status!=='EVIDENCE_FOUND' || (Number(receipt.candidate_count)>0 &&
        successful.some(a=>upper(a.status)==='EVIDENCE_FOUND')));
    const pass=!!receipt && executed && ACCEPTED_STATUSES.has(status) && (!strictLive || liveProvenance);
    return {
      source_id:source.source_id,
      source_tier:source.source_tier,
      required:source.required===true,
      status:status||'MISSING',
      executed:!!executed,
      provenance_verified:strictLive?liveProvenance:null,
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
    strict_live:strictLive,
    month:requiredMonth||null,
    complete:missing.length===0,
    missing_required_sources:missing,
    required_source_count:required.length,
    passed_required_source_count:required.filter(x=>x.pass).length,
    by_tier,
    sources,
    production_writes:0
  };
}

module.exports={VERSION,REGISTRY,ACCEPTED_STATUSES,monthLabels,allSources,buildUniversePlan,buildUniverseProof};
