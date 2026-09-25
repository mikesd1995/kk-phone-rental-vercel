'use strict';
const fs=require('node:fs');
const {createOpenAIProvider}=require('../platform/ops/openai-advisory-provider');
const {initializeAdvisoryJournal,runAdvisory}=require('../platform/ops/advisory-journal');
function read(file){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>65536)throw Error('INPUT_FILE_INVALID');return JSON.parse(fs.readFileSync(file,'utf8'));}
async function main(argv){
 const args={};for(let i=0;i<argv.length;i+=2){if(!['--input','--authority','--state-dir','--initialize','--occurrence','--output'].includes(argv[i])||!argv[i+1]||Object.hasOwn(args,argv[i]))throw Error('CLI_ARGUMENT_INVALID');args[argv[i]]=argv[i+1];}
 for(const k of ['--input','--authority','--state-dir','--occurrence','--output'])if(!args[k])throw Error('CLI_ARGUMENT_REQUIRED');
 if(args['--initialize']&&args['--initialize']!=='local-only')throw Error('CLI_ARGUMENT_INVALID');if(fs.existsSync(args['--output']))throw Error('OUTPUT_EXISTS');
 const result=read(args['--input']);const report=result.report||result;
 // Only the local host resolves secrets. No key is accepted in an input report or logged.
 const provider=createOpenAIProvider({model:process.env.KK_OPS_ADVISORY_MODEL,apiKey:process.env.OPENAI_API_KEY});
 if(args['--initialize'])initializeAdvisoryJournal(args['--state-dir']);
 const receipt=await runAdvisory({stateDirectory:args['--state-dir'],occurrenceId:args['--occurrence'],report,provider,authorize:()=>read(args['--authority'])});
 fs.writeFileSync(args['--output'],JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({status:receipt.status,provider_calls_this_invocation:receipt.provider_calls_this_invocation,production_writes:0}));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({error_code:/^[A-Z_]+$/.test(e.code||e.message)?(e.code||e.message):'ADVISORY_LOCAL_RUN_FAILED'}));process.exitCode=1;});
module.exports={main};
