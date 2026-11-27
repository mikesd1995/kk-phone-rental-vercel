'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const PROJ=require('../server/kk-admin-ops-projection.js');
const sample=()=>({ok:true,data:{
 generated_at:'2026-11-08T01:20:00',events:[{event_id:'EV',status:'open',active_on_web:true}],
 web_ready:[{event_id:'EV',action_for_web:'show',available_phone_count:1}],
 web_packages:[{package_id:'PK',event_id:'EV',package_type:'phone_only',available_count:1,price:590,package_status:'available'}],
 bookings:[{booking_id:'SECRET_BOOKING_ID',event_id:'EV',booking_status:'confirmed',customer_name:'SECRET_NAME',customer_phone:'SECRET_PHONE'}]
}});
function harness({signed=true,upstream=sample(),status=200,throwV5=false,apiAllowed=true,realSecurity=false,enforceLegacyPin=false,stream=false,doubleEnd=false,unsafeHeader=false}={}){
 const calls={upstream:0,urls:[],authorize:0};
 const fakeV5=async(req,res)=>{
  calls.upstream++;calls.urls.push(req.url);
  if(enforceLegacyPin && req.headers['x-admin-pin']!==process.env.KK_ADMIN_PIN){
   res.statusCode=401;
   res.end(JSON.stringify({ok:false,error_code:'LEGACY_PIN_REQUIRED'}));
   return;
  }
  if(throwV5) throw Error('private backend SECRET_NAME');
  res.statusCode=status;
  if(unsafeHeader)res.setHeader('X-Private-Source','SECRET_NAME');
  if(stream)res.write('SECRET_NAME');
  res.end(typeof upstream==='string'?upstream:JSON.stringify(upstream));
  if(doubleEnd)res.end('SECRET_NAME');
 };
 const admin=realSecurity?require('../server/admin-session.js'):{gateMode:()=>'',authorizeApi:()=>{calls.authorize++;return apiAllowed},hasValidSession:()=>signed};
 const mocks={
  '../server/runtime-warning-tracer':{installRuntimeWarningTracer:()=>{}},
  '../server/legacy/kk-admin-snapshot-v5.js':fakeV5,
  '../server/admin-session.js':admin,
  '../server/admin-make-gate.js':{},
  '../server/admin-write-control-oidc.js':{health:async()=>({ok:false})},
  './lib/admin-google-sheets-writer.js':{health:async()=>({ok:false})},
  '../server/kk-admin-ops-projection.js':PROJ
 };
 const module={exports:{}};
 const requireMock=p=>{if(!Object.hasOwn(mocks,p)) throw Error('Unexpected require '+p);return mocks[p]};
 const code=fs.readFileSync(path.join(ROOT,'api/kk-admin-snapshot-v6.js'),'utf8');
 vm.runInNewContext(code,{module,exports:module.exports,require:requireMock,URL,Promise,JSON,String,Number,Object,Array,Buffer,process}, {filename:'api/kk-admin-snapshot-v6.js'});
 const req={method:'GET',url:'/api/kk-admin?action=operationsSnapshot',headers:{cookie:'signed-session'}};
 const res={statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v},end(payload){this.body=String(payload??'');return this.body}};
 return {handler:module.exports,req,res,calls};
}
test('dedicated endpoint requires signed session, legacy PIN alone is insufficient',async()=>{
 const x=harness({signed:false});await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,401);assert.equal(x.calls.upstream,0);
 assert.equal(JSON.parse(x.res.body).error_code,'OPS_SESSION_REQUIRED');
});
test('authorized operation fetches snapshot internally and responds with no customer fields',async()=>{
 const x=harness();await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,200);assert.equal(x.calls.upstream,1);
 assert.equal(x.calls.urls[0],'/api/kk-admin?action=snapshot');
 assert.equal(x.req.url,'/api/kk-admin?action=operationsSnapshot');
 const obj=JSON.parse(x.res.body);assert.equal(obj.data.projection_version,PROJ.VERSION);
 for(const sensitive of ['SECRET_NAME','SECRET_PHONE','SECRET_BOOKING_ID'])assert.ok(!x.res.body.includes(sensitive));
 assert.equal(x.res.headers['cache-control'].includes('no-store'),true);
});
test('upstream rejection cannot leak raw error strings or private response',async()=>{
 const x=harness({status:502,upstream:{ok:false,error:'SECRET_NAME'}});await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,503);assert.ok(!x.res.body.includes('SECRET_NAME'));
 assert.equal(JSON.parse(x.res.body).error_code,'OPS_SOURCE_UNAVAILABLE');
});
test('upstream exception and malformed response fail closed',async()=>{
 const x=harness({throwV5:true});await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,503);assert.ok(!x.res.body.includes('SECRET_NAME'));
 const y=harness({upstream:'SECRET_NAME'});await y.handler(y.req,y.res);
 assert.equal(y.res.statusCode,503);assert.ok(!y.res.body.includes('SECRET_NAME'));
});
test('API authorization guard stops before reading private snapshot',async()=>{
 const x=harness({apiAllowed:false});await x.handler(x.req,x.res);
 assert.equal(x.calls.upstream,0);assert.equal(x.calls.authorize,1);
});

