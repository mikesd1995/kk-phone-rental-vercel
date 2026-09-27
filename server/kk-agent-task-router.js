'use strict';

const SourceWatch = require('./discovery-source-watch-contract.js');
const Verifier = require('./verifier-no-drop-reconciliation.js');
const Canary = require('./canary-acceptance.js');
const Reliability = require('./kk-reliability-learning-agent.js');
const HfAdapter = require('./hf-scanner-adapter.js');

const TASK_ROUTER_VERSION = 'KK_AGENT_TASK_ROUTER_V1';

async function executeTask(taskType, input = {}, options = {}) {
  switch (String(taskType || '').trim().toLowerCase()) {
    case 'source_watch_check':
      return {
        invoked_agents: ['kk-discovery-source-watch'],
        result: SourceWatch.evaluateObservation(input, options.sourceWatchOptions || {})
      };

    case 'verifier_no_drop_audit':
      return {
        invoked_agents: ['kk-event-verifier'],
        result: Verifier.auditNoDrop(input)
      };

    case 'canary_audit':
      return {
        invoked_agents: ['kk-canary-safety'],
        result: Canary.auditCanarySnapshot(input)
      };

    case 'reliability_audit': {
      const observations = Array.isArray(input.observations)
        ? input.observations
        : (Array.isArray(input.reliability_observations) ? input.reliability_observations : []);
      return {
        invoked_agents: ['kk-reliability-learning'],
        result: Reliability.analyzeReliability(observations, {
          incident_history: Array.isArray(input.incident_history) ? input.incident_history : []
        })
      };
    }

    case 'hf_event_assist':
      return {
        invoked_agents: ['hf-event-assist'],
        result: await HfAdapter.classifyScannerCandidate(input, options.hfOptions || {})
      };

    default:
      throw Object.assign(new Error('unsupported agent task'), {
        code: 'AGENT_TASK_NOT_SUPPORTED'
      });
  }
}

module.exports = {
  TASK_ROUTER_VERSION,
  executeTask
};
