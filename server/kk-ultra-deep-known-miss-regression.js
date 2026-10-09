'use strict';

const VERSION='KK_ULTRA_DEEP_KNOWN_MISS_V12';

const CORPUS=Object.freeze([
  {case_id:'remaster-20261010',title:'REMASTER CONCERT',aliases:['remaster concert'],event_date:'2026-10-10'},
  {case_id:'pink-aura-20260928',title:'THE PINK AURA',aliases:['the pink aura','pink aura'],event_date:'2026-09-28'},
  {case_id:'minmin-frozen-candy-20260930',title:'MINMIN x TeeTeePor - THE FROZEN CANDY LAND',aliases:['frozen candy land','minmin teeteepor','teetee por frozen candy'],event_date:'2026-09-30'},
  {case_id:'sport-day-after-match-20261001',title:'SPORT DAY AFTER MATCH with TEETEE-POR',aliases:['sport day after match','teetee por sport day'],event_date:'2026-10-01'},
  {case_id:'you-maniac-blind-date-20261003',title:'YOU MANIAC BLIND DATE',aliases:['you maniac blind date','youmaniacseries','you maniac series'],event_date:'2026-10-03'},
  {case_id:'bai-lu-meet-love-20261025',title:'MEET & LOVE BAI LU SPECIAL FANMEETING',aliases:['meet love bai lu','bai lu special fanmeeting','bailu wespark','bai lu wespark','bailu personal fan meeting bangkok','bailu fan meeting bangkok'],event_date:'2026-10-25'},
  {case_id:'tutoryim-updated-20261018',title:'TUTOR YIM',aliases:['tutor yim','tutoryim','ปล่อยปลาฉลาม'],event_date:'2026-10-18'},
  {case_id:'scoopify-james-su-20261024',title:'SCOOPIFY YOGURT & YOU WITH JAMES SU',aliases:['scoopify yogurt you james su','james su scoopify','yogurt you james su','scoopifyyogurtandjamessu','summervibeth james su'],search_queries:['SCOOPIFYYogurtAndJamesSu SummerVibeTH','SCOOPIFY James Su SummerVibeTH'],event_date:'2026-10-24'},
  {case_id:'tle-firstone-20261022',title:'A TOUCH OF LOVE WITH TLE-FIRSTONE',aliases:['touch of love tle firstone','tle firstone','tle-firstone','everpink a touch of love tlefirstone','everpinkxtlefirstone'],search_queries:['EVERPINKxTleFirstone','EVERPINK A Touch of Love TleFirstone'],event_date:'2026-10-22'},
  {case_id:'ryo-teeteepor-20261007',title:'RYO Strong Roots, Bright Stars with TeeTee & Por',aliases:['ryo hair teeteepor','strong roots bright stars teetee por','ryo hair x ttp','ryohairxteeteepor'],search_queries:['TeeTee Por October 2026 schedule','TeeTeePor RYO Hair 7 October 2026','RYO Hair TeeTee Por Central Pinklao'],event_date:'2026-10-07',miss_class:'ARTIST_BRAND_SOCIAL_KEYWORDLESS_APPEARANCE'},
  {case_id:'the-weeknd-20261011',title:'The Weeknd: After Hours Til Dawn Tour',aliases:['the weeknd after hours til dawn bangkok'],search_queries:['the weeknd after hours til dawn bangkok October 2026'],event_date:'2026-10-11',miss_class:'INTERNATIONAL_CONCERT_SOURCE_GAP'},
  {case_id:'mindaryn-20261016',title:'MindaRyn 1st Asia Tour Calling Back',aliases:['mindaryn calling back bangkok'],search_queries:['mindaryn calling back bangkok October 2026'],event_date:'2026-10-16',miss_class:'INTERNATIONAL_CONCERT_SOURCE_GAP'},
  {case_id:'klive-bandage-20261017',title:'K-LIVE FESTIVAL BAND:AGE IN BANGKOK',aliases:['k live festival band age bangkok'],search_queries:['k live festival band age bangkok October 2026'],event_date:'2026-10-17',miss_class:'INTERNATIONAL_CONCERT_SOURCE_GAP'},
  {case_id:'meme-fest-20261017',title:'MEME FEST 2026',aliases:['meme fest 2026 bangkok'],search_queries:['meme fest 2026 bangkok October 2026'],event_date:'2026-10-17',miss_class:'FESTIVAL_TAXONOMY_GAP'},
  {case_id:'0wave-20261021',title:'VERY Live Presents 0WAVE Live In Bangkok 2026',aliases:['0wave live bangkok 2026'],search_queries:['0wave live bangkok 2026 October 2026'],event_date:'2026-10-21',miss_class:'THAI_LIVE_SOURCE_GAP'},
  {case_id:'interstellar-live-20261028',title:'INTERSTELLAR LIVE CONCERT',aliases:['interstellar live concert bangkok'],search_queries:['interstellar live concert bangkok October 2026'],event_date:'2026-10-28',miss_class:'TICKETING_SOURCE_GAP'},
  {case_id:'pixxie-soundscape-20261030',title:'PiXXiE live at Bangkok Soundscape',aliases:['pixxie bangkok soundscape'],search_queries:['pixxie bangkok soundscape October 2026'],event_date:'2026-10-30',miss_class:'THAI_LIVE_SOURCE_GAP'},
  {case_id:'nct127-redline-20261031',title:'NCT 127 5TH TOUR NEO CITY - THE REDLINE',aliases:['nct 127 redline bangkok'],search_queries:['nct 127 redline bangkok October 2026'],event_date:'2026-10-31',miss_class:'INTERNATIONAL_CONCERT_SOURCE_GAP'},
  {case_id:'fortreasure-20261129',title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure beyond the horizon','fort treasure beyond horizon','fortreasure concert','beyond the horizon concert fortfts','fortfts fortreasure'],search_queries:['FORTREASURE site:eventpop.me','FORTREASURE FortFTS Eventpop'],event_date:'2026-11-29'},
  {case_id:'herhyness-lingling-20261021',title:'HER HYNESS x LINGLING UNLOCK THE ULTIMATE PROTECTION',aliases:['her hyness lingling ultimate protection','herhyness x lingling kwong','herhyness lingling top fan 21 october'],search_queries:['HER HYNESS LINGLING CentralWorld 21 October 2026','HerHynessBeauty Lingling unlock the ultimate protection top fan'],event_date:'2026-10-21',miss_class:'BRAND_PURCHASE_CAMPAIGN_GAP'},
  {case_id:'cathydoll-orm-20261023',title:'CATHY DOLL x ORM THE MISSION LOVE PARTY',aliases:['cathy doll orm mission love party','cathydoll x orm kornnaphat','orm cathy doll 23 october'],search_queries:['Cathy Doll Orm Mission Love Party 23 October 2026 Asiatique','CathyDoll Thailand Orm 23 Oct 2026 official'],event_date:'2026-10-23',miss_class:'ARTIST_SCHEDULE_GAP'},
  {case_id:'nars-teeteepor-20261025',title:'NARS x TEETEEPOR BRAND EVENT',aliases:['nars teeteepor 25 october','nars tee tee por','nars x teeteepor lucky fan'],search_queries:['NARS Thailand TeeTeePor 25 October 2026 official lucky fan','NARS TeeTeePor 25 ตุลาคม 2569'],event_date:'2026-10-25',miss_class:'BRAND_PRIVATE_EXPERIENCE_GAP'},
  {case_id:'sing-infinity-20261024',title:'SING INFINITY เพลงเพราะไม่รู้จบ',aliases:['sing infinity','the giving concert sing infinity','เพลงเพราะไม่รู้จบ'],search_queries:['SING INFINITY SiamPic Hall 24 October 2026','NuNew Tle FirstOne SING INFINITY'],event_date:'2026-10-24',miss_class:'PUBLIC_CHARITY_CONCERT_SOURCE_GAP'},
  {case_id:'love-at-first-trip-20261108',title:'Love at First Trip with TleFirstone',aliases:['love at first trip tlefirstone','saraan tle firstone trip','tlefirstone 8 nov 2026'],search_queries:['Saraan Love at First Trip TleFirstone 8 Nov 2026','TleFirstone Saraan November 2026'],event_date:'2026-11-08',miss_class:'BRAND_PURCHASE_CAMPAIGN_GAP'},
  {case_id:'elseve-auau-20261120',title:'L’Oreal Paris Elseve Day with AuAu',aliases:['elseve day with auau','loreal paris elseve auau','auau 20 november 2026'],search_queries:['LOrealParisTH Elseve Day With AuAu 20 November 2026','AuAu Elseve lucky fan 50'],event_date:'2026-11-20',miss_class:'BRAND_PURCHASE_CAMPAIGN_GAP'},
  {case_id:'curel-auu-save-20261219',title:'Curél Sun-safe & Fan-fun! Auu & Save',aliases:['curel auu save','sun safe fan fun auu save','auu save 19 december 2026'],search_queries:['Curel Auu Save 19 December 2026','Sun-safe Fan-fun Auu Save Curel'],event_date:'2026-12-19',miss_class:'BRAND_LEAD_TIME_CAMPAIGN_GAP'},
  {case_id:'tops-beauty-schedule-20261001',title:'TOPS OF BEAUTY PERFORMANCE SCHEDULE',aliases:['tops of beauty performance schedule','central pinklao performance schedule'],search_queries:['Tops of Beauty Performance Schedule Central Pinklao October 2026','TOPS Thailand artist schedule Central Pinklao'],event_date:'2026-10-01',miss_class:'RETAIL_SCHEDULE_BOARD_GAP'},
  {case_id:'mrfanboy-busking-20261011',title:'MR.FANBOY BUSKING presented by true5G',aliases:['mr fanboy busking true5g centralworld','mr fanboy busking 11 october','mr fanboy busking 11 ตุลาคม'],search_queries:['MR FANBOY BUSKING true5G centralWorld 11 October 2026','MandeeWork Mr Fanboy BUSKING 11 October 2026'],event_date:'2026-10-11',miss_class:'REPEATED_EVENT_NEW_DATE_SOURCE_GAP'},
  {case_id:'teeheng-gen-of-us-20261024',title:'TEEHENG GEN OF US 1st FANMEETING',aliases:['tee heng gen of us 1st fanmeeting','tee boonyakait heng thatpong one bangkok'],search_queries:['TEEHENG GEN OF US site:deehuphouse.com','Tee Heng 24 October 2026 One Bangkok Forum'],event_date:'2026-10-24',miss_class:'STALE_CANDIDATE_ONSALE_STATE_GAP'},
  {case_id:'gelboys-last-painting-20261122',title:'GELBOYS THE LAST PAINTING FANMEET',aliases:['gelboys the last painting','gelboys last painting fanmeet nov 22','gelboys last painting siam pic hall'],search_queries:['GELBOYS THE LAST PAINTING LOOKE 22 November 2026','GELBOYS fanmeet tickets on sale 24 October 2026'],event_date:'2026-11-22',discovery_months:['2026-10'],miss_class:'TICKET_SALE_VS_EVENT_DATE_GAP'},
  {case_id:'dexx-labx-private-20261122',title:'LABX DEXX HOTEL DE RÊVE PRIVATE SECRET SESSION NO.01',aliases:['dexx hotel de reve private secret session','labx dexx the private session n01','labx dexx 22 november'],search_queries:['LABXClinic DEXX private session 22 Nov 2026','DEXX HOTEL DE REVE 20 top spenders 30 lucky fans'],event_date:'2026-11-22',discovery_months:['2026-10'],miss_class:'PRIVATE_SESSION_CROSSMONTH_NAMED_EVENT_GAP'},
  {case_id:'siam-halloween-20261030',title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',aliases:['siam halloween 2026 flex pmcu','สยามฮาโลวีน flex 2026'],search_queries:['Flex 104.5 PMCU Siam Halloween 30 October 2026 Siam Square'],event_date:'2026-10-30',discovery_months:['2026-11'],miss_class:'FREE_PUBLIC_FESTIVAL_RADIO_CROSSMONTH_GAP'},
  {case_id:'siam-halloween-20261031',title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',aliases:['siam halloween 2026 flex pmcu','สยามฮาโลวีน flex 2026'],search_queries:['Flex 104.5 PMCU Siam Halloween 31 October 2026 Siam Square'],event_date:'2026-10-31',discovery_months:['2026-11'],miss_class:'FREE_PUBLIC_FESTIVAL_RADIO_CROSSMONTH_GAP'},
  {case_id:'siam-halloween-20261101',title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',aliases:['siam halloween 2026 flex pmcu','สยามฮาโลวีน flex 2026'],search_queries:['Flex 104.5 PMCU Siam Halloween 1 November 2026 Siam Square'],event_date:'2026-11-01',discovery_months:['2026-10'],miss_class:'FREE_PUBLIC_FESTIVAL_RADIO_CROSSMONTH_GAP'},
  {case_id:'jmnk-she-serve-20261121',title:'JMNK SHEเสิร์ฟ CONCERT',aliases:['jmnk she serve concert','jmnk concert november 21 2026'],search_queries:['JMNK SHEเสิร์ฟ Concert Pulse Hall 21 Nov 2026','JMNK Justmine Nika Eventpop ticket public sale Oct31'],event_date:'2026-11-21',discovery_months:['2026-10'],miss_class:'ARTIST_OFFICIAL_SALE_WINDOW_NEXTMONTH_GAP'}
]);
const FIXTURE_EVIDENCE=Object.freeze({
  'remaster-20261010':{title:'REMASTER CONCERT TIMESHOWBIZ',source_url:'https://www.paragonhall.com/en/events'},
  'pink-aura-20260928':{title:'MizuMi x PP KRIT - THE PINK AURA',source_url:'https://www.watsons.co.th/th/mizumixpp-p926'},
  'minmin-frozen-candy-20260930':{title:'MIN MIN x TeeTeePor : The Frozen Candy Land',source_url:'https://x.com/2TEEPH'},
  'sport-day-after-match-20261001':{title:'M CARD x SPORT DAY AFTER MATCH WITH TEETEE-POR',source_url:'https://www.mcardmall.com/en/promotions/8201'},
  'you-maniac-blind-date-20261003':{title:'#YouManiacSeriesEP6 YOU MANIAC BLIND DATE',source_url:'https://www.gmm-tv.com/'},
  'bai-lu-meet-love-20261025':{title:'MEET&LOVE BAILU SPECIAL BANGKOK FANMEETING',source_url:'https://www.instagram.com/p/DdyDifwAdOz/'},
  'tutoryim-updated-20261018':{title:'ปล่อยปลาฉลาม Meet TutorYim updated date',source_url:'https://www.kazz-magazine.com/'},
  'scoopify-james-su-20261024':{title:'HOW TO BUY TICKETS SCOOPIFY YOGURT & YOU WITH JAMES SU',source_url:'https://x.com/SummerVibeTH'},
  'tle-firstone-20261022':{title:'EVERPINK A Touch of Love with TleFirstone',source_url:'https://x.com/everpink_th'},
  'ryo-teeteepor-20261007':{title:'RYO Strong Roots, Bright Stars with TeeTee & Por',source_url:'https://x.com/RYOHairThailand'},
  'fortreasure-20261129':{title:'FORTREASURE BEYOND THE HORIZON CONCERT',source_url:'https://www.eventpop.me/e/173408/fortreasure-beyond-the-horizon-concert'},
  'herhyness-lingling-20261021':{title:'HER HYNESS x LINGLING UNLOCK THE ULTIMATE PROTECTION',source_url:'https://www.herhynessbeauty.com/blogs/blog-the-clean-side/her-hyness-x-lingling-kwong-unlock-the-ultimate-protection-campaign'},
  'cathydoll-orm-20261023':{title:'CATHY DOLL X Orm Kornnaphat The Mission Love Party',source_url:'https://www.lingorm.site/upcoming-schedule'},
  'nars-teeteepor-20261025':{title:'NARS x TeeTeePor',source_url:'https://sites.google.com/view/porteetee-octomarchchronicles/schedule'},
  'sing-infinity-20261024':{title:'SING INFINITY เพลงเพราะไม่รู้จบ',source_url:'https://spacebar.th/culture/the-giving-concert-3-generations-1-heart'},
  'love-at-first-trip-20261108':{title:'Love at First Trip with TleFirstone',source_url:'https://x.com/Saraanofficial'},
  'elseve-auau-20261120':{title:'L’Oreal Paris Elseve Day with AuAu',source_url:'https://x.com/LOrealParisTH'},
  'curel-auu-save-20261219':{title:'Curél Sun-safe & Fan-fun! Auu & Save',source_url:null},
  'tops-beauty-schedule-20261001':{title:'TOPS OF BEAUTY PERFORMANCE SCHEDULE',source_url:'https://x.com/topsthailand'},
  'mrfanboy-busking-20261011':{title:'MR.FANBOY BUSKING presented by true5G',source_url:null},
  'teeheng-gen-of-us-20261024':{title:'TEEHENG GEN OF US 1st FANMEETING',source_url:'https://www.deehuphouse.com/'},
  'gelboys-last-painting-20261122':{title:'GELBOYS THE LAST PAINTING FANMEET',source_url:'https://www.sotwe.com/looke_world'},
  'dexx-labx-private-20261122':{title:'LABX DEXX HOTEL DE RÊVE PRIVATE SECRET SESSION NO.01',source_url:'https://www.sotwe.com/LABXClinic'},
  'siam-halloween-20261030':{title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',source_url:'https://www.flexconnect.net/category/article/entertainment/'},
  'siam-halloween-20261031':{title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',source_url:'https://www.flexconnect.net/category/article/entertainment/'},
  'siam-halloween-20261101':{title:'Flex 104.5 PMCU SIAM HALLOWEEN 2026',source_url:'https://www.flexconnect.net/category/article/entertainment/'},
  'jmnk-she-serve-20261121':{title:'JMNK SHEเสิร์ฟ CONCERT',source_url:'https://x.com/jmnkofficial'}
});

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}

function tokens(v){return norm(v).split(' ').filter(x=>x.length>=3);}
function fuzzyAliasMatch(title,alias){
  const t=norm(title),a=norm(alias);if(!t||!a)return false;
  if(t.includes(a)||a.includes(t))return true;
  const wanted=tokens(a);if(wanted.length<2)return false;
  const have=new Set(tokens(t));
  const hit=wanted.filter(x=>have.has(x)).length;
  return hit>=Math.max(2,Math.ceil(wanted.length*0.75));
}
function sameCase(c,caseRow){
  const title=norm(c&&c.title);
  if(!title)return false;
  const aliases=[caseRow.title,...(Array.isArray(caseRow.aliases)?caseRow.aliases:[])];
  const titleMatch=aliases.some(a=>fuzzyAliasMatch(title,a));
  const eventDate=date(c&&c.event_date);
  return titleMatch && (!caseRow.event_date || !eventDate || eventDate===caseRow.event_date);
}

function evaluate(candidates=[],classifications=[],options={}){
  const rows=Array.isArray(candidates)?candidates:[];
  const cls=new Map((Array.isArray(classifications)?classifications:[]).map(x=>[text(x&&x.case_id),x]));
  const scanMonth=text(options.month);
  const strictLive=options.strict_live===true;
  const scoped=scanMonth?CORPUS.filter(c=>text(c.event_date).startsWith(scanMonth)||(Array.isArray(c.discovery_months)&&c.discovery_months.includes(scanMonth))):CORPUS;
  const results=scoped.map(caseRow=>{
    // A repeat show with the same franchise name but no confirmed event date is NOT live proof.
    const matched=rows.find(c=>sameCase(c,caseRow)&&(!strictLive||(date(c&&c.event_date)===caseRow.event_date&&!!text(c.source_url||c.url))));
    const receipt=cls.get(caseRow.case_id);
    const status=text(receipt&&receipt.status).toUpperCase();
    // SOURCE_UNAVAILABLE is a valid historical diagnostic disposition, never live FULL evidence.
    const classified=!!receipt && receipt.executed===true && (strictLive?
      (['DISCOVERED','NOT_ELIGIBLE'].includes(status)&&!!text(receipt.source_url||receipt.evidence_url)):
      ['DISCOVERED','NOT_ELIGIBLE','SOURCE_UNAVAILABLE'].includes(status));
    const pass=!!matched||classified;
    return {
      case_id:caseRow.case_id,
      event_date:caseRow.event_date,
      pass,
      proof:matched?'DISCOVERED':(classified?'CLASSIFIED':'MISSING'),
      matched_title:matched?text(matched.title)||null:null,
      matched_source_url:matched?text(matched.source_url)||null:null
    };
  });
  const missing=results.filter(x=>!x.pass).map(x=>x.case_id);
  return {version:VERSION,complete:missing.length===0,case_count:scoped.length,passed:results.filter(x=>x.pass).length,missing_cases:missing,results,month:scanMonth||null,strict_live:strictLive,production_writes:0};
}

function evaluateFixtureRegression(){
  const candidates=CORPUS.map(c=>{
    const fixture=FIXTURE_EVIDENCE[c.case_id]||{};
    return {title:fixture.title||c.title,event_date:c.event_date,source_url:fixture.source_url||null};
  });
  const result=evaluate(candidates,[]);
  return {...result,proof_type:'DETERMINISTIC_HISTORICAL_FIXTURE'};
}

module.exports={VERSION,CORPUS,FIXTURE_EVIDENCE,norm,tokens,fuzzyAliasMatch,evaluate,evaluateFixtureRegression,sameCase};
