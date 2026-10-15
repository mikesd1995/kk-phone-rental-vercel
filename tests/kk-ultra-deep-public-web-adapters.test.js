'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const A=require('../server/kk-ultra-deep-public-web-adapters.js');
function response(body,status=200){return {ok:status>=200&&status<300,status,headers:{get:()=>String(Buffer.byteLength(body))},text:async()=>body};}
test('official direct fetches bounded HTTPS evidence',async()=>{const rows=await A.officialDirect({source_url:'https://example.com/event'},{fetchFn:async()=>response('<html><title>Concert Bangkok</title></html>')});assert.equal(rows.length,1);assert.equal(rows[0].title,'Concert Bangkok');assert.equal(rows[0].source_url,'https://example.com/event');});
test('official direct rejects non HTTPS seeds',async()=>{let calls=0;const rows=await A.officialDirect({source_url:'http://example.com/event'},{fetchFn:async()=>{calls++;return response('x');}});assert.equal(rows.length,0);assert.equal(calls,0);});

test('official page reads labeled show date and venue without using the ticket sale date',async()=>{
 const body='<title>Sample 1st FANMEETING | Organizer</title><dl><dt>Venue</dt><dd>ONE BANGKOK FORUM</dd><dt>Show Date</dt><dd>24 October 2026 | Showtime: 04:00 PM (GMT+7)</dd><dt>Ticket On Sale</dt><dd>4 October 2026 | From 10:00 AM</dd></dl>';
 const [row]=await A.officialDirect({source_url:'https://organizer.example/'},{fetchFn:async()=>response(body)});
 assert.equal(row.event_date,'2026-10-24');assert.equal(row.event_time,'16:00');assert.equal(row.venue,'ONE BANGKOK FORUM');
});

test('official event metadata wins over a conflicting generic description range',()=>{
 const body='<title>Sample Concert | Ticketing</title><meta content="event_detail" property="og:type"><meta property="og:start_time" content="2026-11-29T15:00:00+07:00"><meta content="MCC Hall" property="og:location"><meta name="description" content="Sample Concert 27 - 29 November 2026">';
 const row=A.candidateFromPage('https://ticketing.example/event/1',body,{query:'Sample 27 November 2026'});
 assert.equal(row.event_date,'2026-11-29');assert.equal(row.event_time,'15:00');assert.equal(row.venue,'MCC Hall');
});

test('article dates and conflicting or invalid show dates remain unknown',()=>{
 for(const body of [
  '<title>Event News</title><meta property="og:type" content="article"><meta property="article:published_time" content="2026-10-04T10:00:00+07:00"><p>24 October 2026</p>',
  '<title>Shows</title><dt>Show Date</dt><dd>24 October 2026</dd><dt>Show Date</dt><dd>25 October 2026</dd>',
  '<title>Concert</title><meta property="og:type" content="event"><meta property="og:start_time" content="2026-02-30T15:00:00+07:00">'
 ]) assert.equal(A.candidateFromPage('https://organizer.example/',body,{query:'24 October 2026'}).event_date,null);
});

test('HTML search results retain explicit title dates and never copy a query date',()=>{
 const ddg='<a class="result__a" href="https://organizer.example/1">Sample FANMEETING 24 October 2026</a><a class="result__a" href="https://organizer.example/2">Other FANMEETING</a>';
 const bing='<li class="b_algo"><h2><a href="https://organizer.example/1">Sample FANMEETING 24 October 2026</a></h2></li><li class="b_algo"><h2><a href="https://organizer.example/2">Other FANMEETING</a></h2></li>';
 for(const rows of [A.parseDuckDuckGoHtml(ddg,'4 October 2026'),A.parseBingHtml(bing,'4 October 2026')]){
  assert.deepEqual(rows.map(row=>row.event_date),['2026-10-24',null]);
 }
});

