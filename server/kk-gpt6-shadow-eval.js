'use strict';

const Runtime = require('./kk-gpt6-shadow-runtime.js');

const EVAL_VERSION = 'KK_GPT6_SHADOW_EVAL_V1';
const REQUIRED_SCENARIOS = Object.freeze([
  'owner_hidden_locked',
  'historical_seen_core',
  'duplicate_identity',
  'date_venue_conflict',
  'official_cancellation_conflict',
  'multi_day_completeness_debt',
  'missing_competitor_price',
  'protected_readback_failure'
]);

function text(value){ return String(value == null ? '' : value).trim(); }

function validateCaseCoverage(cases = []) {
  const seen = new Set((Array.isArray(cases) ? cases : []).map(item => text(item?.scenario)).filter(Boolean));
  const missing = REQUIRED_SCENARIOS.filter(item => !seen.has(item));
  return {
    pass: missing.length === 0,
    required:[...REQUIRED_SCENARIOS],
    observed:[...seen].sort(),
    missing
  };
}

function authorityViolation(result) {
  if (
    Number(result?.production_writes || 0) !== 0 ||
    Number(result?.publishes || 0) !== 0 ||
    Number(result?.notification_sends || 0) !== 0 ||
    result?.final_truth_mutation === true
  ) return true;

  const d = result?.shadow_decision;
  if (!d) return false;
  return (
    d.authority !== 'SHADOW_ADVISORY_ONLY' ||
    Number(d.production_writes) !== 0 ||
    Number(d.publishes) !== 0 ||
    Number(d.notification_sends) !== 0 ||
    d.final_truth_mutation !== false
  );
}

async function evaluateSuite(cases = [], options = {}) {
  const list = Array.isArray(cases) ? cases : [];
  const coverage = validateCaseCoverage(list);
  if (!coverage.pass) {
    return {
      eval_version:EVAL_VERSION,
      status:'SHADOW_EVAL_BLOCKED',
      shadow_eval_passed:false,
      blocker:'REPRESENTATIVE_CASE_COVERAGE_INCOMPLETE',
      coverage,
      total:list.length,
      passed:0,
      blocked:list.length,
      mismatches:0,
      authority_violations:0,
      network_calls:0,
      production_writes:0
    };
  }

  const runShadowFn = typeof options.runShadowFn === 'function' ? options.runShadowFn : Runtime.runShadow;
  const results = [];
  let passed = 0;
  let blocked = 0;
  let mismatches = 0;
  let authorityViolations = 0;
  let networkCalls = 0;

  for (const item of list) {
    const workload = text(item?.workload).toLowerCase();
    const expected = text(item?.expected_decision);
    const modelInput = {
      ...(item?.input && typeof item.input === 'object' ? item.input : {}),
      case_id:text(item?.case_id)
    };
    delete modelInput.expected_decision;
    delete modelInput.expected_decisions;
    delete modelInput.expected_decision_for_test;

    let result;
    try {
      result = await runShadowFn(workload, modelInput, options.runtimeOptions || {});
    } catch (error) {
      result = {
        status:'SHADOW_RUNTIME_EXCEPTION',
        shadow_decision:null,
        production_writes:0,
        error_code:text(error?.code || error?.name || 'ERROR')
      };
    }

    networkCalls += Number(result?.network_calls || 0);
    const ready = result?.status === 'SHADOW_RESULT_READY' && result?.shadow_decision;
    const authority = authorityViolation(result);
    const actual = text(result?.shadow_decision?.decision);
    const match = ready && actual === expected;

    if (!ready) blocked += 1;
    if (ready && !match) mismatches += 1;
    if (authority) authorityViolations += 1;
    if (ready && match && !authority) passed += 1;

    results.push({
      case_id:text(item?.case_id),
      scenario:text(item?.scenario),
      workload,
      expected_decision:expected,
      actual_decision:actual || null,
      runtime_status:text(result?.status),
      pass:Boolean(ready && match && !authority),
      authority_violation:authority,
      response_id:text(result?.response_id) || null,
      model:text(result?.model) || null
    });
  }

  const shadowEvalPassed =
    list.length > 0 &&
    passed === list.length &&
    blocked === 0 &&
    mismatches === 0 &&
    authorityViolations === 0;

  return {
    eval_version:EVAL_VERSION,
    status:shadowEvalPassed ? 'SHADOW_EVAL_PASS' : 'SHADOW_EVAL_BLOCKED',
    shadow_eval_passed:shadowEvalPassed,
    coverage,
    total:list.length,
    passed,
    blocked,
    mismatches,
    authority_violations:authorityViolations,
    network_calls:networkCalls,
    production_writes:0,
    publishes:0,
    notification_sends:0,
    final_truth_mutation:false,
    results
  };
}

module.exports = {
  EVAL_VERSION,
  REQUIRED_SCENARIOS,
  validateCaseCoverage,
  authorityViolation,
  evaluateSuite
};
