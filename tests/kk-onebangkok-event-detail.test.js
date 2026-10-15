'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-public-web-adapters.js');
const H=require('../server/kk-public-event-detail-followup.js');
const URL='https://www.onebangkok.com/en/whats-happening/aurora-lantern-fanmeeting/';
const TITLE='Aurora Lantern ASIA FANMEETING TOUR "The Long Take" in Bangkok';
function page({title=TITLE,heroDate='10 Oct 2026',iconDate='10 October 2026',time='18.00 hrs. onwards',heroVenue='One Bangkok Forum',venue='One Bangkok Forum',extraHero='',extraDetail='',extraHead=''}={}){
 return '<!doctype html><html><head><title>'+title+'</title><meta name="template" content="event-content"><link rel="canonical" href="'+URL+'">'+extraHead+'</head><body><main>'+
 '<section class="mainBreadCrumbMediaSec bgThemeBlack"><div data-label="nested > boundary"><section class="mainBreadCrumbSec"><p>Breadcrumb</p></section><h3 class="titleText">'+title+'</h3><p><i class="icon-ic-calendar"></i>'+heroDate+'</p><a href="https://maps.example/"><p><i class="icon-ic-location"></i>'+heroVenue+'</p></a>'+extraHero+'</div></section>'+
 '<section class="mainContentMediaDetailSec richTextIntroWithIcons"><div><p>Ticket sale 1 September 2026, show 29 November 2026 at Other Hall.</p><div class="boxShop"><ul><li><img src="/images/icon-circle-date.png"><div><p>'+iconDate+'</p></div></li>'+(time===null?'':'<li><img src="/images/icon-circle-time.png"><div><p>'+time+'</p></div></li>')+'<li><a href="https://maps.example/"><img src="/images/icon-circle-location.png"><div><p>'+venue+'</p></div></a></li></ul>'+extraDetail+'</div></div></section>'+
 '<section class="mainRelateEventSec"><h3 class="titleText">Latest Events</h3><p><i class="icon-ic-calendar"></i>21 Nov 2026</p><li><img src="/images/icon-circle-time.png">13.00 hrs.</li><p><i class="icon-ic-location"></i>Sidebar Hall</p></section></main></body></html>';
}
function parse(markup,source=URL){return A.candidateFromPage(source,markup);}
test('exact public One Bangkok event routes normalize tracking without widening the host or path',()=>{
 for(const source of [URL,URL.replace('www.',''),URL.replace('/en/','/th/')])assert.equal(H.publicDetailUrl(source+'?utm_source=fixture#poster'),source);
 for(const source of ['http://www.onebangkok.com/en/whats-happening/a/','https://www.onebangkok.com:443/en/whats-happening/a/','https://user@www.onebangkok.com/en/whats-happening/a/','https://www.onebangkok.com.attacker.example/en/whats-happening/a/','https://preview.onebangkok.com/en/whats-happening/a/','https://127.0.0.1/en/whats-happening/a/','https://www.onebangkok.com/en/whats-happening/','https://www.onebangkok.com/en/whats-happening/a/extra/','https://www.onebangkok.com/en/whats-happening/a--b/','https://www.onebangkok.com/en/whats-happening/%61/','https://www.onebangkok.com/en/whats-happening/a/../checkout/','https://www.onebangkok.com/en/whats-happening/a/?token=fixture','https://www.onebangkok.com/en/whats-happening/a/?redirect=fixture','https://www.onebangkok.com/en/whats-happening/a/?locale=en'])assert.equal(H.publicDetailUrl(source),null,source);
});
test('main icon fields survive nested sections and quoted tag boundaries without borrowing latest events',()=>{
 const row=parse(page());assert.equal(row.title,TITLE);assert.equal(row.event_date,'2026-10-10');assert.equal(row.event_time,'18:00');assert.equal(row.venue,'One Bangkok Forum');
});

test('plaintext makes following markup literal even when a fake closing tag appears',()=>{
 const markup=page().replace('<body><main>','<body><plaintext><main>').replace('</main></body>','</main></plaintext></body>');
 const row=parse(markup);assert.equal(row.event_date,null);assert.equal(row.event_time,null);assert.equal(row.venue,null);
});

