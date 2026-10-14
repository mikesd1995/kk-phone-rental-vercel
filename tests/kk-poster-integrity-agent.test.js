'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-poster-integrity-agent.js');
const Registry=require('../server/kk-agent-registry.js');
const Audit=require('../scripts/audit-storefront-posters.js');

function row(id='E1',name='Event A',url='https://assets.example.com/event-a.jpg',date='14/10/2026',action='show'){
  return {event_id:id,event_name:name,event_date_text:date,poster_image_url:url,action_for_web:action,
    price_phone:'690',available_phone_count:'2',booking_id:'BOOKING_REFERENCE_MUST_NOT_CHANGE'};
}
function find(rows,extra={}){return P.triage({rows,...extra});}

test('missing image keeps event visible and never requests writes',()=>{
  const original=row('E1','Unposted','','14/10/2026');
  const frozen=JSON.stringify(original);
  const out=find([original]);
  assert.equal(out.blocked,1); assert.equal(out.findings[0].reasons[0],'POSTER_SOURCE_MISSING');
  assert.equal(out.findings[0].verdict,'BLOCKED_NEEDS_POSTER');
  assert.equal(out.production_writes,0);assert.equal(out.booking_writes,0);
  assert.equal(out.pricing_writes,0);assert.equal(out.inventory_writes,0);
  assert.equal(out.paid_ai_calls,0);assert.equal(out.auto_publish,false);
  assert.equal(JSON.stringify(original),frozen);
});

