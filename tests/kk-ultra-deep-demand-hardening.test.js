'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const Ledger=require('../server/kk-ultra-deep-demand-evidence-ledger.js');
const State=require('../server/kk-ultra-deep-state-consistency.js');
const Calibration=require('../server/kk-ultra-deep-demand-calibration.js');

test('evidence ledger produces reproducible external-only score receipt',()=>{
 const evidence=[
  {type:'competitor_rental',score:90,source_url:'https://example.com/rental',observed_at:'2026-10-07T01:00:00+07:00',summary:'multiple rental listings'},
  {type:'social_engagement',score:80,source_url:'https://example.com/social',observed_at:'2026-10-07T01:00:00+07:00',summary:'strong public fandom engagement'},
  {type:'ticket_demand',score:100,source_url:'https://example.com/ticket',observed_at:'2026-10-07T01:00:00+07:00',summary:'sold out'},
  {type:'fandom_photo_intent',score:90,source_url:'https://example.com/photo',observed_at:'2026-10-07T01:00:00+07:00',summary:'strong photo intent'}
 ];
 const r=Ledger.build({event_id:'E1',event_name:'Event',event_date:'2026-10-18',evidence,kk_booking_count:99});
 assert.equal(r.internal_business_signals_affect_score,false);assert.equal(r.score.ignored_internal_signals.length,0);assert.equal(Ledger.verify(r).ok,true);assert.match(r.evidence_hash,/^[a-f0-9]{64}$/);
});
test('state consistency fails closed when locked event is visible',()=>{
 const r=State.audit({events:[{event_id:'E1',active_on_web:true}],visibility_locks:[{event_id:'E1',lock_state:'LOCKED'}],web_ready:[{event_id:'E1',action_for_web:'show'}]});
 assert.equal(r.status,'FAIL_CLOSED');assert.equal(r.counts.critical,2);assert.equal(r.production_writes,0);
});
test('state consistency flags durable owner-visible intent drift',()=>{
 const r=State.audit({events:[{event_id:'E1',active_on_web:false}],visibility_locks:[{event_id:'E1',lock_state:'SEEN_CORE',lock_reason:'OWNER_KEEP_EXCEPTION'}],web_ready:[{event_id:'E1',action_for_web:'hide'}]});
 assert.equal(r.status,'RECONCILE_REQUIRED');assert.equal(r.violations[0].code,'OWNER_VISIBLE_INTENT_BUT_CORE_HIDDEN');
});
test('calibration uses external outcomes for threshold fit and KK only as diagnostic',()=>{
 const r=Calibration.backtest([{external_score:80,external_competitor_full_or_waitlist:1,kk_booking_count:0},{external_score:40,external_post_event_demand_signal:0,kk_booking_count:2}]);
 assert.equal(r.rows.PRIORITY[0].outcome.external_positive,true);assert.equal(r.rows.REJECT[0].outcome.kk_booking_count,2);assert.equal(r.rows.REJECT[0].outcome.kk_used_for_threshold_fit,false);assert.equal(r.internal_outcomes_are_diagnostic_only,true);
});
test('small samples never auto-change thresholds',()=>{assert.equal(Calibration.backtest([{external_score:80}]).recommendation,'KEEP_THRESHOLDS_COLLECT_MORE_EXTERNAL_OUTCOMES');});

test('monthly adapter fail-closes before candidate planning on critical state drift',()=>{
 const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
 const r=Adapter.buildReadOnlyPlan({month:'2026-10',candidates:[],snapshot:{events:[{event_id:'E1',active_on_web:true}],visibility_locks:[{event_id:'E1',lock_state:'LOCKED'}],web_ready:[{event_id:'E1',action_for_web:'show'}]},commercial:{}});
 assert.equal(r.status,'BLOCKED_STATE_CONSISTENCY');assert.equal(r.production_writes,0);
});
test('monthly adapter emits evidence receipt when external evidence is supplied',()=>{
 const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
 const ev=['competitor_rental','social_engagement','ticket_demand','fandom_photo_intent'].map((type,i)=>({type,score:80+i,source_url:'https://example.com/'+type,observed_at:'2026-10-07T01:00:00+07:00',summary:'external '+type}));
 const snapshot={events:[],visibility_locks:[],web_ready:[],assets:[{asset_type:'phone',status:'active'}],bookings:[]};
 const r=Adapter.normalizeCandidate({event_key:'E1',title:'Event',event_date:'2026-10-20',venue:'Bangkok',external_evidence:ev},snapshot,{});
 assert.ok(r.external_evidence_receipt);assert.match(r.external_evidence_receipt.evidence_hash,/^[a-f0-9]{64}$/);assert.equal(r.external_evidence_receipt.internal_business_signals_affect_score,false);
});

test('state consistency fail-closes when another event is visible on an active booking date',()=>{
 const r=State.audit({
  events:[{event_id:'BOOKED',event_date:'2026-10-24',active_on_web:true},{event_id:'OTHER',event_date:'2026-10-24',active_on_web:true}],
  bookings:[{booking_id:'B1',event_id:'BOOKED',event_date:'2026-10-24',booking_status:'confirmed'}],
  visibility_locks:[],
  web_ready:[{event_id:'BOOKED',action_for_web:'show'},{event_id:'OTHER',action_for_web:'show'}]
 });
 assert.equal(r.status,'FAIL_CLOSED');
 assert.ok(r.violations.some(x=>x.event_id==='OTHER'&&x.code==='OTHER_EVENT_VISIBLE_ON_BOOKING_DAY'));
});
test('booked event stays protected while other visible event on same date is excluded',()=>{
 const Requal=require('../server/kk-ultra-deep-storefront-requalification.js');
 const external={competitor_rental_activity:100,social_engagement:100,ticket_demand:100,fandom_photo_intent:100,venue_capture_value:100,historical_market_rental:100};
 const booked=Requal.requalify({external_scoring:external,active_booking_count:1,date_booking_count:1,active_on_web:true,owner_monthly_reconciliation_apply:true});
 const other=Requal.requalify({external_scoring:external,active_booking_count:0,date_booking_count:1,active_on_web:true,owner_monthly_reconciliation_apply:true});
 assert.equal(booked.decision,'KEEP_PROTECTED_ACTIVE_BOOKING');
 assert.equal(other.decision,'BOOKING_DAY_EXCLUDED');
 assert.equal(other.apply_visibility_change,true);
 assert.equal(other.visibility_mutation.to,false);
});
test('hidden REOPENED event on an active booking date stays hidden',()=>{
 const Requal=require('../server/kk-ultra-deep-storefront-requalification.js');
 const external={competitor_rental_activity:100,social_engagement:100,ticket_demand:100,fandom_photo_intent:100,venue_capture_value:100,historical_market_rental:100};
 const r=Requal.requalify({external_scoring:external,active_booking_count:0,date_booking_count:1,history_state:'REOPENED',active_on_web:false,owner_monthly_reconciliation_apply:true});
 assert.equal(r.decision,'HIDDEN_BOOKING_DAY_EXCLUDED');
 assert.equal(r.apply_visibility_change,false);
});
