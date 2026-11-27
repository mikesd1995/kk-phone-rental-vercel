'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {discover}=require('../server/kk-x-full-candidate-discovery.js');
const row=(id,date,action='show',status='เปิดจอง',stock=1)=>({event_id:id,event_name:id,event_date_text:date,action_for_web:action,booking_status_for_web:status,available_phone_count:stock});
test('full catalogue includes Jasper after first 24 cards but requires rendered CTA',()=>{
 const rows=Array.from({length:30},(_,i)=>row('event-'+i,'20/10/2026'));
 rows.push(row('EVT-20261219-JASPER-TEMPTATION-CONCERT','19/12/2026'));
 const result=discover(rows,{today:'2026-10-19',domEvidence:[{event_id:'EVT-20261219-JASPER-TEMPTATION-CONCERT',event_date_text:'19/12/2026',card_visible:true,booking_cta_verified:true}]});
 assert.equal(result.source_rows,31);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].event_id,'EVT-20261219-JASPER-TEMPTATION-CONCERT');assert.equal(result.rejected.length,30);
});
test('full, hidden, zero phones, owner locks and bad inventory fail closed',()=>{
 const rows=[row('full','18/12/2026','show_full','เต็มแล้ว',0),row('hide','19/12/2026','hide','เปิดจอง',2),row('zero','19/12/2026','show','เปิดจอง',0),row('locked','19/12/2026'),row('over','19/12/2026','show','เปิดจอง',3)];
 const out=discover(rows,{today:'2026-10-19',requireDom:false,locks:[{event_id:'locked',lock_state:'LOCKED'}]});
 assert.equal(out.candidates.length,0);assert.equal(out.rejected.length,5);assert.ok(out.rejected.find(x=>x.event_id==='locked').reasons.includes('OWNER_LOCKED'));
});
test('latest duplicate wins and empty DOM never means storefront confirmed',()=>{
 const out=discover([row('a','20/10/2026'),row('a','20/10/2026','show_full','เต็มแล้ว',0)],{today:'2026-10-19'});
 assert.equal(out.unique_events,1);assert.equal(out.candidates.length,0);assert.equal(out.rejected.length,1);assert.equal(out.production_writes,0);assert.equal(out.auto_publish,false);
});
