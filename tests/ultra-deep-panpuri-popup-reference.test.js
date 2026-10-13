'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {referenceScopeDecision,scopeReferenceCandidates,recoverEligibleReferenceCandidates}=require('../server/kk-ultra-deep-runtime-runner');

const context={month:'2026-10',location:'Bangkok Thailand'};
const source_url='https://example.org/official-event-post';
test('artist-led brand pop-up is a verifier-only reference discovery lead',()=>{
 const row={title:'PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP',artist:'PHUTATCHAI | THAI',event_date:'2026-10-21',venue:'centralwOrld Beacon 3',source_url};
 const decision=referenceScopeDecision(row,context);
 assert.equal(decision.eligible,true);
 const scoped=scopeReferenceCandidates([row],context);
 const recovered=recoverEligibleReferenceCandidates([],scoped);
 assert.equal(recovered.recovered_count,1);
 assert.equal(recovered.candidates[0].verifier_required,true);
 assert.equal(recovered.candidates[0].authoritative,false);
});
test('generic retail pop-up without named artist is not recovered',()=>{
 const row={title:'PAÑPURI HOLIDAY POP-UP',event_date:'2026-10-21',venue:'centralwOrld',source_url};
 assert.equal(referenceScopeDecision(row,context).eligible,false);
});
test('outside month remains excluded while a strong date-less Bangkok source enters verification only',()=>{
 const base={title:'PAÑPURI POP-UP with PHUTATCHAI',venue:'centralwOrld',source_url};
 assert.equal(referenceScopeDecision({...base,event_date:'2026-11-21'},context).eligible,false);
 const scoped=scopeReferenceCandidates([base],context);
 assert.equal(scoped[0].eligible_for_discovery,true);
 assert.equal(scoped[0].reference_scope_reason,'SOURCE_DATE_PENDING_PRIMARY_VERIFIER');
 const recovered=recoverEligibleReferenceCandidates([],scoped,context);
 assert.equal(recovered.recovered_count,1);
 assert.equal(recovered.candidates[0].event_date,null);
 assert.equal(recovered.candidates[0].date_pending_verification,true);
 assert.equal(recovered.candidates[0].authoritative,false);
});
test('source is still needed for publication evidence and not manufactured by recovery',()=>{
 const row={title:'PAÑPURI POP-UP with PHUTATCHAI',event_date:'2026-10-21',venue:'centralwOrld',source_url};
 const recovered=recoverEligibleReferenceCandidates([],scopeReferenceCandidates([row],context));
 assert.equal(recovered.candidates[0].source_url,source_url);
 assert.equal(recovered.candidates[0].verifier_required,true);
});

test('missing venue is not inferred from scanner context',()=>{
 const row={title:'PAÑPURI POP-UP with PHUTATCHAI',event_date:'2026-10-21',source_url};
 assert.equal(referenceScopeDecision(row,context).eligible,false);
});

test('title-based artist appearance is recognized without a structured artist property',()=>{
 const row={title:'Beauty Brand POP-UP with SOMENAME',event_date:'2026-10-21',venue:'centralwOrld',source_url};
 assert.equal(referenceScopeDecision(row,context).eligible,true);
});
test('independent brand popup discovery lane is configured read-only',()=>{
 const {buildReferencePlan}=require('../server/kk-ultra-deep-runtime-runner');
 const plan=buildReferencePlan({month:'2026-10',location:'Bangkok Thailand'});
 assert.equal(plan.version,'KK_ULTRA_DEEP_REFERENCE_SWEEP_V4');
 assert.equal(plan.gap_tasks.length,6);
 assert.ok(plan.gap_tasks.some(t=>t.source_tier==='BRAND_SPONSOR'&&/pop-up/i.test(t.query)));
 assert.equal(plan.production_writes,0);
});

test('learned brand popup class adds artist/brand search terms without changing protected policy',()=>{
 const {learn}=require('../server/kk-ultra-deep-v2-learning-agent');
 const result=learn({missed_events:[{miss_class:'BRAND_POPUP_ARTIST_APPEARANCE_GAP',artist:'PHUTATCHAI',brand:'PANPURI',month:'2026-10'}]});
 assert.ok(result.adaptive.miss_classes.includes('BRAND_POPUP_ARTIST_APPEARANCE_GAP'));
 assert.ok(result.adaptive.query_terms.some(q=>/PANPURI PHUTATCHAI pop-up appearance/i.test(q)));
 assert.ok(result.adaptive.mandatory_expansion.includes('BRAND_POPUP_ARTIST_APPEARANCE'));
 assert.equal(result.authority.production_writes,0);
 assert.equal(result.authority.may_change_protected_policy,false);
});

test('independent reference recovery enters Verifier but an invited-guest pop-up cannot auto-publish',async()=>{
 const Verifier=require('../server/kk-ultra-deep-candidate-verifier');
 const row={title:'PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP',
  artist:'PHUTATCHAI | THAI',event_date:'2026-10-21',
  venue:'Beacon 3 centralwOrld Bangkok',source_url};
 const scoped=scopeReferenceCandidates([row],context);
 const recovered=recoverEligibleReferenceCandidates([],scoped);
 assert.equal(recovered.recovered_count,1);
 const html='<html><script type="application/ld+json">'+JSON.stringify({
   '@type':'Event',name:row.title,startDate:'2026-10-21T16:00:00+07:00',
   location:{'@type':'Place',name:'centralwOrld Beacon 3'},
   image:'https://example.org/images/official-event-poster.jpg'
  })+'</script>PHUTATCHAI | THAI invited guests only; fans outside designated area</html>';
 const result=await Verifier.verifyBatch(recovered.candidates,context,{
   fetchFn:async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>html})
 });
 assert.equal(result.input_count,1);
 assert.equal(result.verified_count,0);
 assert.equal(result.hold_count,1);
 assert.equal(result.holds[0].artist_popup_lead,true);
 assert.equal(result.holds[0].status,'HOLD_OWNER_ARTIST_POPUP_REVIEW');
 assert.ok(result.holds[0].blockers.includes('ARTIST_POPUP_OWNER_ACCESS_PHOTO_POLICY_REVIEW_REQUIRED'));
 assert.equal(result.production_writes,0);
});
