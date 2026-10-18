'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('node:vm');

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
  for(const prefix of ['/server/','/tests/','/docs/','/apps-script/','/supabase/','/.github/']){
    assert.ok(middleware.includes(`'${prefix}'`),`missing protected source prefix ${prefix}`);
  }
  assert.match(middleware,/status:\s*404/);
  assert.match(middleware,/X-Content-Type-Options/);
  assert.match(middleware,/no-store/);
});

function routingBoundary(){
  // Run the actual middleware body; replace only its TypeScript module syntax
  // and the platform rewrite helper, without adding a runtime dependency.
  const source=read('middleware.ts')
    .replace(/^import \{ rewrite \} from '@vercel\/functions';\s*/m,'')
    .replace('export const config =','const config =')
    .replace('export default function middleware(request: Request)','function middleware(request)');
  const context={URL,Response,rewrite:url=>new Response('',{headers:{'X-Test-Rewrite':url.href}})};
  vm.runInNewContext(source+'\nthis.routing = {config,middleware};',context);
  const {config,middleware}=context.routing;
  const matches=pathname=>config.matcher.some(pattern=>{
    if(!pattern.endsWith('/:path*'))return pathname===pattern;
    const base=pattern.slice(0,-'/:path*'.length);
    return pathname===base||pathname.startsWith(base+'/');
  });
  return {matches,serve:pathname=>matches(pathname)
    ?middleware({url:'https://synthetic.example'+pathname})
    :new Response('synthetic packaged static file',{status:200})};
}

test('retained database sources cannot bypass middleware into static filesystem delivery',async()=>{
  const route=routingBoundary();
  for(const pathname of ['/supabase','/supabase/',
    '/supabase/migrations/20261010213000_kk_inbox_private_line_media.sql',
    '/supabase/migrations/20261013152000_kk_inbox_durable_outbound_reservations.sql',
    '/supabase/functions/kk-runtime-ledger-github-witness/index.ts']){
    const response=route.serve(pathname);
    assert.equal(response.status,404,'source must be intercepted before static delivery: '+pathname);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    assert.equal(await response.text(),'Not found');
  }
});

test('source denial preserves public assets and governed Admin rewrite destinations',()=>{
  const route=routingBoundary();
  for(const pathname of ['/','/script.js','/assets/kk-storefront-v5.css'])assert.equal(route.matches(pathname),false);
  const login=new URL(route.serve('/admin').headers.get('X-Test-Rewrite'));
  assert.equal(login.pathname,'/admin-login.html');
  const app=new URL(route.serve('/admin/app').headers.get('X-Test-Rewrite'));
  assert.equal(app.pathname,'/api/kk-admin-snapshot-v6');assert.equal(app.searchParams.get('__kk_gate'),'app');
  const asset=new URL(route.serve('/admin/inbox-preview.js').headers.get('X-Test-Rewrite'));
  assert.equal(asset.pathname,'/api/kk-admin-snapshot-v6');assert.equal(asset.searchParams.get('__kk_gate'),'asset');
  assert.equal(asset.searchParams.get('path'),'inbox-preview.js');
});

test('middleware helper is pinned as a production dependency',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@vercel/functions'],'3.9.8');
});

test('the legacy rewrite-only configuration is not accepted as the Admin security boundary',()=>{
  const config=JSON.parse(read('vercel.json'));
  const adminRewrite=config.rewrites.find((rule)=>rule.source==='/admin/:path*');
  assert.ok(adminRewrite,'legacy rewrite may remain as defense in depth');
  assert.ok(fs.existsSync(path.join(root,'middleware.ts')),'middleware must enforce pre-filesystem gating');
});
