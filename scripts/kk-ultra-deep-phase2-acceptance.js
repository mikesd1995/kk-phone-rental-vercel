'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Runtime=require('../server/kk-ultra-deep-phase2-runtime.js');

function text(v){return String(v==null?'':v).trim();}
function arg(name,fallback=''){
 const i=process.argv.indexOf('--'+name);
 return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;
}
async function main(){
 const inputPath=arg('input','.artifacts/ultra-deep-runtime-acceptance.json');
 const outputPath=arg('output','.artifacts/ultra-deep-phase2-acceptance.json');
 const maxRounds=Math.max(1,Math.min(5,Number(arg('max-rounds','3'))||3));
 const raw=JSON.parse(fs.readFileSync(inputPath,'utf8'));
 const candidates=Array.isArray(raw.candidates)?raw.candidates:[];
 if(raw.production_writes!==0)throw Object.assign(new Error('PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO'),{code:'PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO'});
 if(!candidates.length)throw Object.assign(new Error('PHASE2_CANDIDATE_POOL_EMPTY'),{code:'PHASE2_CANDIDATE_POOL_EMPTY'});
 const result=await Runtime.run({
  month:text(raw.month)||arg('month','2026-10'),
  location:text(raw.location)||'Bangkok Thailand',
  candidates,
  max_rounds:maxRounds
 },{concurrency:4});
 const evidence={
  schema:'KK_ULTRA_DEEP_PHASE2_ACCEPTANCE_V1',
  created_at:new Date().toISOString(),
  phase1_input:{
   schema:text(raw.schema)||null,
   status:text(raw.status)||null,
   full:raw.full===true,
   blocker_count:Array.isArray(raw.blockers)?raw.blockers.length:0,
   candidate_count:candidates.length,
   production_writes:0
  },
  ...result
 };
 fs.mkdirSync(path.dirname(outputPath),{recursive:true});
 fs.writeFileSync(outputPath,JSON.stringify(evidence,null,2)+'\n','utf8');
 process.stdout.write(JSON.stringify({
  status:evidence.status,
  ready_for_phase3:evidence.ready_for_phase3,
  candidate_count:evidence.candidate_count,
  pool_fingerprint:evidence.pool_fingerprint,
  rounds:evidence.rounds,
  final_counts:{
   verified:evidence.results.filter(x=>x.disposition==='VERIFIED').length,
   status_changed:evidence.results.filter(x=>x.disposition==='STATUS_CHANGED').length,
   rejected:evidence.results.filter(x=>x.disposition==='REJECT_WITH_REASON').length,
   verify_required:evidence.results.filter(x=>x.disposition==='VERIFY_REQUIRED').length
  },
  blockers:evidence.gate&&evidence.gate.blockers||[],
  next_action:evidence.next_action,
  production_writes:0,
  phase3_started:false
 },null,2)+'\n');
 if(evidence.status!=='PHASE2_ACCEPTED')process.exitCode=2;
}
main().catch(err=>{
 process.stderr.write(JSON.stringify({ok:false,error_code:text(err&&err.code)||text(err&&err.name)||'PHASE2_RUNTIME_FAILED',message:text(err&&err.message).slice(0,400),production_writes:0,phase3_started:false},null,2)+'\n');
 process.exit(1);
});
