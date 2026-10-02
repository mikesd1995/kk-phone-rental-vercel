'use strict';

const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const VERSION='KK_ULTRA_DEEP_COMPETITOR_SCAN_V1';
const ACCOUNTS=['minibestt','fundaybuddy','thisisyour3','fejay4rent','by_minnymicky','npforrent','mcjmgoods','winkwink_rent','khaw4rent_2nd'];

function text(v){return String(v==null?'':v).trim();}
function priceFromText(v){
 const s=text(v).replace(/,/g,'');
 const vals=[...s.matchAll(/(?:฿|บาท|thb\s*)?(\d{3,4})(?:\s*(?:฿|บาท|thb))?/gi)]
  .map(m=>Number(m[1])).filter(n=>n>=300&&n<=2500);
 return vals.length?Math.min(...vals):null;
}
function accountFromRow(row={}){
 const hay=(text(row.title)+' '+text(row.body)+' '+text(row.source_url)).toLowerCase();
 return ACCOUNTS.find(a=>hay.includes(a.toLowerCase()))||'';
}
async function scanCandidate(candidate={},options={}){
 const runner=typeof options.ddgs_runner==='function'?options.ddgs_runner:PublicWeb.runDdgsSearch;
 const title=text(candidate.title).replace(/["']/g,' ').replace(/\s+/g,' ').slice(0,120);
 if(!title)return [];
 const query='"'+title+'" เช่ามือถือ vivo x300';
 let rows=[];try{rows=await runner({query,max_results:25,region:'th-th',backend:'auto'},options);}catch(_){return [];}
 const out=[];const seen=new Set();
 for(const row of Array.isArray(rows)?rows:[]){
  const competitor=accountFromRow(row);if(!competitor)continue;
  const price=priceFromText(text(row.title)+' '+text(row.body));if(!price)continue;
  const source=PublicWeb.https(row.source_url||row.href||row.url);if(!source)continue;
  const key=competitor+'|'+price;if(seen.has(key))continue;seen.add(key);
  out.push({competitor_id:competitor,event_key:text(candidate.event_key||candidate.candidate_id),package_type:'PHONE_OR_BUNDLE_UNCLASSIFIED',price,source_url:source,observed_at:new Date().toISOString(),exact_event:true});
 }
 return out;
}
async function scanBatch(candidates=[],options={}){
 const out=[];for(const c of (Array.isArray(candidates)?candidates:[])){out.push(...await scanCandidate(c,options));}
 return {version:VERSION,evidence:out,events_with_exact_evidence:new Set(out.map(x=>x.event_key)).size,production_writes:0};
}
module.exports={VERSION,ACCOUNTS,priceFromText,accountFromRow,scanCandidate,scanBatch};
