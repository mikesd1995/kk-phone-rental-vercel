'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const E=require('../scripts/storefront-evidence.cjs');
test('image cache reuses only same-URL successfully delivered image bytes, never a failed response',()=>{
  const cache=E.imageResponseCache(),body=Buffer.from('delivered-image');
  assert.equal(cache.remember('https://images.example/a',503,{'content-type':'image/png'},body),false);
  assert.equal(cache.remember('https://images.example/a',200,{'content-type':'text/html'},body),false);
  assert.equal(cache.get('https://images.example/a'),undefined);
  assert.equal(cache.remember('https://images.example/a',200,{'content-type':'image/png'},body),true);
  assert.equal(cache.get('https://images.example/a').body,body);
  assert.equal(cache.get('https://images.example/b'),undefined);
  assert.equal(cache.evidence()[0].sha256,E.hash(body));
  const first=cache.get('https://images.example/a');
  cache.remember('https://images.example/a',200,{'content-type':'image/png'},Buffer.from('later-replay'));
  assert.equal(cache.get('https://images.example/a'),first);
  assert.equal(cache.evidence()[0].sha256,E.hash(body));
});


test('card column geometry counts horizontal lanes even when card tops are staggered',()=>{
  const two=E.cardColumnGeometry([
    {left:16.00,top:420,width:216.0},
    {left:248.02,top:426.5,width:216.0},
    {left:16.35,top:690,width:216.1},
    {left:247.70,top:701,width:215.9}
  ]);
  assert.equal(two.card_columns,2);
  assert.equal(two.column_widths.length,2);
  assert.ok(Math.abs(two.column_widths[0]-two.column_widths[1])<1);

  const one=E.cardColumnGeometry([
    {left:12,top:300,width:296},
    {left:12.4,top:610,width:296},
    {left:11.8,top:925,width:296}
  ]);
  assert.equal(one.card_columns,1);

  const three=E.cardColumnGeometry([
    {left:20,top:300,width:180},
    {left:216,top:301,width:180},
    {left:412,top:307,width:180}
  ]);
  assert.equal(three.card_columns,3);
});

test('card column geometry ignores invalid or zero-width rectangles',()=>{
  const out=E.cardColumnGeometry([
    null,
    {left:10,width:0},
    {left:Number.NaN,width:100},
    {left:12,width:170},
    {left:190,width:170}
  ]);
  assert.equal(out.card_columns,2);
  assert.deepEqual(out.column_widths,[170,170]);
});

