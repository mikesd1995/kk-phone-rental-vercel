#!/usr/bin/env node
'use strict';
// Exact monthly source snapshot JSON only. Emits review-only proposals;
// cannot write Google Sheets, publish events, run a paid provider or retrain AI.
const fs=require('node:fs');
const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
function parseArgs(argv=[]){
 const out={};
 for(let i=0;i<argv.length;i++){
  const key=String(argv[i]);
  if(!['--snapshot-json','--as-of'].includes(key))
   throw new Error('BACKSCAN_REVIEW_READ_ONLY_FLAGS_ONLY');
  if(!argv[i+1]||String(argv[i+1]).startsWith('--'))
   throw new Error('BACKSCAN_REVIEW_ARGUMENT_VALUE_REQUIRED');
  out[key.slice(2)]=String(argv[++i]);
 }
 if(!out['snapshot-json'])throw new Error('BACKSCAN_REVIEW_SNAPSHOT_REQUIRED');
 return out;
}
function run(argv=process.argv.slice(2)){
 const args=parseArgs(argv);
 const snapshot=JSON.parse(fs.readFileSync(args['snapshot-json'],'utf8'));
 const review=Learning.learn({backscan_review_snapshot:{
  ...snapshot,as_of:args['as-of']||snapshot.as_of
 }}).backscan_miss_learning;
 process.stdout.write(JSON.stringify(review,null,2)+'\n');
 if(!review||review.status!=='STAGED_REVIEW_ONLY')process.exitCode=2;
 return review;
}
if(require.main===module){
 try{run();}catch(e){
  process.stderr.write(String(e&&e.message||e)+'\n');
  process.exitCode=2;
 }
}
module.exports={parseArgs,run};
