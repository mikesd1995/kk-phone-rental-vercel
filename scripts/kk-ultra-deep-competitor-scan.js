#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const Adapters=require('../server/kk-ultra-deep-public-web-adapters.js');

function text(v){return String(v==null?'':v).trim();}
function arg(name,fallback=''){const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;}
function shopId(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch(_){return '';}}
function prices(s=''){
 const out=[];for(const m of text(s).matchAll(/(?:฿|ราคา\s*|เช่า\s*|rent\s*)?([3-9]\d{2}|1\d{3})(?:\s*(?:บาท|฿|-))?/gi)){const n=Number(m[1]);if(n>=300&&n<=2500&&!out.includes(n))out.push(n);}return out;
}
function rentalEvidence(s=''){return /(เช่า|rent|rental|vivo\s*x300|x300\s*pro|x300pro|มือถือ|โทรศัพท์)/i.test(text(s));}
async function scanOne(c){
 const title=text(c.title);if(!title)return [];
 const q='"'+title.replace(/"/g,'')+'" เช่า Vivo X300 Pro ราคา';
 let rows=[];try{rows=await Adapters.runDdgsSearch({query:q,max_results:10,region:'th-th',backend:'auto'},{ddgs_timeout_ms:10000});}catch(_){return [];}
 const out=[];
 for(const r of rows){
  const evidence=[r.title,r.body].filter(Boolean).join(' ');if(!rentalEvidence(evidence))continue;
  const ps=prices(evidence);if(!ps.length)continue;
  const url=text(r.source_url||r.href||r.url);const shop=shopId(url);if(!shop)continue;
  out.push({competitor_id:shop,event_key:text(c.event_key||c.candidate_id),package_type:'PHONE_LENS',price:ps[0],source_url:url,observed_at:new Date().toISOString(),exact_event:true,query:q});
 }
 const seen=new Set();return out.filter(x=>{const k=x.competitor_id+'|'+x.price;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,5);
}
async function main(){
 const file=arg('--handoff','ultra-deep-verifier-handoff.json');const h=JSON.parse(fs.readFileSync(file,'utf8'));
 const candidates=h.verifier&&Array.isArray(h.verifier.verified_candidates)?h.verifier.verified_candidates:[];
 const all=[];for(const c of candidates){all.push(...await scanOne(c));}
 h.competitor_prices=all;h.competitor_scan={version:'KK_ULTRA_DEEP_COMPETITOR_SCAN_V1',candidate_count:candidates.length,evidence_count:all.length,shops:[...new Set(all.map(x=>x.competitor_id))],production_writes:0};
 fs.writeFileSync(file,JSON.stringify(h,null,2));process.stdout.write(JSON.stringify(h.competitor_scan,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exit(1)});
