'use strict';
const assert = require('assert');
const { buildProjection } = require('../lib/kk-crm-projection');

const CRM_EVENT = 'EVT-20261016-OH-MY-FOURTH-CONCERT';
const NOW = Date.parse('2026-09-04T11:45:00+07:00');
function fixture(overrides = {}) {
  return {
    crosswalk: {
      identity_verified: true,
      machine_show_id: 'CRMSET|OH-MY-FOURTH|20261016',
      crm_event_id: CRM_EVENT,
      identity_evidence: ['event_name=OH MY FOURTH CONCERT', 'event_date=16/10/2026', 'venue=BITEC LIVE']
    },
    web_ready_rows: [{ event_id: CRM_EVENT, available_phone_count: '2', available_lens_count: '2', booking_status_for_web: 'เปิดจอง', action_for_web: 'show', customer_name: 'MUST_NOT_LEAK', phone: '0999999999' }],
    package_rows: [
      { event_id: CRM_EVENT, package_type: 'phone_only', model_group:'VIVO_X300_PRO', lens_group:'NONE', available_qty: '2', status: 'available' },
      { event_id: CRM_EVENT, package_type: 'lens_only', model_group:'NONE', lens_group:'ZEISS_2_35X', available_qty: '2', status: 'available' },
      { event_id: CRM_EVENT, package_type: 'phone_lens_bundle', model_group:'VIVO_X300_PRO', lens_group:'ZEISS_2_35X', available_qty: '2', status: 'available' }
    ],
    asset_rows: [
      { asset_id: 'PHONE-001', asset_type: 'phone', model_group: 'VIVO_X300_PRO', rentable_now: true },
      { asset_id: 'PHONE-002', asset_type: 'phone', model_group: 'VIVO_X300_PRO', rentable_now: 'TRUE' },
      { asset_id: 'LENS-001', asset_type: 'lens', model_group: 'ZEISS_2_35X', rentable_now: true },
      { asset_id: 'LENS-004', asset_type: 'lens', model_group: 'ZEISS_2_35X', rentable_now: 'TRUE' },
      { asset_id: 'LENS-002', asset_type: 'lens', model_group: 'G2', rentable_now: false }
    ],
    source_checked_at: '2026-09-04T11:43:00+07:00',
    now_ms: NOW,
    max_age_ms: 15 * 60 * 1000,
    ...overrides
  };
}
let count=0;function test(name,fn){fn();count++;}

