'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Registry = require('../server/kk-agent-registry.js');
const Gateway = require('../server/kk-agent-gateway.js');
const Ledger = require('../server/kk-agent-invocation-ledger.js');
const Orchestration = require('../server/kk-agent-orchestration.js');

function goodPayload() {
  return {
    message: 'ขอโพสปล่อยเช่างานนี้บน X',
    input: {
      event: 'Example Concert',
      venue: 'Example Hall',
      verified_event: true,
      verified_pricing: true,
      price_display: 'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
      inventory_available: true,
      recent_posts: ['ตัวอย่าง hook เก่า']
    }
  };
}

test('registry keeps content mandatory and exposes provider-gated scanner truth', () => {
  assert.equal(Registry.REGISTRY_VERSION, 'KK_AGENT_REGISTRY_V34');
  const content = Registry.routeForIntent('direct_rental_x');
  assert.deepEqual(content.required_agents, ['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa', 'kk-content-selector']);
  assert.equal(content.runtime_available, true);

  const scan = Registry.routeForIntent('scan_event');
  assert.equal(scan.runtime_available, true);
  assert.equal(scan.provider_executor_required, true);
  assert.deepEqual(scan.downstream_agents, ['kk-event-verifier']);

  assert.equal(Registry.AGENTS['kk-discovery-scanner'].runtime_state, 'CALLABLE_PROVIDER_GATED');
  assert.equal(Registry.AGENTS['kk-reliability-learning'].runtime_state, 'LIVE_AUDIT_AND_CALLABLE');
});

test('content gateway invokes required agents and persists evidence', async () => {
  const rows = [];
  const result = await Gateway.executeAgentRequest(goodPayload(), {
    ledgerFn: async row => {
      rows.push(row);
      return { ok: true, inserted: true, invocation_id: row.invocation_id };
    }
  });

  assert.equal(result.status, 'READY_FOR_OWNER_REVIEW');
  assert.deepEqual(result.invocation.invoked_agents, ['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa', 'kk-content-selector']);
  assert.equal(rows.length, 1);
  assert.match(result.route.generation_prompt, /3 INTERNAL candidates/i);
});

test('content gateway fail-closes commercial truth and ledger failures', async () => {
  const payload = goodPayload();
  payload.input.verified_pricing = false;
  delete payload.input.price_display;
  const blocked = await Gateway.executeAgentRequest(payload, {
    ledgerFn: async row => ({ ok:true, inserted:true, invocation_id:row.invocation_id })
  });
  assert.equal(blocked.status, 'BLOCKED_CONTENT_GATE');
  assert.equal(blocked.route.generation_prompt, undefined);

  const ledgerDown = await Gateway.executeAgentRequest(goodPayload(), {
    ledgerFn: async () => { throw Object.assign(new Error('down'), {code:'LEDGER_DOWN'}); }
  });
  assert.equal(ledgerDown.status, 'BLOCKED_LEDGER_UNAVAILABLE');
  assert.equal(ledgerDown.route.generation_prompt, undefined);
});

test('all explicit KK post forms require the full five-agent pipeline', async () => {
  const ledgerFn = async row => ({ok:true, inserted:true, invocation_id:row.invocation_id});
  const cases = [
    {
      message: 'ขอโพสรวมงานอาทิตย์นี้บน X',
      input: {event:'Weekly roundup', verified_event:true, commercial_truth_required:false}
    },
    {
      message: 'ช่วยเขียนโพสต์ awareness ให้ KK Phone Rental',
      input: {commercial_truth_required:false, primary_objective:'awareness'}
    },
    {
      message: 'ทำ Last Call โพสต์คืนนี้ให้หน่อย',
      input: {event:'Example Event', verified_event:true, commercial_truth_required:false}
    },
    {
      message: 'ช่วยรีเฟรชโพสต์โปรโมตงานนี้',
      input: {event:'Example Event', verified_event:true, commercial_truth_required:false}
    }
  ];

  for (const payload of cases) {
    const result = await Gateway.executeAgentRequest(payload, {ledgerFn});
    assert.equal(result.status, 'READY_FOR_OWNER_REVIEW');
    assert.deepEqual(result.invocation.required_agents, ['kk-marketing-agent','kk-content-strategy','kk-content-agent','kk-content-qa','kk-content-selector']);
    assert.deepEqual(result.invocation.invoked_agents, ['kk-marketing-agent','kk-content-strategy','kk-content-agent','kk-content-qa','kk-content-selector']);
    assert.equal(result.route.selector_required, true);
    assert.equal(result.route.internal_candidate_count, 3);
    assert.equal(result.route.public_output_count, 1);
    assert.equal(result.route.public_output_mode, 'SINGLE_FINAL_POST');
  }
});

