'use strict';

// Offline-only contract tests. NO Google Drive API calls, no Booking, no deploy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, 'kk-poster-acl-owner-review-20261013.gs'), 'utf8');
const match = source.match(/const KKACL_EXPECTED=(\[[^\n]+\]);/);
assert.ok(match, 'A pinned exact file ID manifest is required');
const expected = JSON.parse(match[1]);
assert.equal(expected.length, 35);
const folderIDs = [
  '1avy3Up3NJskqB7kCzQoQPWKK3-j1qJqS',
  '1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw',
  '1uIfM-KV6FrJRQIP0ZNso7-ibZiSo1nwQ',
  '1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl'
];

function fixture(opts = {}) {
  const roles = Object.create(null);
  const nodes = new Map();
  let writes = 0;
  function node(id, folder = false) {
    const out = {
      getId: () => id,
      getMimeType: () => 'image/jpeg',
      getSharingAccess: () => 'ANYONE_WITH_LINK',
      getSharingPermission: () => roles[id] || 'EDIT',
      setSharing: (access, role) => {
        assert.equal(access, 'ANYONE_WITH_LINK');
        assert.equal(role, 'VIEW');
        if (opts.failID === id) throw new Error('permission update rejected');
        writes++;
        roles[id] = role;
      }
    };
    if (folder) {
      out.files = [];
      out.folders = [];
      out.getFiles = () => {
        let n = 0;
        return {hasNext: () => n < out.files.length, next: () => out.files[n++]};
      };
      out.getFolders = () => {
        let n = 0;
        return {hasNext: () => n < out.folders.length, next: () => out.folders[n++]};
      };
    }
    nodes.set(id, out);
    return out;
  }

  const [brand, legacy, kit, newer] = folderIDs.map(id => node(id, true));
  brand.folders.push(legacy, kit);
  brand.files.push(node('brand-logo'));
  kit.files.push(node('kit-photo-a'), node('kit-photo-b'));
  legacy.files.push(...expected.slice(0, 29).map(id => node(id)));
  newer.files.push(...expected.slice(29).map(id => node(id)));
  if (opts.missingActive) legacy.files.shift();
  if (opts.unexpectedRole) roles[expected[0]] = 'COMMENT';

  const refs = [...expected, ...expected.slice(0, 9)];
  const core = refs.map((id, i) => [
    'EVT-' + i, 'Example event', '21/10/2026', '',
    'https://drive.google.com/thumbnail?id=' + id
  ]);
  for (let i = core.length; i < 76; i++) {
    core.push(['EVT-' + i, 'Example event', '21/10/2026', '', 'https://images.example.test/poster.jpg']);
  }
  // A past-September public-card reference may be owner-private; do NOT scan it
  // or accidentally upgrade it to public Reader just to make the repair pass.
  if (opts.pastSeptemberPrivate) {
    core.push(['EVT-SEPT-PRIVATE', 'Past event', '28/09/2026', '',
      'https://drive.google.com/thumbnail?id=PAST_OWNER_PRIVATE']);
  }
  if (opts.extraCard) {
    core.push(['EVT-EXTRA', 'Extra event', '21/10/2026', '', 'https://images.example.test/extra.jpg']);
  }
  const web = core.map(row => [
    row[0], '', row[2], '',
    opts.imageMismatch && row[0] === core[0][0] ? 'https://images.example.test/wrong.jpg' : row[4],
    '', '', '', '', 'show'
  ]);

  const SpreadsheetApp = {
    openById: () => ({
      getSheetByName: name => {
        const rows = name === '01_Events' ? core : web;
        return {
          getLastRow: () => rows.length + 4,
          getRange: () => ({getDisplayValues: () =>
            rows.map(row => [...row, ...Array(Math.max(0, 10 - row.length)).fill('')])
          })
        };
      }
    })
  };
  const DriveApp = {
    Access: {ANYONE_WITH_LINK: 'ANYONE_WITH_LINK'},
    Permission: {EDIT: 'EDIT', VIEW: 'VIEW'},
    getFolderById: id => {
      const folder = nodes.get(id);
      assert.ok(folder, 'Unexpected folder');
      return folder;
    }
  };
  const Utilities = {
    DigestAlgorithm: {SHA_256: 'SHA_256'},
    computeDigest: (_algorithm, text) => Array.from(
      crypto.createHash('sha256').update(text, 'utf8').digest(),
      n => n > 127 ? n - 256 : n
    )
  };
  const sandbox = {SpreadsheetApp, DriveApp, Utilities, Logger: {log: () => {}}};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {timeout: 2000});
  const api = vm.runInContext(
    '({dry:kkAclDryRun_20261013, apply:kkAclApply_20261013, owner:kkAclOwnerApprovedApply_20261013})',
    sandbox
  );
  return {api, getWrites: () => writes, roles, nodes};
}