const healthy=()=>({document_width:390,raw_i18n_keys:[],small_targets:[],card_columns:2,column_widths:[176,176],card_height_spread_px:0,poster_frame_ratios:[0.75,0.75],escaped_card_elements:[],poster_source_issues:[],poster_treatment_issues:[],theme_icons:1,modal:null});
test('rendered defects fail even when the document itself has no horizontal overflow',()=>{
  assert.deepEqual(E.stateFindings(healthy(),{width:390,name:'top'}),[]);
  for(const change of [{card_columns:1},{overlapping_filters:true},{clipped_controls:['filter-full']},{column_widths:[176,190]},{escaped_card_elements:['pi-price']},{poster_treatment_issues:[{event_id:'evt',coverage:.61,treatment:'missing'}]},{theme_icons:2},{small_targets:[{id:'theme',width:42,height:44}]},{raw_i18n_keys:['journey_1_title']}]){
    assert.ok(E.stateFindings({...healthy(),...change},{width:390,name:'english'}).length,JSON.stringify(change));
  }
});
test('modal clipping, horizontal overflow and focus escape are release blocking',()=>{
  const modal={left:0,right:390,top:150,bottom:844,viewport_height:844,scroll_width:390,client_width:390,focus_inside:true,title:'Event'};
  assert.deepEqual(E.stateFindings({...healthy(),modal},{width:390,name:'modal'}),[]);
  for(const change of [{bottom:850},{scroll_width:420},{focus_inside:false},{title:''}])assert.ok(E.stateFindings({...healthy(),modal:{...modal,...change}},{width:390,name:'modal'}).length);
});
test('owner direction approval cannot accept a rendered candidate or changed dependency digest',()=>{
  const widths=[320,375,390,430,480,768,1024,1440];
  const record={status:'PASS',owner_decision:'ACCEPTED',acceptance_scope:'rendered_candidate',frontend_digest:'a',artifacts:widths.flatMap(width=>['top','catalogue','modal','footer','dark','english','english-modal','dark-modal'].map(state=>({width,state,sha256:'f'.repeat(64)})))};
  assert.equal(E.ownerApprovalValid(record,{digest:'a'},widths,record.artifacts),true);
  assert.equal(E.ownerApprovalValid(record,{digest:'changed'},widths,record.artifacts),false);
  assert.equal(E.ownerApprovalValid({...record,acceptance_scope:'mock_direction'},{digest:'a'},widths,record.artifacts),false);
  assert.equal(E.ownerApprovalValid({...record,artifacts:record.artifacts.filter(x=>x.width!==1440)},{digest:'a'},widths,record.artifacts),false);
  assert.equal(E.ownerApprovalValid(record,{digest:'a'},widths,record.artifacts.map(x=>({...x,sha256:'0'.repeat(64)}))),false);
  assert.equal(E.ownerApprovalValid(record,{digest:'a'},widths),false);
});
test('gateway executes real reviewer, bootstraps memory and persists exact local invocation readback',async()=>{
  const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-evidence-'));
  try{
    const out=await E.invokeWithEvidence('storefront_ux_review',{viewport:{width:390,height:844},metrics:{raw_i18n_key_count:1}},{outputDir,sourceSha:'a'.repeat(40),identity:{digest:'b'.repeat(64)}});
    assert.equal(out.status,'RECORDED');
    assert.equal(out.project_memory.status,'READY');
    assert.equal(out.ledger.scope,'LOCAL_ARTIFACT');
    assert.equal(out.ledger.readback_verified,true);
    const bytes=fs.readFileSync(path.join(outputDir,out.ledger.file),'utf8');
    assert.equal(E.hash(bytes),out.ledger.sha256);
    assert.equal(JSON.parse(bytes).record.source_commit_sha,'a'.repeat(40));
    assert.ok(out.result.findings.some(f=>f.code==='RAW_I18N_KEY_VISIBLE'));
  }finally{fs.rmSync(outputDir,{recursive:true,force:true});}
});


test('desktop card geometry blocks uneven heights and poster rails outside the visual contract',()=>{
  const base={...healthy(),document_width:1440,card_height_spread_px:0,poster_frame_ratios:[0.75,0.75]};
  assert.deepEqual(E.stateFindings(base,{width:1440,name:'catalogue'}),[]);
  assert.ok(E.stateFindings({...base,card_height_spread_px:3.2},{width:1440,name:'catalogue'}).some(x=>x.code==='CARD_HEIGHT_MISMATCH'));
  assert.ok(E.stateFindings({...base,poster_frame_ratios:[0.75,0.64]},{width:1440,name:'catalogue'}).some(x=>x.code==='POSTER_FRAME_RATIO_MISMATCH'));
});


test('storefront visual evidence blocks webpage screenshots used as poster artwork',()=>{
  const state={...healthy(),poster_source_issues:[{event_id:'evt',poster_source:'https://image.thum.io/get/width/1200/https://tickets.example/event',reason:'webpage_screenshot_service'}]};
  assert.ok(E.stateFindings(state,{width:390,name:'catalogue'}).some(x=>x.code==='POSTER_SOURCE_NOT_ARTWORK'));
});

test('centered mobile dialog requires physical centering, safety clearance and focus',()=>{
 const centered={left:14,right:376,top:111,bottom:733,viewport_height:844,alignment:'center',scroll_width:362,client_width:362,focus_inside:true,title:'Event'};
 assert.deepEqual(E.stateFindings({...healthy(),modal:centered},{width:390,name:'modal'}),[]);
 for(const bad of [{top:50,bottom:672},{alignment:'flex-start'},{top:1,bottom:843},{top:-2,bottom:842},{focus_inside:false},{scroll_width:390}]){
   assert.ok(E.stateFindings({...healthy(),modal:{...centered,...bad}},{width:390,name:'modal'}).length,JSON.stringify(bad));
 }
});
