'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Plan=require('../server/event-integrity-plan.js');

test('date-aligned proposal preserves the suffix and reports references without mutating input',()=>{
  const snapshot={
    events:[{
      event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2',
      event_name:'LYKN REFLEXION CONCERT',
      event_date:'23/10/2026',
      venue:'IMPACT Arena'
    }],
    bookings:[{booking_id:'BK-1',event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2'}],
    overrides:[{event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2',template_id:'TPL-BUNDLE'}],
    web_packages:[{
      event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2',
      package_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2-TPL-BUNDLE'
    }]
  };
  const before=JSON.stringify(snapshot);
  const report=Plan.buildPlan(snapshot);
  assert.equal(report.mode,'DRY_RUN');
  assert.equal(report.mutates,false);
  assert.equal(report.id_date_drift_count,1);
  assert.equal(report.id_date_drift[0].proposed_event_id,'EVT-20261023-LYKN-REFLEXION-CONCERT-2');
  assert.equal(report.id_date_drift[0].status,'SAFE_CANDIDATE');
  assert.ok(report.id_date_drift[0].references.some(x=>x.dataset==='bookings'&&x.kind==='exact_event_id'));
  assert.ok(report.id_date_drift[0].references.some(x=>x.dataset==='web_packages'&&x.kind==='derived_package_id'));
  assert.equal(JSON.stringify(snapshot),before);
});

test('existing proposed id blocks automatic date migration',()=>{
  const report=Plan.buildPlan({
    events:[
      {event_id:'EVT-20261025-X-2',event_name:'X',event_date:'23/10/2026',venue:'V'},
      {event_id:'EVT-20261023-X-2',event_name:'Different X',event_date:'23/10/2026',venue:'Other V'}
    ]
  });
  assert.equal(report.id_date_drift_count,1);
  assert.equal(report.id_date_drift[0].proposed_event_id,'EVT-20261023-X-2');
  assert.equal(report.id_date_drift[0].status,'BLOCKED_COLLISION');
  assert.equal(report.blockers.collision_count,1);
});

test('logical duplicates are review-required and never receive an automatic canonical id',()=>{
  const report=Plan.buildPlan({
    events:[
      {event_id:'EVT-20260916-MITH',event_name:'The 11th Anniversary with MITH',event_date:'16/09/2026',venue:'centralwOrld'},
      {event_id:'EVT-20260916-MITH-2',event_name:'the_11th anniversary with mith',event_date:'2026-09-16',venue:'CENTRAL WORLD'}
    ],
    bookings:[]
  });
  assert.equal(report.logical_duplicate_group_count,1);
  assert.equal(report.logical_duplicate_groups[0].status,'REVIEW_REQUIRED');
  assert.equal(report.logical_duplicate_groups[0].automatic_canonical_selection,false);
  assert.equal(Object.prototype.hasOwnProperty.call(report.logical_duplicate_groups[0],'canonical_event_id'),false);
});

test('clean events produce no proposed repair work',()=>{
  const report=Plan.buildPlan({
    events:[
      {event_id:'EVT-20260920-A',event_name:'A',event_date:'20/09/2026',venue:'V1'},
      {event_id:'EVT-20260921-B',event_name:'B',event_date:'21/09/2026',venue:'V2'}
    ]
  });
  assert.equal(report.id_date_drift_count,0);
  assert.equal(report.logical_duplicate_group_count,0);
  assert.deepEqual(report.blockers,{collision_count:0,duplicate_review_count:0});
});
