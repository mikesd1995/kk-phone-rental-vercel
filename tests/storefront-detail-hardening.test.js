'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('storefront day logic is pinned to Asia/Bangkok instead of browser local midnight', () => {
  assert.match(source, /timeZone:"Asia\/Bangkok"/);
  assert.match(source, /var TODAY_TS = bangkokMidnightTs\(bangkokDayKey\(new Date\(\)\)\)/);
  assert.match(source, /function concertTs\(c\)\{ var key=eventDateKey/);
});

test('storefront freshness label describes check time rather than claiming source update time', () => {
  assert.match(source, /updated_prefix:"ตรวจสอบข้อมูลเมื่อ"/);
  assert.match(source, /updated_prefix:"Data checked at"/);
  assert.match(source, /\(Bangkok\)/);
});

test('booking and waitlist LINE messages include event venue', () => {
  assert.match(source, /"📍 "\+tr\("line_venue"\)\+": "\+lineVal\(c&&c\.venue\)/);
  assert.match(source, /tr\("line_venue"\)\+" : "\+lineVal\(c&&c\.venue\)/);
});

test('source event notes stay available for internal processing but are never displayed in the public event modal', () => {
  assert.ok(source.includes('String(r.event_note||r.web_note||"").trim()'));
  const modal = source.slice(source.indexOf('function showModal(c,options){'), source.indexOf('var PACKAGE_CLOSE_SELECTOR'));
  assert.doesNotMatch(modal, /webNote|modal-event-note|sanitizePublicText|publicSubtitle|packageSpecForLanguage/);
});

test('month and availability filter choices can be reflected in the URL', () => {
  assert.match(source, /function syncBrowseUrl\(\)/);
  assert.match(source, /searchParams\.set\("filter",currentFilter\)/);
  assert.match(source, /searchParams\.set\("month",currentMonth\)/);
  assert.match(source, /setFilter\(b\.getAttribute\("data-filter"\)\|\|"all",\{updateUrl:true\}\)/);
});


test('verified promotion can expose inquiry-only events without inventing a price', () => {
  assert.match(source, /\[INQUIRY_ONLY\]/);
  assert.match(source, /if\(inquiryOnly\)\{ price=0; \}/);
  assert.match(source, /if\(price<=0 && !inquiryOnly\) avail = false;/);
  assert.match(source, /badge_inquiry:"สอบถามราคา"/);
  assert.match(source, /inquiry_available:"เช็กคิว \/ สอบถามราคากับร้าน"/);
  assert.match(source, /p\.inquiryOnly\?tr\("ask_this"\):tr\("book_this"\)/);
  assert.match(source, /\(p&&p\.inquiryOnly\)\?tr\("ask_price"\):fmtPriceLine/);
});


