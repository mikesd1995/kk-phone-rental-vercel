'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/kk-admin-guard.js','utf8');
const admin=fs.readFileSync('admin/admin.js','utf8');
const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const scanner=fs.readFileSync('.agents/skills/kk-discovery-scanner/SKILL.md','utf8');
const verifier=fs.readFileSync('.agents/skills/kk-event-verifier/SKILL.md','utf8');

test('Admin API preflights implicit event re-open attempts against current owner visibility',()=>{
  assert.match(api,/EVENT_VISIBILITY_GUARDED_ACTIONS = new Set\(\['updateEvent'\]\)/);
  assert.match(api,/VisibilityGuard\.requestedVisibility\(payload\)===true/);
  assert.match(api,/!VisibilityGuard\.hasExplicitOwnerReopen\(payload\)/);
  assert.match(api,/VisibilityGuard\.evaluateSnapshotTransition\(snapshot,payload\)/);
  assert.match(api,/EVENT_VISIBILITY_OWNER_LOCKED|checked\.code/);
});

test('Admin UI marks only deliberate owner re-open actions with owner intent',()=>{
  assert.match(admin,/function eventVisibilityPayload\(eventId,nextActive\)/);
  assert.match(admin,/visibility_owner_intent='explicit_owner_reopen'/);
  assert.match(admin,/eventVisibilityPayload\(eventId,nextActive\)/);
  assert.match(admin,/p\.visibility_owner_intent="explicit_owner_reopen"/);
});

test('Apps Script writer also rejects implicit hidden-to-visible transitions',()=>{
  assert.match(apps,/ownerReopenIntent/);
  assert.match(apps,/EVENT_VISIBILITY_OWNER_LOCKED/);
  assert.match(apps,/explicit_owner_reopen/);
});

test('Scanner and Verifier contracts preserve owner-hidden Core events',()=>{
  assert.match(scanner,/active_on_web=false/);
  assert.match(scanner,/Never set `active_on_web=true`/);
  assert.match(scanner,/Only an explicit owner\/Admin visibility action may reopen/);
  assert.match(verifier,/Core storefront visibility is owner business intent/);
  assert.match(verifier,/preserve `active_on_web=false`/);
});
