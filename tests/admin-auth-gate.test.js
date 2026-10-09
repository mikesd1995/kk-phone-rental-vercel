'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
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

function recursiveJsFiles(dir){
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name);
    const stat=fs.statSync(full);
    if(stat.isDirectory()) out.push(...recursiveJsFiles(full));
    else if(name.endsWith('.js')) out.push(path.relative(root,full).replace(/\\/g,'/'));
  }
  return out;
}

test('public admin gate exposes only PIN access, not CRM navigation or environment details',()=>{
  const html=read('admin-login.html');
  assert.match(html,/Admin PIN/);
  assert.match(html,/\/api\/kk-admin-auth/);
  assert.match(html,/location\.replace\('\/admin\/app'\)/);
  assert.match(html,/href="\/admin-login\.css"/);
  assert.doesNotMatch(html,/<style>/);
  for(const forbidden of [
    'Pricing Center','เพิ่ม Booking','แก้ Booking','ประวัติลูกค้า','System Guard',
    'KK_ADMIN_PIN','Google Sheet','CRM 360','Command Center','Phone Rental v16.7.0'
  ]) assert.equal(html.includes(forbidden),false,`gate must not expose ${forbidden}`);
});

test('public gate inline script is locked to an exact CSP hash without unsafe-inline',()=>{
  const html=read('admin-login.html');
  const config=JSON.parse(read('vercel.json'));
  const match=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match,'gate must contain one deliberate hashed inline bootstrap');
  const digest='sha256-'+crypto.createHash('sha256').update(match[1],'utf8').digest('base64');
  const bySource=new Map(config.headers.map(x=>[x.source,new Map(x.headers.map(h=>[h.key.toLowerCase(),h.value]))]));
  for(const source of ['/admin','/admin/','/admin-login.html']){
    const csp=bySource.get(source).get('content-security-policy');
    assert.ok(csp.includes(`script-src '${digest}'`),`${source} CSP must pin the exact gate script hash`);
    assert.equal(csp.includes("'unsafe-inline'"),false,`${source} gate CSP must not allow arbitrary inline script`);
    assert.match(csp,/default-src 'none'/);
    assert.match(csp,/frame-ancestors 'none'/);
  }
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

test('constant-length comparison handles equal and unequal secrets without a length shortcut',()=>{
  assert.equal(auth._test.safeEqual('123456','123456'),true);
  assert.equal(auth._test.safeEqual('1','123456'),false);
  assert.equal(auth._test.safeEqual('123456','123457'),false);
});

test('failed login attempts are temporarily blocked after five failures',()=>{
  auth._test.attempts.clear();
  const r=req({'x-forwarded-for':'203.0.113.10'});
  for(let i=0;i<4;i++) assert.equal(auth._test.recordFailure(r,Date.now(),'login').allowed,true);
  const fifth=auth._test.recordFailure(r,Date.now(),'login');
  assert.equal(fifth.allowed,false);
  assert.ok(fifth.retryAfter>0);
  assert.match(fifth.key,/^login:/);
  auth._test.attempts.clear();
});

test('anonymous API probes do not consume login rate budget while bad legacy PINs are isolated',async()=>{
  await withEnv({KK_ADMIN_PIN:'legacy-client-pin',KK_ADMIN_SESSION_SECRET:'legacy-test-secret'},async()=>{
    auth._test.attempts.clear();
    const ip='203.0.113.22';
    for(let i=0;i<8;i++){
      const res=mockRes();
      assert.equal(auth.authorizeApi(req({'x-forwarded-for':ip}),res),false);
      assert.equal(res.statusCode,401);
    }
    assert.equal(auth._test.rateState(req({'x-forwarded-for':ip}),Date.now(),'login').allowed,true);
    assert.equal(auth._test.rateState(req({'x-forwarded-for':ip}),Date.now(),'legacy-api').allowed,true);

    for(let i=0;i<5;i++){
      const res=mockRes();
      auth.authorizeApi(req({'x-forwarded-for':ip,'x-admin-pin':'wrong-pin'}),res);
    }
    assert.equal(auth._test.rateState(req({'x-forwarded-for':ip}),Date.now(),'legacy-api').allowed,false);
    assert.equal(auth._test.rateState(req({'x-forwarded-for':ip}),Date.now(),'login').allowed,true);
    auth._test.attempts.clear();
  });
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

test('signed session remains authorized even when the runtime request headers cannot be replaced',async()=>{
  await withEnv({KK_ADMIN_PIN:'server-only-pin',KK_ADMIN_SESSION_SECRET:'immutable-header-secret'},async()=>{
    const token=auth._test.issueToken();
    const originalHeaders={cookie:`${auth.COOKIE_NAME}=${token}`,'x-admin-pin':'__SESSION__','x-forwarded-for':'203.0.113.25'};
    const r={method:'POST',url:'/'};
    Object.defineProperty(r,'headers',{get(){ return originalHeaders; },configurable:false});
    Object.preventExtensions(r);
    const res=mockRes();
    assert.equal(auth.authorizeApi(r,res),true);
    assert.equal(originalHeaders['x-admin-pin'],'__SESSION__');
    assert.equal(auth.isAuthorizedRequest(r),true);
  });
});

test('Rental Analytics trusts only the server authorization marker for signed-session internal chaining',()=>{
  const v6=read('api/kk-rental-dashboard-v6.js');
  const legacy=read('server/rental-dashboard-core.js');
  assert.match(v6,/AdminSecurity\.isAuthorizedRequest\(req\)/);
  assert.match(legacy,/AdminSecurity\.isAuthorizedRequest\(req\)/);
  assert.match(legacy,/provided!==expected/);
  assert.equal(fs.existsSync(path.join(root,'api','kk-rental-dashboard-v5.js')),false,'retired v5 entrypoint must not return to deployable API surface');
});

test('signed-session Admin bootstrap reveals the protected workspace and compacts snapshot warning evidence',()=>{
  const admin=read('admin/admin.js');
  assert.match(admin,/state\.pin==="__SESSION__"/);
  assert.match(admin,/#appPanel"\)\.classList\.remove\("hidden"\)/);
  assert.match(admin,/compactSnapshotWarnings/);
  assert.match(admin,/compactWarnings=compactSnapshotWarnings\(fullWarnings\)/);
  assert.doesNotMatch(admin,/h\.warnings\.join\("; "\)/);
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

test('same-origin auth checks reject foreign origin and forwarded protocol mismatch',()=>{
  assert.equal(auth._test.sameOrigin({headers:{origin:'https://kk-phone-rental.vercel.app',host:'kk-phone-rental.vercel.app','x-forwarded-proto':'https'}}),true);
  assert.equal(auth._test.sameOrigin({headers:{origin:'https://evil.example',host:'kk-phone-rental.vercel.app','x-forwarded-proto':'https'}}),false);
  assert.equal(auth._test.sameOrigin({headers:{origin:'http://kk-phone-rental.vercel.app',host:'kk-phone-rental.vercel.app','x-forwarded-proto':'https'}}),false);
  assert.equal(auth._test.sameOrigin({headers:{host:'kk-phone-rental.vercel.app'}}),true);
});

test('auth body parser caps already-parsed and raw request bodies',async()=>{
  await assert.rejects(()=>auth._test.bodyOf({body:{pin:'x'.repeat(5000)}}),/request_too_large/);
  assert.deepEqual(await auth._test.bodyOf({body:{pin:'123456'}}),{pin:'123456'});
});

test('gate mode avoids platform query getters while preserving URL and plain-object compatibility',()=>{
  assert.equal(auth.gateMode({query:{__kk_gate:'auth'},url:'/api/kk-admin-snapshot-v6'}),'auth');
  assert.equal(auth.gateMode({url:'/api/kk-admin-snapshot-v6?__kk_gate=asset'}),'asset');
  assert.equal(auth.gateMode({url:'/api/kk-admin-auth'}),'auth');
  assert.equal(auth.gateMode({url:'/admin/app'}),'app');
  assert.equal(auth._test.queryPath({url:'/admin/admin.js'}),'admin.js');
});

test('unknown internal gate modes fail closed with 404 instead of leaving a hanging function',async()=>{
  const res=mockRes();
  await auth.handleGate(req({},'GET'),res,'unexpected');
  assert.equal(res.statusCode,404);
  assert.equal(res.body,'Not found');
  assert.match(res.headers['cache-control'],/no-store/);
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

test('signed-session bootstrap does not depend on sessionStorage availability',()=>{
  const bridge=read('admin/session-bridge.js');
  const admin=read('admin/admin.js');
  const login=read('admin-login.html');
  assert.match(bridge,/window\.KK_ADMIN_SIGNED_SESSION=true/);
  assert.match(bridge,/revealAuthenticatedShell\(\)/);
  assert.match(bridge,/app\.classList\.remove\('hidden'\)/);
  assert.match(admin,/function safeSessionGet\(key\)/);
  assert.match(admin,/signedSession \? "__SESSION__" : ""/);
  assert.match(admin,/if\(!state\.pin && signedSession\) state\.pin="__SESSION__"/);
  assert.doesNotMatch(admin,/pin: sessionStorage\.getItem/);
  assert.match(login,/try\{ sessionStorage\.setItem\('kk_admin_pin','__SESSION__'\); \}catch\(_\)\{ \}/);
});

test('authenticated shell exposes a visible recovery status on client bootstrap errors',()=>{
  const bridge=read('admin/session-bridge.js');
  assert.match(bridge,/function showBootstrapFailure\(\)/);
  assert.match(bridge,/window\.addEventListener\('error'/);
  assert.match(bridge,/window\.addEventListener\('unhandledrejection'/);
  assert.match(bridge,/Admin UI โหลดไม่ครบ แต่ session ยังเข้าได้/);
});

test('Admin asset path handling rejects traversal and resolves only real files under Admin root',()=>{
  assert.equal(auth._test.cleanRelative('admin.js'),'admin.js');
  assert.equal(auth._test.cleanRelative('nested/file.css'),'nested/file.css');
  assert.equal(auth._test.cleanRelative('../package.json'),'');
  assert.equal(auth._test.cleanRelative('%2e%2e%2fpackage.json'),'');
  assert.equal(auth._test.cleanRelative('..\\package.json'),'');
  const resolved=auth._test.resolveAdminFile('admin.js');
  assert.ok(resolved.startsWith(auth._test.ADMIN_REAL_ROOT+path.sep));
  assert.equal(auth._test.resolveAdminFile('../package.json'),'');
  assert.equal(auth._test.contentType('x.js'),'application/javascript; charset=utf-8');
});

test('Admin asset resolver rejects a filesystem link that escapes the protected Admin root',()=>{
  const fixture=fs.mkdtempSync(path.join(root,'admin','__auth_escape_test__'));
  const link=path.join(fixture,'escape');
  const windows=process.platform==='win32';
  const relative=path.basename(fixture)+'/escape'+(windows?'/package.json':'');
  try{
    // Windows junctions exercise realpath containment without symlink privilege.
    // Linux keeps the original file-symlink escape coverage.
    fs.symlinkSync(windows?root:path.join(root,'package.json'),link,windows?'junction':'file');
    assert.equal(fs.realpathSync(path.join(root,'admin',relative)),fs.realpathSync(path.join(root,'package.json')));
    assert.equal(auth._test.resolveAdminFile(relative),'');
  }finally{
    if(fs.existsSync(link)) { if(windows) fs.rmdirSync(link); else fs.unlinkSync(link); }
    fs.rmdirSync(fixture);
  }
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
  assert.equal(fs.existsSync(path.join(root,'api','kk-admin.js')),false,'physical /api/kk-admin function must not shadow the v6 rewrite');
  assert.equal(fs.existsSync(path.join(root,'api','kk-rental-dashboard.js')),false,'physical /api/kk-rental-dashboard function must not shadow the v6 rewrite');
  assert.equal(fs.existsSync(path.join(root,'server','rental-dashboard-core.js')),true,'Rental Analytics legacy core must remain internal under server/');
  assert.equal(fs.existsSync(path.join(root,'server','admin-proxy.js')),true,'legacy upstream proxy must live outside api/');
  assert.equal(config.functions['api/kk-admin.js'],undefined,'shadowing function must not be configured');

  const guard=read('api/kk-admin-guard.js');
  assert.match(guard,/require\('\.\.\/server\/admin-proxy\.js'\)/);
  const adminV6=read('api/kk-admin-snapshot-v6.js');
  const rentalV6=read('api/kk-rental-dashboard-v6.js');
  assert.match(adminV6,/AdminSecurity\.gateMode\(req\)/);
  assert.match(adminV6,/AdminSecurity\.authorizeApi\(req,res\)/);
  assert.match(rentalV6,/AdminSecurity\.authorizeApi\(req,res\)/);
});

test('security consolidation stays within current Vercel API function budget',()=>{
  for(const rel of [
    'api/kk-admin-auth.js','api/kk-admin-app.js','api/kk-admin-static.js',
    'api/kk-admin-session-proxy.js','api/kk-rental-dashboard-session-proxy.js',
    'api/lib/admin-session.js','api/lib/admin-session-proxy.js'
  ]) assert.equal(fs.existsSync(path.join(root,rel)),false,`${rel} must stay outside the API function budget`);
  assert.equal(fs.existsSync(path.join(root,'server','admin-session.js')),true);
  assert.equal(fs.existsSync(path.join(root,'server','admin-proxy.js')),true);
  assert.equal(fs.existsSync(path.join(root,'api','kk-admin.js')),false,'route shadow regression: api/kk-admin.js must stay absent');
  assert.equal(fs.existsSync(path.join(root,'api','kk-rental-dashboard.js')),false,'route shadow regression: api/kk-rental-dashboard.js must stay absent');
  const apiJs=recursiveJsFiles(path.join(root,'api'));
  assert.ok(apiJs.length<=12,`Vercel Hobby API function surface regressed to ${apiJs.length} JS files: ${apiJs.join(', ')}`);
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
    assert.equal(h.get('referrer-policy'),'no-referrer');
  }
  for(const source of ['/admin','/admin/','/admin-login.html']){
    const h=bySource.get(source);
    assert.equal(h.get('cross-origin-opener-policy'),'same-origin');
    assert.equal(h.get('cross-origin-resource-policy'),'same-origin');
    assert.match(h.get('permissions-policy'),/camera=\(\)/);
  }
});
