'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');
const Reconcile=require('../server/kk-ultra-deep-reconciliation.js');
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');
const CTX={month:'2026-10',location:'Bangkok Metropolitan Region Thailand'};
const POPUP={
 title:'PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP with PHUTATCHAI',
 artist:'PHUTATCHAI',event_date:null,venue:'centralwOrld Beacon 3, Bangkok',
 source_url:'https://brand.example/events/panpuri-liminal-currents-phutatchai'
};
const CONCERT={
 title:'ATLAS RISING UP FANMEET BANGKOK',
 event_date:null,venue:'BITEC LIVE, Bangkok',
 source_url:'https://www.eventpop.me/e/123456/atlas-rising-up-bangkok'
};
function scope(row,ctx=CTX){return Runner.scopeReferenceCandidates([row],ctx)[0];}
function htmlEvent(name,when,venue='BITEC LIVE',poster='https://poster.example/atlas.jpg',extras=''){
 return '<html><script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':'MusicEvent',name,startDate:when,
  location:{'@type':'Place',name:venue},
  image:poster
 })+'</script>'+extras+'</html>';
}
test('undated named-artist Bangkok pop-up now survives reference scope as unverified lead',()=>{
 const lead=scope(POPUP);
 assert.equal(lead.eligible_for_discovery,true);
 assert.equal(lead.reference_scope_reason,'SOURCE_DATE_PENDING_PRIMARY_VERIFIER');
 const r=Runner.recoverEligibleReferenceCandidates([], [lead],CTX);
 assert.equal(r.recovered_count,1);
 assert.equal(r.undated_recovered_count,1);
 assert.equal(r.candidates.length,1);
 const c=r.candidates[0];
 assert.equal(c.event_date,null);
 assert.equal(c.date_pending_verification,true);
 assert.equal(c.verifier_required,true);
 assert.equal(c.authoritative,false);
 assert.equal(c.candidate_origin,'INDEPENDENT_REFERENCE_RECOVERY');
 assert.equal(c.source_url,POPUP.source_url);
});
test('undated exact ticket detail with Bangkok venue is eligible; a scan month never becomes event date',()=>{
 const c=scope(CONCERT);
 assert.equal(c.eligible_for_discovery,true);
 const r=Runner.recoverEligibleReferenceCandidates([], [c],CTX);
 assert.equal(r.candidates[0].event_date,null);
 assert.equal(r.candidates[0].date_pending_verification,true);
});
test('known outside-month date, invalid calendar date and malformed date are all excluded',()=>{
 assert.equal(Runner.referenceScopeDecision({...POPUP,event_date:'2026-11-21'},CTX).reason,'OUTSIDE_TARGET_MONTH');
 assert.equal(Runner.referenceScopeDecision({...POPUP,event_date:'2026-10-40'},CTX).reason,'INVALID_STRUCTURED_DATE');
 assert.equal(Runner.referenceScopeDecision({...POPUP,event_date:'21 Oct 2026'},CTX).reason,'INVALID_STRUCTURED_DATE');
 assert.equal(Runner.referenceScopeDecision({...POPUP,event_date:'2026-02-29'},CTX).reason,'INVALID_STRUCTURED_DATE');
});
test('undated generic homepage, calendar category, root and insecure source cannot enter recovery',()=>{
 for(const source_url of ['https://brand.example/','https://brand.example/category/artist',
  'https://www.eventpop.me/g/fan-meeting','https://brand.example/search?q=panpuri',
  'http://brand.example/events/panpuri-popup','javascript:alert(1)']){
  const scoped=scope({...POPUP,source_url});
  assert.equal(scoped.eligible_for_discovery,false,source_url);
  assert.equal(Runner.recoverEligibleReferenceCandidates([], [scoped],CTX).recovered_count,0);
 }
});
test('generic retail pop-up and low-value webinar cannot bypass named artist/event gates',()=>{
 const retail={...POPUP,title:'PAÑPURI Holiday Retail Pop-Up',artist:null};
 assert.equal(scope(retail).eligible_for_discovery,false);
 const webinar={...POPUP,title:'Bangkok Webinar Workshop with PHUTATCHAI'};
 assert.equal(scope(webinar).eligible_for_discovery,false);
});
test('missing Bangkok venue or foreign city is never inferred from scanner query context',()=>{
 assert.equal(scope({...POPUP,venue:null}).eligible_for_discovery,false);
 assert.equal(scope({...POPUP,venue:'Seoul Olympic Park'}).eligible_for_discovery,false);
 assert.equal(scope({...POPUP,title:POPUP.title+' Hong Kong'}).eligible_for_discovery,false);
 assert.equal(scope({...POPUP,source_url:'https://events.example.hk/event/panpuri-popup'}).eligible_for_discovery,false);
});
test('undated row without target month or with bare fabricated eligible flag cannot recover',()=>{
 const noMonth=scope(POPUP,{location:'Bangkok Thailand'});
 assert.equal(noMonth.eligible_for_discovery,false);
 assert.equal(noMonth.reference_scope_reason,'UNDATED_TARGET_MONTH_REQUIRED');
 assert.equal(Runner.recoverEligibleReferenceCandidates([], [{...POPUP,eligible_for_discovery:true}],{}).recovered_count,0);
 assert.equal(Runner.recoverEligibleReferenceCandidates([], [{...POPUP,eligible_for_discovery:true,reference_scope_reason:'SOURCE_DATE_PENDING_PRIMARY_VERIFIER'}],{}).recovered_count,0);
});
test('two independent references pointing to the same undated event do not create duplicates',()=>{
 const a=scope(POPUP);
 const result=Runner.recoverEligibleReferenceCandidates([], [a,{...a}],CTX);
 assert.equal(result.recovered_count,1);
 assert.equal(result.candidates.length,1);
 assert.equal(result.undated_recovered_count,1);
});
test('same source URL with another event identity is not silently deduplicated',()=>{
 const first=scope(CONCERT);
 const second=scope({...CONCERT,title:'BIGBANG COSMOS Concert Bangkok'});
 const result=Runner.recoverEligibleReferenceCandidates([],[first,second],CTX);
 assert.equal(result.recovered_count,2);
});
test('structured event dates retain normal discovery dedupe and independent recovery',()=>{
 const discovered=[{title:'ATLAS RISING UP FANMEET BANGKOK',
  event_date:'2026-10-21',source_url:CONCERT.source_url}];
 const same=scope({...CONCERT,event_date:'2026-10-21'});
 const different=scope({...CONCERT,event_date:'2026-10-22'});
 const r=Runner.recoverEligibleReferenceCandidates(discovered,[same,different],CTX);
 assert.equal(r.recovered_count,1);
 assert.equal(r.undated_recovered_count,0);
 assert.equal(r.candidates.length,2);
 assert.equal(r.candidates[1].event_date,'2026-10-22');
});
test('undated scoped candidate remains unresolved FULL evidence even if dated discovery shares same URL',()=>{
 const discovered=[{title:CONCERT.title,event_date:'2026-10-21',source_url:CONCERT.source_url}];
 const candidate=scope(CONCERT);
 const recovered=Runner.recoverEligibleReferenceCandidates(discovered,[candidate],CTX);
 assert.equal(recovered.undated_recovered_count,1);
 const reconciled=Reconcile.reconcileCandidateSets(recovered.candidates,[candidate]);
 assert.equal(reconciled.complete,false);
 assert.equal(reconciled.pending_source_date_count,1);
 assert.equal(reconciled.reconciliation_gap_count,1);
 assert.equal(reconciled.missing_candidates[0].reason,'SOURCE_EVENT_DATE_PENDING_VERIFIER');
 assert.equal(reconciled.missing_candidates[0].event_date,null);
});
test('unscoped undated search pages remain informational and do not invent a gap',()=>{
 const result=Reconcile.reconcileCandidateSets(
  [{title:'ATLAS RISING UP FANMEET BANGKOK',event_date:'2026-10-21'}],
  [{title:'ATLAS RISING UP FANMEET BANGKOK',event_date:'2026-10-21'},
   {title:'Bangkok concerts',event_date:null,source_url:'https://example.org/calendar'}]
 );
 assert.equal(result.complete,true);
 assert.equal(result.pending_source_date_count,0);
 assert.equal(result.reconciliation_gap_count,0);
});
test('Verifier uses October JSON-LD source date for undated trusted event, not the search month',async()=>{
 const candidate=Runner.recoverEligibleReferenceCandidates([],[scope(CONCERT)],CTX).candidates[0];
 const html=htmlEvent(CONCERT.title,'2026-10-21T17:00:00+07:00');
 const res=await Verifier.verifyBatch([candidate],CTX,{
  fetchFn:async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>html})
 });
 assert.equal(res.fetched_count,1);
 assert.equal(res.verified_count,1);
 assert.equal(res.verified_candidates[0].event_date,'2026-10-21');
 assert.equal(res.production_writes,0);
});
test('Verifier refuses unrelated October Event embedded in a date-less reference page',async()=>{
 const candidate=Runner.recoverEligibleReferenceCandidates([],[scope(CONCERT)],CTX).candidates[0];
 const out=Verifier.verifyHtmlCandidate(candidate,htmlEvent('RANDOM OTHER EVENT BANGKOK','2026-10-21T19:00:00+07:00'),CTX);
 assert.equal(out.verified,false);
 assert.ok(out.blockers.includes('SOURCE_EVENT_TITLE_CONFLICT'));
});
test('Verifier refuses JSON-LD Event located outside Bangkok despite candidate claimed Bangkok',()=>{
 const candidate=Runner.recoverEligibleReferenceCandidates([],[scope(CONCERT)],CTX).candidates[0];
 const out=Verifier.verifyHtmlCandidate(candidate,htmlEvent(CONCERT.title,'2026-10-21T19:00:00+07:00','Seoul Olympic Park'),CTX);
 assert.equal(out.verified,false);
 assert.ok(out.blockers.includes('SOURCE_BANGKOK_VENUE_PROOF_REQUIRED'));
});
test('Verifier refuses source Event in November and missing structured date',()=>{
 const candidate=Runner.recoverEligibleReferenceCandidates([],[scope(CONCERT)],CTX).candidates[0];
 for(const html of [htmlEvent(CONCERT.title,'2026-11-21T19:00:00+07:00'),
  '<html><title>ATLAS RISING UP FANMEET BANGKOK</title>BITEC LIVE</html>']){
  const out=Verifier.verifyHtmlCandidate(candidate,html,CTX);
  assert.equal(out.verified,false);
  assert.ok(out.blockers.includes('SOURCE_EVENT_DATE_REQUIRED'));
 }
});
test('PAÑPURI date-less pop-up reaches Verifier but invite/access/photo rights remain HOLD',async()=>{
 const candidate=Runner.recoverEligibleReferenceCandidates([],[scope(POPUP)],CTX).candidates[0];
 const html=htmlEvent(POPUP.title,'2026-10-21T16:00:00+07:00',
  'centralwOrld Beacon 3','https://brand.example/assets/panpuri-event.jpg',
  'PHUTATCHAI invited guests only; fans outside designated area');
 const out=await Verifier.verifyBatch([candidate],CTX,{
  fetchFn:async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>html})
 });
 assert.equal(out.fetched_count,1);
 assert.equal(out.verified_count,0);
 assert.equal(out.hold_count,1);
 assert.equal(out.holds[0].status,'HOLD_OWNER_ARTIST_POPUP_REVIEW');
 assert.ok(out.holds[0].blockers.includes('ARTIST_POPUP_OWNER_ACCESS_PHOTO_POLICY_REVIEW_REQUIRED'));
 assert.equal(out.production_writes,0);
});
test('actual October runtime routes date-less reference into queue but stays HOLD until source evidence',async()=>{
 const provider=async task=>{
  if(task.source_id==='reference-6')return [{...POPUP}];
  return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',
   source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},
  {providers:{SEARXNG:provider},use_only_injected_providers:true});
 assert.equal(out.full,false);
 assert.equal(out.status,'HOLD_FOR_COVERAGE');
 assert.equal(out.reference_pending_source_date_count,1);
 assert.equal(out.reference_undated_recovered_count,1);
 assert.ok(out.blockers.includes('REFERENCE_SOURCE_DATE_VERIFICATION_PENDING'));
 assert.ok(out.blockers.includes('RECONCILIATION_GAPS_REMAIN'));
 assert.equal(out.diagnostic.counts.reference_pending_source_date,1);
 assert.equal(out.diagnostic.full,false);
 assert.ok(out.candidates.some(c=>c.date_pending_verification===true&&
   c.candidate_origin==='INDEPENDENT_REFERENCE_RECOVERY'&&!c.event_date));
 assert.equal(out.production_writes,0);
});
test('Direct ZERO-COST path only verifies incomplete reference leads as read-only diagnostics',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
 const block=src.slice(src.indexOf('if(!discoveryReady)'),src.indexOf('// Do not delete full-booked-date candidates'));
 assert.match(block,/options\.executeWrites!==true/);
 assert.match(block,/date_pending_verification===true/);
 assert.match(block,/Verifier\.verifyBatch/);
 assert.match(block,/slice\(0,4\)/);
 assert.match(block,/authorized_to_publish:false/);
 assert.match(block,/BLOCKED_DISCOVERY_NOT_FULL/);
 assert.match(block,/production_writes:0/);
});