test('dry run discovers 76 Oct-Dec visible / 44 references / 35 unique without writing', () => {
  const f = fixture();
  const r = f.api.dry();
  assert.equal(r.active_files, 35);
  assert.equal(r.scoped_files, 38);
  assert.equal(r.folders, 4);
  assert.equal(r.public_writer, 42);
  assert.equal(f.getWrites(), 0);
});

test('private September reference excluded without weakening active repair guard', () => {
  const f = fixture({pastSeptemberPrivate: true});
  const dry = f.api.dry();
  assert.equal(dry.active_files, 35);
  assert.equal(dry.public_writer, 42);
  assert.equal(f.getWrites(), 0);
});

test('owner UI cannot write with fingerprint placeholder', () => {
  const f = fixture();
  assert.throws(() => f.api.owner(), /OWNER_APPROVAL_NOT_SUPPLIED/);
  assert.equal(f.getWrites(), 0);
});

test('invalid and stale fingerprint cannot write', () => {
  const f = fixture();
  assert.throws(() => f.api.apply('invalid'), /FINGERPRINT_REQUIRED/);
  assert.throws(() => f.api.apply('a'.repeat(64)), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  assert.equal(f.getWrites(), 0);
});

test('source-of-truth card drift aborts before writing', () => {
  const f = fixture({extraCard: true});
  assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('Core/WebReady image mismatch aborts before writing', () => {
  const f = fixture({imageMismatch: true});
  assert.throws(() => f.api.dry(), /IMAGE_READBACK_DIVERGED/);
  assert.equal(f.getWrites(), 0);
});

test('unexpected ACL role aborts before writing', () => {
  const f = fixture({unexpectedRole: true});
  assert.throws(() => f.api.dry(), /UNEXPECTED_SHARING_ACCESS/);
  assert.equal(f.getWrites(), 0);
});

test('active file missing from scanned tree aborts before writing', () => {
  const f = fixture({missingActive: true});
  assert.throws(() => f.api.dry(), /ACTIVE_DRIVE_IMAGE_OUTSIDE_KK_ASSET_TREES/);
  assert.equal(f.getWrites(), 0);
});

test('approved repair downgrades mock folder and poster ACLs and readbacks', () => {
  const f = fixture();
  const dry = f.api.dry();
  const r = f.api.apply(dry.fingerprint);
  assert.equal(r.ok, true);
  assert.equal(r.reader_verified, 42);
  assert.equal(f.getWrites(), 42);
  assert.ok(Object.values(f.roles).every(role => role === 'VIEW'));
  assert.throws(() => f.api.apply(dry.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
});

test('provider write failure is partial and never reported as success', () => {
  const f = fixture({failID: expected[4]});
  const dry = f.api.dry();
  assert.throws(() => f.api.apply(dry.fingerprint), /PARTIAL_OR_DRIFTED_ACL_REPAIR/);
  assert.ok(f.getWrites() > 0, 'partial updates must be detected, not rolled back to Writer');
});
