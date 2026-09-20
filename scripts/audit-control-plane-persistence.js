#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Persistence=require('../server/control-plane-persistence.js');

function usage(){
  process.stderr.write('Usage: node scripts/audit-control-plane-persistence.js <snapshot.json> [--required=6]\n');
}

function parseRequired(args){
  let required=6;
  for(const arg of args){
    if(!arg.startsWith('--required=')) return {error:'Unknown argument: '+arg};
    const n=Number(arg.slice('--required='.length));
    if(!Number.isInteger(n) || n<1 || n>48) return {error:'required must be integer 1..48'};
    required=n;
  }
  return {required};
}

function main(){
  const file=process.argv[2];
  if(!file){
    usage();
    process.exitCode=64;
    return;
  }
  const parsed=parseRequired(process.argv.slice(3));
  if(parsed.error){
    process.stderr.write(JSON.stringify({ok:false,classification:'CLI_ARGUMENT_ERROR',message:parsed.error})+'\n');
    process.exitCode=64;
    return;
  }

  try{
    const snapshot=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),file),'utf8'));
    const report=Persistence.auditPersistenceSnapshot(snapshot,{required:parsed.required});
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    process.exitCode=report.pass?0:2;
  }catch(error){
    process.stderr.write(JSON.stringify({
      ok:false,
      classification:'CONTROL_PLANE_PERSISTENCE_AUDIT_FAILED',
      message:String(error&&error.message||error),
      production_writes:0,
      task_mutations:0
    })+'\n');
    process.exitCode=1;
  }
}

if(require.main===module) main();

module.exports={parseRequired};
