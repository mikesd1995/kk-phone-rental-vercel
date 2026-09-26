'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const share=require('../api/kk-event-share.js');

test('event share ids are canonical and unsafe input is rejected',()=>{
  assert.equal(share._test.safeEventId('EVT-20260927-ATLAS-RISING-UP-CONCERT'),'EVT-20260927-ATLAS-RISING-UP-CONCERT');
  assert.equal(share._test.safeEventId('bad id'),'');
});

test('event share page renders server-side social metadata and redirects humans',()=>{
  const html=share._test.renderPage('EVT-20260927-ATLAS-RISING-UP-CONCERT',{
    event_name:'ATLAS: RISING UP CONCERT',
    event_date_text:'27/09/2026',
    venue:'IMPACT Arena',
    poster_image_url:'https://example.com/poster.jpg'
  });
  assert.match(html,/og:title/);
  assert.match(html,/ATLAS: RISING UP CONCERT/);
  assert.match(html,/og:image[^>]+example\.com\/poster\.jpg/);
  assert.match(html,/twitter:card/);
  assert.match(html,/location\.replace/);
  assert.match(html,/\?event=EVT-20260927-ATLAS-RISING-UP-CONCERT/);
});

test('homepage contains Organization and Service structured data',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/application\/ld\+json/);
  assert.match(html,/"@type":\s*"Organization"/);
  assert.match(html,/"@type":\s*"Service"/);
});

test('share CTA uses server-rendered event share URL',()=>{
  const js=fs.readFileSync('script.js','utf8');
  assert.match(js,/function eventShareUrl\(c\)/);
  assert.match(js,/url:eventShareUrl\(activeModalEvent\)/);
});

test('runtime warning tracer is installed before heavy endpoint dependencies',()=>{
  const data=fs.readFileSync('api/kk-data.js','utf8');
  const admin=fs.readFileSync('api/kk-admin-snapshot-v6.js','utf8');
  assert.match(data,/runtime-warning-tracer/);
  assert.match(admin,/runtime-warning-tracer/);
  assert.match(fs.readFileSync('server/runtime-warning-tracer.js','utf8'),/DEP0169/);
});
