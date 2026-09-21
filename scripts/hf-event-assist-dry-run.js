#!/usr/bin/env node
'use strict';

const HF = require('../server/hf-event-assist.js');

async function main() {
  const candidate = {
    candidate_id: 'DRY-RUN-ONLY',
    name: process.argv.slice(2).join(' ') || 'Example concert event in Bangkok',
    source_text: 'Dry-run candidate only. No Machine SOT or production write is performed.'
  };

  const classification = await HF.classifyEventCandidate(candidate);
  const report = {
    generated_by: 'kk-hf-event-assist-dry-run-v1',
    candidate,
    classification,
    production_writes: 0,
    final_truth_mutation: false
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write((error && error.stack) || String(error));
  process.stderr.write('\n');
  process.exitCode = 1;
});
