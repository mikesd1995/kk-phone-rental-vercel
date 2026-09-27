#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Verifier=require('../server/verifier-no-drop-reconciliation.js');
const Orchestration=require('../server/kk-agent-orchestration.js');

async function main(){
  const file=process.argv[2];
  if(!file){
    process.stderr.write('Usage: node scripts/audit-verifier-no-drop.js <snapshot.json>\n');
    process.exitCode=64;
    return;
  }

  const input=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),file),'utf8'));
  const result=Verifier.auditNoDrop(input);
  const orchestration=await Orchestration.recordExecution({
    intent:'verifier_no_drop_audit',
    invoked_agents:['kk-event-verifier'],
    input,
    output:result,
    correlation_id:String(input.run_id||input.audit_id||'verifier-no-drop'),
    gate_status:'RECORDED',
    owner_review_required:false
  });

  process.stdout.write(JSON.stringify({
    generated_by:'kk-verifier-no-drop-audit-v1',
    result,
    agent_orchestration:orchestration,
    production_writes:0
  },null,2)+'\n');
  process.exitCode=orchestration.pass?0:2;
}

main().catch(err=>{
  process.stderr.write(String(err&&err.stack||err)+'\n');
  process.exitCode=1;
});
