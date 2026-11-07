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
// Synthetic IDs only; no public Drive targets in this repo.
const expected = Array.from({length:45}, (_,i)=>'KK_SYNTHETIC_IMAGE_FILE_ID_'+String(i).padStart(3,'0'));
const folderIDs = [
  '1avy3Up3NJskqB7kCzQoQPWKK3-j1qJqS',
  '1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw',
  '1uIfM-KV6FrJRQIP0ZNso7-ibZiSo1nwQ',
  '1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl'
];

function fixture(opts = {}) {
  const roles = Object.create(null);
  const upstreamRootID='KK_MOCK_SHARED_DRIVE_PARENT';
  let upstreamPublic=Boolean(opts.upstreamWriter);
  const nodes = new Map();
  let writes = 0;
  const logs = [];
  function node(id, folder = false) {
    const out = {
      getId: () => id,
      getName: () => 'Mock asset ' + id.slice(-6),
      getMimeType: () => opts.nonImageID === id ? 'application/pdf' : 'image/jpeg',
      getSharingAccess: () => id===upstreamRootID
        ? (upstreamPublic ? 'ANYONE_WITH_LINK' : 'PRIVATE')
        : opts.publicDiscoverableID === id ? 'ANYONE' : opts.privateID === id ? 'PRIVATE' : 'ANYONE_WITH_LINK',
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
      out.parents = [];
      out.getParents = () => {
        let n=0;
        return {hasNext:()=>n<out.parents.length,next:()=>out.parents[n++]};
      };
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
  const upstreamRoot=node(upstreamRootID,true);
  brand.parents.push(upstreamRoot);
  newer.parents.push(upstreamRoot);
  legacy.parents.push(brand);
  kit.parents.push(brand);
  // Independently cleared-ancestor case exists ONLY in simulated tests.
  // Current real four poster folders are still public Writer.
  if(opts.folderSafe) {
    for(const id of folderIDs) roles[id]='VIEW';
    if(opts.oneUnsafeFolder) roles[folderIDs[1]]='EDIT';
  }
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

  const refs = [...expected, ...expected.slice(0, 12)];
  const core = refs.map((id, i) => [
    'EVT-' + i, 'Example event', '21/10/2026', '',
    'https://drive.google.com/thumbnail?id=' + id
  ]);
  // Preserve 45 active unique file IDs while reducing the number of
  // reference uses by one: a stale 56/57 reference manifest must fail closed.
  if (opts.referenceCountDrift) core[refs.length - 1][4] = 'https://images.example.test/replaced-duplicate.jpg';
  for (let i = core.length; i < 94; i++) {
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
  if (opts.extraDriveCard) {
    core.push(['EVT-NEW-DRIVE', 'New visible poster', '21/10/2026', '',
      'https://drive.google.com/thumbnail?id=KK_SYNTHETIC_NEW_UNREVIEWED_DRIVE_FILE_046']);
  }
  const web = core.map(row => [
    row[0], '', row[2], '',
    opts.imageMismatch && row[0] === core[0][0] ? 'https://images.example.test/wrong.jpg' : row[4],
    '', '', '', '', 'show'
  ]);
  if (opts.dateMismatch) web[0][2] = '22/10/2026';
  if (opts.alternateGoogleURL) {
    core[0][4] = 'https://drive.google.com/file/d/' + expected[0] + '/view';
    web[0][4] = core[0][4];
  }
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
  const PropertiesService = {getScriptProperties: () => ({getProperty: key => {
    assert.equal(key, 'KKACL_OWNER_REVIEWED_ACTIVE_IDS_V20261107');
    if (opts.privateRosterMissing) return null;
    if (opts.privateRosterMalformed) return '{';
    if (opts.privateRosterWrongType) return JSON.stringify({ids: expected});
    const ids = [...expected];
    if (opts.privateRosterMismatch) ids[44] = 'KK_SYNTHETIC_UNKNOWN_FILE_ID_999';
    if (opts.privateRosterDuplicate) ids[44] = ids[43];
    if (opts.privateRosterUnsorted) [ids[0], ids[1]] = [ids[1], ids[0]];
    if (opts.privateRosterMissingItem) ids.pop();
    if (opts.privateRosterBadId) ids[44] = 'bad id with whitespace';
    return JSON.stringify(ids);
  }})};
  const sandbox = {SpreadsheetApp, DriveApp, Utilities, PropertiesService, Logger: {log: msg => logs.push(String(msg))}};
  vm.createContext(sandbox);
  vm.runInContext(opts.readOnly ? readOnly : source, sandbox, {timeout: 2000});
  const api = vm.runInContext(
    opts.readOnly
      ? '({dry:kkAclDryRun_20261013, apply:typeof kkAclApply_20261013, owner:typeof kkAclOwnerApprovedApply_20261013})'
      : '({dry:kkAclDryRun_20261013, apply:kkAclApply_20261013, owner:kkAclOwnerApprovedApply_20261013})',
    sandbox
  );
  // Core+WebReady coordinated mutations: both sources still agree, and the
  // 57 refs / 45 distinct Drive IDs remain unchanged. The old file-only
  // fingerprint missed these event-to-poster and in-scope date changes.
  const swapVisibleArtwork = () => {
    [core[0][4], core[1][4]] = [core[1][4], core[0][4]];
    web[0][4] = core[0][4];
    web[1][4] = core[1][4];
  };
  const changeVisibleDate = () => {
    core[0][2] = '22/10/2026';
    web[0][2] = '22/10/2026';
  };
  return {api, getWrites: () => writes, roles, nodes, logs,
    swapVisibleArtwork, changeVisibleDate,
    promoteUpstreamToPublicWriter:()=>{upstreamPublic=true;}};
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
  assert.equal(r.active_files, 45);
  assert.equal(r.scoped_files, 48);
  assert.equal(r.folders, 4);
  assert.equal(r.public_writer, 52);
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

test('dry run discovers 94 Oct-Dec visible / 57 references / 45 unique without writing', () => {
  const f = fixture();
  const r = f.api.dry();
  assert.equal(r.active_files, 45);
  assert.equal(r.scoped_files, 48);
  assert.equal(r.folders, 4);
  assert.equal(r.public_writer, 52);
  assert.equal(f.getWrites(), 0);
});

test('dry run prints complete asset scope with paged provenance, without editing', () => {
  const f = fixture();
  const summary = f.api.dry();
  assert.equal(summary.scoped_items, 52);
  assert.equal(summary.active_public_writer, 45);
  assert.equal(summary.other_public_writer, 7);
  assert.equal(summary.historical_images, 3);
  assert.equal(f.logs.length, 4, 'summary and 3 detail pages with 20,20,5 items');
  const pages = f.logs.slice(1).map(JSON.parse);
  assert.deepEqual(pages.map(x => x.items.length), [20, 20, 12]);
  assert.equal(pages.flatMap(x => x.items).filter(x => x.active_poster).length, 45);
  assert.ok(pages.flatMap(x => x.items).every(x => x.name.startsWith('Mock asset ')));
  assert.ok(pages.flatMap(x => x.items).every(x => x.id_suffix.length === 6));
  assert.equal(f.getWrites(), 0);
});

test('private September reference excluded without weakening active repair guard', () => {
  const f = fixture({pastSeptemberPrivate: true});
  const dry = f.api.dry();
  assert.equal(dry.active_files, 45);
  assert.equal(dry.public_writer, 52);
  assert.equal(f.getWrites(), 0);
});

test('non-Drive artwork does not widen the Drive ACL repair scope', () => {
  const f = fixture({missingArtwork: true});
  const result = f.api.dry();
  assert.equal(result.active_files, 45);
  assert.equal(result.scoped_files, 48);
  assert.equal(result.public_writer, 52);
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

test('57-to-56 thumbnail reference drift stops before any permissions write, even with same 45 file IDs', () => {
  const f = fixture({referenceCountDrift: true});
  assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('unrelated non-Drive extra card does not expand Drive ACL writer scope', () => {
  const f = fixture({extraCard: true});
  assert.equal(f.api.dry().active_files, 45);
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
  assert.equal(f.api.dry().active_files, 45);
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

test('safe-parent mock batches 25+20 but historical writers remain on HOLD', () => {
  const f = fixture({folderSafe:true});
  const dry = f.api.dry();
  const first = f.api.apply(dry.fingerprint);
  assert.equal(first.ok, false, 'must never claim success while writers remain');
  assert.equal(first.partial, true);
  assert.equal(first.updated, 25);
  assert.equal(first.remaining_writers, 23);
  assert.equal(first.need_new_owner_dry_run, true);
  assert.equal(f.getWrites(), 25);
  // Never touch a parent folder (inherited historic ACL blast radius).
  assert.ok(folderIDs.every(id => f.roles[id] === 'VIEW'));
  assert.equal(expected.filter(id => f.roles[id] === 'VIEW').length, 25);
  assert.equal(f.roles['brand-logo'], undefined);
  assert.equal(f.roles['kit-photo-a'], undefined);
  assert.equal(f.roles['kit-photo-b'], undefined);
  assert.throws(() => f.api.apply(dry.fingerprint), /ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  const secondDry = f.api.dry();
  assert.equal(secondDry.public_writer, 23);
  assert.ok(secondDry.fingerprint !== dry.fingerprint);
  const second = f.api.apply(secondDry.fingerprint);
  assert.equal(second.ok, false, 'historic writers must keep complete remediation open');
  assert.equal(second.active_scope_completed, true, 'safe-parent case can finish active scope but history remains');
  assert.equal(second.active_images_completed, true);
  assert.equal(second.partial, true);
  assert.equal(second.updated, 20);
  assert.equal(second.remaining_writers, 3);
  assert.equal(second.remaining_active_writers, 0);
  assert.equal(second.historical_public_writers, 3);
  assert.equal(second.folder_public_writers_held, 0);
  assert.equal(second.folder_writes, 0);
  assert.equal(second.reader_verified, 49);
  assert.equal(second.need_new_owner_dry_run, false);
  assert.equal(f.getWrites(), 45);
  assert.ok(folderIDs.every(id => f.roles[id] === 'VIEW'));
  assert.ok(expected.every(id => f.roles[id] === 'VIEW'));
  for (const id of ['brand-logo','kit-photo-a','kit-photo-b']) {
    assert.equal(f.roles[id], undefined, 'NO historic Drive write allowed');
  }
});

test('safe-parent mock never publishes private historical assets', () => {
  const f = fixture({privateID: 'brand-logo',folderSafe:true});
  const a = f.api.dry();
  f.api.apply(a.fingerprint);
  const b = f.api.dry();
  const report = f.api.apply(b.fingerprint);
  assert.equal(report.active_scope_completed, true);
  assert.equal(report.active_images_completed, true);
  assert.equal(report.folder_public_writers_held, 0);
  assert.equal(f.roles['brand-logo'], undefined);
  assert.equal(report.ok, false);
});

test('unsafe public Writer ancestors block image-only ACL before any changes', () => {
  const f = fixture({folderCascadesToHistory:true});
  const dry = f.api.dry();
  assert.equal(dry.blocking_public_writer_folders,4);
  assert.equal(dry.owner_folder_inheritance_review_required,true);
  assert.throws(()=>f.api.apply(dry.fingerprint),/PUBLIC_WRITER_ANCESTOR_HOLD:4/);
  assert.equal(f.getWrites(),0);
  assert.ok(folderIDs.every(id=>f.roles[id]===undefined));
  assert.equal(f.roles['brand-logo'],undefined);
});

test('safe-parent 254-image synthetic scope leaves 209 history untouched after 25+20', () => {
  const f = fixture({historicExtras:206,folderSafe:true});
  const before = f.api.dry();
  assert.equal(before.active_files, 45);
  assert.equal(before.scoped_files, 254);
  assert.equal(before.folders, 4);
  assert.equal(before.historical_images, 209);
  assert.equal(before.public_writer, 254);
  assert.equal(before.scoped_items, 258);
  assert.equal(f.getWrites(), 0);
  const batch1 = f.api.apply(before.fingerprint);
  assert.equal(batch1.updated, 25);
  assert.equal(batch1.remaining_active_writers, 20);
  assert.equal(batch1.historical_public_writers, 209);
  const batch2 = f.api.apply(f.api.dry().fingerprint);
  assert.equal(batch2.updated, 20);
  assert.equal(batch2.active_scope_completed, true);
  assert.equal(batch2.active_images_completed, true);
  assert.equal(batch2.remaining_active_writers, 0);
  assert.equal(batch2.historical_public_writers, 209);
  assert.equal(batch2.remaining_writers, 209);
  assert.equal(batch2.folder_public_writers_held, 0);
  assert.equal(batch2.ok, false, '209 archived public Writers must prevent false full security PASS');
  assert.equal(f.getWrites(), 45);
  assert.ok(folderIDs.every(id => f.roles[id] === 'VIEW'));
  assert.ok(expected.every(id => f.roles[id] === 'VIEW'));
  assert.equal(f.roles['synthetic-historical-0000'], undefined);
  assert.equal(f.roles['synthetic-historical-0205'], undefined);
});

test('provider write failure remains partial in independently cleared-parent mock', () => {
  const f = fixture({failID:expected[4],folderSafe:true});
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

test('safe-parent mock fingerprints restricted history without publishing it', () => {
  const f = fixture({privateID:'brand-logo',folderSafe:true});
  const dry = f.api.dry();
  assert.equal(dry.public_writer, 47);
  assert.equal(dry.historical_images, 3);
  assert.equal(f.getWrites(), 0);
  const first = f.api.apply(dry.fingerprint);
  assert.equal(first.ok, false);
  assert.equal(first.updated, 25);
  assert.equal(first.reader_verified, 29, 'four safe folders + 25 active public Reader; private history excluded');
  assert.equal(first.restricted_historical, 1);
  assert.equal(f.roles['brand-logo'], undefined);
  const secondDry = f.api.dry();
  assert.equal(secondDry.public_writer, 22);
  const last = f.api.apply(secondDry.fingerprint);
  assert.equal(last.ok, false, 'other two historic public Writers remain');
  assert.equal(last.active_scope_completed, true);
  assert.equal(last.active_images_completed, true);
  assert.equal(last.remaining_writers, 2);
  assert.equal(last.remaining_active_writers, 0);
  assert.equal(last.historical_public_writers, 2);
  assert.equal(last.reader_verified, 49);
  assert.equal(last.restricted_historical, 1);
  assert.equal(f.getWrites(), 45);
  assert.equal(last.folder_public_writers_held, 0);
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

test('private synthetic roster is sorted, unique and image-ID shaped', () => {
  assert.equal(expected.length, 45);
  assert.deepEqual(expected, [...new Set(expected)].sort(),
    'the approval manifest must never contain duplicate or out-of-order file IDs');
  assert.ok(expected.every(id => /^[A-Za-z0-9_-]+$/.test(id)),
    'approval manifest entries must only contain canonical Drive ID characters');
});

test('owner Apply rejects missing, malformed and mismatched private rosters with zero writes', () => {
  for (const options of [
    {privateRosterMissing:true},
    {privateRosterMalformed:true},
    {privateRosterWrongType:true},
    {privateRosterDuplicate:true},
    {privateRosterUnsorted:true},
    {privateRosterMissingItem:true},
    {privateRosterBadId:true},
    {privateRosterMismatch:true}
  ]) {
    const f=fixture(options), dry=f.api.dry();
    assert.throws(()=>f.api.apply(dry.fingerprint), /OWNER_PRIVATE_ROSTER_(NOT_CONFIGURED|INVALID|DRIFT)/);
    assert.equal(f.getWrites(),0);
  }
});
test('unrecognized Google Drive URL fails closed before ACL changes', () => {
  const f=fixture({alternateGoogleURL:true});
  assert.throws(()=>f.api.dry(), /SCOPED_GOOGLE_POSTER_URL_UNRECOGNIZED/);
  assert.equal(f.getWrites(),0);
});

test('owner Apply rejects an unreviewed changed file ID despite correct 45-file count', () => {
  const f = fixture({privateRosterMismatch: true});
  const dry = f.api.dry();
  assert.equal(dry.active_files, 45);
  assert.throws(() => f.api.apply(dry.fingerprint), /OWNER_PRIVATE_ROSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('new visible 46th Google Drive poster fails source scope before any writer permission changes', () => {
  const f = fixture({extraDriveCard:true});
  assert.throws(() => f.api.dry(), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
  assert.throws(() => f.api.apply('0'.repeat(64)), /SCOPED_ACTIVE_POSTER_DRIFT/);
  assert.equal(f.getWrites(), 0);
});

test('coordinated Core/WebReady event-to-poster swap invalidates owner approval without ACL writes', () => {
  for(const readOnly of [false,true]){
    const f=fixture({readOnly});
    const before=f.api.dry();
    f.swapVisibleArtwork();
    const after=f.api.dry();
    assert.equal(after.active_files,45);
    assert.equal(after.scoped_files,before.scoped_files);
    assert.notEqual(after.fingerprint,before.fingerprint,
      'approval must bind visible event-to-poster mapping even when IDs/refs remain unchanged');
    if(!readOnly){
      assert.throws(()=>f.api.apply(before.fingerprint),/ACL_CHANGED_SINCE_OWNER_APPROVAL/);
      assert.equal(f.getWrites(),0);
    }
  }
});
test('coordinated Core/WebReady in-scope date change invalidates approval with unchanged file ACL', () => {
  for(const readOnly of [false,true]){
    const f=fixture({readOnly});
    const before=f.api.dry();
    f.changeVisibleDate();
    const after=f.api.dry();
    assert.equal(after.active_files,45);
    assert.notEqual(after.fingerprint,before.fingerprint);
    if(!readOnly){
      assert.throws(()=>f.api.apply(before.fingerprint),/ACL_CHANGED_SINCE_OWNER_APPROVAL/);
      assert.equal(f.getWrites(),0);
    }
  }
});

test('one remaining public Writer ancestor blocks even when three are Reader', () => {
  const f=fixture({folderSafe:true,oneUnsafeFolder:true});
  const dry=f.api.dry();
  assert.equal(dry.blocking_public_writer_folders,1);
  assert.equal(dry.owner_folder_inheritance_review_required,true);
  assert.throws(()=>f.api.apply(dry.fingerprint),/PUBLIC_WRITER_ANCESTOR_HOLD:1/);
  assert.equal(f.getWrites(),0);
});

test('realistic four public Writer folders must all be resolved first', () => {
  const f=fixture();
  const dry=f.api.dry();
  assert.equal(dry.blocking_public_writer_folders,4);
  assert.equal(dry.owner_folder_inheritance_review_required,true);
  assert.throws(()=>f.api.apply(dry.fingerprint),/PUBLIC_WRITER_ANCESTOR_HOLD:4/);
  assert.equal(f.getWrites(),0);
});

test('all-Reader synthetic ancestor case permits owner-reviewed image-only batch', () => {
  const f=fixture({folderSafe:true});
  const dry=f.api.dry();
  assert.equal(dry.blocking_public_writer_folders,0);
  assert.equal(dry.owner_folder_inheritance_review_required,false);
  const result=f.api.apply(dry.fingerprint);
  assert.equal(result.updated,25);
  assert.equal(result.folder_writes,0);
  assert.ok(folderIDs.every(id=>f.roles[id]==='VIEW'));
});

test('private upstream root is fingerprinted and examined by read-only preflight', () => {
  const f=fixture({readOnly:true});
  const dry=f.api.dry();
  assert.equal(dry.upstream_ancestors_checked,1);
  assert.equal(dry.blocking_public_writer_upstream,0);
  assert.equal(f.getWrites(),0);
});

test('upstream public Writer blocks image-only Apply even when all four scoped folders are Reader', () => {
  const f=fixture({folderSafe:true,upstreamWriter:true});
  const dry=f.api.dry();
  assert.equal(dry.upstream_ancestors_checked,1);
  assert.equal(dry.blocking_public_writer_folders,0);
  assert.equal(dry.blocking_public_writer_upstream,1);
  assert.equal(dry.owner_folder_inheritance_review_required,true);
  assert.throws(()=>f.api.apply(dry.fingerprint),/PUBLIC_WRITER_UPSTREAM_HOLD:1/);
  assert.equal(f.getWrites(),0);
  assert.ok(folderIDs.every(id=>f.roles[id]==='VIEW'));
});

test('upstream private-to-public Writer drift invalidates previously owner-approved hash', () => {
  const f=fixture({folderSafe:true});
  const before=f.api.dry();
  f.promoteUpstreamToPublicWriter();
  const after=f.api.dry();
  assert.notEqual(before.fingerprint,after.fingerprint);
  assert.equal(after.blocking_public_writer_upstream,1);
  assert.throws(()=>f.api.apply(before.fingerprint),/ACL_CHANGED_SINCE_OWNER_APPROVAL/);
  assert.equal(f.getWrites(),0);
});

const advancedReadOnly = fs.readFileSync(
  path.join(__dirname,'kk-poster-acl-advanced-provenance-READONLY-20261107.gs'),'utf8');

function advancedProvenanceFixture(opts={}){
  const root='KK_MOCK_SHARED_DRIVE_PARENT';
  const ids=[...folderIDs,...expected];
  const errors=[],logs=[];
  let writes=0,metadataReads=0,permissionReads=0;
  const folderParents=new Map([
    [folderIDs[0],[root]],[folderIDs[1],[folderIDs[0]]],
    [folderIDs[2],[folderIDs[0]]],[folderIDs[3],[root]],[root,[]]
  ]);
  const Drive={
    Files:{
      get:(id,o)=>{
        metadataReads++;
        assert.equal(o.supportsAllDrives,true);
        if(opts.missingUpstream&&id===root)return null;
        if(folderParents.has(id))
          return {id,mimeType:'application/vnd.google-apps.folder',
            parents:folderParents.get(id),
            driveId:opts.sharedDrive?'KK_MOCK_SHARED_DRIVE_ID':undefined};
        if(expected.includes(id))
          return {id,mimeType:opts.nonImage&&id===expected[0]?'text/plain':'image/jpeg',
            parents:[folderIDs[0]],driveId:opts.sharedDrive?'KK_MOCK_SHARED_DRIVE_ID':undefined};
        assert.fail('unexpected provenance file target');
      },
      update:()=>{writes++;throw Error('UNSAFE_FILE_UPDATE')}
    },
    Permissions:{
      list:(id,o)=>{
        permissionReads++;
        assert.equal(o.supportsAllDrives,true);
        assert.ok(o.fields.includes('permissionDetails'));
        if(opts.pageLoop)return {permissions:[],nextPageToken:'LOOP'};
        const isRoot=id===root;
        if(isRoot)return {permissions:[]};
        const parent=folderParents.get(id)?.[0]??folderIDs[0];
        const inherited=opts.inherited===true;
        const details=opts.missingDetails&&id===folderIDs[0]?undefined:[
          {permissionType:'file',inherited,role:'writer',
           ...(inherited?{inheritedFrom:parent}:{})}
        ];
        return {permissions:[{id:'mock-perm',type:'anyone',
          role:opts.conflictingRole&&id===folderIDs[0]?'reader':'writer',
          permissionDetails:details}]};
      },
      update:()=>{writes++;throw Error('UNSAFE_PERMISSION_UPDATE')},
      delete:()=>{writes++;throw Error('UNSAFE_PERMISSION_DELETE')},
      create:()=>{writes++;throw Error('UNSAFE_PERMISSION_CREATE')}
    }
  };
  const PropertiesService={getScriptProperties:()=>({
    getProperty:key=>{
      assert.equal(key,'KKACL_OWNER_REVIEWED_ACTIVE_IDS_V20261107');
      if(opts.missingRoster)return null;
      return JSON.stringify(opts.rosterMismatch?[...expected.slice(0,-1),'OTHER_INVALID_ID']:expected);
    }
  })};
  const sandbox={Drive,PropertiesService,Logger:{log:x=>logs.push(String(x))}};
  vm.createContext(sandbox);
  vm.runInContext(advancedReadOnly,sandbox,{timeout:2000});
  const inspect=vm.runInContext('kkProvInspect_20261107',sandbox);
  return {inspect,logs,errors,getWrites:()=>writes,
    getMetadataReads:()=>metadataReads,getPermissionReads:()=>permissionReads};
}
test('advanced Drive permission-origin script is strictly read-only without write entrypoints',()=>{
  for(const token of ['.setSharing(','.Permissions.update(','.Permissions.delete(',
      '.Permissions.create(','.Files.update(','UrlFetchApp.fetch(','ScriptApp.newTrigger(']){
    assert.equal(advancedReadOnly.includes(token),false,'forbidden '+token);
  }
  assert.ok(advancedReadOnly.includes('supportsAllDrives:true'));
  assert.ok(advancedReadOnly.includes('permissionDetails(inherited,inheritedFrom,role,permissionType)'));
});
test('Advanced Drive provenance census reads 45 synthetic images, 4 folders, 1 root with no mutations',()=>{
  const f=advancedProvenanceFixture();
  const r=f.inspect();
  assert.equal(r.audit_only,true);
  assert.equal(r.images,45);
  assert.equal(r.asset_folders,4);
  assert.equal(r.upstream_parents,1);
  assert.equal(r.public_writer_items,49);
  assert.equal(r.direct_public_writer_details,49);
  assert.equal(r.inherited_public_writer_details,0);
  assert.equal(r.ready_for_acl_write,false);
  assert.equal(r.changed,0);
  assert.equal(f.getWrites(),0);
  assert.equal(f.getMetadataReads(),50);
  assert.equal(f.getPermissionReads(),50);
  assert.equal(f.logs.length,1);
  assert.ok(!f.logs[0].includes(expected[0]));
  assert.ok(!f.logs[0].includes(folderIDs[0]));
});
test('advanced provenance counts inherited writer origin without granting write approval',()=>{
  const f=advancedProvenanceFixture({inherited:true});
  const r=f.inspect();
  assert.equal(r.inherited_public_writer_details,49);
  assert.equal(r.direct_public_writer_details,0);
  assert.equal(r.owner_origin_review_required,true);
  assert.equal(r.ready_for_acl_write,false);
  assert.equal(f.getWrites(),0);
});
test('advanced provenance fails closed if permissionDetails are absent',()=>{
  const f=advancedProvenanceFixture({missingDetails:true});
  assert.throws(()=>f.inspect(),/ADVANCED_ANYONE_PERMISSION_ORIGIN_MISSING/);
  assert.equal(f.getWrites(),0);
});
test('advanced provenance fails closed if shared-drive parent metadata cannot be read',()=>{
  const f=advancedProvenanceFixture({missingUpstream:true});
  assert.throws(()=>f.inspect(),/ADVANCED_FILE_METADATA_INCOMPLETE/);
  assert.equal(f.getWrites(),0);
});
test('advanced provenance refuses unreviewed or missing private file manifest',()=>{
  for(const opt of [{missingRoster:true},{rosterMismatch:true}]){
    const f=advancedProvenanceFixture(opt);
    assert.throws(()=>f.inspect(),/OWNER_PRIVATE_ROSTER_(NOT_CONFIGURED|INVALID)/);
    assert.equal(f.getMetadataReads(),0);
    assert.equal(f.getWrites(),0);
  }
});
test('advanced provenance shared-drive membership remains independent owner review gate',()=>{
  const f=advancedProvenanceFixture({sharedDrive:true});
  const r=f.inspect();
  assert.equal(r.shared_drive_ids_seen,1,'50 items map to one shared-drive identity');
  assert.equal(r.shared_drive_membership_review_required,true);
  assert.equal(r.ready_for_acl_write,false);
  assert.equal(f.getWrites(),0);
});
test('advanced provenance aborts looping pagination before any writes',()=>{
  const f=advancedProvenanceFixture({pageLoop:true});
  assert.throws(()=>f.inspect(),/ADVANCED_PERMISSION_PAGINATION_LOOP/);
  assert.equal(f.getWrites(),0);
});
test('advanced provenance rejects non-image media in private roster',()=>{
  const f=advancedProvenanceFixture({nonImage:true});
  assert.throws(()=>f.inspect(),/ADVANCED_ACTIVE_FILE_NOT_IMAGE/);
  assert.equal(f.getWrites(),0);
});

test('advanced provenance rejects inconsistent effective Reader with Writer origin',()=>{
  const f=advancedProvenanceFixture({conflictingRole:true});
  assert.throws(()=>f.inspect(),/ADVANCED_ROLE_DETAILS_DIVERGED/);
  assert.equal(f.getWrites(),0);
});
