'use strict';
const fs=require('node:fs');
const {collectPublic}=require('../platform/ops/public-collector');
async function main(argv){
 const args={};for(let i=0;i<argv.length;i+=2){if(!['--input','--output'].includes(argv[i])||!argv[i+1]||Object.hasOwn(args,argv[i]))throw Error('CLI_ARGUMENT_INVALID');args[argv[i]]=argv[i+1];}
 if(!args['--input']||!args['--output'])throw Error('CLI_ARGUMENT_REQUIRED');
 const stat=fs.lstatSync(args['--input']);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768)throw Error('INPUT_FILE_INVALID');
 if(fs.existsSync(args['--output']))throw Error('OUTPUT_EXISTS');
 const input=JSON.parse(fs.readFileSync(args['--input'],'utf8'));if(Object.keys(input).length!==1||!Object.hasOwn(input,'event_ids'))throw Error('INPUT_SCHEMA_INVALID');
 const result=await collectPublic({eventIds:input.event_ids});fs.writeFileSync(args['--output'],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:result.status,request_attempts:result.request_attempts,production_writes:0}));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({error_code:/^[A-Z_]+$/.test(e.code||e.message)?(e.code||e.message):'PUBLIC_OBSERVATION_FAILED'}));process.exitCode=1;});
module.exports={main};
