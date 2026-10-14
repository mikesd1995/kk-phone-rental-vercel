'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../server/admin-sheet-fallback.js');

test('private values parser locates header and rows',()=>{
  const rows=F.valuesAsObjects([['title'],[],['id','name'],['1','A']],'id');
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'1');
  assert.equal(rows[0].name,'A');
  assert.equal(rows[0].__row_number,4);
  assert.equal(rows[0].__row_number,4);
});

test('private-reader-required fails closed when credentials are absent',async()=>{
  await assert.rejects(
    ()=>F.buildSnapshot({sheetId:'sheet',env:{KK_ADMIN_FALLBACK_REQUIRE_PRIVATE:'1'},fetchImpl:async()=>{throw new Error('network should not run');}}),
    /required but not configured/i
  );
});

test('public reader remains transitional fallback when private reader is absent',async()=>{
  const csv={
    '01_Events':'"event_id","event_name","event_date","venue","poster_image_url","event_status","active_on_web","event_note","data_health"\n"EV1","Test","19/09/2026","V","","open","TRUE","","OK"\n',
    '00_Master_Booking':'"booking_id","created_at","booking_status","event_id","customer_name","customer_contact","customer_phone","channel","package_type","phone_asset_id","lens_asset_id","pickup_time","return_time","payment_status","amount_received","return_status","file_transfer_status","drive_link","damage_fee","staff_note"\n',
    '02_Assets':'"asset_id","asset_type","model_group","serial_no","status","notes","rentable_now"\n"A1","phone","VIVO_X300_PRO","","available","","TRUE"\n',
    '03_Packages':'"template_id","model_group","package_type","lens_group","standard_price","display_name","package_note","active","sort_order","use_case"\n',
    '04_Event_Overrides':'"event_id","template_id","override_price","active_override","override_note","sort_order_override","use_case_override"\n',
    '08_Web_Ready':'"event_id","event_name","event_date_text","venue","poster_image_url","event_note","available_phone_count","available_lens_count","booking_status_for_web","action_for_web","line_message_template"\n',
    '09_Web_Packages':'"package_id","event_id","package_type","model_group","model_display","lens_group","lens_display","price","available_count","package_status","sort_order","web_note","raw_available_count","use_case"\n',
    '11_Customer_Stats':'"customer_key","customer_name","customer_contact","customer_phone","rental_count","first_rental_date","last_rental_date","last_event_name"\n',
    '10_Admin_Health_Check':'"Check","Count","Status","What to fix"\n',
    'Model_Master':'"model_group","model_display","asset_type","active","notes"\n',
    '18_Event_Visibility_Locks':'"lock_id","event_id","event_name","event_date","venue","identity_key","lock_state","lock_reason","first_locked_at","last_changed_at","changed_by","explicit_reopen_required","source_evidence","notes"\n'
  };
  const fetchImpl=async url=>{
    const u=new URL(String(url)); const sheet=u.searchParams.get('sheet');
    const spec=Object.values(F.SPECS).find(item=>item.sheet===sheet);
    assert.ok(spec,'unexpected fallback sheet '+sheet);
    assert.equal(u.searchParams.get('range'),spec.range);
    return {ok:true,status:200,async text(){return csv[sheet];}};
  };
  const s=await F.buildSnapshot({sheetId:'sheet',env:{},fetchImpl});
  assert.equal(s.fallback_reader,'public-gviz');
  assert.equal(s.snapshot_source,'direct-sheet-gviz-readonly-fallback');
  assert.equal(s.fallback_private_attempted,false);
  assert.equal(s.degraded_read_only,true);
});


test('private parser maps physical rows from a ranged read',()=>{
  const rows=F.valuesAsObjects([['booking_id','event_id'],['BK1','EV1']],'booking_id',4);
  assert.equal(rows[0].__row_number,5);
});


test('strict Apps Script cache never reuses prior owner read-key snapshot after rotation',async()=>{
 const appReader=require('../server/core-sheet-apps-script-reader.js');
 const saved=appReader.readValues;
 const noopFetch=async()=>{throw Error('PUBLIC_GVIZ_FORBIDDEN');};
 const key1='r'.repeat(48),key2='s'.repeat(48),adminKey='a'.repeat(48);
 const env={GOOGLE_SHEET_ID:'safe-sheet-test',KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
   KK_CORE_PRIVATE_TRANSPORT:'apps-script',
   KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/test_script/exec',
   KK_ADMIN_API_KEY:adminKey,KK_CORE_PRIVATE_READ_KEY:key1};
 const headers=Object.values(F.SPECS).reduce((m,c)=>{m[c.sheet]=c.header;return m;},{});
 let reads=0;
 appReader.readValues=async x=>{reads++;return [[headers[x.sheet]||'id']];};
 F.clearSnapshotCache();
 try{
   const first=await F.buildSnapshot({env,sheetId:env.GOOGLE_SHEET_ID,fetchImpl:noopFetch,cacheTtlMs:60000});
   assert.equal(first.fallback_reader,'private-owner-apps-script');
   assert.equal(reads,11);
   const same=await F.buildSnapshot({env,sheetId:env.GOOGLE_SHEET_ID,fetchImpl:noopFetch,cacheTtlMs:60000});
   assert.equal(same.fallback_cache_status,'hit');
   assert.equal(reads,11);
   const rotated={...env,KK_CORE_PRIVATE_READ_KEY:key2};
   const second=await F.buildSnapshot({env:rotated,sheetId:env.GOOGLE_SHEET_ID,fetchImpl:noopFetch,cacheTtlMs:60000});
   assert.equal(second.fallback_cache_status,'miss');
   assert.equal(reads,22);
   assert.doesNotMatch(JSON.stringify(second),new RegExp(key1+'|'+key2));
 }finally{appReader.readValues=saved;F.clearSnapshotCache();}
});
