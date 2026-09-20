#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const Plan=require('../server/event-integrity-plan.js');

function usage(){
  console.error('Usage: node scripts/verify-event-integrity.js <snapshot.json>');
  process.exitCode=64;
}

const file=process.argv[2];
if(!file){
  usage();
}else{
  try{
    const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
    const report=Plan.buildPlan(snapshot);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(report.blockers.collision_count>0) process.exitCode=2;
  }catch(err){
    console.error(err&&err.stack?err.stack:String(err));
    process.exitCode=1;
  }
}
