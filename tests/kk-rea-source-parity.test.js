'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Parity = require('../scripts/kk-rea-source-parity.cjs');
const evidencePath = path.join(__dirname, '../docs/KK_REA_SOURCE_PARITY_EVIDENCE_2026-10-17.json');
function evidence() { return JSON.parse(fs.readFileSync(evidencePath, 'utf8')); }

test('2026-10-17 connector evidence detects exact two-file drift, not a confirmed UI bug', () => {
  const result = Parity.loadAndCompare(evidencePath);
  assert.equal(result.verdict, 'SOURCE_DRIFT_OBSERVED');
  assert.deepEqual(result.changed_files, ['index.html', 'assets/kk-storefront-v5.css']);
  assert.equal(result.css_revision_mismatch, true);
  assert.equal(result.release_acceptance, 'NOT_EVALUATED');
  assert.equal(result.production_reads_live, false);
  assert.equal(result.deployed_commit_sha, evidence().production_deployment.commit_sha);
  assert.equal(result.inspected_files.find(x => x.file === 'assets/kk-storefront-v5.css').bytes_delta, 12719);
});

test('same checked blobs returns a limited identical source result', () => {
  const copy = evidence();
  copy.source = JSON.parse(JSON.stringify(copy.deployed));
  const result = Parity.compareSnapshots(copy);
  assert.equal(result.verdict, 'SAME_CHECKED_FILE_BLOBS');
  assert.equal(result.release_acceptance, 'NOT_EVALUATED');
  assert.deepEqual(result.changed_files, []);
});

test('missing SHA/file or altered deployment lineage fails closed', () => {
  const a = evidence();
  delete a.source.files['assets/kk-storefront-v5.css'];
  assert.throws(() => Parity.compareSnapshots(a), /SNAPSHOT_FILE_INVALID/);
  const b = evidence();
  b.production_deployment.commit_sha = 'f'.repeat(40);
  assert.throws(() => Parity.compareSnapshots(b), /DEPLOYMENT_PROVENANCE_INVALID/);
  const c = evidence();
  c.deployed.files['vercel.json'].blob_sha = 'invalid';
  assert.throws(() => Parity.compareSnapshots(c), /SNAPSHOT_FILE_INVALID/);
});

test('reject unsupported schema and missing evidence date', () => {
  const a = evidence();
  a.schema = 'other';
  assert.throws(() => Parity.compareSnapshots(a), /EVIDENCE_SCHEMA_INVALID/);
  const b = evidence();
  b.observed_date = '';
  assert.throws(() => Parity.compareSnapshots(b), /OBSERVATION_DATE_MISSING/);
});
