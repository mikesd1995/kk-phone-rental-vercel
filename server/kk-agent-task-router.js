'use strict';

const SourceWatch = require('./discovery-source-watch-contract.js');
const Verifier = require('./verifier-no-drop-reconciliation.js');
const Canary = require('./canary-acceptance.js');
const Reliability = require('./kk-reliability-learning-agent.js');
const ReliabilityFeedback = require('./kk-reliability-feedback-loop.js');
const HfAdapter = require('./hf-scanner-adapter.js');
const OperatingPartner = require('./kk-operating-partner.js');
const DecisionLedger = require('./kk-decision-ledger.js');
const CreativeProduction = require('./kk-creative-production.js');
const FullDiscovery = require('./kk-full-discovery-worker.js');
const CommercialPrep = require('./kk-discovery-commercial-prep.js');
const StorefrontPromotion = require('./kk-verifier-storefront-promotion.js');
const StorefrontExecutor = require('./kk-governed-storefront-executor.js');
const UltraDeepV3 = require('./kk-ultra-deep-v3.js');
const UltraDeepProvider = require('./kk-ultra-deep-provider-executor.js');
const UltraDeepPublicWeb = require('./kk-ultra-deep-public-web-adapters.js');
const MonthlyDeepScan = require('./kk-monthly-deep-scan-query-plan.js');
const FinalPricingPolicy = require('./kk-final-pricing-policy.js');
const StorefrontUx = require('./kk-storefront-ux-reviewer.js');
const StorefrontArt = require('./kk-storefront-art-director.js');
const UltraDeepRuntime = require('./kk-ultra-deep-runtime-runner.js');
const StorefrontDesignCouncil = require('./kk-storefront-design-council.js');

const TASK_ROUTER_VERSION = 'KK_AGENT_TASK_ROUTER_V14';

async function resolveDecisionHistory(input, options){
  if(Array.isArray(input.decision_history)) return {rows:input.decision_history,status:'SUPPLIED'};
  const historyFn=typeof options.decisionHistoryFn==='function'
    ? options.decisionHistoryFn
    : async()=>DecisionLedger.listEvents({env:options.env||process.env,limit:200});
  try{
    const result=await historyFn();
    return {rows:Array.isArray(result&&result.rows)?result.rows:[],status:'READBACK_COMPLETE'};
  }catch(error){
    return {
      rows:[],
      status:'READBACK_DEGRADED',
      error_code:String(error&&(error.code||error.name)||'DECISION_HISTORY_READ_FAILED')
    };
  }
}

