#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const Memory=require('../server/kk-project-memory.js');
const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','kk-project-memory.json'),'utf8'));
const domains=process.argv.slice(2);
const out=Memory.buildBootstrap(corpus.items,{domains,limit:80});
process.stdout.write(JSON.stringify(out,null,2)+'\n');
if(out.status!=='READY') process.exitCode=2;
