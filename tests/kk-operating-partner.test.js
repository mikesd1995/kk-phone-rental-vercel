'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Partner=require('../server/kk-operating-partner.js');
const DecisionLedger=require('../server/kk-decision-ledger.js');
const TaskRouter=require('../server/kk-agent-task-router.js');
const Gateway=require('../server/kk-agent-gateway.js');
const Registry=require('../server/kk-agent-registry.js');
const CodeIntel=require('../server/kk-code-intelligence.js');
const fs=require('fs');
const path=require('path');

test('Operating Partner registry route is callable but advisory',()=>{
  assert.equal(Registry.REGISTRY_VERSION,'KK_AGENT_REGISTRY_V34');
  assert.equal(Registry.AGENTS['kk-operating-partner'].authority,'ADVISORY_DECISION_SUPPORT');
  assert.equal(Registry.AGENTS['kk-operating-partner'].production_writes,0);
  const route=Registry.routeForIntent('operating_partner_brief');
  assert.equal(route.runtime_available,true);
  assert.deepEqual(route.required_agents,['kk-operating-partner']);
  assert.equal(route.owner_review_required,true);
});

test('high-evidence event opportunity can rank urgent without auto execution',()=>{
  const result=Partner.scoreOpportunity({
    opportunity_id:'opp_1',
    type:'event_rental',
    title:'High demand event',
    evidence_confidence:90,
    signals:{
      demand_signal:94,
      competition_gap:82,
      margin_signal:84,
      inventory_fit:92,
      timing_urgency:90,
      content_reach:91,
      repeat_customer_fit:70
    }
  });
  assert.equal(result.priority,'URGENT');
  assert.ok(result.score>=85);
  assert.equal(result.auto_execute,false);
  assert.equal(result.owner_review_required,true);
  assert.ok(result.used_signals.length>=6);
});

test('insufficient evidence never becomes a confident opportunity',()=>{
  const result=Partner.scoreOpportunity({
    opportunity_id:'opp_sparse',
    type:'pricing',
    evidence_confidence:25,
    signals:{demand_signal:100}
  });
  assert.equal(result.priority,'INSUFFICIENT_EVIDENCE');
  assert.equal(result.recommended_action,'COLLECT_MORE_EVIDENCE');
  assert.equal(result.auto_execute,false);
});

test('daily brief prioritizes opportunity, customer and system actions together',()=>{
  const brief=Partner.buildDailyBrief({
    opportunities:[{
      opportunity_id:'opp_hot',
      type:'content_reach',
      title:'Seat View opportunity',
      evidence_confidence:95,
      signals:{
        demand_signal:95,
        competition_gap:90,
        timing_urgency:95,
        content_reach:98,
        inventory_fit:80
      }
    }],
    customer_actions:[{
      action_id:'cust_follow',
      title:'Follow up booking cohort',
      recommended_action:'PREPARE_CUSTOMER_FOLLOWUP',
      priority_score:80
    }],
    system_signals:[{
      action_id:'sys_p1',
      title:'Investigate recurring admin failure',
      recommended_action:'RUN_RELIABILITY_REVIEW',
      severity:'P1'
    }]
  });
  assert.equal(brief.schema_version,'KK_OPERATING_PARTNER_BRIEF_V1');
  assert.ok(brief.top_actions.length>=3);
  assert.equal(brief.top_actions[0].source,'system');
  assert.equal(brief.top_actions[0].priority_score,90);
  assert.ok(brief.top_actions.some(x=>x.source==='opportunity'));
  assert.ok(brief.top_actions.some(x=>x.source==='customer'));
  assert.equal(brief.safety.production_writes,0);
  assert.equal(brief.safety.publishes,0);
  assert.equal(brief.safety.customer_sends,0);
});