test('all 6 verified past wrong-event or wrong-date URL pairs fail closed',()=>{
 for(const [id,url] of Object.entries(P.KNOWN_WRONG)){
   const out=find([row(id,'Exact Event',url)]);
   assert.ok(out.findings[0].reasons.includes('KNOWN_WRONG_EVENT_ART'));
   assert.equal(out.findings[0].official_poster_verified,false);
   const corrected=find([row(id,'Exact Event','https://organizer.example.net/new.jpg')]);
   assert.equal(corrected.blocked,0,'a new verified poster is not suppressed by stale exact URL');
   const other=find([row('NOT-'+id,'Different Event',url)]);
   assert.ok(!other.findings[0].reasons.includes('KNOWN_WRONG_EVENT_ART'));
 }
});
test('date-specific poster exclusions cannot block the valid other day or new official image',()=>{
 const cases=[
  {bad:'EVT-20261023-LYKN-REFLEXION-CONCERT-2',good:'EVT-20261024-LYKN-REFLEXION-CONCERT',date:'23/10/2026'},
  {bad:'EVT-20261115-2026-K-POP-MASTERZ-SPECIAL-L',good:'EVT-20261114-2026-K-POP-MASTERZ-SPECIAL-L',date:'15/11/2026'},
  {bad:'EVT-20261127-FORTREASURE-BEYOND-HORIZON',good:'EVT-20261129-FORTREASURE-BEYOND-HORIZON',date:'27/11/2026'}
 ];
 assert.equal(Object.keys(P.KNOWN_WRONG).length,6);
 for(const c of cases){
  const url=P.KNOWN_WRONG[c.bad];assert.ok(url);
  const bad=row(c.bad,'Original concert',url,c.date);
  const frozen=JSON.stringify(bad);
  const flagged=find([bad]).findings[0];
  assert.equal(flagged.verdict,'BLOCKED_NEEDS_POSTER');
  assert.ok(flagged.reasons.includes('KNOWN_WRONG_EVENT_ART'));
  assert.equal(JSON.stringify(bad),frozen,'do not mutate business records');
  const correctShow=row(c.good,'Original concert',url,'29/11/2026','show_full');
  const okay=find([correctShow]);
  assert.equal(okay.blocked,0,'the other show day must not be blocked by ID-specific evidence');
  assert.ok(!okay.findings[0].reasons.includes('KNOWN_WRONG_EVENT_ART'));
  const newPoster=find([row(c.bad,'Original concert','https://organizer.example.org/updated-exact-date-poster.jpg',c.date)]);
  assert.equal(newPoster.blocked,0,'new verified media URL can be installed after human review');
  assert.equal(newPoster.production_writes,0);
  assert.equal(newPoster.booking_writes,0);
  assert.equal(newPoster.pricing_writes,0);
  assert.equal(newPoster.visibility_writes,0);
 }
});
test('shop hero flags generic source regardless of event name',()=>{
 const url='https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png?v=1';
 assert.ok(find([row('E', 'MizuMi',url)]).findings[0].reasons.includes('GENERIC_BRAND_HERO_NOT_OFFICIAL_POSTER'));
});
test('multiple visible dates with the same event name are not automatically called wrong',()=>{
 const src='https://site.test/campaign.jpg';
 const out=find([row('e1','NuNew Solo',src,'14/10/2026'),row('e2','NuNew Solo',src,'15/10/2026')]);
 assert.equal(out.review,0);assert.equal(out.blocked,0);
});
test('reused image across different names is review, never a fabricated definite mismatch',()=>{
 const src='https://site.test/shared.jpg';
 const out=find([row('one','Moonshadow Fan Party',src),row('two','Moonshadow After Party',src)]);
 assert.equal(out.review,2); assert.equal(out.blocked,0);
 assert.ok(out.findings.every(v=>v.reasons.includes('SHARED_ART_DIFFERENT_EVENT_REVIEW')));
});
test('canonical Drive file ID is comparable across delivery thumbnail styles',()=>{
 const id='1AbcDeFGhIJKLMNopQRS_12345678';
 assert.equal(P.urlKey('https://drive.google.com/thumbnail?id='+id+'&sz=w600'),P.urlKey('https://lh3.googleusercontent.com/d/'+id+'=w600'));
});
test('healthy image transport does not mean official poster identity verified',()=>{
 const one=row('EVT-EX','Specific Event','https://org.test/image.jpg');
 const out=find([one],{delivery_by_event:{'EVT-EX':{candidates:[{url:one.poster_image_url,ok:true}]}}});
 assert.equal(out.findings[0].delivery_status,'IMAGE_DELIVERED');
 assert.equal(out.findings[0].verdict,'DELIVERY_ONLY_IDENTITY_UNVERIFIED');
 assert.equal(out.findings[0].official_poster_verified,false);
});
test('broken image delivery is repair even if source URL exists',()=>{
 const one=row();const out=find([one],{delivery_by_event:{E1:{candidates:[{ok:false,status:200,content_type:'text/html'}]}}});
 assert.equal(out.blocked,1);assert.ok(out.findings[0].reasons.includes('NO_HEALTHY_IMAGE_DELIVERY'));
});
test('visual observation mismatch is advisory and stale image-source observation ignored',()=>{
 const src='https://s.test/a.jpg';const one=row('E1','New Show',src,'14/10/2026');
 const out=find([one],{visual_observations:[{event_id:'E1',poster_url:src,observed_event_date:'15/10/2026',observed_event_name:'Old Show'}]});
 assert.equal(out.review,1); assert.equal(out.blocked,0);
 assert.ok(out.findings[0].reasons.includes('VISUAL_DATE_CONFLICT_REVIEW'));
 assert.ok(out.findings[0].reasons.includes('VISUAL_NAME_CONFLICT_REVIEW'));
 const stale=find([one],{visual_observations:[{event_id:'E1',poster_url:'https://s.test/old.jpg',observed_event_date:'15/10/2026'}]});
 assert.equal(stale.review,0);
});
test('no OCR extracted facts never upgrades a picture to verified official art',()=>{
 const out=find([row()],{visual_observations:[{event_id:'E1',poster_url:'https://assets.example.com/event-a.jpg',observed_event_date:'',observed_event_name:''}]});
 assert.equal(out.findings[0].official_poster_verified,false);
 assert.equal(out.status,'IDENTITY_UNVERIFIED');
});
test('invalid calendar date fails closed; hidden records not republished',()=>{
 const out=find([row('bad','Bad','https://s.test/b.jpg','31/02/2026'),row('hidden','Hidden','','14/10/2026','hide')]);
 assert.equal(out.visible_events,1);assert.ok(out.findings[0].reasons.includes('EVENT_IDENTITY_INCOMPLETE'));
 assert.equal(P.dateKey('29/02/2028'),'2028-02-29');
});
test('registry has a governed callable poster review agent that cannot write',()=>{
 const r=Registry.routeForIntent('poster_integrity_review');
 assert.equal(r.runtime_available,true);
 assert.equal(r.owner_review_required,true);
 assert.deepEqual([...r.required_agents],['kk-poster-integrity-advisor']);
 assert.equal(Registry.AGENTS['kk-poster-integrity-advisor'].production_writes,0);
 assert.equal(Registry.validateInvocation('poster_integrity_review',['kk-poster-integrity-advisor']).pass,true);
});

