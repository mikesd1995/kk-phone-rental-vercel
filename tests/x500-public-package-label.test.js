'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('script.js','utf8');
function extract(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'Missing '+name);
  const end=source.indexOf('\n}',start);
  assert.ok(end>start,'No closing brace in '+name);
  return source.slice(start,end+2);
}
const context={};
vm.createContext(context);
vm.runInContext(extract('kkPublicLensLabel'),context,{timeout:1000});
test('Public package labels name 200/400mm from lens group, not generic Lens text',()=>{
  assert.equal(context.kkPublicLensLabel('ZEISS_2_35X','Lens Vivo'),'Lens 200mm');
  assert.equal(context.kkPublicLensLabel('G1','Lens Vivo'),'Lens 200mm');
  assert.equal(context.kkPublicLensLabel('ZEISS_400MM','Lens Vivo'),'Lens 400mm');
  assert.equal(context.kkPublicLensLabel('OTHER_LENS','Other Lens'),'Other Lens');
});
test('Package builder distinguishes X500 200 vs 400 and keeps model name',()=>{
  assert.match(source,/var bundleLensLabel=kkPublicLensLabel\(p\.lens_group,lensDisplay\)/);
  assert.match(source,/modelDisplay\+" \+ "\+bundleLensLabel/);
  assert.match(source,/var spec\s+= pkgType==="phone_only"/);
  const lens200=context.kkPublicLensLabel('ZEISS_2_35X','Lens Vivo');
  const lens400=context.kkPublicLensLabel('ZEISS_400MM','Lens 400mm');
  assert.notEqual('Vivo X500 Pro Max + '+lens200,'Vivo X500 Pro Max + '+lens400);
});