test('RSS title date does not become a cross product with a ticket-sale date in the snippet',()=>{
 const xml='<rss><item><title>Sample FANMEETING 24 October 2026</title><link>https://organizer.example/event</link><description>Tickets on sale 4 October 2026</description></item></rss>';
 assert.deepEqual(A.parseRssItems(xml).map(row=>row.event_date),['2026-10-24']);
});

test('explicit site queries discard off-domain search results without accepting lookalike hosts',async()=>{
 const xml='<rss>'+[
  'https://eventpop.me.attacker.example/e/1','https://unrelated.example/e/2','https://www.eventpop.me/e/3','https://tickets.eventpop.me/e/4'
 ].map(url=>'<item><title>Concert</title><link>'+url+'</link></item>').join('')+'</rss>';
 const rows=await A.bingRss({query:'Sample site:eventpop.me'},{fetchFn:async()=>response(xml)});
 assert.deepEqual(rows.map(row=>row.source_url),['https://www.eventpop.me/e/3','https://tickets.eventpop.me/e/4']);
 const ddg='<a class="result__a" href="https://unrelated.example/">Wrong</a><a class="result__a" href="https://www.eventpop.me/e/3">Concert</a>';
 const bing='<li class="b_algo"><a href="https://unrelated.example/">Wrong</a></li><li class="b_algo"><a href="https://www.eventpop.me/e/3">Concert</a></li>';
 assert.equal(A.parseDuckDuckGoHtml(ddg,'site:eventpop.me Concert').length,1);
 assert.equal(A.parseBingHtml(bing,'site:eventpop.me Concert').length,1);
 assert.equal((await A.bingRss({query:'Concert -site:excluded.example'},{fetchFn:async()=>response(xml)})).length,4);
});

test('off-domain RSS evidence lets the existing executor continue to the next provider',async()=>{
 const E=require('../server/kk-ultra-deep-provider-executor.js');
 const xml='<rss><item><title>Unrelated help</title><link>https://unrelated.example/</link></item></rss>';
 const providers={BING_RSS:task=>A.bingRss(task,{fetchFn:async()=>response(xml)}),DDG_HTML:async()=>A.parseDuckDuckGoHtml('<a class="result__a" href="https://organizer.example/event">Sample FANMEETING 24 October 2026</a>','site:organizer.example')};
 const result=await E.executeGapTask({query:'Sample site:organizer.example',providers:['BING_RSS','DDG_HTML']},{providers});
 assert.equal(result.provider,'DDG_HTML');assert.equal(result.candidates[0].event_date,'2026-10-24');
 assert.equal(result.production_writes,0);assert.equal(result.authoritative,false);assert.equal(result.verifier_required,true);
});

test('public fetch decodes explicitly declared Thai legacy charset without corrupting event labels',async()=>{
 const bytes=Buffer.concat([Buffer.from('<title>'),Buffer.from([0xe4,0xb7,0xc2]),Buffer.from('</title>')]);
 const body=await A.fetchPage('https://organizer.example/',{fetchFn:async()=>new Response(bytes,{headers:{'content-type':'text/html; charset=tis-620'}})});
 assert.equal(body,'<title>ไทย</title>');
});

test('unsupported cross-month and long date ranges never return only their final day',()=>{
 for(const value of ['30 October - 1 November 2026','30 ตุลาคม - 1 พฤศจิกายน 2569','1-31 October 2026']){
  assert.deepEqual(A.inferSearchEventDates(value),[]);
 }
});

test('dated official metadata cannot acquire an event identity from the search query',()=>{
 const K=require('../server/kk-ultra-deep-known-miss-regression.js');
 const body='<meta property="og:type" content="event_detail"><meta property="og:start_time" content="2026-10-24T16:00:00+07:00">';
 const row=A.candidateFromPage('https://organizer.example/',body,{query:'Sample FANMEETING 24 October 2026'});
 assert.equal(row.title,null);assert.equal(row.event_date,'2026-10-24');
 assert.equal(K.sameCase(row,{title:'Sample FANMEETING',event_date:'2026-10-24'}),false);
});

