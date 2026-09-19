'use strict';

const fs=require('fs');
const path=require('path');
const {auditCanarySnapshot}=require('../server/canary-acceptance');

function usage(){
  process.stderr.write('Usage: node scripts/audit-canary-snapshot.js <snapshot.json>\n');
}

function main(){
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
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.synthetic_acceptance?0:1;
}

if(require.main===module) main();
