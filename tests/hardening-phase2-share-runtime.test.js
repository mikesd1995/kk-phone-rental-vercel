'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const publicData=require('../api/kk-data.js');

test('event share id validation',()=>{
  assert.equal(publicData._test.safeShareEventId('EVT-20260927-ATLAS-RISING-UP-CONCERT'),'EVT-20260927-ATLAS-RISING-UP-CONCERT');
  assert.equal(publicData._test.safeShareEventId('bad id'),'');
});

test('server event-share HTML contains event social metadata',()=>{
  const csv=[
    'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
    'EVT-20260927-ATLAS-RISING-UP-CONCERT,ATLAS: RISING UP CONCERT,27/09/2026,IMPACT Arena,https://example.com/poster.jpg,,0,0,full,show_full,x'
  ].join('\n');
  const html=publicData._test.renderEventSharePage('EVT-20260927-ATLAS-RISING-UP-CONCERT',csv);
  assert.equal(html.includes('ATLAS: RISING UP CONCERT'),true);
  assert.equal(html.includes('og:title'),true);
  assert.equal(html.includes('https://example.com/poster.jpg'),true);
  assert.equal(html.includes('twitter:card'),true);
  assert.equal(html.includes('http-equiv="refresh"'),true);
});

test('homepage contains Organization, Service and visible FAQ structured data',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.equal(html.includes('application/ld+json'),true);
  assert.equal(html.includes('"@type":"Organization"'),true);
  assert.equal(html.includes('"@type":"Service"'),true);
  assert.equal(html.includes('"@type":"FAQPage"'),true);
  assert.equal(html.includes('"name":"เช่ามือถือยังไง?"'),true);
  assert.equal(html.includes('"name":"ไฟล์บน Google Drive เก็บไว้ได้กี่วัน?"'),true);
});

test('event-share URL helper uses the current origin and encodes event IDs within the server route',()=>{
  const js=fs.readFileSync('script.js','utf8');
  const helper=js.match(/function eventShareUrl\(c\)\{[\s\S]*?\n\}/);
  assert.ok(helper,'the production event-share URL helper must be available');
  const context={
    window:{location:{origin:'https://kk-phone-rental.vercel.app',href:'https://kk-phone-rental.vercel.app/?event=old#modal'}},
    eventUrl:()=>{ throw new Error('valid event IDs must use the server event route'); }
  };
  vm.runInNewContext(helper[0]+'\nthis.shareUrl=eventShareUrl;',context);
  const cases=[
    {id:'EVT-20260927-ATLAS-RISING-UP-CONCERT',want:'https://kk-phone-rental.vercel.app/event/EVT-20260927-ATLAS-RISING-UP-CONCERT'},
    {id:'EVT-1 /?#&=%',want:'https://kk-phone-rental.vercel.app/event/EVT-1%20%2F%3F%23%26%3D%25'},
    {id:'EVT%2Fpart',want:'https://kk-phone-rental.vercel.app/event/EVT%252Fpart'}
  ];
  for(const {id,want} of cases){
    const actual=context.shareUrl({id});
    assert.equal(actual,want);
    const url=new URL(actual);
    assert.equal(url.origin,'https://kk-phone-rental.vercel.app');
    assert.equal(url.search,'','event IDs must not inject a query');
    assert.equal(url.hash,'','event IDs must not inject a fragment');
  }
});

test('runtime warning tracer is installed',()=>{
  const data=fs.readFileSync('api/kk-data.js','utf8');
  const admin=fs.readFileSync('api/kk-admin-snapshot-v6.js','utf8');
  assert.equal(data.includes('runtime-warning-tracer'),true);
  assert.equal(admin.includes('runtime-warning-tracer'),true);
  assert.equal(fs.readFileSync('server/runtime-warning-tracer.js','utf8').includes('DEP0169'),true);
});

test('event share reuses existing public-data function',()=>{
  const vercel=fs.readFileSync('vercel.json','utf8');
  assert.equal(vercel.includes('/event/:eventId'),true);
  assert.equal(vercel.includes('/api/kk-data?eventShare=:eventId'),true);
  assert.equal(vercel.includes('api/kk-event-share'),false);
});

test('Admin regression workflow covers manual dispatch and full invariant gates',()=>{
  const workflow=fs.readFileSync('.github/workflows/admin-regression.yml','utf8');
  assert.equal(workflow.includes('workflow_dispatch:'),true);
  assert.equal(workflow.includes('npm run check'),true);
  assert.equal(workflow.includes('npm test'),true);
  assert.equal(workflow.includes('npm run audit:invariants'),true);
});
