'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const auth=require('../server/admin-session.js');

function read(rel){ return fs.readFileSync(path.join(root,rel),'utf8'); }

function mockRes(){
  return {
    statusCode:200,
    headers:{},
    body:'',
    setHeader(k,v){ this.headers[String(k).toLowerCase()]=v; },
    end(v=''){ this.body=String(v||''); this.ended=true; }
  };
}

function req(headers={},method='POST'){
  return {method,headers:Object.assign({},headers),url:'/'};
}

async function withEnv(values,fn){
  const old={};
  for(const [k,v] of Object.entries(values)){
    old[k]=process.env[k];
    if(v===undefined) delete process.env[k]; else process.env[k]=v;
  }
  try{ return await fn(); }
  finally{
    for(const [k,v] of Object.entries(old)){
      if(v===undefined) delete process.env[k]; else process.env[k]=v;
    }
  }
}

test('public admin gate exposes only PIN access, not CRM navigation or environment details',()=>{
  const html=read('admin-login.html');
  assert.match(html,/Admin PIN/);
  assert.match(html,/\/api\/kk-admin-auth/);
  assert.match(html,/location\.replace\('\/admin\/app'\)/);
  for(const forbidden of [
    'Pricing Center','เพิ่ม Booking','แก้ Booking','ประวัติลูกค้า','System Guard',
    'KK_ADMIN_PIN','Google Sheet','CRM 360','Command Center','Phone Rental v16.7.0'
  ]) assert.equal(html.includes(forbidden),false,`gate must not expose ${forbidden}`);
});

test('obsolete root-level Admin source artifacts cannot remain on the public static surface',()=>{
  for(const rel of ['kk-admin.js','admin.js','index (1).html','download','download (2)']){
    assert.equal(fs.existsSync(path.join(root,rel)),false,`${rel} must not be publicly deployable`);
  }
});

