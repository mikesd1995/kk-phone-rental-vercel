#!/usr/bin/env node
'use strict';
// No network, no credentials, no business writes. Input MUST be a fresh, sanitized snapshot.
const fs=require('node:fs');
const Gate=require('../../server/kk-dec2026-candidate-preflight.js');
const file=process.argv[2];
if(!file){
 process.stderr.write('Usage: node scripts/qa/kk-dec2026-candidate-preflight.cjs <fresh-sanitized-snapshot.json>\n');
 process.exitCode=64;
}else{
 try{
  const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
  const report=Gate.evaluate(snapshot);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='PREPARED_FOR_INDEPENDENT_VERIFIER')process.exitCode=2;
 }catch(error){
  process.stderr.write('Preflight input invalid: '+String(error&&error.message||error)+'\n');
  process.exitCode=1;
 }
}
