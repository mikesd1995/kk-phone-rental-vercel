'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-public-event-index-provider.js');

function response(body,status=200){return {ok:status>=200&&status<300,status,text:async()=>body};}

test('infers English, ISO and Thai Buddhist event dates',()=>{
 assert.deepEqual(P.inferDates('Concert 10 Oct 2026 Bangkok'),['2026-10-10']);
 assert.deepEqual(P.inferDates('Festival 23-25 October 2026'),['2026-10-23','2026-10-24','2026-10-25']);
 assert.deepEqual(P.inferDates('งาน 24 ต.ค. 2569 กรุงเทพ'),['2026-10-24']);
 assert.deepEqual(P.inferDates('2026-10-31'),['2026-10-31']);
});

test('parses bounded Eventpop and ThaiTicketMajor listing links',()=>{
 const eventpop=P.parseListing('https://www.eventpop.me/g/concert?locale=en',
  '<article><div>Sat, 10 Oct 2026 Bangkok</div><a href="/e/173940/undercurrent">Under Current 10 oct</a></article>');
 assert.equal(eventpop.length,1);
 assert.equal(eventpop[0].event_date,'2026-10-10');
 assert.match(eventpop[0].source_url,/eventpop\.me\/e\/173940/);

 const ttm=P.parseListing('https://www.thaiticketmajor.com/search/',
  '<section><h3>LYKN REFLEXION CONCERT</h3><div>24 ต.ค. 2569</div><a href="/concert/lykn-reflexion.html">ซื้อบัตร</a></section>');
 assert.equal(ttm.length,1);
 assert.equal(ttm[0].title,'LYKN REFLEXION CONCERT');
 assert.equal(ttm[0].event_date,'2026-10-24');
 assert.match(ttm[0].source_url,/thaiticketmajor\.com\/concert/);
});

test('public index search respects month, site and specific identity',()=>{
 const rows=[
  {title:'LYKN REFLEXION CONCERT',event_date:'2026-10-24',source_url:'https://www.thaiticketmajor.com/concert/lykn'},
  {title:'Under Current 10 oct',event_date:'2026-10-10',source_url:'https://www.eventpop.me/e/173940/undercurrent'},
  {title:'November Show',event_date:'2026-11-01',source_url:'https://www.eventpop.me/e/nov'}
 ];
 const generic=P.searchRows(rows,{query:'Bangkok October 2026 concert',date_window:{start:'2026-10-01'}});
 assert.equal(generic.length,2);
 const site=P.searchRows(rows,{source_id:'eventpop',query:'site:eventpop.me Bangkok October 2026 concert',date_window:{start:'2026-10-01'}});
 assert.deepEqual(site.map(x=>x.title),['Under Current 10 oct']);
 const specific=P.searchRows(rows,{query:'LYKN REFLEXION Bangkok Thailand',date_window:{start:'2026-10-01'}});
 assert.deepEqual(specific.map(x=>x.title),['LYKN REFLEXION CONCERT']);
});

test('create caches the bounded public index across repeated task calls',async()=>{
 let calls=0;
 const html='<article><div>Sat, 10 Oct 2026 Bangkok</div><a href="/e/173940/undercurrent">Under Current Concert</a></article>';
 const provider=P.create({
  urls:['https://www.eventpop.me/g/concert?locale=en'],
  fetchFn:async()=>{calls++;return response(html);}
 });
 const a=await provider({query:'Bangkok October 2026 concert',date_window:{start:'2026-10-01'}});
 const b=await provider({query:'Bangkok October 2026 concerts',date_window:{start:'2026-10-01'}});
 assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(calls,1);
});
