'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Runtime = require('../server/kk-gpt6-shadow-runtime.js');

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function shadowDecision(overrides = {}) {
  return {
    decision: 'HOLD',
    reason_codes: ['EVIDENCE_CONFLICT'],
    evidence_labels: [{
      type: 'source_claim',
      field: 'event_date',
      value: 'conflicting',
      source_ref: 'SRC-1'
    }],
    conflicts: ['event_date'],
    confidence: 0.74,
    rationale_summary: 'Evidence conflicts and requires governed verification.',
    authority: 'SHADOW_ADVISORY_ONLY',
    production_writes: 0,
    publishes: 0,
    notification_sends: 0,
    final_truth_mutation: false,
    ...overrides
  };
}

function responseFor(decision = shadowDecision()) {
  return {
    id: 'resp_shadow_123',
    status: 'completed',
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: JSON.stringify(decision)
      }]
    }],
    usage: { input_tokens: 120, output_tokens: 50 }
  };
}

test('disabled shadow runtime makes zero network calls', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('scanner', {case_id:'disabled'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'false',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>{ calls++; throw new Error('must not call'); }
  });
  assert.equal(out.status, 'SHADOW_DISABLED');
  assert.equal(calls, 0);
  assert.equal(out.network_calls, 0);
  assert.equal(out.production_writes, 0);
});

test('missing credential fails closed before network', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('verifier', {case_id:'missing-key'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true'},
    fetchImpl:async()=>{ calls++; throw new Error('must not call'); }
  });
  assert.equal(out.status, 'BLOCKED_OPENAI_API_KEY_MISSING');
  assert.equal(calls, 0);
  assert.equal(out.network_calls, 0);
});

test('obvious customer/booking PII is rejected before OpenAI transport', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('scanner', {
    case_id:'pii',
    customer_email:'person@example.com',
    candidate:{title:'Example'}
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>{ calls++; throw new Error('must not call'); }
  });
  assert.equal(out.status, 'BLOCKED_SHADOW_INPUT_SENSITIVE');
  assert.equal(calls, 0);
  assert.equal(out.network_calls, 0);
});

test('Scanner uses GPT-6 Sol Responses API with low reasoning, store false and strict structured output', async () => {
  let captured = null;
  const out = await Runtime.runShadow('scanner', {
    case_id:'scanner-1',
    candidate:{title:'Example Concert',event_date:'2026-10-10'},
    evidence:[{source_ref:'OFFICIAL-1',claim:'announced'}]
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async (url, init) => {
      captured = {url, init, body:JSON.parse(init.body)};
      return fakeResponse(responseFor(shadowDecision({decision:'READY_FOR_VERIFIER'})));
    }
  });

  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.body.model, 'gpt-6-sol');
  assert.equal(captured.body.reasoning.effort, 'low');
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(captured.body.text.format.strict, true);
  assert.equal(Object.hasOwn(captured.body, 'tools'), false);
  assert.match(captured.body.instructions, /staging-only/i);
  assert.match(captured.body.instructions, /LOCKED/);
  assert.equal(out.status, 'SHADOW_RESULT_READY');
  assert.equal(out.shadow_decision.decision, 'READY_FOR_VERIFIER');
  assert.equal(out.production_writes, 0);
  assert.equal(out.final_truth_mutation, false);
});

test('Verifier uses high reasoning and cannot turn shadow result into authority', async () => {
  let body = null;
  const out = await Runtime.runShadow('verifier', {
    case_id:'verifier-1',
    candidate:{title:'Example Concert'},
    visibility_history:{status:'LOCKED'}
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async (_url, init) => {
      body = JSON.parse(init.body);
      return fakeResponse(responseFor(shadowDecision({decision:'HOLD',reason_codes:['OWNER_HIDDEN_RECREATE_PROHIBITED']})));
    }
  });
  assert.equal(body.model, 'gpt-6-sol');
  assert.equal(body.reasoning.effort, 'high');
  assert.match(body.instructions, /final governed handoff/i);
  assert.match(body.instructions, /SEEN_CORE/);
  assert.equal(out.shadow_decision.authority, 'SHADOW_ADVISORY_ONLY');
  assert.equal(out.production_writes, 0);
});

