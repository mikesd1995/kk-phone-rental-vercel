'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const auth=require('../api/lib/admin-session.js');
const proxy=require('../api/lib/admin-session-proxy.js');
const authEndpoint=require('../api/kk-admin-auth.js');
const adminApp=require('../api/kk-admin-app.js');

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

function req(headers={}){ return {method:'POST',headers:Object.assign({},headers)}; }

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

test('browser storage keeps only a session sentinel and never persists submitted PIN',()=>{
  const html=read('admin-login.html');
  const bridge=read('admin/session-bridge.js');
  assert.match(html,/const markAuthenticated=\(\)=>sessionStorage\.setItem\('kk_admin_pin','__SESSION__'\)/);
  assert.doesNotMatch(html,/sessionStorage\.setItem\([^\n]*value/);
  assert.match(bridge,/const SENTINEL='__SESSION__'/);
  assert.doesNotMatch(bridge,/KK_ADMIN_PIN/);
});

test('signed session token validates, rejects tampering and carries hardened cookie flags',async()=>{
  await withEnv({KK_ADMIN_PIN:'unit-test-pin',KK_ADMIN_SESSION_SECRET:'unit-test-session-secret'},async()=>{
    const now=Date.now();
    const token=auth.issueToken(now);
    assert.equal(auth.verifyToken(token,now+1000),true);
    assert.equal(auth.verifyToken(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),now+1000),false);
    assert.equal(auth.verifyToken(token,now+auth.SESSION_TTL_SECONDS*1000+2000),false);
    const cookie=auth.sessionCookie(token);
    assert.match(cookie,/^__Host-kk_admin_session=/);
    assert.match(cookie,/; Path=\//);
    assert.match(cookie,/; HttpOnly/);
    assert.match(cookie,/; Secure/);
    assert.match(cookie,/; SameSite=Strict/);
    assert.match(cookie,/; Max-Age=28800$/);
  });
});

test('failed attempts are temporarily blocked after five failures',()=>{
  auth._test.attempts.clear();
  const r=req({'x-forwarded-for':'203.0.113.10'});
  for(let i=0;i<4;i++) assert.equal(auth.recordFailure(r).allowed,true);
  const fifth=auth.recordFailure(r);
  assert.equal(fifth.allowed,false);
  assert.ok(fifth.retryAfter>0);
  auth._test.attempts.clear();
});

test('session proxy accepts signed cookie, injects server PIN, and rejects anonymous requests',async()=>{
  await withEnv({KK_ADMIN_PIN:'server-only-pin',KK_ADMIN_SESSION_SECRET:'proxy-test-secret'},async()=>{
    let seen='';
    const wrapped=proxy.wrap(async(r,res)=>{ seen=r.headers['x-admin-pin']; res.statusCode=200; res.end('ok'); });
    const token=auth.issueToken();
    const goodReq=req({cookie:`${auth.COOKIE_NAME}=${token}`,'x-admin-pin':'__SESSION__','x-forwarded-for':'203.0.113.20'});
    const goodRes=mockRes();
    await wrapped(goodReq,goodRes);
    assert.equal(goodRes.statusCode,200);
    assert.equal(goodRes.body,'ok');
    assert.equal(seen,'server-only-pin');

    auth._test.attempts.clear();
    const badRes=mockRes();
    await wrapped(req({'x-forwarded-for':'203.0.113.21'}),badRes);
    assert.equal(badRes.statusCode,401);
    assert.match(badRes.body,/Unauthorized/);
    auth._test.attempts.clear();
  });
});

test('legacy API clients with the correct server PIN remain compatible',async()=>{
  await withEnv({KK_ADMIN_PIN:'legacy-client-pin',KK_ADMIN_SESSION_SECRET:'legacy-test-secret'},async()=>{
    let called=false;
    const wrapped=proxy.wrap(async(_r,res)=>{ called=true; res.statusCode=204; res.end(); });
    const res=mockRes();
    await wrapped(req({'x-admin-pin':'legacy-client-pin','x-forwarded-for':'203.0.113.30'}),res);
    assert.equal(called,true);
    assert.equal(res.statusCode,204);
  });
});

test('auth endpoint enforces same-origin browser requests',()=>{
  assert.equal(authEndpoint._test.sameOrigin({headers:{origin:'https://kk-phone-rental.vercel.app',host:'kk-phone-rental.vercel.app'}}),true);
  assert.equal(authEndpoint._test.sameOrigin({headers:{origin:'https://evil.example',host:'kk-phone-rental.vercel.app'}}),false);
  assert.equal(authEndpoint._test.sameOrigin({headers:{host:'kk-phone-rental.vercel.app'}}),true);
});

test('signed-in admin HTML always receives the session bridge before legacy admin bootstrap',()=>{
  const html=adminApp._test.loadHtml();
  const bridgePos=html.indexOf('/admin/session-bridge.js');
  const healthPos=html.indexOf('/admin/snapshot-health.js');
  const adminPos=html.indexOf('/admin/admin.js');
  assert.ok(bridgePos>=0);
  assert.ok(bridgePos<healthPos);
  assert.ok(healthPos<adminPos);
});

test('routing sends public admin to minimal gate and protected app/API to session-aware handlers',()=>{
  const config=JSON.parse(read('vercel.json'));
  const rewrites=new Map(config.rewrites.map(x=>[x.source,x.destination]));
  assert.equal(rewrites.get('/admin'),'/admin-login.html');
  assert.equal(rewrites.get('/admin/'),'/admin-login.html');
  assert.equal(rewrites.get('/admin/app'),'/api/kk-admin-app');
  assert.equal(rewrites.get('/api/kk-admin'),'/api/kk-admin-session-proxy');
  assert.equal(rewrites.get('/api/kk-rental-dashboard'),'/api/kk-rental-dashboard-session-proxy');

  const middleware=read('middleware.ts');
  assert.match(middleware,/matcher:\['\/admin','\/admin\/:path\*'\]/);
  assert.match(middleware,/__Host-kk_admin_session/);
  assert.match(middleware,/url\.pathname==='\/admin\/index\.html'/);
  assert.match(middleware,/new URL\('\/admin\/app'/);
});

test('security headers keep admin surfaces uncacheable, unindexed and non-frameable',()=>{
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