async function executeTask(taskType, input = {}, options = {}) {
  switch (String(taskType || '').trim().toLowerCase()) {
    case 'storefront_design_council':
      const council=StorefrontDesignCouncil.runCouncil(input); return { invoked_agents:council.invoked_agents, result:council };

    case 'storefront_design_council_acceptance':
      return { invoked_agents:StorefrontDesignCouncil.ROLES.map(role=>role.agent), result:StorefrontDesignCouncil.acceptCouncil(input) };

    case 'storefront_art_direction':
      return { invoked_agents:['kk-storefront-art-director'], result:StorefrontArt.buildDirection(input) };

    case 'storefront_art_acceptance':
      return { invoked_agents:['kk-storefront-art-director'], result:StorefrontArt.evaluateImplementation(input) };

    case 'storefront_ux_review':
      return { invoked_agents:['kk-storefront-ux-reviewer'], result:StorefrontUx.auditStorefront(input) };

    case 'storefront_visual_qa':
      return { invoked_agents:['kk-storefront-ux-reviewer'], result:StorefrontUx.validateVisualQa(input) };

    case 'creative_production_plan':
      return {
        invoked_agents: ['kk-creative-production'],
        result: CreativeProduction.buildProductionPlan(input)
      };

    case 'creative_media_qa':
      return {
        invoked_agents: ['kk-creative-production'],
        result: CreativeProduction.validateCreativeOutput(
          CreativeProduction.buildCreativeBrief(input.brief || input),
          input.result || {}
        )
      };

    case 'plan_monthly_deep_scan':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: MonthlyDeepScan.build(input)
      };

    case 'plan_ultra_deep_scan':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: UltraDeepV3.planGapSearch(input.observations || [], input.options || {})
      };

    case 'execute_monthly_ultra_deep':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: await UltraDeepRuntime.runMonthlyUltraDeep(input, {
          publicWebOptions: options.publicWebOptions || {},
          providers: options.ultraDeepProviders || {}
        })
      };

    case 'execute_ultra_deep_gaps':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: await UltraDeepProvider.executeGapPlan(input.plan || input, {
          providers: Object.assign({}, UltraDeepPublicWeb.createProviders(options.publicWebOptions || {}), options.ultraDeepProviders || {})
        })
      };

    case 'accept_ultra_deep_scan':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: UltraDeepV3.acceptance(input)
      };

    case 'scan_event':
      return {
        invoked_agents: ['kk-discovery-source-watch', 'kk-discovery-scanner'],
        result: await FullDiscovery.runFullDiscovery(input, {
          discoverFn: options.discoveryProviderFn,
          sourceWatchOptions: options.sourceWatchOptions || {}
        })
      };

    case 'prepare_event_commercial':
      return {
        invoked_agents: ['kk-commercial-evidence'],
        result: CommercialPrep.prepareBatch(input)
      };

    case 'source_watch_check':
      return {
        invoked_agents: ['kk-discovery-source-watch'],
        result: SourceWatch.evaluateObservation(input, options.sourceWatchOptions || {})
      };

    case 'resolve_final_pricing':
      return {
        invoked_agents: ['kk-commercial-evidence'],
        result: FinalPricingPolicy.resolve(input)
      };

    case 'prepare_storefront_promotion':
      return {
        invoked_agents: ['kk-event-verifier'],
        result: StorefrontPromotion.preparePromotion(input)
      };

    case 'execute_storefront_promotion':
      return {
        invoked_agents: ['kk-event-verifier'],
        result: await StorefrontExecutor.execute(input.plan || input, {
          env: options.env || process.env,
          fetchImpl: options.fetchImpl || global.fetch,
          readbackFn: options.storefrontReadbackFn,
          correlationId: input.correlation_id || options.correlationId || ''
        })
      };

    case 'verify_storefront_readback':
      return {
        invoked_agents: ['kk-event-verifier'],
        result: StorefrontPromotion.verifyStorefrontReadback(input.plan || {}, input.readback || {})
      };

    case 'verifier_no_drop_audit':
      return {
        invoked_agents: ['kk-event-verifier'],
        result: Verifier.auditNoDrop(input)
      };

    case 'canary_audit':
      return {
        invoked_agents: ['kk-canary-safety'],
        result: Canary.auditCanarySnapshot(input)
      };

    case 'engineering_reliability_guard':
      return {
        invoked_agents: ['kk-reliability-learning'],
        result: ReliabilityFeedback.buildEngineeringGuards(input.task, input.observations || input.incidents || [], {
          memory: options.reliabilityMemory,
          incident_history: input.incident_history || []
        })
      };

    case 'evaluate_reliability_repair':
      return {
        invoked_agents: ['kk-reliability-learning'],
        result: ReliabilityFeedback.evaluateRepair(input)
      };

    case 'reliability_audit': {
      const observations = Array.isArray(input.observations)
        ? input.observations
        : (Array.isArray(input.reliability_observations) ? input.reliability_observations : []);
      return {
        invoked_agents: ['kk-reliability-learning'],
        result: Reliability.analyzeReliability(observations, {
          incident_history: Array.isArray(input.incident_history) ? input.incident_history : []
        })
      };
    }

    case 'operating_partner_brief': {
      const history=await resolveDecisionHistory(input,options);
      const result=OperatingPartner.buildDailyBrief({...input,decision_history:history.rows});
      result.learning_readback={status:history.status,error_code:history.error_code||'',rows:history.rows.length};
      return {
        invoked_agents:['kk-operating-partner'],
        result
      };
    }

    case 'opportunity_review':
      return {
        invoked_agents:['kk-operating-partner'],
        result:OperatingPartner.analyzeOpportunities(input.opportunities||[])
      };

    case 'decision_feedback': {
      const checked=DecisionLedger.validateRow(input);
      if(checked.errors.length){
        throw Object.assign(new Error('decision feedback invalid'),{
          code:'DECISION_FEEDBACK_INVALID',
          blockers:checked.errors
        });
      }
      const writer=typeof options.decisionLedgerFn==='function'
        ? options.decisionLedgerFn
        : row=>DecisionLedger.recordEvent({env:options.env||process.env,row});
      const receipt=await writer(checked.row);
      return {
        invoked_agents:['kk-operating-partner'],
        result:{
          schema_version:'KK_DECISION_FEEDBACK_RESULT_V1',
          status:'RECORDED',
          receipt,
          evaluation:checked.row.event_type==='OUTCOME'
            ? OperatingPartner.evaluateDecisionOutcome(checked.row)
            : null,
          production_writes:0,
          publishes:0
        }
      };
    }

    case 'hf_event_assist':
      return {
        invoked_agents: ['hf-event-assist'],
        result: await HfAdapter.classifyScannerCandidate(input, options.hfOptions || {})
      };

    default:
      throw Object.assign(new Error('unsupported agent task'), {
        code: 'AGENT_TASK_NOT_SUPPORTED'
      });
  }
}

module.exports = {
  TASK_ROUTER_VERSION,
  resolveDecisionHistory,
  executeTask
};
