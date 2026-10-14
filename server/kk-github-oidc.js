'use strict';

const crypto=require('node:crypto');

const VERSION='KK_GITHUB_OIDC_VERIFIER_V1';
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='kk-ultra-deep-production';
const JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';

function text(v){return String(v==null?'':v).trim();}
function b64url(v){
 const s=text(v).replace(/-/g,'+').replace(/_/g,'/');
 return Buffer.from(s+'='.repeat((4-s.length%4)%4),'base64');
}
function parseJwt(token){
 const parts=text(token).split('.');if(parts.length!==3)throw Object.assign(new Error('OIDC_TOKEN_FORMAT_INVALID'),{code:'OIDC_TOKEN_FORMAT_INVALID'});
 let header,payload;
 try{header=JSON.parse(b64url(parts[0]).toString('utf8'));payload=JSON.parse(b64url(parts[1]).toString('utf8'));}
 catch(_){throw Object.assign(new Error('OIDC_TOKEN_JSON_INVALID'),{code:'OIDC_TOKEN_JSON_INVALID'});}
 return {header,payload,signingInput:parts[0]+'.'+parts[1],signature:b64url(parts[2])};
}
async function jwks(fetchImpl=global.fetch){
 const r=await fetchImpl(JWKS_URL,{headers:{'user-agent':'KKPhoneRental-OIDC/1.0'}});
 if(!r.ok)throw Object.assign(new Error('OIDC_JWKS_HTTP_'+r.status),{code:'OIDC_JWKS_UNAVAILABLE'});
 const body=await r.json();
 return Array.isArray(body&&body.keys)?body.keys:[];
}
async function verifyToken(token,expected={},options={}){
 const parsed=parseJwt(token);
 if(parsed.header.alg!=='RS256'||!text(parsed.header.kid))throw Object.assign(new Error('OIDC_ALGORITHM_INVALID'),{code:'OIDC_ALGORITHM_INVALID'});
 const keys=await jwks(options.fetchImpl||global.fetch);
 const jwk=keys.find(k=>text(k.kid)===text(parsed.header.kid)&&text(k.kty)==='RSA');
 if(!jwk)throw Object.assign(new Error('OIDC_SIGNING_KEY_NOT_FOUND'),{code:'OIDC_SIGNING_KEY_NOT_FOUND'});
 const key=crypto.createPublicKey({key:jwk,format:'jwk'});
 const ok=crypto.verify('RSA-SHA256',Buffer.from(parsed.signingInput),key,parsed.signature);
 if(!ok)throw Object.assign(new Error('OIDC_SIGNATURE_INVALID'),{code:'OIDC_SIGNATURE_INVALID'});
 const p=parsed.payload||{};const now=Math.floor(Date.now()/1000);
 const aud=Array.isArray(p.aud)?p.aud:[p.aud];
 const blockers=[];
 if(text(p.iss)!==ISSUER)blockers.push('ISSUER');
 if(!aud.map(text).includes(text(expected.audience||AUDIENCE)))blockers.push('AUDIENCE');
 if(Number(p.exp||0)<=now-30)blockers.push('EXPIRED');
 if(Number(p.nbf||0)>now+30)blockers.push('NOT_YET_VALID');
 if(expected.repository&&text(p.repository)!==text(expected.repository))blockers.push('REPOSITORY');
 if(expected.owner&&text(p.repository_owner)!==text(expected.owner))blockers.push('OWNER');
 if(expected.ref&&text(p.ref)!==text(expected.ref))blockers.push('REF');
 const target=text(expected.workflow_ref), branchRef=text(expected.ref), expectedRepo=text(expected.repository);
 const exactTarget=target&&branchRef?target+branchRef:'';
 const directOk=target&&(branchRef?text(p.workflow_ref)===exactTarget:text(p.workflow_ref).startsWith(target));
 // Reusable jobs report the caller as workflow_ref. Require both exact caller
 // and exact job_workflow_ref at the owner-reviewed branch, never a prefix-only match.
 const routerRef=expectedRepo&&branchRef?`${expectedRepo}/.github/workflows/kk-owner-comment-command-router.yml@${branchRef}`:'';
 const routedOk=!!(routerRef&&exactTarget&&text(p.workflow_ref)===routerRef&&text(p.job_workflow_ref)===exactTarget);
 if(target&&!directOk&&!routedOk)blockers.push('WORKFLOW_REF');
 if(expected.run_id&&text(p.run_id)!==text(expected.run_id))blockers.push('RUN_ID');
 if(expected.sha&&text(p.sha)!==text(expected.sha))blockers.push('SHA');
 if(expected.actor&&text(p.actor)!==text(expected.actor))blockers.push('ACTOR');
 if(expected.event_name&&text(p.event_name)!==text(expected.event_name))blockers.push('EVENT_NAME');
 if(blockers.length){
  const e=new Error('OIDC_CLAIMS_REJECTED:'+blockers.join(','));
  e.code='OIDC_CLAIMS_REJECTED';e.blockers=blockers;throw e;
 }
 return {version:VERSION,verified:true,claims:{repository:text(p.repository),repository_owner:text(p.repository_owner),ref:text(p.ref),workflow_ref:text(p.workflow_ref),run_id:text(p.run_id),sha:text(p.sha),actor:text(p.actor),event_name:text(p.event_name),sub:text(p.sub)}};
}

module.exports={VERSION,ISSUER,AUDIENCE,JWKS_URL,text,b64url,parseJwt,jwks,verifyToken};
