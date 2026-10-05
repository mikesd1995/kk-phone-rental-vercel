'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Runtime=require('../server/kk-ultra-deep-phase2-runtime.js');
const Artifact=require('../server/kk-ultra-deep-phase-artifact.js');

function text(v){return String(v==null?'':v).trim();}
function arg(name,fallback=''){
 const i=process.argv.indexOf('--'+name);
 return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;
}
function persist(file,value){
 fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
 fs.writeFileSync(path.resolve(file),JSON.stringify(value,null,2)+'\n','utf8');
}
function artifactFromInput(raw={}){
 if(raw.schema===Artifact.VERSION){
  const checked=Artifact.validateForPhase2(raw);
  if(!checked.pass)throw Object.assign(new Error('PHASE1_ARTIFACT_INVALID: '+checked.blockers.join(',')),{code:'PHASE1_ARTIFACT_INVALID',blockers:checked.blockers});
  return raw;
 }
 const candidates=Array.isArray(raw.candidates)?raw.candidates:[];
 if(raw.production_writes!==0)throw Object.assign(new Error('PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO'),{code:'PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO'});
 if(raw.full!==true||text(raw.status)!=='READY_FOR_VERIFIER')throw Object.assign(new Error('PHASE1_ARTIFACT_NOT_ACCEPTED'),{code:'PHASE1_ARTIFACT_NOT_ACCEPTED'});
 if(!candidates.length)throw Object.assign(new Error('PHASE2_CANDIDATE_POOL_EMPTY'),{code:'PHASE2_CANDIDATE_POOL_EMPTY'});
 const artifact=Artifact.freezePhase1({
  phase:'PHASE1',
  status:'PHASE1_ACCEPTED',
  month:text(raw.month),
  accepted_at:text(raw.finished_at||raw.created_at),
  candidates,
  production_writes:0
 });
 if(!artifact.frozen)throw Object.assign(new Error('PHASE1_ARTIFACT_FREEZE_FAILED: '+artifact.blockers.join(',')),{code:'PHASE1_ARTIFACT_FREEZE_FAILED',blockers:artifact.blockers});
 return artifact;
}
async function main(){
 const inputPath=arg('input','.artifacts/ultra-deep-runtime-acceptance.json');
 const outputPath=arg('output','.artifacts/ultra-deep-phase2-acceptance.json');
 const artifactPath=arg('phase1-artifact-output','.artifacts/ultra-deep-phase1-artifact.json');
 const phase2ArtifactPath=arg('phase2-artifact-output','.artifacts/ultra-deep-phase2-artifact.json');
 const maxRounds=Math.max(1,Math.min(5,Number(arg('max-rounds','3'))||3));
 const raw=JSON.parse(fs.readFileSync(inputPath,'utf8'));
 const artifact=artifactFromInput(raw);
 persist(artifactPath,artifact);
 const checked=Artifact.validateForPhase2(artifact);
 if(!checked.pass)throw Object.assign(new Error('PHASE1_ARTIFACT_READBACK_INVALID: '+checked.blockers.join(',')),{code:'PHASE1_ARTIFACT_READBACK_INVALID',blockers:checked.blockers});
 const result=await Runtime.run({
  phase1_artifact:artifact,
  month:artifact.month||arg('month','2026-10'),
  location:text(raw.location)||'Bangkok Thailand',
  max_rounds:maxRounds
 },{concurrency:4});
 const evidence={
  schema:'KK_ULTRA_DEEP_PHASE2_ACCEPTANCE_V2',
  created_at:new Date().toISOString(),
  phase1_artifact:{
   schema:artifact.schema,
   status:artifact.status,
   frozen:artifact.frozen,
   candidate_count:artifact.candidate_count,
   candidate_ids:artifact.candidate_ids,
   fingerprint:artifact.fingerprint,
   production_writes:0
  },
  ...result
 };
 persist(outputPath,evidence);
 if(evidence.status==='PHASE2_ACCEPTED'&&evidence.phase2_artifact&&evidence.phase2_artifact.frozen===true)persist(phase2ArtifactPath,evidence.phase2_artifact);
 process.stdout.write(JSON.stringify({
  status:evidence.status,
  ready_for_phase3:evidence.ready_for_phase3,
  candidate_count:evidence.candidate_count,
  pool_source:evidence.pool_source,
  pool_fingerprint:evidence.pool_fingerprint,
  phase1_fingerprint:artifact.fingerprint,
  phase2_fingerprint:evidence.phase2_artifact&&evidence.phase2_artifact.fingerprint||null,
  rounds:evidence.rounds,
  final_counts:{
   verified:(evidence.results||[]).filter(x=>x.disposition==='VERIFIED').length,
   status_changed:(evidence.results||[]).filter(x=>x.disposition==='STATUS_CHANGED').length,
   rejected:(evidence.results||[]).filter(x=>x.disposition==='REJECT_WITH_REASON').length,
   verify_required:(evidence.results||[]).filter(x=>x.disposition==='VERIFY_REQUIRED').length
  },
  blockers:evidence.gate&&evidence.gate.blockers||[],
  next_action:evidence.next_action,
  production_writes:0,
  phase3_started:false
 },null,2)+'\n');
 if(evidence.status!=='PHASE2_ACCEPTED')process.exitCode=2;
}
main().catch(err=>{
 process.stderr.write(JSON.stringify({ok:false,error_code:text(err&&err.code)||text(err&&err.name)||'PHASE2_RUNTIME_FAILED',message:text(err&&err.message).slice(0,400),blockers:err&&err.blockers||[],production_writes:0,phase3_started:false},null,2)+'\n');
 process.exit(1);
});
