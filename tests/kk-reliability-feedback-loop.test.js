'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Loop=require('../server/kk-reliability-feedback-loop.js');

test('known incident injects repair and regression guards into engineering plan',()=>{
 const p=Loop.buildEngineeringGuards('fix deployment loop',[{code:'VERCEL_BUILD_RATE_LIMIT'}]);
 assert.equal(p.status,'KNOWN_PATTERNS_APPLIED');
 assert.match(p.planner_guard.known_repairs[0].known_repair,/external capacity blocker/i);
 assert.equal(p.planner_guard.required_regression_guards.some(x=>/production SHA/i.test(x)),true);
 assert.equal(p.authority.production_writes,0);
});

test('novel incident preserves uncertainty and cannot self learn',()=>{
 const p=Loop.buildEngineeringGuards('fix novel issue',[{message:'never seen xyz'}]);
 assert.equal(p.status,'NOVEL_INCIDENT_REQUIRES_TRIAGE');
 assert.equal(p.planner_guard.known_repairs.length,0);
 assert.equal(p.authority.auto_apply,false);
});

test('repair acceptance fails closed until evidence guards regression and reviewer pass',()=>{
 const p=Loop.buildEngineeringGuards('fix identity',[{code:'FAIL_REQUIRES_EXACT_IDENTITY'}]);
 let a=Loop.evaluateRepair({feedback_plan:p,implemented_regression_guards:[],regression_passed:true,independent_reviewer_passed:true,original_failure_evidence_preserved:true});
 assert.equal(a.status,'BLOCKED');
 a=Loop.evaluateRepair({feedback_plan:p,implemented_regression_guards:p.planner_guard.required_regression_guards,regression_passed:true,independent_reviewer_passed:true,original_failure_evidence_preserved:true});
 assert.equal(a.status,'ACCEPTED_FOR_HUMAN_REVIEW');
 assert.equal(a.safe_to_auto_apply,false);
});
