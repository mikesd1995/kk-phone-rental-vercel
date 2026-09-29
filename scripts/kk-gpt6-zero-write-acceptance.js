'use strict';

const Runtime = require('../server/kk-gpt6-shadow-runtime.js');

async function main() {
  const cases = [
    {
      workload:'scanner',
      input:{
        case_id:'LIVE-ZERO-WRITE-SCANNER',
        candidate:{title:'Synthetic Shadow Safety Case',event_date:'2099-01-01',venue:'Synthetic Hall'},
        evidence:[{source_ref:'SYNTHETIC',type:'test',claim:'synthetic event for transport acceptance only'}]
      }
    },
    {
      workload:'verifier',
      input:{
        case_id:'LIVE-ZERO-WRITE-VERIFIER',
        candidate:{event_id:'SYNTH-LOCKED',title:'Synthetic Locked Case',event_date:'2099-01-01'},
        visibility_history:{status:'LOCKED',match_method:'EVENT_ID'},
        evidence:[{source_ref:'SYNTHETIC',type:'test',claim:'synthetic locked history'}]
      }
    }
  ];

  const results = [];
  for (const item of cases) {
    results.push(await Runtime.runShadow(item.workload, item.input, {env:process.env}));
  }

  const live = results.every(result =>
    result.status === 'SHADOW_RESULT_READY' &&
    result.network_calls === 1 &&
    Boolean(result.response_id)
  );
  const zeroWrite = results.every(result =>
    Number(result.production_writes) === 0 &&
    Number(result.publishes) === 0 &&
    Number(result.notification_sends) === 0 &&
    result.final_truth_mutation === false &&
    result.shadow_decision?.authority === 'SHADOW_ADVISORY_ONLY' &&
    Number(result.shadow_decision?.production_writes) === 0 &&
    Number(result.shadow_decision?.publishes) === 0 &&
    Number(result.shadow_decision?.notification_sends) === 0 &&
    result.shadow_decision?.final_truth_mutation === false
  );

  const passed = live && zeroWrite;
  process.stdout.write(JSON.stringify({
    schema_version:'KK_GPT6_ZERO_WRITE_ACCEPTANCE_V1',
    status:passed ? 'LIVE_ZERO_WRITE_ACCEPTANCE_PASS' : 'LIVE_ZERO_WRITE_ACCEPTANCE_BLOCKED',
    zero_write_acceptance_passed:passed,
    live_execution_evidence:live,
    cases:results.map(result=>({
      workload:result.workload,
      status:result.status,
      response_id:result.response_id || null,
      model:result.model || null,
      network_calls:result.network_calls,
      production_writes:result.production_writes,
      authority:result.shadow_decision?.authority || null,
      transport:result.transport || null,
      auth_mode:result.auth_mode || null,
      provider_status:Number(result.provider_status || 0) || null,
      provider_error_code:result.provider_error_code || null
    })),
    production_writes:0
  }, null, 2) + '\n');
  if (!passed) process.exitCode = 2;
}

main().catch(error => {
  process.stdout.write(JSON.stringify({
    schema_version:'KK_GPT6_ZERO_WRITE_ACCEPTANCE_V1',
    status:'LIVE_ZERO_WRITE_ACCEPTANCE_EXCEPTION',
    zero_write_acceptance_passed:false,
    error_code:String(error && (error.code || error.name) || 'ERROR'),
    production_writes:0
  }, null, 2) + '\n');
  process.exitCode = 2;
});
