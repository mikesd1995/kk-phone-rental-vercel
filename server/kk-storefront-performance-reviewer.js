'use strict';
const VERSION='KK_STOREFRONT_PERFORMANCE_REVIEWER_V1';
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function review(input={}){
 const m=input.metrics||{},findings=[],add=(code,severity,evidence,recommended_action,acceptance_test)=>findings.push({code,severity,evidence,recommended_action,acceptance_test});
 if(n(m.backdrop_blur_px)>18)add('PERF_EXCESSIVE_BLUR','P2','Backdrop blur exceeds 18px.','Reduce compositing-heavy blur on scrolling surfaces.','Backdrop blur <=18px unless measured otherwise.');
 if(Array.isArray(input.broken_visible_images)&&input.broken_visible_images.length)add('PERF_VISIBLE_IMAGE_NOT_READY','P1','Visible event imagery is not ready.','Fix image loading/fallback behavior.','Visible event images complete successfully.');
 return {schema_version:VERSION,agent:'kk-storefront-performance-reviewer',dimension:'performance',status:findings.some(x=>['P0','P1'].includes(x.severity))?'REVISE':'PASS',findings,production_writes:0};
}
module.exports={VERSION,review};