test('search and RSS rows with no observed title never borrow identity or title dates from a query',()=>{
 const query='Sample FANMEETING 24 October 2026';
 const xml='<rss><item><link>https://organizer.example/1</link><description>Tickets on sale 4 October 2026</description></item></rss>';
 const rss=A.parseRssItems(xml,query);
 assert.equal(rss[0].title,null);assert.equal(rss[0].event_date,null);
 for(const row of [
  A.parseDuckDuckGoHtml('<a class="result__a" href="https://organizer.example/1"></a>',query)[0],
  A.parseBingHtml('<li class="b_algo"><a href="https://organizer.example/1"></a></li>',query)[0]
 ]){assert.equal(row.title,null);assert.equal(row.event_date,null);}
});

test('optional JSON and DDGS providers retain missing actual titles as unknown',async()=>{
 const ddgs=await A.ddgsTrafilatura({query:'Sample FANMEETING 24 October 2026'},{ddgs_runner:async()=>[{source_url:'https://organizer.example/1',body:'24 October 2026'}]});
 const json=await A.searxng({query:'Sample FANMEETING 24 October 2026'},{searxng_endpoint:'https://search.example/',fetchFn:async()=>response(JSON.stringify({results:[{url:'https://organizer.example/1'}]}))});
 assert.equal(ddgs[0].title,null);assert.equal(json[0].title,null);
});

test('inert markup cannot supply the page title or show date',()=>{
 for(const tag of ['script','template']){
  const body='<title>Actual News</title><'+tag+'><title>Fake Event</title><dt>Show Date</dt><dd>24 October 2026</dd></'+tag+'>';
  assert.equal(A.candidateFromPage('https://organizer.example/',body).event_date,null);
 }
 const comment='<!-- <title>Fake Event</title><meta property="og:type" content="event_detail"><meta property="og:start_time" content="2026-10-24T16:00:00+07:00"> --><title>Actual News</title>';
 const row=A.candidateFromPage('https://organizer.example/',comment);assert.equal(row.title,'Actual News');assert.equal(row.event_date,null);
});

test('nested or unclosed inert markup cannot leak a show date while surrounding real fields survive',()=>{
 const hidden='<title>Concert</title><template><template>Placeholder</template><dt>Show Date</dt><dd>24 October 2026</dd></template>';
 assert.equal(A.candidateFromPage('https://organizer.example/',hidden).event_date,null);
 for(const opening of ['<!--','<script>','<template>']){
  assert.equal(A.candidateFromPage('https://organizer.example/','<title>Concert</title>'+opening+'<dt>Show Date</dt><dd>24 October 2026</dd>').event_date,null);
 }
 const real='<title>Concert</title><template><template>Placeholder</template><dt>Show Date</dt><dd>4 October 2026</dd></template><dt>Show Date</dt><dd>24 October 2026</dd>';
 assert.equal(A.candidateFromPage('https://organizer.example/',real).event_date,'2026-10-24');
});

test('impossible event timestamp seconds or timezone cannot establish a show date',()=>{
 for(const start of ['2026-10-24T16:00:99+07:00','2026-10-24T16:00:00+25:99','2026-10-24T16:00:00+07:99']){
  const row=A.candidateFromPage('https://organizer.example/','<title>Concert</title><meta property="og:type" content="event"><meta property="og:start_time" content="'+start+'">');
  assert.equal(row.event_date,null);assert.equal(row.event_time,null);
 }
});

test('multiple showtimes for one day stay unknown instead of silently selecting the first round',()=>{
 const row=A.candidateFromPage('https://organizer.example/','<title>Concert</title><dt>Show Date</dt><dd>24 October 2026 | Showtime: 04:00 PM | Showtime: 07:00 PM</dd>');
 assert.equal(row.event_date,'2026-10-24');assert.equal(row.event_time,null);
});

