'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-production-runtime.js');

function snapshot(){
 return {
  events:[
   {event_id:'EVT-EX',event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena',poster_url:'https://img/ex.jpg',active_on_web:true},
   {event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',poster_url:'https://img/h.jpg',active_on_web:false}
  ],
  web_ready:[
   {event_id:'EVT-EX',event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena',poster_image_url:'https://img/ex.jpg',action_for_web:'show'},
   {event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',poster_image_url:'https://img/h.jpg',action_for_web:'hide'}
  ],
  web_packages:[
   {package_id:'EVT-EX-TPL-VIVO-X300-PRO-PHONE',event_id:'EVT-EX',package_type:'phone_only',price:790,available_count:1,package_status:'available'}
  ],
  packages:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',package_type:'phone_only',standard_price:790,active:true}
  ],
  bookings:[{booking_id:'B1',event_date:'2026-10-26',booking_status:'confirmed'}],
  visibility_locks:[{event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',lock_state:'LOCKED'}]
 };
}

test('reconciliation pins exact existing, skips booked and hidden history, leaves safe new',()=>{
 const out=R.reconcileCandidates([
  {event_key:'A',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena'},
  {event_key:'B',title:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall'},
  {event_key:'C',title:'New Artist Fan Meeting',event_date:'2026-10-26',venue:'BITEC'},
  {event_key:'D',title:'Another Concert',event_date:'2026-10-27',venue:'BITEC'}
 ],snapshot());
 assert.equal(out.safe_candidates.length,2);
 assert.equal(out.safe_candidates[0].existing_event_id,'EVT-EX');
 assert.equal(out.dispositions.find(x=>x.event_key==='B').status,'SKIPPED_EVENT_HISTORY');
 assert.equal(out.dispositions.find(x=>x.event_key==='C').status,'SKIPPED_BOOKING_DATE');
 assert.equal(out.dispositions.find(x=>x.event_key==='D').status,'SAFE_NEW');
});

test('same date venue with two close existing matches holds ambiguous',()=>{
 const s=snapshot();
 s.events=[
  {event_id:'1',event_name:'Artist Live Bangkok',event_date:'2026-10-20',venue:'BITEC',active_on_web:true},
  {event_id:'2',event_name:'Artist Live Bangkok Special',event_date:'2026-10-20',venue:'BITEC',active_on_web:true}
 ];
 s.web_ready=[];s.web_packages=[];s.visibility_locks=[];s.bookings=[];
 const out=R.reconcileCandidates([{event_key:'X',title:'Artist Live Bangkok Show',event_date:'2026-10-20',venue:'BITEC'}],s);
 assert.equal(out.safe_candidates.length,0);
 assert.equal(out.dispositions[0].status,'HOLD_AMBIGUOUS_EXISTING');
});

test('readback converts public action to active flag and returns event packages',()=>{
 const rb=R.readbackForEvent(snapshot(),'EVT-EX');
 assert.equal(rb.event.active_on_web,true);
 assert.equal(rb.packages.length,1);
 assert.equal(R.packageTemplateId(rb.packages[0].package_id),'TPL-VIVO-X300-PRO-PHONE');
});
