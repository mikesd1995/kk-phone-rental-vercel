'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../server/rental-dashboard-core.js')._test;

test('dashboard helper backfills a missing event date from current event metadata',()=>{
  const current=[
    'event_id,event_name,event_date,venue,poster_image_url,event_status,active_on_web,event_note,data_health',
    'EVT-20261010-REMASTER-CONCERT,REMASTER CONCERT,10/10/2026,PARAGON HALL,,open,TRUE,,OK'
  ].join('\n');
  const archive='event_id,event_name,event_date,venue\n';
  const helper=[
    'Source,Booking ID,Created At,Booking Status,Event ID,Event Name,Event Date,Customer Key,Customer Name,Phone,Channel,Package Type,Payment Status,Amount Received,Event Month',
    'MASTER,BK-20261010-001,30/9/2026,confirmed,EVT-20261010-REMASTER-CONCERT,REMASTER CONCERT,,CUS-0037,,,,phone_lens_bundle,paid,590,'
  ].join('\n');
  const meta=core.eventMetadata(current,archive,[]);
  const rows=core.parseHelper(helper,meta,[]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].event_date,'10/10/2026');
  assert.equal(rows[0].month,'2026-10');
});

test('helper event date still wins when it is present',()=>{
  const current='event_id,event_name,event_date,venue\nEVT-1,EVENT,10/10/2026,VENUE';
  const helper=[
    'Source,Booking ID,Created At,Booking Status,Event ID,Event Name,Event Date,Customer Key,Customer Name,Phone,Channel,Package Type,Payment Status,Amount Received,Event Month',
    'MASTER,BK-1,1/10/2026,confirmed,EVT-1,EVENT,11/10/2026,CUS-1,,,,phone_only,unpaid,590,'
  ].join('\n');
  const meta=core.eventMetadata(current,'event_id,event_name,event_date,venue\n',[]);
  const rows=core.parseHelper(helper,meta,[]);
  assert.equal(rows[0].event_date,'11/10/2026');
  assert.equal(rows[0].month,'2026-10');
});
