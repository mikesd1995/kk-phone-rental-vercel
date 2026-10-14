'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-public-web-adapters.js');
const E=require('../server/kk-ultra-deep-provider-executor.js');
const URL_A='https://www.eventpop.me/e/999991/aurora-lantern-fanmeeting';
const URL_B='https://www.eventpop.me/e/999992/moonlight-garden-concert';
function search(rows){return rows.map(row=>'<a class="result__a" href="'+row.url+'">'+row.title+'</a>').join('');}
function page(title='Aurora Lantern FANMEETING',date='2026-10-24'){
 return '<title>'+title+' | Eventpop</title><meta property="og:type" content="event_detail"><meta property="og:start_time" content="'+date+'T16:00:00+07:00"><meta property="og:location" content="Sample Hall">';
}
function fixture(rows,detail,options={}){
 const calls=[];
 const p=A.createProviders({livenation_enabled:false,bing_rss_enabled:false,bing_enabled:false,searxng_endpoint:'',ddgs_trafilatura_enabled:false,ddg_min_interval_ms:0,...options,fetchFn:async(url,request)=>{
  calls.push({url:String(url),redirect:request.redirect});
  if(String(url).includes('duckduckgo.com'))return new Response(search(rows),{headers:{'content-type':'text/html'}});
  return typeof detail==='function'?detail(String(url),request):new Response(detail,{headers:{'content-type':'text/html'}});
 }});
 return {p,calls,detailCalls:()=>calls.filter(row=>!row.url.includes('duckduckgo.com'))};
}
test('factory follows the actual undated event lead before the existing executor admission',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page());
 const out=await E.executeGapTask({query:'Aurora Lantern site:eventpop.me 3 October 2026',providers:['DDG_HTML']},{providers:f.p,acceptCandidate:row=>row.event_date==='2026-10-24'});
 assert.equal(out.status,'EVIDENCE_FOUND');assert.equal(out.candidates[0].event_date,'2026-10-24');
 assert.equal(out.candidates[0].source_url,URL_A);assert.equal(out.candidates[0].title,'Aurora Lantern FANMEETING');
 assert.equal(out.candidates[0].venue,'Sample Hall');assert.equal(f.detailCalls().length,1);
 assert.equal(out.authoritative,false);assert.equal(out.verifier_required,true);assert.equal(out.production_writes,0);
});
test('concurrent aliases share one detail request and preserve independent original rows',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page());
 const rows=await Promise.all([f.p.DDG_HTML({query:'Aurora Lantern'}),f.p.DDG_HTML({query:'Aurora Lantern concert'})]);
 assert.equal(f.detailCalls().length,1);assert.deepEqual(rows.map(r=>r[0].event_date),['2026-10-24','2026-10-24']);
 assert.ok((f.p.detailReadback?.().counts.cache_hits||0)>=1);
});
test('unsafe or transactional URLs never reach detail transport',async()=>{
 const urls=['https://127.0.0.1/e/1','https://[::1]/e/1','https://localhost/e/1','https://www.eventpop.me.attacker.example/e/1','https://queue.eventpop.me/e/1','https://www.eventpop.me:444/e/1','https://www.eventpop.me/e/1?token=fixture','https://www.eventpop.me/event_details/1/calendar.ics','https://www.eventpop.me/g/concert','https://www.deehuphouse.com/TEEHENG_GEN_OF_US_1stFanMeeting/step.php','https://www.deehuphouse.com/TEEHENG_GEN_OF_US_1stFanMeeting/vieworders.php'];
 const f=fixture(urls.map(url=>({url,title:'Aurora Lantern FANMEETING'})),page());
 const rows=await f.p.DDG_HTML({query:'Bangkok fanmeeting'});assert.equal(rows.length,urls.length);assert.equal(f.detailCalls().length,0);assert.ok(rows.every(row=>row.event_date===null));
});
test('named page mismatch or missing actual identity never borrows query evidence',async()=>{
 for(const body of [page('Different Starlight Concert'),'<meta property="og:type" content="event_detail"><meta property="og:start_time" content="2026-10-24T16:00:00+07:00">']){
  const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],body);
  const rows=await f.p.DDG_HTML({query:'Aurora Lantern 24 October 2026'});assert.equal(rows[0].event_date,null);assert.equal(rows[0].title,'Aurora Lantern FANMEETING');
 }
});
test('dated rows, generic titles and an explicitly disabled follow-up require no detail GET',async()=>{
 for(const [title,options] of [['Aurora Lantern FANMEETING 24 October 2026',{}],['Concert Bangkok',{}],['Aurora Lantern FANMEETING',{detail_followup_enabled:false}],['Aurora Lantern FANMEETING',{detail_max_requests:0}]]){
  const f=fixture([{url:URL_A,title}],page(),options);await f.p.DDG_HTML({query:'Bangkok concert'});assert.equal(f.detailCalls().length,0);
 }
});
test('safe same-host public redirects are validated manually and preserve the source lead',async()=>{
 const alias='https://www.eventpop.me/u/999991-aurora-lantern-fanmeeting';
 const f=fixture([{url:alias,title:'Aurora Lantern FANMEETING'}],url=>url===alias?new Response(null,{status:302,headers:{location:URL_A}}):new Response(page(),{headers:{'content-type':'text/html'}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,'2026-10-24');assert.equal(row.source_url,alias);
 assert.equal(f.detailCalls().length,2);assert.ok(f.detailCalls().every(call=>call.redirect==='manual'));
});
test('private, cross-site and checkout redirects are blocked before the next GET',async()=>{
 for(const destination of ['https://127.0.0.1/','https://other.example/event','https://www.eventpop.me/checkout','https://fixture-user:fixture-password@www.eventpop.me/e/1']){
  const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(null,{status:302,headers:{location:destination}}));
  const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.detailCalls().length,1);
 }
});
test('shared HTTP budget bounds distinct detail chains and records remaining debt',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'},{url:URL_B,title:'Moonlight Garden Concert'}],url=>new Response(page(url===URL_A?'Aurora Lantern FANMEETING':'Moonlight Garden Concert'),{headers:{'content-type':'text/html'}}),{detail_max_requests:1});
 const rows=await f.p.DDG_HTML({query:'Bangkok concert fanmeeting'});
 assert.equal(f.detailCalls().length,1);assert.deepEqual(rows.map(row=>row.event_date),['2026-10-24',null]);
 assert.equal(f.p.detailReadback?.().complete,false);assert.ok((f.p.detailReadback?.().counts.budget_deferred||0)>0);
});
test('failed detail reads are cached and never fall back to an uninjected transport',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>{throw Object.assign(new Error('fixture failure'),{code:'FIXTURE_FAILURE'});});
 const one=await f.p.DDG_HTML({query:'Aurora Lantern'}),two=await f.p.DDG_HTML({query:'Aurora Lantern'});
 assert.equal(f.detailCalls().length,1);assert.equal(one[0].event_date,null);assert.equal(two[0].event_date,null);
});
test('non-HTML detail responses stay unhydrated and cannot establish an event date',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(page(),{headers:{'content-type':'application/json'}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);
});

