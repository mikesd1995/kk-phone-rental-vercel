'use strict';

const path = require('path');

const CONTRACT_VERSION = 'KK_CSV_ANALYSIS_CONTRACT_V1';
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_QUESTION_CHARS = 4000;
const IMPORTANCE = new Set(['high', 'medium', 'low']);

function fail(blocker, details = {}) {
  return { ok: false, blocker, ...details };
}

function strictBase64ToBuffer(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const compact = value.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  const firstPad = compact.indexOf('=');
  if (firstPad !== -1 && firstPad < compact.length - 2) return null;
  let bytes;
  try {
    bytes = Buffer.from(compact, 'base64');
  } catch (_) {
    return null;
  }
  const canonical = bytes.toString('base64');
  if (canonical !== compact) return null;
  return bytes;
}

function validateAnalysisRequest(input = {}, options = {}) {
  const question = String(input.question || '').trim();
  if (!question) return fail('CSV_QUESTION_REQUIRED');
  if (question.length > MAX_QUESTION_CHARS) {
    return fail('CSV_QUESTION_TOO_LONG', { max_question_chars: MAX_QUESTION_CHARS });
  }

  const filename = String(input.filename || '').trim();
  if (!filename || path.extname(filename).toLowerCase() !== '.csv') {
    return fail('CSV_FILENAME_INVALID');
  }

  const csvBytes = strictBase64ToBuffer(input.csv_base64);
  if (!csvBytes) {
    if (typeof input.csv_base64 === 'string' && input.csv_base64.length === 0) {
      return fail('CSV_PAYLOAD_EMPTY');
    }
    return fail('CSV_BASE64_INVALID');
  }
  if (csvBytes.length === 0) return fail('CSV_PAYLOAD_EMPTY');

  const maxBytes = Number.isFinite(Number(options.maxBytes))
    ? Math.max(1, Number(options.maxBytes))
    : DEFAULT_MAX_BYTES;
  if (csvBytes.length > maxBytes) {
    return fail('CSV_PAYLOAD_TOO_LARGE', {
      payload_bytes: csvBytes.length,
      max_bytes: maxBytes
    });
  }
  if (csvBytes.includes(0)) return fail('CSV_PAYLOAD_NULL_BYTE');

  return {
    ok: true,
    schema_version: CONTRACT_VERSION,
    value: {
      question,
      filename: path.basename(filename),
      csv_bytes: csvBytes,
      csv_bytes_length: csvBytes.length,
      allow_fallback: input.allow_fallback === true
    }
  };
}

function validateFindings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('FINDINGS_SCHEMA_INVALID');
  }
  const dataset = value.dataset;
  const findings = value.findings;
  const caveats = value.caveats;
  const charts = value.charts;

  const validDataset = dataset && typeof dataset === 'object' &&
    Number.isInteger(dataset.rows) && dataset.rows >= 0 &&
    Number.isInteger(dataset.columns) && dataset.columns >= 0;
  const validFindings = Array.isArray(findings) && findings.every(item =>
    item && typeof item === 'object' &&
    typeof item.title === 'string' && item.title.trim() &&
    typeof item.finding === 'string' && item.finding.trim() &&
    typeof item.evidence === 'string' && item.evidence.trim() &&
    IMPORTANCE.has(item.importance)
  );
  const validCaveats = Array.isArray(caveats) && caveats.every(item => typeof item === 'string');
  const validCharts = Array.isArray(charts) && charts.every(item =>
    item && typeof item === 'object' &&
    typeof item.file === 'string' && item.file.trim() &&
    typeof item.title === 'string' && item.title.trim() &&
    typeof item.why_it_matters === 'string' && item.why_it_matters.trim()
  );

  if (
    typeof value.question !== 'string' || !value.question.trim() ||
    typeof value.answer !== 'string' || !value.answer.trim() ||
    !validDataset || !validFindings || !validCaveats || !validCharts
  ) {
    return fail('FINDINGS_SCHEMA_INVALID');
  }

  return { ok: true, schema_version: CONTRACT_VERSION, value };
}

function logicalName(value) {
  return path.posix.basename(String(value || '').replace(/\\/g, '/'));
}

function verifyArtifactManifest(manifest = {}) {
  const report = logicalName(manifest.report_pdf);
  const findings = logicalName(manifest.findings_json);
  const bundle = logicalName(manifest.bundle_zip);
  const charts = Array.isArray(manifest.charts) ? manifest.charts : null;

  const chartNamesValid = charts && charts.every((item, index) => {
    const name = logicalName(typeof item === 'string' ? item : item?.file);
    return new RegExp('^chart_\\d{2}\\.png$', 'i').test(name) &&
      Number(name.slice(6, 8)) >= 1 &&
      (index === 0 || true);
  });

  if (
    report !== 'report.pdf' ||
    findings !== 'findings.json' ||
    bundle !== 'results.zip' ||
    !chartNamesValid
  ) {
    return fail('ANALYSIS_ARTIFACTS_INCOMPLETE');
  }

  return {
    ok: true,
    schema_version: CONTRACT_VERSION,
    normalized: {
      report_pdf: manifest.report_pdf,
      findings_json: manifest.findings_json,
      charts,
      bundle_zip: manifest.bundle_zip
    }
  };
}

module.exports = {
  CONTRACT_VERSION,
  DEFAULT_MAX_BYTES,
  MAX_QUESTION_CHARS,
  strictBase64ToBuffer,
  validateAnalysisRequest,
  validateFindings,
  verifyArtifactManifest
};