test('internal package notes never reach the customer modal', () => {
  assert.match(source, /function looksInternalPublicText\(raw\)/);
  assert.match(source, /capacity\\s\*\(\?:tight\|blocked\|readback\)/);
  assert.match(source, /function sanitizePublicText\(raw\)/);
  assert.doesNotMatch(source, /var publicSubtitle=packagePublicSubtitle\(p\)/);
  assert.doesNotMatch(source, /if\(p\.useCase\)\{var uEl=.*p\.useCase/);
  assert.doesNotMatch(source, /if\(p\.note\)\{var nEl=.*p\.note/);
});

test('modal package rows keep minimal content and separate phone booking from lens inquiry', () => {
  const modal = source.slice(source.indexOf('function showModal(c,options){'), source.indexOf('var PACKAGE_CLOSE_SELECTOR'));
  function element(){
    return {className:'',textContent:'',children:[],appendChild(child){this.children.push(child);},setAttribute(){}};
  }
  const nodes=Object.fromEntries(['modal-title','modal-date','modal-venue','phone-list'].map(id=>[id,element()]));
  const packages=[
    {type:'phone_only',model:'Phone example',price:690},
    {type:'phone_lens_bundle',model:'Phone and lens example',price:990},
    {type:'lens_only',model:'Lens example',price:200}
  ].map(pkg=>({...pkg,note:'INTERNAL_NOTE_SENTINEL',spec:'INTERNAL_SPEC_SENTINEL',useCase:'INTERNAL_USE_CASE_SENTINEL'}));
  // Run real row construction; stub only DOM and external/UI boundaries.
  vm.runInNewContext(modal+';showModal(eventFixture);',{
    document:{getElementById:id=>nodes[id],querySelectorAll:()=>[],createElement:element},
    eventFixture:{id:'EVENT_FIXTURE',name:'Public event',date:'10/11/2026',venue:'Public venue',packages},
    currentLang:'en',activeModalEvent:null,track(){},updateMetaForEvent(){},setEventUrl(){},openModal(){},
    availPkgs:event=>event.packages,availCnt:()=>2,tr:key=>key,toNum:Number,numberLocale:()=>'en-US',
    getBookingUrl:(event,pkg)=>'phone:'+pkg.model,
    getExistingRenterLensUrl:(event,pkg)=>'lens-add-on:'+pkg.model
  });
  const rows=nodes['phone-list'].children;
  assert.equal(rows.length,3);
  const expectedRoutes=['phone:Phone example','phone:Phone and lens example','lens-add-on:Lens example'];
  function renderedText(node){return [node.textContent,...node.children.map(renderedText)].join(' ');}
  rows.forEach((row,index)=>{
    assert.equal(row.className,'phone-row');
    assert.deepEqual(row.children.map(child=>child.className),['ph-icon','ph-info','ph-right']);
    assert.equal(row.children[1].children.length,1);
    assert.equal(row.children[1].children[0].className,'ph-model');
    assert.equal(row.children[1].children[0].textContent,packages[index].model);
    assert.deepEqual(row.children[2].children.map(child=>child.className),['ph-price','badge book-pill']);
    assert.equal(row.children[2].children[0].textContent,String(packages[index].price));
    assert.equal(row.children[2].children[1].href,expectedRoutes[index]);
    assert.doesNotMatch(renderedText(row),/INTERNAL_(?:NOTE|SPEC|USE_CASE)_SENTINEL/);
  });
});

test('event modal contains only name, date, venue, and availability-based packages', () => {
  const modal = source.slice(source.indexOf('function showModal(c,options){'), source.indexOf('var PACKAGE_CLOSE_SELECTOR'));
  assert.ok(modal.includes('getElementById("modal-title")'));
  assert.ok(modal.includes('getElementById("modal-date")'));
  assert.ok(modal.includes('getElementById("modal-venue")'));
  assert.ok(modal.includes('availPkgs(c)'));
  assert.doesNotMatch(modal, /eventNoteEl|publicEventNote/);
  assert.ok(modal.includes('fullBox.textContent=tr("full_title")'));
  assert.doesNotMatch(modal, /full_body/);
});


test('all explicitly hidden package rows keep the event online as waitlist', () => {
  assert.match(source, /var pkgMap=\{\}, pkgPresence=\{\};/);
  assert.match(source, /pkgPresence\[id\]=true;/);
  assert.match(source, /var hasPkgSheet = !!pkgPresence\[eventId\];/);
  assert.match(source, /Package visibility and event visibility are separate concerns/);
  assert.doesNotMatch(source, /hiddenByPackages/);
  assert.match(source, /if\(currentFilter==="full"\)\s+return vis\.filter\(function\(c\)\{return availCnt\(c\)===0;\}\);/);
  assert.match(source, /if\(!avail\) track\("waitlist_card_open"/);
  assert.match(source, /showModal\(c\);/);
  assert.doesNotMatch(source, /waitlist_card_click/);
});


test('browser sanitizer blocks observed machine tokens while preserving customer copy', () => {
  const start = source.indexOf('function looksInternalPublicText(raw){');
  const end = source.indexOf('function packagePublicSubtitle(p){', start);
  assert.ok(start >= 0 && end > start);
  const sanitizer = Function(source.slice(start, end) + '; return sanitizePublicText;')();

  for (const token of [
    'WEEKDAY_FALLBACK_HIGH_FANDOM_2026-09-28',
    'OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION',
    'EXACT_EVENT_COMPETITOR_690_2026-09-28',
    'PROVISIONAL_MARKET_BENCHMARK_2026-09-28',
    'PROVISIONAL_BIG_EVENT_COLLISION_2026-09-28',
    'WEEKDAY_FANDOM_TIER_2026-09-28',
  ]) {
    assert.equal(sanitizer(token), '');
  }
  assert.equal(sanitizer('เหมาะกับถ่ายเวทีไกล ซูมชัด'), 'เหมาะกับถ่ายเวทีไกล ซูมชัด');
});


