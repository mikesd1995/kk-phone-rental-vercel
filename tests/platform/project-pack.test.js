'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Pack = require('../../platform/project-pack.js');
const root = path.resolve(__dirname, '../..');
const packDirectory = path.join(root, 'project-packs/kk-phone-rental');
const fixture = () => Object.fromEntries(['project', 'policy', 'agents'].map(name =>
  [name, JSON.parse(fs.readFileSync(path.join(packDirectory, `${name}.json`), 'utf8'))]));

test('reference pack loads as immutable local metadata with every activation OFF', () => {
  const pack = Pack.loadProjectPack(packDirectory, { repositoryRoot: root });
  assert.equal(pack.project.project_pack_version, '0.1.0');
  assert.equal(pack.project.environment, 'local');
  assert.deepEqual(Object.values(pack.project.feature_flags), Pack.FLAG_NAMES.map(() => false));
  assert.deepEqual(pack.policy.allow_capabilities, []);
  assert.equal(Object.isFrozen(pack.agents.definitions[0]), true);
  assert.throws(() => { pack.project.feature_flags.agent_runtime = true; }, TypeError);
});

test('unknown and missing pack versions fail closed without migration', () => {
  const mutations = [
    p => { p.project.schema_version = 2; },
    p => { delete p.project.versions.policy; },
    p => { p.project.project_pack_version = 'latest'; },
    p => { p.project.versions.workflow = '*'; },
    p => { p.policy.policy_version = '0.2.0'; },
    p => { p.agents.definitions[0].version = '0.2.0'; },
    p => { p.project.unknown_activation = true; }
  ];
  for (const mutate of mutations) {
    const pack = fixture(); mutate(pack);
    assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
  }
});

test('pack scope and permission cannot grant cross-project or higher authority', () => {
  const mutations = [
    p => { p.policy.project_id = 'another-project'; },
    p => { p.agents.workspace_id = 'another-workspace'; },
    p => { delete p.project.project_id; },
    p => { p.project.permission_ceiling = 'P5'; },
    p => { p.policy.permission_ceiling = 'P6'; },
    p => { p.agents.definitions[0].permission_ceiling = 'P5'; },
    p => { p.project.permission_ceiling = 'P2'; },
    p => { p.policy.allow_capabilities.push('production.write'); }
  ];
  for (const mutate of mutations) {
    const pack = fixture(); mutate(pack);
    assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
  }
});

test('activation, provider selection and nonlocal environments require a future schema change', () => {
  for (const flag of Pack.FLAG_NAMES) {
    for (const value of [true, 'false', null, 0]) {
      const pack = fixture(); pack.project.feature_flags[flag] = value;
      assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
    }
  }
  const mutations = [
    p => { p.project.environment = 'production'; },
    p => { p.project.phase = 'phase1'; },
    p => { p.agents.definitions[0].execution_enabled = true; },
    p => { p.agents.definitions[0].provider = 'external-provider'; },
    p => { p.agents.definitions[0].model_id = 'external-model'; },
    p => { p.policy.production_authority = true; }
  ];
  for (const mutate of mutations) {
    const pack = fixture(); mutate(pack);
    assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
  }
});

test('pack references cannot traverse paths, load URLs or claim ambiguous revisions', () => {
  for (const candidate of ['../private.json', '/platform/runtime.js', 'C:\\private.json',
    'https://example.com/a.js', 'file:///etc/passwd', '.agents/../secret', 'platform//runtime.js']) {
    const pack = fixture(); pack.project.references.skills[0].path = candidate;
    assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
  }
  const pack = fixture(); pack.project.references.skills[0].revision = 'main';
  assert.throws(() => Pack.validateProjectPack(pack), { code: 'PROJECT_PACK_INVALID' });
});

test('loader refuses outside repository and oversized JSON without executing anything', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-pack-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  assert.throws(() => Pack.loadProjectPack(packDirectory, { repositoryRoot: temporary }), { code: 'PROJECT_PACK_INVALID' });
  fs.writeFileSync(path.join(temporary, 'project.json'), ' '.repeat(65537));
  assert.throws(() => Pack.loadProjectPack(temporary, { repositoryRoot: temporary }), { code: 'PROJECT_PACK_INVALID' });
});

test('pack validation refuses accessor execution, toJSON hooks and excessive payloads', () => {
  let invoked = false;
  const accessor = fixture();
  Object.defineProperty(accessor.project, 'name', { enumerable: true, get() { invoked = true; return 'injected'; } });
  assert.throws(() => Pack.validateProjectPack(accessor), { code: 'PROJECT_PACK_INVALID' });
  assert.equal(invoked, false);
  const hooked = fixture(); hooked.project.toJSON = () => { invoked = true; return {}; };
  assert.throws(() => Pack.validateProjectPack(hooked), { code: 'PROJECT_PACK_INVALID' });
  assert.equal(invoked, false);
  const large = fixture(); large.project.name = 'x'.repeat(65537);
  assert.throws(() => Pack.validateProjectPack(large), { code: 'PROJECT_PACK_INVALID' });
});