test('content gateway blocks partial post pipelines even when a route claims PASS', async () => {
  const result = await Gateway.executeAgentRequest({
    message:'ขอโพสรวมงานอาทิตย์นี้บน X',
    input:{event:'Weekly roundup',verified_event:true,commercial_truth_required:false}
  },{
    contentRouteFn: () => ({
      matched:true,
      marketing_required:true,
      marketing_plan:{objective:'awareness'},
      strategy_required:true,
      content_agent_required:true,
      plan:{readiness:{commercial_blockers:[]}},
      qa_required:true,
      selector_required:false,
      selector_version:'',
      content_gate:'PASS'
    }),
    ledgerFn: async row => ({ok:true,inserted:true,invocation_id:row.invocation_id})
  });
  assert.equal(result.status,'BLOCKED_REQUIRED_AGENT_NOT_INVOKED');
  assert.equal(result.invocation.missing_agents?.includes?.('kk-content-selector') ?? result.invocation_check.missing_agents.includes('kk-content-selector'), true);
});

test('content gateway detects deliberate agent bypass', async () => {
  const result = await Gateway.executeAgentRequest(goodPayload(), {
    contentRouteFn: () => ({ matched:false, content_gate:'PASS' }),
    ledgerFn: async row => ({ok:true,inserted:true,invocation_id:row.invocation_id})
  });
  assert.equal(result.status, 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED');
  assert.deepEqual(result.invocation.required_agents, ['kk-marketing-agent','kk-content-strategy','kk-content-agent','kk-content-qa','kk-content-selector']);
});

test('source-watch operational task executes actual contract and persists agent evidence', async () => {
  const rows=[];
  const now='2026-09-27T02:00:00.000Z';
  const result=await Gateway.executeAgentRequest({
    task_type:'source_watch_check',
    correlation_id:'source-watch-test-1',
    input:{
      observation_id:'obs-1',
      provider:'EXA',
      source_tier:'OFFICIAL',
      state:'NEW',
      source_url:'https://example.com/event',
      observed_at:now,
      content_hash:'a'.repeat(64)
    }
  },{
    sourceWatchOptions:{nowMs:Date.parse(now)},
    ledgerFn:async row=>{rows.push(row);return {ok:true,inserted:true,invocation_id:row.invocation_id};}
  });
  assert.equal(result.status,'RECORDED');
  assert.equal(result.result.status,'DISCOVERY_STAGING_ELIGIBLE');
  assert.deepEqual(result.invocation.invoked_agents,['kk-discovery-source-watch']);
  assert.equal(result.downstream_agents.includes('kk-event-verifier'),true);
  assert.equal(rows[0].owner_review_required,false);
});

test('verifier and reliability operational tasks are callable through one gateway', async () => {
  const ledgerFn=async row=>({ok:true,inserted:true,invocation_id:row.invocation_id});

  const verifier=await Gateway.executeAgentRequest({
    task_type:'verifier_no_drop_audit',
    input:{ai_rows:[],candidate_rows:[],monthly_dispositions:[],lineage_rows:[],debt_rows:[],core_rows:[]}
  },{ledgerFn});
  assert.equal(verifier.status,'RECORDED');
  assert.deepEqual(verifier.invocation.invoked_agents,['kk-event-verifier']);
  assert.equal(verifier.result.production_writes,0);

  const reliability=await Gateway.executeAgentRequest({
    task_type:'reliability_audit',
    input:{observations:[{code:'FAIL_REQUIRES_EXACT_IDENTITY'}]}
  },{ledgerFn});
  assert.equal(reliability.status,'RECORDED');
  assert.deepEqual(reliability.invocation.invoked_agents,['kk-reliability-learning']);
  assert.equal(reliability.result.safety.production_writes,0);
});

test('full scan worker is callable with controlled provider results while final verifier remains blocked', async () => {
  const rows=[];
  const ledgerFn=async row=>{rows.push(row);return {ok:true,inserted:true,invocation_id:row.invocation_id};};

  const now='2026-09-27T02:00:00.000Z';
  const scan=await Gateway.executeAgentRequest({
    task_type:'scan_event',
    input:{
      observations:[{observation_id:'scan-obs-1',provider:'EXA',source_tier:'OFFICIAL',state:'NEW',source_url:'https://example.com/events',observed_at:now,content_hash:'a'.repeat(64)}],
      provider_results:[{authoritative:false,verifier_required:true,production_writes:0,final_truth_mutation:false,notification_sends:0,candidates:[{title:'Example Concert',event_date:'2026-10-10',venue:'Hall',artist:['A'],source_url:'https://example.com/event'}]}]
    }
  },{ledgerFn,sourceWatchOptions:{nowMs:Date.parse(now)}});
  assert.equal(scan.status,'RECORDED');
  assert.equal(scan.result.status,'READY_FOR_VERIFIER');
  assert.equal(scan.result.handoff.candidate_count,1);
  assert.deepEqual(scan.invocation.invoked_agents,['kk-discovery-source-watch','kk-discovery-scanner']);

  const verify=await Gateway.executeAgentRequest({
    task_type:'verify_event',
    input:{candidate_id:'X'}
  },{ledgerFn});
  assert.equal(verify.status,'BLOCKED_RUNTIME_NOT_AVAILABLE');
  assert.equal(verify.blocker,'FINAL_VERIFIER_COMMIT_WORKER_NOT_WIRED');
  assert.equal(rows.length,2);
});

test('operational result is suppressed when persistent ledger is unavailable', async () => {
  const result=await Gateway.executeAgentRequest({
    task_type:'reliability_audit',
    input:{observations:[{message:'new issue'}]}
  },{
    ledgerFn:async()=>{throw Object.assign(new Error('down'),{code:'LEDGER_DOWN'});}
  });
  assert.equal(result.status,'BLOCKED_LEDGER_UNAVAILABLE');
  assert.equal(result.result,null);
});

test('ledger V2 accepts operational statuses and false owner review while preserving zero-write', () => {
  const row={
    invocation_id:'agi_1234567890abcdef',
    request_type:'RELIABILITY_AUDIT',
    intent:'reliability_audit',
    gate_status:'RECORDED',
    required_agents:['kk-reliability-learning'],
    invoked_agents:['kk-reliability-learning'],
    request_hash:'a'.repeat(64),
    truth_hash:'b'.repeat(64),
    owner_review_required:false,
    production_writes:0,
    publishes:0
  };
  assert.deepEqual(Ledger.validateRow(row).errors,[]);
  assert.match(Ledger.validateRow({...row,production_writes:1}).errors.join(','),/PRODUCTION_WRITES_NONZERO/);
  assert.match(Ledger.validateRow({...row,publishes:1}).errors.join(','),/PUBLISHES_NONZERO/);
});

test('orchestration ledger stores hashes rather than raw operational inputs', () => {
  const record=Orchestration.buildRecord({
    intent:'reliability_audit',
    invoked_agents:['kk-reliability-learning'],
    input:{secret_like_text:'do not persist this raw input'},
    output:{status:'ok'},
    correlation_id:'abc',
    gate_status:'RECORDED'
  });
  assert.match(record.request_hash,/^[0-9a-f]{64}$/);
  assert.match(record.truth_hash,/^[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(record,'input'),false);
  assert.equal(Object.hasOwn(record,'output'),false);
});

test('coverage summary distinguishes complete and blocked invocations', () => {
  const summary=Orchestration.coverageSummary([
    {intent:'reliability_audit',required_agents:['kk-reliability-learning'],invoked_agents:['kk-reliability-learning'],gate_status:'RECORDED'},
    {intent:'scan_event',required_agents:['kk-discovery-scanner'],invoked_agents:[],gate_status:'BLOCKED_RUNTIME_NOT_AVAILABLE'}
  ]);
  assert.equal(summary.total,2);
  assert.equal(summary.complete,1);
  assert.equal(summary.blocked,1);
  assert.equal(summary.coverage_percent,50);
});

test('existing Supabase ledger migration preserves append-only service-role access', () => {
  const least = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260927022311_agent_invocation_ledger_least_privilege_v1.sql'),
    'utf8'
  ).toLowerCase();
  assert.match(least, /grant select, insert on table public\.kk_agent_invocations to service_role/);
  assert.doesNotMatch(least, /grant[^;]*(update|delete)/);
});

test('unified-route migration expands statuses without weakening append-only access', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260927025019_agent_invocation_ledger_unified_routes_v2.sql'),
    'utf8'
  ).toLowerCase();
  assert.match(migration, /'recorded'/);
  assert.match(migration, /'blocked_runtime_not_available'/);
  assert.match(migration, /drop constraint if exists kk_agent_invocations_owner_review_required_check/);
  assert.match(migration, /revoke all on table public\.kk_agent_invocations from anon, authenticated, service_role/);
  assert.match(migration, /grant select, insert on table public\.kk_agent_invocations to service_role/);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)/);
});


