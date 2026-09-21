'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Health=require('../admin/snapshot-health.js');

function base(){
  return {
    events:[
      {event_id:'EVT-1',event_name:'Event One',event_date:'2026-10-01',venue:'CentralWorld'},
      {event_id:'EVT-2',event_name:'Event Two',event_date:'2026-10-02',venue:'central world'}
    ],
    bookings:[],
    current_bookings:[],
    assets:[],
    health:[]
  };
}

test('storefront integrity reports malformed, orphan and negative package rows as warnings only',()=>{
  const data=base();
  data.web_packages=[
    {package_id:'PKG-1',event_id:'EVT-1',package_type:'phone_only',available_count:2,raw_available_count:2},
    {package_id:'',event_id:'',package_type:'',available_count:'',raw_available_count:''},
    {package_id:'PKG-ORPHAN',event_id:'EVT-X',package_type:'phone_only',available_count:1,raw_available_count:1},
    {package_id:'PKG-NEG',event_id:'EVT-1',package_type:'phone_only',available_count:-1,raw_available_count:-1}
  ];
  const report=Health.assess(data);
  assert.equal(report.ok,true);
  assert.equal(report.storefront_integrity.invalid_package_identity_count,1);
  assert.equal(report.storefront_integrity.orphan_package_count,1);
  assert.equal(report.storefront_integrity.negative_availability_count,1);
  assert.match(report.warnings.join('\n'),/invalid web package identity rows 1/);
  assert.match(report.warnings.join('\n'),/orphan web packages 1/);
  assert.match(report.warnings.join('\n'),/negative package availability rows 1/);
});

test('storefront integrity surfaces published missing-poster and past-event rows',()=>{
  const data=base();
  data.web_ready=[
    {event_id:'EVT-1',event_date:'2026-01-01',event_name:'Event One',action_for_web:'show',poster_image_url:''},
    {event_id:'EVT-2',event_date:'2026-10-02',event_name:'Event Two',action_for_web:'hide',poster_image_url:''},
    {event_id:'EVT-X',event_date:'2026-10-03',event_name:'Ghost',action_for_web:'show',poster_image_url:'https://example.test/p.jpg'}
  ];
  const signals=Health.storefrontIntegritySignals(data,'2026-09-22');
  assert.equal(signals.missing_poster_count,1);
  assert.equal(signals.published_past_event_count,1);
  assert.equal(signals.orphan_web_ready_count,1);
  assert.match(signals.warnings.join('\n'),/published events missing poster 1/);
  assert.match(signals.warnings.join('\n'),/published past events 1/);
  assert.match(signals.warnings.join('\n'),/orphan web-ready events 1/);
});

test('storefront integrity detects venue naming variants without blocking snapshot transport',()=>{
  const data=base();
  const report=Health.assess(data);
  assert.equal(report.ok,true);
  assert.equal(report.storefront_integrity.venue_variant_group_count,1);
  assert.match(report.warnings.join('\n'),/venue naming variants 1/);
});

test('clean storefront data keeps integrity counters at zero',()=>{
  const data={
    events:[{event_id:'EVT-1',event_name:'Event',event_date:'2026-10-01',venue:'IMPACT Arena'}],
    bookings:[],
    current_bookings:[],
    assets:[],
    web_ready:[{event_id:'EVT-1',event_name:'Event',event_date:'2026-10-01',action_for_web:'show',poster_image_url:'https://example.test/p.jpg'}],
    web_packages:[{package_id:'PKG-1',event_id:'EVT-1',package_type:'phone_only',available_count:1,raw_available_count:1}],
    health:[]
  };
  const signals=Health.storefrontIntegritySignals(data,'2026-09-22');
  assert.deepEqual({
    invalid:signals.invalid_package_identity_count,
    orphan:signals.orphan_package_count,
    negative:signals.negative_availability_count,
    poster:signals.missing_poster_count,
    past:signals.published_past_event_count,
    ready:signals.orphan_web_ready_count,
    venue:signals.venue_variant_group_count
  },{invalid:0,orphan:0,negative:0,poster:0,past:0,ready:0,venue:0});
  assert.equal(signals.warnings.length,0);
});
