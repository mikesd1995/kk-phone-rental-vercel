'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Prep=require('../server/kk-discovery-commercial-prep.js');

const candidate={candidate_id:'C1',event_key:'EVT-X',title:'Example Fan Event',event_date:'2026-10-01',venue:'Example Mall',artist:['A']};
const price=(id,value)=>({competitor_id:id,event_key:'EVT-X',package_type:'PHONE_LENS',price:value,source_url:'https://example.com/'+id,observed_at:'2026-09-28T00:00:00Z',exact_event:true});
const poster={event_key:'EVT-X',source_tier:'BRAND_SPONSOR',source_url:'https://brand.example/event',image_url:'https://brand.example/poster.jpg',official:true,verified:true};

test('3+ exact competitors produce HIGH exact-event proposal',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[price('a',890),price('b',1090),price('c',990)],posters:[poster]});
 const p=r.candidates[0].pricing;
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(p.market_median,990);
 assert.equal(p.proposal.proposal_source,'EXACT_EVENT_MEDIAN');
 assert.equal(p.proposal.confidence,'HIGH');
 assert.equal(p.proposal.proposed_reference_price,990);
});

test('1-2 exact competitors no longer hold and produce MEDIUM proposal',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[price('a',890),price('b',990)],posters:[poster]});
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(r.candidates[0].pricing.complete,false);
 assert.equal(r.candidates[0].pricing.proposal.proposed_reference_price,940);
 assert.equal(r.candidates[0].pricing.proposal.confidence,'MEDIUM');
});

test('zero exact competitors falls back to comparable event evidence',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[],comparable_prices:[{reference_id:'E1',price:790,source_url:'https://example.com/e1'},{reference_id:'E2',price:890,source_url:'https://example.com/e2'}],posters:[poster]});
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(r.candidates[0].pricing.independent_competitors,0);
 assert.equal(r.candidates[0].pricing.proposal.proposal_source,'COMPARABLE_EVENT_MEDIAN');
 assert.equal(r.candidates[0].pricing.proposal.proposed_reference_price,840);
});

test('zero market evidence falls back to approved KK baseline',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],store_baseline_prices:[{package_id:'BASE',price:890,approved:true}],posters:[poster]});
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(r.candidates[0].pricing.proposal.proposal_source,'KK_APPROVED_BASELINE');
 assert.equal(r.candidates[0].pricing.proposal.confidence,'LOW');
 assert.equal(r.candidates[0].pricing.proposal.proposed_reference_price,890);
});

test('high rental-fit candidate may advance with no competitor or price reference',()=>{
 const scored={...candidate,rental_fit_score:8.6};
 const r=Prep.prepareBatch({candidates:[scored],posters:[poster]});
 const c=r.candidates[0];
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(c.publish_eligibility.status,'ELIGIBLE');
 assert.equal(c.publish_eligibility.eligible,true);
 assert.equal(c.pricing.proposal.proposal_available,false);
 assert.equal(c.pricing.reference_missing,true);
 assert.equal(c.pricing.reference_required_for_publish,false);
 assert.doesNotMatch(c.blockers.join(','),/PRICING_REFERENCE_UNAVAILABLE/);
});

test('low rental-fit candidate is rejected rather than published just because pricing is absent',()=>{
 const scored={...candidate,rental_fit_score:6.4};
 const r=Prep.prepareBatch({candidates:[scored],posters:[poster]});
 const c=r.candidates[0];
 assert.equal(r.status,'HOLD_FOR_COMMERCIAL_EVIDENCE');
 assert.equal(c.publish_eligibility.status,'REJECTED_LOW_RENTAL_FIT');
 assert.ok(c.blockers.includes('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD'));
});

test('unscored candidate with no market or approved baseline still fails closed',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],posters:[poster]});
 assert.equal(r.status,'HOLD_FOR_COMMERCIAL_EVIDENCE');
 assert.equal(r.candidates[0].publish_eligibility.status,'UNSCORED');
 assert.ok(r.candidates[0].blockers.includes('PRICING_REFERENCE_UNAVAILABLE'));
});

test('proposal never becomes final price automatically',()=>{
 const r=Prep.prepareCandidate(candidate,{competitor_prices:[price('a',890)],posters:[poster]});
 assert.equal(r.pricing.proposal.auto_final_price,false);
 assert.equal(r.final_price_write_allowed,false);
 assert.equal(r.production_writes,0);
});


test('Phase 3 pricing scope does not require poster evidence from Phase 4',()=>{
 const scored={...candidate,rental_fit_score:8.2};
 const r=Prep.prepareBatch({phase_scope:'PHASE3_PRICING',candidates:[scored],competitor_prices:[price('a',890)]});
 const row=r.candidates[0];
 assert.equal(r.status,'READY_FOR_PHASE3_PRICING');
 assert.equal(row.status,'READY_FOR_PHASE3_PRICING');
 assert.equal(row.phase_scope,'PHASE3_PRICING');
 assert.equal(row.poster.complete,false);
 assert.equal(row.blockers.includes('VERIFIED_POSTER_EVIDENCE_MISSING'),false);
 assert.equal(row.production_writes,0);
});

test('full commercial scope still requires verified poster evidence',()=>{
 const scored={...candidate,rental_fit_score:8.2};
 const r=Prep.prepareBatch({candidates:[scored],competitor_prices:[price('a',890)]});
 assert.equal(r.status,'HOLD_FOR_COMMERCIAL_EVIDENCE');
 assert.ok(r.candidates[0].blockers.includes('VERIFIED_POSTER_EVIDENCE_MISSING'));
});
