'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const OAuth = require('../server/kk-customer-line-oauth');
const { createStore } = require('../server/kk-customer-auth-store');
const API = require('../api/kk-customer-auth');
const Terms = require('../server/kk-booking-terms-evidence');

const SECRET = 'synthetic-session-secret-for-node-tests-only-123';
const CHANNEL = '1234567890';
const CALLBACK = 'https://kk-phone-rental.vercel.app/api/kk-customer-auth?action=callback';
const USER = 'U' + 'a'.repeat(32);
const PROVIDER = 'kk-test-provider';
const now = Date.parse('2026-11-10T00:00:00+07:00');

function mockResponse(result) {
  return {ok: true, json: async () => result};
}
function reply() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(key,value) {this.headers[key.toLowerCase()] = value;},
    end(body = '') {this.body = body;}
  };
}

test('secure OAuth start contains state, nonce, PKCE S256 and minimal openid scope only', () => {
  const out = OAuth.beginLogin({channelId:CHANNEL,callbackUrl:CALLBACK,secret:SECRET,nowMs:now});
  const url = new URL(out.url);
  assert.equal(url.origin,'https://access.line.me');
  assert.equal(url.searchParams.get('scope'),'openid');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),CALLBACK);
  assert.ok(url.searchParams.get('state'));
  assert.ok(url.searchParams.get('nonce'));
  assert.match(out.flowCookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(out.flowCookie, /client_secret|line_user_id|access_token/);
  const sealed = out.flowCookie.split(';')[0].split('=').slice(1).join('=');
  const flow = OAuth.finishFlow({sealed,state:url.searchParams.get('state'),secret:SECRET,nowMs:now+1000});
  assert.ok(flow && flow.verifier && flow.nonce);
  assert.equal(require('node:crypto').createHash('sha256').update(flow.verifier).digest('base64url'),
    url.searchParams.get('code_challenge'));
});

test('OAuth flow refuses tampered cookies, mismatched state, expired or future flow', () => {
  const out = OAuth.beginLogin({channelId:CHANNEL,callbackUrl:CALLBACK,secret:SECRET,nowMs:now});
  const value=out.flowCookie.split(';')[0].split('=').slice(1).join('=');
  const state=new URL(out.url).searchParams.get('state');
  assert.equal(OAuth.finishFlow({sealed:value,state:'WRONG',secret:SECRET,nowMs:now+1}),null);
  assert.equal(OAuth.finishFlow({sealed:value,state,secret:SECRET,nowMs:now+OAuth.FLOW_TTL_MS+1}),null);
  assert.equal(OAuth.finishFlow({sealed:value,state,secret:SECRET,nowMs:now-1}),null);
  assert.equal(OAuth.finishFlow({sealed:value.slice(0,-1)+'x',state,secret:SECRET,nowMs:now+1}),null);
  assert.equal(OAuth.finishFlow({sealed:value,state,secret:'not-the-secret',nowMs:now+1}),null);
});

test('LINE server-side code exchange checks both PKCE and verified ID token claims',async()=>{
  const calls=[];
  const fake=async (url,options)=>{
    calls.push({url,body:new URLSearchParams(options.body)});
    if(url.endsWith('/token')) return mockResponse({id_token:'synthetic-id-token'});
    return mockResponse({iss:'https://access.line.me',sub:USER,aud:CHANNEL,
      nonce:'nonce-value-1234567890123456789012345678',exp:Math.floor(now/1000)+900,iat:Math.floor(now/1000)});
  };
  const identity=await OAuth.authenticateCode({
    code:'synthetic-code',verifier:'a'.repeat(43),
    nonce:'nonce-value-1234567890123456789012345678',
    channelId:CHANNEL,channelSecret:'server-only',callbackUrl:CALLBACK,fetchImpl:fake,nowMs:now
  });
  assert.equal(identity.line_user_id,USER);
  assert.equal(identity.authentication,'LINE_ID_TOKEN_SERVER_VERIFIED');
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.get('code_verifier'),'a'.repeat(43));
  assert.equal(calls[1].body.get('client_id'),CHANNEL);
  assert.equal(calls[1].body.get('nonce'),'nonce-value-1234567890123456789012345678');
});

test('token claim mismatch, wrong issuer/provider and expiry all fail closed',async()=>{
  const base={iss:'https://access.line.me',sub:USER,aud:CHANNEL,nonce:'n'.repeat(32),
    exp:Math.floor(now/1000)+900,iat:Math.floor(now/1000)};
  for(const wrong of [
    {aud:'other'}, {iss:'https://evil.invalid'}, {sub:'U'.concat('z'.repeat(32))},
    {nonce:'bad'}, {exp:Math.floor(now/1000)-1}, {iat:Math.floor(now/1000)+1000}
  ]) {
    const fake=async url=>mockResponse(url.endsWith('/token')?{id_token:'synthetic'}:{...base,...wrong});
    await assert.rejects(OAuth.authenticateCode({
      code:'abcd',verifier:'a'.repeat(43),nonce:'n'.repeat(32),
      channelId:CHANNEL,channelSecret:'secret',callbackUrl:CALLBACK,fetchImpl:fake,nowMs:now
    }),/LINE_ID_TOKEN_CLAIMS_INVALID/);
  }
});

