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
test('outside month or missing date remains excluded',()=>{
 const base={title:'PAÑPURI POP-UP with PHUTATCHAI',venue:'centralwOrld',source_url};
 assert.equal(referenceScopeDecision({...base,event_date:'2026-11-21'},context).eligible,false);
 assert.equal(referenceScopeDecision(base,context).eligible,false);
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
