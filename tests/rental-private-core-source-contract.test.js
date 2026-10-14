'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const core=source('server/rental-dashboard-core.js');
const crm=source('server/legacy/kk-rental-dashboard-v5.js');
const quote=source('server/rental-analytics-booked-quote.js');

for(const [name,code] of [['Core',core],['CRM',crm]]){
  test(name+' Future uses verified agreed price X, never received cash O',()=>{
    assert.match(code,/BookedQuote\.positivePrice\(r\.package_price\)/);
    assert.match(code,/BookedQuote\.bookedPriceRows\(rows,masterCsv,parseCsv\)/);
    assert.match(code,/RENTAL_ACTIVE_QUOTE_UNVERIFIED/);
    assert.doesNotMatch(code,/futureAmount=activeSet\.has\(r\.status\)\?amount:0/);
    assert.match(code,/รายรับในอนาคต = SUM\(package_price\)/);
  });
  test(name+' reads private canonical Master quotes with explicit opt-in and no GViz fallback',()=>{
    assert.match(code,/if\(!CorePrivacy\.enabled\(\) \|\| !CorePrivacy\.state\(\)\.configured\)/);
    assert.match(code,/RENTAL_MASTER_PRIVATE_SOURCE_REQUIRED/);
    assert.match(code,/CorePrivacy\.readCsv\(\{sheetId(?::coreSheetId)?,sheet:['\"]00_Master_Booking['\"],range:['\"]A4:X['\"]\}\)/);
    assert.doesNotMatch(code,/fetchCsv\([^\n]*['"]00_Master_Booking['"]/);
    assert.match(code,/RENTAL_/);
  });
}
test('Canonical quote join validates exact identity and rejects ambiguous historical mappings',()=>{
  assert.match(quote,/bookingid/);
  assert.match(quote,/eventid/);
  assert.match(quote,/packagetype/);
  assert.match(quote,/bookingstatus/);
  assert.match(quote,/packageprice/);
  assert.match(quote,/RENTAL_/);
});
test('Private Core and CRM analytics never emit raw Master rows to browser',()=>{
  assert.doesNotMatch(core,/json\(res,200,\{ok:true,masterCsv/);
  assert.doesNotMatch(crm,/json\(res,200,\{ok:true,masterCsv/);
  assert.match(core,/data:aggregate\(verified\)/);
  assert.match(crm,/const data=aggregate\(verified\)/);
});
