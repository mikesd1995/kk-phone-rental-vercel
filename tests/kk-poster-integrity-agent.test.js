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

test('all 3 verified past wrong-event URL pairs fail closed',()=>{
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
