'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const runner=fs.readFileSync('scripts/storefront-visual-acceptance.mjs','utf8');

test('visual harness has no browser-wide bypass headers or manifest secret reread',()=>{
 assert.doesNotMatch(runner,/extraHTTPHeaders/);
 assert.match(runner,/protection_bypass_used:transport\.bypassUsed\(\)/);
});

// Execute only the actual fixture route body with mocks, never the harness main.
function fixtureRoute(){
 const start=runner.indexOf("await page.route(url=>url.pathname==='/api/kk-data',async route=>{");
 assert.ok(start>0);const bodyStart=runner.indexOf('async route=>{',start)+'async route=>{'.length;
 const end=runner.indexOf('\n        });',bodyStart);assert.ok(end>bodyStart);
 return new (Object.getPrototypeOf(async function(){}).constructor)('route','fixtures',runner.slice(bodyStart,end));
}
test('public fixture override cannot bypass the read-only guard with POST',async()=>{
 const calls=[];await fixtureRoute()({request:()=>({method:()=> 'POST',url:()=> 'http://127.0.0.1:4173/api/kk-data?sheet=08_Web_Ready'}),
  abort:async()=>calls.push('abort'),fulfill:async()=>calls.push('fulfill')},{events:'synthetic events',packages:'synthetic packages'});
 assert.deepEqual(calls,['abort']);
});
test('read-only public fixture override preserves GET response data',async()=>{
 const calls=[];await fixtureRoute()({request:()=>({method:()=> 'GET',url:()=> 'http://127.0.0.1:4173/api/kk-data?sheet=08_Web_Ready'}),
  abort:async()=>calls.push('abort'),fulfill:async value=>calls.push(value)},{events:'synthetic events',packages:'synthetic packages'});
 assert.equal(calls[0].body,'synthetic events');
});

const {createReadOnlyTransport}=require('../scripts/storefront-visual-transport.cjs');
const TARGET='https://kk-phone-rental-vercel-synthetic.vercel.app/';
const DUMMY='DUMMY_BYPASS_VALUE_FOR_LOCAL_MOCK_ONLY';
function routeMock({url=TARGET,method='GET',headers={},type='document',redirected=null,status=200,
 responseHeaders={},fetchError,continueError}={}){
 const calls=[];
 const response={status:()=>status,headers:()=>responseHeaders};
 const route={request:()=>({url:()=>url,method:()=>method,resourceType:()=>type,
  allHeaders:async()=>headers,redirectedFrom:()=>redirected}),
  abort:async reason=>calls.push({type:'abort',reason}),
  continue:async options=>{calls.push({type:'continue',options});if(continueError)throw continueError;},
  fetch:async options=>{calls.push({type:'fetch',options});if(fetchError)throw fetchError;return response;},
  fulfill:async options=>calls.push({type:'fulfill',options})};
 return {route,calls,response};
}
const remote=extra=>createReadOnlyTransport({mode:'preview',targetUrl:TARGET,readBypassSecret:()=>DUMMY,...extra});

test('local transport never evaluates inherited secret accessor, including report generation',async()=>{
 let reads=0;const policy=createReadOnlyTransport({mode:'local_zero_cost',targetUrl:'http://127.0.0.1:4173/',
  readBypassSecret:()=>{reads++;throw Error(DUMMY);}});
 const r=routeMock({url:'http://127.0.0.1:4173/style.css',headers:{'X-Vercel-Protection-Bypass':DUMMY,
  'X-Vercel-Set-Bypass-Cookie':'true',Accept:'text/css'}});
 await policy.forward(r.route);
 assert.equal(reads,0);assert.equal(policy.bypassUsed(),false);
 assert.deepEqual(r.calls,[{type:'continue',options:{headers:{Accept:'text/css'}}}]);
 assert.doesNotMatch(JSON.stringify(policy),/DUMMY/);
});

test('approved HTTPS origin gets only per-request bypass, no cookie request or redirects',async()=>{
 let reads=0;const policy=remote({readBypassSecret:()=>{reads++;return DUMMY;}});
 const r=routeMock({headers:{'X-Vercel-Protection-Bypass':'DUMMY_STALE','x-VERCEL-set-BYPASS-cookie':'true',Accept:'text/html'}});
 assert.equal(policy.bypassUsed(),false);await policy.forward(r.route);
 assert.equal(reads,1);assert.equal(policy.bypassUsed(),true);
 assert.equal(r.calls[0].type,'fetch');assert.equal(r.calls[0].options.maxRedirects,0);
 assert.equal(r.calls[0].options.maxRetries,0);
 assert.deepEqual(r.calls[0].options.headers,{Accept:'text/html','x-vercel-protection-bypass':DUMMY});
 assert.equal(r.calls[1].options.response,r.response);
 assert.equal(reads,1,'report and response must not reread credential');
});

for(const url of [
 'https://example.invalid/image.jpg',
 'https://kk-phone-rental-vercel-synthetic.vercel.app.example.invalid/image.jpg',
 'https://kk-phone-rental-vercel-other.vercel.app/image.jpg',
 'http://kk-phone-rental-vercel-synthetic.vercel.app/image.jpg',
 'https://kk-phone-rental-vercel-synthetic.vercel.app:8443/image.jpg'
]){
 test('different origin receives neither reserved header: '+new URL(url).origin,async()=>{
  const policy=remote(),r=routeMock({url,headers:{'X-Vercel-Protection-Bypass':DUMMY,
   'x-vercel-set-bypass-cookie':'true',Accept:'image/*'}});
  await policy.forward(r.route);assert.deepEqual(r.calls,[{type:'continue',options:{headers:{Accept:'image/*'}}}]);
  assert.equal(policy.bypassUsed(),false);
 });
}