test('conflicting labeled showtimes cannot be hidden by a matching metadata time',()=>{
 const body='<title>Concert</title><meta property="og:type" content="event_detail"><meta property="og:start_time" content="2026-10-24T16:00:00+07:00"><dt>Show Date</dt><dd>24 October 2026 | Showtime: 04:00 PM | Showtime: 07:00 PM</dd>';
 const row=A.candidateFromPage('https://organizer.example/',body);
 assert.equal(row.event_date,'2026-10-24');assert.equal(row.event_time,null);
});

test('invalid positive site scopes fail closed and parenthesized scopes retain their host constraint',()=>{
 const xml='<rss><item><title>Other</title><link>https://unrelated.example/</link></item><item><title>Concert</title><link>https://www.eventpop.me/e/3</link></item></rss>';
 assert.deepEqual(A.parseRssItems(xml,'Concert site:['),[]);
 assert.deepEqual(A.parseRssItems(xml,'Concert site:'),[]);
 assert.deepEqual(A.parseRssItems(xml,'Concert (site:eventpop.me)').map(row=>row.source_url),['https://www.eventpop.me/e/3']);
});

test('credential-bearing evidence URLs are rejected before they enter candidates or fetches',async()=>{
 const xml='<rss><item><title>Concert</title><link>https://fixture-user:fixture-password@eventpop.me/e/sample</link></item></rss>';
 assert.deepEqual(A.parseRssItems(xml,'site:eventpop.me Concert'),[]);
 let fetched=false;
 await assert.rejects(A.fetchPage('https://fixture-user:fixture-password@eventpop.me/e/sample',{fetchFn:async()=>{fetched=true;return response('x');}}),{code:'HTTPS_URL_REQUIRED'});
 assert.equal(fetched,false);
});

test('an explicit sale-date title cannot hide the separately labeled show date',()=>{
 const xml='<rss><item><title>Sample Concert Tickets On Sale 4 October 2026</title><link>https://organizer.example/</link><description>Show Date: 24 October 2026 | Tickets On Sale: 4 October 2026</description></item></rss>';
 assert.deepEqual(A.parseRssItems(xml).map(row=>row.event_date),['2026-10-24']);
});

test('sale or publication dates in search evidence stay unknown without a named show date',async()=>{
 const title='Sample Concert Tickets On Sale 4 October 2026';
 const ddg='<a class="result__a" href="https://organizer.example/">'+title+'</a>';
 const bing='<li class="b_algo"><a href="https://organizer.example/">'+title+'</a></li>';
 assert.equal(A.parseDuckDuckGoHtml(ddg)[0].event_date,null);assert.equal(A.parseBingHtml(bing)[0].event_date,null);
 const rows=await A.ddgsTrafilatura({query:'Sample Concert'},{ddgs_runner:async()=>[{title:'Sample Concert',source_url:'https://organizer.example/',body:'Published on 4 October 2026'}]});
 assert.equal(rows[0].event_date,null);
});
test('public feed extracts only HTTPS links',async()=>{const xml='<rss><channel><item><link>https://example.com/a</link></item><item><link>http://bad.test/b</link></item></channel></rss>';const rows=await A.rssOrPublicFeed({feed_urls:['https://feed.example/rss']},{fetchFn:async()=>response(xml)});assert.equal(rows.length,1);assert.equal(rows[0].source_url,'https://example.com/a');});

test('searxng discovers unknown HTTPS URLs from JSON search results',async()=>{
 const rows=await A.searxng({query:'concert Bangkok October 2026'},{searxng_endpoint:'https://search.example/search',fetchFn:async url=>{assert.match(String(url),/q=concert/);return response(JSON.stringify({results:[{title:'New Event',url:'https://official.example/event'},{title:'Bad',url:'http://bad.example/event'}]}));}});
 assert.equal(rows.length,1);assert.equal(rows[0].title,'New Event');assert.equal(rows[0].source_url,'https://official.example/event');
});
test('searxng remains safely unbound when no endpoint is configured',async()=>{const old=process.env.KK_SEARXNG_ENDPOINT;delete process.env.KK_SEARXNG_ENDPOINT;try{const rows=await A.searxng({query:'event'},{});assert.deepEqual(rows,[]);}finally{if(old)process.env.KK_SEARXNG_ENDPOINT=old;}});

