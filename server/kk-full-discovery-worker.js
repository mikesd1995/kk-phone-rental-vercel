'use strict';

const crypto = require('crypto');
const Watch = require('./discovery-source-watch-contract.js');
const SourceRegistry = require('./kk-ultra-deep-source-registry.js');
const Reconciliation = require('./kk-ultra-deep-reconciliation.js');
const KnownMiss = require('./kk-ultra-deep-known-miss-regression.js');

const WORKER_VERSION = 'KK_FULL_DISCOVERY_WORKER_V5';
const ULTRA_DEEP_MODE = 'ULTRA_DEEP';
const ULTRA_DEEP_REQUIRED_SOURCE_TIERS = Object.freeze([
  'OFFICIAL', 'TICKETING', 'VENUE', 'ARTIST_AGENCY',
  'BRAND_SPONSOR', 'SOCIAL', 'COMPETITOR', 'PUBLIC_CALENDAR'
]);
const MAX_OBSERVATIONS = 50;
const MAX_CANDIDATES = 100;

function text(v){ return String(v == null ? '' : v).trim(); }
function norm(v){ return text(v).toLowerCase().replace(/\s+/g,' '); }
function sha(v){ return crypto.createHash('sha256').update(String(v),'utf8').digest('hex'); }

function candidateKey(c={}){
  const title=norm(c.title);
  const date=norm(c.event_date);
  const venue=norm(c.venue);
  const artists=(Array.isArray(c.artist)?c.artist:[c.artist]).map(norm).filter(Boolean).sort().join('|');
  if(!title && !date && !venue && !artists) return '';
  return sha([title,date,venue,artists].join('\n'));
}

function normalizeCandidate(c={}, fallback={}){
  const artist=(Array.isArray(c.artist)?c.artist:[c.artist]).map(text).filter(Boolean).slice(0,20);
  const sourceUrl=(()=>{try{const u=new URL(text(c.source_url||fallback.source_url));return u.protocol==='https:'?u.toString():null;}catch(_){return null;}})();
  const out={
    candidate_id:text(c.candidate_id),
    title:text(c.title)||null,
    event_date:text(c.event_date)||null,
    event_time:text(c.event_time)||null,
    venue:text(c.venue)||null,
    artist,
    source_url:sourceUrl,
    source_tier:text(c.source_tier||fallback.source_tier).toUpperCase()||null,
    source_provider:text(c.source_provider||fallback.provider).toUpperCase()||null,
    observed_at:text(c.observed_at||fallback.observed_at)||null,
    evidence_ref:text(c.evidence_ref||fallback.evidence_ref)||null,
    confidence:Number.isFinite(Number(c.confidence))?Number(c.confidence):null
  };
  out.identity_key=candidateKey(out);
  if(!out.candidate_id) out.candidate_id=out.identity_key?('DISC-'+out.identity_key.slice(0,16)):'';
  return out;
}

function coverageReport(observations=[],sourceReports=[]){
  const reportById=new Map(sourceReports.map(r=>[text(r&&r.observation_id),r]));
  const seen=new Set();
  const proofByTier=Object.fromEntries(ULTRA_DEEP_REQUIRED_SOURCE_TIERS.map(t=>[t,[]]));
  for(const o of observations){
    const tier=text(o&&o.source_tier).toUpperCase();
    if(!tier || !proofByTier[tier]) continue;
    const report=reportById.get(text(o&&o.observation_id));
    if(!report) continue;
    const status=text(report.status).toUpperCase();
    if(status.startsWith('BLOCKED_') || status.includes('REJECTED') || status.includes('ERROR')) continue;
    const calls=Number(report.discovery_call_count||0);
    const unchanged=status==='NO_CHANGE';
    if(calls<1 && !unchanged) continue;
    seen.add(tier);
    proofByTier[tier].push({
      observation_id:text(o&&o.observation_id),
      status,
      discovery_call_count:calls,
      execution_proof:unchanged?'VALIDATED_UNCHANGED':'DISCOVERY_CALL'
    });
  }
  const missing=ULTRA_DEEP_REQUIRED_SOURCE_TIERS.filter(t=>!seen.has(t));
  return {
    required_source_tiers:[...ULTRA_DEEP_REQUIRED_SOURCE_TIERS],
    observed_source_tiers:[...seen].sort(),
    missing_source_tiers:missing,
    complete:missing.length===0,
    proof_complete:missing.length===0,
    proof_by_source_tier:proofByTier,
    coverage_percent:Number((((ULTRA_DEEP_REQUIRED_SOURCE_TIERS.length-missing.length)/ULTRA_DEEP_REQUIRED_SOURCE_TIERS.length)*100).toFixed(2))
  };
}

function mergeCandidates(rows=[]){
  const byKey=new Map();
  const rejected=[];
  for(const raw of rows.slice(0,MAX_CANDIDATES*2)){
    const c=normalizeCandidate(raw.candidate||raw,raw.fallback||{});
    if(!c.identity_key || !c.source_url){
      rejected.push({candidate_id:c.candidate_id||null,reason:!c.identity_key?'IDENTITY_INSUFFICIENT':'SOURCE_URL_INVALID'});
      continue;
    }
    const prior=byKey.get(c.identity_key);
    if(!prior){
      byKey.set(c.identity_key,{...c,evidence:[{source_url:c.source_url,source_tier:c.source_tier,source_provider:c.source_provider,evidence_ref:c.evidence_ref}]});
      continue;
    }
    const evidence=prior.evidence||[];
    if(!evidence.some(e=>e.source_url===c.source_url)) evidence.push({source_url:c.source_url,source_tier:c.source_tier,source_provider:c.source_provider,evidence_ref:c.evidence_ref});
    prior.evidence=evidence.slice(0,10);
    if((c.confidence||0)>(prior.confidence||0)) prior.confidence=c.confidence;
  }
  return {candidates:[...byKey.values()].slice(0,MAX_CANDIDATES),rejected};
}