test('redirect loops cannot exceed two validated hops or escape the shared request budget',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(null,{status:302,headers:{location:URL_A}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.detailCalls().length,3);
 assert.equal(f.p.detailReadback().complete,false);
});

test('timeout retains the lead, reports debt and releases the concurrency slot',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],(url,request)=>new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(Object.assign(new Error('fixture abort'),{name:'AbortError'})),{once:true})),{detail_timeout_ms:15});
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.detailCalls().length,1);
 assert.equal(f.p.detailReadback().complete,false);assert.ok(f.p.detailReadback().counts.budget_deferred>0);
});

test('receipt callback failure cannot certify a detail read or leak a changed candidate',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page(),{on_detail_receipt:()=>{throw new Error('fixture audit unavailable');}});
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.p.detailReadback().complete,false);
});

test('named identity mismatch leaves an explicit incomplete follow-up proof',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page('Different Starlight Concert'));
 await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(f.p.detailReadback().complete,false);assert.equal(f.p.detailReadback().counts.identity_mismatch,1);
});

test('a detail title containing a second event cannot lend its date to a shorter lead',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page('Aurora Lantern FANMEETING | Moonlight Garden CONCERT','2026-11-29'));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);
});

test('asynchronous receipt failure must finish before any detail date is admitted',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page(),{on_detail_receipt:()=>{const rejected=Promise.reject(new Error('fixture audit'));rejected.catch(()=>{});return rejected;}});
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.p.detailReadback().complete,false);
});