test('createProviders exposes SearXNG only when an HTTPS endpoint is configured',()=>{
 const none=A.createProviders({searxng_endpoint:''});
 assert.equal(typeof none.SEARXNG,'undefined');
 const bound=A.createProviders({searxng_endpoint:'https://search.example/search',fetchFn:async()=>response(JSON.stringify({results:[]}))});
 assert.equal(typeof bound.SEARXNG,'function');
});

test('DuckDuckGo HTML parser extracts canonical HTTPS result URLs',()=>{
 const body='<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Feventpop.me%2Fe%2F123&amp;rut=x"><b>Event</b> Pop</a>';
 const rows=A.parseDuckDuckGoHtml(body,'event Bangkok');
 assert.equal(rows.length,1);
 assert.equal(rows[0].source_url,'https://eventpop.me/e/123');
 assert.equal(rows[0].title,'Event Pop');
});

test('createProviders always exposes credential-free DDG_HTML search',()=>{
 const providers=A.createProviders({searxng_endpoint:''});
 assert.equal(typeof providers.DDG_HTML,'function');
 assert.equal(typeof providers.SEARXNG,'undefined');
});

test('Bing HTML parser extracts non-Bing HTTPS result URLs',()=>{
 const body='<li class="b_algo"><h2><a href="https://eventpop.me/e/fortreasure">FORTREASURE &amp; Bangkok</a></h2></li>';
 const rows=A.parseBingHtml(body,'fortreasure');
 assert.equal(rows.length,1);
 assert.equal(rows[0].source_url,'https://eventpop.me/e/fortreasure');
 assert.equal(rows[0].title,'FORTREASURE & Bangkok');
});

test('HTML entity decoder handles named, decimal and hex entities',()=>{
 assert.equal(A.cleanHtml('A &quot;B&#39; &#x26; C&#38;'),'A "B\' & C&');
});

test('createProviders exposes both zero-cost search fallbacks by default',()=>{
 const p=A.createProviders({searxng_endpoint:''});
 assert.equal(typeof p.DDG_HTML,'function');
 assert.equal(typeof p.BING_HTML,'function');
});

test('DDG parser accepts result-link markup and redirect even when href precedes class',()=>{
 const body='<a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.thaiticketmajor.com%2Fconcert%2Fx" class="result-link">October Concert</a>';
 const rows=A.parseDuckDuckGoHtml(body,'October Bangkok');assert.equal(rows.length,1);assert.match(rows[0].source_url,/thaiticketmajor\.com/);
});
test('Bing parser accepts div b_algo and encoded redirect targets',()=>{
 const target=Buffer.from('https://www.eventpop.me/e/999','utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const body='<div class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1'+target+'">October Event</a></h2></div>';
 const rows=A.parseBingHtml(body,'October Bangkok');assert.equal(rows.length,1);assert.match(rows[0].source_url,/eventpop\.me/);
});

test('provider factory exposes callable live DDG and Bing adapters after parser refactors',async()=>{
 const ddg='<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Feventpop.me%2Fe%2F1">Event</a>';
 const bing='<li class="b_algo"><h2><a href="https://eventpop.me/e/2">Event 2</a></h2></li>';
 const providers=A.createProviders({ddg_min_interval_ms:0,fetchFn:async url=>response(String(url).includes('duckduckgo')?ddg:bing)});
 assert.equal(typeof providers.DDG_HTML,'function');assert.equal(typeof providers.BING_HTML,'function');
 assert.equal((await providers.DDG_HTML({query:'October Bangkok'})).length,1);
 assert.equal((await providers.BING_HTML({query:'October Bangkok'})).length,1);
});

test('DDGS fallback normalizes HTTPS search results without requiring live Python in unit tests',async()=>{
 const rows=await A.ddgsTrafilatura(
   {query:'Bangkok October 2026 concert'},
   {ddgs_runner:async input=>{
     assert.equal(input.query,'Bangkok October 2026 concert');
     return [
       {title:'Concert A',source_url:'https://eventpop.me/e/a'},
       {title:'Unsafe',source_url:'http://example.test/b'}
     ];
   }}
 );
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,'Concert A');
 assert.equal(rows[0].source_url,'https://eventpop.me/e/a');
});

