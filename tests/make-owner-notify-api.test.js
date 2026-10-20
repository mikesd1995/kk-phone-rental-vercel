'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const API=require('../server/kk-make-owner-notify.js');
const Contract=require('../server/make-owner-transport-contract.js');

const REF='zehlsagzrpromtfqqflt';
const env={
  KK_MAKE_OWNER_TRANSPORT_ENABLED:'true',
  KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:REF,
  SUPABASE_URL:'https://'+REF+'.supabase.co',
  SUPABASE_SECRET_KEY:'dummy-service-role-server-side-key',
  KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'x'.repeat(40),
  KK_OWNER_TELEGRAM_CHAT_ID:'-123456789'
};
const now=new Date();
const envelope=()=>Contract.buildEnvelope({
  notification_id:'notification_test_12345',request_id:'request_test_123456',
  event_type:'OWNER_ALERT',entity_id:'EVT-TEST',
  content_version:'a'.repeat(64),text:'Verified event notice only'
},env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET,new Date());
function req(body){
  const r=Readable.from([JSON.stringify(body)]);
  r.method='POST';
  r.headers={'content-type':'application/json'};
  return r;
}
function res(){
  return {statusCode:0,headers:{},body:'',
    setHeader(k,v){this.headers[k]=v;},end(v){this.body=String(v);},
    data(){return JSON.parse(this.body);}
  };
}
test('transport is disabled by default, missing secret or wrong Supabase project',()=>{
  assert.equal(API._test.config({}).ready,false);
  assert.equal(API._test.config({...env,KK_MAKE_OWNER_TRANSPORT_ENABLED:'false'}).ready,false);
  assert.equal(API._test.config({...env,KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:'other'}).ready,false);
  assert.equal(API._test.config({...env,KK_OWNER_TELEGRAM_CHAT_ID:'customer-user'}).ready,false);
});
test('disabled endpoint makes zero external calls, even on signed input',async()=>{
  let called=0;const out=res();
  await API._test.processRequest(req({stage:'prepare',envelope:envelope()}),out,{
    ...env,KK_MAKE_OWNER_TRANSPORT_ENABLED:'false'
  },async()=>{called++;throw Error('must not call');});
  assert.equal(out.statusCode,503);
  assert.equal(out.data().send_allowed,false);
  assert.equal(called,0);
});
test('unsigned or tampered body never touches durable store',async()=>{
  let called=0;
  const out=res();
  await API._test.processRequest(req({stage:'prepare',envelope:{...envelope(),text:'tampered'}}),out,env,async()=>{called++;});
  assert.equal(out.statusCode,401);
  assert.equal(out.data().error_code,'SIGNATURE_INVALID');
  assert.equal(called,0);
});
test('prepare authorizes only exact reserved notification and fixed owner chat',async()=>{
  let url='',post;
  const out=res();
  await API._test.processRequest(req({stage:'prepare',envelope:envelope()}),out,env,async(u,init)=>{
    url=u;post=JSON.parse(init.body);
    return {ok:true,json:async()=>[{status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'}]};
  });
  assert.equal(out.statusCode,200);
  assert.equal(out.data().send_allowed,true);
  assert.equal(out.data().target_chat_id,'-123456789');
  assert.match(url,/kk_make_owner_notification_claim$/);
  assert.equal(post.p_entity_id,'EVT-TEST');
});
test('duplicate claim cannot send a second owner notice',async()=>{
  const out=res();
  await API._test.processRequest(req({stage:'prepare',envelope:envelope()}),out,env,async()=>({
    ok:true,json:async()=>[]
  }));
  assert.equal(out.statusCode,409);
  assert.equal(out.data().send_allowed,false);
});
test('ack is receipt-scoped and requires success from durable store',async()=>{
  const e=envelope(),receipt='11111111-2222-4333-8444-555555555555';
  const invalid=res();
  await API._test.processRequest(req({stage:'ack',envelope:e,receipt_id:receipt,provider_message_id:'forged'}),invalid,env,async()=>{throw Error('must not call');});
  assert.equal(invalid.statusCode,400);
  const out=res();
  let payload;
  await API._test.processRequest(req({stage:'ack',envelope:e,receipt_id:receipt,provider_message_id:'1234'}),out,env,async(_url,init)=>{
    payload=JSON.parse(init.body);
    return {ok:true,json:async()=>[{status:'SENT',provider_message_id:'1234'}]};
  });
  assert.equal(out.statusCode,200);
  assert.equal(out.data().status,'SENT');
  assert.equal(payload.p_receipt_id,receipt);
});
test('conflicting ack never claims delivery success',async()=>{
  const out=res();
  await API._test.processRequest(req({stage:'ack',envelope:envelope(),receipt_id:'11111111-2222-4333-8444-555555555555',provider_message_id:'1234'}),out,env,async()=>({ok:true,json:async()=>[]}));
  assert.equal(out.statusCode,409);
  assert.equal(out.data().status,undefined);
});

test('new opaque Supabase secret key uses only apikey, legacy JWT keeps Bearer',async()=>{
  for(const key of ['sb_secret_test_dummy','eyJfakeLegacyJwt']){
    let seen;
    const data=await API._test.rpc('kk_make_owner_notification_claim',{},
      {url:'https://example.supabase.co',key},async(_url,options)=>{
        seen=options.headers;
        return {ok:true,json:async()=>[]};
      });
    assert.deepEqual(data,[]);
    assert.equal(seen.apikey,key);
    assert.equal(Object.hasOwn(seen,'Authorization'),!key.startsWith('sb_secret_'));
    if(!key.startsWith('sb_secret_'))assert.equal(seen.Authorization,'Bearer '+key);
  }
});

test('Hobby deployment shares scanner Function; owner route remains fail-closed by default',async()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const route=vercel.rewrites.find(r=>r.source==='/api/kk-make-owner-notify');
  assert.equal(route.destination,'/api/kk-scanner-dispatch?owner_transport=v1');
  assert.equal(fs.existsSync(path.join(root,'api/kk-make-owner-notify.js')),false);
  assert.equal(fs.existsSync(path.join(root,'server/kk-make-owner-notify.js')),true);
  const scanner=require('../api/kk-scanner-dispatch.js');
  const request=req({stage:'prepare',envelope:envelope()});
  request.url='/api/kk-scanner-dispatch?owner_transport=v1';
  const output=res();
  await scanner(request,output);
  assert.equal(output.statusCode,503);
  assert.equal(output.data().error_code,'MAKE_OWNER_TRANSPORT_DISABLED_OR_UNBOUND');
  assert.equal(output.data().send_allowed,false);
});

test('ambiguous multiple durable claim rows never authorize an arbitrary first receipt',async()=>{
  const out=res();
  await API._test.processRequest(req({stage:'prepare',envelope:envelope()}),out,env,async()=>({ok:true,json:async()=>[
    {status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'},
    {status:'RESERVED',receipt_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}
  ]}));
  assert.equal(out.statusCode,409);
  assert.equal(out.data().send_allowed,false);
});

test('ACK must echo the exact provider identifier before reporting SENT',async()=>{
  for(const provider of ['9999',null,undefined]){
    const out=res();
    await API._test.processRequest(req({stage:'ack',envelope:envelope(),receipt_id:'11111111-2222-4333-8444-555555555555',provider_message_id:'1234'}),out,env,async()=>({ok:true,json:async()=>[{status:'SENT',provider_message_id:provider}]}));
    assert.equal(out.statusCode,409,String(provider));
    assert.equal(out.data().status,undefined);
  }
});

test('ACK requires a strict UUID and string provider id before any RPC',async()=>{
  for(const patch of [
    {receipt_id:'-'.repeat(36)},
    {receipt_id:'00000000-0000-0000-0000-000000000000'},
    {receipt_id:'11111111-2222-4333-7444-555555555555'},
    {provider_message_id:['1234']},
    {provider_message_id:' 1234 '}
  ]){
    let calls=0;const out=res();
    await API._test.processRequest(req({stage:'ack',envelope:envelope(),receipt_id:'11111111-2222-4333-8444-555555555555',provider_message_id:'1234',...patch}),out,env,async()=>{calls++;return {ok:true,json:async()=>[{status:'SENT',provider_message_id:'1234'}]};});
    assert.equal(out.statusCode,400,JSON.stringify(patch));
    assert.equal(calls,0);
  }
});

test('preparsed request bodies must be plain JSON objects',async()=>{
  for(const value of [[],Buffer.from('{}'),new Date(),Object.create({stage:'prepare'})]){
    let calls=0;const out=res();const input=req({});input.body=value;
    await API._test.processRequest(input,out,env,async()=>{calls++;throw Error('must not call');});
    assert.equal(out.statusCode,400,Object.prototype.toString.call(value));
    assert.equal(out.data().error_code,'BODY_INVALID');
    assert.equal(calls,0);
  }
});

test('body limit counts UTF8 bytes for parsed and streamed requests',async()=>{
  for(const parsed of [false,true]){
    const body={stage:'prepare',envelope:envelope(),padding:'ก'.repeat(4000)};
    const input=req(body);if(parsed)input.body=body;
    const out=res();let calls=0;
    await API._test.processRequest(input,out,env,async()=>{calls++;});
    assert.equal(out.statusCode,400);
    assert.equal(out.data().error_code,'BODY_INVALID');
    assert.equal(calls,0);
  }
});

test('split Thai UTF8 bytes retain the exact signed message',async()=>{
  const e=Contract.buildEnvelope({notification_id:'notification_test_12345',request_id:'request_test_123456',event_type:'OWNER_ALERT',entity_id:'EVT-TEST',content_version:'a'.repeat(64),text:'งานใหม่ ก'},env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET,new Date());
  const bytes=Buffer.from(JSON.stringify({stage:'prepare',envelope:e}));
  const split=bytes.indexOf(Buffer.from('ก'))+1;
  const input=Readable.from([bytes.subarray(0,split),bytes.subarray(split)]);input.method='POST';input.headers={'content-type':'application/json'};
  const out=res();
  await API._test.processRequest(input,out,env,async()=>({ok:true,json:async()=>[{status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'}]}));
  assert.equal(out.statusCode,200);
  assert.equal(out.data().text,'งานใหม่ ก');
});

test('RPC rejects redirects instead of forwarding server credentials',async()=>{
  let options;
  await API._test.rpc('kk_make_owner_notification_claim',{},API._test.config(env),async(_url,init)=>{options=init;return {ok:true,json:async()=>[]};});
  assert.equal(options.redirect,'error');
});

for(const boundary of ['fetch','body']){
  test('RPC deadline covers a stalled '+boundary+' and aborts its request',async context=>{
    const realSetTimeout=global.setTimeout;
    context.mock.method(global,'setTimeout',(fn,delay,...args)=>realSetTimeout(fn,Math.min(delay,5),...args));
    let signal,bodyStarted=false;
    const request=API._test.rpc('kk_make_owner_notification_claim',{},API._test.config(env),async(_url,init)=>{
      signal=init.signal;
      if(boundary==='fetch')return new Promise(()=>{});
      return {ok:true,json:async()=>{bodyStarted=true;return new Promise(()=>{});}};
    }).then(()=>({code:'UNEXPECTED_SUCCESS'}),error=>error);
    const outcome=await Promise.race([request,new Promise(resolve=>realSetTimeout(()=>resolve({code:'NO_BOUNDED_DEADLINE'}),70))]);
    assert.equal(outcome.code,'DURABLE_STORE_TIMEOUT');
    assert.equal(signal.aborted,true);
    if(boundary==='body')assert.equal(bodyStarted,true);
  });
}

test('stage must be an exact string and outer fields stay within each v1 stage schema',async()=>{
  const valid={stage:'prepare',envelope:envelope()};
  for(const patch of [
    {stage:['prepare']},
    {stage:{toString(){return 'prepare';}}},
    {stage:' prepare '},
    {recipient:'customer'},
    {booking_status:'confirmed'},
    {owner_approved:true},
    {receipt_id:'11111111-2222-4333-8444-555555555555'},
    {provider_message_id:'1234'}
  ]){
    const input=req({});input.body={...valid,...patch};
    let calls=0;const out=res();
    await API._test.processRequest(input,out,env,async()=>{calls++;return {ok:true,json:async()=>[{status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'}]};});
    assert.equal(out.statusCode,400,JSON.stringify(patch));
    assert.equal(out.data().send_allowed,false);
    assert.equal(calls,0);
  }
  const out=res();let calls=0;
  await API._test.processRequest(req({stage:'ack',envelope:envelope(),receipt_id:'11111111-2222-4333-8444-555555555555',provider_message_id:'1234',recipient:'customer'}),out,env,async()=>{calls++;return {ok:true,json:async()=>[{status:'SENT',provider_message_id:'1234'}]};});
  assert.equal(out.statusCode,400);
  assert.equal(calls,0);
});
