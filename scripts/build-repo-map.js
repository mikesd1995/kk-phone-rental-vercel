#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const CodeIntel=require('../server/kk-code-intelligence.js');

const root=path.resolve(__dirname,'..');
const targetArg=process.argv[2]||path.join('.cache','kk-repo-map.json');
const target=path.resolve(root,targetArg);
const map=CodeIntel.buildRepoMap(root);
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify(map,null,2)+'\n','utf8');
console.log(JSON.stringify({
  ok:true,
  schema_version:map.schema_version,
  file_count:map.file_count,
  output:path.relative(root,target).replace(/\\/g,'/')
},null,2));
