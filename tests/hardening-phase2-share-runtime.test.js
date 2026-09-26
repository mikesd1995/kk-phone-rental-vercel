'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const publicData=require('../api/kk-data.js');

test('event share ids are canonical and unsafe input is rejected',()=>{
  assert.equal(publicData._test.safeShareEventId('EVT-20260927-ATLAS-RISING-UP-CONCERT'),'EVT-20260927-ATLAS-RISING-UP-CONCERT');
  assert.equal(publicData._test.safeShareEventId('bad id'),'');
});

test('event share page renders server-side social metadata and redirects humans',()=>{
  const csv=[\n    "event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template",\n    "EVT-20260927-ATLAS-RISING-UP-CONCERT,ATLAS: RISING UP CONCERT,27/09/2026,IMPACT Arena,https://example.com/poster.jpg,,0,0,เต็มแล้ว,show_full,x"\n  ].join("\\n");\n  const html=publicData._test.renderEventSharePage('EVT-20260927-ATLAS-RISING-UP-CONCERT',csv);\n  /*
  */
  assert.match(html,/og:title/);
  assert.match(html,/ATLAS: RISING UP CONCERT/);
  assert.match(html,/og:image[^>]+example\.com\/poster\.jpg/);
  assert.match(html,/twitter:card/);
  assert.match(html,/http-equiv="refresh"/);
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


test('event social share route is wired at the server boundary',()=>{
  const vercel=fs.readFileSync('vercel.json','utf8');
  assert.match(vercel,/"source": "\/event\/:eventId"/);
  assert.match(vercel,/"destination": "\/api\/kk-event-share\?event=:eventId"/);
});

test('Admin regression runs on both pull requests and pushes to main',()=>{
  const workflow=fs.readFileSync('.github/workflows/admin-regression.yml','utf8');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/push:/);
  assert.match(workflow,/branches:\s*\[main\]/);
  assert.match(workflow,/npm run check/);
  assert.match(workflow,/npm test/);
});
