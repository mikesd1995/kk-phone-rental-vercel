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


test('competitor median never mixes phone-only quotes with lens bundles',()=>{
 const phoneQuotes=[
  {...price('phone-shop-a',690),package_type:'PHONE_ONLY'},
  {...price('phone-shop-b',790),package_type:'PHONE_ONLY'}
 ];
 const bundles=[
  price('bundle-shop-a',1190),
  price('bundle-shop-b',1290)
 ];
 const r=Prep.prepareCandidate(candidate,{competitor_prices:[...phoneQuotes,...bundles],posters:[poster]});
 const p=r.pricing;
 assert.equal(p.independent_competitors,2);
 assert.equal(p.observed_independent_competitors,4);
 assert.equal(p.complete,false);
 assert.equal(p.market_package_type,'PHONE_ONLY');
 assert.equal(p.market_median,740);
 assert.equal(p.package_summary.PHONE_ONLY.market_median,740);
 assert.equal(p.package_summary.PHONE_LENS.market_median,1240);
 assert.equal(p.proposal.proposal_source,'LIMITED_EXACT_EVENT');
 assert.equal(p.proposal.proposed_reference_price,740);
 assert.equal(p.evidence.length,2);
 assert.ok(p.evidence.every(row=>row.package_type==='PHONE_ONLY'));
 assert.equal(p.all_package_evidence.length,4);
});

test('one seller quoting phone and bundle cannot inflate independent market count',()=>{
 const quotes=[
  {...price('seller-a',790),package_type:'PHONE_ONLY'},
  price('seller-a',990),
  price('seller-b',1090),
  price('seller-c',1190)
 ];
 const r=Prep.prepareCandidate(candidate,{competitor_prices:quotes,posters:[poster]});
 const p=r.pricing;
 assert.equal(p.observed_independent_competitors,3);
 assert.equal(p.independent_competitors,3);
 assert.equal(p.market_package_type,'PHONE_LENS');
 assert.equal(p.market_median,1090);
 assert.equal(p.package_summary.PHONE_ONLY.independent_competitors,1);
 assert.equal(p.package_summary.PHONE_LENS.independent_competitors,3);
 assert.equal(p.complete,true);
 assert.equal(p.proposal.proposal_source,'EXACT_EVENT_MEDIAN');
 assert.ok(p.evidence.every(row=>row.package_type==='PHONE_LENS'));
});


test('package aliases combine by economic product, not raw label',()=>{
 const rows=[
  {...price('shop-a',990),package_type:'PHONE_LENS'},
  {...price('shop-a',1090),package_type:'PHONE_LENS_BUNDLE'},
  {...price('shop-b',1190),package_type:'BUNDLE'},
  {...price('shop-c',1290),package_type:'PHONE_PLUS_LENS'}
 ];
 const p=Prep.prepareCandidate(candidate,{competitor_prices:rows,posters:[poster]}).pricing;
 assert.equal(p.independent_competitors,3);
 assert.equal(p.market_package_type,'PHONE_LENS');
 assert.equal(p.market_median,1190);
 assert.equal(p.complete,true);
 assert.equal(p.evidence.length,3);
 assert.equal(p.all_package_evidence.length,3);
});

test('tickets and unrecognized rentals cannot be included as exact phone peers',()=>{
 const rows=[
  {...price('shop-a',790),package_type:'PHONE'},
  {...price('ticket-agent',4500),package_type:'TICKET'},
  {...price('shop-b',990),package_type:'PHONE_LENS_PACKAGE'}
 ];
 const p=Prep.prepareCandidate(candidate,{competitor_prices:rows,posters:[poster]}).pricing;
 assert.equal(p.observed_independent_competitors,2);
 assert.equal(p.independent_competitors,1);
 assert.equal(p.market_package_type,'PHONE_ONLY');
 assert.equal(p.market_median,790);
 assert.equal(p.complete,false);
});


test('mixed X300 Pro or Ultra and unrelated-device quotes never certify X300 Pro price',()=>{
 const rows=[
  {...price('seller-mixed',600),package_type:'PHONE_LENS',device:'vivo X300 Pro / X300 Ultra +200mm'},
  {...price('samsung',490),package_type:'PHONE_ONLY',device:'Samsung S26 Ultra'},
  {...price('vivo-shop',990),package_type:'PHONE_LENS',device:'VIVO X300 Pro + ZEISS 200mm'},
  {...price('vivo-shop-2',790),package_type:'PHONE_ONLY',device:'VIVO_X300_PRO'}
 ];
 const p=Prep.prepareCandidate(candidate,{competitor_prices:rows,posters:[poster]}).pricing;
 assert.equal(p.observed_independent_competitors,2);
 assert.equal(p.independent_competitors,1);
 assert.equal(p.complete,false);
 assert.equal(p.market_package_type,'PHONE_ONLY');
 assert.equal(p.market_median,790);
 assert.equal(p.all_package_evidence.length,2);
 assert.equal(Prep.normalizeCompetitor(rows[0]).device_model_compatible,false);
});