test('production poster audit remains zero-write and combines HTTP image check with identity advisory offline',async()=>{
  const csv=[
   'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web',
   'E1,Healthy Event,14/10/2026,Bangkok,https://static.example.com/healthy.jpg,,2,2,,show',
   'E2,Missing Event,15/10/2026,Bangkok,,,2,2,,show'
  ].join('\n')+'\n';
  const urls=[];
  async function fakeFetch(url){
    urls.push(url);
    if(url.includes('/api/kk-data?'))return new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
    if(url==='https://static.example.com/healthy.jpg')
      return new Response(new Uint8Array([0xff,0xd8,0xff,0xd9]),{status:200,headers:{'content-type':'image/jpeg'}});
    throw new Error('UNEXPECTED_NETWORK '+url);
  }
  const before=process.exitCode;
  const out=await Audit.main(fakeFetch,{silent:true});
  assert.equal(out.schema,'kk-storefront-poster-health/v1');
  assert.equal(out.visible_events,2);
  assert.equal(out.pass_events,1);
  assert.equal(out.failed_events,1);
  assert.equal(out.poster_integrity.blocked,1);
  assert.equal(out.poster_integrity.findings[0].delivery_status,'IMAGE_DELIVERED');
  assert.equal(out.poster_integrity.findings[0].official_poster_verified,false);
  assert.equal(out.poster_integrity.findings[1].reasons[0],'POSTER_SOURCE_MISSING');
  assert.equal(out.poster_integrity.production_writes,0);
  assert.equal(out.business_data_mutations,0);
  assert.equal(urls.length,2,'one public CSV read and one read-only image GET only');
  assert.equal(process.exitCode,before,'silent acceptance does not change process exit code');
});

test('poster health probe rejects private, unsafe, and non-HTTPS targets before any GET',async()=>{
 const blocked=['http://example.com/p.jpg','https://127.0.0.1/img.jpg','https://localhost/secret.png',
 'https://10.0.0.5/art.jpg','https://192.168.1.1/a.jpg','https://169.254.169.254/latest/meta-data/',
 'https://[::1]/a.jpg','file:///etc/passwd','javascript:alert(1)'];
 let called=0;
 for(const url of blocked){
   assert.equal(Audit.publicImageUrl(url),false,url);
   const outcome=await Audit.probe(url,async()=>{called++;throw Error('MUST_NOT_FETCH');});
   assert.equal(outcome.error,'UNSAFE_IMAGE_URL');
 }
 assert.equal(called,0);
 assert.equal(Audit.publicImageUrl('https://drive.google.com/thumbnail?id=12345'),true);
});
test('poster probe refuses redirect to private endpoint without requesting redirect target',async()=>{
 let calls=[];
 const out=await Audit.probe('https://images.example.com/start',async(url)=>{
   calls.push(url);
   return new Response(null,{status:302,headers:{location:'https://127.0.0.1/admin'}});
 });
 assert.equal(out.error,'UNSAFE_IMAGE_REDIRECT');
 assert.deepEqual(calls,['https://images.example.com/start']);
});