test('encoded route separators or actions cannot enter a detail request',async()=>{
 const urls=['https://www.eventpop.me/e/999991/aurora%2f..%2f..%2fcheckout','https://www.eventpop.me/e/999991/%61ccount'];
 const f=fixture(urls.map(url=>({url,title:'Aurora Lantern FANMEETING'})),page());
 const rows=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(f.detailCalls().length,0);assert.ok(rows.every(row=>row.event_date===null));
});

test('failure receipts retain a fixed error class and never an arbitrary callback value',async()=>{
 const sentinel='FIXTURE_PRIVATE_ERROR_VALUE';
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page(),{on_detail_receipt:()=>{throw Object.assign(new Error('fixture audit'),{code:sentinel});}});
 await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(JSON.stringify(f.p.detailReadback()).includes(sentinel),false);
});

test('an unsafe redirect response body is cancelled before returning its unchanged lead',async()=>{
 let cancelled=false;
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:302,headers:{location:'https://127.0.0.1/'}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(cancelled,true);
});

test('format-only titles cannot consume the detail budget',async()=>{
 const titles=['Fansign Bangkok','Fan Meet Bangkok','Showcase Bangkok','Fancon Bangkok','คอนเสิร์ต กรุงเทพ'];
 const f=fixture(titles.map(title=>({url:URL_A,title})),page());await f.p.DDG_HTML({query:'Bangkok artist events'});
 assert.equal(f.detailCalls().length,0);
});

test('oversize detail streams stop at the byte cap and cancel the unread remainder',async()=>{
 let cancelled=false;
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1048577));controller.enqueue(new Uint8Array(1));controller.close();},cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(cancelled,true);
});

test('a stalled detail body cannot outlive its timeout or hold the read slot',async()=>{
 let cancelled=false;
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}}),{detail_timeout_ms:15});
 const result=await Promise.race([f.p.DDG_HTML({query:'Aurora Lantern'}).then(rows=>({rows})),new Promise(resolve=>setTimeout(()=>resolve({late:true}),80))]);
 assert.equal(result.late,undefined);assert.equal(result.rows[0].event_date,null);assert.equal(cancelled,true);assert.equal(f.p.detailReadback().complete,false);
});

test('an unresolved asynchronous audit callback is bounded by the shared elapsed deadline',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page(),{detail_max_elapsed_ms:20,on_detail_receipt:()=>new Promise(()=>{})});
 const result=await Promise.race([f.p.DDG_HTML({query:'Aurora Lantern'}).then(rows=>({rows})),new Promise(resolve=>setTimeout(()=>resolve({late:true}),90))]);
 assert.equal(result.late,undefined);assert.equal(result.rows[0].event_date,null);assert.equal(f.p.detailReadback().complete,false);
});

test('a named query does not spend detail requests on a different event from the same host',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'},{url:URL_B,title:'Moonlight Garden Concert'}],url=>new Response(page(url===URL_A?'Aurora Lantern FANMEETING':'Moonlight Garden Concert'),{headers:{'content-type':'text/html'}}));
 const rows=await f.p.DDG_HTML({query:'Aurora Lantern site:eventpop.me October 2026'});
 assert.equal(f.detailCalls().length,1);assert.deepEqual(rows.map(row=>row.event_date),['2026-10-24',null]);
});

test('an audit callback completing after the elapsed deadline cannot admit a date',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],page(),{detail_max_elapsed_ms:5,on_detail_receipt:()=>{const until=Date.now()+12;while(Date.now()<until){}}});
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});assert.equal(row.event_date,null);assert.equal(f.p.detailReadback().complete,false);
});