test('PostgREST adapter never uses public user credentials and returns only bounded evidence',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    const name=url.split('/').pop();
    if(name==='kk_customer_session_create') return mockResponse(true);
    if(name==='kk_customer_session_lookup') return mockResponse([{provider_id:PROVIDER,line_user_id:USER}]);
    if(name==='kk_customer_terms_lookup'||name==='kk_customer_terms_accept') return mockResponse([{
      provider_id:PROVIDER,line_user_id:USER,terms_version:Terms.VERSION,
      accepted_at:'2026-11-07T12:00:00+07:00',evidence_source:'AUTHENTICATED_WEB_ACTION',
      evidence_verified:true,evidence_reference:'web:synthetic-acceptance-reference-001'
    }]);
    return mockResponse(true);
  };
  const s=createStore({url:'https://example.supabase.co',serviceKey:'synthetic-service-role-secret',fetchImpl});
  const hash='a'.repeat(64);
  await s.createSession(hash,PROVIDER,USER,'2026-11-17T00:00:00+07:00');
  assert.equal((await s.readSession(hash)).authentication,'LINE_ID_TOKEN_SERVER_VERIFIED');
  assert.equal((await s.findAcceptance(hash,Terms.VERSION)).terms_version,Terms.VERSION);
  assert.ok((await s.acceptTerms(hash,Terms.VERSION,'web:'+'a'.repeat(30))).evidence_verified);
  assert.equal(await s.revokeSession(hash),true);
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer synthetic-service-role-secret'));
  assert.ok(calls.every(c=>c.url.includes('/rest/v1/rpc/kk_customer_')));
  assert.ok(calls.every(c=>c.options.method==='POST'));
});

test('default-off auth and release-gated configuration never contact identity provider',async()=>{
  assert.equal(API._test.runtime({}),null);
  assert.throws(()=>API._test.runtime({KK_CUSTOMER_LOGIN_ENABLED:'true'}),/RELEASE_GATES_UNMET/);
  const res=reply();
  await API({method:'GET',headers:{host:'kk-phone-rental.vercel.app'},url:'/api/kk-customer-auth?action=session'},res);
  assert.equal(res.statusCode,404);
  assert.equal(JSON.parse(res.body).status,'FEATURE_DISABLED');
});

test('release preflight forbids unapproved or off-host callback configs',()=>{
  const env={
    KK_CUSTOMER_LOGIN_ENABLED:'true', KK_LINE_LOGIN_PROVIDER_VERIFIED:'true',
    KK_CUSTOMER_AUTH_MIGRATION_VERIFIED:'true', KK_LINE_LOGIN_CHANNEL_ID:CHANNEL,
    KK_LINE_LOGIN_CHANNEL_SECRET:'synthetic-client-secret',
    KK_LINE_LOGIN_PROVIDER_ID:PROVIDER, KK_LINE_LOGIN_CALLBACK_URL:CALLBACK,
    KK_CUSTOMER_AUTH_SESSION_SECRET:SECRET,
    KK_CUSTOMER_AUTH_SUPABASE_URL:'https://example.supabase.co',
    KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role-secret'
  };
  assert.equal(API._test.runtime(env).host,'kk-phone-rental.vercel.app');
  assert.throws(()=>API._test.runtime({...env,KK_LINE_LOGIN_CALLBACK_URL:'https://evil.invalid/cb'}),/CALLBACK_INVALID/);
  assert.throws(()=>API._test.runtime({...env,KK_LINE_LOGIN_PROVIDER_VERIFIED:'false'}),/RELEASE_GATES_UNMET/);
});

test('cross-origin acceptance, missing affirmation and wrong Terms version are rejected',async()=>{
  const config={origin:'https://kk-phone-rental.vercel.app',secret:SECRET};
  const req={headers:{origin:'https://evil.invalid','x-kk-csrf':API._test.csrfFor('token',SECRET)}};
  assert.equal(API._test.validOrigin(req,config),false);
  await assert.rejects(API._test.readAffirmation({body:{accept:false,terms_version:Terms.VERSION}}),/AFFIRMATION_REQUIRED/);
  await assert.rejects(API._test.readAffirmation({body:{accept:true,terms_version:'KK-TERMS-2026-11-05'}}),/AFFIRMATION_REQUIRED/);
  assert.equal(await API._test.readAffirmation({body:{accept:true,terms_version:Terms.VERSION}}),true);
});

test('SQL migration is private source only and does not edit existing booking/inbox schemas',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/kk_customer_auth_v1.sql'),'utf8');
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table public\.kk_customer_terms_evidence from public, anon, authenticated/);
  assert.match(sql,/on conflict \(provider_id, line_user_id, terms_version\) do nothing/);
  assert.match(sql,/grant execute on function public\.kk_customer_terms_accept/);
  assert.doesNotMatch(sql,/drop table|alter table public\.kk_inbox_|alter table public\.bookings/i);
});
