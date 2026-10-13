'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');
const Resolve=require('../server/kk-ultra-deep-reference-source-resolution.js');
const Recon=require('../server/kk-ultra-deep-reconciliation.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

const ctx={month:'2026-10',location:'Bangkok Metropolitan Region Thailand'};
const title='ATLAS RISING UP FANMEET BANGKOK';
const row={title,event_date:null,venue:'BITEC LIVE Bangkok',
  source_url:'https://www.eventpop.me/e/25670/atlas-rising-up'};
const popup={title:'PAÑPURI POP-UP with PHUTATCHAI',artist:'PHUTATCHAI',
  venue:'centralwOrld Bangkok',source_url:'https://brand.example/events/panpuri-phutatchai',event_date:null};
const scoped=value=>Runner.scopeReferenceCandidates([value],ctx)[0];
const event=(name=title,when='2026-10-21T18:00:00+07:00',place='BITEC LIVE Bangkok')=>
  '<html><script type="application/ld+json">'+JSON.stringify({
    '@type':'MusicEvent',name,startDate:when,location:{'@type':'Place',name:place},
    image:'https://www.eventpop.me/images/atlas-poster.jpg'
  })+'</script>PHUTATCHAI</html>';
const fetchFn=body=>async()=>({ok:true,status:200,
  headers:{get:()=>null},text:async()=>body});

test('read-only source proof turns eligible null-date lead into exact October date',async()=>{
 const input=[scoped(row)];
 const x=await Resolve.resolve(input,ctx,{enabled:true,fetchFn:fetchFn(event())});
 assert.equal(x.pending_input_count,1);
 assert.equal(x.attempted_count,1);
 assert.equal(x.verified_count,1);
 assert.equal(x.unresolved_count,0);
 assert.equal(x.rows[0].event_date,'2026-10-21');
 assert.equal(x.rows[0].reference_scope_reason,'SOURCE_DATE_VERIFIED_FROM_PRIMARY_SOURCE');
 assert.equal(x.rows[0].source_date_verified,true);
 assert.equal(x.rows[0].authoritative,false);
 assert.equal(x.business_writer_enabled,false);
 assert.equal(x.production_writes,0);
 const recovered=Runner.recoverEligibleReferenceCandidates([],x.rows,ctx);
 assert.equal(recovered.recovered_count,1);
 assert.equal(recovered.candidates[0].event_date,'2026-10-21');
 assert.equal(Recon.reconcileCandidateSets(recovered.candidates,x.rows).complete,true);
});
test('disabled offline proof never performs a network call or invents date',async()=>{
 const out=await Resolve.resolve([scoped(row)],ctx,
  {enabled:false,fetchFn:async()=>{throw Error('unexpected network')}});
 assert.equal(out.attempted_count,0);
 assert.equal(out.verified_count,0);
 assert.equal(out.unresolved_count,1);
 assert.equal(out.rows[0].event_date,null);
 assert.equal(out.holds[0].status,'VERIFIER_NOT_CONFIGURED');
});
test('event in wrong month remains source-date unresolved and blocks FULL',async()=>{
 const x=await Resolve.resolve([scoped(row)],ctx,
  {enabled:true,fetchFn:fetchFn(event(title,'2026-11-21T18:00:00+07:00'))});
 assert.equal(x.verified_count,0);
 assert.equal(x.unresolved_count,1);
 const recon=Recon.reconcileCandidateSets([],x.rows);
 assert.equal(recon.complete,false);
 assert.equal(recon.pending_source_date_count,1);
});
test('event source located in Seoul never resolves Bangkok venue proof',async()=>{
 const x=await Resolve.resolve([scoped(row)],ctx,
  {enabled:true,fetchFn:fetchFn(event(title,'2026-10-21T18:00:00+07:00','Seoul Olympic Park'))});
 assert.equal(x.verified_count,0);
 assert.equal(x.holds[0].status,'HOLD_PRIMARY_SOURCE');
 assert.ok(x.holds[0].blockers.includes('SOURCE_BANGKOK_VENUE_PROOF_REQUIRED'));
});
test('unrelated October JSON-LD on ticket page cannot resolve a missing date',async()=>{
 const x=await Resolve.resolve([scoped(row)],ctx,
  {enabled:true,fetchFn:fetchFn(event('OTHER ARTIST FANMEET BANGKOK'))});
 assert.equal(x.verified_count,0);
 assert.ok(x.holds[0].blockers.includes('SOURCE_EVENT_TITLE_CONFLICT'));
});
test('source fetch failure is HOLD and does not promote a candidate',async()=>{
 const x=await Resolve.resolve([scoped(row)],ctx,{
  enabled:true,fetchFn:async()=>{throw Error('network deliberately unavailable')}
 });
 assert.equal(x.attempted_count,1);
 assert.equal(x.verified_count,0);
 assert.equal(x.production_writes,0);
 assert.ok(x.holds[0].blockers.includes('SOURCE_FETCH_FAILED'));
});
test('owner-only invited pop-up can have real date and still remain HOLD',async()=>{
 const x=await Resolve.resolve([scoped(popup)],ctx,
  {enabled:true,fetchFn:fetchFn(event(popup.title,'2026-10-21T16:00:00+07:00','centralwOrld Beacon 3'))});
 assert.equal(x.verified_count,0);
 assert.ok(x.holds[0].blockers.includes('ARTIST_POPUP_OWNER_ACCESS_PHOTO_POLICY_REVIEW_REQUIRED'));
});
test('deadline reached before source fetch never manufactures proof',async()=>{
 let requests=0;
 const x=await Resolve.resolve([scoped(row)],ctx,{
  enabled:true,deadline_ms:Date.now()-1000,fetchFn:async()=>{requests++;return {ok:true}}
 });
 assert.equal(requests,0);
 assert.equal(x.attempted_count,0);
 assert.equal(x.holds[0].status,'BUDGET_EXHAUSTED');
 assert.equal(x.unresolved_count,1);
});
test('primary source resolution is bounded at four and leaves extra leads in HOLD',async()=>{
 const refs=Array.from({length:5},(_,i)=>scoped({...row,
  source_url:'https://www.eventpop.me/e/25'+i+'/atlas-rising-up'}));
 let requests=0;
 const x=await Resolve.resolve(refs,ctx,{enabled:true,fetchFn:async()=>{
  requests++;return {ok:true,status:200,headers:{get:()=>null},text:async()=>event()};
 }});
 assert.equal(requests,4);
 assert.equal(x.attempted_count,4);
 assert.equal(x.verified_count,4);
 assert.equal(x.unresolved_count,1);
 assert.equal(x.rows[4].event_date,null);
 assert.ok(x.holds.some(h=>h.status==='LOOKUP_LIMIT_REACHED'));
});
test('local, literal IP and internal HTTPS origins never enter the fetchable scope',()=>{
 for(const origin of ['https://localhost/events/atlas',
  'https://127.0.0.1/events/atlas','https://169.254.169.254/events/atlas',
  'https://[::1]/events/atlas','https://internal.local/events/atlas',
  'https://metadata.internal/events/atlas']){
  const lead=Runner.referenceScopeDecision({...row,source_url:origin},ctx);
  assert.equal(lead.eligible,false,origin);
 }
});
test('runtime integrates primary-source date receipt back into FULL reconciliation (injected data, no live providers)',async()=>{
 const byCase=new Map(KnownMiss.CORPUS.map(c=>['knownmiss:'+c.case_id,c]));
 const provider=async task=>{
  if(byCase.has(task.source_id)){
   const c=byCase.get(task.source_id);
   return [{title:c.title,event_date:c.event_date,
     source_url:'https://proof.example/'+task.source_id}];
  }
  if(task.source_id==='reference-6')return [row];
  return [{title:'Shared Reference Concert Bangkok',
   event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 let fetchCount=0;
 const out=await Runner.runMonthlyUltraDeep(ctx,{
  use_only_injected_providers:true,
  providers:{SEARXNG:provider},
  reference_source_verification:true,
  referenceFetchFn:async()=>{fetchCount++;return {ok:true,status:200,
   headers:{get:()=>null},text:async()=>event()}}
 });
 assert.equal(fetchCount,1);
 assert.equal(out.reference_source_date_verified_count,1);
 assert.equal(out.reference_pending_source_date_count,0);
 assert.equal(out.reference_source_resolution.verified_count,1);
 assert.equal(out.reconciliation.complete,true);
 assert.equal(out.full,true);
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.verifier_required,true);
 assert.equal(out.authoritative,false);
 assert.equal(out.production_writes,0);
});
test('injected provider-only runtime defaults to zero unexpected source fetches',async()=>{
 const provider=async task=>task.source_id==='reference-6'?[row]:[];
 const out=await Runner.runMonthlyUltraDeep(ctx,{
  use_only_injected_providers:true,providers:{SEARXNG:provider}
 });
 assert.equal(out.reference_source_resolution.enabled,false);
 assert.equal(out.reference_source_date_verified_count,0);
 assert.equal(out.reference_pending_source_date_count,1);
 assert.equal(out.full,false);
 assert.equal(out.production_writes,0);
});
