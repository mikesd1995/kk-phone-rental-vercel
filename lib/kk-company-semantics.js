'use strict';

/**
 * KK Phone Rental event-company semantics from Machine SOT policy v4.9.2:
 * EVENT_COMPANY_CLASSIFICATION_MODE =
 * THAI_TALENT_AFFILIATION | FOREIGN_EVENT_ORGANIZER.
 *
 * Deliberately no name-based performer/company inference. Callers must provide
 * an explicit performer origin plus the authoritative field required for that
 * origin. Organizer remains a separate dimension for all events.
 */
const MODE='THAI_TALENT_AFFILIATION|FOREIGN_EVENT_ORGANIZER';
function text(v){ return String(v == null ? '' : v).trim(); }
function resolveEventCompany(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  const origin=text(input.performer_origin).toUpperCase();
  const talentAffiliation=text(input.talent_affiliation);
  const organizer=text(input.organizer);
  if(!['THAI','FOREIGN'].includes(origin)) throw new Error('performer_origin must be THAI or FOREIGN');
  if(origin==='THAI' && !talentAffiliation) throw new Error('Thai performer requires talent_affiliation');
  if(origin==='FOREIGN' && !organizer) throw new Error('Foreign performer requires organizer/promoter');
  const company=origin==='THAI' ? talentAffiliation : organizer;
  return {
    company,
    company_basis:origin==='THAI'?'TALENT_AFFILIATION':'EVENT_ORGANIZER',
    performer_origin:origin,
    talent_affiliation:talentAffiliation || null,
    organizer:organizer || null,
    semantic_mode:MODE,
    heuristic_inference_used:false
  };
}
module.exports={MODE,resolveEventCompany};
