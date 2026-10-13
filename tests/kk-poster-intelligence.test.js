'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-poster-intelligence.js');
const base=(id,name,date,url,action='show')=>({
 event_id:id,event_name:name,event_date_text:date,
 poster_image_url:url,action_for_web:action,venue:'Bangkok'
});
const id=(d,part)=>'EVT-'+d+'-'+part;
const asset='https://organizer.example.com/2026-event.jpg';
const good=base(id('20261014','EXAMPLE'),'Example Live','14/10/2026',asset);
const details=row=>P.audit({rows:[row],generated_at:'2026-10-14T00:00:00Z'}).events[0];
const has=(v,code)=>v.issues.some(x=>x.code===code);

test('visible feed only; never requires or touches booking data',()=>{
 const rows=[good,base(id('20261015','HIDDEN'),'Hidden','15/10/2026','', 'hide')];
 rows[0].customer_phone='sensitive should never appear';
 const output=P.audit({rows,generated_at:'2026-10-14T00:00:00Z'});
 assert.equal(output.visible_events,1);
 assert.equal(JSON.stringify(output).includes('sensitive should never appear'),false);
 assert.equal(output.safety.booking_writes,0);
 assert.equal(output.safety.poster_writes,0);
 assert.equal(output.safety.production_writes,0);
 assert.equal(output.safety.auto_publish,false);
 assert.equal(output.safety.ai_can_approve,false);
});
test('three exact historical wrong-event poster sources fail closed',()=>{
 for(const [event,url] of Object.entries(P.WRONG)){
  assert.equal(has(details(base(event,'Mismatch','14/10/2026',url)),'KNOWN_WRONG_EVENT_IMAGE'),true);
  assert.equal(has(details(base(id('20261014','OTHER'),'Unrelated','14/10/2026',url)),'KNOWN_WRONG_EVENT_IMAGE'),false);
 }
});
test('six known temporary sources or missing image get actionable P0',()=>{
 assert.equal(details(base(id('20261014','MISS'),'Missing','14/10/2026','')).priority,'P0');
 const hero='https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png';
 assert.equal(has(details(base(id('20261030','AF-HALLOWEEN-AFTERLIFE'),'AF','30/10/2026',hero)),'NON_EVENT_BRAND_PLACEHOLDER'),true);
});
test('two distinct events reusing the same Drive file, including alternate URL forms, are flagged',()=>{
 const dr='abcdefghijklmnopqr12345';
 const rows=[base(id('20261105','MIZUMI'),'MizuMi','05/11/2026','https://drive.google.com/thumbnail?id='+dr+'&sz=w1200'),
  base(id('20261102','SUPER-SUN'),'SUPER SUN','02/11/2026','https://lh3.googleusercontent.com/d/'+dr+'=w600')];
 const out=P.audit({rows});
 assert.equal(out.visible_events,2);
 assert.equal(out.events.every(e=>has(e,'CROSS_EVENT_IMAGE_REUSE')),true);
});
test('multi-day exact same named festival artwork is not marked as wrong by duplication alone',()=>{
 const rows=[base(id('20261101','FEST'),'Festival','01/11/2026',asset),
  base(id('20261030','FEST'),'Festival','30/10/2026',asset)];
 assert.equal(P.audit({rows}).events.some(e=>has(e,'CROSS_EVENT_IMAGE_REUSE')),false);
});
test('invalid dates, duplicate IDs, insecure and private URLs all raise holds',()=>{
 assert.equal(P.date('31/02/2026'),'');
 assert.equal(P.date('14/10/2569'),'2026-10-14');
 assert.equal(P.urlRisk('http://example.com/poster.png'),'INVALID_POSTER_URL');
 assert.equal(P.urlRisk('https://localhost/poster.png'),'UNSAFE_POSTER_HOST');
 assert.equal(P.urlRisk('https://192.168.1.1/image.png'),'UNSAFE_POSTER_HOST');
 assert.equal(P.urlRisk('https://user:password@example.com/image.png'),'INVALID_POSTER_URL');
 const rows=[good,{...good}];
 assert.equal(P.audit({rows}).events.every(e=>has(e,'DUPLICATE_EVENT_ID')),true);
});
test('broken image observation is a P0, no healthy delivery claim from a URL alone',()=>{
 let x=details(good);
 assert.equal(has(x,'IMAGE_DELIVERY_UNVERIFIED'),true);
 const out=P.audit({rows:[good],observations:[{event_id:good.event_id,poster_url:asset,loaded:false,natural_width:0,content_type:'text/html'}]});
 x=out.events[0];
 assert.equal(has(x,'IMAGE_DELIVERY_FAILED'),true);
 assert.equal(has(x,'NON_IMAGE_RESPONSE'),true);
 assert.equal(x.priority,'P0');
});
test('stale or different-source AI review cannot approve current poster',()=>{
 const observation={event_id:good.event_id,poster_url:asset,sha256:'a'.repeat(64),loaded:true,natural_width:1200,content_type:'image/jpeg'};
 const review={...observation,event_date:'14/10/2026',verdict:'MATCH',asset_sha256:'a'.repeat(64),confidence:0.98,
  title_match:true,date_match:true,evidence_url:'https://organizer.example.com/announcement'};
 const bad=P.audit({rows:[good],observations:[observation],vision_reviews:[{...review,poster_url:'https://other.example/a.jpg'}]}).events[0];
 assert.equal(bad.vision_status,'NOT_REVIEWED');
 const stale=P.audit({rows:[good],observations:[observation],vision_reviews:[{...review,event_date:'15/10/2026'}]}).events[0];
 assert.equal(stale.vision_status,'NOT_REVIEWED');
 const wrongBytes=P.audit({rows:[good],observations:[observation],vision_reviews:[{...review,asset_sha256:'b'.repeat(64)}]}).events[0];
 assert.equal(wrongBytes.vision_status,'INCOMPLETE');
 assert.equal(has(wrongBytes,'VISION_EVIDENCE_INCOMPLETE'),true);
});
test('matching AI review is advisory even with provenance and same-byte SHA256',()=>{
 const hash='a'.repeat(64);
 const out=P.audit({rows:[good],observations:[{event_id:good.event_id,poster_url:asset,sha256:hash,loaded:true,natural_width:1200,content_type:'image/jpeg'}],
 vision_reviews:[{event_id:good.event_id,poster_url:asset,event_date:'14/10/2026',verdict:'MATCH',asset_sha256:hash,
 title_match:true,date_match:true,evidence_url:'https://organizer.example.com/post',confidence:0.93}]});
 assert.equal(out.events[0].vision_status,'AI_MATCH_UNVERIFIED_BY_OWNER');
 assert.equal(out.events[0].owner_approved,false);
 assert.equal(out.events[0].disposition,'REVIEW_REQUIRED');
 assert.equal(out.safety.ai_can_approve,false);
 assert.equal(out.safety.production_writes,0);
});
test('AI negative verdict quarantines the exact event and never writes',()=>{
 const out=P.audit({rows:[good],vision_reviews:[{event_id:good.event_id,poster_url:asset,event_date:'14/10/2026',verdict:'MISMATCH'}]});
 assert.equal(has(out.events[0],'VISION_SUSPECTED_MISMATCH'),true);
 assert.equal(out.events[0].priority,'P0');
 assert.equal(out.safety.poster_writes,0);
});
test('review queue provides bounded explicit task, never recommends auto-publish',()=>{
 const out=P.audit({rows:[good]});
 assert.equal(out.ai_review_queue.length,1);
 assert.deepEqual(Object.keys(out.ai_review_queue[0]).sort(),
 ['event_id','event_name','event_date','poster_url','required_checks','instruction'].sort());
 assert.equal(out.ai_review_queue[0].instruction.includes('Never write Sheet'),true);
});