test('select contents cannot supply main event components',()=>{
 const markup=page().replace('<body><main>','<body><select><main>').replace('</main></body>','</main></select></body>');
 const row=parse(markup);assert.equal(row.event_date,null);assert.equal(row.event_time,null);assert.equal(row.venue,null);
});
test('the observed redundant breadcrumb anchor close does not truncate the main section',()=>{
 const markup=page().replace('<p>Breadcrumb</p>','<div><a href="/en/"><span>EN</span></a><meta itemprop="position" content="1"></a></div>');
 const row=parse(markup);assert.equal(row.event_date,'2026-10-10');assert.equal(row.event_time,'18:00');assert.equal(row.venue,'One Bangkok Forum');
});
test('a missing main time remains unknown despite latest-event times and narrative prose',()=>{
 const row=parse(page({time:null}));assert.equal(row.event_date,'2026-10-10');assert.equal(row.event_time,null);assert.equal(row.venue,'One Bangkok Forum');
});
test('conflicting or invalid main dates cannot hydrate date or time',()=>{
 for(const changes of [{iconDate:'11 October 2026'},{heroDate:'30 Feb 2026',iconDate:'30 February 2026'},{heroDate:'10 Oct 2026',iconDate:'10-11 October 2026'},{heroDate:'10 Oct 2026',iconDate:'10 October 2026 and 12 October 2026'}]){
  const row=parse(page(changes));assert.equal(row.event_date,null,JSON.stringify(changes));assert.equal(row.event_time,null);
 }
});
test('an unparseable or absent labelled date cannot be replaced by the remaining date field',()=>{
 for(const changes of [{iconDate:'Not announced'},{heroDate:'Not announced'},{iconDate:''}])assert.equal(parse(page(changes)).event_date,null);
});
test('only one valid explicit main time is normalized',()=>{
 assert.equal(parse(page({time:'13.00 hrs.'})).event_time,'13:00');
 for(const time of ['24.00 hrs.','18.60 hrs.','18.00 - 20.00 hrs.','18.00 and 19.00 hrs.','doors open 18.00',''])assert.equal(parse(page({time})).event_time,null,time);
 const conflict='<li><img src="/images/icon-circle-time.png"><p>19.00 hrs.</p></li>';
 assert.equal(parse(page({extraDetail:conflict})).event_time,null);
});
test('conflicting main venue labels remain unknown',()=>{
 assert.equal(parse(page({venue:'Other Hall'})).venue,null);
});
test('inactive and rawtext fake components cannot establish or contaminate event facts',()=>{
 const fake='<section class="mainBreadCrumbMediaSec"><h3 class="titleText">Wrong FANMEETING</h3><p><i class="icon-ic-calendar"></i>29 Nov 2026</p></section>';
 const injections=['<!--'+fake+'-->','<script>'+fake+'</script>','<style>'+fake+'</style>','<template>'+fake+'</template>','<textarea>'+fake+'</textarea>','<div hidden>'+fake+'</div>','<div inert>'+fake+'</div>','<div aria-hidden="true">'+fake+'</div>','<div style="display:none">'+fake+'</div>'];
 for(const injection of injections){const row=parse(page({extraHero:injection}));assert.equal(row.event_date,'2026-10-10',injection);assert.equal(row.event_time,'18:00');}
});
test('fake icons inside inactive content never supplement missing main time',()=>{
 for(const wrapper of ['template','script','style','textarea']){
  const row=parse(page({time:null,extraDetail:'<'+wrapper+'><li><img src="/images/icon-circle-time.png">23.00 hrs.</li></'+wrapper+'>'}));assert.equal(row.event_time,null);
 }
});
test('encoded hidden attributes cannot activate a fake main event component',()=>{
 const fake='<section class="mainBreadCrumbMediaSec"><h3 class="titleText">Wrong FANMEETING</h3><p><i class="icon-ic-calendar"></i>29 Nov 2026</p></section>';
 for(const attribute of ['style="display&#58;none"','aria-hidden="tru&#101;"'])assert.equal(parse(page({extraHero:'<div '+attribute+'>'+fake+'</div>'})).event_date,'2026-10-10');
});
test('tracking-shaped credential parameters are rejected before public detail transport',()=>{
 for(const key of ['utm_token','utm_auth','utm_redirect','utm_unknown'])assert.equal(H.publicDetailUrl(URL+'?'+key+'=fixture'),null,key);
});
test('transactional route names cannot enter the new event-path capability',()=>{
 for(const slug of ['checkout','login','account','payment','orders','queue','vieworders','checkout-step'])assert.equal(H.publicDetailUrl(URL.replace('aurora-lantern-fanmeeting',slug)),null,slug);
});
test('page identity requires unique matching canonical, template, title, main and hero markers',()=>{
 const valid=page();
 const invalid=[valid.replace(URL,URL.replace('aurora-lantern','other-starlight')),valid.replace(URL,URL.replace('onebangkok.com','other.example')),page({extraHead:'<link rel="canonical" href="'+URL+'">'}),page({extraHead:'<meta name="template" content="event-content">'}),valid.replace('<link rel="canonical" href="'+URL+'">',''),valid.replace('content="event-content"','content="other-content"'),valid.replace('<title>'+TITLE+'</title>','<title>Different Starlight FANMEETING</title>'),valid.replace('<h3 class="titleText">'+TITLE,'<h3 class="titleText">Concert Bangkok'),valid.replace('</main>','</main><main></main>'),valid.replace('</main>','<section class="mainBreadCrumbMediaSec"><h3 class="titleText">'+TITLE+'</h3></section></main>'),valid.replace('mainBreadCrumbMediaSec','mainBreadCrumbMediaSecSuffix'),valid.replace('richTextIntroWithIcons','otherComponent'),valid.replace('</body></html>','')];
 for(const markup of invalid){const row=parse(markup);assert.equal(row.event_date,null);assert.equal(row.event_time,null);assert.equal(row.venue,null);}
});
test('mismatched, unclosed and excessive-depth marked components fail closed',()=>{
 const valid=page();
 for(const markup of [valid.replace('</section><section class="mainContent','<section class="mainContent'),valid.replace('</h3>','</h2>'),valid.replace('<main>','<main>'+('<div>'.repeat(130))).replace('</main>',('</div>'.repeat(130))+'</main>')]){
  const row=parse(markup);assert.equal(row.event_date,null);assert.equal(row.venue,null);
 }
});
