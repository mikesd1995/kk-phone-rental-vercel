'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const API=require('../api/kk-make-owner-notify.js');
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