test('Unified Inbox review invokes reliability and UX agents through governed gateway', async()=>{
  const rows=[];
  const result=await Gateway.executeAgentRequest({task_type:'admin_unified_inbox_review',correlation_id:'unified-inbox-agent-review-test',input:{code_context:{files:['admin/index.html','server/line-booking-webhook.js'],targeted_tests:['tests/kk-admin-inbox-preview.test.js']},reliability_observations:[{id:'inbox-isolation',message:'Inbox persistence failure is isolated from the existing LINE booking processing path.'},{id:'provider-gates',message:'LINE and X provider activation remain gated and outbound send is disabled.'}],ux:{viewport:{width:390,height:844},platform:'ios',metrics:{document_scroll_width_px:390,content_width_px:390,min_form_control_font_px:16,tap_targets:[{id:'inbox-search',width:320,height:44}],filter_rows:1,card_columns:1,card_min_width_px:320}}}},{ledgerFn:async row=>{rows.push(row);return {ok:true,inserted:true,invocation_id:row.invocation_id};}});
  assert.equal(result.status,'RECORDED');
  assert.deepEqual(result.invocation.required_agents,['kk-reliability-learning','kk-storefront-ux-reviewer']);
  assert.deepEqual(result.invocation.invoked_agents,['kk-reliability-learning','kk-storefront-ux-reviewer']);
  assert.equal(result.result.safety.production_writes,0);
  assert.equal(result.result.safety.auto_merge,false);
  assert.equal(result.result.safety.auto_deploy,false);
  assert.equal(rows.length,1);
});