test('distinct concurrent pages stay within two active detail reads',async()=>{
 const titles=['Aurora Lantern FANMEETING','Moonlight Garden Concert','Crystal Harbor Festival'];
 let active=0,peak=0;
 const p=A.createProviders({livenation_enabled:false,bing_rss_enabled:false,bing_enabled:false,searxng_endpoint:'',ddgs_trafilatura_enabled:false,ddg_min_interval_ms:0,fetchFn:async(url)=>{
  const u=new URL(url);
  if(u.hostname==='html.duckduckgo.com'){
   const index=Number((u.searchParams.get('q')||'').match(/\d+$/)[0]);
   return new Response(search([{url:'https://www.eventpop.me/e/'+(999991+index),title:titles[index]}]),{headers:{'content-type':'text/html'}});
  }
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,12));active--;
  return new Response(page(titles[Number(u.pathname.split('/')[2])-999991]),{headers:{'content-type':'text/html'}});
 }});
 const rows=await Promise.all([0,1,2].map(index=>p.DDG_HTML({query:'Bangkok fanmeeting '+index})));
 assert.equal(peak,2);assert.equal(active,0);assert.ok(rows.every(result=>result[0].event_date==='2026-10-24'));
});

test('non-finite options cannot widen the hard request and cache cap',async()=>{
 let detailCalls=0;
 const p=A.createProviders({livenation_enabled:false,bing_rss_enabled:false,bing_enabled:false,searxng_endpoint:'',ddgs_trafilatura_enabled:false,ddg_min_interval_ms:0,detail_max_requests:Infinity,detail_max_per_call:Infinity,fetchFn:async(url)=>{
  const u=new URL(url);
  if(u.hostname==='html.duckduckgo.com'){
   const index=Number((u.searchParams.get('q')||'').match(/\d+$/)[0]);
   return new Response(search([{url:'https://www.eventpop.me/e/'+(990001+index),title:'Aurora Lantern FANMEETING'}]),{headers:{'content-type':'text/html'}});
  }
  detailCalls++;return new Response(page(),{headers:{'content-type':'text/html'}});
 }});
 const rows=await Promise.all(Array.from({length:30},(_,index)=>p.DDG_HTML({query:'Bangkok fanmeeting '+index})));
 assert.equal(detailCalls,24);assert.equal(rows.filter(result=>result[0].event_date).length,24);assert.equal(p.detailReadback().cache_entries,24);assert.equal(p.detailReadback().complete,false);
});

test('a stalled redirect cancellation cannot hold a detail slot',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],url=>url===URL_A?new Response(new ReadableStream({cancel(){return new Promise(()=>{});}}),{status:302,headers:{location:URL_B}}):new Response(page(),{headers:{'content-type':'text/html'}}),{detail_timeout_ms:15});
 const result=await Promise.race([f.p.DDG_HTML({query:'Aurora Lantern'}).then(rows=>({rows})),new Promise(resolve=>setTimeout(()=>resolve({late:true}),90))]);
 assert.equal(result.late,undefined);assert.equal(result.rows[0].event_date,'2026-10-24');assert.equal(f.detailCalls().length,2);
});

test('conflicting detail facts retain every original field and report unresolved debt',async()=>{
 const H=require('../server/kk-public-event-detail-followup.js');
 const original={title:'Aurora Lantern FANMEETING',source_url:URL_A,event_date:null,event_time:'19:00',venue:'Original Hall'};
 const followup=H.createFollowup(async()=>({candidate:{title:original.title,event_date:'2026-10-24',event_time:'16:00',venue:'Sample Hall'},final_url:URL_A,body_sha256:'a'.repeat(64)}));
 const rows=await followup.enrich([original],{query:'Aurora Lantern'});
 assert.deepEqual(rows,[original]);assert.equal(rows[0],original);assert.equal(followup.readback().complete,false);assert.equal(followup.readback().counts.field_conflicts,1);
});

test('each redirected detail URL strips tracking and fragments before transport and receipt',async()=>{
 const f=fixture([{url:URL_A,title:'Aurora Lantern FANMEETING'}],url=>url===URL_A?new Response(null,{status:302,headers:{location:URL_B+'?utm_source=fixture&aff=fixture#poster'}}):new Response(page(),{headers:{'content-type':'text/html'}}));
 const [row]=await f.p.DDG_HTML({query:'Aurora Lantern'});
 assert.equal(row.event_date,'2026-10-24');assert.equal(f.detailCalls()[1].url,URL_B);assert.equal(f.p.detailReadback().receipts[0].final_url,URL_B);
});

