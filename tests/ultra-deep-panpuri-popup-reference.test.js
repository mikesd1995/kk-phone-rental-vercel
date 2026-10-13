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
