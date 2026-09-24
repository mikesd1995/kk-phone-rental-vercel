'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCreativePlan, buildGenerationPrompt } = require('../server/kk-content-agent.js');

function readJson(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function main() {
  const inputFile = process.argv[2];
  const performanceFile = process.argv[3];

  const input = readJson(inputFile) || {
    event: 'DRY RUN EVENT — DO NOT PUBLISH',
    venue: 'DRY RUN VENUE',
    verified_event: false,
    verified_pricing: false,
    inventory_available: false,
    primary_objective: 'awareness'
  };
  const performanceRows = readJson(performanceFile) || [];
  const plan = buildCreativePlan(input, performanceRows);

  const output = {
    dry_run: true,
    production_writes: 0,
    publishes: 0,
    ad_spend_changes: 0,
    plan,
    generation_prompt: buildGenerationPrompt(plan)
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
