'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function source(file){
  return fs.readFileSync(path.join(__dirname,'..',file),'utf8');
}

test('runtime sheet readers do not cap growing event/read-model tables at historical row ceilings',()=>{
  const fallback=source('server/admin-sheet-fallback.js');
  const rentalCore=source('server/rental-dashboard-core.js');
  const rentalV5=source('api/kk-rental-dashboard-v5.js');
  const rentalV6=source('api/kk-rental-dashboard-v6.js');
  const health=source('api/kk-intelligence-health.js');
  const direct=source('server/admin-direct-writer-phase1.js');

  for(const [name,text] of Object.entries({fallback,rentalCore,rentalV5,rentalV6,health,direct})){
    assert.doesNotMatch(text,/01_Events![A-Z0-9:$]+1000\b/,name+' reintroduced a 1000-row event ceiling');
  }
  assert.doesNotMatch(fallback,/range:'A4:I1000'/);
  assert.doesNotMatch(fallback,/range:'A4:K1000'/);
  assert.doesNotMatch(rentalCore,/"01_Events","A4:Z1000"/);
  assert.doesNotMatch(rentalV5,/'01_Events','A4:Z1000'/);
  assert.doesNotMatch(rentalV6,/_Rental_Dashboard_Data!A1:O1000/);
  assert.doesNotMatch(health,/_Rental_Dashboard_Data!A1:O1000/);
  assert.doesNotMatch(direct,/01_Events!A5:H1000/);
  assert.doesNotMatch(direct,/09_Web_Packages!A5:N3000/);
});