test('provider factory binds DDGS only when explicitly enabled',()=>{
 const old=process.env.KK_DDGS_TRAFILATURA_ENABLED;
 delete process.env.KK_DDGS_TRAFILATURA_ENABLED;
 try{
   const off=A.createProviders({searxng_endpoint:'',ddgs_trafilatura_enabled:false});
   assert.equal(typeof off.DDGS_TRAFILATURA,'undefined');
   const on=A.createProviders({searxng_endpoint:'',ddgs_trafilatura_enabled:true,ddgs_runner:async()=>[]});
   assert.equal(typeof on.DDGS_TRAFILATURA,'function');
 }finally{
   if(old===undefined) delete process.env.KK_DDGS_TRAFILATURA_ENABLED;
   else process.env.KK_DDGS_TRAFILATURA_ENABLED=old;
 }
});

test('DDGS search evidence extracts explicit English and ISO event dates',()=>{
 assert.equal(A.inferSearchEventDate('The Weeknd Bangkok Mon, 12 Oct 2026'),'2026-10-12');
 assert.equal(A.inferSearchEventDate('Fan Meeting October 25, 2026 Bangkok'),'2026-10-25');
 assert.equal(A.inferSearchEventDate('Event 2026-10-31'),'2026-10-31');
 assert.equal(A.inferSearchEventDate('Bangkok concerts October 2026'),null);
});

test('search evidence expands bounded same-month multi-day ranges',()=>{
 assert.deepEqual(A.inferSearchEventDates('Date: Oct 11-13, 2026 | Rajamangala National Stadium'),[
  '2026-10-11','2026-10-12','2026-10-13'
 ]);
 assert.deepEqual(A.inferSearchEventDates('11–13 October 2026 Bangkok'),[
  '2026-10-11','2026-10-12','2026-10-13'
 ]);
});

test('search date-range expansion refuses unsafe long ranges',()=>{
 assert.deepEqual(A.inferSearchEventDates('Oct 1-31, 2026 Bangkok'),[]);
});

test('DDGS emits one candidate per bounded event date from result evidence',async()=>{
 const rows=await A.ddgsTrafilatura(
  {query:'The Weeknd Bangkok October 2026'},
  {ddgs_runner:async()=>[{
    title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Tue, 13 Oct 2026',
    body:'Date: Oct 11-13, 2026 | Rajamangala National Stadium',
    source_url:'https://www.livenationtero.co.th/en/event/the-weeknd-after-hours-til-dawn-tour-bangkok-tickets-edp1678717'
  }]}
 );
 assert.deepEqual(rows.map(row=>row.event_date),['2026-10-11','2026-10-12','2026-10-13']);
 assert.equal(new Set(rows.map(row=>row.source_url)).size,1);
});



test('DDGS title-specific date wins over other dates in snippet body',async()=>{
  const rows=await A.ddgsTrafilatura({query:'The Weeknd Bangkok October 2026'},{
    ddgs_runner:async()=>[{
      title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Sun, 11 Oct 2026',
      body:'Shows also run 12 Oct 2026 and 13 Oct 2026 in Bangkok',
      source_url:'https://www.livenationtero.co.th/en/event/the-weeknd-11-oct'
    }]
  });
  assert.deepEqual(rows.map(x=>x.event_date),['2026-10-11']);
});


