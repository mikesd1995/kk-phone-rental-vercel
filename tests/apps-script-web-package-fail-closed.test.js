'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Exercise the actual Apps Script admission AND normalization/availability helpers.
// Mock only the Sheets row provider: customer data, LINE, and deployed GAS are untouched.
function makeGuard(rows){
  const code=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  const start=code.indexOf('function kkTemplateIdFromWebPackageId_(packageId, eventId) {');
  const end=code.indexOf('\nfunction kkApiSnapshot_',start);
  assert.ok(start>=0 && end>start,'actual Apps Script admission helper block must be extractable');
  const body=code.slice(start,end);
  return vm.runInNewContext(body+'\nkkAssertWebPackageBookable_',{
    kkApiWebPackageRows_(){return rows;}
  });
}
const event='EVT-20261226-ALLYMPIC-MAIN';
const other='EVT-20261226-BUTTERBEAR';
const template='TPL-VIVO-X300-PRO-PHONE';
const row=(eventId=event,extra={})=>Object.assign({
  event_id:eventId,package_id:eventId+'-'+template,
  package_status:'available',available_count:2,price:790
},extra);

test('missing derived 09_Web_Packages event rows fail closed',()=>{
  assert.throws(()=>makeGuard([])(event,template),/Web Package availability is missing/);
});
test('a package for a different event on the same date does not authorize this event',()=>{
  assert.throws(()=>makeGuard([row(other)])(event,template),/Web Package availability is missing/);
});
test('a matching active priced phone package is admitted',()=>{
  assert.doesNotThrow(()=>makeGuard([row()])(event,template));
});
test('a hidden lens package cannot be booked even if another package is available',()=>{
  const lens='TPL-ZEISS-2-35X-LENS';
  const guard=makeGuard([row(),{event_id:event,package_id:event+'-'+lens,package_status:'hidden',available_count:0,price:0}]);
  assert.throws(()=>guard(event,lens),/ไม่พร้อมจอง/);
});
test('zero date-wide availability is not treated as a reservable package',()=>{
  assert.throws(()=>makeGuard([row(event,{available_count:0})])(event,template),/ไม่พร้อมจอง/);
});
test('zero or malformed price cannot make an unknown package bookable',()=>{
  assert.throws(()=>makeGuard([row(event,{price:0})])(event,template),/ไม่พร้อมจอง/);
});
test('present event rows but missing requested template fail closed',()=>{
  const wrong={event_id:event,package_id:event+'-TPL-ZEISS-2-35X-LENS',package_status:'available',available_count:2,price:300};
  assert.throws(()=>makeGuard([wrong])(event,template),/Package is not visible/);
});

test('full package ID input is normalized by the real Apps Script helpers',()=>{
  assert.doesNotThrow(()=>makeGuard([row()])(event,event+'-'+template));
});
test('fake package status is not a valid reservation even with stock and price',()=>{
  assert.throws(()=>makeGuard([row(event,{package_status:'pending'})])(event,template),/ไม่พร้อมจอง/);
});
test('invalid numeric stock or price never becomes bookable',()=>{
  assert.throws(()=>makeGuard([row(event,{available_count:'not-a-number'})])(event,template),/ไม่พร้อมจอง/);
  assert.throws(()=>makeGuard([row(event,{price:'not-a-number'})])(event,template),/ไม่พร้อมจอง/);
});
