'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const O=require('../server/kk-github-oidc.js');

function b64(v){return Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');}
function tokenFor(payload,privateKey,kid='K1'){
 const h=b64({alg:'RS256',typ:'JWT',kid});
 const p=b64(payload);
 const input=h+'.'+p;
 const sig=crypto.sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
 return input+'.'+sig;
}

test('verifies GitHub OIDC signature and exact workflow claims',async()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk=publicKey.export({format:'jwk'});jwk.kid='K1';jwk.kty='RSA';
 const now=Math.floor(Date.now()/1000);
 const payload={
  iss:O.ISSUER,aud:O.AUDIENCE,exp:now+300,nbf:now-5,
  repository:'mikesd1995/kk-phone-rental-vercel',repository_owner:'mikesd1995',
  ref:'refs/heads/main',
  workflow_ref:'mikesd1995/kk-phone-rental-vercel/.github/workflows/ultra-deep-full-loop.yml@refs/heads/main',
  run_id:'123',sha:'a'.repeat(40),actor:'mikesd1995',event_name:'issue_comment',sub:'repo:test'
 };
 const fetchImpl=async()=>({ok:true,json:async()=>({keys:[jwk]})});
 const out=await O.verifyToken(tokenFor(payload,privateKey),{
  repository:payload.repository,owner:payload.repository_owner,ref:payload.ref,
  workflow_ref:'mikesd1995/kk-phone-rental-vercel/.github/workflows/ultra-deep-full-loop.yml@',
  run_id:'123',sha:'a'.repeat(40),actor:'mikesd1995',event_name:'issue_comment'
 },{fetchImpl});
 assert.equal(out.verified,true);
 assert.equal(out.claims.run_id,'123');
});

test('rejects valid signature when workflow claim is wrong',async()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk=publicKey.export({format:'jwk'});jwk.kid='K2';jwk.kty='RSA';
 const now=Math.floor(Date.now()/1000);
 const payload={iss:O.ISSUER,aud:O.AUDIENCE,exp:now+300,nbf:now-5,repository:'mikesd1995/kk-phone-rental-vercel',repository_owner:'mikesd1995',ref:'refs/heads/main',workflow_ref:'evil/repo/.github/workflows/x.yml@refs/heads/main',run_id:'123',sha:'b'.repeat(40),actor:'mikesd1995',event_name:'issue_comment'};
 const fetchImpl=async()=>({ok:true,json:async()=>({keys:[jwk]})});
 await assert.rejects(()=>O.verifyToken(tokenFor(payload,privateKey,'K2'),{repository:payload.repository,workflow_ref:'mikesd1995/kk-phone-rental-vercel/.github/workflows/ultra-deep-full-loop.yml@'},{fetchImpl}),err=>err&&err.code==='OIDC_CLAIMS_REJECTED');
});
