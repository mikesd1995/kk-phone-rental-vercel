'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const workflow=fs.readFileSync('.github/workflows/storefront-visual-qa.yml','utf8');
const runner=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');

test('visual QA workflow is read-only and never deploys or promotes Vercel',()=>{
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow,/vercel deploy/i);
  assert.doesNotMatch(workflow,/\/promote\//i);
  assert.doesNotMatch(workflow,/curl[^\n]*-[Xx]\s*(POST|PUT|PATCH|DELETE)/i);
  assert.match(workflow,/read_only:true/);
});

test('visual QA workflow pins target deployment to project and exact Git SHA',()=>{
  assert.match(workflow,/TARGET_PROJECT_MISMATCH/);
  assert.match(workflow,/TARGET_SHA_MISMATCH_/);
  assert.match(workflow,/TARGET_DEPLOYMENT_NOT_READY_/);
  assert.match(workflow,/PREVIEW_REQUEST_POINTS_TO_PRODUCTION/);
  assert.match(workflow,/PRODUCTION_REQUEST_POINTS_TO_NONPRODUCTION/);
});

test('visual QA workflow reuses runner Chrome with ephemeral Playwright and uploads evidence',()=>{
  assert.match(workflow,/playwright@1\.55\.0/);
  assert.match(workflow,/google-chrome --version/);
  assert.match(workflow,/BROWSER_CHANNEL: chrome/);
  assert.doesNotMatch(workflow,/playwright install --with-deps chromium/);
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.match(workflow,/retention-days: 3/);
});

test('visual QA runner covers all storefront policy acceptance widths',()=>{
  assert.match(runner,/Reviewer\.loadPolicy\(\)/);
  assert.match(runner,/const widths=\[\.\.\.policy\.acceptance_viewports\]/);
  for(const width of [320,375,390,430,480,768,1024]){
    assert.match(runner,new RegExp(String(width)+':'));
  }
});

