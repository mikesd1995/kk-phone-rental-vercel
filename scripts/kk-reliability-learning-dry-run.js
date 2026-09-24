#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Reliability = require('../server/kk-reliability-learning-agent.js');

function readInput(file) {
  if (!file) {
    return {
      observations: [
        {
          id: 'CONTROL-DEMO',
          message: 'Task metadata advanced but no governed Machine-SOT lock/Manifest boundary appeared.'
        },
        {
          id: 'IDENTITY-DEMO',
          code: 'FAIL_REQUIRES_EXACT_IDENTITY',
          message: 'Prior resolution pointed to an unrelated Core event due identity/row-position mismatch.'
        },
        {
          id: 'MAKE-DEMO',
          message: 'Make Free-plan credits exhausted; organization or team is paused.'
        }
      ],
      incident_history: []
    };
  }
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
}

const input = readInput(process.argv[2]);
const report = Reliability.analyzeReliability(input.observations || input.incidents || [], {
  incident_history: input.incident_history || []
});

process.stdout.write(JSON.stringify({
  dry_run: true,
  production_writes: 0,
  task_mutations: 0,
  policy_mutations: 0,
  provider_sends: 0,
  report,
  advisor_prompt: Reliability.buildAdvisorPrompt(report)
}, null, 2) + '\n');
