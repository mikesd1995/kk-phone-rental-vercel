'use strict';
// Guard bootstrap precedes every application and test import.
for (const key of Object.keys(process.env)) if (!['LANG','TZ','SystemRoot'].includes(key)) delete process.env[key];
const assert = require('node:assert/strict');
const {installNetworkGuards,createDummyTransport} = require('../line-booking-dummy-transport.cjs');
const guards = installNetworkGuards();
const crypto = require('node:crypto');
const transports = [];
let failures = 0, checks = 0;
process.once('exit', code => {
  const blockedAttempts = guards.blockedAttempts.length;
  const denials = transports.reduce((n,t)=>n+t.denials.length,0);
  const pending = transports.reduce((n,t)=>n+t.pending,0);
  if (blockedAttempts || denials || pending) process.exitCode=1;
  process.stdout.write('ADMISSION_RESULT '+JSON.stringify({evidenceClass:'LOCAL_MOCK',guardsInstalled:true,
    blockedAttempts,denials,pending,failures:failures||(code?1:0),checks})+'\n');
});
if (['auth-regression','auth-admitted-regression'].includes(process.argv[2])) {
  if (process.argv[2] === 'auth-admitted-regression') Object.assign(process.env, {
    KK_LINE_BOOKING_TEST_MODE:'true',KK_LINE_BOOKING_TEST_USER_IDS:'U'+'a'.repeat(32)
  });
  require('../../kk-customer-auth-endpoint.test.js');
} else {
  main().catch(err=>{failures++; process.exitCode=1; console.error(err.stack);});
}
const OWNER='U'+'a'.repeat(32), USER='U'+'b'.repeat(32), DENIED='U'+'c'.repeat(32);
function response(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(body=''){this.body=body;}};}
function fixture(routes=[]){const t=createDummyTransport({routes});transports.push(t);global.fetch=t.fetch;return t;}
const json = value => new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
function route(id,url,respond,max=20){return {id,url,method:'POST',max,respond};}
async function check(name,fn){try{await fn();checks++;}catch(err){err.message=name+': '+err.message;throw err;}}
async function main(){
  // Delay application imports until after all bootstrap bindings are initialized.
  await Promise.resolve();
  const webhook=require('../../../api/line-webhook');
  const booking=require('../../../server/line-booking-webhook')._test;
  const approval=require('../../../server/line-booking-owner-approval');
  const API=require('../../../api/kk-customer-auth');
  const OAuth=require('../../../server/kk-customer-line-oauth');
  const Terms=require('../../../server/kk-booking-terms-evidence');
  const env={LINE_CHANNEL_SECRET:'synthetic-admission-hmac',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-admission-token',
    KK_LINE_BOOKING_TEST_MODE:'true',KK_LINE_BOOKING_TEST_USER_IDS:OWNER+','+USER,KK_OWNER_LINE_USER_ID:OWNER,
    KK_INBOX_SUPABASE_URL:'https://admission-inbox.supabase.co',KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'synthetic-inbox-service-only'};
  Object.assign(process.env,env);
  const event=(userId=DENIED,type='user')=>({type:'message',webhookEventId:'synthetic-admission',timestamp:1794700800000,
    replyToken:'synthetic-unused',source:{type,userId},message:{type:'text',id:'12345678901',text:'สนใจเช่า Phone\nงาน: Synthetic\nวันที่: 18/11/2026\nสถานที่: Synthetic Hall\nราคา: 1 บาท\nชื่อเล่น: Synthetic'}});
  async function deliver(events){
    const raw=Buffer.from(JSON.stringify({events}));const res=response();
    await webhook({method:'POST',headers:{'x-line-signature':crypto.createHmac('sha256',env.LINE_CHANNEL_SECRET).update(raw).digest('base64')},
      async *[Symbol.asyncIterator](){yield raw;}},res);return res;
  }
  await check('denied signed users and private-source restriction precede every I/O',async()=>{
    const t=fixture();
    for(const e of [event(),event('Ubad'),event(USER,'group'),event(USER,'room'),{...event(),message:{type:'image',id:'12345678902'}}])
      assert.equal((await deliver([e])).statusCode,200);
    assert.equal((await booking.processEvent(event(),process.env,t.fetch)).handled,false);
    const data=approval.decisionData('approve','SYNTHETIC_BOOKING',process.env);
    for(const actor of [event(),event(OWNER,'group'),event(OWNER,'room')]){
      const post={...actor,type:'postback',postback:{data}};
      assert.equal((await approval.processOwnerPostback(post,process.env,t.fetch)).handled,false);
      assert.equal((await deliver([post])).statusCode,200);
    }
    assert.deepEqual(t.counters(),{});
  });
  await check('invalid list boolean and unsafe owner target fail before I/O',async()=>{
    const t=fixture();
    for(const patch of [{KK_LINE_BOOKING_TEST_MODE:''},{KK_LINE_BOOKING_TEST_USER_IDS:''},
      {KK_OWNER_LINE_USER_ID:DENIED},{KK_OWNER_LINE_TARGET_ID:'C'+'d'.repeat(32)},
      {KK_OWNER_LINE_TARGET_ID:'R'+'d'.repeat(32)},{KK_OWNER_LINE_TARGET_ID:DENIED}]){
      Object.assign(process.env,env,patch);
      assert.equal((await deliver([event(USER)])).statusCode,503);
      await assert.rejects(()=>booking.processEvent(event(USER),process.env,t.fetch),{code:'LINE_BOOKING_TEST_CONFIG_INVALID'});
      await assert.rejects(()=>approval.processOwnerPostback({type:'postback'},process.env,t.fetch),{code:'LINE_BOOKING_TEST_CONFIG_INVALID'});
      delete process.env.KK_OWNER_LINE_TARGET_ID;
    }
    Object.assign(process.env,env); assert.deepEqual(t.counters(),{});
  });
  await check('mixed signed batch reaches only admitted Inbox identity',async()=>{
    const t=fixture([
      {id:'PROFILE',url:'https://api.line.me/v2/bot/profile/'+USER,method:'GET',max:1,respond:()=>json({displayName:'Synthetic'})},
      route('INBOX','https://admission-inbox.supabase.co/rest/v1/rpc/kk_inbox_persist_inbound',()=>json({status:'INSERTED'}),1)
    ]);
    const admitted={...event(USER),message:{type:'text',id:'12345678903',text:'hello synthetic'}};
    assert.equal((await deliver([event(),admitted,event(USER,'room')])).statusCode,200);
    assert.deepEqual(t.counters(),{PROFILE:1,INBOX:1});t.assertComplete();
  });
  await check('allowlisted non-owner still fails existing owner authorization',async()=>{
    const t=fixture();
    const data=approval.decisionData('approve','SYNTHETIC_BOOKING',process.env);
    const out=await approval.processOwnerPostback({...event(USER),type:'postback',postback:{data}},process.env,t.fetch);
    assert.equal(out.status,'UNAUTHORIZED_OWNER');assert.deepEqual(t.counters(),{});
  });
  await check('literal false preserves admitted legacy Inbox even for an unlisted identity',async()=>{
    process.env.KK_LINE_BOOKING_TEST_MODE='false';process.env.KK_LINE_BOOKING_TEST_USER_IDS='invalid ignored';
    const t=fixture([
      {id:'PROFILE',url:'https://api.line.me/v2/bot/profile/'+DENIED,method:'GET',max:1,respond:()=>json({displayName:'Synthetic'})},
      route('INBOX','https://admission-inbox.supabase.co/rest/v1/rpc/kk_inbox_persist_inbound',()=>json({status:'INSERTED'}),1)
    ]);
    assert.equal((await deliver([{...event(),message:{type:'text',id:'12345678904',text:'hello synthetic'}}])).statusCode,200);
    assert.deepEqual(t.counters(),{PROFILE:1,INBOX:1});Object.assign(process.env,env);
  });
  const origin='https://admission.example',provider='synthetic-admission-provider',channel='1234567890';
  const secret='synthetic-admission-session-secret-12345678901234567890';
  Object.assign(process.env,{KK_CUSTOMER_LOGIN_ENABLED:'true',KK_LINE_LOGIN_PROVIDER_VERIFIED:'true',KK_CUSTOMER_AUTH_MIGRATION_VERIFIED:'true',
    KK_LINE_LOGIN_CHANNEL_ID:channel,KK_LINE_LOGIN_CHANNEL_SECRET:'synthetic-login-secret',KK_LINE_LOGIN_PROVIDER_ID:provider,
    KK_LINE_LOGIN_CALLBACK_URL:origin+'/api/kk-customer-auth?action=callback',KK_CUSTOMER_AUTH_SESSION_SECRET:secret,
    KK_CUSTOMER_AUTH_SUPABASE_URL:'https://admission-auth.supabase.co',KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role-only-key'});
  function req(action,method='GET',headers={},body){return {method,url:'/api/kk-customer-auth?action='+action,headers:{host:'admission.example',...headers},body};}
  const rpc=(name,respond)=>route(name,'https://admission-auth.supabase.co/rest/v1/rpc/'+name,respond);
  const token='x'.repeat(43),cookie=OAuth.SESSION_COOKIE+'='+token;
  const headers={cookie,origin,'x-kk-csrf':API._test.csrfFor(token,secret)};
  await check('enabled admission preserves CSRF rejection before identity discovery',async()=>{
    const t=fixture();
    for(const action of ['accept','logout']){
      const res=response();await API(req(action,'POST',{...headers,'x-kk-csrf':'invalid'},{accept:true,terms_version:Terms.VERSION}),res);
      assert.equal(res.statusCode,403);assert.equal(JSON.parse(res.body).status,'CSRF_REJECTED');
    }
    assert.deepEqual(t.counters(),{});
  });
  await check('invalid auth admission config makes zero provider/store calls',async()=>{
    const t=fixture();process.env.KK_LINE_BOOKING_TEST_MODE='yes';
    for(const action of ['start','callback','session','accept','logout']){
      const res=response();await API(req(action,['accept','logout'].includes(action)?'POST':'GET',headers),res);assert.equal(res.statusCode,503);
    }
    process.env.KK_LINE_BOOKING_TEST_MODE='true';assert.deepEqual(t.counters(),{});
  });
  await check('verified denied OAuth identity cannot create a session',async()=>{
    const t=fixture([
      route('TOKEN','https://api.line.me/oauth2/v2.1/token',()=>json({id_token:'synthetic-token'}),1),
      route('VERIFY','https://api.line.me/oauth2/v2.1/verify',options=>json({iss:'https://access.line.me',aud:channel,sub:DENIED,
        nonce:new URLSearchParams(options.body).get('nonce'),exp:Math.floor(Date.now()/1000)+600,iat:Math.floor(Date.now()/1000)}),1)
    ]);
    const start=response();await API(req('start'),start);
    const state=new URL(start.headers.location).searchParams.get('state');
    const incoming=req('callback','GET',{cookie:start.headers['set-cookie'].split(';')[0]});incoming.url+='&state='+encodeURIComponent(state)+'&code=synthetic-code';
    const res=response();await API(incoming,res);assert.equal(res.statusCode,403);
    assert.ok(res.headers['set-cookie'].some(value=>value.startsWith(OAuth.SESSION_COOKIE+'=')&&value.includes('Max-Age=0')));
    assert.deepEqual(t.counters(),{TOKEN:1,VERIFY:1});assert.doesNotMatch(res.body,/U[a-f0-9]{32}/);
  });
  await check('denied stored identity permits discovery read only on session accept logout',async()=>{
    const t=fixture([rpc('kk_customer_session_lookup',()=>json([{provider_id:provider,line_user_id:DENIED}]))]);
    for(const [action,method] of [['session','GET'],['accept','POST'],['logout','POST']]){
      const res=response();await API(req(action,method,headers,{accept:true,terms_version:Terms.VERSION}),res);
      assert.equal(res.statusCode,action==='session'?200:403);
      assert.match(res.headers['set-cookie'],/Max-Age=0/);assert.doesNotMatch(res.body,/U[a-f0-9]{32}/);
      if(action==='session')assert.equal(JSON.parse(res.body).authenticated,false);
    }
    assert.deepEqual(t.counters(),{kk_customer_session_lookup:3});
  });
  await check('admitted current identity retains acceptance receipt replay and logout',async()=>{
    let accepted=false;
    const receipt={provider_id:provider,line_user_id:USER,terms_version:Terms.VERSION,evidence_verified:true,
      evidence_source:'AUTHENTICATED_WEB_ACTION',accepted_at:new Date().toISOString(),evidence_reference:'web:'+'a'.repeat(32)};
    const t=fixture([
      rpc('kk_customer_session_lookup',()=>json([{provider_id:provider,line_user_id:USER}])),
      rpc('kk_customer_terms_lookup',()=>json(accepted?[receipt]:[])),
      rpc('kk_customer_terms_accept',()=>{accepted=true;return json([receipt]);}),
      rpc('kk_customer_session_revoke',()=>json(true))
    ]);
    const before=response();await API(req('session','GET',headers),before);assert.equal(JSON.parse(before.body).skip_agreement,false);
    const accept=response();await API(req('accept','POST',headers,{accept:true,terms_version:Terms.VERSION}),accept);assert.equal(accept.statusCode,200);
    const replay=response();await API(req('session','GET',headers),replay);assert.equal(JSON.parse(replay.body).skip_agreement,true);
    const logout=response();await API(req('logout','POST',headers),logout);assert.equal(logout.statusCode,200);
    assert.equal(t.counters().kk_customer_terms_accept,1);assert.equal(t.counters().kk_customer_session_revoke,1);
  });
}
