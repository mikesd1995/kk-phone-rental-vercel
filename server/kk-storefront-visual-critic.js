'use strict';
const VERSION='KK_STOREFRONT_VISUAL_CRITIC_V2';
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
function critique(input={}){
 const m=input.metrics||{},obs=Array.isArray(input.observations)?input.observations:[],width=n(input.viewport?.width||m.viewport_width_px),height=n(input.viewport?.height||m.viewport_height_px),findings=[];
 const add=(code,severity,evidence,action)=>findings.push({code,severity,evidence,action});
 if(width<=600){
  const eventTop=n(m.first_event_top_px,99999);
  if(height&&eventTop>height*.92)add('EVENT_DISCOVERY_TOO_LATE','P1',`first event at ${Math.round(eventTop)}px / ${height}px`,'Compress pre-event composition.');
  if(n(m.hero_height_px)>height*.48)add('HERO_DOMINATES_MOBILE','P1','hero exceeds 48% viewport','Reduce hero height without removing brand character.');
  if(n(m.pre_event_surface_count)>3)add('PRE_EVENT_SURFACE_OVERLOAD','P1','too many surfaces before events','Demote secondary utilities.');
  if(n(m.card_columns)===2&&n(m.card_min_width_px)<150)add('CARD_SCAN_DENSITY_TOO_HIGH','P1','poster cards narrower than 150px','Increase card width or use one column.');
 }
 if(m.bottom_cta_fixed===true&&n(m.visible_event_cards_above_fold)>0)add('FLOATING_CTA_COMPETES_WITH_EVENTS','P1','fixed CTA overlaps discovery layer','Move CTA to event/package decision layer.');
 if(n(m.filter_rows)>1)add('FILTER_COMPOSITION_BREAKS','P1','filters wrap','Use a contained single-row discovery control.');
 if(m.single_visual_source_of_truth===false)add('VISUAL_SOURCE_FRAGMENTED','P1','multiple storefront visual layers active','Use one versioned storefront visual layer.');
 for(const o of obs)if(o?.code)add(String(o.code),String(o.severity||'P1'),String(o.evidence||'visual observation'),String(o.action||'Resolve before acceptance.'));
 const blockers=findings.filter(x=>['P0','P1'].includes(x.severity));
 return{schema_version:VERSION,status:blockers.length?'REVISE':'PASS',viewport:{width,height},findings,blockers:blockers.map(x=>x.code)};
}
function acceptLoop(input={}){
 const rounds=Array.isArray(input.rounds)?input.rounds:[],last=rounds.at(-1)||{},blockers=[];
 if(rounds.length<2)blockers.push('ITERATION_EVIDENCE_MISSING');
 if(last.status!=='PASS')blockers.push('FINAL_VISUAL_CRITIC_NOT_PASSING');
 if(!input.screenshot_artifact_id)blockers.push('SCREENSHOT_ARTIFACT_MISSING');
 const owner=String(input.owner_decision||'PENDING').toUpperCase();
 if(owner==='REJECTED')blockers.push('OWNER_VISUAL_REJECTION_ACTIVE');
 else if(owner!=='ACCEPTED')blockers.push('OWNER_VISUAL_ACCEPTANCE_MISSING');
 if(input.baseline_comparison_pass!==true)blockers.push('PRODUCTION_BASELINE_COMPARISON_MISSING');
 return{schema_version:VERSION,status:blockers.length?'BLOCKED':'PASS',rounds:rounds.length,owner_decision:owner,blockers};
}
module.exports={VERSION,critique,acceptLoop};
