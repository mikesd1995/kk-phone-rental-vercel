'use strict';
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const VERSION='KK_MONTHLY_DEEP_SCAN_QUERY_PLAN_V15';
const TIER_TERMS={
 OFFICIAL:['concert fanmeeting fancon showcase mini concert festival Bangkok','คอนเสิร์ต แฟนมีต แฟนคอน โชว์เคส มินิคอนเสิร์ต กรุงเทพ ปริมณฑล','free concert radio station Flex1045 PMCU Siam Halloween multi-day October November Bangkok','ฟรีคอนเสิร์ต สยามฮาโลวีน PMCU Flex 104.5 เทศกาล 30 ตุลาคม 1 พฤศจิกายน ศิลปิน'],
 TICKETING:['Bangkok ticket concert fanmeeting showcase festival','บัตร งานศิลปิน กรุงเทพ ปริมณฑล','KAZZ MARKET activity TutorYim fanmeeting one day trip ticket updated date','LOOKE GELBOYS AllTicket fanmeet onsale event date Thailand'],
 VENUE:['Bangkok venue artist event mall hall','สถานที่จัดงาน ศิลปิน ฮอลล์ ห้าง กรุงเทพ ปริมณฑล'],
 MUSIC_SHOWCASE:['single showcase new song release music debut Bangkok','โชว์เคสซิงเกิลที่สอง เปิดตัวเพลงใหม่ มินิโชว์เคส ศิลปิน กรุงเทพ','artist single release showcase press photo fan benefits registration Bangkok','DMD MUSIC DOMUNDI FirstOne single showcase Union Mall music launch Bangkok'],
 FAN_PROJECT_GALLERY:['fan project anniversary gallery exhibit idol couple Bangkok','แฟนโปรเจกต์ แกลเลอรี ครบรอบ นิทรรศการแฟนคลับ ศิลปิน กรุงเทพ','fanmade birthday anniversary cafe pop up photo gallery Bangkok union mall','AuAu Save fanbase project gallery two day exhibit Union Mall Bangkok'],
 MALL_IP_ACTIVATION:['series character IP halloween mall exhibition fan photo zone Bangkok','กิจกรรมฮาโลวีน จัดแสดง ซีรีส์ สยามเซ็นเตอร์ เวทีนักแสดง จุดถ่ายรูป กรุงเทพ','WeTV Star Hunter series mall activation check in popup Halloween Bangkok','Siam Center seasonal series exhibition artist schedule October November Bangkok'],
 ARTIST_AGENCY:['artist agency Thailand event fan meeting appearance','ค่าย ศิลปิน นักแสดง กิจกรรม แฟนมีต กรุงเทพ','GMMTV DOMUNDI Mandee CHANGE2561 IDOLFACT one31 Channel 3 BL GL event Bangkok','ซีรีส์วาย ซีรีส์ยูริ BL GL คู่จิ้น นักแสดง งานแฟน กรุงเทพ'],
 ORGANIZER_PROMOTER:['organizer promoter Bangkok artist event','ผู้จัด งานศิลปิน กรุงเทพ ปริมณฑล','radio music concert station organizer FlexConnect Flex 104.5 PMCU Siam Square October November','radio free entry festival Thai TPOP 2026 city plaza Bangkok','JMNK SHEเสิร์ฟ concert XOXO Entertainment November 21'],
 MALL_COMMUNITY:['mall artist event Bangkok Nonthaburi Pathum Thani Samut Prakan','ห้าง กิจกรรม ศิลปิน กรุงเทพ นนทบุรี ปทุมธานี สมุทรปราการ','performance schedule artist mall brand booth Bangkok','ตารางงานศิลปิน performance schedule ห้าง แบรนด์ กรุงเทพ','Siam Center POP ป่ะห์ Halloween free TPOP cover dance 1 November 2026'],
 FAN_EVENT:['fanmeeting fancon fansign meet greet lucky fan birthday final episode premiere artist Bangkok','แฟนมีต แฟนคอน แฟนไซน์ มีตแอนด์กรี๊ด lucky fan วันเกิด final ep premiere ศิลปิน กรุงเทพ','fan gathering birthday project artist Bangkok','รวมพล แฟนคลับ birthday project ศิลปิน กรุงเทพ','BL GL fan meeting fancon final ep first ep screening Bangkok','ซีรีส์วาย ซีรีส์ยูริ final ep first ep แฟนมีต แฟนคอน รวมพล นัดรวมด้อม กรุงเทพ','fansign hi touch hi bye send off group photo fan call Bangkok','crossover concert new chapter final chapter same artist different dates eventpop Bangkok','BL GL grand premiere series screening OST showcase fan concert ticket booking Bangkok','งานคอนเสิร์ตครอสโอเวอร์ ศิลปินคู่จิ้น ซีรีส์รอบพรีเมียร์ OST โชว์พิเศษ แฟนไซน์ กรุงเทพ'],
 CEREMONY:['blessing ceremony launch opening artist Bangkok','บวงสรวง เปิดตัว เปิดงาน ศิลปิน กรุงเทพ','BL GL series บวงสรวง เปิดกล้อง ปิดกล้อง premiere Bangkok'],
 AWARD_RED_CARPET:['award ceremony red carpet HOWE Awards MAYA Awards KAZZ Bangkok artist','งานประกาศรางวัล พรมแดง HOWE MAYA KAZZ ศิลปิน กรุงเทพ','official award magazine anniversary ceremony photo red carpet public fan access Bangkok','ตารางงานศิลปิน งานประกาศรางวัล พรมแดง การเข้าพื้นที่ แฟนคลับ กรุงเทพ'],
 PRESS_BRAND:['press conference brand event artist appearance Bangkok','งานแถลงข่าว แบรนด์ ศิลปิน อีเวนต์ กรุงเทพ','lucky fan lucky draw top spender top buyer purchase to win artist Bangkok','ลัคกี้แฟน top spender presenter store opening pop up ศิลปิน กรุงเทพ','buy spend register redeem winner announcement confirmation artist brand Bangkok','ซื้อครบ สะสมยอด ลงทะเบียน ลุ้นสิทธิ์ ประกาศรายชื่อ ยืนยันสิทธิ์ ศิลปิน แบรนด์ กรุงเทพ','private talk workshop polaroid one day trip exclusive benefit artist brand Bangkok','private trip workshop ถ่ายภาพ polaroid พูดคุย ศิลปิน แบรนด์ กรุงเทพ'],
 CAMPAIGN_LEAD_TIME:['artist brand campaign registration winner announcement next month Bangkok','กิจกรรมแบรนด์ ศิลปิน สะสมยอด ประกาศผู้โชคดี งานเดือนหน้า กรุงเทพ','event date next month ticket on sale this month GELBOYS LOOKE Bangkok','LABX DEXX top spender private session cash voucher qualification October event November'],
 VISUAL_SCHEDULE:['artist performance schedule mall brand Bangkok','ตารางงานศิลปิน performance schedule lineup ห้าง แบรนด์ กรุงเทพ','same franchise different date new show Mr Fanboy BUSKING centralworld true5G'],
 SPORTS_ENTERTAINMENT:['sports entertainment artist event Bangkok','กีฬา entertainment ศิลปิน กรุงเทพ'],
 SOCIAL:['concert fanmeeting artist appearance Bangkok X Instagram TikTok','กิจกรรม ศิลปิน กรุงเทพ ปริมณฑล X Instagram TikTok'],
 COMPETITOR:['เช่ามือถือ vivo X300 Pro iPhone Samsung concert fanmeeting fansign Bangkok','เช่ามือถือ งานศิลปิน แฟนมีต แฟนไซน์ คิวหลุด กรุงเทพ ปริมณฑล'],
 ANNOUNCEMENT_CHANGE:['added show sold out postponed cancelled new date venue Bangkok artist','เพิ่มรอบ sold out เต็ม เลื่อน ยกเลิก เปลี่ยนวัน เปลี่ยนสถานที่ ศิลปิน กรุงเทพ','updated date revised poster KAZZ TutorYim old product page conflicts October 2026','ประกาศเลื่อนวัน updated date โปสเตอร์ใหม่ ขัดกับวันเก่าหน้าขายบัตร'],
 PUBLIC_CALENDAR:['Bangkok events concerts fan meetings calendar','ปฏิทิน อีเวนต์ ศิลปิน กรุงเทพ ปริมณฑล']
};
const OPERATIONAL_TIERS=Object.freeze([
 'OFFICIAL','TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_AGENCY',
 'MALL_COMMUNITY','FAN_EVENT','MUSIC_SHOWCASE','FAN_PROJECT_GALLERY','MALL_IP_ACTIVATION','CEREMONY','AWARD_RED_CARPET','PRESS_BRAND','CAMPAIGN_LEAD_TIME','VISUAL_SCHEDULE','SPORTS_ENTERTAINMENT','SOCIAL','COMPETITOR','ANNOUNCEMENT_CHANGE','PUBLIC_CALENDAR'
]);
function text(v){return String(v==null?'':v).trim();}
function queryVariantsForTerm(term,range,location,learned=[]){
 const labels=SourceRegistry.monthLabels(range.month), compact=text(term);
 return [...new Set([compact+' '+labels.en+' '+location,compact+' '+labels.th+' กรุงเทพ ปริมณฑล',compact+' Bangkok',compact+' Nonthaburi',compact+' Pathum Thani',compact+' Samut Prakan',compact,...learned.map(text)])].filter(Boolean);
}
function monthRange(input={}){
 const raw=text(input.month);let y,m;
 if(/^\d{4}-\d{2}$/.test(raw)){[y,m]=raw.split('-').map(Number);}else{const base=/^\d{4}-\d{2}-\d{2}$/.test(text(input.current_date))?new Date(text(input.current_date)+'T00:00:00Z'):new Date();y=base.getUTCFullYear();m=base.getUTCMonth()+2;if(m===13){m=1;y++;}}
 const last=new Date(Date.UTC(y,m,0)).getUTCDate(),mm=String(m).padStart(2,'0');return {month:y+'-'+mm,start_date:y+'-'+mm+'-01',end_date:y+'-'+mm+'-'+String(last).padStart(2,'0')};
}
function leadTimeEnd(range){const [y,m]=range.month.split('-').map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1,last=new Date(Date.UTC(ny,nm,0)).getUTCDate();return ny+'-'+String(nm).padStart(2,'0')+'-'+String(last).padStart(2,'0');}
function build(input={}){
 const range=monthRange(input),location=text(input.location)||'Bangkok Metropolitan Region Thailand',learned=Array.isArray(input.learned_query_terms)?input.learned_query_terms:[],hotFandoms=(Array.isArray(input.hot_fandom_terms)?input.hot_fandom_terms:[]).map(text).filter(Boolean).slice(0,12),gap_tasks=[];
 for(const [source_tier,terms] of Object.entries(TIER_TERMS))for(const term of terms){const qs=queryVariantsForTerm(term,range,location,learned);const liveNationEligible=['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','ORGANIZER_PROMOTER','PUBLIC_CALENDAR'].includes(source_tier);gap_tasks.push({source_tier,query:qs[0],query_variants:qs.slice(1),providers:[...(liveNationEligible?['LIVENATION_PUBLIC']:[]),'OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI'],stop_condition:'EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS',evidence_required:true,date_window:{start:range.start_date,end:source_tier==='CAMPAIGN_LEAD_TIME'?leadTimeEnd(range):range.end_date},campaign_lead_time:source_tier==='CAMPAIGN_LEAD_TIME'});}
 for(const fandom of hotFandoms){
  gap_tasks.push({source_tier:'FANDOM_GRAPH',source_id:'fandom-'+fandom.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi,'-').slice(0,60),query:fandom+' fanmeeting fancon fansign brand event birthday Bangkok '+range.month,query_variants:[fandom+' เช่ามือถือ กรุงเทพ '+range.month,fandom+' lucky fan meet greet กรุงเทพ '+range.month,fandom+' added show sold out Bangkok '+range.month],providers:['OFFICIAL_DIRECT','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA'],stop_condition:'EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS',evidence_required:true,date_window:{start:range.start_date,end:range.end_date}});
 }
  const universe=SourceRegistry.buildUniversePlan({month:range.month,location});
 for(const task of universe.tasks)gap_tasks.push({source_tier:task.source_tier,source_id:task.source_id,query:task.query,query_variants:task.query_variants,providers:task.providers,stop_condition:'EXECUTE_AND_RECORD_RECEIPT',evidence_required:true,required:task.required,date_window:{start:range.start_date,end:range.end_date}});
 return {version:VERSION,mode:'ULTRA_DEEP_MONTH_LONG_TAIL',range,location,gap_tasks,source_universe_version:universe.version,source_universe_task_count:universe.tasks.length,required_tiers:Object.keys(TIER_TERMS),learned_query_count:learned.length,hot_fandom_query_count:hotFandoms.length,production_writes:0,authoritative:false,verifier_required:true};
}
function operationalRecallVariants(tier,range){
 const en=SourceRegistry.monthLabels(range.month).en;
 const th=SourceRegistry.monthLabels(range.month).th;
 if(tier==='MUSIC_SHOWCASE')return [
  'single song showcase fan benefit registration '+en+' Bangkok',
  'โชว์เคสซิงเกิล เปิดตัวเพลง ศิลปิน '+th+' Union Mall กรุงเทพ',
  'DMD MUSIC DOMUNDI concert stage album showcase '+en+' Bangkok'
 ];
 if(tier==='FAN_PROJECT_GALLERY')return [
  'fan anniversary gallery union mall '+en+' Bangkok',
  'แฟนโปรเจกต์ ครบรอบ นิทรรศการแกลเลอรี '+th+' กรุงเทพ',
  'idol fandom birthday pop up gallery fanbase '+en+' Bangkok'
 ];
 if(tier==='MALL_IP_ACTIVATION')return [
  'series Halloween exhibition Siam Center WeTV '+en+' Bangkok',
  'สยามเซ็นเตอร์ ฮาโลวีน ซีรีส์จัดแสดง จุดถ่ายภาพ '+th,
  'Star Hunter WeTV TV series mall check in exhibit '+en+' Bangkok'
 ];
 if(tier==='TICKETING')return [
  'site:eventpop.me/e fan concert crossover concert fansign '+en+' Bangkok',
  'site:thaiticketmajor.com premiere OST showcase fanmeeting '+en+' Bangkok',
  'site:ticketmelon.com fancon series finale '+en+' Bangkok'
 ];
 if(tier==='FAN_EVENT')return [
  'crossover concert artist same fandom separate dates '+en+' Bangkok Eventpop',
  'BL GL grand premiere OST special show '+th+' กรุงเทพ ผู้จัด',
  'แฟนไซน์ คู่จิ้น crossover final chapter งานศิลปิน '+th+' กรุงเทพ'
 ];
 if(tier==='ARTIST_AGENCY')return [
  'GMMTV CHANGE2561 Mandee BL GL grand premiere OST show '+en+' Bangkok',
  'GMMTV ซีรีส์ รอบพรีเมียร์ โชว์เพลงประกอบ '+th+' กรุงเทพ',
  'ค่ายศิลปิน fancon fansign crossover event '+th+' กรุงเทพ'
 ];
 return null;
}
function buildOperational(input={}){
 const range=monthRange(input),location=text(input.location)||'Bangkok Metropolitan Region Thailand',learned=Array.isArray(input.learned_query_terms)?input.learned_query_terms:[],hotFandoms=(Array.isArray(input.hot_fandom_terms)?input.hot_fandom_terms:[]).map(text).filter(Boolean).slice(0,6),gap_tasks=[];
 for(const source_tier of OPERATIONAL_TIERS){
  const term=(TIER_TERMS[source_tier]||[])[0];if(!term)continue;
  const qs=queryVariantsForTerm(term,range,location,learned);
  const liveNationEligible=['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','ORGANIZER_PROMOTER','PUBLIC_CALENDAR'].includes(source_tier);
  gap_tasks.push({
   source_tier,
   source_id:'smart-'+source_tier.toLowerCase().replace(/_/g,'-'),
   query:qs[0],
   query_variants:source_tier==='AWARD_RED_CARPET'?[qs[1],TIER_TERMS.AWARD_RED_CARPET[1]+' '+SourceRegistry.monthLabels(range.month).th+' กรุงเทพ',qs[2]]:(operationalRecallVariants(source_tier,range)||qs.slice(1,4)),
   providers:[...(liveNationEligible?['LIVENATION_PUBLIC']:[]),'BING_RSS','OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA'],
   stop_condition:'FIRST_USABLE_EVIDENCE_OR_BOUNDED_NO_EVIDENCE',
   evidence_required:false,
   date_window:{start:range.start_date,end:source_tier==='CAMPAIGN_LEAD_TIME'?leadTimeEnd(range):range.end_date},
   campaign_lead_time:source_tier==='CAMPAIGN_LEAD_TIME'
  });
 }
 for(const fandom of hotFandoms){
  gap_tasks.push({
   source_tier:'FANDOM_GRAPH',source_id:'smart-fandom-'+fandom.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi,'-').slice(0,50),
   query:fandom+' fanmeet fansign brand event Bangkok '+range.month,
   query_variants:[fandom+' เช่ามือถือ กรุงเทพ '+range.month,fandom+' added show sold out Bangkok '+range.month],
   providers:['BING_RSS','OFFICIAL_DIRECT','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA'],
   stop_condition:'FIRST_USABLE_EVIDENCE_OR_BOUNDED_NO_EVIDENCE',evidence_required:false,date_window:{start:range.start_date,end:range.end_date}
  });
 }
 return {
  version:'KK_SMART_OPERATIONAL_QUERY_PLAN_V6',
  mode:'SMART_OPERATIONAL',
  range,location,gap_tasks,
  operational_tiers:[...OPERATIONAL_TIERS],hot_fandom_query_count:hotFandoms.length,
  audit_required:true,
  production_writes:0,
  authoritative:false,
  verifier_required:true
 };
}
module.exports={VERSION,TIER_TERMS,OPERATIONAL_TIERS,monthRange,leadTimeEnd,queryVariantsForTerm,operationalRecallVariants,build,buildOperational};
