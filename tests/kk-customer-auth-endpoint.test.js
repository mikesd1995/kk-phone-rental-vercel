'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const API = require('../api/kk-customer-auth');
const OAuth = require('../server/kk-customer-line-oauth');
const Terms = require('../server/kk-booking-terms-evidence');
const crypto = require('node:crypto');

const URL_BASE='https://kk-phone-rental.vercel.app';
const CALLBACK=URL_BASE+'/api/kk-customer-auth?action=callback';
const CHANNEL='1234567890', USER='U'+'a'.repeat(32), PROVIDER='kk-synthetic-provider';
const SECRET='synthetic-super-long-server-session-secret-kk-123456';
const PARAMS={
 KK_CUSTOMER_LOGIN_ENABLED:'true', KK_LINE_LOGIN_PROVIDER_VERIFIED:'true',
 KK_CUSTOMER_AUTH_MIGRATION_VERIFIED:'true',
 KK_LINE_LOGIN_CHANNEL_ID:CHANNEL, KK_LINE_LOGIN_CHANNEL_SECRET:'synthetic-line-secret',
 KK_LINE_LOGIN_PROVIDER_ID:PROVIDER, KK_LINE_LOGIN_CALLBACK_URL:CALLBACK,
 KK_CUSTOMER_AUTH_SESSION_SECRET:SECRET,
 KK_CUSTOMER_AUTH_SUPABASE_URL:'https://example.supabase.co',
 KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-only-supabase-key'
};
function response() {
 return { statusCode:200, headers:{},
  setHeader(k,v){this.headers[k.toLowerCase()]=v;},
  end(v=''){this.body=v;}
 };
}
function req(action,method='GET',extra={}) {
 return {
  method,url:'/api/kk-customer-auth?action='+action,
  headers:{host:'kk-phone-rental.vercel.app',...extra.headers},
  ...(Object.prototype.hasOwnProperty.call(extra,'body')?{body:extra.body}:{})
 };
}
async function withEnv(run) {
 const old=Object.fromEntries(Object.keys(PARAMS).map(k=>[k,process.env[k]]));
 const fetchBefore=global.fetch;
 try {
  Object.assign(process.env,PARAMS);
  return await run();
 } finally {
  global.fetch=fetchBefore;
  for(const [key,value] of Object.entries(old)) {
   if(typeof value==='undefined') delete process.env[key];
   else process.env[key]=value;
  }
 }
}

