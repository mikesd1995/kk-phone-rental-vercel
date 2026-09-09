'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const c={module:{exports:{}},require:p=>require(path.resolve(__dirname,'../api',p)),URLSearchParams,URL,Date,AbortController,setTimeout,clearTimeout,process:{env:{}},console};
vm.createContext(c);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../api/kk-rental-dashboard.js'),'utf8'),c);
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const row={source:'current',booking_id:'BK-1',created_at:'2026-08-01',status:'completed',event_id:'EV-1',event_name:'Event',event_date:'2026-08-15',month:'2026-08',customer_key:'opaque',package_type:'phone_only',payment_status:'paid',amount_received:100,affiliation:'Unknown',affiliation_source:'unknown'};
test('same booking in current and archive counts once',()=>{const o=c.aggregate([row,{...row,source:'archive'}]);assert.equal(o.metrics.non_cancelled_bookings,1);assert.equal(o.metrics.amount_received,100);});
test('conflicting duplicate booking is not silently aggregated',()=>assert.throws(()=>c.aggregate([row,{...row,source:'archive',status:'confirmed'}]),/BOOKING_IDENTITY_CONFLICT/));
test('helper schema cannot use positional fallback on wrong headers',()=>assert.throws(()=>c.parseHelper('wrong,schema\nsecret,value',{},[]),/SCHEMA/));
test('missing booking identity cannot become a count',()=>assert.throws(()=>c.aggregate([{...row,booking_id:''}]),/BOOKING_IDENTITY/));
test('unverified status cannot become a non-cancelled rental',()=>assert.throws(()=>c.aggregate([{...row,status:'mystery'}]),/BOOKING_STATUS/));
console.log(`${count} analytics runtime invariants passed (local synthetic only)`);