for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
 test('read-only transport blocks '+method+' before dispatch',async()=>{
  const r=routeMock({method});await remote().forward(r.route);
  assert.deepEqual(r.calls,[{type:'abort',reason:'blockedbyclient'}]);
 });
}

for(const status of [301,302,303,307,308]){
 for(const location of ['/same-origin','https://example.invalid/redirect']){
  test('credentialed '+status+' redirect never follows '+(location[0]==='/'?'same origin':'other origin'),async()=>{
   const r=routeMock({status,responseHeaders:{Location:location}});
   await assert.rejects(()=>remote().forward(r.route),e=>e.code==='VISUAL_TRANSPORT_REDIRECT_BLOCKED');
   assert.deepEqual(r.calls.map(c=>c.type),['fetch','abort']);
   assert.equal(r.calls[0].options.maxRedirects,0);
  });
 }
}

test('incoming redirected request cannot acquire bypass authority',async()=>{
 const policy=remote(),r=routeMock({redirected:{url:()=> 'https://example.invalid/'}});
 await assert.rejects(()=>policy.forward(r.route),e=>e.code==='VISUAL_TRANSPORT_REDIRECT_BLOCKED');
 assert.deepEqual(r.calls.map(c=>c.type),['abort']);assert.equal(policy.bypassUsed(),false);
});

test('ordinary response status, body and application Set-Cookie forwarding are preserved',async()=>{
 const r=routeMock({status:201,responseHeaders:{'set-cookie':'ordinary_app_cookie=synthetic; Secure; HttpOnly'}});
 await remote().forward(r.route);
 assert.equal(r.calls[1].options.response,r.response);
 assert.equal(r.calls[1].options.response.status(),201);
 assert.equal(r.calls[1].options.response.headers()['set-cookie'],'ordinary_app_cookie=synthetic; Secure; HttpOnly');
 assert.equal(r.calls[0].options.headers['x-vercel-set-bypass-cookie'],undefined);
});

test('cached image body fulfills without request dispatch or credential-use claim',async()=>{
 const body=Buffer.from('synthetic image'),image={contentType:'image/png',body};
 const policy=remote({imageCache:{get:url=>url===TARGET+'poster.png'?image:null}});
 const r=routeMock({url:TARGET+'poster.png',type:'image'});await policy.forward(r.route);
 assert.deepEqual(r.calls,[{type:'fulfill',options:{status:200,contentType:'image/png',body}}]);
 assert.equal(policy.bypassUsed(),false);
});

test('unprotected remote mode never invents a bypass credential',async()=>{
 const policy=remote({readBypassSecret:()=>''}),r=routeMock({headers:{'x-vercel-protection-bypass':'DUMMY_STALE'}});
 await policy.forward(r.route);assert.deepEqual(r.calls,[{type:'continue',options:{headers:{}}}]);
 assert.equal(policy.bypassUsed(),false);
});

test('transport errors never reflect credential, request call log or upstream cause',async()=>{
 const r=routeMock({fetchError:Object.assign(Error('Header x-vercel-protection-bypass: '+DUMMY),{code:'UNTRUSTED_UPSTREAM'})});
 await assert.rejects(()=>remote().forward(r.route),error=>{
  assert.equal(error.code,'VISUAL_TRANSPORT_FAILED');
  assert.doesNotMatch(error.message+' '+error.stack, /DUMMY|x-vercel-protection-bypass/);
  assert.equal(error.cause,undefined);return true;
 });
 const external=routeMock({url:'https://example.invalid/',continueError:Error(DUMMY)});
 await assert.rejects(()=>remote().forward(external.route),e=>e.code==='VISUAL_TRANSPORT_FAILED'&&!e.message.includes(DUMMY));
});

test('invalid mode/target and credential userinfo fail with fixed diagnostics',async()=>{
 for(const targetUrl of ['https://example.invalid/','http://kk-phone-rental.vercel.app/',
  'https://dummy:password@kk-phone-rental.vercel.app/','https://kk-phone-rental.vercel.app:8443/']){
  assert.throws(()=>remote({targetUrl}),e=>e.code==='VISUAL_TRANSPORT_TARGET_INVALID');
 }
 assert.throws(()=>remote({mode:'unknown'}),e=>e.code==='VISUAL_TRANSPORT_MODE_INVALID');
 const r=routeMock({url:'https://dummy:password@kk-phone-rental-vercel-synthetic.vercel.app/'});
 await assert.rejects(()=>remote().forward(r.route),e=>e.code==='VISUAL_TRANSPORT_URL_CREDENTIALS');
 assert.deepEqual(r.calls.map(c=>c.type),['abort']);
});

test('invalid or throwing protected credential provider is redacted',()=>{
 assert.throws(()=>remote({readBypassSecret:()=>{throw Error(DUMMY);}}),e=>
  e.code==='VISUAL_TRANSPORT_SECRET_UNAVAILABLE'&&!e.message.includes(DUMMY));
 assert.throws(()=>remote({readBypassSecret:()=>DUMMY+'\r\ninjected: true'}),e=>
  e.code==='VISUAL_TRANSPORT_SECRET_INVALID'&&!e.message.includes(DUMMY));
});

test('harness blocks service workers so browser traffic cannot evade the route guard',()=>{
 assert.match(runner,/serviceWorkers:'block'/);
 assert.match(runner,/page\.route\('\*\*\/\*',route=>transport\.forward\(route\)\)/);
});
