'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function walk(root) {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', shell: false });
      if (result.error || result.status !== 0) process.exit(1);
    }
  }
}
walk(path.join(__dirname, '..', 'platform'));
walk(path.join(__dirname, '..', 'tests', 'platform'));
for (const name of ['run-kk-ops-public.js','run-kk-ops-advisory.js']) {
  const result=spawnSync(process.execPath,['--check',path.join(__dirname,name)],{stdio:'inherit',shell:false});
  if(result.error||result.status!==0)process.exit(1);
}
console.log('Phase-0 syntax validation complete');