function buildQualityEvidence(input,coverage,merged){
  const universe=SourceRegistry.buildUniverseProof(input.source_universe_receipts||[],{strict_live:true,month:text(input.month)});
  const reconciliation=Reconciliation.reconcileCandidateSets(
    merged.candidates,
    input.reconciliation_reference_candidates||[]
  );
  const knownMiss=KnownMiss.evaluate(
    input.known_miss_probe_candidates||[],
    input.known_miss_classifications||[]
  );
  const complete=coverage.proof_complete && universe.complete && reconciliation.complete && knownMiss.complete;
  const blockers=[
    ...(!coverage.proof_complete?['SOURCE_CLASS_PROOF_INCOMPLETE']:[]),
    ...(!universe.complete?['SOURCE_UNIVERSE_PROOF_INCOMPLETE']:[]),
    ...(!reconciliation.complete?['RECONCILIATION_GAPS_REMAIN']:[]),
    ...(!knownMiss.complete?['KNOWN_MISS_REGRESSION_INCOMPLETE']:[])
  ];
  return {
    complete,
    blockers,
    source_class_proof:coverage,
    source_universe_proof:universe,
    reconciliation,
    known_miss_regression:knownMiss
  };
}

async function runFullDiscovery(input={},options={}){
  const observations=Array.isArray(input.observations)?input.observations.slice(0,MAX_OBSERVATIONS):[];
  const providerFn=typeof options.discoverFn==='function'?options.discoverFn:null;
  const supplied=Array.isArray(input.provider_results)?input.provider_results:[];
  const staged=[];
  const sourceReports=[];

  if(!observations.length){
    return {
      worker_version:WORKER_VERSION,status:'BLOCKED_NO_SOURCE_OBSERVATIONS',
      blockers:['SOURCE_OBSERVATIONS_REQUIRED'],handoff:null,authoritative:false,
      verifier_required:true,production_writes:0,final_truth_mutation:false,notification_sends:0
    };
  }

  for(let i=0;i<observations.length;i++){
    const obs=observations[i];
    const resultForObservation=supplied[i];
    const run=await Watch.runGuardedDiscovery(obs,{
      ...(options.sourceWatchOptions||{}),
      discoverFn:providerFn
        ? checked=>providerFn(checked,{index:i})
        : (resultForObservation ? async()=>resultForObservation : undefined)
    });
    sourceReports.push({
      observation_id:text(obs.observation_id),
      status:run.status,
      discovery_call_count:run.discovery_call_count,
      blockers:Array.isArray(run.blockers)?run.blockers:[]
    });
    if(run.handoff && Array.isArray(run.handoff.candidates)){
      for(const c of run.handoff.candidates){
        staged.push({candidate:c,fallback:run.handoff});
      }
    }
  }

  const merged=mergeCandidates(staged);
  const scanMode=text(input.scan_mode).toUpperCase();
  const coverage=coverageReport(observations,sourceReports);
  const ultraDeep=scanMode===ULTRA_DEEP_MODE;
  const qualityEvidence=ultraDeep?buildQualityEvidence(input,coverage,merged):null;
  const ultraDeepReady=!ultraDeep || qualityEvidence.complete;
  const hardFailures=sourceReports.filter(r=>String(r.status).startsWith('BLOCKED_')||String(r.status).includes('REJECTED'));
  const handoff={
    handoff_version:'kk-full-discovery-handoff-v2',
    handoff_state:ultraDeepReady?'READY_FOR_VERIFIER':'HOLD_FOR_COVERAGE',
    route:'EXISTING_SCANNER_TO_VERIFIER_HANDOFF',
    scan_mode:scanMode||'STANDARD',
    source_coverage:coverage,
    quality_evidence:qualityEvidence,
    candidates:merged.candidates,
    candidate_count:merged.candidates.length,
    dedup_rejected:merged.rejected,
    authoritative:false,
    verifier_required:true,
    production_writes:0,
    final_truth_mutation:false,
    notification_sends:0,
    direct_business_write_allowed:false,
    direct_notification_allowed:false
  };

  return {
    worker_version:WORKER_VERSION,
    status:!ultraDeepReady
      ? 'BLOCKED_INCOMPLETE_SOURCE_COVERAGE'
      : (merged.candidates.length?'READY_FOR_VERIFIER':(hardFailures.length?'DISCOVERY_BLOCKED_OR_EMPTY':'NO_NEW_CANDIDATES')),
    blockers:qualityEvidence?qualityEvidence.blockers:[],
    observations_received:observations.length,
    source_reports:sourceReports,
    source_coverage:coverage,
    quality_evidence:qualityEvidence,
    handoff,
    authoritative:false,
    verifier_required:true,
    production_writes:0,
    final_truth_mutation:false,
    notification_sends:0
  };
}

module.exports={
  WORKER_VERSION,ULTRA_DEEP_MODE,ULTRA_DEEP_REQUIRED_SOURCE_TIERS,MAX_OBSERVATIONS,MAX_CANDIDATES,
  candidateKey,normalizeCandidate,coverageReport,mergeCandidates,buildQualityEvidence,runFullDiscovery
};