test('learning needs three measured comparable outcomes before strategy nudge',()=>{
  const two=[
    ['dec_a_0001',80],
    ['dec_a_0002',84]
  ].flatMap(([id,score])=>[
    {decision_id:id,event_type:'RECOMMENDATION',decision_type:'content',recommendation_code:'SEAT_VIEW'},
    {decision_id:id,event_type:'OWNER_DECISION',decision_type:'content',owner_action:'APPROVED'},
    {decision_id:id,event_type:'OUTCOME',decision_type:'content',outcome_score:score}
  ]);
  assert.equal(Partner.learningSummary(two).strategy_nudges.length,0);

  const three=two.concat([
    {decision_id:'dec_a_0003',event_type:'RECOMMENDATION',decision_type:'content',recommendation_code:'SEAT_VIEW'},
    {decision_id:'dec_a_0003',event_type:'OWNER_DECISION',decision_type:'content',owner_action:'APPROVED'},
    {decision_id:'dec_a_0003',event_type:'OUTCOME',decision_type:'content',outcome_score:88}
  ]);
  const learned=Partner.learningSummary(three);
  assert.equal(learned.strategy_nudges.length,1);
  assert.equal(learned.strategy_nudges[0].action,'REINFORCE');
  assert.equal(learned.strategy_nudges[0].auto_apply,false);
});

test('owner rejection is not treated as proof recommendation was wrong',()=>{
  const evaluated=Partner.evaluateDecisionOutcome({
    owner_action:'REJECTED',
    outcome_score:80
  });
  assert.equal(evaluated.lesson,'REJECTION_RECORDED_COUNTERFACTUAL_UNKNOWN');
  assert.equal(evaluated.auto_apply,false);
});

test('decision ledger strips non-approved metrics and rejects business writes',()=>{
  const checked=DecisionLedger.validateRow({
    decision_id:'dec_event_0001',
    event_type:'OUTCOME',
    decision_type:'event_opportunity',
    subject_ref:'EVT-123',
    recommendation_code:'PREPARE_POST',
    outcome_score:82,
    metrics:{
      impressions:12000,
      bookings:3,
      customer_name:'SHOULD_NOT_PERSIST',
      phone:'0999999999',
      secret:'NO'
    },
    production_writes:0,
    publishes:0
  });
  assert.deepEqual(checked.errors,[]);
  assert.deepEqual(checked.row.metrics,{impressions:12000,bookings:3});
  assert.equal(Object.hasOwn(checked.row,'customer_name'),false);
  assert.equal(DecisionLedger.safeSubjectRef('EVT-123'),true);
  assert.equal(DecisionLedger.safeSubjectRef('name@example.com'),false);
  assert.equal(DecisionLedger.safeSubjectRef('0999999999'),false);

  const unsafe=DecisionLedger.validateRow({
    decision_id:'dec_event_0002',
    event_type:'OUTCOME',
    decision_type:'event_opportunity',
    outcome_score:80,
    production_writes:1
  });
  assert.match(unsafe.errors.join(','),/PRODUCTION_WRITES_NONZERO/);
});

test('decision ledger event ids are deterministic for retry idempotency',()=>{
  const input={
    decision_id:'dec_retry_0001',
    event_type:'OWNER_DECISION',
    decision_type:'content',
    owner_action:'MODIFIED',
    evidence_hash:'a'.repeat(64)
  };
  const a=DecisionLedger.normalizeRow(input);
  const b=DecisionLedger.normalizeRow(input);
  assert.equal(a.event_id,b.event_id);
  assert.match(a.event_id,/^dle_/);
});

test('task router can build brief using supplied history without DB access',async()=>{
  const result=await TaskRouter.executeTask('operating_partner_brief',{
    opportunities:[],
    decision_history:[
      {decision_id:'dec_hist_0001',event_type:'RECOMMENDATION',decision_type:'content',recommendation_code:'SEAT_VIEW'},
      {decision_id:'dec_hist_0001',event_type:'OUTCOME',decision_type:'content',outcome_score:80}
    ]
  });
  assert.deepEqual(result.invoked_agents,['kk-operating-partner']);
  assert.equal(result.result.learning_readback.status,'SUPPLIED');
  assert.equal(result.result.learning_readback.rows,2);
});

