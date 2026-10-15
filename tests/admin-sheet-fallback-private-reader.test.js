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


test('strict Core admin snapshot rejects data-row values masquerading as headers',async()=>{
 const CorePrivacy=require('../server/core-sheet-private-reader.js');
 const oldRead=CorePrivacy.readValues;
 const env={
   GOOGLE_SHEET_ID:'isolated-core-sot',
   KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
   KK_CORE_PRIVATE_TRANSPORT:'apps-script',
   KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/isolated_script/exec',
   KK_ADMIN_API_KEY:'a'.repeat(48),
   KK_CORE_PRIVATE_READ_KEY:'r'.repeat(48)
 };
 const originalHeaders=Object.fromEntries(Object.values(F.SPECS).map(s=>[s.sheet,s.header]));
 let privateReads=0;
 CorePrivacy.readValues=async ({sheet})=>{
   privateReads++;
   if(sheet==='00_Master_Booking')return [['wrong_heading'],['booking_id','PRIVATE_CUSTOMER_PHONE_FIXTURE']];
   return [[originalHeaders[sheet]]];
 };
 F.clearSnapshotCache();
 try{
   await assert.rejects(
     ()=>F.buildSnapshot({
       env,sheetId:env.GOOGLE_SHEET_ID,cache:false,
       fetchImpl:async()=>{throw Error('ANONYMOUS_GVIZ_FORBIDDEN');}
     }),
     e=>e&&e.code==='CORE_PRIVATE_SCHEMA_INVALID'&&e.dataset==='bookings'
   );
   assert.equal(privateReads,Object.keys(F.SPECS).length);
 }finally{
   CorePrivacy.readValues=oldRead;
   F.clearSnapshotCache();
 }
});

test('private service-account snapshot cache separates rotated keys even when PEM prefix and email stay the same',async()=>{
 const Core=require('../server/core-sheet-private-reader.js');
 const old=Core.readValues;
 const prefix='-----BEGIN PRIVATE KEY-----\\n'+'A'.repeat(130);
 const env={GOOGLE_SHEET_ID:'private-rotation-fixture',KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
   KK_CORE_PRIVATE_TRANSPORT:'service-account',
   GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.invalid',
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:prefix+'KEY_A'};
 const headers=Object.fromEntries(Object.values(F.SPECS).map(s=>[s.sheet,s.header]));
 const noNetwork=async()=>{throw Error('NETWORK_FORBIDDEN');};
 let reads=0;
 Core.readValues=async ({sheet})=>{reads++;return [[headers[sheet]]];};
 F.clearSnapshotCache();
 try{
   const opts={sheetId:env.GOOGLE_SHEET_ID,fetchImpl:noNetwork,cacheTtlMs:60000};
   const first=await F.buildSnapshot({...opts,env});
   assert.equal(first.fallback_cache_status,'miss');
   assert.equal(reads,11);
   const hit=await F.buildSnapshot({...opts,env});
   assert.equal(hit.fallback_cache_status,'hit');
   assert.equal(reads,11);
   const rotated={...env,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:prefix+'KEY_B'};
   const fresh=await F.buildSnapshot({...opts,env:rotated});
   assert.equal(fresh.fallback_cache_status,'miss');
   assert.equal(reads,22);
   assert.equal(fresh.fallback_reader,'private-service-account');
   assert.doesNotMatch(JSON.stringify(fresh),/KEY_A|KEY_B|reader@example.invalid/);
 }finally{Core.readValues=old;F.clearSnapshotCache();}
});

test('private Apps Script snapshot cache separates changed /exec deployment URL with unchanged key',async()=>{
 const Core=require('../server/core-sheet-private-reader.js');
 const old=Core.readValues;
 const env={GOOGLE_SHEET_ID:'apps-script-rotation-fixture',KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
   KK_CORE_PRIVATE_TRANSPORT:'apps-script',
   KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/fixture_one/exec',
   KK_CORE_PRIVATE_READ_KEY:'r'.repeat(48),KK_ADMIN_API_KEY:'a'.repeat(48)};
 const headers=Object.fromEntries(Object.values(F.SPECS).map(s=>[s.sheet,s.header]));
 const noNetwork=async()=>{throw Error('NETWORK_FORBIDDEN');};
 let reads=0;
 Core.readValues=async ({sheet})=>{reads++;return [[headers[sheet]]];};
 F.clearSnapshotCache();
 try{
   const opts={sheetId:env.GOOGLE_SHEET_ID,fetchImpl:noNetwork,cacheTtlMs:60000};
   assert.equal((await F.buildSnapshot({...opts,env})).fallback_cache_status,'miss');
   assert.equal((await F.buildSnapshot({...opts,env})).fallback_cache_status,'hit');
   assert.equal(reads,11);
   const changed={...env,KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/fixture_two/exec'};
   const fresh=await F.buildSnapshot({...opts,env:changed});
   assert.equal(fresh.fallback_cache_status,'miss');
   assert.equal(reads,22);
   assert.equal(fresh.fallback_reader,'private-owner-apps-script');
 }finally{Core.readValues=old;F.clearSnapshotCache();}
});

test('private Admin snapshots stay bounded across many rotated service-account identities',async()=>{
 const privateSheets=require('../api/lib/private-google-sheets.js');
 const original=privateSheets.readValues;
 const headers=Object.fromEntries(Object.values(F.SPECS).map(spec=>[spec.sheet,spec.header]));
 const env={GOOGLE_SHEET_ID:'bounded-cache-fixture',KK_ADMIN_FALLBACK_REQUIRE_PRIVATE:'1',
   GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.invalid',
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\\n'+'Z'.repeat(120)+'ROTATION_000'};
 const network=async()=>{throw Error('PUBLIC_GVIZ_FORBIDDEN');};
 const opts={sheetId:env.GOOGLE_SHEET_ID,fetchImpl:network,cacheTtlMs:60000};
 let privateReads=0;
 privateSheets.readValues=async ({range})=>{
   privateReads++;
   const sheet=String(range).split('!')[0];
   return [[headers[sheet]]];
 };
 F.clearSnapshotCache();
 try{
   for(let i=0;i<70;i++){
     const rotated={...env,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
       '-----BEGIN PRIVATE KEY-----\\n'+'Z'.repeat(120)+'ROTATION_'+String(i).padStart(3,'0')};
     const snapshot=await F.buildSnapshot({...opts,env:rotated});
     assert.equal(snapshot.fallback_cache_status,'miss');
     assert.equal(snapshot.write_actions_enabled,false);
   }
   assert.equal(privateReads,70*Object.keys(F.SPECS).length);
   const oldest=await F.buildSnapshot({...opts,env});
   assert.equal(oldest.fallback_cache_status,'miss',
     'evicted first credential identity must never reuse retained private snapshot');
   assert.equal(privateReads,71*Object.keys(F.SPECS).length);
   const same=await F.buildSnapshot({...opts,env});
   assert.equal(same.fallback_cache_status,'hit');
   assert.equal(privateReads,71*Object.keys(F.SPECS).length);
   assert.doesNotMatch(JSON.stringify(same),/ROTATION_000|reader@example.invalid/);
 }finally{privateSheets.readValues=original;F.clearSnapshotCache();}
});
