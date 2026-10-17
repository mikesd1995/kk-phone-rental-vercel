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
  for(const width of [320,375,390,430,480,768,1024,1440]){
    assert.match(runner,new RegExp(String(width)+':'));
  }
});

test('visual QA runner captures screenshots and exercises only read-only storefront interactions',()=>{
  assert.match(runner,/captureState\('top',topPath\)/);
  assert.match(runner,/captureState\('catalogue',stickyPath\)/);
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
  // Acceptance now goes through the registered gateway and durable local receipts.
  assert.match(runner,/Evidence\.invokeWithEvidence\('storefront_visual_qa',packet/);
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
  assert.match(runner,/paid_external_service_calls:openAiProviderRequests/);
  assert.match(runner,/zero_cost_path:mode==='local_zero_cost' && openAiProviderRequests===0/);
  assert.match(runner,/if\(openAiConfig\.enabled&&openAiWidths\.has\(width\)\)/);
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


test('visual QA keeps technical CI and owner release acceptance as separate fail-closed gates',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/kk-storefront-art-director/);
  assert.match(source,/ArtDirector\.evaluateImplementation/);
  assert.match(source,/art_director_acceptance/);
  assert.match(source,/const technicalPass=summary\.pass/);
  assert.match(source,/const releasePass=technicalPass && artAcceptance\.status==='PASS'/);
  assert.match(source,/summary\.technical_pass=technicalPass/);
  assert.match(source,/summary\.release_ready=releasePass/);
  assert.match(source,/summary\.pass=technicalPass/);
  assert.match(source,/owner_visual_acceptance/);
});

test('visual QA workflow triggers for active storefront CSS and Art Director changes',()=>{
  const workflow=fs.readFileSync('.github/workflows/storefront-visual-qa.yml','utf8');
  assert.match(workflow,/assets\/kk-storefront-v5\.css/);
  assert.match(workflow,/server\/kk-storefront-art-director\.js/);
  assert.match(workflow,/tests\/kk-storefront-art-director\.test\.js/);
});


test('visual QA requires visible imagery to be ready before screenshot evidence',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  const helpers=fs.readFileSync('scripts/storefront-evidence.cjs','utf8');
  assert.match(source,/VISIBLE_IMAGE_NOT_READY/);
  assert.match(helpers,/naturalWidth/);
  assert.match(helpers,/\.decode\(\)/);
  assert.match(source,/const broken=await Evidence\.settle\(page\)/);
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


test('current owner storefront retains proprietary concert optics rather than outdated V5.8 literal headline',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  const art=fs.readFileSync('server/kk-storefront-art-director.js','utf8');
  // The current owner-facing Thai hero replaced the retired V5.8 literal.
  // Preserve the brand/art direction, semantic structure, and event-first CTA.
  assert.match(html,/<section class="v3-hero kk-stage kk-mock-hero"[^>]*aria-labelledby="v2-intro-title"/);
  assert.match(html,/<h1 id="v2-intro-title">ไกลแค่ไหน<br><em>ก็เก็บโมเมนต์ได้ใกล้กว่า<\/em><\/h1>/);
  assert.match(html,/CONCERT PHONE RENTAL/);
  assert.match(html,/class="v3-primary" href="#content"/);
  assert.doesNotMatch(html,/CONCERT MEMORY SERVICE|FROM POSTER TO FRONT ROW/);
  assert.equal(css.includes('V5.8 Editorial Optics'),true);
  assert.equal(art.includes('proprietary-editorial-concert-optics'),true);
  assert.equal(art.includes('Trend references are inputs, not instructions'),true);
  assert.equal(html.includes('kk-spark-mark'),false);
});


test('V6.3 responsive reset contains tablet/mobile containment and desktop two-column catalogue',()=>{
 const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
 assert.equal(css.includes('KK Storefront V6.3'),true);
 assert.equal(css.includes('min-width:701px) and (max-width:900px'),true);
 assert.match(css,/\.poster-grid\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.equal(css.includes('max-width:359px'),true);
 assert.match(css,/\.concert-card\{[\s\S]*min-width:0!important/);
});


test('V6 production mobile modal does not inherit the retired icon grid and uses a truthful date label',()=>{
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  const script=fs.readFileSync('script.js','utf8');
  assert.match(css,/\.phone-row\{[^}]*grid-template-areas:none!important/);
  assert.match(css,/\.ph-info,\.ph-right\{grid-area:auto!important\}/);
  assert.doesNotMatch(script,/modal-date"\)\.textContent="📅 "/);
  assert.match(script,/modal-date"\)\.textContent=\(currentLang==="en"\?"Date: ":"วันที่: "\)/);
});


test('stale screenshot approval cannot silently accept changed storefront blobs',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/const designUnchanged=/);
  assert.match(source,/screenshotReviewPass=screenshotReview\.status==='PASS' && designUnchanged/);
});


test('V6.1 conversion polish keeps trust, CTA hierarchy and floating contact out of the left content rail',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  assert.match(html,/class="kk-benefit-grid"/);
  assert.match(html,/ฟรีประกัน/);
  assert.match(html,/ไม่ต้องวางมัดจำ/);
  assert.match(html,/รับ–คืนหน้างาน/);
  // Preserve the real booking steps anchor, regardless of prior microcopy.
  assert.match(html,/<a class="v3-secondary" href="#booking-journey">เช่ายังไง\?<\/a>/);
  assert.match(html,/<section class="kk-booking-journey" id="booking-journey"/);
  assert.match(css,/\.pi-tap\{[^}]*border:1px solid var\(--v6-line\)!important/);
  assert.match(css,/\.sticky-line\{display:none!important\}/);
});


test('V6.1.1 customer cards hide internal KK index and dark active filters remain readable',()=>{
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  assert.match(css,/\.concert-card:after\{content:none!important;display:none!important\}/);
  assert.match(css,/html\[data-theme="dark"\] \.browse-controls-shell \.filter-btn\.active,[\s\S]*color:#071426!important;[\s\S]*-webkit-text-fill-color:#071426!important/);
});


test('V6.3 theme toggle uses coherent SVG sun/moon states without emoji glyphs',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
 assert.match(html,/class="theme-sun"[\s\S]*<svg/);
 assert.match(html,/class="theme-moon"[\s\S]*<svg/);
 assert.match(css,/html\[data-theme="dark"\] \.theme-sun\{display:none!important\}/);
 assert.match(css,/html\[data-theme="dark"\] \.theme-moon\{display:grid!important\}/);
});


test('V6.1.3 adversarial cascade cleanup owns dark language, select and narrow-screen states',()=>{
 const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
 assert.match(css,/html\[data-theme="dark"\] \.v3-header \.lang-btn\.active\{[^}]*background:#eef4ff!important;[^}]*color:#071426!important;[^}]*-webkit-text-fill-color:#071426!important/);
 assert.match(css,/html\[data-theme="dark"\] \.month-select\{[^}]*-webkit-text-fill-color:#eef4ff!important/);
 assert.match(css,/\.status-filter-bar::-webkit-scrollbar\{display:none\}/);
 assert.match(css,/\.modal-title\{[^}]*overflow-wrap:anywhere!important/);
});


test('visual QA invokes all seven storefront design-council reviewers and blocks raw i18n keys',()=>{
  assert.match(runner,/kk-storefront-design-council/);
  assert.match(runner,/DesignCouncil\.runCouncil/);
  assert.match(runner,/RAW_I18N_KEY_VISIBLE/);
  assert.match(runner,/raw_i18n_key_count/);
  assert.match(runner,/invoked_agents/);
});


test('V6.3 modal cancels inherited scale animation so 44px controls measure at full size',()=>{
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  assert.match(css,/\.modal\{[\s\S]*animation:none!important;transform:none!important/);
});


test('visual QA treats a verified rendered exact-event text fallback as degraded P2, not a broken-card P1',()=>{
  assert.match(runner,/fallback_mode!=='event-summary'/);
  assert.match(runner,/fallback_visible!==true/);
  assert.match(runner,/POSTER_SOURCE_DEGRADED_FALLBACK_RENDERED/);
  assert.match(runner,/severity:'P2'/);
  assert.match(runner,/POSTER_DELIVERY_FAILED/);
});

test('visual QA keeps the seven-agent council and optionally gates OpenAI screenshot review',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/kk-storefront-design-council/);
  assert.match(source,/storefront_design_council/);
  assert.match(source,/kk-openai-agent-adapters/);
  assert.match(source,/OpenAiAgents\.reviewStorefront/);
  assert.match(source,/KK_OPENAI_STOREFRONT_AI_VIEWPORTS/);
  assert.match(source,/openai_visual_review_pass/);
  assert.match(source,/openAiReviewPass/);
  assert.match(source,/data:image\/jpeg;base64/);
});



test('visual QA card-column summary uses shared horizontal geometry, not card top alignment',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  const evidence=fs.readFileSync('scripts/storefront-evidence.cjs','utf8');
  assert.match(source,/Evidence\.cardColumnGeometry\(metrics\.card_rects\|\|\[\]\)/);
  assert.match(source,/metrics\.card_columns=cardGeometry\.card_columns/);
  assert.match(evidence,/function cardColumnGeometry\(rects=\[\],tolerance=4\)/);
  assert.doesNotMatch(source,/const firstTop=cardRects\.length\?cardRects\[0\]\.top:null/);
  assert.doesNotMatch(source,/Math\.abs\(r\.top-firstTop\)<4/);
});


test('V6.5 owner mobile polish reduces density and makes hierarchy intentional on normal phones',()=>{
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  const js=fs.readFileSync('script.js','utf8');
  assert.match(css,/V6\.5 owner mobile polish/);
  assert.match(css,/@media\(min-width:360px\) and \(max-width:700px\)/);
  assert.match(css,/\.kk-benefit-grid\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.status-filter-bar\{[\s\S]*display:grid!important;[\s\S]*grid-template-columns:27fr 23fr 20fr 30fr!important;[\s\S]*overflow:visible!important/);
  assert.match(css,/\.v3-events-heading h2 br\{display:block!important\}/);
  assert.match(css,/\.v3-events-heading h2 em\{[\s\S]*font-size:\.78em!important;[\s\S]*font-weight:650!important/);
  assert.match(css,/\.language-switch\{[\s\S]*border-radius:16px!important;[\s\S]*overflow:hidden!important/);
  assert.match(css,/\.lang-btn\{[\s\S]*border-radius:12px!important/);
  assert.match(css,/\.kk-mock-hero h1\{[\s\S]*max-width:12ch!important;[\s\S]*line-height:\.93!important/);
  assert.match(js,/hero_secondary:"How to rent"/);
  assert.match(js,/hero_secondary:"เช่ายังไง\?"/);
  assert.match(js,/benefit_onsite:"Venue pickup & return · Setup help before the show"/);
});

test('V6.6 professional finish keeps brand messaging generic while preserving package-level model choice',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const js=fs.readFileSync('script.js','utf8');
  assert.match(html,/PHONE RENTAL<br><span>EVENT PICKUP<\/span>/);
  assert.match(html,/เช่ามือถือสำหรับคอนเสิร์ตและแฟนมีต/);
  assert.doesNotMatch(html,/VIVO X300 PRO \+ LENS/i);
  assert.match(js,/hero_body:"Phone rental for concerts and fan meetings/);
  assert.match(js,/event_meta_description:"Rent a phone for \{event\}/);
  assert.doesNotMatch(js,/hero_body:"Rent a vivo/i);
  assert.match(js,/pkg_phone_only:"Phone only"/);
  assert.match(js,/pkg_bundle:"Phone \+ Lens"/);
});



test('V6.7 lower-page finish prevents clipped card details and reduces CTA/footer legacy weight',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  const js=fs.readFileSync('script.js','utf8');
  assert.match(css,/V6\.7 lower-page professional finish/);
  assert.match(css,/V6\.7 lower-page professional finish[\s\S]*\.concert-card\{[\s\S]*height:100%!important;[\s\S]*align-self:stretch!important/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.pi-venue\{[\s\S]*-webkit-line-clamp:2!important/);
  assert.match(css,/\.browse-more-btn\{[\s\S]*min-height:46px!important;[\s\S]*border-radius:14px!important/);
  assert.match(css,/\.kk-booking-journey\{[\s\S]*padding:18px!important;[\s\S]*border-radius:20px!important/);
  assert.match(css,/\.line-btn\{[\s\S]*width:min\(100%,520px\)!important;[\s\S]*border-radius:16px!important/);
  assert.match(html,/จองง่ายใน 3 ขั้นตอน/);
  assert.match(html,/ร้านยืนยันคิว แล้วรับเครื่องหน้างาน/);
  assert.match(js,/footer_trust:"รับ–คืนหน้างาน · จองผ่าน LINE"/);
  assert.doesNotMatch(html,/FROM POSTER TO FRONT ROW/);
  assert.doesNotMatch(html,/ทัก LINE มาจองได้เลย/);
});
test('visual QA exposes zero-cost paid-provider policy and keeps optional OpenAI off without waiver',()=>{
  const source=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');
  assert.match(source,/openai_visual_review_requested:openAiConfig\.requested/);
  assert.match(source,/paid_external_ai_allowed:openAiConfig\.paid_external_ai_allowed/);
  assert.match(source,/zero_cost_mode:openAiConfig\.zero_cost_mode/);
  assert.match(source,/openai_visual_review_enabled:openAiConfig\.enabled/);
});


test('production storefront workflows derive the live asset marker from exact approved main',()=>{
  const prebuilt=fs.readFileSync('.github/workflows/storefront-v60-prebuilt-production.yml','utf8');
  const promote=fs.readFileSync('.github/workflows/storefront-v60-zero-cost-promote.yml','utf8');
  for(const source of [prebuilt,promote]){
    assert.equal(source.includes("marker=\"$(grep -oE"),true);
    assert.equal(source.includes('kk-storefront-v5\\.css\\?v='),true);
    assert.match(source,/STOREFRONT_MARKER/);
    assert.match(source,/grep -Fq "\$STOREFRONT_MARKER"/);
    assert.doesNotMatch(source,/v60-premium-editorial/);
  }
  assert.match(prebuilt,/git ls-remote origin refs\/heads\/main/);
  assert.match(prebuilt,/steps\.storefront\.outputs\.marker/);
  assert.match(prebuilt,/test -s assets\/kk-storefront-v5\.css/);
  assert.doesNotMatch(prebuilt,/V6\.0 — Premium Concert Editorial Commerce/);
  assert.match(promote,/steps\.runtime\.outputs\.marker/);
  assert.match(promote,/git diff --name-only "\$CANDIDATE_SHA" "\$APPROVED_SHA"/);
});


test('cached poster images receive backdrop treatment even without a native load event',()=>{
  const source=fs.readFileSync('script.js','utf8');
  const match=source.match(/function setImgFallback\(img, urls, options\)\{[\s\S]*?\n\}/);
  assert.ok(match,'setImgFallback source missing');
  const fallback=Function('setTimeout','clearTimeout',match[0]+';return setImgFallback;')(()=>1,()=>{});
  let applied=0,changedSrc=0;
  const img={
    complete:true,naturalWidth:750,naturalHeight:1000,
    style:{display:'block'},get src(){return 'cached-image.jpg';},
    set src(_value){changedSrc++;}
  };
  fallback(img,['cached-image.jpg'],{timeoutMs:1000,onLoaded:()=>{applied++;}});
  assert.equal(applied,1);
  assert.equal(changedSrc,0);
});
test('fresh poster load applies backdrop treatment exactly once and preserves source image',()=>{
  const source=fs.readFileSync('script.js','utf8');
  const match=source.match(/function setImgFallback\(img, urls, options\)\{[\s\S]*?\n\}/);
  assert.ok(match);
  const fallback=Function('setTimeout','clearTimeout',match[0]+';return setImgFallback;')(()=>1,()=>{});
  let loaded=0,src='';
  const img={
    complete:false,naturalWidth:0,naturalHeight:0,
    style:{display:'block'},get src(){return src;},
    set src(v){src=v;}
  };
  fallback(img,['official-poster.jpg'],{timeoutMs:1000,onLoaded:()=>{loaded++;}});
  assert.equal(src,'official-poster.jpg');
  img.complete=true;img.naturalWidth=750;img.naturalHeight=1000;
  img.onload();
  assert.equal(loaded,1);
  assert.equal(src,'official-poster.jpg');
  const card=source.slice(source.indexOf('var syncPosterTreatment=function()'),source.indexOf('var posterFailure=function()'));
  assert.match(card,/imgWrap\.classList\.add\("poster-has-image"\)/);
  assert.match(source,/onLoaded:syncPosterTreatment/);
});
test('last authoritative mobile stylesheet restores content-sized cards after historical global 100% heights',()=>{
  const css=fs.readFileSync('assets/kk-storefront-v5.css','utf8');
  const marker=css.lastIndexOf('V6.33');
  const oldRule=css.lastIndexOf('.concert-card{height:100%!important');
  assert.ok(marker>oldRule,'mobile override must follow the global 100% sizing rule');
  const finalCss=css.slice(marker);
  assert.match(finalCss,/@media \(max-width:700px\)/);
  assert.match(finalCss,/\.poster-grid \.concert-card\{[\s\S]*height:auto!important/);
  assert.match(finalCss,/\.poster-grid \.concert-card \.poster-info\{[\s\S]*height:auto!important/);
  assert.match(finalCss,/\.pi-tap\{[\s\S]*min-height:44px!important/);
  assert.doesNotMatch(finalCss,/object-fit:cover!important/);
});