test('streaming or double-ended upstream payload cannot reach real network response',async()=>{
 for(const options of [{stream:true},{doubleEnd:true},{stream:true,doubleEnd:true}]){
  const x=harness(options);await x.handler(x.req,x.res);
  assert.equal(x.res.statusCode,503);
  assert.equal(JSON.parse(x.res.body).error_code,'OPS_SOURCE_UNAVAILABLE');
  assert.ok(!x.res.body.includes('SECRET_NAME'));
  assert.equal(x.req.url,'/api/kk-admin?action=operationsSnapshot');
 }
});
test('upstream response headers are isolated from real client headers',async()=>{
 const x=harness({unsafeHeader:true});await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,200);
 assert.equal(x.res.headers['x-private-source'],undefined);
 assert.equal(x.res.headers['x-kk-ops-projection-version'],PROJ.VERSION);
 assert.ok(!x.res.body.includes('SECRET_NAME'));
});

test('oversized private source is never parsed or sent to client',async()=>{
 const x=harness({upstream:'PRIVATE_SOURCE_'.repeat(900000)});
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,503);
 assert.equal(JSON.parse(x.res.body).error_code,'OPS_SOURCE_UNAVAILABLE');
 assert.ok(!x.res.body.includes('PRIVATE_SOURCE_'));
});

// Use the real signed-session implementation and synthetic secrets, not a stubbed auth gate.
async function withSignedTestKeys(fn){
 const keys=['KK_ADMIN_PIN','KK_ADMIN_SESSION_SECRET'];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.KK_ADMIN_PIN='R8-TEST-NOT-PRODUCTION-PIN';
 process.env.KK_ADMIN_SESSION_SECRET='R8-TEST-NOT-PRODUCTION-SIGNED-SESSION-KEY';
 try{return await fn();}
 finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
}
test('real signed Admin session permits only server-projected response',()=>withSignedTestKeys(async()=>{
 const real=require('../server/admin-session.js');
 const token=real._test.issueToken();
 const x=harness({realSecurity:true});
 x.req.headers.cookie=real.COOKIE_NAME+'='+token;
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,200);
 assert.equal(x.calls.upstream,1);
 assert.equal(JSON.parse(x.res.body).data.projection_version,PROJ.VERSION);
 for(const marker of ['SECRET_BOOKING_ID','SECRET_PHONE','SECRET_NAME'])assert.ok(!x.res.body.includes(marker));
}));
test('legacy PIN alone does not grant access to private operations endpoint',()=>withSignedTestKeys(async()=>{
 const x=harness({realSecurity:true});
 x.req.headers['x-admin-pin']=process.env.KK_ADMIN_PIN;
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,401);
 assert.equal(x.calls.upstream,0);
 assert.equal(JSON.parse(x.res.body).error_code,'OPS_SESSION_REQUIRED');
}));
test('tampering with a signed Admin cookie cannot bypass the private route',()=>withSignedTestKeys(async()=>{
 const real=require('../server/admin-session.js');
 const valid=real._test.issueToken();
 const invalid=valid.slice(0,-1)+(valid.endsWith('A')?'B':'A');
 const x=harness({realSecurity:true});
 x.req.headers.cookie=real.COOKIE_NAME+'='+invalid;
 x.req.headers['x-admin-pin']=process.env.KK_ADMIN_PIN;
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,401);
 assert.equal(x.calls.upstream,0);
}));

test('frozen incoming request with valid signed session works with legacy PIN reader, without mutation',()=>withSignedTestKeys(async()=>{
 const real=require('../server/admin-session.js');
 const token=real._test.issueToken();
 const x=harness({realSecurity:true,enforceLegacyPin:true});
 x.req.headers.cookie=real.COOKIE_NAME+'='+token;
 // Emulate hosted runtimes that expose read-only headers or requests.
 Object.freeze(x.req.headers);
 Object.freeze(x.req);
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,200);
 assert.equal(x.calls.upstream,1);
 assert.equal(x.calls.urls[0],'/api/kk-admin?action=snapshot');
 assert.equal(x.req.url,'/api/kk-admin?action=operationsSnapshot');
 assert.equal(x.req.headers['x-admin-pin'],undefined);
 assert.equal(JSON.parse(x.res.body).data.projection_version,PROJ.VERSION);
 assert.ok(!x.res.body.includes(process.env.KK_ADMIN_PIN));
}));
test('legacy reader never receives caller-supplied spoofed PIN when session valid',()=>withSignedTestKeys(async()=>{
 const real=require('../server/admin-session.js');
 const token=real._test.issueToken();
 const x=harness({realSecurity:true,enforceLegacyPin:true});
 x.req.headers.cookie=real.COOKIE_NAME+'='+token;
 x.req.headers['x-admin-pin']='WRONG_EXTERNAL_PIN';
 Object.freeze(x.req.headers);
 Object.freeze(x.req);
 await x.handler(x.req,x.res);
 assert.equal(x.res.statusCode,200);
 assert.equal(x.calls.upstream,1);
 assert.equal(x.req.headers['x-admin-pin'],'WRONG_EXTERNAL_PIN');
 assert.ok(!x.res.body.includes('WRONG_EXTERNAL_PIN'));
}));
