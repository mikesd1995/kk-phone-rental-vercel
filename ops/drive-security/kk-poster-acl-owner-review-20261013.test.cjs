'use strict';

// Offline-only contract tests. NO Google Drive API calls, no Booking, no deploy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, 'kk-poster-acl-owner-review-20261013.gs'), 'utf8');
const readOnly = fs.readFileSync(path.join(__dirname, 'kk-poster-acl-READONLY-preflight-20261014.gs'), 'utf8');
const match = source.match(/const KKACL_EXPECTED=(\[[^\n]+\]);/);
assert.ok(match, 'A pinned exact file ID manifest is required');
const expected = JSON.parse(match[1]);
assert.equal(expected.length, 38);
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
  const logs = [];
  function node(id, folder = false) {
    const out = {
      getId: () => id,
      getName: () => 'Mock asset ' + id.slice(-6),
      getMimeType: () => opts.nonImageID === id ? 'application/pdf' : 'image/jpeg',
      getSharingAccess: () => opts.publicDiscoverableID === id ? 'ANYONE' : opts.privateID === id ? 'PRIVATE' : 'ANYONE_WITH_LINK',
      getSharingPermission: () => roles[id] || 'EDIT',
      setSharing: (access, role) => {
        assert.equal(access, 'ANYONE_WITH_LINK');
        assert.equal(role, 'VIEW');
        if (opts.failID === id) throw new Error('permission update rejected');
        writes++;
        roles[id] = role;
        if (opts.folderCascadesToHistory && folder && id === folderIDs[0]) {
          // Simulate an inherited permission side effect on a history item.
          roles['brand-logo'] = role;
        }
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
  if (opts.historicExtras) {
    for (let i = 0; i < opts.historicExtras; i++) {
      legacy.files.push(node('synthetic-historical-' + String(i).padStart(4, '0')));
    }
  }
  newer.files.push(...expected.slice(29).map(id => node(id)));
  if (opts.missingActive) legacy.files.shift();
  if (opts.unexpectedRole) roles[expected[0]] = 'COMMENT';

  const refs = [...expected, ...expected.slice(0, 11)];
  const core = refs.map((id, i) => [
    'EVT-' + i, 'Example event', '21/10/2026', '',
    'https://drive.google.com/thumbnail?id=' + id
  ]);
  // Preserve 38 active unique file IDs while reducing the number of
  // reference uses by one: a stale 48/49 reference manifest must fail closed.
  if (opts.referenceCountDrift) core[refs.length - 1][4] = 'https://images.example.test/replaced-duplicate.jpg';
  for (let i = core.length; i < 89; i++) {
    core.push(['EVT-' + i, 'Example event', '21/10/2026', '', 'https://images.example.test/poster.jpg']);
  }
  // A past-September public-card reference may be owner-private; do NOT scan it
  // or accidentally upgrade it to public Reader just to make the repair pass.
  if (opts.pastSeptemberPrivate) {
    core.push(['EVT-SEPT-PRIVATE', 'Past event', '28/09/2026', '',
      'https://drive.google.com/thumbnail?id=PAST_OWNER_PRIVATE']);
  }
  // A newly verified wrong image must remain blank until official poster proof.
  if (opts.missingArtwork) {
    for (const row of core.slice(refs.length)) row[4] = '';
  }
  if (opts.extraCard) {
    core.push(['EVT-EXTRA', 'Extra event', '21/10/2026', '', 'https://images.example.test/extra.jpg']);
  }
  const web = core.map(row => [
    row[0], '', row[2], '',
    opts.imageMismatch && row[0] === core[0][0] ? 'https://images.example.test/wrong.jpg' : row[4],
    '', '', '', '', 'show'
  ]);
  if (opts.dateMismatch) web[0][2] = '22/10/2026';
  if (opts.visibleWebOrphan) web[0][0] = 'EVT-ORPHAN-VISIBLE-IN-WEB-ONLY';
  if (opts.webMovedIntoScopeFromJan) core[0][2] = '21/01/2027';
  if (opts.hiddenWebOrphan) web.push(['EVT-HIDDEN-ORPHAN', '', '21/10/2026', '', '', '', '', '', '', 'hide']);
  if (opts.duplicateCore) core.push([...core[0]]);
  if (opts.duplicateWeb) web.push([...web[0]]);
  // Also catch duplicate hidden/history rows, not just two visible event cards.
  if (opts.hiddenDuplicateCore) core.push([core[0][0], 'Historical', '28/09/2026', '', '']);
  if (opts.hiddenDuplicateWeb) web.push([web[0][0], '', '28/09/2026', '', '', '', '', '', '', 'hide']);

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
    Access: {ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE', PRIVATE: 'PRIVATE', DOMAIN: 'DOMAIN', DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK'},
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
  const sandbox = {SpreadsheetApp, DriveApp, Utilities, Logger: {log: msg => logs.push(String(msg))}};
  vm.createContext(sandbox);
  vm.runInContext(opts.readOnly ? readOnly : source, sandbox, {timeout: 2000});
  const api = vm.runInContext(
    opts.readOnly
      ? '({dry:kkAclDryRun_20261013, apply:typeof kkAclApply_20261013, owner:typeof kkAclOwnerApprovedApply_20261013})'
      : '({dry:kkAclDryRun_20261013, apply:kkAclApply_20261013, owner:kkAclOwnerApprovedApply_20261013})',
    sandbox
  );
  return {api, getWrites: () => writes, roles, nodes, logs};
}

test('standalone read-only Apps Script matches exact owner script preflight prefix', () => {
  const cut = source.indexOf('// Enter fingerprint only after OWNER has reviewed Dry Run output.');
  assert.ok(cut > 1000);
  assert.ok(readOnly.endsWith(source.slice(0, cut)),
    'all source-of-truth, folder, fingerprint and pagination guards must remain byte identical');
});

test('standalone read-only script has no permission change, trigger or executable apply entrypoint', () => {
  assert.ok(!readOnly.includes('.setSharing('));
  assert.ok(!readOnly.includes('function kkAclApply_'));
  assert.ok(!readOnly.includes('function kkAclOwnerApprovedApply_'));
  assert.ok(!readOnly.includes('ScriptApp.'));
  assert.ok(readOnly.includes('SpreadsheetApp.openById(KKACL_BOOK)'));
});

test('standalone read-only preflight audits complete mocked current scope without ACL writes', () => {
  const f = fixture({readOnly: true});
  const r = f.api.dry();
  assert.equal(r.active_files, 38);
  assert.equal(r.scoped_files, 41);
  assert.equal(r.folders, 4);
  assert.equal(r.public_writer, 45);
  assert.equal(f.api.apply, 'undefined');
  assert.equal(f.api.owner, 'undefined');
  assert.equal(f.getWrites(), 0);
});

test('standalone owner-only Apps Script uses openById; no bound spreadsheet or trigger dependency', () => {
  assert.ok(source.includes('SpreadsheetApp.openById(KKACL_BOOK)'));
  assert.ok(!source.includes('SpreadsheetApp.getActiveSpreadsheet('));
  assert.ok(!source.includes('ScriptApp.newTrigger('));
  assert.ok(!source.includes('function doGet('));
  assert.ok(!source.includes('function doPost('));
});

test('dry run discovers 89 Oct-Dec visible / 49 references / 38 unique without writing', () => {
  const f = fixture();
  const r = f.api.dry();
  assert.equal(r.active_files, 38);
  assert.equal(r.scoped_files, 41);
  assert.equal(r.folders, 4);
  assert.equal(r.public_writer, 45);
  assert.equal(f.getWrites(), 0);
});

test('dry run prints complete asset scope with paged provenance, without editing', () => {
  const f = fixture();
  const summary = f.api.dry();
  assert.equal(summary.scoped_items, 45);
  assert.equal(summary.active_public_writer, 38);
  assert.equal(summary.other_public_writer, 7);
  assert.equal(summary.historical_images, 3);
  assert.equal(f.logs.length, 4, 'summary and 3 detail pages with 20,20,6 items');
  const pages = f.logs.slice(1).map(JSON.parse);
  assert.deepEqual(pages.map(x => x.items.length), [20, 20, 6]);
  assert.equal(pages.flatMap(x => x.items).filter(x => x.active_poster).length, 38);
  assert.ok(pages.flatMap(x => x.items).every(x => x.name.startsWith('Mock asset ')));
  assert.ok(pages.flatMap(x => x.items).every(x => x.id_suffix.length === 6));
  assert.equal(f.getWrites(), 0);
});

test('private September reference excluded without weakening active repair guard', () => {
  const f = fixture({pastSeptemberPrivate: true});
  const dry = f.api.dry();
  assert.equal(dry.active_files, 38);
  assert.equal(dry.public_writer, 45);
  assert.equal(f.getWrites(), 0);
});

test('nine missing official posters do not widen the Drive ACL repair scope', () => {
  const f = fixture({missingArtwork: true});
  const result = f.api.dry();
  assert.equal(result.active_files, 38);
  assert.equal(result.scoped_files, 41);
  assert.equal(result.public_writer, 45);
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

test('49-to-48 thumbnail reference drift stops before any permissions write, even with same 38 file IDs', () => {
  const f = fixture({referenceCountDrift: true});
  assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('source-of-truth card drift aborts before writing', () => {
  const f = fixture({extraCard: true});
  assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('visible WebReady row without canonical Core event is never silently left outside ACL scope', () => {
  for (const readOnly of [true, false]) {
    const f = fixture({visibleWebOrphan: true, readOnly});
    assert.throws(() => f.api.dry(), /SCOPED_VISIBLE_WEB_ORPHAN/);
    assert.equal(f.getWrites(), 0);
    if (!readOnly) {
      assert.throws(() => f.api.apply('0'.repeat(64)), /SCOPED_VISIBLE_WEB_ORPHAN/);
      assert.equal(f.getWrites(), 0);
    }
  }
});

test('WebReady cannot move a January Core event into visible October ACL scope', () => {
  for (const readOnly of [true, false]) {
    const f = fixture({webMovedIntoScopeFromJan: true, readOnly});
    assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_EVENT_DATE_DIVERGED/);
    assert.equal(f.getWrites(), 0);
  }
});

test('hidden WebReady-only historical row does not widen active poster repair', () => {
  const f = fixture({hiddenWebOrphan: true, readOnly: true});
  assert.equal(f.api.dry().active_files, 38);
  assert.equal(f.getWrites(), 0);
});

test('Core/WebReady active event date mismatch aborts ACL dry run and apply before any writes', () => {
  for(const readOnly of [true, false]) {
    const f = fixture({dateMismatch: true, readOnly});
    assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_EVENT_DATE_DIVERGED/);
    assert.equal(f.getWrites(), 0);
    if(!readOnly) {
      assert.throws(() => f.api.apply('0'.repeat(64)), /SCOPED_ACTIVE_EVENT_DATE_DIVERGED/);
      assert.equal(f.getWrites(), 0);
    }
  }
});

test('Core/WebReady image mismatch aborts before writing', () => {
  const f = fixture({imageMismatch: true});
  assert.throws(() => f.api.dry(), /IMAGE_READBACK_DIVERGED/);
  assert.equal(f.getWrites(), 0);
});

test('duplicate IDs in either canonical or generated source fail before owner ACL writes', () => {
  for (const option of [{duplicateCore: true}, {duplicateWeb: true}]) {
    for (const readOnly of [false, true]) {
      const f = fixture({...option, readOnly});
      assert.throws(() => f.api.dry(), /DUPLICATE_EVENT_ID_IN_ACTIVE_SOT/);
      assert.equal(f.getWrites(), 0);
    }
  }
});

test('hidden historic duplicate IDs in either source still block owner and read-only flows', () => {
  for (const option of [{hiddenDuplicateCore: true}, {hiddenDuplicateWeb: true}]) {
    for (const readOnly of [false, true]) {
      const f = fixture({...option, readOnly});
      assert.throws(() => f.api.dry(), /DUPLICATE_EVENT_ID_IN_ACTIVE_SOT/);
      assert.equal(f.getWrites(), 0);
    }
  }
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

test('active image-only owner batches 25+13; all four folders and historical writers remain on HOLD', () => {
  const f = fixture();
  const dry = f.api.dry();
  const first = f.api.apply(dry.fingerprint);
  assert.equal(first.ok, false, 'must never claim success while writers remain');
  assert.equal(first.partial, true);
  assert.equal(first.updated, 25);
  assert.equal(first.remaining_writers, 21);
  assert.equal(first.need_new_owner_dry_run, true);
  assert.equal(f.getWrites(), 25);
  // Never touch a parent folder (inherited historic ACL blast radius).
  assert.ok(folderIDs.every(id => f.roles[id] === undefined));
  assert.equal(expected.filter(id => f.roles[id] === 'VIEW').length, 25);
  assert.equal(f.roles['brand-logo'], undefined);
  assert.equal(f.roles['kit-photo-a'], undefined);
  assert.equal(f.roles['kit-photo-b'], undefined);
  assert.throws(() => f.api.apply(dry.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  const secondDry = f.api.dry();
  assert.equal(secondDry.public_writer, 21);
  assert.ok(secondDry.fingerprint !== dry.fingerprint);
  const second = f.api.apply(secondDry.fingerprint);
  assert.equal(second.ok, false, 'historic writers must keep complete remediation open');
  assert.equal(second.active_scope_completed, false,'folders remain a separate unapproved ACL scope');
  assert.equal(second.active_images_completed, true);
  assert.equal(second.partial, true);
  assert.equal(second.updated, 14);
  assert.equal(second.remaining_writers, 7);
  assert.equal(second.remaining_active_writers, 0);
  assert.equal(second.historical_public_writers, 3);
  assert.equal(second.folder_public_writers_held, 4);
  assert.equal(second.folder_writes, 0);
  assert.equal(second.reader_verified, 38);
  assert.equal(second.need_new_owner_dry_run, false);
  assert.equal(f.getWrites(), 38);
  assert.ok(folderIDs.every(id => f.roles[id] === undefined));
  assert.ok(expected.every(id => f.roles[id] === 'VIEW'));
  for (const id of ['brand-logo','kit-photo-a','kit-photo-b']) {
    assert.equal(f.roles[id], undefined, 'NO historic Drive write allowed');
  }
});

test('owner can never publish private historical assets even after active image-only pass completes', () => {
  const f = fixture({privateID: 'brand-logo'});
  const a = f.api.dry();
  f.api.apply(a.fingerprint);
  const b = f.api.dry();
  const report = f.api.apply(b.fingerprint);
  assert.equal(report.active_scope_completed, false);
  assert.equal(report.active_images_completed, true);
  assert.equal(report.folder_public_writers_held, 4);
  assert.equal(f.roles['brand-logo'], undefined);
  assert.equal(report.ok, false);
});

test('parent-folder inheritance blast radius is prevented before any folder write', () => {
  const f = fixture({folderCascadesToHistory: true});
  const dry = f.api.dry();
  const batch = f.api.apply(dry.fingerprint);
  assert.equal(batch.updated, 25);
  assert.equal(batch.folder_writes, 0);
  assert.equal(batch.folder_public_writers_held, 4);
  assert.ok(folderIDs.every(id => f.roles[id] === undefined));
  assert.equal(f.roles['brand-logo'], undefined, 'no inherited historical permission change');
});

test('synthetic 247-image scope: 209 history and four ancestor folders untouched after 25+13 active image updates', () => {
  const f = fixture({historicExtras: 206});
  const before = f.api.dry();
  assert.equal(before.active_files, 38);
  assert.equal(before.scoped_files, 247);
  assert.equal(before.folders, 4);
  assert.equal(before.historical_images, 209);
  assert.equal(before.public_writer, 251);
  assert.equal(before.scoped_items, 251);
  assert.equal(f.getWrites(), 0);
  const batch1 = f.api.apply(before.fingerprint);
  assert.equal(batch1.updated, 25);
  assert.equal(batch1.remaining_active_writers, 14);
  assert.equal(batch1.historical_public_writers, 209);
  const batch2 = f.api.apply(f.api.dry().fingerprint);
  assert.equal(batch2.updated, 14);
  assert.equal(batch2.active_scope_completed, false);
  assert.equal(batch2.active_images_completed, true);
  assert.equal(batch2.remaining_active_writers, 0);
  assert.equal(batch2.historical_public_writers, 209);
  assert.equal(batch2.remaining_writers, 213);
  assert.equal(batch2.folder_public_writers_held, 4);
  assert.equal(batch2.ok, false, '209 archived public Writers must prevent false full security PASS');
  assert.equal(f.getWrites(), 38);
  assert.ok(folderIDs.every(id => f.roles[id] === undefined));
  assert.ok(expected.every(id => f.roles[id] === 'VIEW'));
  assert.equal(f.roles['synthetic-historical-0000'], undefined);
  assert.equal(f.roles['synthetic-historical-0205'], undefined);
});

test('provider write failure is partial and never reported as success', () => {
  const f = fixture({failID: expected[4]});
  const dry = f.api.dry();
  assert.throws(() => f.api.apply(dry.fingerprint), /PARTIAL_OR_DRIFTED_ACL_REPAIR/);
  assert.ok(f.getWrites() > 0, 'partial updates must be detected, not rolled back to Writer');
});

test('renamed Drive asset invalidates previously approved ACL fingerprint', () => {
  const f = fixture();
  const dry = f.api.dry();
  f.nodes.get(expected[0]).getName = () => 'Unexpected renamed asset';
  assert.throws(() => f.api.apply(dry.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  assert.equal(f.getWrites(), 0);
});

test('Drive ACL fingerprint cannot confuse pipe and newline in asset names', () => {
  // Owner/standalone both fingerprint a structured field array, not a
  // delimiter-joined string that could collide with real asset names.
  assert.match(source, /JSON\.stringify\(\[x\.kind,x\.id,x\.parent,x\.depth,x\.obj\.getName\(\),x\.role\]\)/);
  assert.match(readOnly, /JSON\.stringify\(\[x\.kind,x\.id,x\.parent,x\.depth,x\.obj\.getName\(\),x\.role\]\)/);
  const f = fixture();
  const initial = f.api.dry();
  f.nodes.get(expected[0]).getName = () => 'Poster | edition\\nsub-folder | source';
  const changed = f.api.dry();
  assert.notEqual(initial.fingerprint, changed.fingerprint);
  assert.throws(() => f.api.apply(initial.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  assert.equal(f.getWrites(), 0);
});

test('moved Drive asset invalidates previously approved ACL fingerprint', () => {
  const f = fixture();
  const dry = f.api.dry();
  const sourceFolder = f.nodes.get(folderIDs[1]);
  const targetFolder = f.nodes.get(folderIDs[3]);
  const i = sourceFolder.files.findIndex(x => x.getId() === expected[0]);
  assert.ok(i >= 0, 'known poster must be in its originally approved parent folder');
  targetFolder.files.push(...sourceFolder.files.splice(i, 1));
  assert.throws(() => f.api.apply(dry.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  assert.equal(f.getWrites(), 0);
});

test('restricted historical asset is fingerprinted but never made public', () => {
  const f = fixture({privateID: 'brand-logo'});
  const dry = f.api.dry();
  assert.equal(dry.public_writer, 45);
  assert.equal(dry.historical_images, 3);
  assert.equal(f.getWrites(), 0);
  const first = f.api.apply(dry.fingerprint);
  assert.equal(first.ok, false);
  assert.equal(first.updated, 25);
  assert.equal(first.reader_verified, 25, 'owner-private historic image must not be reported as a public Reader');
  assert.equal(first.restricted_historical, 1);
  assert.equal(f.roles['brand-logo'], undefined);
  const secondDry = f.api.dry();
  assert.equal(secondDry.public_writer, 20);
  const last = f.api.apply(secondDry.fingerprint);
  assert.equal(last.ok, false, 'other two historic public Writers remain');
  assert.equal(last.active_scope_completed, false);
  assert.equal(last.active_images_completed, true);
  assert.equal(last.remaining_writers, 6);
  assert.equal(last.remaining_active_writers, 0);
  assert.equal(last.historical_public_writers, 2);
  assert.equal(last.reader_verified, 38);
  assert.equal(last.restricted_historical, 1);
  assert.equal(f.getWrites(), 38);
  assert.equal(last.folder_public_writers_held, 4);
  assert.equal(f.roles['brand-logo'], undefined);
});

test('private ACTIVE poster still fails closed before owner approval', () => {
  const f = fixture({privateID: expected[0]});
  assert.throws(() => f.api.dry(), /UNEXPECTED_SHARING_ACCESS/);
  assert.equal(f.getWrites(), 0);
});

test('discoverable publicly writable historical image fails closed instead of being treated as private', () => {
  const f = fixture({publicDiscoverableID: 'brand-logo'});
  assert.throws(() => f.api.dry(), /PUBLIC_DISCOVERABLE_HISTORICAL_REVIEW_REQUIRED/);
  assert.equal(f.getWrites(), 0);
});

test('non-image file mixed into historical asset tree aborts before mutation', () => {
  const f = fixture({nonImageID: 'kit-photo-a'});
  assert.throws(() => f.api.dry(), /NON_IMAGE_IN_KK_ASSET_TREE/);
  assert.equal(f.getWrites(), 0);
});

test('28 Oct active ACL allowlist is sorted, unique and image-ID shaped', () => {
  assert.equal(expected.length, 38);
  assert.deepEqual(expected, [...new Set(expected)].sort(),
    'the approval manifest must never contain duplicate or out-of-order file IDs');
  assert.ok(expected.every(id => /^[A-Za-z0-9_-]+$/.test(id)),
    'approval manifest entries must only contain canonical Drive ID characters');
});
