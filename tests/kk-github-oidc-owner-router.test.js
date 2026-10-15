'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const OIDC=require('../server/kk-github-oidc.js');

test('OIDC accepts only exact direct or owner-router reusable workflow refs with matching signed child', async()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const kid='KK-CLEANUP-ROUTER-TEST';
 const jwk={...publicKey.export({format:'jwk'}),kid,kty:'RSA'};
 const fetchImpl=async()=>({ok:true,json:async()=>({keys:[jwk]})});
 const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid})).toString('base64url');
 const sign=claims=>{
  const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature=crypto.sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
  return h+'.'+p+'.'+signature;
 };
 const repo='mikesd1995/kk-phone-rental-vercel';
 const ref='refs/heads/main';
 const target=repo+'/.github/workflows/ultra-deep-full-loop.yml@';
 assert.equal(OIDC.ROUTER_WORKFLOW_REF,'.github/workflows/kk-owner-comment-command-router.yml@');
 const router=repo+'/'+OIDC.ROUTER_WORKFLOW_REF+ref;
 const now=Math.floor(Date.now()/1000);
 const claims={
  iss:OIDC.ISSUER,aud:OIDC.AUDIENCE,nbf:now-10,exp:now+300,
  repository:repo,repository_owner:'mikesd1995',ref,
  workflow_ref:router,job_workflow_ref:target+ref,
  run_id:'777',sha:'a'.repeat(40),actor:'mikesd1995',event_name:'issue_comment'
 };
 const expected={
  repository:repo,owner:'mikesd1995',ref,workflow_ref:target,
  run_id:'777',sha:'a'.repeat(40),actor:'mikesd1995',event_name:'issue_comment'
 };
 const good=await OIDC.verifyToken(sign(claims),expected,{fetchImpl});
 assert.equal(good.verified,true);
 const direct=await OIDC.verifyToken(sign({...claims,workflow_ref:target+ref,job_workflow_ref:undefined}),expected,{fetchImpl});
 assert.equal(direct.verified,true);
 for(const override of [
  {job_workflow_ref:target+'refs/heads/other'},
  {job_workflow_ref:repo+'/.github/workflows/other.yml@'+ref},
  {job_workflow_ref:undefined},
  {workflow_ref:router.replace('kk-owner-comment-command-router','owner-command-router')},
  {workflow_ref:target+'refs/heads/other',job_workflow_ref:undefined}
 ]){
  await assert.rejects(
   ()=>OIDC.verifyToken(sign({...claims,...override}),expected,{fetchImpl}),
   err=>err&&err.code==='OIDC_CLAIMS_REJECTED'&&err.blockers.includes('WORKFLOW_REF')
  );
 }
});
