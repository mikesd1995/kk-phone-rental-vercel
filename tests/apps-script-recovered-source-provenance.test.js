'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'apps-script', 'Code.gs');
const recoveredPath = path.join(root, 'apps-script', 'recovered', 'Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs');
const deployReadmePath = path.join(root, 'DEPLOY_README.txt');

test('recovered Apps Script 9_5_9 artifact stays byte-identical to proven deployment-recovery evidence', () => {
  const bytes = fs.readFileSync(recoveredPath);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(bytes.length, 118157);
  assert.equal(hash, '40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e');
  assert.match(bytes.toString('utf8'), /v16\.7\.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX/);
});

test('recovered artifact is evidence only and cannot silently replace the guarded canonical source', () => {
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  const recovered = fs.readFileSync(recoveredPath, 'utf8');
  const deployReadme = fs.readFileSync(deployReadmePath, 'utf8');

  assert.notEqual(canonical, recovered, 'canonical Code.gs must not silently become the raw recovered artifact');
  assert.match(canonical, /ownerReopenIntent/);
  assert.match(canonical, /EVENT_VISIBILITY_OWNER_LOCKED/);
  assert.match(canonical, /explicit_owner_reopen/);

  assert.match(deployReadme, /archival evidence, not a deployment candidate/i);
  assert.match(deployReadme, /DEPLOYMENT EQUIVALENCE|deployment equivalence/i);
});
