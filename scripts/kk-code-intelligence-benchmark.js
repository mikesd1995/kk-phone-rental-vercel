#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const CodeIntel=require('../server/kk-code-intelligence.js');

const root=path.resolve(__dirname,'..');
const fixturePath=path.join(root,'tests','fixtures','kk-code-intelligence-benchmark.json');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const repoMap=CodeIntel.buildRepoMap(root);
const rows=[];
let routeHits=0;
let routeTotal=0;
let fileHits=0;
let fileTotal=0;
let tokenTotal=0;
let maxTokens=0;
let maxFiles=0;
let falsePositives=0;

for(const item of fixture.cases||[]){
  const pack=CodeIntel.contextPack(item.task,{root,repoMap});
  const routes=new Set(pack.matched_routes.map(x=>x.id));
  const files=new Set([...pack.selected_files.map(x=>x.path),...(pack.targeted_tests||[])]);
  const expected=item.expected_routes||[];
  const must=item.must_include||[];
  const routeCaseHits=expected.filter(x=>routes.has(x)).length;
  const fileCaseHits=must.filter(x=>files.has(x)).length;
  const unexpectedRoutes=(item.must_exclude_routes||[]).filter(x=>routes.has(x));
  const unexpectedFiles=(item.must_exclude||[]).filter(x=>files.has(x));
  falsePositives+=unexpectedRoutes.length+unexpectedFiles.length;
  routeHits+=routeCaseHits;
  routeTotal+=expected.length;
  fileHits+=fileCaseHits;
  fileTotal+=must.length;
  tokenTotal+=pack.estimated_context_tokens;
  maxTokens=Math.max(maxTokens,pack.estimated_context_tokens);
  maxFiles=Math.max(maxFiles,pack.selected_files.length);
  rows.push({
    task:item.task,
    routes:[...routes],
    selected_files:pack.selected_files.map(x=>x.path),
    targeted_tests:pack.targeted_tests,
    context_tokens:pack.estimated_context_tokens,
    route_recall:expected.length?routeCaseHits/expected.length:1,
    required_file_recall:must.length?fileCaseHits/must.length:1,
    unexpected_routes:unexpectedRoutes,
    unexpected_files:unexpectedFiles
  });
}

const result={
  schema_version:'KK_CODE_INTELLIGENCE_BENCHMARK_RESULT_V1',
  cases:rows.length,
  route_recall:routeTotal?routeHits/routeTotal:1,
  required_file_recall:fileTotal?fileHits/fileTotal:1,
  average_context_tokens:rows.length?Math.round(tokenTotal/rows.length):0,
  max_context_tokens:maxTokens,
  max_selected_files:maxFiles,
  false_positives:falsePositives,
  limits:{max_context_tokens:12000,max_selected_files:10},
  pass:true,
  failures:[],
  rows
};

if(result.route_recall<1) result.failures.push('ROUTE_RECALL_BELOW_100_PERCENT');
if(result.required_file_recall<0.95) result.failures.push('REQUIRED_FILE_RECALL_BELOW_95_PERCENT');
if(result.max_context_tokens>result.limits.max_context_tokens) result.failures.push('CONTEXT_TOKEN_BUDGET_EXCEEDED');
if(result.max_selected_files>result.limits.max_selected_files) result.failures.push('FILE_BUDGET_EXCEEDED');
if(result.false_positives>0) result.failures.push('EXCLUDED_CONTEXT_RETRIEVED');
result.pass=result.failures.length===0;

console.log(JSON.stringify(result,null,2));
if(!result.pass) process.exitCode=2;
