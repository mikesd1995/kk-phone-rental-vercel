#!/usr/bin/env node
'use strict';
// Local filesystem only; read-only public search; NEVER commits or writes business data.
const fs=require('node:fs'),path=require('node:path');
const Scanner=require('../server/kk-ultra-deep-readonly-shards.js');
function parseArgs(argv=[]){
 const options={};
 for(let i=0;i<argv.length;i++){
  const arg=String(argv[i]);
  if(!/^--(month|location|size|shard|run-all|plan|outdir|merge-dir|budget-ms)$/.test(arg))
   throw new Error('INVALID_SHARD_OPTION');
  const key=arg.slice(2);
  if(key==='run-all'||key==='plan'){options[key]=true;continue;}
  if(!argv[i+1])throw new Error('MISSING_SHARD_OPTION_VALUE');
  options[key]=String(argv[++i]);
 }
 return options;
}
function filename(i){return 'readonly-shard-'+String(i).padStart(3,'0')+'.json';}
function writeLocal(file,receipt){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
}
async function main(argv=process.argv.slice(2)){
 const args=parseArgs(argv);
 const input={month:args.month,location:args.location,shard_size:args.size==null?12:Number(args.size)};
 const plan=Scanner.manifest(input);
 if(args.plan){
  const {allTasks,groupPlans,...info}=plan;
  process.stdout.write(JSON.stringify(info,null,2)+'\n');
  return info;
 }
 if(args['merge-dir']){
  const dir=path.resolve(args['merge-dir']);
  const reports=fs.readdirSync(dir).filter(x=>/^readonly-shard-\d{3}\.json$/.test(x))
   .map(x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8')));
  const result=Scanner.combineReports(input,reports);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  return result;
 }
 if(!args['run-all']&&args.shard==null)throw new Error('SHARD_MODE_REQUIRED');
 const dir=path.resolve(args.outdir||('./.ultra-deep-local-readonly/'+plan.month));
 const indices=args['run-all']?plan.shards.map(x=>x.index):[Number(args.shard)];
 const receipts=[];
 for(const i of indices){
  if(!plan.shards[i])throw new Error('SHARD_INDEX_INVALID');
  const target=path.join(dir,filename(i));
  if(fs.existsSync(target)){
   const existing=JSON.parse(fs.readFileSync(target,'utf8'));
   if(existing.manifest_fingerprint!==plan.fingerprint||existing.shard_index!==i)
    throw new Error('EXISTING_SHARD_MANIFEST_CONFLICT');
   receipts.push({shard:i,status:'ALREADY_RECORDED'});
   continue;
  }
  const result=await Scanner.runShard({...input,shard_index:i},{
   read_only:true,runtime_budget_ms:Number(args['budget-ms']||180000)});
  writeLocal(target,result);
  receipts.push({shard:i,status:result.status,executed:result.executed_count,total:result.task_count});
  process.stderr.write('shard '+i+'/'+plan.shards.length+' '+result.status+'\n');
 }
 const output={month:plan.month,manifest_fingerprint:plan.fingerprint,receipts,
  outdir:dir,full:false,authoritative:false,production_writes:0};
 process.stdout.write(JSON.stringify(output,null,2)+'\n');
 return output;
}
if(require.main===module)main().catch(err=>{
 process.stderr.write(String(err&&err.message||err)+'\n');process.exitCode=1;
});
module.exports={parseArgs,filename,writeLocal,main};
