'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const Bridge=require('../scripts/kk-x-posting-plan-chat-bridge.js');

function payload(){
  return {
    request:{
      message:'ไปตรวจสอบ X ว่าตอนนี้ควรโพสอะไรต่อจากเดิม ตั้งแต่ 19.30 ไปจนถึงช่วง late night',
      input:{
        now:'2026-10-13T02:39:00+07:00',
        booking_source:'00_Master_Booking',booking_verified:true,booking_readback_at:'2026-10-13T02:30:00+07:00',booking_rows:[],
        visibility_source:'18_Event_Visibility_Locks',visibility_verified:true,visibility_readback_at:'2026-10-13T02:30:00+07:00',visibility_locks:[],
        storefront_source:'08_Web_Ready',storefront_verified:true,
        storefront_readback_at:'2026-10-13T02:30:00+07:00',
        post_log_verified:true,post_log_readback_at:'2026-10-13T02:30:00+07:00',
        post_log:[],
        storefront_rows:[0,1,2].map(i=>({event_id:'EVT-TEST-'+i,event_date_text:'17/10/2026',action_for_web:'show',booking_status_for_web:'เปิดจอง',available_phone_count:1})),
        candidates:[
          {event:'Event A',event_id:'EVT-TEST-0',event_date_text:'17/10/2026',verified_event:true,verified_pricing:true,event_is_tomorrow:true,engagement_velocity:95,conversation_volume:91,fandom_strength:92,competitor_activity:60,booking_opportunity:86,recent_posted_hours_ago:1},
          {event:'Event B',event_id:'EVT-TEST-1',event_date_text:'17/10/2026',verified_event:true,verified_pricing:true,event_is_tomorrow:true,engagement_velocity:86,conversation_volume:89,fandom_strength:90,competitor_activity:72,booking_opportunity:95,recent_posted_hours_ago:12},
          {event:'Event C',event_id:'EVT-TEST-2',event_date_text:'17/10/2026',verified_event:true,verified_pricing:true,days_to_event:2,engagement_velocity:82,conversation_volume:84,fandom_strength:87,competitor_activity:58,booking_opportunity:81,recent_posted_hours_ago:24},
          {event:'Unverified Viral',verified_event:false,event_is_tomorrow:true,engagement_velocity:100,conversation_volume:100,fandom_strength:100,competitor_activity:100,booking_opportunity:100}
        ]
      }
    }
  };
}

test('bridge extracts bounded JSON payload from issue body',()=>{
  const body=['notes',Bridge.START,'```json',JSON.stringify(payload()),'```',Bridge.END].join('\n');
  assert.deepEqual(Bridge.extractPayload(body),payload());
});

test('bridge requires owner-created X plan issue',()=>{
  const ok=Bridge.validateBridgeEvent({issue:{number:42,title:'[KK-X-PLAN] smoke',author_association:'OWNER'}});
  assert.equal(ok.pass,true);
  const bad=Bridge.validateBridgeEvent({issue:{number:42,title:'[KK-X-PLAN] smoke',author_association:'CONTRIBUTOR'}});
  assert.equal(bad.pass,false);
  assert.ok(bad.errors.includes('BRIDGE_OWNER_ONLY'));
});

test('bridge strips obvious secrets from request input',()=>{
  const clean=Bridge.safeInput({token:'x',secret:'y',password:'z',api_key:'k',admin_pin:'1',event:'safe'});
  assert.deepEqual(clean,{event:'safe'});
});

test('bridge invokes the real x_posting_plan gateway route and persists invocation evidence',async()=>{
  const event={issue:{number:99,title:'[KK-X-PLAN] acceptance',author_association:'OWNER'}};
  const recorded=[];
  const result=await Bridge.runBridge({event,payload:payload(),ledgerFn:async row=>{
    recorded.push(row);
    return {ok:true,inserted:true,provider:'test',invocation_id:row.invocation_id};
  }});
  assert.equal(result.status,'PASS');
  assert.equal(result.gateway_status,'RECORDED');
  assert.equal(result.intent,'x_posting_plan');
  assert.deepEqual(result.invocation.required_agents,['kk-marketing-agent']);
  assert.deepEqual(result.invocation.invoked_agents,['kk-marketing-agent']);
  assert.equal(result.plan.timezone,'Asia/Bangkok');
  assert.deepEqual(result.plan.slots.map(x=>x.time),['19:30','21:00','22:30','00:00']);
  assert.equal(result.plan.slots.some(x=>x.event==='Unverified Viral'),false);
  assert.ok(result.plan.rejected_candidates.some(x=>x.event==='Unverified Viral'&&x.reason==='EVENT_NOT_VERIFIED'));
  assert.equal(recorded.length,1);
  assert.equal(result.ledger_rows.length,0);
  assert.equal(result.production_writes,0);
  assert.equal(result.publishes,0);
});

test('bridge stays BLOCKED when readback is stale, even if agent invocation was recorded',async()=>{
  const body=payload();
  body.request.input.storefront_readback_at='2026-10-12T16:00:00+07:00';
  const event={issue:{number:100,title:'[KK-X-PLAN] blocked readiness',author_association:'OWNER'}};
  const result=await Bridge.runBridge({event,payload:body,ledgerFn:async row=>({ok:true,inserted:true,invocation_id:row.invocation_id})});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.blocker,'BLOCKED_NO_ELIGIBLE_EVENTS');
  assert.equal(result.plan.slots.filter(x=>x.event).length,0);
  assert.equal(result.publishes,0);
  assert.equal(result.production_writes,0);
});

test('workflow is owner-only, posts evidence, closes issue and never deploys',()=>{
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','kk-x-posting-plan-chat-bridge.yml'),'utf8');
  assert.match(workflow,/\[KK-X-PLAN\]/);
  assert.match(workflow,/author_association\s*==\s*'OWNER'/);
  assert.match(workflow,/kk-x-posting-plan-chat-bridge\.js/);
  assert.match(workflow,/gh issue comment/);
  assert.match(workflow,/gh issue close/);
  assert.doesNotMatch(workflow,/vercel\s+(?:deploy|promote)|deploy_to_vercel|--prod/i);
});


test('bridge comment exposes durable memory mode/count without exposing memory content',()=>{
  const comment=Bridge.buildComment({
    status:'PASS',gateway_status:'RECORDED',intent:'x_posting_plan',
    project_memory:{status:'READY',durable_mode:'github_oidc',durable_context_count:2},
    production_writes:0,publishes:0
  });
  assert.match(comment,/Project memory: `READY`/);
  assert.match(comment,/Durable memory mode: `github_oidc`/);
  assert.match(comment,/Durable memory rows loaded: `2`/);
  assert.doesNotMatch(comment,/summary|evidence_refs|secret|token/i);
});

test('workflow acceptance requires GitHub OIDC durable memory readback',()=>{
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','kk-x-posting-plan-chat-bridge.yml'),'utf8');
  assert.match(workflow,/durable_mode!=='github_oidc'/);
  assert.match(workflow,/durable_context_count/);
  assert.match(workflow,/PROJECT_MEMORY_GITHUB_OIDC_ACCEPTANCE_FAILED/);
  assert.match(workflow,/durable_memory_mode/);
  assert.match(workflow,/durable_memory_rows/);
});
