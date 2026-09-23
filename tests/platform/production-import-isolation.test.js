'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function imports(source, filename) {
  const found = [];
  for (const match of source.matchAll(/\b(?:require(?:\.resolve)?|import)\s*\(([^)]*)\)/g)) {
    const literal = match[1].trim().match(/^(['"`])([^'"`\r\n]*)\1$/);
    assert.ok(literal && !literal[2].includes('${'), `Unresolved dynamic import in ${filename}`);
    found.push(literal[2]);
  }
  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^;\r\n]*?\s+from\s+)?(['"])([^'"\r\n]+)\1/g)) {
    found.push(match[2]);
  }
  return found;
}

function scanGraph(root, entries) {
  const seen = new Set();
  const pending = entries.slice();
  while (pending.length) {
    const file = path.resolve(pending.pop());
    if (seen.has(file)) continue;
    seen.add(file);
    const relative = path.relative(root, file).replaceAll('\\', '/');
    assert.ok(!/^(?:platform|project-packs)(?:\/|$)/.test(relative), `Phase 0 production import: ${relative}`);
    assert.ok(!relative.startsWith('../') && !path.isAbsolute(relative), `Import escapes repository: ${relative}`);
    if (file.endsWith('.json')) continue;
    for (const dependency of imports(fs.readFileSync(file, 'utf8'), relative)) {
      assert.ok(!/^(?:platform|project-packs)(?:\/|$)/.test(dependency), `Phase 0 package alias: ${dependency}`);
      if (!dependency.startsWith('.') && !path.isAbsolute(dependency)) continue;
      const target = path.resolve(path.dirname(file), dependency);
      const resolved = [target, `${target}.js`, `${target}.cjs`, `${target}.mjs`, `${target}.json`,
        path.join(target, 'index.js')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `Unresolved repository import: ${relative} -> ${dependency}`);
      pending.push(fs.realpathSync(resolved));
    }
  }
  return seen;
}

function scriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? scriptFiles(filename) : /\.(?:[cm]?js)$/.test(filename) ? [filename] : [];
  });
}

test('production and legacy server import graph excludes all Phase 0 modules and Project Packs', () => {
  const root = path.resolve(__dirname, '../..');
  const entries = ['api', 'admin', 'cloudflare', 'server'].flatMap(name => scriptFiles(path.join(root, name)));
  entries.push(path.join(root, 'script.js'));
  assert.ok(scanGraph(root, entries).size >= entries.length);
});

test('isolation barrier catches transitive imports and Project Pack JSON loads', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-import-graph-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['api', 'shared', 'platform', 'project-packs']) fs.mkdirSync(path.join(root, dir));
  fs.writeFileSync(path.join(root, 'api/entry.js'), "require('../shared/bridge');\n");
  fs.writeFileSync(path.join(root, 'platform/runtime.js'), 'module.exports = {};');
  fs.writeFileSync(path.join(root, 'project-packs/project.json'), '{}');
  for (const source of ["module.exports = require('../platform/runtime');",
    "export { run } from '../platform/runtime.js';",
    "import('../project-packs/project.json');"] ) {
    fs.writeFileSync(path.join(root, 'shared/bridge.js'), source);
    assert.throws(() => scanGraph(root, [path.join(root, 'api/entry.js')]), /Phase 0 production import/);
  }
});

test('unresolvable computed runtime import fails isolation review closed', () => {
  for (const source of ["require('../' + target);", 'import(runtimePath);', 'require(`../${target}`);']) {
    assert.throws(() => imports(source, 'fixture.js'), /Unresolved dynamic import/);
  }
});
