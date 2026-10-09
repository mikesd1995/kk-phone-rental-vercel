'use strict';
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const VERSION='KK_MONTHLY_DEEP_SCAN_QUERY_PLAN_V15';
const TIER_TERMS={
 OFFICIAL:['concert fanmeeting fancon showcase mini concert festival Bangkok','คอนเสิร์ต แฟนมีต แฟนคอน โชว์เคส มินิคอนเสิร์ต กรุงเทพ ปริมณฑล','free concert radio station Flex1045 PMCU Siam Halloween multi-day October November Bangkok','ฟรีคอนเสิร์ต สยามฮาโลวีน PMCU Flex 104.5 เทศกาล 30 ตุลาคม 1 พฤศจิกายน ศิลปิน'],
 TICKETING:['Bangkok ticket concert fanmeeting showcase festival','บัตร งานศิลปิน กรุงเทพ ปริมณฑล','KAZZ MARKET activity TutorYim fanmeeting one day trip ticket updated date','LOOKE GELBOYS AllTicket fanmeet onsale event date Thailand'],
 VENUE:['Bangkok venue artist event mall hall','สถานที่จัดงาน ศิลปิน ฮอลล์ ห้าง กรุงเทพ ปริมณฑล'],
 ARTIST_AGENCY:['artist agency Thailand event fan meeting appearance','ค่าย ศิลปิน นักแสดง กิจกรรม แฟนมีต กรุงเทพ','GMMTV DOMUNDI Mandee CHANGE2561 IDOLFACT one31 Channel 3 BL GL event Bangkok','ซีรีส์วาย ซีรีส์ยูริ BL GL คู่จิ้น นักแสดง งานแฟน กรุงเทพ'],
 ORGANIZER_PROMOTER:['organizer promoter Bangkok artist event','ผู้จัด งานศิลปิน กรุงเทพ ปริมณฑล','radio music concert station organizer FlexConnect Flex 104.5 PMCU Siam Square October November','radio free entry festival Thai TPOP 2026 city plaza Bangkok','JMNK SHEเสิร์ฟ concert XOXO Entertainment November 21'],
 MALL_COMMUNITY:['mall artist event Bangkok Nonthaburi Pathum Thani Samut Prakan','ห้าง กิจกรรม ศิลปิน กรุงเทพ นนทบุรี ปทุมธานี สมุทรปราการ','performance schedule artist mall brand booth Bangkok','ตารางงานศิลปิน performance schedule ห้าง แบรนด์ กรุงเทพ','Siam Center POP ป่ะห์ Halloween free TPOP cover dance 1 November 2026','NAMP XOXO Siam Center POP-ป่ะห์ 30 October free mini stage Bangkok','DaouOffroad added 30 October original 31 October daily show centralworld live'],
 FAN_EVENT:['fanmeeting fancon fansign meet greet lucky fan birthday final episode premiere artist Bangkok','แฟนมีต แฟนคอน แฟนไซน์ มีตแอนด์กรี๊ด lucky fan วันเกิด final ep premiere ศิลปิน กรุงเทพ','fan gathering birthday project artist Bangkok','รวมพล แฟนคลับ birthday project ศิลปิน กรุงเทพ','BL GL fan meeting fancon final ep first ep screening Bangkok','ซีรีส์วาย ซีรีส์ยูริ final ep first ep แฟนมีต แฟนคอน รวมพล นัดรวมด้อม กรุงเทพ','fansign hi touch hi bye send off group photo fan call Bangkok','Thai independent idol comeback debut graduation fansign album signing MINDY Sugar N Spice SNS LE7EL Bangkok October 2026','ไอดอลอินดี้ แฟนไซน์ อัลบั้มใหม่ เฟิร์สเดบิวต์ MINDY SNS LE7EL ตุลาคม 2569'],
 CEREMONY:['blessing ceremony launch opening artist Bangkok','บวงสรวง เปิดตัว เปิดงาน ศิลปิน กรุงเทพ','BL GL series บวงสรวง เปิดกล้อง ปิดกล้อง premiere Bangkok'],
 AWARD_RED_CARPET:['award ceremony red carpet Bangkok artist','งานประกาศรางวัล พรมแดง ศิลปิน กรุงเทพ'],
 PRESS_BRAND:['press conference brand event artist appearance Bangkok','งานแถลงข่าว แบรนด์ ศิลปิน อีเวนต์ กรุงเทพ','lucky fan lucky draw top spender top buyer purchase to win artist Bangkok','ลัคกี้แฟน top spender presenter store opening pop up ศิลปิน กรุงเทพ','buy spend register redeem winner announcement confirmation artist brand Bangkok','ซื้อครบ สะสมยอด ลงทะเบียน ลุ้นสิทธิ์ ประกาศรายชื่อ ยืนยันสิทธิ์ ศิลปิน แบรนด์ กรุงเทพ','private talk workshop polaroid one day trip exclusive benefit artist brand Bangkok','private trip workshop ถ่ายภาพ polaroid พูดคุย ศิลปิน แบรนด์ กรุงเทพ','HER HYNESS Lingling Cathy Doll Orm NARS TeeTeePor October 2026 official top fan lucky fan brand event Bangkok',
  'Beauty Buffet LIPTOK Event x AUAUSAVE MhiiPraew Union Mall 9 October 2026',
  'BeautyBuffetLiptokEventxAUAUSAVE BeautyBuffetTH Lucky Fan Top Spender 9 ตุลาคม 2569','แบรนด์กันแดด เครื่องสำอาง Top Fan Lucky Fan ศิลปิน หลิงหลิง ออม ตี๋ตี๋ป๋อ ตุลาคม 2569 กรุงเทพ'],
 CAMPAIGN_LEAD_TIME:['artist brand campaign registration winner announcement next month Bangkok',
  'Beauty Buffet LIPTOK 60 Lucky Fans 10 Top Spenders 25 August September registration 9 October 2026',
  'beautybuffet_th Auau Save August announced October Bangkok brand campaign','กิจกรรมแบรนด์ ศิลปิน สะสมยอด ประกาศผู้โชคดี งานเดือนหน้า กรุงเทพ','event date next month ticket on sale this month GELBOYS LOOKE Bangkok','LABX DEXX top spender private session cash voucher qualification October event November'],
 VISUAL_SCHEDULE:['artist performance schedule mall brand Bangkok',
  'AUAUSAVE MhiiPraew official October 2026 appearance schedule Domundi Beauty Buffet',
  'AuauSaveHouseTH BeautyBuffetTH Union Mall G Floor 9 October 2026 artist appearance','ตารางงานศิลปิน performance schedule lineup ห้าง แบรนด์ กรุงเทพ','same franchise different date new show Mr Fanboy BUSKING centralworld true5G','LingOrm official source vs fan schedule October 2026 brand event one day private','TeeTeePor fan calendar October 2026 NARS BENTON brand event daily roster official corroboration'],
 SPORTS_ENTERTAINMENT:['sports entertainment artist event Bangkok','RoV T-POP esports offline event idols 23 October 2026','Bangkok gaming convention Thailand Game Show stage idols special performance October 2026','กีฬา entertainment ศิลปิน กรุงเทพ'],
 SOCIAL:['concert fanmeeting artist appearance Bangkok X Instagram TikTok','กิจกรรม ศิลปิน กรุงเทพ ปริมณฑล X Instagram TikTok'],
 COMPETITOR:['เช่ามือถือ vivo X300 Pro iPhone Samsung concert fanmeeting fansign Bangkok','เช่ามือถือ งานศิลปิน แฟนมีต แฟนไซน์ คิวหลุด กรุงเทพ ปริมณฑล'],
 ANNOUNCEMENT_CHANGE:['added show sold out postponed cancelled new date venue Bangkok artist','เพิ่มรอบ sold out เต็ม เลื่อน ยกเลิก เปลี่ยนวัน เปลี่ยนสถานที่ ศิลปิน กรุงเทพ','updated date revised poster KAZZ TutorYim old product page conflicts October 2026','DaouOffroad Halloween Fan Party NEW ROUND ADDED Oct 30 original show Oct 31 One31 OPEN LABEL exact show date','งานเพิ่มรอบ รอบแรก รอบใหม่ 30 31 ตุลาคม 2569 เปิดเพิ่มวันอื่น ห้ามแก้ทับรอบเดิม','ประกาศเลื่อนวัน updated date โปสเตอร์ใหม่ ขัดกับวันเก่าหน้าขายบัตร'],
 PUBLIC_CALENDAR:['Bangkok events concerts fan meetings calendar','ปฏิทิน อีเวนต์ ศิลปิน กรุงเทพ ปริมณฑล']
};
// Month-targeted discovery must not spend the November budget on October
// 9/30/31-specific campaigns. Cross-month purchase windows remain searchable
// when the actual announced event is within November.
const OCTOBER_ONLY_TERMS_RE=/(?:October 2026|ตุลาคม 2569|9 October 2026|9 ตุลาคม|30 October|31 October|Oct 30|Oct 31|30 31 ตุลาคม|October November Bangkok)/i;
const NOVEMBER_2026_TERMS=Object.freeze({
 PRESS_BRAND:Object.freeze([
  'BEAUTRIUM Junior SENKA lucky 30 fan November 6 Siam Square',
  "L Oreal Paris Elseve Day AuAu 50 lucky fans 20 November Bangkok",
  'LOLLI POP-UP GET GLOWING November 26 Mew 27 JamesSu 28 BeverTonliew 29 EmiBonnie',
  'D7 NuNew นุนิวชวนม่วน งานวัดนี้มีรัก 29 พฤศจิกายน ยูเนี่ยนมอลล์'
 ]),
 CAMPAIGN_LEAD_TIME:Object.freeze([
  '2026 October buy register lucky fan campaign whose artist event occurs November Bangkok',
  'พฤศจิกายน 2569 งานลัคกี้แฟน เปิดลงทะเบียนตุลาคม BEAUTRIUM LOREAL LOLLI D7',
  'Thai skincare beauty brands 7-Eleven Lotus Watsons Lucky Fans Top Spender November 2026 artist'
 ]),
 VISUAL_SCHEDULE:Object.freeze([
  'site:instagram.com/lolliofficialth November 2026 brand actor artist per-day appearance schedule',
  'November 2026 official artist appearance daily schedule Domundi GMMTV LingOrm AuAuSave TeeTeePor',
  'ตารางงานศิลปิน วันที่ 1 30 พฤศจิกายน 2569 ห้าง ลัคกี้แฟน แบรนด์'
 ]),
 MALL_COMMUNITY:Object.freeze([
  'November 2026 Union Mall Siam Square CentralWorld MBK ONE Bangkok idol brand artists free fan event',
  'november 2026 beauty retail pop up influencer artist calendar Bangkok'
 ]),
 FAN_EVENT:Object.freeze([
  'LOLLI popup Mew Suppasit JamesSu BeverTonliew EmiBonnie distinct daily event 26 27 28 29 November 2026',
  'November 2026 Bangkok small idol release fansign meet greet awards premiere birthday lucky fan',
  'แฟนไซน์ ไอดอลอินดี้ บวงสรวง ด้อม ศิลปิน 2569 พฤศจิกายน กรุงเทพ'
 ]),
 ARTIST_AGENCY:Object.freeze([
  'November 2026 Thai BL GL actor daily schedule GMMTV DOMUNDI CHANGE2561 IDOLFACTORY ONE31',
  'November 2026 MINDY LE7EL SNS idol signed album handover fan event Bangkok'
 ]),
 SOCIAL:Object.freeze([
  'site:x.com November 2026 TH lucky 30 lucky 50 artist meet brand Bangkok',
  'site:instagram.com November 2026 artist popup lucky fan fashion beauty Bangkok'
 ]),
 ANNOUNCEMENT_CHANGE:Object.freeze([
  'November 2026 Bangkok added show rescheduled venue change cancelled GMMTV idol lucky fan',
  'พฤศจิกายน 2569 เปลี่ยนวัน เลื่อนงาน ย้ายสถานที่ ศิลปิน lucky fan กรุงเทพ'
 ])
});
function tierTermsForMonth(source_tier,month){
 const base=(TIER_TERMS[source_tier]||[]).filter(term=>
   month==='2026-10'||!OCTOBER_ONLY_TERMS_RE.test(term));
 if(month==='2026-11')return [...base,...(NOVEMBER_2026_TERMS[source_tier]||[])];
 return base;
}
const OPERATIONAL_TIERS=Object.freeze([
 'OFFICIAL','TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_AGENCY',
 'MALL_COMMUNITY','FAN_EVENT','CEREMONY','PRESS_BRAND','CAMPAIGN_LEAD_TIME','VISUAL_SCHEDULE','SPORTS_ENTERTAINMENT','SOCIAL','COMPETITOR','ANNOUNCEMENT_CHANGE','PUBLIC_CALENDAR'
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
 for(const source_tier of Object.keys(TIER_TERMS))for(const term of tierTermsForMonth(source_tier,range.month)){const qs=queryVariantsForTerm(term,range,location,learned);const liveNationEligible=['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','ORGANIZER_PROMOTER','PUBLIC_CALENDAR'].includes(source_tier);gap_tasks.push({source_tier,query:qs[0],query_variants:qs.slice(1),providers:[...(liveNationEligible?['LIVENATION_PUBLIC']:[]),'OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],stop_condition:'EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS',evidence_required:true,date_window:{start:range.start_date,end:source_tier==='CAMPAIGN_LEAD_TIME'?leadTimeEnd(range):range.end_date},campaign_lead_time:source_tier==='CAMPAIGN_LEAD_TIME'});}
 for(const fandom of hotFandoms){
  gap_tasks.push({source_tier:'FANDOM_GRAPH',source_id:'fandom-'+fandom.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi,'-').slice(0,60),query:fandom+' fanmeeting fancon fansign brand event birthday Bangkok '+range.month,query_variants:[fandom+' เช่ามือถือ กรุงเทพ '+range.month,fandom+' lucky fan meet greet กรุงเทพ '+range.month,fandom+' added show sold out Bangkok '+range.month],providers:['OFFICIAL_DIRECT','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','EXA'],stop_condition:'EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS',evidence_required:true,date_window:{start:range.start_date,end:range.end_date}});
 }
  const universe=SourceRegistry.buildUniversePlan({month:range.month,location});
 for(const task of universe.tasks)gap_tasks.push({source_tier:task.source_tier,source_id:task.source_id,query:task.query,providers:task.providers,stop_condition:'EXECUTE_AND_RECORD_RECEIPT',evidence_required:true,required:task.required,date_window:{start:range.start_date,end:range.end_date}});
 return {version:VERSION,mode:'ULTRA_DEEP_MONTH_LONG_TAIL',range,location,gap_tasks,source_universe_version:universe.version,source_universe_task_count:universe.tasks.length,required_tiers:Object.keys(TIER_TERMS),learned_query_count:learned.length,hot_fandom_query_count:hotFandoms.length,production_writes:0,authoritative:false,verifier_required:true};
}
function buildOperational(input={}){
 const range=monthRange(input),location=text(input.location)||'Bangkok Metropolitan Region Thailand',learned=Array.isArray(input.learned_query_terms)?input.learned_query_terms:[],hotFandoms=(Array.isArray(input.hot_fandom_terms)?input.hot_fandom_terms:[]).map(text).filter(Boolean).slice(0,6),gap_tasks=[];
 for(const source_tier of OPERATIONAL_TIERS){
  const term=tierTermsForMonth(source_tier,range.month)[0];if(!term)continue;
  const qs=queryVariantsForTerm(term,range,location,learned);
  const liveNationEligible=['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','ORGANIZER_PROMOTER','PUBLIC_CALENDAR'].includes(source_tier);
  gap_tasks.push({
   source_tier,
   source_id:'smart-'+source_tier.toLowerCase().replace(/_/g,'-'),
   query:qs[0],
   query_variants:qs.slice(1,4),
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
  version:'KK_SMART_OPERATIONAL_QUERY_PLAN_V3',
  mode:'SMART_OPERATIONAL',
  range,location,gap_tasks,
  operational_tiers:[...OPERATIONAL_TIERS],hot_fandom_query_count:hotFandoms.length,
  audit_required:true,
  production_writes:0,
  authoritative:false,
  verifier_required:true
 };
}
module.exports={VERSION,TIER_TERMS,NOVEMBER_2026_TERMS,tierTermsForMonth,OPERATIONAL_TIERS,monthRange,leadTimeEnd,queryVariantsForTerm,build,buildOperational};
