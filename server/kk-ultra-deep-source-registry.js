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
    {source_id:'ttm-recent-asia-artist-fancon',label:'ThaiTicketMajor newly announced Asia artist fancons and December special concerts',domain:'thaiticketmajor.com',required:true},
    {source_id:'theconcert-ticketing',label:'TheConcert official ticketing',domain:'theconcert.com',required:true},
    {source_id:'megatix',label:'Megatix',domain:'megatix.in.th',required:false}
  ]),
  VENUE:Object.freeze([
    {source_id:'impact-thunderdome',label:'IMPACT / Thunder Dome',required:true},
    {source_id:'bitec',label:'BITEC / BITEC LIVE',required:true},
    {source_id:'union-hall-mall',label:'Union Hall / Union Mall',required:true},
    {source_id:'iconsiam-hall',label:'ICONSIAM Hall',direct_url:'https://www.iconsiamhall.com/en/event-calendar/event-list',required:true},
    {source_id:'mcc-hall',label:'MCC Hall',required:true},
    {source_id:'mgi-hall-bravo-bkk',label:'MGI Hall Bravo BKK concert final episode fan screening',required:true},
    {source_id:'paragon-hall',label:'Paragon Hall',required:true},
    {source_id:'the-mall-m-grand-hall',label:'The Mall Lifestore / M Grand Hall',required:true},
    {source_id:'the-mall-lifestore-plaza-artist-activations',label:'The Mall Lifestore branch plaza artist appearances and Christmas tree lighting',domain:'mcardmall.com',required:true},
    {source_id:'aksra-theatre-king-power',label:'Aksra Theatre King Power',required:true},
    {source_id:'thai-summit-tower-events',label:'Thai Summit Tower artist events',required:true},
    {source_id:'smooth-life-tower-events',label:'Smooth Life Tower artist events',required:true},
    {source_id:'pmcu-siam-square',label:'PMCU Siam Square seasonal free music festivals and stages',domain:'pmcu.co.th',required:true},
    {source_id:'siam-center-free-stage',label:'Siam Center public plaza and POP-Pah free T-Pop programmes',required:true}
  ]),
  ARTIST_AGENCY:Object.freeze([
    {source_id:'gmmtv',label:'GMMTV',domain:'gmmtv.com',required:true},
    {source_id:'star-hunter-gl-final-episodes',label:'STAR HUNTER Entertainment WeTV GL BL final episodes Khom Khlang ข่มขลัง Puinoon Bint',required:true},
    {source_id:'iqiyi-thailand-platform',label:'iQIYI Thailand official iJOY fan zone and artist showcase',domain:'x.com',direct_url:'https://x.com/iQIYI_Thailand',required:true},
    {source_id:'one31',label:'one31',domain:'one31.net',required:true},
    {source_id:'domundi-mandee',label:'DOMUNDI / Mandee Work',required:true},
    {source_id:'deehup-house-ticketing',label:'Dee Hup House official fanmeet ticketing',domain:'deehuphouse.com',required:true},
    {source_id:'looke-gelboys',label:'LOOKE / GELBOYS fanmeeting and ticket announcements',required:true},
    {source_id:'change2561',label:'CHANGE2561',required:true},
    {source_id:'idolfactory',label:'IDOLFACTORY',required:true},
    {source_id:'channel3-bl-gl',label:'Channel 3 BL GL artist ecosystem',required:true},
    {source_id:'mflow-theseries',label:'MFlowTheSeries artist fancons',domain:'x.com',required:true},
    {source_id:'ngernnn-artist',label:'Ngern ngernnn artist appearances',domain:'instagram.com',required:true},
    {source_id:'thai-artist-agencies',label:'Thai artist agencies',required:true},
    {source_id:'international-promoters',label:'International promoters',required:true},
    {source_id:'flex1045-radio-promoter',label:'Flex 104.5 / FlexConnect official radio-organized concert and festival announcements',domain:'flexconnect.net',required:true},
    {source_id:'cat-radio-free-festivals',label:'CAT Radio and other station-hosted public music festivals',required:true},
    {source_id:'xoxo-jmnk',label:'XOXO Entertainment and JMNK official concert schedule',required:true}
  ]),
  BRAND_SPONSOR:Object.freeze([
    {source_id:'watsons-campaigns',label:'Watsons campaigns',required:true},
    {source_id:'wetv-campaigns',label:'WeTV campaigns',required:true},
    {source_id:'smtrue-campaigns',label:'SM True campaigns',required:true},
    {source_id:'mall-brand-campaigns',label:'Mall / retail brand campaigns',required:true},
    {source_id:'mcard-the-mall-artist-events',label:'M Card The Mall Lifestore artist fan-zone and Christmas tree lighting events',domain:'mcardmall.com',required:true},
    {source_id:'mcard-future-event-spend-winner-cycle',label:'M Card cross-month spending, winner announcement and December artist meet-and-greet',domain:'mcardmall.com',required:true},
    {source_id:'mediheal-th-artist-lucky-fans',label:'MEDIHEAL Thailand official X artist lucky-fan pop-ups and top-spender activations',domain:'x.com',required:true},
    {source_id:'twelveplus-th',label:'TwelvePlusTH artist campaigns',domain:'x.com',required:true},
    {source_id:'dentiste-th',label:'Dentiste_X artist campaigns',domain:'x.com',required:true},
    {source_id:'lucky-fan-top-spender',label:'Lucky fan / top spender campaigns',required:true},
    {source_id:'beauty-personal-care-campaigns',label:'Beauty / personal-care artist campaigns',required:true},
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
    {source_id:'venue-event-calendars',label:'Venue event calendars',required:true},
    {source_id:'illust-fusion-official-events',label:'Illust Fusion EXPO official artist/illustration community calendar',domain:'if.enterdock.com',required:true}
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
    // Do not substitute generic mall/brand source-class coverage for a direct
    // M Card / The Mall artist-activation sweep. The page may not sell tickets.
    const mallArtistSource=['the-mall-lifestore-plaza-artist-activations','mcard-the-mall-artist-events'].includes(row.source_id);
    const mallQueries=mallArtistSource?[
      [domain,'Christmas Tree Lighting Ceremony','artist performance',labels.en].filter(Boolean).join(' '),
      [domain,'พิธีเปิดไฟต้นคริสต์มาส','ศิลปิน','แฟนโซน',labels.th].filter(Boolean).join(' '),
      [domain,'The Mall Lifestore','M Card','fan zone','artist',labels.en].filter(Boolean).join(' '),
      row.source_id==='the-mall-lifestore-plaza-artist-activations'
        ? [domain,'The Mall Lifestore Bangkapi outdoor plaza','เดอะมอลล์ ไลฟ์สโตร์ บางกะปิ ลานกลางแจ้ง ศิลปิน','BL GL TPOP artist appearance',labels.en,labels.th].filter(Boolean).join(' ')
        : [domain,'The Mall Lifestore','BL GL TPOP artist appearance',labels.en].filter(Boolean).join(' ')
    ]:[];
    const decemberRecallQueries={
      'mcard-future-event-spend-winner-cycle':[
        'site:mcardmall.com/promotions meet greet artist top spender lucky fan '+labels.en,
        'site:mcardmall.com สะสมยอด ลุ้นสิทธิ์ พบศิลปิน ประกาศผู้โชคดี '+labels.th,
        'site:mcardmall.com Sphere Gallery artist event lucky fan December Bangkok'
      ],
      'mediheal-th-artist-lucky-fans':[
        'site:x.com/Mediheal_TH artist top spender lucky fan '+labels.en,
        'MEDIHEAL Thailand official Jimmy Sea artist event Siam Square '+labels.en,
        'เมดิฮีล กิจกรรมศิลปิน private talk lucky fan กรุงเทพ '+labels.th
      ],
      'ttm-recent-asia-artist-fancon':[
        'site:event.thaiticketmajor.com/search/ Asia Tour Nine 9 Moment '+labels.en,
        'site:thaiticketmajor.com new concert fancon December Bangkok',
        'คอนเสิร์ต เอเชียทัวร์ ศิลปินใหม่ เปิดขายบัตร '+labels.th
      ],
      'illust-fusion-official-events':[
        'site:if.enterdock.com EXPO WINTER '+labels.en,
        'site:if.enterdock.com งานวาดภาพ cosplay อิลลัสต์ '+labels.th,
        'illustration creative community events Bangkok '+labels.en
      ]
    };
    // Issue #879: named lead lanes must survive independently of a broad tier search.
    // Search terms are discovery hints, not proof of an official event or access rights.
    const namedRecallQueries={
      'star-hunter-gl-final-episodes':['STAR HUNTER Entertainment WeTV final episode Khom Khlang '+labels.en,'ข่มขลัง ปุยนุ่น บิ๊นท์ Final EP '+labels.th,'STAR HUNTER artist fan screening ticket announcement'],
      'mgi-hall-bravo-bkk':['MGI Hall Bravo BKK final episode fan screening '+labels.en,'เอ็มจีไอ ฮอลล์ บราโว่ บีเคเค แฟนมีต '+labels.th,'MGI Hall Bravo BKK concert fan meeting schedule'],
      'iqiyi-thailand-platform':['site:x.com/iQIYI_Thailand iJOY FAN ZONE artist showcase '+labels.en,'iQIYI Thailand iJOY ลงทะเบียน แฟนโซน พรมเขียว '+labels.th,'site:x.com/iQIYI_Thailand iQIYI iJOY FAN ZONE registration'],
      'twelveplus-th':['site:x.com/TwelvePlusTH AuAu Save lucky fan '+labels.en,'TwelvePlus อู่อู๋ เซฟ ลุ้นสิทธิ์ ประกาศผู้โชคดี '+labels.th,'TwelvePlusTH AuAuSave artist campaign registration winner'],
      'dentiste-th':['site:x.com/Dentiste_X Keng Namping artist workshop '+labels.en,'Dentiste เก่ง น้ำปิง กิจกรรมศิลปิน '+labels.th,'Dentiste_X KengNamping lucky fan workshop'],
      'mflow-theseries':['site:x.com/MflowTheseries Boat Oat fancon '+labels.en,'MFlow โบ๊ท โอ๊ต แฟนคอน '+labels.th,'MflowTheseries BoatOat fancon ticket announcement'],
      'ngernnn-artist':['site:instagram.com/ngernnn Ngern artist event '+labels.en,'เงิน อนุภาษ งานแฟนมีต '+labels.th,'ngernnn midnight artist event ticket'],
      'theconcert-ticketing':['site:theconcert.com fancon fan meeting artist '+labels.en,'TheConcert เปิดขายบัตร แฟนคอน ศิลปิน '+labels.th,'site:theconcert.com Ngern Midnight concert fanmeeting'],
      'aksra-theatre-king-power':['Aksra Theatre King Power fancon '+labels.en,'อักษราเธียเตอร์ คิง เพาเวอร์ แฟนคอน '+labels.th,'Aksra Theatre King Power artist fan meeting'],
      'thai-summit-tower-events':['Thai Summit Tower artist event '+labels.en,'อาคารไทยซัมมิท ทาวเวอร์ ศิลปิน '+labels.th,'Thai Summit Tower fan meeting ticket'],
      'smooth-life-tower-events':['Smooth Life Tower artist workshop '+labels.en,'สมูท ไลฟ์ ทาวเวอร์ ศิลปิน ลัคกี้แฟน '+labels.th,'Smooth Life Tower artist campaign workshop']
    };
    const queries=[
      ...(namedRecallQueries[row.source_id]||[]),
      [domain,row.label,labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'concert fanmeeting',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'artist event lucky fan',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [domain,'BL GL fanmeeting final ep first ep fan gathering fansign lucky fan',labels.en,'Bangkok'].filter(Boolean).join(' '),
      [row.label,'ซีรีส์วาย ซีรีส์ยูริ แฟนมีต final ep บวงสรวง รวมพล ลัคกี้แฟน',labels.th,'กรุงเทพ'].filter(Boolean).join(' '),
      [row.label,labels.th,'กรุงเทพ'].filter(Boolean).join(' '),
      [domain,row.label,'Bangkok'].filter(Boolean).join(' '),
      [domain,'concert fanmeeting Bangkok'].filter(Boolean).join(' '),
      [row.label,'Bangkok'].filter(Boolean).join(' '),
      ...mallQueries,
      ...(decemberRecallQueries[row.source_id]||[])
    ].filter(Boolean);
    return {
      source_id:row.source_id,
      source_tier:row.source_tier,
      required:row.required===true,
      label:row.label,
      domain:row.domain||null,
      query:queries[0],
      query_variants:[...new Set(queries.slice(1))],
      ...(row.direct_url?{direct_url:row.direct_url}:{}),
      providers:[...(row.direct_url?['OFFICIAL_DIRECT']:[]),'BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    };
  });
  return {version:VERSION,month:month||null,location,tasks,production_writes:0,authoritative:false,verifier_required:true};
}

function buildUniverseProof(receipts=[]){
  const byId=new Map(),duplicateIds=new Set();
  for(const row of Array.isArray(receipts)?receipts:[]){
    const id=text(row&&row.source_id);
    if(!id) continue;
    // Each planned source has exactly one aggregate receipt. Do not let a
    // later duplicate hide an earlier failed or incomplete execution.
    if(byId.has(id))duplicateIds.add(id);
    byId.set(id,row);
  }
  const sources=allSources().map(source=>{
    const receipt=byId.get(source.source_id);
    const status=upper(receipt&&receipt.status);
    const executed=receipt&&receipt.executed===true;
    const duplicate=duplicateIds.has(source.source_id);
    const pass=!!receipt && !duplicate && executed && ACCEPTED_STATUSES.has(status);
    return {
      source_id:source.source_id,
      source_tier:source.source_tier,
      required:source.required===true,
      status:duplicate?'DUPLICATE_RECEIPT':status||'MISSING',
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

module.exports={VERSION,REGISTRY,ACCEPTED_STATUSES,monthLabels,allSources,buildUniversePlan,buildUniverseProof};
