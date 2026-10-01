'use strict';
const VERSION='KK_STOREFRONT_CONVERSION_REVIEWER_V1';
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function review(input={}){
 const m=input.metrics||{},findings=[],add=(code,severity,evidence,recommended_action,acceptance_test)=>findings.push({code,severity,evidence,recommended_action,acceptance_test});
 if(n(m.event_card_count)<1)add('CONVERSION_EVENT_CATALOGUE_MISSING','P0','No event cards are evidenced.','Restore event catalogue before conversion review.','At least one real event card renders.');
 if(n(m.visible_event_cards_above_fold)<1&&n(input.viewport?.width)<=600)add('CONVERSION_DISCOVERY_DELAY','P2','No event content is visible in the first mobile viewport.','Reduce nonessential pre-event chrome.','At least part of an event card is visible in the first mobile viewport.');
 if(m.bottom_cta_fixed===true)add('CONVERSION_PERSISTENT_CTA_RISK','P1','A fixed CTA competes with browsing.','Keep booking CTA at event/package decision points.','No fixed CTA obscures event discovery.');
 return {schema_version:VERSION,agent:'kk-storefront-conversion-reviewer',dimension:'conversion',status:findings.some(x=>['P0','P1'].includes(x.severity))?'REVISE':'PASS',findings,production_writes:0};
}
module.exports={VERSION,review};