test('current projection',()=>{const out=buildProjection(fixture());assert.equal(out.schema_version,2);assert.equal(out.freshness,'CURRENT');assert.equal(out.phone_available,2);assert.equal(out.lens_available,2);assert.equal(out.exact_phone_model_rentable,2);assert.equal(out.exact_lens_model_rentable,2);assert.equal(out.g1_rentable,2);assert.equal(out.g2_rentable,0);assert.equal(out.bundle_available,2);assert.equal(out.write_boundary,'READ_ONLY_CRM_PROJECTION');const s=JSON.stringify(out);assert(!s.includes('MUST_NOT_LEAK'));assert(!s.includes('0999999999'));});
test('stale becomes stale',()=>{assert.equal(buildProjection(fixture({source_checked_at:'2026-09-04T10:00:00+07:00'})).freshness,'STALE');});
test('future source fails',()=>{assert.throws(()=>buildProjection(fixture({source_checked_at:'2026-09-04T12:00:01+07:00'})),/future timestamp/);});
test('crosswalk required',()=>{const x=fixture();x.crosswalk={...x.crosswalk,identity_verified:false};assert.throws(()=>buildProjection(x),/identity_verified=true required/);});
test('crosswalk unique evidence >=2',()=>{const x=fixture();x.crosswalk={...x.crosswalk,identity_evidence:['same','same']};assert.throws(()=>buildProjection(x),/two independent/);});
test('exact id required',()=>{const x=fixture();x.crosswalk={...x.crosswalk,crm_event_id:'EVT-WRONG'};assert.throws(()=>buildProjection(x),/expected exactly one row, got 0/);});
test('negative counts fail',()=>{const x=fixture();x.web_ready_rows[0].available_phone_count='-1';assert.throws(()=>buildProjection(x),/expected non-negative integer/);});
test('web pair capacity fails',()=>{const x=fixture();x.package_rows.find(r=>r.package_type==='phone_lens_bundle').available_qty='3';assert.throws(()=>buildProjection(x),/phone\/lens pair capacity/);});
test('full means zero',()=>{const x=fixture();const b=x.package_rows.find(r=>r.package_type==='phone_lens_bundle');b.status='full';b.available_qty='1';assert.throws(()=>buildProjection(x),/full status with nonzero quantity/);});
test('hidden effective zero',()=>{const x=fixture();const b=x.package_rows.find(r=>r.package_type==='phone_lens_bundle');b.status='hidden';const o=buildProjection(x);assert.equal(o.raw_bundle_available,2);assert.equal(o.bundle_available,0);});
test('wrong phone model cannot satisfy capacity',()=>{const x=fixture();x.asset_rows[1]={asset_id:'PHONE-OTHER',asset_type:'phone',model_group:'OTHER_PHONE',rentable_now:true};assert.throws(()=>buildProjection(x),/exact phone-model assets/);});
test('wrong lens model cannot satisfy capacity',()=>{const x=fixture();x.asset_rows[3]={asset_id:'LENS-OTHER',asset_type:'lens',model_group:'OTHER_LENS',rentable_now:true};assert.throws(()=>buildProjection(x),/exact lens-model assets/);});
test('bundle phone model required',()=>{const x=fixture();x.package_rows.find(r=>r.package_type==='phone_lens_bundle').model_group='NONE';assert.throws(()=>buildProjection(x),/phone model_group required/);});
test('bundle lens model required',()=>{const x=fixture();x.package_rows.find(r=>r.package_type==='phone_lens_bundle').lens_group='';assert.throws(()=>buildProjection(x),/lens_group required/);});
test('duplicate bundle fails exact one',()=>{const x=fixture();x.package_rows.push({...x.package_rows[2]});assert.throws(()=>buildProjection(x),/expected exactly one row, got 2/);});
test('unsupported status fails',()=>{const x=fixture();x.package_rows.find(r=>r.package_type==='phone_lens_bundle').status='maybe';assert.throws(()=>buildProjection(x),/status unsupported/);});
test('mixed event package rows cannot affect exact event',()=>{const x=fixture();x.package_rows.push({event_id:'OTHER',package_type:'phone_lens_bundle',model_group:'BAD',lens_group:'BAD',available_qty:'999',status:'available'});const o=buildProjection(x);assert.equal(o.bundle_available,2);});
test('invalid clock fails',()=>{assert.throws(()=>buildProjection(fixture({now_ms:'bad'})),/invalid clock/);});
test('missing physical inventory read cannot authorize positive capacity',()=>{const x=fixture();delete x.asset_rows;assert.throws(()=>buildProjection(x),/asset_rows/);});
test('explicitly empty inventory cannot prove positive capacity',()=>{assert.throws(()=>buildProjection(fixture({asset_rows:[]})),/physical|exact phone-model/);});
test('duplicate asset identity cannot double physical capacity',()=>{const x=fixture();x.asset_rows[1]={...x.asset_rows[0]};assert.throws(()=>buildProjection(x),/asset.*identity/i);});
test('missing asset identity requires reconciliation',()=>{const x=fixture();delete x.asset_rows[0].asset_id;assert.throws(()=>buildProjection(x),/asset.*identity/i);});
test('array count is not integer evidence',()=>{const x=fixture();x.web_ready_rows[0].available_phone_count=[2];assert.throws(()=>buildProjection(x),/integer/);});
test('array boolean is not rentable evidence',()=>{const x=fixture();x.asset_rows[0].rentable_now=[true];assert.throws(()=>buildProjection(x),/rentable/);});
console.log(`kk-crm-projection: ${count}/${count} PASS`);
