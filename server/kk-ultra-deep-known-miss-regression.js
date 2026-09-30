'use strict';

const VERSION='KK_ULTRA_DEEP_KNOWN_MISS_V3';

const CORPUS=Object.freeze([
  {case_id:'remaster-20261010',title:'REMASTER CONCERT',aliases:['remaster concert'],event_date:'2026-10-10',seed_urls:['https://www.paragonhall.com/en/events/59/REMASTER-CONCERT']},
  {case_id:'pink-aura-20260928',title:'THE PINK AURA',aliases:['the pink aura','pink aura','mizumi pp krit'],event_date:'2026-09-28',seed_urls:['https://www.watsons.co.th/th/mizumixpp-p926']},
  {case_id:'minmin-frozen-candy-20260930',title:'MINMIN x TeeTeePor - THE FROZEN CANDY LAND',aliases:['frozen candy land','minmin teeteepor','teetee por frozen candy'],event_date:'2026-09-30',seed_urls:['https://sites.google.com/view/porteetee-octomarchchronicles/schedule']},
  {case_id:'sport-day-after-match-20261001',title:'SPORT DAY AFTER MATCH with TEETEE-POR',aliases:['sport day after match','teetee por sport day'],event_date:'2026-10-01',seed_urls:['https://www.mcardmall.com/en/promotions/8201']},
  {case_id:'you-maniac-blind-date-20261003',title:'YOU MANIAC BLIND DATE',aliases:['you maniac blind date','youmaniacseries','you maniac series'],event_date:'2026-10-03'},
  {case_id:'bai-lu-meet-love-20261025',title:'MEET & LOVE BAI LU SPECIAL FANMEETING',aliases:['meet love bai lu','bai lu special fanmeeting','bailu wespark','bai lu wespark'],event_date:'2026-10-25',seed_urls:['https://megatix.in.th/events/meetlove-bailu-fanmeeting']},
  {case_id:'tutoryim-updated-20261018',title:'TUTOR YIM',aliases:['tutor yim','tutoryim','ปล่อยปลาฉลาม'],event_date:'2026-10-18'},
  {case_id:'scoopify-james-su-20261024',title:'SCOOPIFY YOGURT & YOU WITH JAMES SU',aliases:['scoopify yogurt you james su','james su scoopify','yogurt you james su'],event_date:'2026-10-24'},
  {case_id:'tle-firstone-20261022',title:'A TOUCH OF LOVE WITH TLE-FIRSTONE',aliases:['touch of love tle firstone','tle firstone','tle-firstone'],event_date:'2026-10-22'},
  {case_id:'fortreasure-20261129',title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure beyond the horizon','fort treasure beyond horizon','fortreasure concert'],event_date:'2026-11-29',seed_urls:['https://www.eventpop.me/e/173408']}
]);

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}
function tokens(v){return norm(v).split(' ').filter(x=>x.length>=3);}
function fuzzyAliasMatch(value,alias){
  const t=norm(value),a=norm(alias);if(!t||!a)return false;
  if(t.includes(a)||a.includes(t))return true;
  const wanted=tokens(a);if(wanted.length<2)return false;
  const have=new Set(tokens(t));
  const hit=wanted.filter(x=>have.has(x)).length;
  return hit>=Math.max(2,Math.ceil(wanted.length*0.75));
}
function sameCase(c,caseRow){
  const searchable=norm([c&&c.title,c&&c.evidence_text].filter(Boolean).join(' '));
  if(!searchable)return false;
  const aliases=[caseRow.title,...(Array.isArray(caseRow.aliases)?caseRow.aliases:[])];
  const titleMatch=aliases.some(a=>fuzzyAliasMatch(searchable,a));
  const eventDate=date(c&&c.event_date);
  return titleMatch&&(!caseRow.event_date||!eventDate||eventDate===caseRow.event_date);
}
function evaluate(candidates=[],classifications=[]){
  const rows=Array.isArray(candidates)?candidates:[];
  const cls=new Map((Array.isArray(classifications)?classifications:[]).map(x=>[text(x&&x.case_id),x]));
  const results=CORPUS.map(caseRow=>{
    const matched=rows.find(c=>sameCase(c,caseRow));
    const receipt=cls.get(caseRow.case_id);
    const classified=!!receipt&&receipt.executed===true&&['DISCOVERED','NOT_ELIGIBLE','SOURCE_UNAVAILABLE'].includes(text(receipt.status).toUpperCase());
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
module.exports={VERSION,CORPUS,norm,tokens,fuzzyAliasMatch,evaluate,sameCase};
