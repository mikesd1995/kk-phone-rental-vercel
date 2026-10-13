#!/usr/bin/env node
'use strict';
// Zero-write local audit only; input is a read-only Sheets snapshot exported
// as JSON. Never calls Sheets, admin API, production or a tracker writer.
const fs=require('node:fs');
const Owner=require('../server/kk-ultra-deep-owner-core-lineage.js');
function parseArgs(args=[]){
 const out={};
 for(let i=0;i<args.length;i++){
  const key=String(args[i]);
  if(key!=='--snapshot-json'&&key!=='--event-id')
   throw new Error('OWNER_LINEAGE_READ_ONLY_FLAGS_ONLY');
  if(!args[i+1]||String(args[i+1]).startsWith('--'))
   throw new Error('OWNER_LINEAGE_ARG_VALUE_REQUIRED');
  out[key.slice(2)]=String(args[++i]);
 }
 if(!out['snapshot-json']||!out['event-id'])throw new Error('OWNER_LINEAGE_EXPLICIT_INPUT_REQUIRED');
 return out;
}
function run(argv=process.argv.slice(2)){
 const args=parseArgs(argv);
 const data=JSON.parse(fs.readFileSync(args['snapshot-json'],'utf8'));
 const plan=Owner.prepareFromSheets({...data,event_ids:[args['event-id']]});
 process.stdout.write(JSON.stringify(plan,null,2)+'\n');
 if(plan.status!=='STAGED_REVIEW_ONLY'&&plan.status!=='ALREADY_RECONCILED')
  process.exitCode=2;
 return plan;
}
if(require.main===module){
 try{run();}catch(err){
  process.stderr.write(String(err&&err.message||err)+'\n');
  process.exitCode=2;
 }
}
module.exports={parseArgs,run};
