'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');

const SOURCE=path.resolve(__dirname,'../api/line-webhook.js');
const SECRET='synthetic-signature-secret-no-real-credentials';
const TOKEN='synthetic-channel-token-no-real-credentials';

function harness(env={LINE_CHANNEL_SECRET:SECRET,LINE_CHANNEL_ACCESS_TOKEN:TOKEN}){
  const calls=[];
  const stub=async(req,res)=>{calls.push({method:req.method,rawLength:req.rawBody?.length});res.statusCode=200;return res.end('STUB_DELEGATED');};
  const mod={exports:{}};
  const sandbox={
    module:mod,Buffer,
    process:{env},
    console:{error:()=>{}},
    require:(name)=>{
      if(name==='../server/line-booking-webhook') return stub;
      if(name==='node:crypto') return crypto;
      throw new Error('UNEXPECTED_REQUIRE:'+name);
    }
  };
  vm.runInNewContext(fs.readFileSync(SOURCE,'utf8'),sandbox,{filename:SOURCE,timeout:1500});
  const sign=raw=>crypto.createHmac('sha256',SECRET).update(raw).digest('base64');
  async function post(raw,opts={}){
    const data=Buffer.isBuffer(raw)?raw:Buffer.from(raw);
    const req=opts.stream?Readable.from(opts.streamChunks||[data]):{rawBody:data};
    req.method='POST';req.headers={'x-line-signature':opts.signature===undefined?sign(data):opts.signature};
    const res={statusCode:0,body:'',end(s){this.body=s;return this;}};
    await mod.exports(req,res);return res;
  }
  return {post,calls,entry:mod.exports};
}

test('valid signed empty array delegates exactly once',async()=>{
  const h=harness(),res=await h.post('{"events":[]}');
  assert.equal(res.statusCode,200);
  assert.equal(h.calls.length,1);
});
test('signed null is rejected with no call to the booking layer',async()=>{
  const h=harness(),res=await h.post('null');
  assert.equal(res.statusCode,400);
  assert.equal(h.calls.length,0);
});
test('signed malformed and missing events cannot reach downstream booking',async()=>{
  for(const data of ['{broken','{}','{"events":null}','{"events":false}','{"events":{}}','[]']){
    const h=harness(),res=await h.post(data);
    assert.equal(res.statusCode,400,data);
    assert.equal(h.calls.length,0,data);
  }
});
test('invalid raw-body HMAC is rejected before the booking layer',async()=>{
  const h=harness(),res=await h.post('{"events":[]}',{signature:'definitely-wrong'});
  assert.equal(res.statusCode,401);
  assert.equal(h.calls.length,0);
});
test('unsigned valid JSON is rejected before booking',async()=>{
  const h=harness(),res=await h.post('{"events":[]}',{signature:''});
  assert.equal(res.statusCode,401);
  assert.equal(h.calls.length,0);
});
test('size limit rejects oversized raw body before auth/booking',async()=>{
  const h=harness(),res=await h.post(Buffer.alloc(1024*1024+1,0x41));
  assert.equal(res.statusCode,413);
  assert.equal(h.calls.length,0);
});
test('streamed signed envelope is accepted without changing raw bytes',async()=>{
  const h=harness();const raw=Buffer.from('{"events":[]}');
  const res=await h.post(raw,{stream:true,streamChunks:[raw.subarray(0,3),raw.subarray(3)]});
  assert.equal(res.statusCode,200);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].rawLength,raw.length);
});
test('streamed oversized body fails before booking delegation',async()=>{
  const h=harness();const raw=Buffer.alloc(1024*1024+1,0x41);
  const res=await h.post(raw,{stream:true,streamChunks:[raw.subarray(0,2048),raw.subarray(2048)]});
  assert.equal(res.statusCode,413);
  assert.equal(h.calls.length,0);
});
test('missing channel token preserves delegated config handling',async()=>{
  const h=harness({LINE_CHANNEL_SECRET:SECRET});
  const res=await h.post('null',{signature:'invalid'});
  assert.equal(res.statusCode,200);
  assert.equal(h.calls.length,1);
  // The real booking handler owns the missing-channel-token 503 response.
});
test('non-POST is not subjected to signed JSON admission',async()=>{
  const h=harness();const req={method:'GET',headers:{}};
  const res={statusCode:0,end(s){this.body=s;}};
  await h.entry(req,res);
  assert.equal(h.calls.length,1);
});
