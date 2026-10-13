'use strict';

// Bounded read-only date resolution for independently discovered references.
// Source evidence is allowed to resolve coverage; it never authorizes business writes.
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');

const VERSION='KK_ULTRA_DEEP_REFERENCE_SOURCE_RESOLUTION_V1';
const MAX_PENDING_LOOKUPS=4;
function text(v){return String(v==null?'':v).trim();}
function pending(row={}){
 return row.eligible_for_discovery===true &&
  row.reference_scope_reason==='SOURCE_DATE_PENDING_PRIMARY_VERIFIER' &&
  !text(row.event_date);
}
function sameSource(a,b){
 const left=Reconciliation.canonicalSourceUrl({source_url:a});
 const right=Reconciliation.canonicalSourceUrl({source_url:b});
 return Boolean(left&&right&&left===right);
}
function millisUntilDeadline(deadline){
 const n=Number(deadline||0);
 return n>0&&Number.isFinite(n)?Math.max(0,n-Date.now()):Infinity;
}
async function resolve(rows=[],context={},options={}){
 const refs=Array.isArray(rows)?rows:[];
 const toReview=refs.map((row,index)=>({row,index})).filter(x=>pending(x.row));
 const selected=toReview.slice(0,MAX_PENDING_LOOKUPS);
 const results=new Map();
 const enabled=options.enabled===true;
 const fetchFn=typeof options.fetchFn==='function'?options.fetchFn:undefined;
 const deadline=options.deadline_ms;
 let attempted=0,verified=0;
 if(enabled){
  // Avoid stealth network calls in an injected-only/offline test harness.
  // The caller opts in and supplies a fetch function for offline mode.
  const concurrency=2;
  let cursor=0;
  async function worker(){
   while(cursor<selected.length){
    const item=selected[cursor++];
    if(millisUntilDeadline(deadline)<500){
     results.set(item.index,{status:'BUDGET_EXHAUSTED'});
     continue;
    }
    attempted++;
    let verification;
    try{
     verification=await Verifier.verifyCandidate(
      {...item.row,event_date:null,date_pending_verification:true},
      context,{fetchFn,timeout_ms:Math.min(5000,millisUntilDeadline(deadline))}
     );
    }catch(_){
     results.set(item.index,{status:'SOURCE_FETCH_FAILED'});
     continue;
    }
    const candidate=verification&&verification.candidate||{};
    // A fresh source-backed Verifier receipt must establish the exact event,
    // month, authoritative source and eligible venue before date reconciliation.
    if(verification&&verification.verified===true &&
       /^\d{4}-\d{2}-\d{2}$/.test(text(candidate.event_date)) &&
       String(candidate.event_date).startsWith(text(context.month)+'-') &&
       sameSource(candidate.source_url,item.row.source_url) &&
       verification.evidence&&verification.evidence.authoritative_event_source===true){
      verified++;
      results.set(item.index,{status:'SOURCE_DATE_VERIFIED',
       row:{...item.row,event_date:candidate.event_date,
         reference_scope_reason:'SOURCE_DATE_VERIFIED_FROM_PRIMARY_SOURCE',
         source_date_verified:true,
         verified_event_name:text(candidate.title),
         candidate_origin:'INDEPENDENT_REFERENCE_RECOVERY',
         authoritative:false,verifier_required:true}});
    }else{
      results.set(item.index,{status:'HOLD_PRIMARY_SOURCE',
       blockers:Array.isArray(verification&&verification.blockers)?
         verification.blockers.slice(0,12):['SOURCE_EVENT_DATE_NOT_VERIFIED']});
    }
   }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},()=>worker()));
 }
 const unresolved=toReview.length-verified;
 const holds=toReview.map(item=>({
  reference_index:item.index,
  status:results.get(item.index)?.status||(
   !enabled?'VERIFIER_NOT_CONFIGURED':'LOOKUP_LIMIT_REACHED'),
  blockers:results.get(item.index)?.blockers||[]
 })).filter(x=>x.status!=='SOURCE_DATE_VERIFIED');
 return {
  version:VERSION,
  rows:refs.map((row,index)=>results.get(index)?.row||row),
  pending_input_count:toReview.length,
  selected_count:enabled?selected.length:0,
  attempted_count:attempted,
  verified_count:verified,
  unresolved_count:unresolved,
  lookup_limit:MAX_PENDING_LOOKUPS,
  holds,
  production_writes:0,
  source_date_verified_only:true,
  authoritative:false,
  business_writer_enabled:false
 };
}
module.exports={VERSION,MAX_PENDING_LOOKUPS,pending,sameSource,millisUntilDeadline,resolve};