test('decision feedback uses injected append-only writer and returns evaluation',async()=>{
  const rows=[];
  const result=await TaskRouter.executeTask('decision_feedback',{
    decision_id:'dec_feedback_0001',
    event_type:'OUTCOME',
    decision_type:'content',
    owner_action:'APPROVED',
    recommendation_code:'SEAT_VIEW',
    outcome_score:86,
    metrics:{impressions:18000,bookings:2}
  },{
    decisionLedgerFn:async row=>{
      rows.push(row);
      return {ok:true,inserted:true,event_id:row.event_id,decision_id:row.decision_id};
    }
  });
  assert.deepEqual(result.invoked_agents,['kk-operating-partner']);
  assert.equal(rows.length,1);
  assert.equal(result.result.status,'RECORDED');
  assert.equal(result.result.evaluation.lesson,'POSITIVE_OUTCOME');
  assert.equal(result.result.production_writes,0);
});

test('Agent Gateway requires Operating Partner invocation evidence',async()=>{
  const result=await Gateway.executeAgentRequest({
    task_type:'opportunity_review',
    correlation_id:'op-review-test',
    input:{
      opportunities:[{
        opportunity_id:'opp_gateway',
        type:'event_rental',
        evidence_confidence:80,
        signals:{demand_signal:80,inventory_fit:90,timing_urgency:80,content_reach:85}
      }]
    }
  },{
    ledgerFn:async row=>({ok:true,inserted:true,invocation_id:row.invocation_id})
  });
  assert.equal(result.status,'RECORDED');
  assert.deepEqual(result.invocation.invoked_agents,['kk-operating-partner']);
  assert.equal(result.production_writes,0);
  assert.equal(result.publishes,0);
});


test('latest owner decision wins in event-sourced learning history',()=>{
  const history=[
    {decision_id:'dec_latest_0001',event_type:'RECOMMENDATION',decision_type:'content',recommendation_code:'SEAT_VIEW'},
    {decision_id:'dec_latest_0001',event_type:'OWNER_DECISION',decision_type:'content',owner_action:'DEFERRED'},
    {decision_id:'dec_latest_0001',event_type:'OWNER_DECISION',decision_type:'content',owner_action:'MODIFIED'},
    {decision_id:'dec_latest_0001',event_type:'OUTCOME',decision_type:'content',outcome_score:80}
  ];
  const summary=Partner.learningSummary(history);
  assert.deepEqual(summary.stats[0].owner_actions,['MODIFIED']);
});


test('Code Intelligence routes Operating Partner work to the new business brain',()=>{
  const pack=CodeIntel.contextPack('อยากได้คู่คิด operating partner ช่วยจัด priority วันนี้',{root:path.join(__dirname,'..')});
  assert.ok(pack.matched_routes.some(x=>x.id==='operating_partner'));
  assert.ok(pack.selected_files.some(x=>x.path==='server/kk-operating-partner.js'));
  assert.ok(pack.targeted_tests.includes('tests/kk-operating-partner.test.js'));
});

test('checked-in Decision Ledger migrations preserve privacy and append-only service role',()=>{
  const root=path.join(__dirname,'..');
  const first=fs.readFileSync(path.join(root,'supabase','migrations','20260927041525_operating_partner_decision_ledger_v1.sql'),'utf8').toLowerCase();
  const hard=fs.readFileSync(path.join(root,'supabase','migrations','20260927041635_operating_partner_decision_privacy_hardening_v1.sql'),'utf8').toLowerCase();
  assert.match(first,/enable row level security/);
  assert.match(first,/revoke all on table public\.kk_decision_events from anon, authenticated, service_role/);
  assert.match(first,/grant select, insert on table public\.kk_decision_events to service_role/);
  assert.match(first,/production_writes = 0/);
  assert.match(first,/publishes = 0/);
  assert.match(hard,/kk_decision_events_metrics_whitelist_check/);
  assert.match(hard,/kk_decision_events_subject_ref_no_pii_check/);
  assert.doesNotMatch(first+hard,/grant[^;]*(update|delete)/);
});
