'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE_PATH = path.join(__dirname, '../apps-script/recovered/Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs');
const BASE_SHA256 = '40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e';
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');

// Candidate builder only: never contacts Google or changes editor HEAD/triggers.
function buildCandidate(source = fs.readFileSync(BASE_PATH, 'utf8')) {
  const base = source.replace(/\r\n/g, '\n');
  if (sha256(base) !== BASE_SHA256) throw new Error('BASE_SOURCE_MISMATCH');
  const original = `function kkDateObj_(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + value);
  return d;
}`;
  const replacement = `function kkDateObj_(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const dmy = raw.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/);
  let d;
  if (dmy) {
    const year = Number(dmy[3]), month = Number(dmy[2]), day = Number(dmy[1]);
    d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      throw new Error('Invalid date: ' + value);
    }
  } else {
    d = value instanceof Date ? value : new Date(value);
  }
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + value);
  return d;
}`;
  if (base.split(original).length !== 2) throw new Error('DATE_HELPER_NOT_UNIQUE');
  return base.replace(original, replacement);
}

if (require.main === module) {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node scripts/build-apps-script-date-hotfix.js <new-output.gs>');
  const candidate = buildCandidate();
  fs.writeFileSync(output, candidate, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'LOCAL_CANDIDATE_ONLY', base_sha256: BASE_SHA256, candidate_sha256: sha256(candidate), output }));
}
module.exports = { buildCandidate, BASE_PATH, BASE_SHA256, sha256 };
