'use strict';

module.exports = class KKStagingEvalProvider {
  constructor(options={}){
    this.providerId=(options && options.id) || 'kk-staging-eval';
    this.config=(options && options.config) || {};
  }

  id(){ return this.providerId; }

  async callApi(prompt){
    const endpoint=String(process.env.KK_EVAL_ENDPOINT || '').trim();
    if(!endpoint){
      return {error:'KK_EVAL_ENDPOINT is required; production endpoints must not be used for evals'};
    }

    let url;
    try{ url=new URL(endpoint); }
    catch(_err){ return {error:'KK_EVAL_ENDPOINT must be a valid URL'}; }

    const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
    if(url.protocol!=='https:' && !local){
      return {error:'KK_EVAL_ENDPOINT must use HTTPS unless it is localhost'};
    }

    if(/prod|production/i.test(url.hostname+url.pathname) && process.env.KK_EVAL_ALLOW_PRODUCTION!=='EXPLICITLY_DENIED_BY_DEFAULT'){
      return {error:'production-looking eval endpoint is blocked by default'};
    }

    const controller=new AbortController();
    const timeoutMs=Math.max(1000,Math.min(Number(process.env.KK_EVAL_TIMEOUT_MS || 20000),60000));
    const timer=setTimeout(()=>controller.abort(),timeoutMs);

    try{
      const headers={'content-type':'application/json'};
      const token=String(process.env.KK_EVAL_BEARER_TOKEN || '').trim();
      if(token) headers.authorization='Bearer '+token;

      const response=await fetch(url,{
        method:'POST',
        headers,
        body:JSON.stringify({
          prompt,
          mode:'EVAL_ONLY',
          authoritative:false,
          verifier_required:true,
          production_writes:0,
          final_truth_mutation:false,
          notification_sends:0
        }),
        signal:controller.signal
      });

      const body=await response.text();
      if(!response.ok){
        return {error:`eval endpoint returned HTTP ${response.status}`};
      }

      return {
        output:body,
        metadata:{
          endpoint_host:url.host,
          mode:'EVAL_ONLY',
          authoritative:false,
          production_writes:0
        }
      };
    }catch(err){
      return {error:err && err.name==='AbortError'?'eval endpoint timeout':'eval endpoint request failed'};
    }finally{
      clearTimeout(timer);
    }
  }
};
