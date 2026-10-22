'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const file=path.resolve(__dirname,'../.github/workflows/ultra-deep-v2-acceptance.yml');
const contents=()=>fs.readFileSync(file,'utf8');
const sourceGuard=[
 'set -euo pipefail',
 'test "$(git rev-parse HEAD)" = "$APPROVED_SHA"',
 "node - <<'SOURCE_ONLY_NODE'",
 "const fs = require('node:fs');",
 "if (fs.existsSync('node_modules') || fs.existsSync('npm-shrinkwrap.json')) throw new Error('SOURCE_ONLY_DEPENDENCY_TREE_OR_SHRINKWRAP_FORBIDDEN');",
 "if (fs.existsSync('package-lock.json')) JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));",
 'SOURCE_ONLY_NODE',
 'echo "Source only: lockfile is inert; no dependency tree, installs, lifecycle hooks or provider calls."'
].join('\n');
function runBlocks(source){
 const lines=source.split(/\r?\n/),blocks=[];
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(/^(\s*)(-\s+)?run:\s*(.*)$/);if(!match)continue;
  const indent=match[1].length+(match[2]?match[2].length:0),body=[];
  while(i+1<lines.length){const next=lines[i+1];if(next.trim()&&next.match(/^\s*/)[0].length<=indent)break;i++;body.push(next.slice(indent+2));}
  blocks.push((match[3]==='|'?body.join('\n'):[match[3],...body].join('\n')).trimEnd());
 }
 return blocks;
}
function assertSourceOnlyCommands(source){
 const allowed=new Set([sourceGuard,
  'node --test tests/ci-ultra-deep-v2-workflow-safety.test.js',
  'npm run check',
  'node --test tests/kk-ultra-deep-full-loop-v2.test.js',
  'node --test tests/kk-ultra-deep-*.test.js tests/kk-public-event-detail-followup.test.js tests/kk-onebangkok-event-detail.test.js tests/kk-knownmiss-identity-boundary.test.js tests/kk-public-search-availability.test.js',
  'npm run test:ultradeep:recall']);
 const blocks=runBlocks(source);assert.equal(blocks.length,6);
 for(const block of blocks)assert.ok(allowed.has(block),'non-source-only workflow command: '+block);
}
function executeGuardFixture(prepare){
 const guard=runBlocks(contents()).find(block=>block.includes('SOURCE_ONLY_NODE'));
 assert.ok(guard,'executable source-only dependency guard missing');
 const match=guard.match(/node - <<'SOURCE_ONLY_NODE'\n([\s\S]+)\nSOURCE_ONLY_NODE/);assert.ok(match);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-ultradeep-zero-install-'));
 try{prepare(dir);return spawnSync(process.execPath,['-e',match[1]],{cwd:dir,encoding:'utf8'});}finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('CI keeps SHA-pinned checkout and read-only GitHub token',()=>{
 const s=contents();
 assert.match(s,/APPROVED_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(s,/ref:\s*\$\{\{ env\.APPROVED_SHA \}\}/);
 assert.match(s,/persist-credentials:\s*false/);
 assert.match(s,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
 assert.match(s,/permissions:\s*\n\s+contents:\s*read/);
});
test('no executable npm ci/npm install or network package install in source-only CI',()=>{
 const s=contents();
 assertSourceOnlyCommands(s);
 assert.match(s,/npm_config_offline:\s*'true'/);
 assert.match(s,/npm_config_ignore_scripts:\s*'true'/);
});

test('source-only guard accepts this PR lockfile without installing any dependency',()=>{
 const result=executeGuardFixture(dir=>fs.copyFileSync(path.resolve(__dirname,'../package-lock.json'),path.join(dir,'package-lock.json')));
 assert.equal(result.status,0,result.stderr);
});

test('source-only guard still rejects an installed dependency tree or shrinkwrap',()=>{
 for(const entry of ['node_modules','npm-shrinkwrap.json']){
  const result=executeGuardFixture(dir=>{if(entry==='node_modules')fs.mkdirSync(path.join(dir,entry));else fs.writeFileSync(path.join(dir,entry),'{}');});
  assert.notEqual(result.status,0,entry);assert.match(result.stderr,/SOURCE_ONLY_DEPENDENCY_TREE_OR_SHRINKWRAP_FORBIDDEN/);
 }
});

test('source-only guard rejects malformed lockfile metadata without executing it',()=>{
 const result=executeGuardFixture(dir=>fs.writeFileSync(path.join(dir,'package-lock.json'),'not valid JSON'));
 assert.notEqual(result.status,0);assert.match(result.stderr,/SyntaxError/);
});

test('workflow command contract rejects chained, lifecycle, package and provider network commands',()=>{
 for(const command of ['npm run check && npm ci','npm run check; curl https://api.telegram.org','npm run check\n          npm install','npm run precheck','npx --yes typescript','node -e "fetch(\'https://api.line.me\')"']){
  assert.throws(()=>assertSourceOnlyCommands(contents().replace('run: npm run check','run: '+command)),/non-source-only workflow command|strictly equal/);
 }
});

test('workflow command contract rejects appended compact YAML execution steps',()=>{
 for(const step of ['      - run: npm ci','      - run: curl https://api.telegram.org','      - run: npm run check && curl https://api.line.me','      - run: |\n          npm run check\n          npm install','      - run: >\n          npm run check;\n          curl https://api.telegram.org']){
  assert.throws(()=>assertSourceOnlyCommands(contents()+'\n'+step+'\n'),/non-source-only workflow command|strictly equal/,step);
 }
});

test('compact safe run steps retain the same command and multiline guard boundaries',()=>{
 const compact=contents().replace(/\r\n/g,'\n').replace('      - name: Syntax gate (source-only)\n        run: npm run check','      - run: npm run check')
  .replace('      - name: Require exact SHA and zero-install source contract\n        shell: bash\n        run: |','      - run: |');
 assert.ok(compact.includes('      - run: npm run check'));assert.ok(compact.includes('      - run: |'));
 assertSourceOnlyCommands(compact);
});
test('source-only exact V2 regression and existing syntax check remain mandatory',()=>{
 const s=contents();
 assert.match(s,/run:\s*npm run check/);
 assert.match(s,/run:\s*node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js/);
 assert.match(s,/runs-on:\s*ubuntu-latest/);
 assert.match(s,/node-version:\s*'20'/);
});
test('cancel superseded PR head jobs to save included free runner minutes',()=>{
 const s=contents();
 assert.match(s,/concurrency:\s*\n\s*group:/);
 assert.match(s,/cancel-in-progress:\s*true/);
 assert.match(s,/timeout-minutes:\s*10/);
});
test('workflow source and contract test itself trigger checks on future PR changes',()=>{
 const s=contents();
 assert.match(s,/'\.github\/workflows\/ultra-deep-v2-acceptance\.yml'/);
 assert.match(s,/'tests\/ci-ultra-deep-v2-workflow-safety\.test\.js'/);
 assert.match(s,/on:\s*\n\s*workflow_dispatch:/);
 assert.match(s,/pull_request:\s*\n\s*paths:/);
});
test('contract test is wired into CI and cannot be skipped by only running V2 test',()=>{
 const s=contents();
 assert.match(s,/node --test tests\/ci-ultra-deep-v2-workflow-safety\.test\.js/);
});

test('detail-only and regression-only changes trigger and execute the added safety guards',()=>{
 const s=contents();
 for(const file of ['server/kk-public-event-detail-followup.js','server/kk-onebangkok-event-detail.js','tests/kk-ultra-deep-*.test.js','tests/kk-public-event-detail-followup.test.js','tests/kk-onebangkok-event-detail.test.js','tests/kk-knownmiss-identity-boundary.test.js','tests/kk-public-search-availability.test.js']){
  assert.ok(s.includes("'"+file+"'"),'missing PR path trigger: '+file);
 }
 const commands=s.split(/\r?\n/).filter(line=>/^\s*run:\s*node --test /.test(line)).join('\n');
 for(const file of ['tests/kk-ultra-deep-*.test.js','tests/kk-public-event-detail-followup.test.js','tests/kk-onebangkok-event-detail.test.js','tests/kk-knownmiss-identity-boundary.test.js','tests/kk-public-search-availability.test.js']){
  assert.ok(commands.includes(file),'missing executed safety suite: '+file);
 }
});
