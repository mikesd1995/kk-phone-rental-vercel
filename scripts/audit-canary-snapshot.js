'use strict';

const fs=require('fs');
const path=require('path');
const {auditCanarySnapshot}=require('../server/canary-acceptance');
const Orchestration=require('../server/kk-agent-orchestration.js');

function usage(){
  process.stderr.write('Usage: node scripts/audit-canary-snapshot.js <snapshot.json>\n');
}

async function main(){
  const file=process.argv[2];
  if(!file){
    usage();
    process.exitCode=2;
    return;
  }
  let input;
  try{
    input=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  }catch(err){
    process.stderr.write(`CANARY_AUDIT_INPUT_ERROR: ${String(err&&err.message||err)}\n`);
    process.exitCode=2;
    return;
  }

  const result=auditCanarySnapshot(input);
  const orchestration=await Orchestration.recordExecution({
    intent:'canary_audit',
    invoked_agents:['kk-canary-safety'],
    input,
    output:result,
    correlation_id:String(input.run_id||'canary-audit'),
    gate_status:'RECORDED',
    owner_review_required:false
  });
  const output={...result,agent_orchestration:orchestration};
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
  process.exitCode=(result.synthetic_acceptance&&orchestration.pass)?0:1;
}

main().catch(err=>{
  process.stderr.write(`CANARY_AUDIT_ERROR: ${String(err&&err.stack||err)}\n`);
  process.exitCode=2;
});
