#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const CsvAgent = require('../server/kk-csv-analysis-agent.js');

function cliError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseArgs(argv = []) {
  const parsed = {
    csv: '',
    question: '',
    output: './analysis-output',
    model: process.env.OPENAI_CSV_ANALYSIS_MODEL || CsvAgent.DEFAULT_MODEL,
    keepSession: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }
    if (token === '--keep-session') {
      parsed.keepSession = true;
      continue;
    }

    const valueFlags = new Map([
      ['--csv', 'csv'],
      ['--question', 'question'],
      ['--output', 'output'],
      ['--model', 'model']
    ]);
    const key = valueFlags.get(token);
    if (!key) {
      throw cliError('CSV_ANALYSIS_CLI_UNKNOWN_ARGUMENT', `Unknown argument: ${token}`);
    }

    const value = String(argv[i + 1] || '').trim();
    if (!value || value.startsWith('--')) {
      throw cliError('CSV_ANALYSIS_CLI_VALUE_REQUIRED', `Missing value for ${token}`);
    }
    parsed[key] = value;
    i += 1;
  }

  if (parsed.help) return parsed;
  if (!parsed.csv) throw cliError('CSV_ANALYSIS_CLI_CSV_REQUIRED', '--csv is required');
  if (!parsed.question) throw cliError('CSV_ANALYSIS_CLI_QUESTION_REQUIRED', '--question is required');

  return parsed;
}

function usage() {
  return [
    'KK CSV Analysis Agent',
    '',
    'Usage:',
    '  npm run csv:analyze -- --csv <file.csv> --question "<question>" [options]',
    '',
    'Options:',
    '  --output <dir>       Download directory (default: ./analysis-output)',
    '  --model <model>      OpenAI model (default: OPENAI_CSV_ANALYSIS_MODEL or gpt-6-astra)',
    '  --keep-session       Do not delete the remote Agents API session after download',
    '  --help, -h           Show this help',
    '',
    'Environment:',
    '  OPENAI_API_KEY                 Required',
    '  OPENAI_CSV_ANALYSIS_MODEL      Optional model override'
  ].join('\n');
}

async function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;

  if (args.help) {
    stdout.write(usage() + '\n');
    return {status:'HELP'};
  }

  const csvPath = path.resolve(args.csv);
  const outputDir = path.resolve(args.output);
  const csvBuffer = await fs.readFile(csvPath);

  const result = await CsvAgent.runCsvAnalysis({
    csvBuffer,
    filename: path.basename(csvPath),
    question: args.question,
    outputDir,
    model: args.model,
    apiKey: options.apiKey || process.env.OPENAI_API_KEY,
    fetchImpl: options.fetchImpl || globalThis.fetch,
    cleanupSession: !args.keepSession
  });

  const summary = {
    status: result.status,
    schema_version: result.schema_version,
    model: result.model,
    session_id: result.session_id,
    turn_id: result.turn_id,
    output_dir: outputDir,
    artifacts: result.artifacts.map(item => item.filename)
  };

  stdout.write(JSON.stringify(summary, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  main().catch(error => {
    const safe = {
      status: 'FAILED',
      code: String(error && error.code || 'CSV_ANALYSIS_CLI_FAILED'),
      message: String(error && error.message || 'CSV analysis failed')
    };
    process.stderr.write(JSON.stringify(safe, null, 2) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  cliError,
  parseArgs,
  usage,
  main
};
