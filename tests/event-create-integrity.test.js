const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../api/kk-admin-guard.js')._test;

test('event dates normalize to one identity day',()=>{
  assert.equal(T.normalizeEventDate('15/09/2026'),'2026-09-15');
  assert.equal(T.normalizeEventDate('2026-09-15'),'2026-09-15');
  assert.equal(T.normalizeEventDate('15/09/2569'),'2026-09-15');
});

test('duplicate finder catches same event/date/venue even when hidden',()=>{
  const e={event_id:'EVT-OLD',event_name:'LABX GRAND OPENING DEXX THE EXPERIENCE 4TH ANNIVERSARY',event_date:'15/09/2026',venue:'centralwOrld',active_on_web:false};
  const found=T.findDuplicateEvent({events:[e]},{event_name:e.event_name,event_date:'2026-09-15',venue:'centralworld'});
  assert.equal(found.event_id,'EVT-OLD');
});

test('same title on another date is allowed',()=>{
  const e={event_id:'EVT-OLD',event_name:'Same Event',event_date:'2026-09-15',venue:'Venue A'};
  assert.equal(T.findDuplicateEvent({events:[e]},{event_name:'Same Event',event_date:'2026-09-16',venue:'Venue A'}),null);
});

test('omitted publish flag defaults true while explicit false is preserved',()=>{
  const a=T.prepareCreateEventPayload({action:'createEvent'});
  assert.equal(a.payload.active_on_web,true);
  assert.equal(a.publish_default_applied,true);
  const b=T.prepareCreateEventPayload({action:'createEvent',active_on_web:false});
  assert.equal(b.payload.active_on_web,false);
  assert.equal(b.publish_default_applied,false);
});
