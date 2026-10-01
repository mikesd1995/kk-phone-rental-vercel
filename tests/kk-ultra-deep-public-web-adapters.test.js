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