test('image content-type cannot pass without real recognizable magic bytes',async()=>{
 assert.equal(Audit.hasImageSignature(new Uint8Array([255,216,255,217]),'image/jpeg'),true);
 assert.equal(Audit.hasImageSignature(new TextEncoder().encode('<html>login</html>'),'image/jpeg'),false);
 assert.equal(Audit.hasImageSignature(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);
 assert.equal(Audit.hasImageSignature(new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]),'image/webp'),true);
 let calls=0;
 const out=await Audit.probe('https://static.example.com/p.jpg',async()=>{
   calls++;
   return new Response(new TextEncoder().encode('<html>login</html>'),{status:200,headers:{'content-type':'image/jpeg'}});
 });
 assert.equal(calls,1);
 assert.equal(out.ok,false);
 assert.equal(out.error,'INVALID_OR_UNSUPPORTED_IMAGE_SIGNATURE');
});
test('public redirect to public image remains supported and bounded',async()=>{
 const calls=[];
 const out=await Audit.probe('https://media.example.com/old',async url=>{
  calls.push(url);
  if(url.endsWith('/old'))return new Response(null,{status:302,headers:{location:'https://cdn.example.com/new.jpg'}});
  return new Response(new Uint8Array([255,216,255,217]),{status:200,headers:{'content-type':'image/jpeg'}});
 });
 assert.equal(out.ok,true);
 assert.equal(out.final_url,'https://cdn.example.com/new.jpg');
 assert.deepEqual(calls,['https://media.example.com/old','https://cdn.example.com/new.jpg']);
});


