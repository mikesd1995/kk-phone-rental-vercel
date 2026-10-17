#!/usr/bin/env node
'use strict';
// Offline evidence comparison only. Does not fetch source, execute REA or mutate KK.
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_EVIDENCE = path.resolve(__dirname, '../docs/KK_REA_SOURCE_PARITY_EVIDENCE_2026-10-17.json');
const FILES = Object.freeze(['index.html', 'style.css', 'assets/kk-storefront-v5.css', 'vercel.json']);
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw Error('INVALID_SNAPSHOT');
  if (!snapshot.ref || typeof snapshot.ref !== 'string') throw Error('SNAPSHOT_REF_MISSING');
  const result = {};
  for (const file of FILES) {
    const entry = snapshot.files?.[file];
    if (!entry || !SHA_PATTERN.test(entry.blob_sha || '') || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw Error('SNAPSHOT_FILE_INVALID:' + file);
    }
    result[file] = { blob_sha: entry.blob_sha, bytes: entry.bytes };
  }
  return { ref: snapshot.ref, files: result };
}

function compareSnapshots(evidence) {
  if (!evidence || evidence.schema !== 'KK_REA_SOURCE_PARITY_V1') throw Error('EVIDENCE_SCHEMA_INVALID');
  if (!/^\d{4}-\d\d-\d\d$/.test(evidence.observed_date || '')) throw Error('OBSERVATION_DATE_MISSING');
  const source = validateSnapshot(evidence.source);
  const deployed = validateSnapshot(evidence.deployed);
  const provenance = evidence.production_deployment;
  if (!provenance || !/^dpl_[A-Za-z0-9]+$/.test(provenance.id || '') || !SHA_PATTERN.test(provenance.commit_sha || '') ||
      provenance.commit_sha !== deployed.ref || provenance.alias !== 'kk-phone-rental.vercel.app') {
    throw Error('DEPLOYMENT_PROVENANCE_INVALID');
  }
  const rows = FILES.map(file => ({
    file,
    same_blob: source.files[file].blob_sha === deployed.files[file].blob_sha,
    source_blob: source.files[file].blob_sha,
    deployed_blob: deployed.files[file].blob_sha,
    source_bytes: source.files[file].bytes,
    deployed_bytes: deployed.files[file].bytes,
    bytes_delta: deployed.files[file].bytes - source.files[file].bytes
  }));
  const changed = rows.filter(row => !row.same_blob);
  const cssChanged = changed.some(row => row.file.endsWith('.css'));
  return {
    schema: evidence.schema,
    observation_date: evidence.observed_date,
    scope: 'HISTORICAL_CONNECTOR_SNAPSHOT_ONLY',
    verdict: changed.length ? 'SOURCE_DRIFT_OBSERVED' : 'SAME_CHECKED_FILE_BLOBS',
    release_acceptance: 'NOT_EVALUATED',
    source_ref: source.ref,
    deployed_commit_sha: deployed.ref,
    deployment_id: provenance.id,
    changed_files: changed.map(row => row.file),
    inspected_files: rows,
    css_revision_mismatch: cssChanged,
    production_reads_live: false,
    note: 'GitHub source blob identity is historical evidence. It is not a browser computed-style check or proof of the current deployment. Refresh both GitHub and Vercel before any release decision.'
  };
}

function loadAndCompare(filePath = DEFAULT_EVIDENCE) {
  return compareSnapshots(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

if (require.main === module) {
  try {
    const report = loadAndCompare();
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.verdict !== 'SAME_CHECKED_FILE_BLOBS') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(JSON.stringify({ status: 'INCOMPLETE_EVIDENCE', message: error.message }) + '\n');
    process.exitCode = 3;
  }
}
module.exports = { FILES, validateSnapshot, compareSnapshots, loadAndCompare };