test('complete isolated enabled API: guest, OAuth start, server verification, session, accept once and logout', async()=>{
 await withEnv(async()=>{
  let sessionHash='', acceptance=null, isRevoked=false, providerTokenVerified=false;
  const rpcCalls=[];
  global.fetch=async(url,options)=>{
   const action=url.split('/').pop();
   if(url.endsWith('/oauth2/v2.1/token')) {
    const form=new URLSearchParams(options.body);
    assert.ok(form.get('code_verifier'));
    return {ok:true,json:async()=>({id_token:'fake-id-token'})};
   }
   if(url.endsWith('/oauth2/v2.1/verify')) {
    providerTokenVerified=true;
    const form=new URLSearchParams(options.body);
    return {ok:true,json:async()=>({
     iss:'https://access.line.me',aud:CHANNEL,sub:USER,nonce:form.get('nonce'),
     exp:Math.floor(Date.now()/1000)+600,iat:Math.floor(Date.now()/1000)
    })};
   }
   rpcCalls.push(action);
   const input=JSON.parse(options.body);
   if(action==='kk_customer_session_create') {
    sessionHash=input.p_token_hash;
    assert.equal(input.p_provider_id,PROVIDER);
    assert.equal(input.p_line_user_id,USER);
    return {ok:true,json:async()=>true};
   }
   if(action==='kk_customer_session_lookup') return {
    ok:true,json:async()=> isRevoked||input.p_token_hash!==sessionHash
      ?[]:[{provider_id:PROVIDER,line_user_id:USER}]
   };
   if(action==='kk_customer_terms_lookup') return {ok:true,json:async()=>acceptance?[acceptance]:[]};
   if(action==='kk_customer_terms_accept') {
    acceptance={
     provider_id:PROVIDER,line_user_id:USER,terms_version:Terms.VERSION,
     evidence_verified:true,evidence_source:'AUTHENTICATED_WEB_ACTION',
     accepted_at:new Date().toISOString(),evidence_reference:input.p_evidence_reference
    };
    return {ok:true,json:async()=>[acceptance]};
   }
   if(action==='kk_customer_session_revoke') {
    isRevoked=true;
    return {ok:true,json:async()=>true};
   }
   throw Error('unexpected synthetic URL '+url);
  };
  const guest=response();
  await API(req('session'),guest);
  assert.equal(guest.statusCode,200);
  assert.equal(JSON.parse(guest.body).authenticated,false);

  const start=response();
  await API(req('start'),start);
  assert.equal(start.statusCode,303);
  assert.match(start.headers.location,/access\.line\.me\/oauth2\/v2\.1\/authorize/);
  const flowCookie=start.headers['set-cookie'].split(';')[0];
  const state=new URL(start.headers.location).searchParams.get('state');
  const cb=response();
  await API(req('callback','GET',{headers:{cookie:flowCookie},
    body:undefined}),cb); // no state or code -> must not authenticate
  assert.equal(cb.statusCode,400);
  assert.equal(providerTokenVerified,false);

  const callback=response();
  const incoming=req('callback');
  incoming.url+='&state='+encodeURIComponent(state)+'&code=synthetic-code';
  incoming.headers.cookie=flowCookie;
  await API(incoming,callback);
  assert.equal(callback.statusCode,303);
  assert.equal(callback.headers.location,'/');
  assert.equal(providerTokenVerified,true);
  const setCookies=callback.headers['set-cookie'];
  assert.ok(Array.isArray(setCookies));
  const raw=setCookies[1].split(';')[0];
  const token=raw.split('=').slice(1).join('=');
  assert.equal(sessionHash,crypto.createHash('sha256').update(token).digest('hex'));

  const before=response();
  await API(req('session','GET',{headers:{cookie:raw}}),before);
  assert.equal(JSON.parse(before.body).authenticated,true);
  assert.equal(JSON.parse(before.body).skip_agreement,false);
  const csrf=JSON.parse(before.body).csrf;
  assert.ok(csrf);

  const rejected=response();
  await API(req('accept','POST',{
   headers:{cookie:raw,origin:'https://attacker.invalid','x-kk-csrf':csrf},
   body:{accept:true,terms_version:Terms.VERSION}
  }),rejected);
  assert.equal(rejected.statusCode,403);
  assert.ok(!acceptance);

  const accepted=response();
  await API(req('accept','POST',{
   headers:{cookie:raw,origin:URL_BASE,'x-kk-csrf':csrf},
   body:{accept:true,terms_version:Terms.VERSION}
  }),accepted);
  assert.equal(accepted.statusCode,200);
  assert.equal(JSON.parse(accepted.body).skip_agreement,true);

  const returning=response();
  await API(req('session','GET',{headers:{cookie:raw}}),returning);
  assert.equal(JSON.parse(returning.body).skip_agreement,true);
  assert.ok(!returning.body.includes(USER));
  assert.ok(!returning.body.includes(PROVIDER));

  const logout=response();
  await API(req('logout','POST',{headers:{cookie:raw,origin:URL_BASE,'x-kk-csrf':csrf}}),logout);
  assert.equal(logout.statusCode,200);
  assert.match(logout.headers['set-cookie'],/Max-Age=0/);

  const after=response();
  await API(req('session','GET',{headers:{cookie:raw}}),after);
  assert.equal(JSON.parse(after.body).authenticated,false);
  assert.deepEqual(
   rpcCalls.filter(x=>x==='kk_customer_terms_accept').length,1);
 });
});

test('provider token never reaches customer response; failed durable write is 503, not success',async()=>{
 await withEnv(async()=>{
  global.fetch=async (url)=>{
   if(url.includes('kk_customer_session_lookup')) return {ok:true,json:async()=>[{provider_id:PROVIDER,line_user_id:USER}]};
   return {ok:false,status:500,json:async()=>({message:'upstream failure'})};
  };
  const token=OAuth.randomToken();
  const out=response();
  await API(req('session','GET',{headers:{cookie:OAuth.SESSION_COOKIE+'='+token}}),out);
  assert.equal(out.statusCode,503);
  assert.equal(JSON.parse(out.body).status,'CUSTOMER_AUTH_UNAVAILABLE');
  assert.doesNotMatch(out.body,/upstream|service_role|Bearer|U[a-f0-9]{32}/);
 });
});

test('host boundary rejects external proxies even with otherwise valid release env',async()=>{
 await withEnv(async()=>{
  const out=response();
  await API(req('start','GET',{headers:{host:'attacker.invalid'}}),out);
  assert.equal(out.statusCode,403);
  assert.equal(JSON.parse(out.body).status,'HOST_NOT_ALLOWED');
 });
});
