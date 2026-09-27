#!/usr/bin/env node
'use strict';

const {spawnSync}=require('child_process');
const path=require('path');
const CodeIntel=require('../server/kk-code-intelligence.js');

const task=process.argv.slice(2).join(' ').trim();
if(!task){
  console.error('Usage: npm run code:test -- "<task description>"');
  process.exitCode=64;
}else{
  const pack=CodeIntel.contextPack(task,{root:path.resolve(__dirname,'..')});
  const tests=pack.targeted_tests||[];
  if(!tests.length){
    console.log('No targeted tests resolved; running full regression.');
    const out=spawnSync('npm',['test'],{stdio:'inherit',shell:process.platform==='win32'});
    process.exitCode=out.status==null?1:out.status;
  }else{
    console.log(JSON.stringify({matched_routes:pack.matched_routes,targeted_tests:tests},null,2));
    const out=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
    process.exitCode=out.status==null?1:out.status;
  }
}