test('Bangkok date scope includes show_full with blank poster but does not mutate Booking',()=>{
 const booked=row('EVT-20261023-LYKN-REFLEXION-CONCERT-2','LYKN REFLEXION CONCERT','','23/10/2026','show_full');
 const past=row('EVT-20261012-PAST','Past','', '12/10/2026','show');
 const hidden=row('EVT-20261024-HIDDEN','Hidden','','24/10/2026','hide');
 const original=JSON.stringify([booked,past,hidden]);
 const out=P.triage({rows:[booked,past,hidden],as_of:'2026-10-14'});
 assert.equal(out.visible_events,1);
 assert.equal(out.findings[0].event_id,booked.event_id);
 assert.equal(out.blocked,1);
 assert.equal(out.as_of,'2026-10-14');
 assert.equal(out.booking_writes,0);assert.equal(out.visibility_writes,0);
 assert.equal(JSON.stringify([booked,past,hidden]),original);
});
test('Buddhist calendar date is normalized for Thai poster reviews',()=>{
 assert.equal(P.dateKey('14/10/2569'),'2026-10-14');
 assert.equal(P.dateKey('31/02/2569'),'');
});
test('same proven byte hash across distinct URLs is review only',()=>{
 const a=row('EVT-20261015-ONE','First event','https://one.example.com/photo.jpg','15/10/2026');
 const b=row('EVT-20261016-TWO','Second event','https://other.example.com/copy.jpg','16/10/2026');
 const hash='a'.repeat(64);
 const input={rows:[a,b],delivery_by_event:{
 [a.event_id]:{poster_url:a.poster_image_url,loaded:true,natural_width:1000,sha256:hash},
 [b.event_id]:{poster_url:b.poster_image_url,loaded:true,natural_width:1000,sha256:hash}
 }};
 const out=P.triage(input);
 assert.equal(out.review,2);
 assert.ok(out.findings.every(f=>f.reasons.includes('SAME_IMAGE_BYTES_CROSS_EVENT_REVIEW')));
 assert.ok(out.findings.every(f=>f.official_poster_verified===false));
 assert.equal(out.production_writes,0);
});
test('vision MATCH requires exact event source date bytes independent delivery evidence',()=>{
 const id='EVT-20261014-POSTER';
 const a=row(id,'Correct example','https://organizer.example.com/poster.jpg','14/10/2026');
 const hash='1'.repeat(64);
 const observation={poster_url:a.poster_image_url,loaded:true,natural_width:1200,sha256:hash};
 const review={event_id:id,poster_url:a.poster_image_url,event_date:'14/10/2026',verdict:'MATCH',
  asset_sha256:hash,evidence_url:'https://organizer.example.com/notice',title_match:true,date_match:true,confidence:0.91};
 const correct=P.triage({rows:[a],delivery_by_event:{[id]:observation},vision_reviews:[review]});
 assert.equal(correct.findings[0].vision_status,'AI_MATCH_UNVERIFIED_BY_OWNER');
 assert.equal(correct.findings[0].official_poster_verified,false);
 assert.equal(correct.findings[0].owner_approved,false);
 assert.equal(correct.ai_can_approve,false);
 assert.equal(correct.production_writes,0);
 const forged=P.triage({rows:[a],delivery_by_event:{[id]:observation},vision_reviews:[{...review,asset_sha256:'2'.repeat(64)}]});
 assert.equal(forged.findings[0].vision_status,'INCOMPLETE');
 assert.ok(forged.findings[0].reasons.includes('AI_EVIDENCE_INCOMPLETE_REVIEW'));
 const stale=P.triage({rows:[a],delivery_by_event:{[id]:observation},vision_reviews:[{...review,poster_url:'https://old.example.com/old.jpg'}]});
 assert.equal(stale.findings[0].vision_status,'NOT_REVIEWED');
 const wrongDate=P.triage({rows:[a],delivery_by_event:{[id]:observation},vision_reviews:[{...review,event_date:'15/10/2026'}]});
 assert.equal(wrongDate.findings[0].vision_status,'NOT_REVIEWED');
});
test('AI negative feedback is owner-review warning, never autonomous poster change',()=>{
 const a=row('EVT-20261014-POSTER','Event','https://organizer.example.com/poster.jpg');
 const report=P.triage({rows:[a],vision_reviews:[{
  event_id:a.event_id,poster_url:a.poster_image_url,event_date:'14/10/2026',verdict:'MISMATCH'
 }]});
 assert.equal(report.findings[0].vision_status,'MISMATCH_REPORTED');
 assert.ok(report.findings[0].reasons.includes('AI_REPORTED_ART_MISMATCH_REVIEW'));
 assert.equal(report.findings[0].official_poster_verified,false);
 assert.equal(report.poster_writes,0);
});
test('temporary artwork note and evidence review queue do not certify source',()=>{
 const r=row('EVT-20261014-TEMP','Temporary','https://organizer.example.com/photo.jpg');
 r.event_note='TEMP_IMAGE รอโปสเตอร์ต้นฉบับ';
 const out=P.triage({rows:[r]});
 assert.equal(out.review,1);
 assert.ok(out.findings[0].reasons.includes('TEMPORARY_ARTWORK_REVIEW'));
 assert.equal(out.ai_review_queue.length,1);
 assert.equal(out.ai_review_queue[0].poster_url,r.poster_image_url);
 assert.equal(out.ai_can_approve,false);
 assert.equal(out.auto_publish,false);
});
test('owner/agent review cannot inject unknown Booking, price, or contact fields in evidence',()=>{
 const r=row('EVT-20261014-SENSITIVE','Secure','https://event.example.com/photo.png');
 r.booking_id='BKG-MUST-NOT-BE-EMITTED';
 r.customer_phone='PRIVATE123';
 const out=P.triage({rows:[r]});
 assert.equal(JSON.stringify(out).includes('BKG-MUST-NOT-BE-EMITTED'),false);
 assert.equal(JSON.stringify(out).includes('PRIVATE123'),false);
 assert.equal(out.booking_writes,0);
 assert.equal(out.pricing_writes,0);
 assert.equal(out.inventory_writes,0);
});