test('Live Nation public adapter normalizes official event JSON with canonical URL',async()=>{
 const doc={
  id:'1688334',
  name:'Young K Solo Tour <YOUNGEST> in BANGKOK',
  eventDate:'2026-10-10T00:00:00Z',
  showTime:'18:00',
  image:'https://dynamicmedia.livenationinternational.com/i/f/n/x.png',
  venue:{name:'Samyan Mitrtown Hall'},
  lineup:[{name:'Young K',isPrimary:true}],
  localizations:[{cultureName:'en-GB',url:'https://www.livenationtero.co.th/show/1688334/young-k-solo-tour/bangkok/2026-10-10/en'}]
 };
 const row=A.normalizeLiveNationDocument(doc);
 assert.equal(row.title,'Young K Solo Tour <YOUNGEST> in BANGKOK');
 assert.equal(row.event_date,'2026-10-10');
 assert.equal(row.venue,'Samyan Mitrtown Hall');
 assert.deepEqual(row.artist,['Young K']);
 assert.match(row.source_url,/livenationtero\.co\.th\/show\/1688334/);
});

test('Live Nation public adapter filters by target month and specific identity',async()=>{
 const rows=[
  A.normalizeLiveNationDocument({id:'1',name:'Young K Solo Tour in BANGKOK',eventDate:'2026-10-10T00:00:00Z',venue:{name:'Samyan Mitrtown Hall'},lineup:[{name:'Young K'}],localizations:[{cultureName:'en-GB',url:'https://www.livenationtero.co.th/show/1/young-k/bangkok/2026-10-10/en'}]}),
  A.normalizeLiveNationDocument({id:'2',name:'November Artist Concert',eventDate:'2026-11-09T00:00:00Z',venue:{name:'UOB LIVE'},lineup:[{name:'Artist'}],localizations:[{cultureName:'en-GB',url:'https://www.livenationtero.co.th/show/2/artist/bangkok/2026-11-09/en'}]})
 ];
 const generic=await A.liveNationPublic({query:'Bangkok October 2026 concert',date_window:{start:'2026-10-01'}},{livenation_loader:async()=>rows});
 assert.equal(generic.length,1);
 assert.equal(generic[0].event_date,'2026-10-10');
 const exact=await A.liveNationPublic({query:'Young K Bangkok Thailand',date_window:{start:'2026-10-01'}},{livenation_loader:async()=>rows});
 assert.equal(exact.length,1);
 assert.match(exact[0].title,/Young K/);
 const miss=await A.liveNationPublic({query:'LYKN REFLEXION Bangkok Thailand',date_window:{start:'2026-10-01'}},{livenation_loader:async()=>rows});
 assert.equal(miss.length,0);
});

test('createProviders binds Live Nation as credential-free unknown-url evidence',async()=>{
 let calls=0;
 const payload={hasError:false,documents:[{
  id:'1688334',name:'Young K Solo Tour in BANGKOK',eventDate:'2026-10-10T00:00:00Z',
  venue:{name:'Samyan Mitrtown Hall'},lineup:[{name:'Young K'}],
  localizations:[{cultureName:'en-GB',url:'https://www.livenationtero.co.th/show/1688334/young-k/bangkok/2026-10-10/en'}]
 }]};
 const p=A.createProviders({fetchFn:async url=>{calls++;assert.match(String(url),/livenationtero\.co\.th\/api\/search\/events/);return response(JSON.stringify(payload));}});
 assert.equal(typeof p.LIVENATION_PUBLIC,'function');
 const one=await p.LIVENATION_PUBLIC({query:'Bangkok October 2026 concert',date_window:{start:'2026-10-01'}});
 const two=await p.LIVENATION_PUBLIC({query:'Young K Bangkok',date_window:{start:'2026-10-01'}});
 assert.equal(one.length,1);assert.equal(two.length,1);assert.equal(calls,1);
});
