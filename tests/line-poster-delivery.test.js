'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {safePosterSource,resolveSource,fetchPoster,MAX_BYTES}=require('../server/line-poster');
const webhook=require('../server/line-booking-webhook')._test;

test('normalizes Google Drive poster to LINE-safe delivery width',()=>{
 const u=safePosterSource('https://drive.google.com/thumbnail?id=abc&sz=w1200');
 assert.match(u,/sz=w768/);
});
test('accepts known poster CDNs and rejects arbitrary hosts',()=>{
 assert.equal(safePosterSource('https://drive.google.com/thumbnail?id=abc'),'https://drive.google.com/thumbnail?id=abc&sz=w768');
 assert.equal(safePosterSource('https://evil.example/a.jpg'),'');
 assert.equal(safePosterSource('http://drive.google.com/thumbnail?id=x'),'');
});
test('resolves canonical poster by event id and never from request URL',async()=>{
 const csv='event_id,event_name,poster_image_url\nEVT-TEST-001,Test,https://drive.google.com/thumbnail?id=abc\n';
 const source=await resolveSource('EVT-TEST-001',async()=>({ok:true,text:async()=>csv}));
 assert.equal(source,'https://drive.google.com/thumbnail?id=abc&sz=w768');
});
test('accepts canonical same-origin event poster assets from relative feed URLs',()=>{
 assert.equal(safePosterSource('/assets/event-posters/unlucky-bae-final-ep-official-2026-10-08.jpg'),'https://kk-phone-rental.vercel.app/assets/event-posters/unlucky-bae-final-ep-official-2026-10-08.jpg');
 assert.equal(safePosterSource('/api/private'),'');
});
test('rejects social-mirror screenshot hosts so LINE falls back to text-only Flex',()=>{
 assert.equal(safePosterSource('https://wx2.sinaimg.cn/cmw960/social-capture.jpg'),'');
});
test('poster fetch fails closed on non-image and oversized content',async()=>{
 const csv='event_id,event_name,poster_image_url\nEVT-TEST-001,Test,https://drive.google.com/thumbnail?id=abc\n';
 let n=0;
 const bad=await fetchPoster('EVT-TEST-001',async()=>++n===1?{ok:true,text:async()=>csv}:{ok:true,headers:new Headers({'content-type':'text/html'}),arrayBuffer:async()=>new ArrayBuffer(1)});
 assert.equal(bad.status,415);
 n=0;
 const huge=await fetchPoster('EVT-TEST-001',async()=>++n===1?{ok:true,text:async()=>csv}:{ok:true,headers:new Headers({'content-type':'image/jpeg','content-length':String(MAX_BYTES+1)}),arrayBuffer:async()=>new ArrayBuffer(1)});
 assert.equal(huge.status,413);
});
test('webhook Flex uses same-origin poster delivery URL',async()=>{
 const csv='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-20260930-NINEENTERTAIN-24TH-ANNIVERSARY,Nineentertain 24th Anniversary Charity Concert,30/09/2026,"Parc Paragon, Siam Paragon, Bangkok",https://wx2.sinaimg.cn/cmw960/a.jpg,show,เปิดจอง,1\n';
 const u=await webhook.resolvePoster({event_name:'Nineentertain 24th Anniversary Charity Concert',venue:'Parc Paragon, Siam Paragon, Bangkok'},async()=>({ok:true,text:async()=>csv}));
 assert.equal(u,'');
});

test('webhook only advertises proxy hero when canonical poster source is LINE-safe',async()=>{
 const csv='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-SAFE-001,Safe Event,01/10/2026,Safe Venue,https://drive.google.com/thumbnail?id=abc,show,เปิดจอง,1\n';
 const u=await webhook.resolvePoster({event_name:'Safe Event',venue:'Safe Venue'},async()=>({ok:true,text:async()=>csv}));
 assert.equal(u,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-SAFE-001');
});


test('LINE poster API parses event_id from req.url without touching Vercel req.query getter',()=>{
  const fs=require('node:fs');
  const apiSource=fs.readFileSync(require.resolve('../api/line-poster.js'),'utf8');
  assert.match(apiSource,/new URL\(req\.url\|\|'\/api\/line-poster','http:\/\/localhost'\)/);
  assert.doesNotMatch(apiSource,/req\.query/);
});
