'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const A=require('../server/kk-ultra-deep-public-web-adapters.js');
function response(body,status=200){return {ok:status>=200&&status<300,status,headers:{get:()=>String(Buffer.byteLength(body))},text:async()=>body};}
test('official direct fetches bounded HTTPS evidence',async()=>{const rows=await A.officialDirect({source_url:'https://example.com/event'},{fetchFn:async()=>response('<html><title>Concert Bangkok</title></html>')});assert.equal(rows.length,1);assert.equal(rows[0].title,'Concert Bangkok');assert.equal(rows[0].source_url,'https://example.com/event');});
test('official direct rejects non HTTPS seeds',async()=>{let calls=0;const rows=await A.officialDirect({source_url:'http://example.com/event'},{fetchFn:async()=>{calls++;return response('x');}});assert.equal(rows.length,0);assert.equal(calls,0);});
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
