'use strict';

const Controller=require('./kk-ultra-deep-phase3-controller.js');
const Learning=require('./kk-ultra-deep-phase3-learning-agent.js');
const Scanner=require('./kk-ultra-deep-competitor-price-scanner.js');

const VERSION='KK_ULTRA_DEEP_PHASE3_RUNTIME_V1';
const DEFAULT_MAX_ROUNDS=3;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function candidateId(row={}){return text(row.candidate_id||row.event_key||row.id);}
function evidenceKey(r={}){
 return [text(r.event_key||r.candidate_id),text(r.competitor_id),text(r.package_type),String(r.price||''),text(r.source_url)].join('|');
}
function mergeEvidence(a=[],b=[]){
 const map=new Map();for(const row of [...arr(a),...arr(b)]){const k=evidenceKey(row);if(k&&!map.has(k))map.set(k,row);}
 return [...map.values()];
}
function candidatesWithMisses(candidates=[],misses=[]){
 const ids=new Set(arr(misses).map(x=>text(x.candidate_id)).filter(Boolean));
 return arr(candidates).filter(c=>ids.has(candidateId(c)));
}
async function run(input={},options={}){
 const diagnostic=input.diagnostic_only===true||options.diagnostic_only===true;
 const candidates=arr(input.candidates);
 const maxRounds=Math.max(1,Math.min(5,Number(input.max_rounds||options.max_rounds||DEFAULT_MAX_ROUNDS)||DEFAULT_MAX_ROUNDS));
 let competitor_prices=arr(input.competitor_prices);
 let learnedCompetitors=arr(input.learned_competitors);
 let extraQueries=input.extra_queries_by_candidate||{};
 const rounds=[];
 let final=null;
 for(let round=1;round<=maxRounds;round++){
  const scanTargets=round===1?candidates:candidatesWithMisses(candidates,final&&final.learning_misses||[]);
  if(scanTargets.length&&options.skip_scan!==true){
   const scan=await Scanner.scanBatch(scanTargets,{
    ddgs_runner:options.ddgs_runner,
    max_results:Number(options.max_results||20),
    concurrency:Number(options.concurrency||3),
    competitor_universe:arr(input.competitor_universe),
    learned_competitors:learnedCompetitors,
    target_competitor_universe:Number(input.target_competitor_universe||20),
    desired_independent_competitors:Number(input.desired_independent_competitors||5),
    extra_queries_by_candidate:extraQueries,
    max_price_age_days:Number(input.max_price_age_days||Controller.DEFAULT_MAX_PRICE_AGE_DAYS),
    now:options.now
   });
   competitor_prices=mergeEvidence(competitor_prices,scan.evidence);
   learnedCompetitors=[...new Set([...learnedCompetitors,...arr(scan.discovered_competitors)])];
  }
  final=Controller.evaluate({...input,candidates,competitor_prices,phase2_artifact:input.phase2_artifact},{diagnostic_only:diagnostic});
  const learning=Learning.learn({misses:final.learning_misses,candidates});
  rounds.push({
   round,status:final.status,
   price_ready:final.results.filter(x=>['PRICE_READY','PRICE_LOCKED_BOOKING','SKIP_OWNER_HIDDEN','SKIP_NOT_VERIFIED'].includes(x.status)).length,
   holds:final.results.filter(x=>x.status==='HOLD').length,
   learning_miss_count:final.learning_misses.length,
   learning_miss_classes:learning.miss_classes,
   mandatory_expansion:learning.mandatory_expansion,
   evidence_count:competitor_prices.length
  });
  if(['PHASE3_BLOCKED','PHASE3_HOLD'].includes(final.status))break;
  if(!final.learning_misses.length||round>=maxRounds)break;
  const before=competitor_prices.length;
  extraQueries=learning.extra_queries_by_candidate;
  if(round>1&&before===Number(rounds[rounds.length-2]&&rounds[rounds.length-2].evidence_count||-1))break;
 }
 const accepted=final&&final.status==='PHASE3_ACCEPTED';
 return {
  version:VERSION,
  status:accepted?'PHASE3_ACCEPTED':(final?final.status:'PHASE3_HOLD'),
  diagnostic_only:diagnostic,
  candidate_count:candidates.length,
  competitor_evidence_count:competitor_prices.length,
  learned_competitors:learnedCompetitors,
  rounds,
  results:final?final.results:[],
  learning_misses:final?final.learning_misses:[],
  blockers:final?final.blockers:['PHASE3_RUNTIME_NO_RESULT'],
  phase2_gate:final?final.phase2_gate:null,
  candidate_set:final?final.candidate_set:null,
  recovery_exhausted:Boolean(final&&final.learning_misses.length&&rounds.length>=maxRounds),
  ready_for_phase4:Boolean(accepted&&!diagnostic&&final.ready_for_phase4===true),
  production_writes:0,
  phase4_started:false
 };
}
module.exports={VERSION,DEFAULT_MAX_ROUNDS,text,arr,candidateId,evidenceKey,mergeEvidence,candidatesWithMisses,run};
