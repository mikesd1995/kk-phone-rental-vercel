'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../server/rental-dashboard-core.js')._test;
const Legacy=require('../server/legacy/kk-rental-dashboard-v5.js')._test;
const Reader=require('../server/core-sheet-private-reader.js');
const strict={KK_CORE_SHEET_REQUIRE_PRIVATE:'1',GOOGLE_SHEET_ID:'fixture-core',KK_CORE_PRIVATE_TRANSPORT:'apps-script',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_01/exec',
 KK_ADMIN_API_KEY:'a'.repeat(48),KK_CORE_PRIVATE_READ_KEY:'r'.repeat(48)};
test('strict Core routing remains private when canonical revenue feature is OFF',async()=>{
 const old=Reader.readCsv,calls=[];
 Reader.readCsv=async x=>{calls.push(x);return 'private-only fixture';};
 try{
  for(const dashboard of [Core,Legacy]){
   const csv=await dashboard.coreCsv('fixture-core','01_Events','A4:Z',strict);
   assert.equal(csv,'private-only fixture');
  }
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.sheetId==='fixture-core'&&x.sheet==='01_Events'));
 }finally{Reader.readCsv=old;}
});
test('read key cannot equal admin write key and private flags default disabled',()=>{
 const invalid={...strict,KK_CORE_PRIVATE_READ_KEY:strict.KK_ADMIN_API_KEY};
 assert.equal(Reader.state(invalid).configured,false);
 assert.equal(Reader.enabled({}),false);
});
test('private source reaches API, Admin, Health and Storefront without exporting Core identifier',()=>{
 const root=path.resolve(__dirname,'..');
 for(const file of ['api/kk-data.js','api/kk-intelligence-health.js','api/kk-rental-dashboard-v6.js',
  'server/admin-proxy.js','api/kk-admin-guard.js','server/admin-sheet-fallback.js']){
   const src=fs.readFileSync(path.join(root,file),'utf8');
   assert.match(src,/CorePrivacy\./,file);
 }
 const browser=fs.readFileSync(path.join(root,'script.js'),'utf8');
 assert.doesNotMatch(browser,/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/);
 assert.match(browser,/Direct Google Sheets browser access is disabled/);
});
