'use strict';
// This repository currently has no npm lockfile. Do not silently replace
// "npm ci" with non-reproducible "npm install" on a hosted/billable runner.
// Prove the exact source-only acceptance test import closure uses Node builtins.
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const VERSION='KK_CI_OFFLINE_DEPENDENCY_GATE_V1';
const MODES=new Set(['ultradeep','storage']);
function rel(root,absolute){return path.relative(root,absolute).replace(/\\/g,'/');}
function parseRecall(script){
 const tokens=String(script||'').trim().split(/\s+/);
 if(tokens[0]!=='node'||tokens[1]!=='--test'||tokens.length<3||
  tokens.slice(2).some(x=>!/^tests\/[\w.-]+\.test\.js$/.test(x)))
  throw new Error('OFFLINE_RECALL_SCRIPT_NOT_EXPLICIT_NODE_TEST');
 return [...new Set(tokens.slice(2))];
}
function entriesFor(root,mode){
 if(!MODES.has(mode))throw new Error('OFFLINE_CI_MODE_INVALID');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const recall=parseRecall(pkg.scripts&&pkg.scripts['test:ultradeep:recall']);
 const entries=[...recall,'tests/kk-ultra-deep-full-loop-v2.test.js'];
 if(mode==='ultradeep')entries.push('tests/ultra-deep-v2-workflow-contract.test.js');
 if(mode==='storage')entries.push('tests/vercel-deployment-footprint.test.js',
  'tests/vercel-ignore-build.test.js','tests/siam-halloween-original-asset.test.js');
 return [...new Set(entries)];
}
function relativeResolve(root,from,spec){
 if(!spec.startsWith('.'))return null;
 const base=path.resolve(path.dirname(from),spec);
 if(base!==root&&!base.startsWith(root+path.sep))return {error:'PATH_ESCAPE'};
 const choices=path.extname(base)?[base]:[base,base+'.js',base+'.cjs',base+'.mjs',
  base+'.json',path.join(base,'index.js')];
 for(const candidate of choices)if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())
  return {absolute:candidate};
 return {error:'LOCAL_MODULE_MISSING'};
}
function inspect(root,entries){
 const absRoot=path.resolve(root),queue=[...entries],visited=new Set(),blockers=[],externals=[];
 for(let i=0;i<queue.length;i++){
  const p=String(queue[i]);
  const absolute=path.resolve(absRoot,p);
  if(absolute!==absRoot&&!absolute.startsWith(absRoot+path.sep)){
   blockers.push({path:p,reason:'PATH_ESCAPE'});continue;
  }
  if(visited.has(absolute))continue;
  if(!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){
   blockers.push({path:p,reason:'ENTRY_OR_IMPORT_FILE_MISSING'});continue;
  }
  visited.add(absolute);
  if(path.extname(absolute)==='.json')continue;
  const src=fs.readFileSync(absolute,'utf8');
  const re=/\brequire(?:\.resolve)?\s*\(\s*(['"])([^'"]+)\1\s*\)|\bimport\s*\(\s*(['"])([^'"]+)\3\s*\)|\b(?:import|export)\s+[^;\n]*?\s+from\s+(['"])([^'"]+)\5/g;
  const matches=[...src.matchAll(re)];
  for(const match of matches){
   const spec=match[2]||match[4]||match[6];
   if(Module.isBuiltin(spec))continue;
   if(!spec.startsWith('.')){
    externals.push({file:rel(absRoot,absolute),package:spec});
    continue;
   }
   const resolved=relativeResolve(absRoot,absolute,spec);
   if(resolved.error)blockers.push({file:rel(absRoot,absolute),import:spec,reason:resolved.error});
   else queue.push(rel(absRoot,resolved.absolute));
  }
  // A computed require/import cannot be validated without evaluating arbitrary
  // repository source. Fail closed rather than calling it dependency-free.
  const staticCalls=matches.filter(m=>m[0].startsWith('require')||m[0].startsWith('import(')).length;
  const allCalls=[...src.matchAll(/\brequire(?:\.resolve)?\s*\(|\bimport\s*\(/g)].length;
  if(allCalls>staticCalls)
   blockers.push({file:rel(absRoot,absolute),reason:'DYNAMIC_REQUIRE_OR_IMPORT_NOT_AUDITED'});
 }
 if(externals.length)blockers.push({reason:'EXTERNAL_PACKAGE_REQUIRES_LOCKED_INSTALL',count:externals.length});
 return {version:VERSION,status:blockers.length?'HOLD':'PASS',checked_files:visited.size,
  requested_entries:entries.length,blockers,external_imports:externals,production_writes:0,
  verified_by:'STATIC_SOURCE_IMPORT_CLOSURE_ONLY',hosted_ci_pass:false};
}
function main(argv=process.argv.slice(2)){
 const mode=argv[0];
 if(argv.length!==1||!MODES.has(mode))throw new Error('usage: node scripts/kk-ci-offline-dependency-gate.js ultradeep|storage');
 const result=inspect(path.resolve(__dirname,'..'),entriesFor(path.resolve(__dirname,'..'),mode));
 process.stdout.write(JSON.stringify({...result,mode},null,2)+'\n');
 if(result.status!=='PASS')process.exitCode=1;
 return result;
}
if(require.main===module)try{main();}catch(e){process.stderr.write(String(e.message||e)+'\n');process.exitCode=1;}
module.exports={VERSION,MODES,parseRecall,entriesFor,relativeResolve,inspect,main};
