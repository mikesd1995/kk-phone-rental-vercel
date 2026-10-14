'use strict';
// Poster-only Apps Script security contract. No booking, no network, no Drive writes.
// Run with: node --test tests/kk-poster-upload-reader-acl.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const names = [
  'kkVerifyDriveAnyoneReader_',
  'kkDrivePermissionApiSetAnyone_',
  'kkEnsureDriveFilePublic_',
  'kkApiUploadPoster_'
];
function extract(name) {
  const marker = 'function ' + name + '(';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'missing security function ' + name);
  const end = source.indexOf('\nfunction ', start + marker.length);
  return source.slice(start, end >= 0 ? end : undefined);
}
const isolatedSource = names.map(extract).join('\n');
assert.match(isolatedSource, /POSTER_ACL_NOT_ANYONE_READER/);
assert.match(isolatedSource, /POSTER_FOLDER_NOT_ANYONE_READER/);

function fixture(overrides = {}) {
  const state = {
    folderRole: 'VIEW',
    folderAccess: 'ANYONE_WITH_LINK',
    fileRole: 'VIEW',
    fileAccess: 'ANYONE_WITH_LINK',
    apiAnyoneRole: 'reader',
    apiStatus: 200,
    postStatus: 201,
    postCalls: 0,
    getCalls: 0,
    setSharingCalls: 0,
    created: 0,
    throwSetSharing: false,
    nextPageToken: '',
    extraAnyoneRole: '',
    ...overrides
  };
  const file = {
    getId: () => 'EXACT_POSTER_ID',
    getUrl: () => 'https://drive.google.com/file/d/EXACT_POSTER_ID/view',
    getSharingAccess: () => state.fileAccess,
    getSharingPermission: () => state.fileRole,
    setSharing: () => {
      state.setSharingCalls++;
      if (state.throwSetSharing) throw new Error('DriveApp sharing failed');
    }
  };
  const folder = {
    getSharingAccess: () => state.folderAccess,
    getSharingPermission: () => state.folderRole,
    createFile: () => { state.created++; return file; }
  };
  const DriveApp = {
    Access: {ANYONE_WITH_LINK:'ANYONE_WITH_LINK'},
    Permission: {VIEW:'VIEW', EDIT:'EDIT'},
    getFileById: id => { assert.equal(id, 'EXACT_POSTER_ID'); return file; },
    getFolderById: id => { assert.equal(id, 'EXPECTED_POSTER_FOLDER'); return folder; }
  };
  const UrlFetchApp = {
    fetch: (_url, opt) => {
      if (opt.method === 'get') {
        state.getCalls++;
        const permissions = [{type:'user',role:'owner'}, {type:'anyone',role:state.apiAnyoneRole}];
        if (state.extraAnyoneRole) permissions.push({type:'anyone',role:state.extraAnyoneRole});
        return {
          getResponseCode: () => state.apiStatus,
          getContentText: () => JSON.stringify({permissions,
            ...(state.nextPageToken ? {nextPageToken:state.nextPageToken} : {})})
        };
      }
      if (opt.method === 'post') {
        state.postCalls++;
        return {getResponseCode: () => state.postStatus, getContentText: () => ''};
      }
      throw new Error('Unexpected provider call');
    }
  };
  const sandbox = {
    DriveApp,
    UrlFetchApp,
    ScriptApp: {getOAuthToken: () => 'synthetic-test-token'},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: k => k === 'KK_POSTER_FOLDER_ID' ? 'EXPECTED_POSTER_FOLDER' : ''
    })},
    Utilities: {base64Decode: () => [1,2,3],
      newBlob: (_bytes, _mime, _name) => ({mock:true})}
  };
  vm.createContext(sandbox);
  vm.runInContext(isolatedSource, sandbox, {timeout:1500});
  return {state, verify:id => sandbox.kkVerifyDriveAnyoneReader_(id),
    ensure:id => sandbox.kkEnsureDriveFilePublic_(id),
    api:id => sandbox.kkDrivePermissionApiSetAnyone_(id),
    upload:() => sandbox.kkApiUploadPoster_({
      base64:'synthetic-image-bytes', mimeType:'image/jpeg', fileName:'verified-event.jpg'
    })};
}

test('direct sharing success requires subsequent Reader readback', () => {
  const f=fixture();
  assert.equal(f.ensure('EXACT_POSTER_ID').public_checked,true);
  assert.equal(f.state.setSharingCalls,1);
  assert.ok(f.state.getCalls >= 1);
});
test('Drive API 409 existing public Writer must NOT be treated as Reader', () => {
  const f=fixture({postStatus:409,apiAnyoneRole:'writer'});
  assert.throws(() => f.api('EXACT_POSTER_ID'), /POSTER_ACL_NOT_ANYONE_READER/);
});
test('setSharing success cannot mask inherited or existing public Writer', () => {
  const f=fixture({postStatus:409,apiAnyoneRole:'writer'});
  const r=f.ensure('EXACT_POSTER_ID');
  assert.equal(r.public_checked,false);
  assert.match(r.sharing_warning,/POSTER_ACL_NOT_ANYONE_READER/);
});
test('permissions list Reader cannot mask effective DriveApp EDIT role', () => {
  const f=fixture({fileRole:'EDIT'});
  assert.equal(f.ensure('EXACT_POSTER_ID').public_checked,false);
});
test('permission list with ambiguous multiple ANYONE grants fails closed', () => {
  const f=fixture({extraAnyoneRole:'writer'});
  assert.throws(() => f.verify('EXACT_POSTER_ID'), /POSTER_ACL_NOT_ANYONE_READER/);
});
test('paginated/incomplete permissions list fails closed', () => {
  const f=fixture({nextPageToken:'more'});
  assert.throws(() => f.verify('EXACT_POSTER_ID'), /POSTER_ACL_READBACK_INCOMPLETE/);
});
test('provider readback HTTP error cannot claim verified access', () => {
  const f=fixture({apiStatus:403,postStatus:409});
  assert.equal(f.ensure('EXACT_POSTER_ID').public_checked,false);
});
test('DriveApp failure can recover only if fallback POST also verifies Reader', () => {
  const f=fixture({throwSetSharing:true,postStatus:409});
  assert.equal(f.ensure('EXACT_POSTER_ID').public_checked,true);
  assert.equal(f.state.postCalls,1);
});
test('public-writable parent folder blocks upload BEFORE creating image', () => {
  const f=fixture({folderRole:'EDIT'});
  assert.throws(() => f.upload(), /POSTER_FOLDER_NOT_ANYONE_READER/);
  assert.equal(f.state.created,0);
  assert.equal(f.state.postCalls,0);
});
test('private parent folder is not automatically exposed', () => {
  const f=fixture({folderAccess:'PRIVATE'});
  assert.throws(() => f.upload(), /POSTER_FOLDER_NOT_ANYONE_READER/);
  assert.equal(f.state.created,0);
});
test('file with public Writer never returns a successful poster URL', () => {
  const f=fixture({apiAnyoneRole:'writer',postStatus:409});
  assert.throws(() => f.upload(), /POSTER_FILE_NOT_VERIFIED_READER/);
  assert.equal(f.state.created,1);
});
test('verified reader parent and reader file allow normal poster URL result', () => {
  const f=fixture();
  const x=f.upload();
  assert.equal(x.public_checked,true);
  assert.match(x.url,/^https:\/\/drive.google.com\/thumbnail\?id=EXACT_POSTER_ID/);
  assert.equal(f.state.created,1);
});