test('visual QA runner captures screenshots and exercises only read-only storefront interactions',()=>{
  assert.match(runner,/screenshot\(\{path:topPath/);
  assert.match(runner,/screenshot\(\{path:stickyPath/);
  assert.match(runner,/forms_submitted:0/);
  assert.match(runner,/production_writes:0/);
  assert.match(runner,/interaction_checks:interactionChecks/);
  assert.match(runner,/STOREFRONT_DATA_NOT_READY/);
  assert.match(runner,/url=>url\.pathname==='\/api\/kk-data'/);
  assert.match(runner,/__KK_PUBLIC_DATA_GUARD__/);
  assert.match(runner,/concert-card:not\(\.skeleton-card\)/);
  assert.match(runner,/search_empty_state/);
  assert.match(runner,/status_filter_pressed/);
  assert.match(runner,/faq_open/);
  assert.match(runner,/event_modal_open/);
  assert.match(runner,/language_en_pressed/);
  assert.doesNotMatch(runner,/\.locator\([^\n]*(line-btn|sticky-line)[^\n]*\)\.click\(/i);
  assert.doesNotMatch(runner,/\.submit\(/);
});

test('visual QA runner measures the mobile failure classes and invokes reviewer acceptance',()=>{
  for(const token of [
    'document_scroll_width_px',
    'sticky_controls_height_px',
    'bottom_cta_height_px',
    'safe_area_bottom_applied',
    'min_form_control_font_px',
    'filter_rows',
    'card_columns',
    'card_min_width_px',
    'visible_event_cards_above_fold',
    'backdrop_blur_px',
    'tap_targets'
  ]){
    assert.match(runner,new RegExp(token));
  }
  assert.match(runner,/Reviewer\.validateVisualQa\(packet\)/);
});

test('visual QA runner fails closed on wrong host, missing cards and wrong CSS marker',()=>{
  assert.match(runner,/TARGET_URL_HOST_NOT_ALLOWED/);
  assert.match(runner,/EVENT_CARDS_NOT_RENDERED/);
  assert.match(runner,/EXPECTED_CSS_MARKER_MISSING/);
  assert.match(runner,/STOREFRONT_ERROR_STATE/);
});


test('protected Preview automation uses Vercel documented bypass headers without disabling protection',()=>{
  assert.match(workflow,/VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(runner,/x-vercel-protection-bypass/);
  assert.match(runner,/x-vercel-set-bypass-cookie/);
  assert.match(workflow,/BLOCKED_PREVIEW_AUTOMATION_BYPASS_UNAVAILABLE/);
  assert.match(workflow,/vercel curl \/ --deployment "\$TARGET_URL"/);
  assert.doesNotMatch(workflow,/project protection disable/i);
  assert.doesNotMatch(workflow,/ssoProtection\s*:\s*null/i);
});


test('local zero-cost mode renders exact checkout without a protected Preview',()=>{
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/local_zero_cost/);
  assert.match(workflow,/python3 -m http\.server 4173 --bind 127\.0\.0\.1/);
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
  assert.match(runner,/LOCAL_TARGET_NOT_LOOPBACK/);
  assert.match(runner,/loadPublicFixtures\(dataSource\)/);
  assert.match(runner,/kk-phone-rental\.vercel\.app/);
});

test('local zero-cost mode uses only read-only canonical public CSV fixtures',()=>{
  assert.match(runner,/08_Web_Ready/);
  assert.match(runner,/09_Web_Packages/);
  assert.match(runner,/page\.route\(url=>url\.pathname==='\/api\/kk-data'/);
  assert.match(runner,/contentType:'text\/csv; charset=utf-8'/);
  assert.match(runner,/paid_external_service_calls:0/);
  assert.match(runner,/zero_cost_path:mode==='local_zero_cost'/);
});

test('visual evidence is compressed to reduce included Actions storage',()=>{
  assert.match(runner,/-top\.jpg/);
  assert.match(runner,/-sticky\.jpg/);
  assert.match(runner,/type:'jpeg',quality:74/);
  assert.doesNotMatch(runner,/-top\.png/);
  assert.match(workflow,/retention-days: 3/);
});


test('runner supports a preinstalled browser channel to avoid browser download',()=>{
  assert.match(runner,/process\.env\.BROWSER_CHANNEL/);
  assert.match(runner,/launchOptions\.channel=browserChannel/);
});


test('iOS zoom metric excludes buttons and applies only through tablet widths',()=>{
  assert.match(runner,/querySelectorAll\('input,select,textarea'\)/);
  assert.doesNotMatch(runner,/querySelectorAll\('input,select,textarea,button'\)/);
  assert.match(runner,/platform:width<=768\?'ios-contract-via-chromium':'chromium'/);
});


test('sticky screenshot scrolls from the sticky shell itself',()=>{
  assert.match(runner,/document\.querySelector\('\.browse-controls-shell'\)/);
  assert.match(runner,/window\.scrollY\+rect\.top\+Math\.max\(80,rect\.height\)/);
  assert.doesNotMatch(runner,/document\.querySelector\('#event-browser'\)/);
});


test('visual QA harness enforces Storefront Art Director acceptance',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/kk-storefront-art-director/);
  assert.match(source,/ArtDirector\.evaluateImplementation/);
  assert.match(source,/art_director_acceptance/);
  assert.match(source,/summary\.pass=summary\.pass && artAcceptance\.status==='PASS'/);
});

test('visual QA workflow triggers for V2 design and Art Director changes',()=>{
  const workflow=fs.readFileSync('.github/workflows/storefront-visual-qa.yml','utf8');
  assert.match(workflow,/assets\/kk-storefront-v2\.css/);
  assert.match(workflow,/server\/kk-storefront-art-director\.js/);
  assert.match(workflow,/tests\/kk-storefront-art-director\.test\.js/);
});


test('visual QA requires visible imagery to be ready before screenshot evidence',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/VISIBLE_IMAGE_NOT_READY/);
  assert.match(source,/naturalWidth/);
  assert.match(source,/\.decode\(\)/);
});


test('V5.6 source has no escaped-newline markup artifacts and keeps editorial localization selectors stable',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const script=fs.readFileSync('script.js','utf8');
  assert.doesNotMatch(html,/\\n\s*</);
  assert.match(script,/\.v3-brand-copy small/);
  assert.match(script,/\.v3-proof>div:not\(\.kk-proof-label\)/);
  assert.match(script,/eventHeading\.innerHTML/);
  assert.match(script,/journey_1_title/);
});

test('visual QA watches the complete executable storefront design council surface',()=>{
  for(const path of [
    'server/kk-storefront-design-council.js',
    'server/kk-storefront-conversion-reviewer.js',
    'server/kk-storefront-fandom-reviewer.js',
    'server/kk-storefront-accessibility-reviewer.js',
    'server/kk-storefront-performance-reviewer.js',
    'server/kk-agent-registry.js',
    'server/kk-agent-task-router.js',
    'tests/kk-storefront-design-council.test.js'
  ]) assert.equal(workflow.includes(path),true,path+' must trigger visual QA');
});


test('V5.7 soft concert brand stays restrained and keeps event commerce primary',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  assert.match(html,/v57-soft-concert/);
  assert.match(html,/kk-spark-mark/);
  assert.match(html,/KEEP THE<br><em>MOMENT CLOSE\.<\/em>/);
  assert.match(css,/--kk-sky:#dcecff/);
  assert.match(css,/--kk-lilac:#eeeaff/);
  assert.match(css,/V5\.7 Soft Concert Tech/);
  assert.doesNotMatch(html,/🦄/);
  assert.doesNotMatch(css,/🦄/);
});
