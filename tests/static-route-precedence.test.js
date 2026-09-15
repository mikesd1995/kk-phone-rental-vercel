'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
function read(rel){ return fs.readFileSync(path.join(root,rel),'utf8'); }

test('routing middleware intercepts Admin paths before static filesystem delivery',()=>{
  const middleware=read('middleware.ts');
  assert.match(middleware,/from '@vercel\/functions'/);
  assert.match(middleware,/['"]\/admin['"]/);
  assert.match(middleware,/['"]\/admin\/:path\*['"]/);
  assert.match(middleware,/\/admin-login\.html/);
  assert.match(middleware,/__kk_gate/);
  assert.match(middleware,/['"]app['"]/);
  assert.match(middleware,/['"]asset['"]/);
  assert.match(middleware,/destination\.searchParams\.set\(['"]path['"], relativePath\)/);
});

test('routing middleware blocks source-only deployment paths that were observable in production',()=>{
  const middleware=read('middleware.ts');
  for(const prefix of ['/server/','/tests/','/docs/','/apps-script/','/.github/']){
    assert.ok(middleware.includes(`'${prefix}'`),`missing protected source prefix ${prefix}`);
  }
  assert.match(middleware,/status:\s*404/);
  assert.match(middleware,/X-Content-Type-Options/);
  assert.match(middleware,/no-store/);
});

test('middleware helper is pinned as a production dependency',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@vercel/functions'],'3.9.7');
});

test('the legacy rewrite-only configuration is not accepted as the Admin security boundary',()=>{
  const config=JSON.parse(read('vercel.json'));
  const adminRewrite=config.rewrites.find((rule)=>rule.source==='/admin/:path*');
  assert.ok(adminRewrite,'legacy rewrite may remain as defense in depth');
  assert.ok(fs.existsSync(path.join(root,'middleware.ts')),'middleware must enforce pre-filesystem gating');
});
