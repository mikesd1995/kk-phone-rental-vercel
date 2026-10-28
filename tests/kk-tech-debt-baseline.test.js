'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Auditor = require('../scripts/kk-tech-debt-baseline.cjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-tech-debt-'));
  const files = {
    'script.js': 'window.app = "safe";\n',
    'admin/admin.js': 'const ready = true;\n',
    'apps-script/Code.gs': 'function ownerOnly() { return true; }\n',
    'api/kk-data.js': 'const gviz = "gviz/tq";\n',
    'server/admin-sheet-fallback.js': 'const old = "gviz/tq";\n',
    'config.js': 'window.KK_CONFIG={publicDataMode:"api-only",disableDirectFallback:true,useVercelApi:true};\n',
    'package.json': JSON.stringify({scripts:{test:'node --test',check:'node --check script.js'}})
  };
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), {recursive:true});
    fs.writeFileSync(full, contents);
  }
  return {dir,files,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function withFixture(fn) {
  const f = fixture();
  try {return fn(f);} finally {f.cleanup();}
}
function baseline(s) {return {schema_version:1,inspected_main_sha:'synthetic-only',snapshot:s};}
function mutated(s) {return JSON.parse(JSON.stringify(s));}

test('snapshot captures aggregate sizes, known legacy reader counts and explicit browser guards',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  assert.equal(s.modules['script.js'].lines,2);
  assert.equal(s.legacy_public_gviz['api/kk-data.js'],1);
  assert.equal(s.legacy_public_gviz['server/admin-sheet-fallback.js'],1);
  assert.deepEqual(s.browser,{api_only:true,direct_fallback_disabled:true,uses_server_api:true,direct_sheets_urls:0});
  assert.equal(s.tooling.npm_scripts,2);
  assert.equal(s.tooling.has_test_script,true);
}));
test('known existing debt does not cause false regression failure',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  assert.equal(Auditor.compare(s,baseline(s)).ok,true);
}));
test('removing each public-data browser guard is a regression',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  for (const key of ['api_only','direct_fallback_disabled','uses_server_api']) {
    const change=mutated(s);change.browser[key]=false;
    assert.ok(Auditor.compare(change,baseline(s)).findings.some(f=>f.id==='BROWSER_PRIVATE_DATA_GUARD_REMOVED'));
  }
}));
test('new direct browser Google Sheets URL is blocked',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir),change=mutated(s);
  change.browser.direct_sheets_urls++;
  assert.equal(Auditor.compare(change,baseline(s)).findings[0].id,'BROWSER_DIRECT_SHEETS_URL_ADDED');
}));
test('new legacy public GViz reference in either server reader is blocked',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  for(const file of Auditor.LEGACY_PUBLIC_READERS){
    const c=mutated(s);c.legacy_public_gviz[file]++;
    assert.ok(Auditor.compare(c,baseline(s)).findings.some(x=>x.id==='LEGACY_PUBLIC_GVIZ_REFERENCE_ADDED'));
  }
}));
test('small hotspot edits are permitted, >200-line growth is detected',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir),small=mutated(s),large=mutated(s);
  small.modules['script.js'].lines+=200;
  large.modules['script.js'].lines+=201;
  assert.equal(Auditor.compare(small,baseline(s)).ok,true);
  assert.equal(Auditor.compare(large,baseline(s)).findings[0].id,'LARGE_MODULE_GROWTH');
}));
test('large npm script additions and removed test command are caught',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir),c=mutated(s);
  c.tooling.npm_scripts+=11;c.tooling.has_test_script=false;
  const ids=Auditor.compare(c,baseline(s)).findings.map(x=>x.id);
  assert.deepEqual(ids,['BUILD_SCRIPT_PROLIFERATION','TEST_ENTRYPOINT_REMOVED']);
}));
test('false alarm when known legacy GViz is removed',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir),c=mutated(s);
  c.legacy_public_gviz['api/kk-data.js']=0;
  assert.equal(Auditor.compare(c,baseline(s)).ok,true);
}));
test('fail closed when baseline schema mismatches',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  assert.throws(()=>Auditor.compare(s,{}),/TECH_DEBT_BASELINE_INVALID/);
  assert.throws(()=>Auditor.compare(s,{schema_version:1,snapshot:{schema_version:9}}),/TECH_DEBT_BASELINE_INVALID/);
}));
test('fail closed when required source is missing',()=>withFixture(({dir})=>{
  fs.unlinkSync(path.join(dir,'config.js'));
  assert.throws(()=>Auditor.snapshot(dir),/ENOENT/);
}));
test('no dynamic source paths: allowlist has only repository-relative paths',()=>{
  assert.equal(new Set(Auditor.REQUIRED_FILES).size,Auditor.REQUIRED_FILES.length);
  assert.ok(Auditor.REQUIRED_FILES.every(f=>!f.startsWith('/')&&!f.includes('..')));
});
test('run returns only aggregate metrics and supports check without network',()=>withFixture(({dir})=>{
  const s=Auditor.snapshot(dir);
  const file=path.join(dir,Auditor.BASELINE_PATH);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(baseline(s)));
  const old=process.stdout.write, chunks=[];
  try{
    process.stdout.write=(s)=>{chunks.push(s);return true;};
    assert.equal(Auditor.run(dir,['--check']).status,'NO_NEW_REGRESSION');
  }finally{process.stdout.write=old;}
  assert.equal(chunks.length,1);
  assert.doesNotMatch(chunks[0],/private_key|customer_phone|API_TOKEN/);
}));
