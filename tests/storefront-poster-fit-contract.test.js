'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evidence=require('../scripts/storefront-evidence.cjs');
const root=path.resolve(__dirname,'..');
const base=fs.readFileSync(path.join(root,'style.css'),'utf8');
const active=fs.readFileSync(path.join(root,'assets','kk-storefront-v5.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const witness=fs.readFileSync(path.join(root,'scripts','storefront-evidence.cjs'),'utf8');

test('full poster in active and fallback card styles without hover cropping',()=>{
  assert.ok(html.indexOf('href="style.css')>=0);
  assert.ok(html.indexOf('kk-storefront-v5.css')>html.indexOf('href="style.css'));
  const activeRule=active.match(/\.poster-img-wrap img\s*\{([^}]*)\}/);
  assert.ok(activeRule);
  assert.match(activeRule[1],/object-fit:contain!important/);
  assert.match(base,/\.poster-img-wrap img\{[^}]*object-fit:contain/);
  assert.match(base,/\.concert-card:hover \.poster-img-wrap img\{transform:none\}/);
  assert.doesNotMatch(activeRule[1],/object-fit:cover/);
});

test('future modal image uses contain while current compact modal intentionally hides artwork',()=>{
  assert.match(base,/\.modal-poster-wrap img\{[^}]*object-fit:contain/);
  assert.match(base,/#modal-poster-wrap,\.modal-poster-wrap\{display:none!important;\}/);
  assert.doesNotMatch(base,/\.modal-poster-wrap img\{[^}]*object-fit:cover/);
  assert.match(witness,/const modalPosterFitIssues=/);
  assert.match(witness,/MODAL_POSTER_ARTWORK_CROPPED/);
});
test('successful image state retains contain with background treatment',()=>{
  assert.match(active,/\.poster-img-wrap\.poster-has-image>img\s*\{[^}]*object-fit:contain!important/);
  assert.match(active,/\.poster-img-wrap\.poster-has-image::before\s*\{[^}]*background-image:var\(--poster-bg\)!important/);
});
test('rendered card detector fails closed when poster computed style crops',()=>{
  assert.match(witness,/const posterFitIssues=cards\.flatMap/);
  assert.match(witness,/getComputedStyle\(img\)\.objectFit/);
  assert.match(witness,/poster_fit_issues:posterFitIssues/);
  const rendered={document_width:390,raw_i18n_keys:[],small_targets:[],card_columns:2,
    column_widths:[176,176],card_height_spread_px:0,poster_frame_ratios:[0.75,0.75],
    escaped_card_elements:[],poster_source_issues:[],poster_treatment_issues:[],
    poster_fit_issues:[{event_id:'e1',object_fit:'cover'}],theme_icons:1,modal:null};
  const flagged=Evidence.stateFindings(rendered,{width:390,name:'catalogue'});
  assert.ok(flagged.some(f=>f.code==='POSTER_ARTWORK_CROPPED'));
  assert.ok(!Evidence.stateFindings({...rendered,poster_fit_issues:[]},{width:390,name:'catalogue'}).some(f=>f.code==='POSTER_ARTWORK_CROPPED'));
});
test('rendered modal detector refuses cropping',()=>{
  const baseState={document_width:390,raw_i18n_keys:[],small_targets:[],clipped_controls:[],overlapping_filters:false,modal_poster_fit_issues:[{object_fit:'cover'}],modal:{left:0,right:390,top:10,bottom:760,viewport_height:800,scroll_width:390,client_width:390,focus_inside:true,title:'Concert',package_count:2}};
  assert.ok(Evidence.stateFindings(baseState,{width:390,name:'modal'}).some(f=>f.code==='MODAL_POSTER_ARTWORK_CROPPED'));
  assert.ok(!Evidence.stateFindings({...baseState,modal_poster_fit_issues:[]},{width:390,name:'modal'}).some(f=>f.code==='MODAL_POSTER_ARTWORK_CROPPED'));
});

test('failed live poster assets block release even when CSS uses contain',()=>{
  const state={document_width:390,raw_i18n_keys:[],small_targets:[],card_columns:2,
    column_widths:[172,172],card_height_spread_px:0,poster_frame_ratios:[],
    escaped_card_elements:[],poster_source_issues:[],poster_fit_issues:[],poster_treatment_issues:[],
    failed_posters:1,failed_poster_details:[{event_id:'demo',fallback_mode:'brand'}],theme_icons:1,modal:null};
  const codes=Evidence.stateFindings(state,{width:390,name:'catalogue'}).map(f=>f.code);
  assert.ok(codes.includes('POSTER_IMAGE_LOAD_FAILED'));
  const goodCodes=Evidence.stateFindings({...state,failed_posters:0,failed_poster_details:[]},{width:390,name:'catalogue'}).map(f=>f.code);
  assert.ok(!goodCodes.includes('POSTER_IMAGE_LOAD_FAILED'));
});

test('crop witness is responsive across eight target viewport widths',()=>{
  const widths=[320,375,390,430,480,768,1024,1440];
  for(const width of widths){
    const state={document_width:width,raw_i18n_keys:[],small_targets:[],
      card_columns:width<359?1:2,column_widths:width<359?[width-20]:[(width-24)/2,(width-24)/2],
      card_height_spread_px:0,poster_frame_ratios:[0.75],escaped_card_elements:[],
      poster_source_issues:[],poster_fit_issues:[{event_id:'demo',object_fit:'cover'}],
      poster_treatment_issues:[],failed_posters:0,theme_icons:1,modal:null};
    const flagged=Evidence.stateFindings(state,{width,name:'catalogue'});
    assert.ok(flagged.some(f=>f.code==='POSTER_ARTWORK_CROPPED'),'width='+width);
    const fixed=Evidence.stateFindings({...state,poster_fit_issues:[]},{width,name:'catalogue'});
    assert.ok(!fixed.some(f=>f.code==='POSTER_ARTWORK_CROPPED'),'width='+width);
  }
});
