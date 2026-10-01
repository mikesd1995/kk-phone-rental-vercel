'use strict';
const VERSION='KK_STOREFRONT_FANDOM_REVIEWER_V1';
function review(input={}){
 const text=String(input.page_text||input.copy||''),findings=[],add=(code,severity,evidence,recommended_action,acceptance_test)=>findings.push({code,severity,evidence,recommended_action,acceptance_test});
 if(text&&!/(concert|event|งาน|คอนเสิร์ต|poster|โปสเตอร์|vivo|lens|เลนส์)/i.test(text))add('FANDOM_CONTEXT_WEAK','P2','Supplied storefront copy lacks concert/product context.','Make event and concert-optics purpose explicit without adding noise.','Primary copy communicates event-rental context.');
 return {schema_version:VERSION,agent:'kk-storefront-fandom-reviewer',dimension:'fandom',status:findings.some(x=>['P0','P1'].includes(x.severity))?'REVISE':'PASS',findings,production_writes:0};
}
module.exports={VERSION,review};