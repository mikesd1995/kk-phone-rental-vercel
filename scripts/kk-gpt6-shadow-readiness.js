'use strict';

const Runtime = require('../server/kk-gpt6-shadow-runtime.js');

function main() {
  const scanner = Runtime.readiness('scanner', process.env);
  const verifier = Runtime.readiness('verifier', process.env);
  const enabled = scanner.enabled && verifier.enabled;
  const credentialReady = scanner.credential_ready && verifier.credential_ready;
  const status = !enabled
    ? 'SHADOW_DISABLED'
    : (credentialReady ? 'READY_FOR_LIVE_SHADOW_EVAL' : 'BLOCKED_OPENAI_API_KEY_MISSING');

  process.stdout.write(JSON.stringify({
    schema_version:'KK_GPT6_SHADOW_READINESS_V1',
    status,
    scanner,
    verifier,
    network_calls:0,
    production_writes:0,
    publishes:0,
    notification_sends:0,
    final_truth_mutation:false
  }, null, 2) + '\n');
}

main();
