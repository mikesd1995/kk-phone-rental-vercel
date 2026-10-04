#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));

const REQUIRED_ROOT=['PRODUCT.md','DESIGN.md','ARCHITECTURE.md','ACCEPTANCE.md','RUNBOOK.md'];
const REQUIRED_SKILLS=['storefront-ux','visual-qa','event-discovery','event-verification','pricing','booking-integrity','storefront-publishing','production-release','incident-debugger','learning-review'];

function check(id,pass,detail){return {id,pass:!!pass,detail};}

function audit(){
  const agents=read('AGENTS.md');
  const acceptance=read('ACCEPTANCE.md');
  const design=read('DESIGN.md');
  const pricingSkill=read('skills/pricing/SKILL.md');
  const pricingPolicy=read('server/kk-final-pricing-policy.js');
  const learning=read('server/kk-ultra-deep-v2-learning-agent.js');
  const dashboard=read('server/rental-dashboard-core.js');
  const registry=read('server/kk-agent-registry.js');
  const router=read('server/kk-agent-task-router.js');
  const routes=JSON.parse(read('config/kk-code-context-routes.json'));
  const vercelIgnore=read('scripts/vercel-ignore-build.js');

  const checks=[
    check('ROOT_CONTRACTS_PRESENT',REQUIRED_ROOT.every(exists),'Canonical product/design/architecture/acceptance/runbook contracts must exist.'),
    check('CORE_SKILLS_PRESENT',REQUIRED_SKILLS.every(x=>exists('skills/'+x+'/SKILL.md')),'All declared core skill contracts must exist.'),
    check('SKILLS_ARE_ORCHESTRATION_NOT_DUPLICATE_RUNTIME',/do not create a duplicate runtime agent/i.test(agents),'Skills must not imply duplicate runtime agents/SOTs.'),
    check('PRICING_SKILL_DELEGATES_EXECUTABLE_POLICY',
      /server\/kk-final-pricing-policy\.js/.test(pricingSkill)&&/executable pricing code/i.test(pricingSkill)&&/must not invent a parallel pricing algorithm/i.test(pricingSkill),
      'Pricing skill must delegate final authority to executable pricing policy.'),
    check('PRICING_EXACT_MEDIAN_IMPLEMENTED',
      /EXACT_EVENT_COMPETITOR_MEDIAN/.test(pricingPolicy)&&/exactCompetitorMedian/.test(pricingPolicy),
      'Executable pricing policy must retain exact-event competitor median behavior.'),
    check('PRICING_APPROVED_FALLBACK_IMPLEMENTED',
      /KK_RENTAL_FIT_SCORE_FALLBACK/.test(pricingPolicy)&&/KK_ACTIVE_STANDARD_PACKAGE_SOT/.test(pricingPolicy),
      'Executable pricing policy must retain approved score/baseline fallback.'),
    check('BOOKING_PRICE_LOCK_PROTECTED',
      /BOOKING_PRICE_LOCK/.test(learning)&&/protected/i.test(agents+acceptance),
      'Booking price lock must remain protected from learning/governance drift.'),
    check('TOMBSTONE_PROTECTED',
      /TOMBSTONE_NO_RESURRECTION/.test(learning)&&/tombstone/i.test(acceptance),
      'Owner-hidden/tombstone policy must remain protected.'),
    check('REVENUE_POLICY_MATCHES_RUNTIME',
      /Actual=completed/.test(acceptance)&&/pending\/confirmed\/prepared\/picked_up\/returned\/uploaded/.test(acceptance)&&
      /new Set\(\["pending","confirmed","prepared","picked_up","returned","uploaded"\]\)/.test(dashboard),
      'Documented revenue buckets must match dashboard runtime.'),
    check('DESIGN_RUNTIME_COUNCIL_REUSED',
      /kk-storefront-ux-reviewer/.test(agents)&&/storefront_ux_review/.test(agents)&&
      /storefront_design_council/.test(registry)&&/storefront_design_council/.test(router),
      'Design contract must reuse registered UX/Design Council runtime routes.'),
    check('DESIGN_NO_SINGLE_DEVICE_BRAND_LOCK',
      /Do not hard-code the brand around vivo X300 Pro or any single device model/.test(design),
      'Design contract must preserve multi-device future compatibility.'),
    check('CODE_INTELLIGENCE_ROUTES_CANONICAL_SKILLS',
      JSON.stringify(routes).includes('skills/storefront-ux/SKILL.md')&&JSON.stringify(routes).includes('skills/pricing/SKILL.md')&&JSON.stringify(routes).includes('skills/incident-debugger/SKILL.md'),
      'Code Intelligence must route relevant work through canonical domain skills.'),
    check('SKILLS_ONLY_DO_NOT_FORCE_VERCEL_BUILD',
      vercelIgnore.includes("/^skills\\\\//"),
      'Governance-only skill changes should not consume Vercel builds.'),
    check('PRODUCTION_ACCEPTANCE_NOT_BUILD_ONLY',
      /green build.*alone is not acceptance/i.test(acceptance)&&/fresh production evidence/i.test(acceptance),
      'A build/preview must not be treated as production acceptance.')
  ];
  const failed=checks.filter(x=>!x.pass);
  return {schema:'kk-agent-contract-audit/v1',status:failed.length?'BLOCKED':'PASS',checks,failed_checks:failed.map(x=>x.id),production_writes:0,business_data_mutations:0};
}
if(require.main===module){const r=audit();process.stdout.write(JSON.stringify(r,null,2)+'\n');process.exitCode=r.status==='PASS'?0:2;}
module.exports={audit};
