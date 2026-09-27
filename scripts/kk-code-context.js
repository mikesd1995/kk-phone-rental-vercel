#!/usr/bin/env node
'use strict';

const path=require('path');
const CodeIntel=require('../server/kk-code-intelligence.js');

const task=process.argv.slice(2).join(' ').trim();
if(!task){
  console.error('Usage: npm run code:context -- "<task description>"');
  process.exitCode=64;
}else{
  const pack=CodeIntel.contextPack(task,{root:path.resolve(__dirname,'..')});
  console.log(JSON.stringify({
    ...pack,
    targeted_test_command:CodeIntel.targetedTestCommand(pack)
  },null,2));
}
