'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
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

test('share CTA uses server event route',()=>{
  const js=fs.readFileSync('script.js','utf8');
  assert.equal(js.includes('function eventShareUrl(c)'),true);
  assert.equal(js.includes('url:eventShareUrl(activeModalEvent)'),true);
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

test('Admin regression retains required checks during documented manual-only runner recovery',()=>{
  const workflow=fs.readFileSync('.github/workflows/admin-regression.yml','utf8');
  const recovery=fs.readFileSync('docs/CI_RUNNER_QUOTA_RECOVERY_2026-10-03.md','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(recovery,/explicit degraded CI mode, not a PASS/);
  assert.match(recovery,/Restore automatic pull_request\/push triggers/);
  assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
  assert.equal(workflow.includes('npm run check'),true);
  assert.equal(workflow.includes('npm test'),true);
  assert.equal(workflow.includes('npm run audit:invariants'),true);
  assert.equal(workflow.includes('npm run code:benchmark'),true);
});
