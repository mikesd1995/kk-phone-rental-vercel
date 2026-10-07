'use strict';
const VERSION='KK_ULTRA_DEEP_DEMAND_CALIBRATION_V1';
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function bucket(s){return s>=75?'PRIORITY':s>=60?'PUBLISH':s>=45?'WATCH':'REJECT';}
function outcome(r={}){return {external_positive:Number(r.external_competitor_full_or_waitlist||0)>0||Number(r.external_post_event_demand_signal||0)>0,kk_booking_count:Number(r.kk_booking_count||0),kk_used_for_threshold_fit:false};}
function backtest(rows=[]){
 const clean=(rows||[]).map(r=>({...r,score:num(r.external_score)})).filter(r=>r.score!==null),groups={PRIORITY:[],PUBLISH:[],WATCH:[],REJECT:[]};
 for(const r of clean)groups[bucket(r.score)].push({...r,outcome:outcome(r)});
 const summary={};for(const [k,xs] of Object.entries(groups)){const p=xs.filter(x=>x.outcome.external_positive).length;summary[k]={n:xs.length,external_positive:p,external_positive_rate:xs.length?Math.round(p/xs.length*1000)/10:null};}
 return {version:VERSION,summary,rows:groups,recommendation:clean.length<30?'KEEP_THRESHOLDS_COLLECT_MORE_EXTERNAL_OUTCOMES':'REVIEW_THRESHOLDS_BY_EVENT_TYPE',internal_outcomes_are_diagnostic_only:true,production_writes:0};
}
module.exports={VERSION,bucket,outcome,backtest};