test('actual Direct.run sends undated FULL-HOLD lead to bounded read-only Verifier without writes',async()=>{
 const Direct=require('../server/kk-ultra-deep-direct-zero-cost.js');
 const Production=require('../server/kk-ultra-deep-production-runtime.js');
 const oldSnapshot=Production.freshSnapshot;
 const oldRunner=Runner.runMonthlyUltraDeep;
 let runs=0;
 try{
  Production.freshSnapshot=async()=>({
   snapshot_source:'TEST_READ_ONLY',generated_at:'2026-10-13T10:00:00Z',
   assets:[{asset_type:'phone',status:'ready'}],
   events:[],bookings:[],packages:[],web_ready:[],visibility_locks:[]
  });
  const lead=Runner.recoverEligibleReferenceCandidates([],[scope(POPUP)],CTX).candidates[0];
  Runner.runMonthlyUltraDeep=async()=>({
   full:false,status:'HOLD_FOR_COVERAGE',candidates:[lead],production_writes:0
  });
  const html=htmlEvent(POPUP.title,'2026-10-21T16:00:00+07:00',
   'centralwOrld Beacon 3','https://brand.example/panpuri.jpg','PHUTATCHAI invited guests only');
  const out=await Direct.run({month:'2026-10'},{
   executeWrites:false,env:{},
   fetchImpl:async()=>{runs++;return {ok:true,status:200,headers:{get:()=>null},text:async()=>html};}
  });
  assert.equal(out.status,'BLOCKED_DISCOVERY_NOT_FULL');
  assert.equal(out.reference_source_date_review.examined_count,1);
  assert.equal(out.reference_source_date_review.verified_count,0);
  assert.equal(out.reference_source_date_review.hold_count,1);
  assert.equal(out.reference_source_date_review.authorized_to_publish,false);
  assert.equal(out.production_writes,0);
  assert.equal(runs,1);
 }finally{
  Production.freshSnapshot=oldSnapshot;
  Runner.runMonthlyUltraDeep=oldRunner;
 }
});
test('Direct.run commit intent NEVER inspects undated reference through bypass when FULL is HOLD',async()=>{
 const Direct=require('../server/kk-ultra-deep-direct-zero-cost.js');
 const Production=require('../server/kk-ultra-deep-production-runtime.js');
 const oldSnapshot=Production.freshSnapshot,oldRunner=Runner.runMonthlyUltraDeep;
 try{
  Production.freshSnapshot=async()=>({
   snapshot_source:'TEST_READ_ONLY',generated_at:'2026-10-13T10:00:00Z',
   assets:[{asset_type:'phone',status:'ready'}],
   events:[],bookings:[],packages:[],web_ready:[],visibility_locks:[]
  });
  Runner.runMonthlyUltraDeep=async()=>({
   full:false,status:'HOLD_FOR_COVERAGE',
   candidates:Runner.recoverEligibleReferenceCandidates([],[scope(CONCERT)],CTX).candidates
  });
  const out=await Direct.run({month:'2026-10'},{
   executeWrites:true,env:{},
   fetchImpl:async()=>{throw Error('MUST_NOT_FETCH_OR_WRITE');}
  });
  assert.equal(out.status,'BLOCKED_DISCOVERY_NOT_FULL');
  assert.equal(out.reference_source_date_review,null);
  assert.equal(out.production_writes,0);
 }finally{
  Production.freshSnapshot=oldSnapshot;
  Runner.runMonthlyUltraDeep=oldRunner;
 }
});