const ONE_URL='https://www.onebangkok.com/en/whats-happening/aurora-lantern-fanmeeting/';
function onePage(title='Aurora Lantern FANMEETING'){
 return '<html><head><title>'+title+'</title><meta name="template" content="event-content"><link rel="canonical" href="'+ONE_URL+'"></head><body><main><section class="mainBreadCrumbMediaSec"><section class="breadcrumb"></section><h3 class="titleText">'+title+'</h3><p><i class="icon-ic-calendar"></i>10 Oct 2026</p><p><i class="icon-ic-location"></i>Sample Hall</p></section><section class="richTextIntroWithIcons mainContentMediaDetailSec"><div class="boxShop"><ul><li><img src="/images/icon-circle-date.png"><p>10 October 2026</p></li><li><img src="/images/icon-circle-time.png"><p>18.00 hrs. onwards</p></li><li><img src="/images/icon-circle-location.png"><p>Sample Hall</p></li></ul></div></section></main></body></html>';
}
test('both actual generic geography query forms admit the exact One Bangkok follow-up through the factory',async()=>{
 for(const query of ['concert fanmeeting fancon showcase mini concert festival Bangkok October 2026 Bangkok Metropolitan Region Thailand','Bangkok ticket concert fanmeeting showcase festival October 2026 Bangkok Metropolitan Region Thailand']){
  const f=fixture([{url:ONE_URL,title:'Aurora Lantern FANMEETING'}],onePage());
  const [row]=await f.p.DDG_HTML({query});assert.equal(row.event_date,'2026-10-10');assert.equal(row.event_time,'18:00');assert.equal(row.venue,'Sample Hall');assert.equal(f.detailCalls().length,1);
  assert.equal(f.p.detailReadback().authoritative,false);assert.equal(f.p.detailReadback().production_writes,0);
 }
});
test('context-only geography and mini concert normalization preserve named query and page identity gates',async()=>{
 const f=fixture([{url:ONE_URL,title:'Aurora Lantern FANMEETING'}],onePage());
 const [unrelated]=await f.p.DDG_HTML({query:'Different Starlight mini concert Bangkok Metropolitan Region Thailand'});assert.equal(unrelated.event_date,null);assert.equal(f.detailCalls().length,0);
 const mismatch=fixture([{url:ONE_URL,title:'Aurora Lantern FANMEETING'}],onePage('Different Starlight FANMEETING'));
 const [row]=await mismatch.p.DDG_HTML({query:'Aurora Lantern mini concert Bangkok Metropolitan Region Thailand'});assert.equal(row.event_date,null);assert.equal(mismatch.detailCalls().length,1);assert.equal(mismatch.p.detailReadback().counts.identity_mismatch,1);
});
test('One Bangkok redirects retain existing exact-host public-path fencing and normalization',async()=>{
 for(const destination of ['https://preview.onebangkok.com/en/whats-happening/a/','https://www.onebangkok.com/en/whats-happening/a/checkout/','https://www.ticketmelon.com/event/fixture','https://127.0.0.1/','https://www.onebangkok.com/en/whats-happening/a/?token=fixture']){
  const f=fixture([{url:ONE_URL,title:'Aurora Lantern FANMEETING'}],()=>new Response(null,{status:302,headers:{location:destination}}));
  const [row]=await f.p.DDG_HTML({query:'Bangkok fanmeeting'});assert.equal(row.event_date,null);assert.equal(f.detailCalls().length,1,destination);
 }
 const alias=ONE_URL.replace('www.','');
 const f=fixture([{url:alias,title:'Aurora Lantern FANMEETING'}],url=>url===alias?new Response(null,{status:302,headers:{location:ONE_URL+'?utm_source=fixture#poster'}}):new Response(onePage(),{headers:{'content-type':'text/html'}}));
 const [row]=await f.p.DDG_HTML({query:'Bangkok fanmeeting'});assert.equal(row.event_date,'2026-10-10');assert.equal(row.source_url,alias);assert.equal(f.detailCalls()[1].url,ONE_URL);
});
