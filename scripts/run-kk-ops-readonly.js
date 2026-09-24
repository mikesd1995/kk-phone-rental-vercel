'use strict';
const fs = require('node:fs');
const {initializePilot,runPilot} = require('../platform/ops/local-pilot');
function main(argv) {
  const args = {};
  for(let i=0;i<argv.length;i+=2) {
    if(!['--input','--state-dir','--occurrence','--policy','--output','--initialize'].includes(argv[i]) || !argv[i+1] || Object.hasOwn(args,argv[i])) throw new Error('CLI_ARGUMENT_INVALID');
    args[argv[i]]=argv[i+1];
  }
  for(const key of ['--input','--state-dir','--occurrence','--policy','--output']) if(!args[key]) throw new Error('CLI_ARGUMENT_REQUIRED');
  if(args['--initialize'] && args['--initialize']!=='local-only') throw new Error('CLI_ARGUMENT_INVALID');
  const input=args['--input'];
  if(!fs.lstatSync(input).isFile() || fs.lstatSync(input).isSymbolicLink() || fs.statSync(input).size>65536) throw new Error('INPUT_FILE_INVALID');
  if(fs.existsSync(args['--output'])) throw new Error('OUTPUT_EXISTS');
  const snapshot=JSON.parse(fs.readFileSync(input,'utf8'));
  const now=new Date().toISOString();
  if(args['--initialize']) initializePilot(args['--state-dir'],{now});
  const result=runPilot({stateDirectory:args['--state-dir'],snapshot,occurrenceId:args['--occurrence'],expectedPolicyVersion:args['--policy'],now});
  fs.writeFileSync(args['--output'],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:result.report.status,replayed:result.replayed,production_writes:0,model_calls:0}));
}
if(require.main===module) { try { main(process.argv.slice(2)); } catch(error) { console.error(JSON.stringify({error_code:/^[A-Z_]+$/.test(error.code||error.message)?(error.code||error.message):'LOCAL_PILOT_FAILED'})); process.exitCode=1; } }
module.exports={main};
