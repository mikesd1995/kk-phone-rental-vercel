const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../api/kk-admin-guard.js')._test;

test('event dates normalize to one identity day',()=>{
  assert.equal(T.normalizeEventDate('15/09/2026'),'2026-09-15');
  assert.equal(T.normalizeEventDate('2026-09-15'),'2026-09-15');
  assert.equal(T.normalizeEventDate('15/09/2569'),'2026-09-15');
});

test('Bangkok event guard identifies accidental past dates without blocking today or future dates',()=>{
  const now=new Date('2026-09-14T09:53:00Z'); // 16:53 in Bangkok
  assert.equal(T.bangkokTodayISO(now),'2026-09-14');
  assert.equal(T.isPastEventDate('17/06/2026',now),true);
  assert.equal(T.isPastEventDate('14/09/2026',now),false);
  assert.equal(T.isPastEventDate('17/09/2026',now),false);
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