test('browser storage keeps only a session sentinel and never persists submitted PIN',()=>{
  const html=read('admin-login.html');
  const bridge=read('admin/session-bridge.js');
  assert.match(html,/sessionStorage\.setItem\('kk_admin_pin','__SESSION__'\)/);
  assert.doesNotMatch(html,/sessionStorage\.setItem\([^\n]*value/);
  assert.match(bridge,/const SENTINEL='__SESSION__'/);
  assert.doesNotMatch(bridge,/KK_ADMIN_PIN/);
});

test('signed session token is randomized, validates, rejects tampering and carries hardened cookie flags',async()=>{
  await withEnv({KK_ADMIN_PIN:'unit-test-pin',KK_ADMIN_SESSION_SECRET:'unit-test-session-secret'},async()=>{
    const now=Date.now();
    const token=auth._test.issueToken(now);
    const second=auth._test.issueToken(now);
    assert.match(token,/^v2\.\d+\.[A-Za-z0-9_-]{22}\.[a-f0-9]{64}$/);
    assert.notEqual(token,second,'same-second sessions must have independent random nonces');
    assert.equal(auth._test.verifyToken(token,now+1000),true);
    assert.equal(auth._test.verifyToken(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),now+1000),false);
    assert.equal(auth._test.verifyToken(token,now+auth.SESSION_TTL_SECONDS*1000+2000),false);
    const cookie=auth._test.sessionCookie(token);
    assert.match(cookie,/^__Host-kk_admin_session=/);
    assert.match(cookie,/; Path=\//);
    assert.match(cookie,/; HttpOnly/);
    assert.match(cookie,/; Secure/);
    assert.match(cookie,/; SameSite=Strict/);
    assert.match(cookie,/; Max-Age=28800$/);
  });
});

test('PIN-only rollout fallback still validates sessions without using the raw PIN as HMAC key',async()=>{
  await withEnv({KK_ADMIN_PIN:'fallback-pin',KK_ADMIN_SESSION_SECRET:undefined},async()=>{
    const now=Date.now();
    const token=auth._test.issueToken(now);
    assert.equal(auth._test.verifyToken(token,now+1000),true);
    const key=auth._test.signingKey();
    assert.equal(Buffer.isBuffer(key),true);
    assert.equal(key.length,32);
    assert.notEqual(key.toString('utf8'),'fallback-pin');
  });
});

test('failed attempts are temporarily blocked after five failures',()=>{
  auth._test.attempts.clear();
  const r=req({'x-forwarded-for':'203.0.113.10'});
  for(let i=0;i<4;i++) assert.equal(auth._test.recordFailure(r).allowed,true);
  const fifth=auth._test.recordFailure(r);
  assert.equal(fifth.allowed,false);
  assert.ok(fifth.retryAfter>0);
  auth._test.attempts.clear();
});

test('signed session authorizes Admin API and injects server PIN without exposing it to browser storage',async()=>{
  await withEnv({KK_ADMIN_PIN:'server-only-pin',KK_ADMIN_SESSION_SECRET:'proxy-test-secret'},async()=>{
    const token=auth._test.issueToken();
    const r=req({cookie:`${auth.COOKIE_NAME}=${token}`,'x-admin-pin':'__SESSION__','x-forwarded-for':'203.0.113.20'});
    const res=mockRes();
    assert.equal(auth.authorizeApi(r,res),true);
    assert.equal(r.headers['x-admin-pin'],'server-only-pin');
  });
});

test('anonymous Admin API is rejected and correct legacy PIN remains compatible',async()=>{
  await withEnv({KK_ADMIN_PIN:'legacy-client-pin',KK_ADMIN_SESSION_SECRET:'legacy-test-secret'},async()=>{
    auth._test.attempts.clear();
    const badRes=mockRes();
    assert.equal(auth.authorizeApi(req({'x-forwarded-for':'203.0.113.21'}),badRes),false);
    assert.equal(badRes.statusCode,401);
    assert.match(badRes.body,/Unauthorized/);

    const legacyRes=mockRes();
    assert.equal(auth.authorizeApi(req({'x-admin-pin':'legacy-client-pin','x-forwarded-for':'203.0.113.30'}),legacyRes),true);
    auth._test.attempts.clear();
  });
});

test('same-origin auth checks reject a foreign browser origin',()=>{
  assert.equal(auth._test.sameOrigin({headers:{origin:'https://kk-phone-rental.vercel.app',host:'kk-phone-rental.vercel.app'}}),true);
  assert.equal(auth._test.sameOrigin({headers:{origin:'https://evil.example',host:'kk-phone-rental.vercel.app'}}),false);
  assert.equal(auth._test.sameOrigin({headers:{host:'kk-phone-rental.vercel.app'}}),true);
});

test('gate mode supports Vercel rewrite query objects and URL query strings',()=>{
  assert.equal(auth.gateMode({query:{__kk_gate:'auth'},url:'/api/kk-admin-snapshot-v6'}),'auth');
  assert.equal(auth.gateMode({url:'/api/kk-admin-snapshot-v6?__kk_gate=asset'}),'asset');
});

test('signed-in Admin HTML receives the session bridge and keeps the obsolete inline login panel hidden',()=>{
  const html=auth._test.loadAdminHtml();
  const bridgePos=html.indexOf('/admin/session-bridge.js');
  const healthPos=html.indexOf('/admin/snapshot-health.js');
  const adminPos=html.indexOf('/admin/admin.js');
  assert.ok(bridgePos>=0);
  assert.ok(bridgePos<healthPos);
  assert.ok(healthPos<adminPos);
  assert.match(html,/id="loginPanel" class="card login-card hidden" aria-hidden="true"/);
});

test('Admin asset path handling rejects traversal and normalizes safe paths',()=>{
  assert.equal(auth._test.cleanRelative('admin.js'),'admin.js');
  assert.equal(auth._test.cleanRelative('nested/file.css'),'nested/file.css');
  assert.equal(auth._test.cleanRelative('../package.json'),'');
  assert.equal(auth._test.cleanRelative('%2e%2e%2fpackage.json'),'');
  assert.equal(auth._test.cleanRelative('..\\package.json'),'');
  assert.equal(auth._test.contentType('x.js'),'application/javascript; charset=utf-8');
});

test('routing reuses existing v6 functions for login, app, assets and protected APIs',()=>{
  const config=JSON.parse(read('vercel.json'));
  const rewrites=new Map(config.rewrites.map(x=>[x.source,x.destination]));
  assert.equal(rewrites.get('/admin'),'/admin-login.html');
  assert.equal(rewrites.get('/admin/'),'/admin-login.html');
  assert.equal(rewrites.get('/admin/app'),'/api/kk-admin-snapshot-v6?__kk_gate=app');
  assert.equal(rewrites.get('/admin/:path*'),'/api/kk-admin-snapshot-v6?__kk_gate=asset&path=:path*');
  assert.equal(rewrites.get('/api/kk-admin-auth'),'/api/kk-admin-snapshot-v6?__kk_gate=auth');
  assert.equal(rewrites.get('/api/kk-admin'),'/api/kk-admin-snapshot-v6');
  assert.equal(rewrites.get('/api/kk-rental-dashboard'),'/api/kk-rental-dashboard-v6');
  assert.equal(config.functions['api/kk-admin-snapshot-v6.js'].includeFiles,'admin/**');

  const adminV6=read('api/kk-admin-snapshot-v6.js');
  const rentalV6=read('api/kk-rental-dashboard-v6.js');
  assert.match(adminV6,/AdminSecurity\.gateMode\(req\)/);
  assert.match(adminV6,/AdminSecurity\.authorizeApi\(req,res\)/);
  assert.match(rentalV6,/AdminSecurity\.authorizeApi\(req,res\)/);
});

test('security consolidation does not add obsolete Vercel function entry files',()=>{
  for(const rel of [
    'api/kk-admin-auth.js','api/kk-admin-app.js','api/kk-admin-static.js',
    'api/kk-admin-session-proxy.js','api/kk-rental-dashboard-session-proxy.js',
    'api/lib/admin-session.js','api/lib/admin-session-proxy.js'
  ]) assert.equal(fs.existsSync(path.join(root,rel)),false,`${rel} must stay outside the API function budget`);
  assert.equal(fs.existsSync(path.join(root,'server','admin-session.js')),true);
});

test('security headers keep Admin surfaces uncacheable, unindexed and non-frameable',()=>{
  const config=JSON.parse(read('vercel.json'));
  const bySource=new Map(config.headers.map(x=>[x.source,new Map(x.headers.map(h=>[h.key.toLowerCase(),h.value]))]));
  for(const source of ['/admin','/admin/','/admin/(.*)','/admin-login.html']){
    const h=bySource.get(source);
    assert.ok(h,`headers missing for ${source}`);
    assert.match(h.get('cache-control'),/no-store/);
    assert.match(h.get('x-robots-tag'),/noindex/);
    assert.equal(h.get('x-frame-options'),'DENY');
  }
});