test('provider output that claims write authority fails closed', async () => {
  const bad = shadowDecision({
    authority:'FINAL_AUTHORITY',
    production_writes:1,
    final_truth_mutation:true
  });
  const out = await Runtime.runShadow('verifier', {case_id:'bad-authority'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>fakeResponse(responseFor(bad))
  });
  assert.equal(out.status, 'BLOCKED_SHADOW_OUTPUT_AUTHORITY_VIOLATION');
  assert.equal(out.shadow_decision, null);
  assert.equal(out.production_writes, 0);
});

test('provider failure and invalid JSON never fabricate a decision', async () => {
  const unavailable = await Runtime.runShadow('scanner', {case_id:'down'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>fakeResponse({error:{message:'down'}}, 503)
  });
  assert.equal(unavailable.status, 'SHADOW_PROVIDER_UNAVAILABLE');
  assert.equal(unavailable.shadow_decision, null);
  assert.equal(unavailable.production_writes, 0);

  const invalid = await Runtime.runShadow('scanner', {case_id:'invalid-json'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>fakeResponse({
      id:'resp_bad',
      status:'completed',
      output:[{type:'message',content:[{type:'output_text',text:'not-json'}]}]
    })
  });
  assert.equal(invalid.status, 'BLOCKED_SHADOW_OUTPUT_INVALID');
  assert.equal(invalid.shadow_decision, null);
});

test('unsupported workload is rejected without network', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('pricing', {case_id:'unsupported'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>{ calls++; return fakeResponse(responseFor()); }
  });
  assert.equal(out.status, 'BLOCKED_SHADOW_WORKLOAD_UNSUPPORTED');
  assert.equal(calls, 0);
});


test('shadow request strips evaluator expected answers before sending model input', () => {
  const payload = Runtime.requestFor('scanner', {
    case_id:'no-answer-leak',
    expected_decision:'HOLD',
    nested:{expected_decisions:['HOLD'],claim:'visible'}
  });
  const sent = JSON.parse(payload.input);
  assert.equal(Object.hasOwn(sent,'expected_decision'),false);
  assert.equal(Object.hasOwn(sent.nested,'expected_decisions'),false);
  assert.equal(sent.nested.claim,'visible');
});

test('shadow route rejects model override outside the governed GPT-6 Sol target before network', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('verifier', {case_id:'bad-model'}, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    model:'gpt-5.6',
    fetchImpl:async()=>{ calls++; return fakeResponse(responseFor()); }
  });
  assert.equal(out.status,'BLOCKED_SHADOW_MODEL_NOT_ALLOWED');
  assert.equal(calls,0);
  assert.equal(out.network_calls,0);
  assert.equal(out.production_writes,0);
});


test('public event address and artist full name are allowed while customer PII stays blocked', async () => {
  let calls = 0;
  const out = await Runtime.runShadow('scanner', {
    case_id:'public-event-fields',
    candidate:{
      title:'Example Concert',
      venue_address:'123 Example Road, Bangkok',
      full_name:'Example Artist'
    },
    organizer:{contact:'public organizer desk'}
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>{
      calls++;
      return fakeResponse(responseFor(shadowDecision({decision:'READY_FOR_VERIFIER'})));
    }
  });
  assert.equal(out.status,'SHADOW_RESULT_READY');
  assert.equal(calls,1);

  const blocked = await Runtime.runShadow('scanner', {
    case_id:'customer-pii-still-blocked',
    customer_phone:'0812345678'
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>{ throw new Error('must not call'); }
  });
  assert.equal(blocked.status,'BLOCKED_SHADOW_INPUT_SENSITIVE');
  assert.equal(blocked.network_calls,0);
});


test('Verifier shadow schema supports ACCEPT without granting execution authority', async () => {
  const out = await Runtime.runShadow('verifier', {
    case_id:'verifier-accept',
    candidate:{title:'Eligible Example',rental_fit:'HIGH'},
    evidence:[{source_ref:'OFFICIAL',claim:'confirmed'}]
  }, {
    env:{KK_GPT6_SHADOW_ENABLED:'true',OPENAI_API_KEY:'secret'},
    fetchImpl:async()=>fakeResponse(responseFor(shadowDecision({decision:'ACCEPT'})))
  });
  assert.equal(out.status,'SHADOW_RESULT_READY');
  assert.equal(out.shadow_decision.decision,'ACCEPT');
  assert.equal(out.shadow_decision.authority,'SHADOW_ADVISORY_ONLY');
  assert.equal(out.production_writes,0);
});
