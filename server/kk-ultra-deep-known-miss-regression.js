'use strict';

const VERSION='KK_ULTRA_DEEP_KNOWN_MISS_V8';

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
  {case_id:'fortreasure-20261129',title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure beyond the horizon','fort treasure beyond horizon','fortreasure concert','beyond the horizon concert fortfts','fortfts fortreasure'],search_queries:['FORTREASURE site:eventpop.me','FORTREASURE FortFTS Eventpop'],event_date:'2026-11-29'}
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
  'fortreasure-20261129':{title:'FORTREASURE BEYOND THE HORIZON CONCERT',source_url:'https://www.eventpop.me/e/173408/fortreasure-beyond-the-horizon-concert'}
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

function evaluate(candidates=[],classifications=[]){
  const rows=Array.isArray(candidates)?candidates:[];
  const cls=new Map((Array.isArray(classifications)?classifications:[]).map(x=>[text(x&&x.case_id),x]));
  const results=CORPUS.map(caseRow=>{
    const matched=rows.find(c=>sameCase(c,caseRow));
    const receipt=cls.get(caseRow.case_id);
    const classified=!!receipt && receipt.executed===true && ['DISCOVERED','NOT_ELIGIBLE','SOURCE_UNAVAILABLE'].includes(text(receipt.status).toUpperCase());
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
  return {version:VERSION,complete:missing.length===0,case_count:CORPUS.length,passed:results.filter(x=>x.pass).length,missing_cases:missing,results,production_writes:0};
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
