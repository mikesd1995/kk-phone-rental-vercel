'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let Contract = {};
try {
  Contract = require('../server/kk-csv-analysis-contract.js');
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;
}

function validInput(overrides = {}) {
  return {
    question: 'Which segment drives revenue growth?',
    filename: 'sales.csv',
    csv_base64: Buffer.from('segment,revenue\nA,100\nB,200\n', 'utf8').toString('base64'),
    allow_fallback: true,
    ...overrides
  };
}

test('CSV analysis contract exposes the required validators', () => {
  assert.equal(typeof Contract.validateAnalysisRequest, 'function');
  assert.equal(typeof Contract.validateFindings, 'function');
  assert.equal(typeof Contract.verifyArtifactManifest, 'function');
});

test('valid CSV request is normalized without exposing raw CSV text', () => {
  const out = Contract.validateAnalysisRequest(validInput());
  assert.equal(out.ok, true);
  assert.equal(out.value.filename, 'sales.csv');
  assert.equal(out.value.question, 'Which segment drives revenue growth?');
  assert.equal(out.value.allow_fallback, true);
  assert.equal(Buffer.isBuffer(out.value.csv_bytes), true);
  assert.equal(Object.hasOwn(out.value, 'csv_text'), false);
});

test('invalid base64 fails closed before engine invocation', () => {
  const out = Contract.validateAnalysisRequest(validInput({ csv_base64: '%%%not-base64%%%' }));
  assert.equal(out.ok, false);
  assert.equal(out.blocker, 'CSV_BASE64_INVALID');
});

test('CSV filename must use .csv extension', () => {
  const out = Contract.validateAnalysisRequest(validInput({ filename: 'sales.txt' }));
  assert.equal(out.ok, false);
  assert.equal(out.blocker, 'CSV_FILENAME_INVALID');
});

test('question is required and capped', () => {
  assert.equal(Contract.validateAnalysisRequest(validInput({ question: '   ' })).blocker, 'CSV_QUESTION_REQUIRED');
  assert.equal(Contract.validateAnalysisRequest(validInput({ question: 'x'.repeat(4001) })).blocker, 'CSV_QUESTION_TOO_LONG');
});

test('empty and null-byte CSV payloads fail closed', () => {
  const empty = Contract.validateAnalysisRequest(validInput({ csv_base64: Buffer.alloc(0).toString('base64') }));
  assert.equal(empty.ok, false);
  assert.equal(empty.blocker, 'CSV_PAYLOAD_EMPTY');

  const nul = Contract.validateAnalysisRequest(validInput({ csv_base64: Buffer.from('a,b\n1,\0\n').toString('base64') }));
  assert.equal(nul.ok, false);
  assert.equal(nul.blocker, 'CSV_PAYLOAD_NULL_BYTE');
});

test('request byte limit is enforced deterministically', () => {
  const out = Contract.validateAnalysisRequest(validInput({
    csv_base64: Buffer.from('123456789').toString('base64')
  }), { maxBytes: 8 });
  assert.equal(out.ok, false);
  assert.equal(out.blocker, 'CSV_PAYLOAD_TOO_LARGE');
});

test('findings contract validates required structured fields', () => {
  const valid = Contract.validateFindings({
    question: 'Q',
    answer: 'A',
    dataset: { rows: 2, columns: 2 },
    findings: [{ title: 'Revenue', finding: 'B is larger', evidence: '200 > 100', importance: 'high' }],
    caveats: [],
    charts: []
  });
  assert.equal(valid.ok, true);

  const invalid = Contract.validateFindings({ question: 'Q' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.blocker, 'FINDINGS_SCHEMA_INVALID');
});

test('artifact manifest requires report, findings and zip while charts may be empty', () => {
  const valid = Contract.verifyArtifactManifest({
    report_pdf: 'report.pdf',
    findings_json: 'findings.json',
    charts: [],
    bundle_zip: 'results.zip'
  });
  assert.equal(valid.ok, true);

  const missing = Contract.verifyArtifactManifest({
    findings_json: 'findings.json',
    charts: [],
    bundle_zip: 'results.zip'
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.blocker, 'ANALYSIS_ARTIFACTS_INCOMPLETE');
});
