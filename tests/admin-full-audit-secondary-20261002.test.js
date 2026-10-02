'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const direct=require('../server/admin-direct-writer-phase1.js');
const guard=require('../api/kk-admin-guard.js')._test;
const candidate=fs.readFileSync('apps-script/candidates/Code_9_5_13_FULL_BACKEND_AUDIT_2026-10-02.gs','utf8');

function fn(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'missing '+name);
  const next=source.indexOf('\nfunction ',start+10);
  return source.slice(start,next===-1?source.length:next);
}

test('legacy Apps Script blocks event date moves that would double-book assigned assets',()=>{
  const helper=fn(apps,'kkAssertEventDateChangeSafe_');
  assert.match(helper,/EVENT_DATE_ASSET_COLLISION/);
  assert.match(helper,/kkActiveHold_/);
  const update=fn(apps,'kkApiUpdateEvent_');
  assert.match(update,/kkAssertEventDateChangeSafe_\(eventId, nextEventDate\)/);
});

test('model master is enforced for package creation and asset additions',()=>{
  const model=fn(apps,'kkAssertModelGroupType_');
  assert.match(model,/Unknown model_group/);
  assert.match(model,/Inactive model_group/);
  assert.match(model,/expected/);
  const pkg=fn(apps,'kkApiCreatePackage_');
  assert.match(pkg,/kkAssertModelGroupType_\(modelGroup, 'phone'\)/);
  assert.match(pkg,/kkAssertModelGroupType_\(lensGroup, 'lens'\)/);
  const asset=fn(apps,'kkApiAddAssets_');
  assert.match(asset,/Math\.floor\(qty\) !== qty/);
  assert.match(asset,/kkAssertModelGroupType_\(modelGroup, assetType\)/);
});

test('sheet dashboard entry points reuse hardened APIs or locks',()=>{
  assert.match(fn(apps,'kkCreateEventFromDashboard'),/kkApiCreateEvent_\(/);
  assert.match(fn(apps,'kkAddAssetsFromDashboard'),/kkApiAddAssets_\(/);
  assert.match(fn(apps,'kkAddQuickBookingFromDashboard'),/kkApiCreateBooking_\(/);
  const accessories=fn(apps,'kkUpdateAccessoryStockFromDashboard');
  assert.match(accessories,/kkAcquireDocumentLock_\('update accessory stock'/);
  assert.match(accessories,/damaged > total/);
  assert.match(fn(apps,'kkConvertEventDriveUrls'),/kkAcquireDocumentLock_\('convert event poster URLs'/);
});

test('direct writer validates status and blocks event-date asset collisions',()=>{
  const data={
    events:[
      ['EVT-A','A',46000,'V','', 'open',true,''],
      ['EVT-B','B',46001,'V','', 'open',true,'']
    ],
    bookings:[
      ['BK-A','', 'confirmed','EVT-A','','','','','phone_only','PHONE-001','','','','unpaid',0,'','','',0,''],
      ['BK-B','', 'confirmed','EVT-B','','','','','phone_only','PHONE-001','','','','unpaid',0,'','','',0,'']
    ],
    web:[],visibility_locks:[]
  };
  assert.throws(
    ()=>direct.assertEventDateMoveSafe('EVT-A',46001,data),
    err=>err&&err.code==='DIRECT_PHASE1_EVENT_DATE_ASSET_COLLISION'&&err.asset_id==='PHONE-001'
  );
  assert.throws(
    ()=>direct.buildUpdateEventPlan({event_id:'EVT-A',status:'garbage'},data),
    err=>err&&err.code==='DIRECT_PHASE1_VALIDATION_FAILED'
  );
});

test('API guard detects event-date collisions from stable snapshot identities',()=>{
  const snapshot={
    events:[
      {event_id:'EVT-A',event_date:'2026-10-01'},
      {event_id:'EVT-B',event_date:'2026-10-02'}
    ],
    bookings:[
      {booking_id:'BK-A',booking_status:'confirmed',event_id:'EVT-A',phone_asset_id:'PHONE-001',lens_asset_id:''},
      {booking_id:'BK-B',booking_status:'prepared',event_id:'EVT-B',phone_asset_id:'PHONE-001',lens_asset_id:''}
    ]
  };
  const hit=guard.findEventDateAssetCollision(snapshot,{action:'updateEvent',event_id:'EVT-A',event_date:'2026-10-02'});
  assert.equal(hit.asset_id,'PHONE-001');
  assert.equal(hit.conflicting_event_id,'EVT-B');
  assert.equal(guard.findEventDateAssetCollision(snapshot,{action:'updateEvent',event_id:'EVT-A',event_date:'2026-10-03'}),null);
});

test('web cleanup is fail-closed until accepted safe Apps Script lineage is deployed',()=>{
  const src=fs.readFileSync('api/kk-admin-guard.js','utf8');
  assert.match(src,/cleanupGuarded=action==='cleanupOldData'/);
  assert.match(src,/CLEANUP_REQUIRES_ACCEPTED_APPS_SCRIPT_9_5_12/);
});

test('9.5.13 candidate carries safe cleanup and all secondary audit guards',()=>{
  assert.match(candidate,/9_5_13_FULL_BACKEND_AUDIT/);
  const cleanup=fn(candidate,'kkCleanupOldData30Days_');
  assert.match(cleanup,/skippedOrphanBookings/);
  assert.match(cleanup,/bookingClearA1s\.push\(\`A\$\{sourceRow\}:T\$\{sourceRow\}\`\)/);
  assert.match(cleanup,/kkRebuildCustomerStatsFromArchive_\(\)/);
  assert.doesNotMatch(cleanup,/event && event\.event_date \? kkDateObj_/);
  assert.match(candidate,/function kkBookingArchiveIdentity_/);
  assert.match(candidate,/function kkRebuildCustomerStatsFromArchive_/);
  assert.match(candidate,/function kkAssertEventDateChangeSafe_/);
  assert.match(candidate,/function kkAssertModelGroupType_/);
  assert.match(fn(candidate,'kkCreateEventFromDashboard'),/kkApiCreateEvent_\(/);
  assert.match(fn(candidate,'kkAddQuickBookingFromDashboard'),/kkApiCreateBooking_\(/);
});
