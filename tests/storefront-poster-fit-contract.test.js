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

test('active V6 layer never crops an event poster, including before poster-has-image',()=>{
  assert.ok(html.indexOf('href="style.css')>=0);
  assert.ok(html.indexOf('kk-storefront-v5.css')>html.indexOf('href="style.css'));
  const activeRule=active.match(/\.poster-img-wrap img\s*\{([^}]*)\}/);
  assert.ok(activeRule,'missing V6 base poster rule');
  assert.match(activeRule[1],/object-fit:contain!important/);
  assert.doesNotMatch(active,/object-fit:cover!important/);
  assert.match(base,/\.poster-img-wrap img\{[^}]*object-fit:contain/);
  assert.match(base,/\.concert-card:hover \.poster-img-wrap img\{transform:none\}/);
});

test('successfully loaded poster keeps the independent contain treatment',()=>{
  assert.match(active,/\.poster-img-wrap\.poster-has-image>img\s*\{[^}]*object-fit:contain!important/);
  assert.match(active,/\.poster-img-wrap\.poster-has-image::before\s*\{[^}]*background-image:var\(--poster-bg\)!important/);
});

test('rendered visual evidence blocks cropped artwork, not only untreated letterboxing',()=>{
  assert.match(witness,/const posterFitIssues=cards\.flatMap/);
  assert.match(witness,/getComputedStyle\(img\)\.objectFit/);
  assert.match(witness,/poster_fit_issues:posterFitIssues/);
  const rendered={document_width:390,raw_i18n_keys:[],small_targets:[],card_columns:2,
    column_widths:[176,176],card_height_spread_px:0,poster_frame_ratios:[0.75,0.75],
    escaped_card_elements:[],poster_source_issues:[],poster_treatment_issues:[],
    poster_fit_issues:[{event_id:'e1',object_fit:'cover'}],theme_icons:1,modal:null};
  assert.ok(Evidence.stateFindings(rendered,{width:390,name:'catalogue'}).some(f=>f.code==='POSTER_ARTWORK_CROPPED'));
  assert.ok(!Evidence.stateFindings({...rendered,poster_fit_issues:[]},{width:390,name:'catalogue'}).some(f=>f.code==='POSTER_ARTWORK_CROPPED'));
});
