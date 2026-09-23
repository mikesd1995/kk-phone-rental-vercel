'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/verifier-no-drop-reconciliation.js');

function fanivalDay(day){
  const dd=String(day).padStart(2,'0');
  return {
    'Work Packet ID':'WP|SHOW|gmmtv-fanival-2026|202610'+dd+'|S1|OWNER',
    'Packet Status':'READY_FOR_VERIFIER',
    'Event Family ID':'FAM|gmmtv-fanival-2026|20261001-13',
    'Show ID':'SHOW|gmmtv-fanival-2026|202610'+dd+'|S1',
    'Event Date':'2026-10-'+dd
  };
}
function candidate(day){
  const dd=String(day).padStart(2,'0');
  return {
    'Status':'READY_FOR_VERIFIER',
    'Event Family ID':'FAM|gmmtv-fanival-2026|20261001-13',
    'Show ID':'SHOW|gmmtv-fanival-2026|202610'+dd+'|S1',
    'Suspected Event Date':'2026-10-'+dd
  };
}

test('AI Inbox is the operational packet anchor; Candidate does not need Work Packet ID',()=>{
  const ai=[fanivalDay(1)];
  const candidates=[candidate(1)];
  const out=R.auditReadyPairing(ai,candidates);
  assert.equal(out.ready_count,1);
  assert.equal(out.paired_count,1);
  assert.equal(out.pairing_debt_count,0);
  assert.equal(out.pairs[0].join_method,'SHOW_ID');
  assert.equal(out.production_writes,0);
});

test('exact Show ID duplication fails into explicit pairing debt instead of fuzzy selection',()=>{
  const ai=[fanivalDay(1)];
  const candidates=[candidate(1),candidate(1)];
  const out=R.auditReadyPairing(ai,candidates);
  assert.equal(out.pairing_debt_count,1);
  assert.equal(out.pairs[0].debt,'MULTIPLE_CANDIDATE_SHOW_ID_MATCHES');
});

test('FANIVAL 13-day family stays incomplete when only 11 days have lineage disposition',()=>{
  const ai=Array.from({length:13},(_,i)=>fanivalDay(i+1));
  const candidates=Array.from({length:13},(_,i)=>candidate(i+1));
  const monthly=ai.map(x=>({
    event_family_id:x['Event Family ID'],
    show_id:x['Show ID'],
    event_date:x['Event Date']
  }));
  const lineage=ai.slice(0,11).map((x,i)=>({
    event_family_id:x['Event Family ID'],
    tracker_show_id:x['Show ID'],
    event_date:x['Event Date'],
    core_event_id:'EVT-202610'+String(i+1).padStart(2,'0')+'-GMMTV-FANIVAL'
  }));
  const out=R.auditFamilyCompleteness(ai,candidates,monthly,lineage,[]);
  assert.equal(out.families.length,1);
  assert.equal(out.families[0].expected_day_count,13);
  assert.equal(out.families[0].monthly_disposition_count,13);
  assert.equal(out.families[0].core_lineage_or_debt_count,11);
  assert.equal(out.families[0].status,'FAMILY_COMPLETENESS_DEBT');
  assert.equal(out.families[0].missing_core_lineage_or_debt.length,2);
});

test('Core rows without explicit lineage are surfaced as reverse orphans',()=>{
  const core=[
    {event_id:'EVT-1',event_name:'GMMTV FANIVAL',event_date:'01/10/2026'},
    {event_id:'EVT-2',event_name:'GMMTV FANIVAL',event_date:'02/10/2026'}
  ];
  const lineage=[{core_event_id:'EVT-1'}];
  const out=R.auditCoreReverseOrphans(core,lineage);
  assert.equal(out.reverse_orphan_count,1);
  assert.equal(out.orphans[0].core_event_id,'EVT-2');
  assert.equal(out.orphans[0].debt,'REVERSE_CORE_ORPHAN');
  assert.equal(out.production_writes,0);
});
