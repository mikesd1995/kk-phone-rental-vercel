'use strict';
// Actual Node HTTP transport smoke, not mocked AdminSecurity or OpsProjection.
// All requests stay on localhost and all credentials/data are synthetic.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');

test('real HTTP Admin login → protected assets → signed synthetic projection; legacy routes fail closed',async()=>{
  const keys=[
    'VERCEL_ENV','VERCEL_GIT_COMMIT_REF','KK_ADMIN_OPS_PREVIEW_FIXTURE',
    'KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH','KK_ADMIN_OPS_PREVIEW_TEST_PIN',
    'KK_ADMIN_SESSION_SECRET','KK_ADMIN_PIN'
  ];
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const branch='feat/ops-preview-fixture-uat-20261109';
  const pin='TEST-ONLY-SYNTHETIC-PIN-DO-NOT-USE';
  let server;
  try{
    Object.assign(process.env,{
      VERCEL_ENV:'preview',
      VERCEL_GIT_COMMIT_REF:branch,
      KK_ADMIN_OPS_PREVIEW_FIXTURE:'1',
      KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH:branch,
      KK_ADMIN_OPS_PREVIEW_TEST_PIN:pin,
      KK_ADMIN_SESSION_SECRET:'TEST-ONLY-PRIVATE-SIGNING-KEY-DO-NOT-USE'
    });
    delete process.env.KK_ADMIN_PIN;
    const handler=require('../api/kk-admin-snapshot-v6.js');
    server=http.createServer((req,res)=>{
      Promise.resolve(handler(req,res)).catch(()=>{
        if(!res.headersSent){res.statusCode=500;res.end('INTEGRATION_TEST_HANDLER_FAILED');}
        else res.destroy();
      });
    });
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port;
    const get=(path,cookie)=>fetch(base+path,{
      method:'GET',redirect:'manual',
      headers:cookie?{cookie}:{}
    });

    const unauth=await get('/api/kk-admin?action=operationsSnapshot');
    assert.equal(unauth.status,401,'unsigned API is blocked');
    assert.equal((await unauth.json()).error_code,'OPS_SESSION_REQUIRED');

    const noAsset=await get('/admin/operations-dashboard.html');
    assert.equal(noAsset.status,307,'unsigned HTML redirects to login');
    assert.equal(noAsset.headers.get('location'),'/admin');

    const invalid=await fetch(base+'/api/kk-admin-auth',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({pin:'invalid-synthetic-pin'})
    });
    assert.equal(invalid.status,401);

    const loggedIn=await fetch(base+'/api/kk-admin-auth',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({pin})
    });
    assert.equal(loggedIn.status,200);
    assert.equal((await loggedIn.json()).authenticated,true);
    const fullCookie=loggedIn.headers.get('set-cookie')||'';
    assert.match(fullCookie,/^__Host-kk_admin_session=v2\./);
    for(const flag of ['HttpOnly','Secure','SameSite=Strict'])
      assert.ok(fullCookie.includes(flag),'cookie missing '+flag);
    const cookie=fullCookie.split(';')[0];

    const asset=await get('/admin/operations-dashboard.html',cookie);
    assert.equal(asset.status,200);
    assert.match(asset.headers.get('content-type')||'',/text\/html/);
    assert.match(await asset.text(),/Operations Dashboard/);
    const client=await get('/admin/operations-dashboard.js',cookie);
    assert.equal(client.status,200);
    assert.match(await client.text(),/synthetic-preview-fixture-v1/);

    const data=await get('/api/kk-admin?action=operationsSnapshot',cookie);
    assert.equal(data.status,200);
    assert.equal(data.headers.get('x-kk-ops-data-class'),'synthetic-preview-only');
    assert.match(data.headers.get('cache-control')||'',/no-store/);
    const body=await data.text();
    for(const forbidden of [
      'SYNTHETIC_PRIVATE_MARKER_NOT_REAL',
      'SYNTHETIC-BOOKING-ID-NOT-REAL',
      'customer_name','customer_phone'
    ])assert.ok(!body.includes(forbidden),'PII projection leaked '+forbidden);
    const parsed=JSON.parse(body);
    assert.equal(parsed.ok,true);
    assert.equal(parsed.data.snapshot_source,'synthetic-preview-fixture-v1');
    assert.equal(parsed.data.events.length,2);
    assert.equal(parsed.data.web_ready.length,2);

    const forged=await get('/api/kk-admin?action=operationsSnapshot',
      cookie.slice(0,-1)+(cookie.endsWith('A')?'B':'A'));
    assert.equal(forged.status,401);

    const denied=[
      {path:'/api/kk-admin?action=snapshot',method:'GET'},
      {path:'/api/kk-admin?action=writeControlHealth',method:'GET'},
      {path:'/api/kk-admin?__kk_gate=make-verify',method:'GET'},
      {path:'/api/kk-admin?__kk_gate=make-health',method:'GET'},
      {path:'/api/kk-admin',method:'POST'}
    ];
    for(const route of denied){
      const deniedRes=await fetch(base+route.path,{
        method:route.method,redirect:'manual',headers:{cookie}
      });
      assert.equal(deniedRes.status,403,route.path);
      assert.equal((await deniedRes.json()).error_code,'OPS_PREVIEW_FIXTURE_ONLY');
    }
  }finally{
    if(server){
      await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    }
    for(const k of keys){
      if(original[k]===undefined)delete process.env[k];
      else process.env[k]=original[k];
    }
  }
});
