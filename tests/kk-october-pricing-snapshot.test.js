'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../server/kk-october-pricing-snapshot.js');
const Router=require('../server/kk-agent-task-router.js');
const Registry=require('../server/kk-agent-registry.js');
const id='EVT-20261028-BENTON-JOURNEY-BACK-TO-GLOW';
const other='EVT-20261007-RYO-HAIR-X-TEETEEPOR';
function ev(date='28/10/2026',visible='TRUE',poster=''){
 return [id,'BENTON TeeTeePor',date,'Bangkok',poster,'open',visible,'note','OK'];
}
function packageRows(){
 return [
 ['P-1',id,'phone_only','','','','', '490','2','available'],
 ['P-2',id,'phone_lens_bundle','','','','','590','2','available']
 ];
}
function b(status,date,otherId=other,amount='690',kind='phone_lens_bundle',bid='BK-1'){
 const r=Array(30).fill('');
 r[0]=bid;r[2]=status;r[3]=otherId;r[8]=kind;r[14]=amount;r[21]=date;
 r[4]='CUSTOMER NAME';r[5]='CUSTOMER PERSONAL LINE';r[6]='PRIVATE PHONE';
 return r;
}
test('Sheets serial and displayed date normalize identically',()=>{
 assert.equal(S.serialDate(46318),'2026-10-23');
 assert.equal(S.serialDate('46318'),'2026-10-23');
 assert.equal(S.serialDate('28/10/2026'),'2026-10-28');
 assert.equal(S.serialDate('2026-10-28'),'2026-10-28');
 assert.equal(S.serialDate('32/10/2026'),null);
});
test('October only, no November snapshot can be produced',()=>{
 assert.throws(()=>S.currentSnapshot(ev('01/11/2026'),packageRows(),[]),/OCTOBER_2026_ONLY/);
});
test('existing Core price 490/590 retained, unknown market never treated as searched-zero',()=>{
 const q=S.currentSnapshot(ev(),packageRows(),[],{eventVerified:true});
 assert.equal(q.input.current_phone_price,490);
 assert.equal(q.input.current_bundle_price,590);
 assert.equal(q.input.event_verified,true);
 assert.equal(q.input.independent_competitors,null);
 assert.equal(q.input.competitor_market_status,'UNKNOWN');
 assert.equal(q.production_writes,0);
});
test('bookings on same date protect every event even if event_ids differ and phone stock remains 2',()=>{
 const q=S.currentSnapshot(ev('23/10/2026'),packageRows(),[b('confirmed',46318,'EVT-LYKN-OTHER')]);
 assert.equal(q.input.has_active_booking_on_date,true);
 assert.equal(q.safety_summary.active_bookings_on_date,1);
 assert.equal(q.input.available_inventory,2);
});
test('future pending/returned/uploaded lock; cancelled/no-show/completed are not future booking locks',()=>{
 for(const status of ['pending','confirmed','prepared','picked_up','returned','uploaded']){
  const r=S.currentSnapshot(ev(),packageRows(),[b(status,'2026-10-28')]);
  assert.equal(r.input.has_active_booking_on_date,true,status);
 }
 for(const status of ['cancelled','no_show','completed']){
  const r=S.currentSnapshot(ev(),packageRows(),[b(status,'2026-10-28')]);
  assert.equal(r.input.has_active_booking_on_date,false,status);
 }
});
test('owner hidden and no verified inventory safely carried to policy',()=>{
 const q=S.currentSnapshot(ev('28/10/2026','FALSE'),[],[],{ownerPriceLocked:true});
 assert.equal(q.input.owner_hidden,true);
 assert.equal(q.input.owner_price_locked,true);
 assert.equal(q.input.available_inventory,null);
});
test('missing original poster is a truthful flag, not a fabricated HTTPS image',()=>{
 assert.equal(S.currentSnapshot(ev(),packageRows(),[]).safety_summary.poster_source_present,false);
 assert.equal(S.currentSnapshot(ev('28/10/2026','TRUE','https://example.com/current-exact.jpg'),packageRows(),[]).safety_summary.poster_source_present,true);
});
test('only actual completed comparable paid package rows are learning inputs',()=>{
 const list=[
 b('completed',46295,other,'690','phone_lens_bundle','BK1'),
 b('cancelled',46295,other,'1090','phone_lens_bundle','BK2'),
 b('confirmed',46295,other,'990','phone_lens_bundle','BK3'),
 b('completed',46295,other,'0','phone_lens_bundle','BK4'),
 b('completed',46295,'EVT-NOT-VERIFIED','890','phone_lens_bundle','BK5'),
 b('completed',46295,other,'690','phone_lens_bundle','BK1')
 ];
 const q=S.completedComparableHistory(list,{verifiedComparableEventIds:[other],
  targetEventId:id,targetEventDate:'2026-10-28'});
 assert.equal(q.length,1);
 assert.equal(q[0].paid_price,690);
 assert.equal(q[0].package_type,'phone_lens_bundle');
 assert.equal(q[0].verified,true);
});
test('output contains no customer PII, even with named booking record',()=>{
 const current=S.currentSnapshot(ev(),packageRows(),[b('confirmed','2026-10-28')]);
 const history=S.completedComparableHistory([b('completed',46295)],{
  verifiedComparableEventIds:[other],targetEventId:id,targetEventDate:'2026-10-28'});
 for(const x of [current,history]){
  const json=JSON.stringify(x);
  assert.equal(json.includes('CUSTOMER NAME'),false);
  assert.equal(json.includes('CUSTOMER PERSONAL LINE'),false);
  assert.equal(json.includes('PRIVATE PHONE'),false);
 }
});
test('no paid or future completed receipts can be counted as history',()=>{
 const rows=[b('completed',46318,other,'690','phone_lens_bundle','FUTURE'),
  b('completed',46310,other,'690','phone_lens_bundle','OLDER')];
 const q=S.completedComparableHistory(rows,{verifiedComparableEventIds:[other],
  targetEventId:id,targetEventDate:'2026-10-20'});
 assert.equal(q.length,1);
 assert.equal(q[0].booking_id,'OLDER');
});

