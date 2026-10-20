'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');

function publicGetSource(source=code){
  const match=source.match(/function doGet\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match,'doGet function not found');
  return match[0];
}
test('anonymous doGet returns no Core spreadsheet ID or private metadata',()=>{
  const src=publicGetSource();
  assert.doesNotMatch(src,/spreadsheet_id|SpreadsheetApp|Google_Service_Account|PRIVATE_KEY|apiKey/);
  const returned=Function('kkApiJson_','KK_ADMIN_VERSION','SpreadsheetApp',
    src+';return doGet();')(
      v=>v,'test-version',new Proxy({}, {get(){throw Error('unauthenticated Sheet read!')}})
    );
  assert.deepEqual(Object.keys(returned).sort(),['message','ok','version']);
  assert.equal(returned.ok,true);
  assert.equal(returned.version,'test-version');
  assert.doesNotMatch(JSON.stringify(returned),/spreadsheet_id|booking_id|customer_phone|CORE_SHEET/);
});
test('Apps Script doPost still requires API key before any action dispatch',()=>{
  const x=code.indexOf('function doPost(e)');
  const check=code.indexOf('kkApiRequireKey_(payload)',x);
  const switchAt=code.indexOf('switch (action)',x);
  assert.ok(x>=0 && check>x && switchAt>check && switchAt-x<3500);
  const liveCases=code.slice(switchAt,switchAt+1750);
  assert.match(liveCases,/case 'snapshot':/);
  assert.match(liveCases,/case 'phase1Health':/);
});
test('public storefront JavaScript no longer contains canonical Core Sheet identifier',()=>{
  const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
  const config=fs.readFileSync(path.join(__dirname,'../config.js'),'utf8');
  assert.doesNotMatch(script,/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/);
  assert.match(script,/function directSheetUrl\(\)\{ throw new Error/);
  assert.match(config,/publicDataMode:\s*["']api-only["']/);
});
