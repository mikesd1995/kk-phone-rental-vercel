'use strict';

// Local/test transport policy. Never log or serialize credentials or Playwright
// exceptions, whose request call logs can contain headers. No global headers.
const RESERVED=new Set(['x-vercel-protection-bypass','x-vercel-set-bypass-cookie']);
function blocked(code){
 return Object.assign(new Error('Read-only visual transport blocked'),{code});
}
function cleanHeaders(headers={}){
 return Object.fromEntries(Object.entries(headers).filter(([key])=>!RESERVED.has(key.toLowerCase())));
}
function createReadOnlyTransport({mode,targetUrl,readBypassSecret=()=>'',imageCache}={}){
 if(!['local_zero_cost','preview','production','remote'].includes(mode))throw blocked('VISUAL_TRANSPORT_MODE_INVALID');
 let target;
 try{target=new URL(targetUrl);}catch(_){throw blocked('VISUAL_TRANSPORT_TARGET_INVALID');}
 const local=mode==='local_zero_cost';
 const remoteHost=target.hostname==='kk-phone-rental.vercel.app'
  ||(target.hostname.startsWith('kk-phone-rental-vercel-')&&target.hostname.endsWith('.vercel.app'));
 if(target.username||target.password||(local
  ? target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)
  : target.protocol!=='https:'||!remoteHost||target.port))throw blocked('VISUAL_TRANSPORT_TARGET_INVALID');
 // The callback is deliberately never evaluated in local mode, including when
 // the environment contains an inherited value or a getter that would throw.
 let secret='';
 if(!local){
  try{secret=String(readBypassSecret()||'').trim();}catch(_){throw blocked('VISUAL_TRANSPORT_SECRET_UNAVAILABLE');}
  if(/[\r\n]/.test(secret))throw blocked('VISUAL_TRANSPORT_SECRET_INVALID');
 }
 let used=false;
 async function forward(route){
  try{
   const request=route.request();
   if(!['GET','HEAD'].includes(request.method()))return await route.abort('blockedbyclient');
   const url=new URL(request.url());
   if(url.username||url.password){await route.abort('blockedbyclient');throw blocked('VISUAL_TRANSPORT_URL_CREDENTIALS');}
   const cached=request.resourceType()==='image'?imageCache?.get(request.url()):null;
   if(cached)return await route.fulfill({status:200,contentType:cached.contentType,body:cached.body});
   const headers=cleanHeaders(await request.allHeaders());
   if(!secret||url.origin!==target.origin)return await route.continue({headers});
   // A credentialed redirect never reaches the browser. Nor may an incoming
   // redirected request acquire a credential from this policy.
   if(request.redirectedFrom()){await route.abort('blockedbyclient');throw blocked('VISUAL_TRANSPORT_REDIRECT_BLOCKED');}
   headers['x-vercel-protection-bypass']=secret;
   // Per-request bypass needs no session bypass cookie. Never inject the
   // x-vercel-set-bypass-cookie header; ordinary application cookies are intact.
   used=true;
   const response=await route.fetch({headers,maxRedirects:0,maxRetries:0,timeout:15000});
   const status=response.status(),responseHeaders=response.headers();
   if(status>=300&&status<400&&Object.keys(responseHeaders).some(k=>k.toLowerCase()==='location')){
    await route.abort('blockedbyclient');throw blocked('VISUAL_TRANSPORT_REDIRECT_BLOCKED');
   }
   return await route.fulfill({response});
  }catch(error){
   // Rebuild even recognized errors: never trust an upstream error's message.
   const code=['VISUAL_TRANSPORT_URL_CREDENTIALS','VISUAL_TRANSPORT_REDIRECT_BLOCKED'].includes(error?.code)
    ? error.code:'VISUAL_TRANSPORT_FAILED';
   throw blocked(code);
  }
 }
 return Object.freeze({forward,bypassUsed:()=>used});
}
module.exports={createReadOnlyTransport};
