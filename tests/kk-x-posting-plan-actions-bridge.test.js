'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Bridge=require('../scripts/kk-x-posting-plan-actions-bridge.js');
function event(){return{issue:{title:'[KK-X-PLAN] smoke',author_association:'OWNER'}};}
test('Actions bridge executes X plan through Marketing Agent with Bangkok slots',async()=>{const r=await Bridge.runBridge({event:event(),payload:{request:{message:'ตรวจสอบ X ว่าควรโพสต์อะไรคืนนี้'},input:{candidates:[{event:'Verified Event',verified_event:true,event_is_tomorrow:true,engagement_velocity:90,conversation_volume:90,fandom_strength:90,competitor_activity:50,booking_opportunity:90}]}}});assert.equal(r.status,'PASS');assert.equal(r.timezone,'Asia/Bangkok');assert.deepEqual(r.invocation.invoked_agents,['kk-marketing-agent']);assert.equal(r.slots[0].time,'19:30');assert.equal(r.production_writes,0);assert.equal(r.publishes,0);});
test('Actions bridge is owner-only',async()=>{const r=await Bridge.runBridge({event:{issue:{title:'[KK-X-PLAN] smoke',author_association:'MEMBER'}},payload:{}});assert.equal(r.status,'BLOCKED');assert.match(r.blocker,/OWNER_ONLY/);});
