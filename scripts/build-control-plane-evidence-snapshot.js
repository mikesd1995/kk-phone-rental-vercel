'use strict';

const fs=require('node:fs');
const Path=require('node:path');
const Builder=require('../server/control-plane-evidence-snapshot.js');

function main(argv=process.argv.slice(2)){
  const source=argv[0];
  if(!source){
    process.stderr.write(JSON.stringify({ok:false,error_code:'INPUT_JSON_REQUIRED'})+'\n');
    return 2;
  }
  const path=Path.resolve(source);
  const input=JSON.parse(fs.readFileSync(path,'utf8'));
  const result=Builder.buildEvidenceSnapshot(input);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  return result.usable?0:1;
}

if(require.main===module){
  try{process.exitCode=main();}
  catch(err){
    process.stderr.write(JSON.stringify({ok:false,error_code:'SNAPSHOT_BUILD_FAILED',message:String(err&&err.message||err)})+'\n');
    process.exitCode=2;
  }
}

module.exports={main};
