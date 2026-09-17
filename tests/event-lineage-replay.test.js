'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/event-lineage-replay.js');

const rows=[
  {
    event_family_id:'FAM|plave-keep-it-manic|20261010',
    tracker_show_id:'SHOW|plave-keep-it-manic|20261010|S1',
    event_date:'2026-10-10',
    core_event_id:'EVT-20261026-2026-PLAVE-WORLD-TOUR-KEEP-I'
  },
  {
    event_family_id:'FAM|lykn-reflexion|20261023-25',
    tracker_show_id:'SHOWSET|lykn-reflexion|20261023-25',
    event_date:'2026-10-23',
    core_event_id:'EVT-20261023-LYKN-REFLEXION'
  },
  {
    event_family_id:'FAM|lykn-reflexion|20261023-25',
    tracker_show_id:'SHOWSET|lykn-reflexion|20261023-25',
    event_date:'2026-10-24',
    core_event_id:'EVT-20261024-LYKN-REFLEXION'
  }
];

test('read-only lineage replay is deterministic across repeated iterations',()=>{
  const r=R.replayLineageSet(rows,{iterations:25});
  assert.equal(r.mapping_count,3);
  assert.equal(r.unique_lineage_keys,3);
  assert.equal(r.unique_show_instances,3);
  assert.equal(r.unique_core_event_ids,3);
  assert.equal(r.deterministic,true);
  assert.equal(r.production_writes,0);
});

test('opaque Core IDs do not override explicit current event_date during replay',()=>{
  const r=R.replayLineageSet([rows[0]],{iterations:10});
  assert.equal(r.records[0].event_date,'2026-10-10');
  assert.equal(r.records[0].core_event_id,'EVT-20261026-2026-PLAVE-WORLD-TOUR-KEEP-I');
});

test('dry-run resolver performs zero writes and returns only explicit mapping',()=>{
  const r=R.dryRunResolve(rows,[{
    event_family_id:'FAM|plave-keep-it-manic|20261010',
    tracker_show_id:'SHOW|plave-keep-it-manic|20261010|S1',
    event_date:'10/10/2569'
  }]);
  assert.equal(r.production_writes,0);
  assert.equal(r.results[0].core_event_id,'EVT-20261026-2026-PLAVE-WORLD-TOUR-KEEP-I');
});

test('replay refuses one Core event mapped to multiple show instances',()=>{
  const bad=[rows[0],{
    event_family_id:'FAM|other|20261011',
    tracker_show_id:'SHOW|other|20261011|S1',
    event_date:'2026-10-11',
    core_event_id:rows[0].core_event_id
  }];
  assert.throws(()=>R.replayLineageSet(bad),/Core event maps to multiple Tracker show instances/);
});
