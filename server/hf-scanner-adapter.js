'use strict';

const HF = require('./hf-event-assist.js');
const Wiring = require('./hf-scanner-wiring-contract.js');

async function classifyScannerCandidate(input = {}, options = {}) {
  const env = options.env || process.env;
  const assistOptions = {
    env,
    token: options.token,
    fetchImpl: options.fetchImpl,
    model: options.model,
    timeoutMs: options.timeoutMs
  };

  return Wiring.runGuardedScannerHfAssist(input, {
    env,
    assistOptions,
    assistFn: async (candidate, forwarded) => HF.classifyEventCandidate(candidate, forwarded)
  });
}

module.exports = {
  classifyScannerCandidate
};
