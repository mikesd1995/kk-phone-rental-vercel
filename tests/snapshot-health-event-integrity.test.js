'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Health=require('../admin/snapshot-health.js');

function snapshot(events){
  return {
    events:events||[],
    bookings:[],
    current_bookings:[],
    assets:[],
    health:[]
  };
}

test('logical duplicate detection matches normalized name/date/venue identity',()=>{
  const report=Health.assess(snapshot([
    {
      event_id:'EVT-20260915-LABX-A',
      event_name:'LABX GRAND OPENING - DEXX',
      event_date:'15/09/2026',
      venue:'centralWorld'
    },
    {
      event_id:'EVT-20260915-LABX-B',
      event_name:' labx grand opening - dexx ',
      event_date:'2026-09-15',
      venue:'CENTRAL WORLD'
    }
  ]));
  assert.equal(report.ok,true);
  assert.equal(report.event_integrity.logical_duplicate_group_count,1);
  assert.equal(report.event_integrity.logical_duplicate_groups[0].event_ids.length,2);
  assert.match(report.warnings.join('\n'),/logical duplicate identity groups 1/);
});

test('same normalized name/date with distinct known venues is not duplicate',()=>{
  const signals=Health.eventIdentitySignals([
    {
      event_id:'EVT-20260915-A',
      event_name:'Same Event',
      event_date:'2026-09-15',
      venue:'Venue A'
    },
    {
      event_id:'EVT-20260915-B',
      event_name:'Same Event',
      event_date:'15/09/2026',
      venue:'Venue B'
    }
  ]);
  assert.equal(signals.logical_duplicate_group_count,0);
});

test('missing venue preserves Admin guard semantics and still detects same name/date duplicate',()=>{
  const signals=Health.eventIdentitySignals([
    {
      event_id:'EVT-20260915-A',
      event_name:'Same Event',
      event_date:'2026-09-15',
      venue:''
    },
    {
      event_id:'EVT-20260915-B',
      event_name:'same_event',
      event_date:'15/09/2026',
      venue:'Venue B'
    }
  ]);
  assert.equal(signals.logical_duplicate_group_count,1);
});

test('event id date drift is surfaced without converting transport health to failure',()=>{
  const report=Health.assess(snapshot([
    {
      event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2',
      event_name:'LYKN REFLEXION CONCERT',
      event_date:'23/10/2026',
      venue:'IMPACT Arena'
    }
  ]));
  assert.equal(report.ok,true);
  assert.equal(report.event_integrity.id_date_drift_count,1);
  assert.deepEqual(report.event_integrity.id_date_drift[0],{
    event_id:'EVT-20261025-LYKN-REFLEXION-CONCERT-2',
    id_date:'2026-10-25',
    event_date:'2026-10-23'
  });
  assert.match(report.warnings.join('\n'),/event_id\/date drift 1/);
  assert.equal(report.issues.length,0);
});

test('sheet serial dates normalize consistently for identity analysis',()=>{
  assert.equal(Health.normalizeEventDate('46285'),'2026-09-20');
  assert.equal(Health.normalizeEventDate(46285),'2026-09-20');
});

test('event identity text normalization remains aligned with Admin duplicate preflight',()=>{
  assert.equal(
    Health.normalizeEventIdentityText('  The 11th Anniversary_with.MITH  '),
    Health.normalizeEventIdentityText('the-11th anniversary with mith')
  );
});

test('clean event identities keep integrity counters at zero',()=>{
  const report=Health.assess(snapshot([
    {
      event_id:'EVT-20260920-A',
      event_name:'Event A',
      event_date:'20/09/2026',
      venue:'Venue A'
    },
    {
      event_id:'EVT-20260921-A',
      event_name:'Event A',
      event_date:'21/09/2026',
      venue:'Venue A'
    }
  ]));
  assert.equal(report.ok,true);
  assert.equal(report.event_integrity.logical_duplicate_group_count,0);
  assert.equal(report.event_integrity.id_date_drift_count,0);
  assert.equal(report.warnings.some(x=>/logical duplicate|event_id\/date drift/.test(x)),false);
});

test('multiple live-like anomalies are bounded in evidence output',()=>{
  const events=[];
  for(let i=0;i<12;i++){
    events.push({
      event_id:`EVT-20260915-GROUP-${i}`,
      event_name:'Repeated Event',
      event_date:'15/09/2026',
      venue:'Venue A'
    });
  }
  for(let i=0;i<15;i++){
    events.push({
      event_id:`EVT-202610${String(10+i).padStart(2,'0')}-DRIFT-${i}`,
      event_name:`Drift ${i}`,
      event_date:'01/10/2026',
      venue:'Venue B'
    });
  }
  const signals=Health.eventIdentitySignals(events);
  assert.equal(signals.logical_duplicate_group_count,1);
  assert.ok(signals.logical_duplicate_groups.length<=5);
  assert.ok(signals.id_date_drift.length<=10);
  assert.ok(signals.warnings.length<=2);
});
