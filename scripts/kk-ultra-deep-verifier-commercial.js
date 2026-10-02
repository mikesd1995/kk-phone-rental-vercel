'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');
const Pricing=require('../server/kk-ultra-deep-competitor-price-scanner.js');
const Commercial=require('../server/kk-discovery-commercial-prep.js');

function arg(name,fallback=''){
 const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;
}
async function main(){
 const inputPath=arg('input','.artifacts/ultra-deep-runtime-acceptance.json');
 const outputPath=arg('output','.artifacts/ultra-deep-commercial-handoff.json');
 const raw=JSON.parse(fs.readFileSync(inputPath,'utf8'));
 if(raw.full!==true||raw.status!=='READY_FOR_VERIFIER') throw new Error('DISCOVERY_NOT_READY_FOR_VERIFIER');
 const month=String(raw.month||arg('month')).trim();
 const verifier=await Verifier.verifyBatch(raw.candidates||[],{month,location:raw.location||'Bangkok Thailand'},{concurrency:4,timeout_ms:9000});
 if(!verifier.verified_count){
  const out={schema:'KK_ULTRA_DEEP_COMMERCIAL_HANDOFF_V1',status:'HOLD_NO_VERIFIED_CANDIDATES',month,discovery:{full:raw.full,status:raw.status},verifier,competitor_prices:[],commercial:{candidates:[]},production_writes:0};
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(out,null,2));
  process.exitCode=2;return;
 }
 const priceScan=await Pricing.scanBatch(verifier.verified_candidates,{concurrency:3,max_results:20});
 const commercial=Commercial.prepareBatch({
  candidates:verifier.verified_candidates,
  competitor_prices:priceScan.evidence,
  posters:verifier.posters
 });
 const out={
  schema:'KK_ULTRA_DEEP_COMMERCIAL_HANDOFF_V1',
  created_at:new Date().toISOString(),
  month,
  discovery:{full:raw.full,status:raw.status,candidate_count:raw.candidate_count,blockers:raw.blockers||[]},
  verifier,
  competitor_price_scan:priceScan,
  competitor_prices:priceScan.evidence,
  posters:verifier.posters,
  commercial,
  production_writes:0
 };
 fs.mkdirSync(path.dirname(outputPath),{recursive:true});
 fs.writeFileSync(outputPath,JSON.stringify(out,null,2));
 console.log(JSON.stringify({
  status:out.commercial.status,
  raw_candidates:raw.candidate_count,
  verifier_fetched:verifier.fetched_count,
  verifier_verified:verifier.verified_count,
  verifier_holds:verifier.hold_count,
  competitor_evidence:priceScan.evidence_count,
  commercial_ready:commercial.ready_count,
  commercial_hold:commercial.hold_count,
  production_writes:0
 }));
 if(commercial.ready_count===0)process.exitCode=2;
}
main().catch(err=>{console.error(JSON.stringify({error:String(err&&err.message||err),code:String(err&&err.code||'ERROR')}));process.exit(1);});
