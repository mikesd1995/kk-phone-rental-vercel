'use strict';

const Ledger=require('../server/runtime-ledger');
const Acceptance=require('../server/external-scanner-acceptance');

function parsePositiveInt(value,fallback,min,max){
  const n=Number(value);
  return Number.isInteger(n) && n>=min && n<=max ? n : fallback;
}

function parseArgs(argv){
  const out={required:6,limit:24};
  for(const arg of argv.slice(2)){
    if(arg.startsWith('--required=')){
      out.required=parsePositiveInt(arg.slice('--required='.length),6,1,48);
      continue;
    }
    if(arg.startsWith('--limit=')){
      out.limit=parsePositiveInt(arg.slice('--limit='.length),24,6,200);
      continue;
    }
    return {error:'Unknown argument: '+arg};
  }
  if(out.limit<out.required) out.limit=out.required;
  return out;
}

async function main(){
  const args=parseArgs(process.argv);
  if(args.error){
    process.stderr.write(JSON.stringify({ok:false,classification:'CLI_ARGUMENT_ERROR',message:args.error})+'\n');
    process.exitCode=2;
    return;
  }

  try{
    const result=await Ledger.listExpectations({
      env:process.env,
      role:'SCANNER',
      mode:'WITNESS_ONLY',
      limit:args.limit
    });
    const report=Acceptance.evaluateWitnessWindow(result.rows,{
      required:args.required,
      nowMs:Date.now()
    });
    process.stdout.write(JSON.stringify({
      ...report,
      source:'SUPABASE_RUNTIME_LEDGER',
      returned_rows:result.rows.length
    },null,2)+'\n');
    process.exitCode=report.ok?0:1;
  }catch(err){
    process.stderr.write(JSON.stringify({
      ok:false,
      classification:String(err&&err.code||'WITNESS_AUDIT_FAILED'),
      status:Number.isFinite(Number(err&&err.status))?Number(err.status):null,
      scanner_runtime_acceptance:false,
      production_cutover_authorized:false
    })+'\n');
    process.exitCode=1;
  }
}

if(require.main===module){
  main().catch(()=>{
    process.stderr.write(JSON.stringify({
      ok:false,
      classification:'WITNESS_AUDIT_INTERNAL_ERROR',
      scanner_runtime_acceptance:false,
      production_cutover_authorized:false
    })+'\n');
    process.exitCode=1;
  });
}

module.exports={parseArgs};
