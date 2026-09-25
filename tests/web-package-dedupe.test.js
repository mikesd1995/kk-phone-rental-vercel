'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadDedupeHelper(){
  const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
  const start=source.indexOf('function dedupePackageRows(');
  const end=source.indexOf('// ─── FIX 1: buildPackagesFromSheet',start);
  assert.notEqual(start,-1,'dedupePackageRows helper must exist');
  assert.ok(end>start,'dedupe helper must remain immediately before buildPackagesFromSheet');
  const context={};
  vm.createContext(context);
  vm.runInContext(source.slice(start,end),context);
  assert.equal(typeof context.dedupePackageRows,'function');
  return {fn:context.dedupePackageRows,source};
}

test('web package dedupe keeps the last occurrence for a duplicate package_id',()=>{
  const {fn}=loadDedupeHelper();
  const rows=[
    {package_id:'PKG-PHONE',price:'890',available_count:'0',package_status:'full',marker:'manual'},
    {package_id:'PKG-LENS',price:'390',available_count:'0',package_status:'hidden'},
    {package_id:'PKG-PHONE',price:890,available_count:0,package_status:'hidden',marker:'generated'}
  ];
  const out=fn(rows);
  assert.equal(out.length,2);
  assert.equal(out[1].package_id,'PKG-PHONE');
  assert.equal(out[1].marker,'generated');
  assert.equal(out[1].package_status,'hidden');
});

test('web package dedupe preserves rows without package_id and stable surviving order',()=>{
  const {fn}=loadDedupeHelper();
  const rows=[
    {package_id:'A',marker:'old-a'},
    {marker:'blank-1'},
    {package_id:'B',marker:'b'},
    {package_id:'A',marker:'new-a'},
    {marker:'blank-2'}
  ];
  const out=fn(rows);
  assert.deepEqual(
    JSON.parse(JSON.stringify(out)),
    [
      {marker:'blank-1'},
      {package_id:'B',marker:'b'},
      {package_id:'A',marker:'new-a'},
      {marker:'blank-2'}
    ]
  );
});

test('buildPackagesFromSheet applies package_id dedupe before visibility filtering',()=>{
  const {source}=loadDedupeHelper();
  assert.match(source,/var evtPkgs=dedupePackageRows\(pkgRows\)\.filter\(function\(p\)\{/);
});
