'use strict';

const VERSION='KK_STOREFRONT_VISUAL_CRITIC_V1';

function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
function critique(input={}){
  const m=input.metrics||{};
  const obs=Array.isArray(input.observations)?input.observations:[];
  const width=n(input.viewport&&input.viewport.width||m.viewport_width_px);
  const height=n(input.viewport&&input.viewport.height||m.viewport_height_px);
  const findings=[];
  const add=(code,severity,evidence,action)=>findings.push({code,severity,evidence,action});

  if(width<=600){
    const eventTop=n(m.first_event_top_px,99999);
    if(height&&eventTop>height*.92) add('EVENT_DISCOVERY_TOO_LATE','P1','first event starts at '+Math.round(eventTop)+'px on '+Math.round(height)+'px viewport','Compress pre-event content until event discovery begins inside the first viewport.');
    if(n(m.pre_event_surface_count)>3) add('PRE_EVENT_SURFACE_OVERLOAD','P1',String(m.pre_event_surface_count)+' distinct surfaces appear before events','Move secondary utilities out of the primary discovery path.');
    if(n(m.hero_height_px)>height*.46) add('HERO_DOMINATES_MOBILE','P1','hero consumes '+Math.round(n(m.hero_height_px)/height*100)+'% of viewport height','Reduce hero copy and vertical padding; product discovery is the primary task.');
  }
  if(n(m.card_columns)===2 && n(m.card_min_width_px)<165) add('CARD_SCAN_DENSITY_TOO_HIGH','P1','two-column cards are only '+Math.round(n(m.card_min_width_px))+'px wide','Use one-column compact event rows/cards or increase minimum card width.');
  if(m.bottom_cta_fixed===true && n(m.visible_event_cards_above_fold)>0) add('FLOATING_CTA_COMPETES_WITH_EVENTS','P1','fixed CTA is present while event cards are visible','Remove the persistent CTA from mobile/tablet; place conversion CTA at decision points.');
  if(n(m.filter_rows)>1) add('FILTER_COMPOSITION_BREAKS','P1','filter controls wrap to '+m.filter_rows+' rows','Use a single compact filter trigger/sheet instead of wrapping status buttons.');
  for(const o of obs){
    if(!o||!o.code) continue;
    add(String(o.code),String(o.severity||'P1'),String(o.evidence||'owner visual observation'),String(o.action||'Resolve before acceptance.'));
  }
  const blockers=findings.filter(x=>x.severity==='P0'||x.severity==='P1');
  return {schema_version:VERSION,status:blockers.length?'REVISE':'PASS',viewport:{width,height},findings,blockers:blockers.map(x=>x.code)};
}
function acceptLoop(input={}){
  const rounds=Array.isArray(input.rounds)?input.rounds:[];
  const last=rounds[rounds.length-1]||{};
  const blockers=[];
  if(rounds.length<2) blockers.push('ITERATION_EVIDENCE_MISSING');
  if(last.status!=='PASS') blockers.push('FINAL_VISUAL_CRITIC_NOT_PASSING');
  if(input.owner_rejected===true) blockers.push('OWNER_VISUAL_REJECTION_ACTIVE');
  if(!input.screenshot_artifact_id) blockers.push('SCREENSHOT_ARTIFACT_MISSING');
  return {schema_version:VERSION,status:blockers.length?'BLOCKED':'PASS',rounds:rounds.length,blockers};
}
module.exports={VERSION,critique,acceptLoop};
