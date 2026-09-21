const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');

test('frontend gives today events a dedicated badge before coming-soon handling',()=>{
  assert.match(source,/badge_today:"งานวันนี้"/);
  assert.match(source,/badge_today:"Today"/);
  assert.match(source,/function isToday\(c\)\{ return concertTs\(c\)===TODAY_TS; \}/);
  assert.match(
    source,
    /if\(cnt<=0\)return tr\("badge_full"\); if\(isToday\(c\)\)return tr\("badge_today"\); if\(isSoon\(c\)\)return tr\("badge_soon"\);/
  );
});
