'use strict';

const fs=require('node:fs');
const path=require('node:path');

function text(v){return String(v==null?'':v).trim();}
function subsetHandoff(handoff,candidate){
 const key=text(candidate.event_key||candidate.candidate_id);
 const posters=(handoff.posters||[]).filter(x=>text(x.event_key)===key);
 const prices=(handoff.competitor_prices||[]).filter(x=>text(x.event_key)===key);
 return {
  ...handoff,
  verifier:{
   ...(handoff.verifier||{}),
   input_count:1,fetched_count:1,verified_count:1,hold_count:0,
   verified_candidates:[candidate],
   posters,
   holds:[]
  },
  competitor_prices:prices,
  posters,
  commercial:undefined,
  production_writes:0
 };
}
function buildBatchFiles(handoff={},outDir='ultra-deep-production-batches'){
 const verified=handoff.verifier&&Array.isArray(handoff.verifier.verified_candidates)?handoff.verifier.verified_candidates:[];
 const commercialRows=handoff.commercial&&Array.isArray(handoff.commercial.candidates)?handoff.commercial.candidates:[];
 const readyKeys=new Set(commercialRows.filter(x=>text(x.status)==='READY_FOR_FINAL_VERIFIER').map(x=>text(x.event_key||x.candidate_id)));
 const candidates=commercialRows.length?verified.filter(x=>readyKeys.has(text(x.event_key||x.candidate_id))):verified;
 fs.mkdirSync(outDir,{recursive:true});
 const files=[];
 for(let i=0;i<candidates.length;i++){
  const file=path.join(outDir,String(i+1).padStart(3,'0')+'.json');
  fs.writeFileSync(file,JSON.stringify(subsetHandoff(handoff,candidates[i])));
  files.push({index:i,event_key:text(candidates[i].event_key||candidates[i].candidate_id),title:text(candidates[i].title),file});
 }
 return files;
}
function aggregate(results=[]){
 const counts={total:0,created_verified:0,updated_verified:0,no_change:0,update_ready:0,promotion_ready:0};
 let writes=0;const blockers=new Set();const dispositions=[];let allComplete=results.length>0;let anyOk=false;
 for(const row of results){
  if(!row||row.ok!==true){allComplete=false;blockers.add(text(row&&row.error_code)||'BATCH_EXECUTION_FAILED');continue;}
  anyOk=true;
  const r=row.result||{};writes+=Number(r.production_writes||0);
  for(const k of Object.keys(counts))counts[k]+=Number(r.counts&&r.counts[k]||0);
  for(const b of r.blockers||[])if(text(b))blockers.add(text(b));
  dispositions.push(...(r.dispositions||[]));
  if(r.status!=='COMPLETE'||r.acceptance?.complete!==true)allComplete=false;
 }
 const status=allComplete?'COMPLETE':(anyOk?'PARTIAL_SAFE_EXECUTION':'BLOCKED');
 return {
  status,production_writes:writes,counts,blockers:[...blockers],dispositions,batch_count:results.length,
  complete:status==='COMPLETE',
  acceptance:{complete:status==='COMPLETE',status:status==='COMPLETE'?'COMPLETE':'BLOCKED_INCOMPLETE_FULL_LOOP',blockers:[...blockers]}
 };
}
function aggregateDirectory(dir='ultra-deep-production-results'){
 const names=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort():[];
 const rows=names.map(name=>{
  try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch(_){return {ok:false,error_code:'BATCH_RESULT_INVALID',file:name};}
 });
 return {ok:rows.some(x=>x&&x.ok===true),result:aggregate(rows),batches:rows};
}
if(require.main===module){
 const mode=process.argv[2];
 if(mode==='build'){
  const handoff=JSON.parse(fs.readFileSync(process.argv[3]||'ultra-deep-commercial-handoff.json','utf8'));
  const files=buildBatchFiles(handoff,process.argv[4]||'ultra-deep-production-batches');
  process.stdout.write(JSON.stringify(files));
 }else if(mode==='aggregate'){
  const out=aggregateDirectory(process.argv[3]||'ultra-deep-production-results');
  fs.writeFileSync(process.argv[4]||'ultra-deep-production-result.json',JSON.stringify(out,null,2));
  process.stdout.write(JSON.stringify(out.result));
  if(out.result.status==='BLOCKED')process.exitCode=1;
 }else{
  throw new Error('mode must be build or aggregate');
 }
}
module.exports={text,subsetHandoff,buildBatchFiles,aggregate,aggregateDirectory};