test('manual poster health scan limits to selected date, leaves full-booking events unchanged',async()=>{
 const csv=[
  'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web',
  'EVT-20261012-OLD,Old Show,12/10/2026,Bangkok,,,2,2,,show',
  'EVT-20261023-LYKN-REFLEXION-CONCERT-2,LYKN REFLEXION CONCERT,23/10/2026,IMPACT,,,0,0,เต็ม,show_full',
  'EVT-20261025-HIDDEN,Owner Hidden,25/10/2026,Bangkok,,,2,2,,hide'
 ].join('\n')+'\n';
 let calls=0;
 const out=await Audit.main(async()=>{
  calls++;
  return new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
 },{silent:true,as_of:'2026-10-14'});
 assert.equal(calls,1,'no image GET when only selected event poster is empty');
 assert.equal(out.visible_events,1);
 assert.equal(out.poster_integrity.visible_events,1);
 assert.equal(out.poster_integrity.blocked,1);
 assert.equal(out.poster_integrity.as_of,'2026-10-14');
 assert.equal(out.production_writes,0);
 assert.equal(out.business_data_mutations,0);
});
test('public poster audit fails closed for bad feed, empty rows, hidden-only and invalid date',async()=>{
 const feed=async csv=>new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
 await assert.rejects(()=>Audit.main(()=>feed('wrong,headers\n1,2\n'),{silent:true}),/POSTER_FEED_SCHEMA_INVALID/);
 await assert.rejects(()=>Audit.main(()=>feed(
  'event_id,event_name,poster_image_url,action_for_web\n'),{silent:true}),/POSTER_FEED_EMPTY/);
 await assert.rejects(()=>Audit.main(()=>feed(
  'event_id,event_name,event_date_text,poster_image_url,action_for_web\nE1,Hidden,14/10/2026,,hide\n'),{silent:true}),/POSTER_NO_VISIBLE_EVENTS/);
 await assert.rejects(()=>Audit.main(()=>feed(
  'event_id,event_name,event_date_text,poster_image_url,action_for_web\nE1,Shown,14/10/2026,,show\n'),
  {silent:true,as_of:'2026-02-30'}),/POSTER_AS_OF_DATE_INVALID/);
});


test('primary poster audit binds imported vision evidence to same decoded byte digest and exact URL',async()=>{
 const id='EVT-20261014-EXACT-POSTER',url='https://organizer.example.com/artist.jpg',sha='e'.repeat(64);
 const csv=[
 'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web',
 [id,'Exact Event','14/10/2026','Bangkok',url,'','2','2','','show'].join(',')
 ].join('\n')+'\n';
 const fetch=async requested=>{
  if(requested.includes('/api/kk-data'))return new Response(csv,{status:200,headers:{'content-type':'text/csv'}});
  if(requested===url)return new Response(new Uint8Array([255,216,255,217]),{status:200,headers:{'content-type':'image/jpeg'}});
  throw Error('unexpected URL '+requested);
 };
 const delivery={event_id:id,poster_url:url,loaded:true,natural_width:1200,sha256:sha};
 const review={event_id:id,event_date:'14/10/2026',poster_url:url,verdict:'MATCH',asset_sha256:sha,confidence:0.95,
   evidence_url:'https://organizer.example.com/announcement',title_match:true,date_match:true};
 const ok=await Audit.main(fetch,{silent:true,as_of:'2026-10-14',
  decoded_observations:[delivery],vision_reviews:[review]});
 assert.equal(ok.poster_integrity.findings[0].vision_status,'AI_MATCH_UNVERIFIED_BY_OWNER');
 assert.equal(ok.poster_integrity.findings[0].official_poster_verified,false);
 assert.equal(ok.poster_integrity.production_writes,0);
 const swapped=await Audit.main(fetch,{silent:true,as_of:'2026-10-14',
  decoded_observations:[{...delivery,poster_url:'https://organizer.example.com/old.jpg'}],
  vision_reviews:[review]});
 assert.equal(swapped.poster_integrity.findings[0].vision_status,'INCOMPLETE');
 assert.equal(swapped.poster_integrity.findings[0].official_poster_verified,false);
});
test('conflicting duplicate digest observations cannot certify the original poster',()=>{
 const r=row('EVT-20261014-UNIQUE','Event','https://organizer.example.com/image.jpg');
 const sha='a'.repeat(64);
 const evidence={poster_url:r.poster_image_url,sha256:sha,loaded:true,natural_width:1200};
 const review={event_id:r.event_id,event_date:'14/10/2026',poster_url:r.poster_image_url,asset_sha256:sha,
  verdict:'MATCH',confidence:0.99,evidence_url:'https://organizer.example.com/show',title_match:true,date_match:true};
 const report=P.triage({rows:[r],delivery_by_event:{[r.event_id]:evidence},vision_reviews:[review,{...review}]});
 assert.equal(report.findings[0].vision_status,'NOT_REVIEWED');
 assert.equal(report.findings[0].owner_approved,false);
 assert.equal(report.ai_can_approve,false);
});
