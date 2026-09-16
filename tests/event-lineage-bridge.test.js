const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../server/event-lineage-bridge.js');

function row(date,core,extra={}){
  return Object.assign({
    event_family_id:'FAM|lykn-reflexion|20261023-25',
    tracker_show_id:'SHOWSET|lykn-reflexion|20261023-25',
    event_date:date,
    core_event_id:core
  },extra);
}

test('multi-day SHOWSET expands to one immutable show instance per date',()=>{
  const rows=B.validateLineageSet([
    row('2026-10-23','EVT-20261023-LYKN-REFLEXION'),
    row('2026-10-24','EVT-20261024-LYKN-REFLEXION'),
    row('2026-10-25','EVT-20261025-LYKN-REFLEXION')
  ]);
  assert.equal(rows.length,3);
  assert.equal(new Set(rows.map(x=>x.show_instance_id)).size,3);
  assert.equal(rows[0].show_instance_id,'SHOWSET|lykn-reflexion|20261023-25|DATE|2026-10-23');
});

test('one show instance cannot map to multiple Core events',()=>{
  assert.throws(()=>B.validateLineageSet([
    row('2026-10-23','EVT-20261023-LYKN-REFLEXION'),
    row('2026-10-23','EVT-20261023-LYKN-REFLEXION-2')
  ]),/show instance maps to multiple Core events/);
});

test('one Core event cannot map to multiple Tracker show instances',()=>{
  const a=row('2026-10-23','EVT-20261023-LYKN-REFLEXION');
  const b=Object.assign({},a,{tracker_show_id:'SHOW|lykn-reflexion|20261023|S1'});
  assert.throws(()=>B.validateLineageSet([a,b]),/Core event maps to multiple Tracker show instances/);
});

test('Core EVT date must match explicit Tracker event date',()=>{
  assert.throws(()=>B.buildLineageRecord(row('2026-10-23','EVT-20261024-LYKN-REFLEXION')),/does not match event_date/);
});

test('ticket SOLD_OUT never implicitly changes rental lifecycle',()=>{
  const mapped=B.buildLineageRecord(row('2026-10-23','EVT-20261023-LYKN-REFLEXION',{ticket_lifecycle:'SOLD_OUT'}));
  assert.equal(mapped.ticket_lifecycle,'SOLD_OUT');
  assert.equal(mapped.rental_lifecycle,null);
});

test('mapping requires an explicit existing Core event id instead of name heuristics',()=>{
  assert.throws(()=>B.buildLineageRecord({
    event_family_id:'FAM|x|20261023',
    tracker_show_id:'SHOW|x|20261023|S1',
    event_date:'2026-10-23'
  }),/core_event_id is required/);
});

test('same mapping input produces the same lineage key',()=>{
  const a=B.buildLineageRecord(row('2026-10-23','EVT-20261023-LYKN-REFLEXION'));
  const b=B.buildLineageRecord(row('23/10/2569','EVT-20261023-LYKN-REFLEXION'));
  assert.equal(a.lineage_key,b.lineage_key);
});

test('resolver returns only the explicitly mapped Core event',()=>{
  const rows=[
    row('2026-10-23','EVT-20261023-LYKN-REFLEXION'),
    row('2026-10-24','EVT-20261024-LYKN-REFLEXION')
  ];
  assert.equal(B.resolveCoreEventId(rows,{
    event_family_id:'FAM|lykn-reflexion|20261023-25',
    tracker_show_id:'SHOWSET|lykn-reflexion|20261023-25',
    event_date:'2026-10-24'
  }),'EVT-20261024-LYKN-REFLEXION');
});
