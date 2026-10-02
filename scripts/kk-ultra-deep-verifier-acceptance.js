#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');

function arg(name,fallback=''){
 const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;
}
async function main(){
 const input=path.resolve(arg('--input','ultra-deep-runtime-acceptance.json'));
 const output=path.resolve(arg('--output','ultra-deep-verifier-handoff.json'));
 const month=arg('--month','');
 const raw=JSON.parse(fs.readFileSync(input,'utf8'));
 if(raw.full!==true||raw.status!=='READY_FOR_VERIFIER') throw Object.assign(new Error('DISCOVERY_NOT_FULL'),{code:'DISCOVERY_NOT_FULL'});
 const result=await Verifier.verifyBatch(raw.candidates||[],{month},{concurrency:Number(process.env.KK_ULTRA_DEEP_VERIFIER_CONCURRENCY||4),timeout_ms:Number(process.env.KK_ULTRA_DEEP_VERIFIER_TIMEOUT_MS||9000)});
 const handoff={
  schema_version:'KK_ULTRA_DEEP_FULL_LOOP_HANDOFF_V3',
  month,
  discovery:{full:true,status:'READY_FOR_VERIFIER',month,candidate_count:raw.candidate_count,source_universe:raw.source_universe,reference_sweep_proof:raw.reference_sweep_proof,reconciliation:raw.reconciliation,known_miss_regression:raw.known_miss_regression},
  verifier:result,
  posters:result.posters||[],
  competitor_prices:[],
  pricing_policy:{exact_event_market_preferred:true,fallback_chain:['EXACT_EVENT_COMPETITOR_MEDIAN','COMPARABLE_EVENT_MEDIAN','KK_APPROVED_BASELINE','KK_RENTAL_FIT_SCORE_FALLBACK']},
  production_writes:0
 };
 fs.writeFileSync(output,JSON.stringify(handoff,null,2));
 const summary={version:Verifier.VERSION,status:result.status,input_count:result.input_count,fetched_count:result.fetched_count,verified_count:result.verified_count,hold_count:result.hold_count,poster_count:result.posters.length,production_writes:0};
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
 if(result.verified_count<1) process.exitCode=2;
}
main().catch(err=>{process.stderr.write(JSON.stringify({ok:false,error_code:String(err&&err.code||err&&err.name||'ERROR'),error:String(err&&err.message||err)})+'\n');process.exitCode=1;});