test('October Core snapshot is reachable through declared read-only Agent Gateway route',async()=>{
 const r=await Router.executeTask('prepare_october_pricing_snapshot',{
  eventRow:ev(),packageRows:packageRows(),bookingRows:[b('confirmed','2026-10-28')],
  options:{eventVerified:true}
 });
 assert.equal(r.result.input.has_active_booking_on_date,true);
 assert.equal(r.result.input.current_bundle_price,590);
 assert.equal(r.result.production_writes,0);
 assert.equal(Registry.validateInvocation('prepare_october_pricing_snapshot',r.invoked_agents).pass,true);
});
test('October paid comparable extraction route is declared and remains PII free',async()=>{
 const rows=[b('completed',46295,other,'690','phone_lens_bundle','BK-POST')];
 const r=await Router.executeTask('prepare_october_completed_history',{bookingRows:rows,options:{
  targetEventId:id,targetEventDate:'2026-10-28',verifiedComparableEventIds:[other]}});
 assert.equal(r.result.length,1);
 assert.equal(r.result[0].paid_price,690);
 assert.equal(Registry.validateInvocation('prepare_october_completed_history',r.invoked_agents).pass,true);
 assert.equal(JSON.stringify(r.result).includes('CUSTOMER NAME'),false);
});

test('organizer-confirmed 16–18 October supersedes conflicting aggregator festival date',()=>{
 const schedule={verified:true,source_url:'https://www.ppat2508.org/46489/',dates:[
 '2026-10-16','2026-10-17','2026-10-18']};
 const friday=S.currentSnapshot(ev('16/10/2026'),packageRows(),[],{officialSchedule:schedule,eventVerified:true});
 const phantom=S.currentSnapshot(ev('15/10/2026'),packageRows(),[],{officialSchedule:schedule,eventVerified:true});
 assert.equal(friday.input.event_source_conflict,false);
 assert.equal(friday.safety_summary.first_party_schedule_checked,true);
 assert.equal(phantom.input.event_source_conflict,true);
 assert.equal(phantom.safety_summary.event_date_conflicts_official,true);
 assert.equal(phantom.input.production_writes,0);
});
test('unverified or malformed organizer schedule cannot be asserted as verified',()=>{
 const x=S.currentSnapshot(ev('15/10/2026'),packageRows(),[],{
  officialSchedule:{verified:false,source_url:'https://example.com/schedule',dates:['2026-10-16']}
 });
 const y=S.currentSnapshot(ev('15/10/2026'),packageRows(),[],{
  officialSchedule:{verified:true,source_url:'not-an-url',dates:['2026-10-16']}
 });
 assert.equal(x.safety_summary.first_party_schedule_checked,false);
 assert.equal(y.safety_summary.first_party_schedule_checked,false);
 assert.equal(x.input.event_source_conflict,false);
});
