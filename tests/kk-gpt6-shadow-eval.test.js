'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Eval = require('../server/kk-gpt6-shadow-eval.js');

const cases = JSON.parse(fs.readFileSync(
  path.join(__dirname,'..','config','kk-gpt6-shadow-eval-cases.json'),
  'utf8'
));

test('representative eval catalog covers every required risk scenario', () => {
  const coverage = Eval.validateCaseCoverage(cases);
  assert.equal(coverage.pass, true);
  assert.deepEqual(coverage.missing, []);
  assert.equal(cases.length >= 8, true);
});

test('shadow suite passes only when every case matches policy expectation and remains zero-write', async () => {
  const expectedById = new Map(cases.map(item => [item.case_id, item.expected_decision]));
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn: async (workload, input) => ({
      status:'SHADOW_RESULT_READY',
      workload,
      shadow_decision:{
        decision:expectedById.get(input.case_id),
        reason_codes:[],
        evidence_labels:[],
        conflicts:[],
        confidence:0.9,
        rationale_summary:'fixture match',
        authority:'SHADOW_ADVISORY_ONLY',
        production_writes:0,
        publishes:0,
        notification_sends:0,
        final_truth_mutation:false
      },
      network_calls:1,
      production_writes:0,
      publishes:0,
      notification_sends:0,
      final_truth_mutation:false
    })
  });

  assert.equal(result.status, 'SHADOW_EVAL_PASS');
  assert.equal(result.shadow_eval_passed, true);
  assert.equal(result.total, cases.length);
  assert.equal(result.passed, cases.length);
  assert.equal(result.mismatches, 0);
  assert.equal(result.authority_violations, 0);
  assert.equal(result.production_writes, 0);
});

test('one mismatch or authority violation blocks shadow acceptance', async () => {
  let index = 0;
  const expectedById = new Map(cases.map(item => [item.case_id, item.expected_decision]));
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn: async (workload, input) => {
      const current = index++;
      return {
        status:'SHADOW_RESULT_READY',
        workload,
        shadow_decision:{
          decision:current===0 ? 'REJECT' : expectedById.get(input.case_id),
          reason_codes:[],
          evidence_labels:[],
          conflicts:[],
          confidence:0.8,
          rationale_summary:'fixture',
          authority:current===1 ? 'FINAL_AUTHORITY' : 'SHADOW_ADVISORY_ONLY',
          production_writes:current===1 ? 1 : 0,
          publishes:0,
          notification_sends:0,
          final_truth_mutation:current===1
        },
        production_writes:0,
        publishes:0,
        notification_sends:0,
        final_truth_mutation:false
      };
    }
  });
  assert.equal(result.status, 'SHADOW_EVAL_BLOCKED');
  assert.equal(result.shadow_eval_passed, false);
  assert.equal(result.mismatches >= 1, true);
  assert.equal(result.authority_violations >= 1, true);
  assert.equal(result.production_writes, 0);
});

test('blocked transport cannot be counted as a passing eval', async () => {
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn: async () => ({
      status:'BLOCKED_OPENAI_API_KEY_MISSING',
      shadow_decision:null,
      production_writes:0
    })
  });
  assert.equal(result.status, 'SHADOW_EVAL_BLOCKED');
  assert.equal(result.shadow_eval_passed, false);
  assert.equal(result.blocked, cases.length);
  assert.equal(result.production_writes, 0);
});


test('blocked runtime with nonzero wrapper writes is still an authority violation', async () => {
  let first = true;
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn:async()=>{
      if (first) {
        first = false;
        return {
          status:'BLOCKED_PROVIDER',
          shadow_decision:null,
          production_writes:1,
          publishes:0,
          notification_sends:0,
          final_truth_mutation:false
        };
      }
      return {
        status:'BLOCKED_PROVIDER',
        shadow_decision:null,
        production_writes:0,
        publishes:0,
        notification_sends:0,
        final_truth_mutation:false
      };
    }
  });
  assert.equal(result.shadow_eval_passed,false);
  assert.equal(result.authority_violations,1);
  assert.equal(result.production_writes,0);
});


test('provider failures retain only secret-safe diagnostics for remediation', async () => {
  const result = await Eval.evaluateSuite(cases, {
    runShadowFn:async()=>({
      status:'SHADOW_PROVIDER_UNAVAILABLE',
      shadow_decision:null,
      transport:'VERCEL_AI_GATEWAY',
      provider_status:403,
      provider_error_code:'access_denied',
      network_calls:1,
      production_writes:0,
      publishes:0,
      notification_sends:0,
      final_truth_mutation:false
    })
  });
  assert.equal(result.shadow_eval_passed,false);
  assert.equal(result.results[0].provider_status,403);
  assert.equal(result.results[0].provider_error_code,'access_denied');
  assert.equal(result.results[0].transport,'VERCEL_AI_GATEWAY');
  assert.equal(JSON.stringify(result).includes('Bearer '),false);
});
