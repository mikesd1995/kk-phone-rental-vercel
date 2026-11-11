'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const adminHtml=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const adminJs=fs.readFileSync(path.join(root,'admin','admin.js'),'utf8');
const adminCss=fs.readFileSync(path.join(root,'admin','admin.css'),'utf8');
const storeHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const storeJs=fs.readFileSync(path.join(root,'script.js'),'utf8');
const publicData=require('../api/kk-data.js');

test('booking cancellation cannot fall through to native form navigation',()=>{
  assert.match(adminJs,/qsa\("\[data-bulk-event-visibility\]", overrideForm\)\.forEach/);
  assert.doesNotMatch(adminJs,/\$\("\[data-bulk-event-visibility\]", overrideForm\)\.forEach/);
  assert.match(adminJs,/bookingEditForm\.addEventListener\("submit",async ev=>\{\s*ev\.preventDefault\(\)/);
  assert.match(adminJs,/activateTab\("edit-booking",\{scroll:false,writeHash:true\}\)/);
  assert.match(adminJs,/const requestedTab=String\(location\.hash\|\|""\)/);
});

test('Admin Event Control Center exposes batch-safe operational visibility management',()=>{
  assert.match(adminHtml,/id="eventControlTable"/);
  assert.match(adminHtml,/data-event-control-batch="hide_packages"/);
  assert.match(adminHtml,/data-event-control-batch="hide_events"/);
  assert.match(adminJs,/function renderEventControlCenter\(\)/);
  assert.match(adminJs,/if\(ids\.length>12\)/);
  assert.match(adminHtml,/id="eventControlMonth"/);
  assert.match(adminHtml,/id="eventControlSort"/);
  assert.match(adminHtml,/id="eventControlStickyActions"/);
  assert.match(adminJs,/bulkSetEventPackageVisibility/);
  assert.match(adminJs,/eventVisibilityPayload\(id,kind==="show_events"\)/);
  assert.match(adminCss,/event-control-center/);
});

test('Admin hard caps are progressive instead of silently truncating operational lists',()=>{
  assert.match(adminJs,/actionLimit:60/);
  assert.match(adminJs,/eventLimit:50/);
  assert.match(adminJs,/bookingLimit:50/);
  assert.match(adminJs,/pricingLimit:120/);
  assert.match(adminHtml,/id="actionLoadMoreBtn"/);
  assert.match(adminHtml,/id="eventsLoadMoreBtn"/);
  assert.match(adminHtml,/id="bookingsLoadMoreBtn"/);
  assert.match(adminHtml,/id="pricingLoadMoreBtn"/);
  assert.match(adminJs,/shownActionRows\.slice\(0,state\.actionLimit\)/);
  assert.match(adminJs,/openEventRows\.slice\(0,state\.eventLimit\)/);
  assert.match(adminJs,/bookingRows\.slice\(0,state\.bookingLimit\)/);
});

test('Admin operational tables expose mobile card labels and advanced pricing collapses',()=>{
  assert.match(adminJs,/data-label="/);
  assert.match(adminCss,/#eventControlTable td::before/);
  assert.match(adminCss,/#actionTable td::before/);
  assert.match(adminHtml,/class="advanced-pricing-details"/);
});

test('Storefront full cards open detail first and waitlist price is semantic',()=>{
  assert.match(storeJs,/if\(!avail\) track\("waitlist_card_open"/);
  assert.match(storeJs,/showModal\(c\);/);
  assert.match(storeJs,/if\(availCnt\(c\)<=0\) return tr\("card_waitlist"\)/);
  assert.match(storeJs,/card_waitlist:"คิวเต็ม · เปิดรับจองคิวหลุด"/);
});

test('Storefront progressively renders 24 events and captures search misses',()=>{
  assert.match(storeJs,/var BROWSE_PAGE_SIZE = 24/);
  assert.match(storeJs,/var page=vis\.slice\(0,browseLimit\)/);
  assert.match(storeJs,/browseLimit\+=BROWSE_PAGE_SIZE/);
  assert.match(storeJs,/function getSearchInquiryUrl\(query\)/);
  assert.match(storeJs,/track\("search_no_result"/);
});

test('Storefront event modal remains minimal while contextual LINE booking works',()=>{
  assert.doesNotMatch(storeHtml,/id="event-share-btn"|id="modal-note"|id="modal-event-note"/);
  assert.ok(!storeJs.includes('document.getElementById("event-share-btn")'));
  assert.ok(storeJs.includes('var waitlisted=availCnt(c)<=0'));
  assert.ok(storeJs.includes('a.href=waitlisted?getWaitlistUrl(c,null):getEventInquiryUrl(c)'));
  assert.match(storeJs,/event_inquiry_click/);
  assert.ok(storeHtml.includes('script.js?v=phone-lens-safety-20261111'));
});

test('Public feed drops parseable past events by default and can opt into showPast',()=>{
  const eventCsv=[
    'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
    'EVT-20260920-OLD,Old,20/09/2026,V,p,,0,0,เต็มแล้ว,show_full,x',
    'EVT-20260926-TODAY,Today,26/09/2026,V,p,,1,1,เปิดจอง,show,x',
    'EVT-20261001-FUTURE,Future,01/10/2026,V,p,,1,1,เปิดจอง,show,x'
  ].join('\n');
  const filtered=publicData._test.filterPastPublicCsv('08_Web_Ready',eventCsv,{now:new Date('2026-09-26T00:00:00+07:00')});
  assert.equal(filtered.dropped,1);
  assert.doesNotMatch(filtered.text,/EVT-20260920-OLD/);
  assert.match(filtered.text,/EVT-20260926-TODAY/);
  assert.match(filtered.text,/EVT-20261001-FUTURE/);
  const debug=publicData._test.filterPastPublicCsv('08_Web_Ready',eventCsv,{showPast:true,now:new Date('2026-09-26T00:00:00+07:00')});
  assert.equal(debug.dropped,0);
  assert.match(debug.text,/EVT-20260920-OLD/);
});


test('search-miss analytics are debounced and deduplicated',()=>{
  assert.match(storeJs,/function queueSearchMissTrack\(query\)/);
  assert.match(storeJs,/normalized\.length<3/);
  assert.match(storeJs,/now-LAST_SEARCH_MISS\.at<30000/);
  assert.match(storeJs,/queueSearchMissTrack\(currentSearch\)/);
  assert.doesNotMatch(storeJs,/if\(contextual\) track\("search_no_result"/);
});

test('LINE journeys keep internal attribution out of customer-facing copy',()=>{
  assert.doesNotMatch(storeJs,/function leadRef\(kind,c,p\)/);
  assert.doesNotMatch(storeJs,/Ref\s*:\s*"?\s*\+?\s*leadRef/);
  assert.doesNotMatch(storeJs,/KK-(?:BK|WL|EV|SRCH)-/);
  assert.doesNotMatch(adminHtml,/name="lead_ref"/);
  assert.doesNotMatch(adminJs,/payload\.lead_ref|\[LEAD_REF:/);
  const messageStart=storeJs.indexOf('function buildBookingMsg(c,p){');
  const messageEnd=storeJs.indexOf('function showModal(c,options){',messageStart);
  const buttonStart=storeJs.indexOf('var bookBtn=document.createElement("a"); bookBtn.className="badge book-pill";');
  const buttonEnd=storeJs.indexOf('right.appendChild(priceEl);',buttonStart);
  assert.ok(messageStart>=0 && messageEnd>messageStart && buttonStart>=0 && buttonEnd>buttonStart);
  // Execute the production message builders and button dispatch, without opening LINE.
  const makeButton=Function('c','p','track',`
    var LINE_OA="https://line.me/R/oaMessage/%40fixture/?", currentLang="th";
    var tr=function(key){return {line_event:"Event",line_date:"Date",line_venue:"Venue",line_price:"Price"}[key]||key;};
    var lineVal=function(value){return String(value||"").trim()||"-";};
    var fmtPriceLine=function(value){return String(value)+" THB";};
    var document={createElement:function(){return {setAttribute:function(){}};}};
    ${storeJs.slice(messageStart,messageEnd)}
    ${storeJs.slice(buttonStart,buttonEnd)}
    return bookBtn;
  `);
  const event={id:'EVENT_FIXTURE',name:'Public event',date:'10/11/2026',venue:'Public venue',internalRef:'KK-BK-PRIVATE'};
  for(const fixture of [
    {type:'phone_only',model:'Phone example',event:'booking_click',source:'modal',intent:'สนใจเช่ามือถือ'},
    {type:'phone_lens_bundle',model:'Phone and lens example',event:'booking_click',source:'modal',intent:'สนใจเช่ามือถือ'},
    {type:'lens_only',model:'Lens example',event:'lens_addon_inquiry_click',source:'modal_existing_renter_lens',intent:'สอบถามเพิ่มเลนส์สำหรับผู้จองมือถือแล้ว'}
  ]){
    const pkg={type:fixture.type,model:fixture.model,price:690,note:'[LEAD_REF:PRIVATE]'};
    const clicks=[];
    const button=makeButton(event,pkg,(name,params)=>clicks.push({name,params}));
    button.onclick({stopPropagation(){}});
    assert.deepEqual(clicks,[{name:fixture.event,params:{
      event_id:'EVENT_FIXTURE',event_name:'Public event',package_type:fixture.type,
      package:fixture.model,price:690,source:fixture.source
    }}]);
    assert.ok(button.href.startsWith('https://line.me/R/oaMessage/%40fixture/?'));
    const message=decodeURIComponent(button.href.split('/?')[1]);
    assert.equal(message.split('\n')[0],fixture.intent);
    assert.ok(message.includes(fixture.model));
    assert.ok(message.includes('Event: Public event'));
    assert.ok(message.includes('Venue: Public venue'));
    assert.ok(message.includes('ยืนยันยอมรับเงื่อนไขการเช่า KK Phone Rental (KK-TERMS-2026-11-06)'));
    assert.ok(message.includes('https://kk-phone-rental.vercel.app/privacy/'));
    assert.doesNotMatch(message,/KK-(?:BK|WL|EV|SRCH)-|\[LEAD_REF:|\blead_ref\b|Ref\s*:/i);
    if(fixture.type==='lens_only'){
      assert.ok(message.includes('รหัสจองมือถือเดิม:'));
      assert.doesNotMatch(message,/สนใจเช่ามือถือ|📱 รุ่น:/);
    }else{
      assert.ok(message.includes('📱 รุ่น: '+fixture.model));
      assert.doesNotMatch(message,/รหัสจองมือถือเดิม:/);
    }
  }
  assert.match(storeJs,/track\("waitlist_click",\{event_id:c\.id\|\|"", event_name:c\.name, available:0, source:"modal"\}/);
  assert.match(storeJs,/event_inquiry_click/);
  assert.match(storeJs,/search_inquiry_click/);
});

test('analytics remains opt-in until a real Measurement ID is supplied',()=>{
  const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
  assert.match(config,/ga4Id:\s*"G-XXXXXXXXXX"/);
  assert.doesNotMatch(config,/^\s*ga4Id:\s*"G-[A-Z0-9]+"\s*,?/m);
});
