'use strict';

const VERSION='KK_ULTRA_DEEP_KNOWN_MISS_V1';

const CORPUS=Object.freeze([
  {case_id:'remaster-20261010',title:'REMASTER CONCERT',event_date:'2026-10-10'},
  {case_id:'pink-aura-20260928',title:'THE PINK AURA',event_date:'2026-09-28'},
  {case_id:'minmin-frozen-candy-20260930',title:'MINMIN x TeeTeePor - THE FROZEN CANDY LAND',event_date:'2026-09-30'},
  {case_id:'sport-day-after-match-20261001',title:'SPORT DAY AFTER MATCH with TEETEE-POR',event_date:'2026-10-01'},
  {case_id:'you-maniac-blind-date-20261003',title:'YOU MANIAC BLIND DATE',event_date:'2026-10-03'},
  {case_id:'bai-lu-meet-love-20261025',title:'MEET & LOVE BAI LU SPECIAL FANMEETING',event_date:'2026-10-25'},
  {case_id:'tutoryim-updated-20261018',title:'TUTOR YIM',event_date:'2026-10-18'},
  {case_id:'scoopify-james-su-20261024',title:'SCOOPIFY YOGURT & YOU WITH JAMES SU',event_date:'2026-10-24'},
  {case_id:'tle-firstone-20261022',title:'A TOUCH OF LOVE WITH TLE-FIRSTONE',event_date:'2026-10-22'},
  {case_id:'fortreasure-20261129',title:'FORTREASURE BEYOND THE HORIZON CONCERT',event_date:'2026-11-29'}
]);

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9฀-๿]+/g,' ').replace(/s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}

function sameCase(c,caseRow){
  const title=norm(c&&c.title);
  const target=norm(caseRow.title);
  if(!title||!target)return false;
  const titleMatch=title.includes(target)||target.includes(title);
  const eventDate=date(c&&c.event_date);
  return titleMatch && (!caseRow.event_date || !eventDate || eventDate===caseRow.event_date);
}

function evaluate(candidates=[],classifications=[]){
  const rows=Array.isArray(candidates)?candidates:[];
  const cls=new Map((Array.isArray(classifications)?classifications:[]).map(x=>[text(x&&x.case_id),x]));
  const results=CORPUS.map(caseRow=>{
    const discovered=rows.some(c=>sameCase(c,caseRow));
    const receipt=cls.get(caseRow.case_id);
    const classified=!!receipt && receipt.executed===true && ['DISCOVERED','NOT_ELIGIBLE','SOURCE_UNAVAILABLE'].includes(text(receipt.status).toUpperCase());
    const pass=discovered||classified;
    return {case_id:caseRow.case_id,event_date:caseRow.event_date,pass,proof:discovered?'DISCOVERED':(classified?'CLASSIFIED':'MISSING')};
  });
  const missing=results.filter(x=>!x.pass).map(x=>x.case_id);
  return {version:VERSION,complete:missing.length===0,case_count:CORPUS.length,passed:results.filter(x=>x.pass).length,missing_cases:missing,results,production_writes:0};
}

module.exports={VERSION,CORPUS,evaluate,sameCase};
