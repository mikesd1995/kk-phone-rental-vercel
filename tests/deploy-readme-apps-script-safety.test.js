const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const deployReadme = fs.readFileSync(path.join(root, 'DEPLOY_README.txt'), 'utf8');
const codeGs = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');

test('deploy instructions fail closed while repo Apps Script trails production', () => {
  assert.match(
    codeGs,
    /v16\.7\.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX/,
    'guard must be revisited when repository Apps Script version changes'
  );

  assert.match(deployReadme, /Production audit reports v16\.7\.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX/);
  assert.match(deployReadme, /DO NOT replace the production Apps Script Code\.gs with apps-script\/Code\.gs/);
  assert.match(deployReadme, /issue #9/i);
  assert.match(deployReadme, /exact source recovery or independently proven source equivalence/i);

  assert.doesNotMatch(
    deployReadme,
    /^\s*2\.\s*Replace Code\.gs with apps-script\/Code\.gs from this package\.\s*$/m,
    'retired destructive deployment instruction must not return'
  );
});
