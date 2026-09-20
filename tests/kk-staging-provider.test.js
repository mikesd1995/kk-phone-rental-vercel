'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Provider=require('../evals/providers/kk-staging-provider');

async function withEnv(values,fn){
  const previous={};
  for(const [key,value] of Object.entries(values)){
    previous[key]=process.env[key];
    if(value===undefined) delete process.env[key];
    else process.env[key]=value;
  }
  try{ return await fn(); }
  finally{
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined) delete process.env[key];
      else process.env[key]=value;
    }
  }
}

test('Promptfoo staging provider fails closed when endpoint is missing',async()=>{
  await withEnv({KK_EVAL_ENDPOINT:undefined},async()=>{
    const p=new Provider();
    const result=await p.callApi('test');
    assert.match(result.error,/KK_EVAL_ENDPOINT is required/);
  });
});

test('Promptfoo staging provider blocks insecure non-local HTTP',async()=>{
  await withEnv({KK_EVAL_ENDPOINT:'http://example.com/eval'},async()=>{
    const p=new Provider();
    const result=await p.callApi('test');
    assert.match(result.error,/must use HTTPS/);
  });
});

test('Promptfoo staging provider blocks production-looking endpoint before fetch',async()=>{
  await withEnv({KK_EVAL_ENDPOINT:'https://prod.example.com/eval'},async()=>{
    const original=global.fetch;
    let calls=0;
    global.fetch=async()=>{ calls++; throw new Error('must not call'); };
    try{
      const p=new Provider();
      const result=await p.callApi('test');
      assert.match(result.error,/production-looking/);
      assert.equal(calls,0);
    }finally{
      global.fetch=original;
    }
  });
});

test('Promptfoo staging provider sends explicit zero-authority eval envelope',async()=>{
  await withEnv({KK_EVAL_ENDPOINT:'https://staging.example.com/eval',KK_EVAL_BEARER_TOKEN:'test-only'},async()=>{
    const original=global.fetch;
    let request=null;
    global.fetch=async(url,options)=>{
      request={url:String(url),options};
      return {ok:true,status:200,text:async()=>'{"ok":true}'};
    };
    try{
      const p=new Provider();
      const result=await p.callApi('candidate text');
      const payload=JSON.parse(request.options.body);
      assert.equal(payload.mode,'EVAL_ONLY');
      assert.equal(payload.authoritative,false);
      assert.equal(payload.verifier_required,true);
      assert.equal(payload.production_writes,0);
      assert.equal(payload.final_truth_mutation,false);
      assert.equal(payload.notification_sends,0);
      assert.equal(result.metadata.authoritative,false);
      assert.equal(result.metadata.production_writes,0);
    }finally{
      global.fetch=original;
    }
  });
});
