'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evidence=require('../scripts/storefront-evidence.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const v5=read('assets/kk-storefront-v5.css');
const hero=read('assets/kk-hero-premium-20261013.css');
const fallback=read('style.css');
const script=read('script.js');
const healthy=(width=390)=>({document_width:width,raw_i18n_keys:[],small_targets:[],
  card_columns:width<359?1:2,column_widths:width<359?[296]:[170,170],
  card_height_spread_px:0,poster_frame_ratios:[.75,.75],escaped_card_elements:[],
  poster_source_issues:[],poster_treatment_issues:[],poster_fit_issues:[],
  modal_poster_fit_issues:[],theme_icons:1,modal:null,failed_posters:0,failed_poster_details:[]});

test('integrated stylesheet order retains live Hero and full poster containment',()=>{
  assert.ok(html.indexOf('kk-hero-premium-20261013.css')>html.indexOf('kk-storefront-v5.css'));
  assert.equal(html.split('kk-hero-premium-20261013.css').length-1,1);
  assert.match(v5,/\.poster-img-wrap img\s*\{[^}]*object-fit:contain!important/);
  assert.match(fallback,/\.poster-img-wrap img\{[^}]*object-fit:contain/);
  assert.match(fallback,/\.concert-card:hover \.poster-img-wrap img\{transform:none\}/);
  assert.match(hero,/background-image:url\('\/assets\/kk-hero-product-20261013\.webp'\)!important/);
});

test('poster cached-pixel success and audited wrong-art fallback coexist',()=>{
  assert.match(script,/function imageHasPixels\(\)/);
  assert.match(script,/if\(imageHasPixels\(\) && typeof options\.onLoaded==="function"\)/);
  assert.match(script,/onLoaded:syncPosterTreatment,onExhausted:posterFailure/);
  assert.match(script,/function isAuditedNonEventPoster\(eventId,url\)/);
  assert.match(script,/EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY/);
  assert.match(script,/EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI/);
  assert.match(script,/EVT-20261030-POPPAH4-HALLOWEEN-NAMP/);
  assert.match(script,/var auditedNonEventPoster=isAuditedNonEventPoster\(c\.id,c\.rawPoster\|\|c\.img\)/);
  assert.match(script,/if\(auditedNonEventPoster\|\|brandPlaceholder\)/);
  assert.match(script,/card\.dataset\.posterSourceRejected=auditedNonEventPoster\?"wrong-event-art":"shop-placeholder"/);
  assert.match(script,/imgWrap\.appendChild\(eventSummaryFallback\(\)\)/);
  assert.doesNotMatch(script,/Temporary artist profile, not event poster:/);
  assert.doesNotMatch(script,/ภาพศิลปินชั่วคราว ไม่ใช่โปสเตอร์งาน:/);
});

test('integrated visual evidence fails closed on crop and image failure without false positives',()=>{
  for(const width of [320,375,390,430,480,768,1024,1440]){
    const s=healthy(width);
    const clean=Evidence.stateFindings(s,{width,name:'catalogue'}).map(x=>x.code);
    assert.ok(!clean.includes('POSTER_ARTWORK_CROPPED'));
    const crop=Evidence.stateFindings({...s,poster_fit_issues:[{object_fit:'cover'}]},{width,name:'catalogue'}).map(x=>x.code);
    assert.ok(crop.includes('POSTER_ARTWORK_CROPPED'),'width='+width);
    const broken=Evidence.stateFindings({...s,failed_posters:1,failed_poster_details:[{event_id:'test'}]},{width,name:'catalogue'}).map(x=>x.code);
    assert.ok(broken.includes('POSTER_IMAGE_LOAD_FAILED'),'width='+width);
  }
});

test('centered owner modal remains valid; bottom sheet and photo crop do not',()=>{
  const s=healthy(390);
  const m={left:14,right:376,top:168,bottom:676,viewport_height:844,
    scroll_width:362,client_width:362,focus_inside:true,title:'Verified concert'};
  assert.deepEqual(Evidence.stateFindings({...s,modal:m},{width:390,name:'modal'}),[]);
  assert.ok(Evidence.stateFindings({...s,modal:{...m,top:330,bottom:838}},{width:390,name:'modal'}).some(x=>x.code==='MOBILE_MODAL_NOT_CENTERED'));
  assert.ok(Evidence.stateFindings({...s,modal:m,modal_poster_fit_issues:[{object_fit:'cover'}]},{width:390,name:'modal'}).some(x=>x.code==='MODAL_POSTER_ARTWORK_CROPPED'));
  assert.ok(Evidence.stateFindings({...s,modal:{...m,focus_inside:false}},{width:390,name:'modal'}).some(x=>x.code==='MODAL_FOCUS_ESCAPED'));
});

test('release safeguards reject unbound visual owner approval',()=>{
  const widths=[320,375,390,430,480,768,1024,1440];
  const record={status:'PASS',owner_decision:'ACCEPTED',acceptance_scope:'mock_direction',
    frontend_digest:'older',artifacts:[]};
  assert.equal(Evidence.ownerApprovalValid(record,{digest:'new'},widths,[]),false);
  assert.equal(Evidence.ownerApprovalValid({...record,acceptance_scope:'rendered_candidate'}, {digest:'new'},widths,[]),false);
});
