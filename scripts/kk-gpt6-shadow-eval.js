'use strict';

const fs = require('fs');
const path = require('path');
const Eval = require('../server/kk-gpt6-shadow-eval.js');
const Runtime = require('../server/kk-gpt6-shadow-runtime.js');

async function main() {
  const cases = JSON.parse(fs.readFileSync(
    path.join(__dirname,'..','config','kk-gpt6-shadow-eval-cases.json'),
    'utf8'
  ));
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn:Runtime.runShadow,
    runtimeOptions:{env:process.env}
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.shadow_eval_passed) process.exitCode = 2;
}

main().catch(error => {
  process.stdout.write(JSON.stringify({
    eval_version:'KK_GPT6_SHADOW_EVAL_V1',
    status:'SHADOW_EVAL_EXCEPTION',
    shadow_eval_passed:false,
    error_code:String(error && (error.code || error.name) || 'ERROR'),
    production_writes:0
  }, null, 2) + '\n');
  process.exitCode = 2;
});
