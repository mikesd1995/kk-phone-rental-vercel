'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const SOURCE=path.resolve(__dirname,'../api/line-webhook.js');
const SECRET='synthetic-webhook-secret';
const TOKEN='synthetic-line-token';

function isolated(env={LINE_CHANNEL_SECRET:SECRET,LINE_CHANNEL_ACCESS_TOKEN:TOKEN}){
  const calls=[], logs=[], module={exports:{}};
  const bookingStub=async(req,res)=>{
    calls.push({method:req.method,raw:req.rawBody});
    if(!String(env.LINE_CHANNEL_SECRET||'').trim() || !String(env.LINE_CHANNEL_ACCESS_TOKEN||'').trim()) {
      res.statusCode=503;
      return res.end('LINE Messaging API is not configured');
    }
    res.statusCode=200;
    return res.end('STUB_DELEGATED');
  };
  vm.runInNewContext(fs.readFileSync(SOURCE,'utf8'),{
    module, Buffer,
    process:{env},
    console:{error:(...parts)=>logs.push(parts.map(String).join(' '))},
    require:(name)=>{
      if(name==='../server/line-booking-webhook')return bookingStub;
      if(name==='node:crypto')return crypto;
      throw Error('UNEXPECTED_IMPORT');
    }
  },{filename:SOURCE,timeout:2000});
  const sign=(raw)=>crypto.createHmac('sha256',SECRET).update(raw).digest('base64');
  async function deliver(body,{signature,stream=false,headers=null,method='POST',setHeader=true}={}){
    const bytes=Buffer.isBuffer(body)?body:Buffer.from(String(body));
    const req=stream?Readable.from([bytes]):{rawBody:bytes};
    req.method=method;
    req.headers=headers||{'x-line-signature':signature===undefined?sign(bytes):signature};
    const res={statusCode:0,body:'',headers:{},end(x){this.body=x;return this;}};
    if(setHeader)res.setHeader=(name,value)=>{res.headers[name]=value;};
    await module.exports(req,res);
    return res;
  }
  return {deliver,entry:module.exports,calls,logs,sign};
}
const expectHeaders=r=>{
  assert.equal(r.headers['Cache-Control'],'no-store');
  assert.equal(r.headers['X-Content-Type-Options'],'nosniff');
};

test('bad HMAC returns 401 with safe headers and zero booking calls',async()=>{
  const h=isolated(),r=await h.deliver('{"events":[]}',{signature:'invalid'});
  assert.equal(r.statusCode,401);expectHeaders(r);assert.equal(h.calls.length,0);
});
test('signed malformed top-level envelope is 400 with safe headers',async()=>{
  const h=isolated(),r=await h.deliver('null');
  assert.equal(r.statusCode,400);expectHeaders(r);assert.equal(h.calls.length,0);
});
test('oversized body returns 413 with no-store and redacted log',async()=>{
  const h=isolated(),r=await h.deliver(Buffer.alloc(1024*1024+1,65));
  assert.equal(r.statusCode,413);expectHeaders(r);assert.equal(h.calls.length,0);
  assert.equal(h.logs.length,1);assert.match(h.logs[0],/size-limit/);
  assert.doesNotMatch(h.logs[0],/request body too large/);
});
test('untrusted stream read failure cannot echo sensitive error into logs',async()=>{
  const h=isolated(),secret='customer-private-data-must-not-be-logged';
  const req=Readable.from((async function*(){throw Error(secret);})());
  req.method='POST';req.headers={'x-line-signature':'invalid'};
  const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(x){this.body=x;}};
  await h.entry(req,res);
  assert.equal(res.statusCode,400);expectHeaders(res);assert.equal(h.calls.length,0);
  assert.equal(h.logs.length,1);assert.match(h.logs[0],/read-failed/);
  assert.doesNotMatch(h.logs[0],/customer-private-data/);
});
test('valid signed empty-event body retains legacy delegation and safety headers',async()=>{
  const h=isolated(),r=await h.deliver('{"events":[]}',{stream:true});
  assert.equal(r.statusCode,200);expectHeaders(r);assert.equal(h.calls.length,1);
});
test('whitespace token follows missing-configuration 503 instead of 401',async()=>{
  const h=isolated({LINE_CHANNEL_SECRET:SECRET,LINE_CHANNEL_ACCESS_TOKEN:'   '}),r=await h.deliver('null',{signature:'invalid'});
  assert.equal(r.statusCode,503);expectHeaders(r);assert.equal(h.calls.length,1);
});
test('whitespace channel secret follows missing-configuration 503',async()=>{
  const h=isolated({LINE_CHANNEL_SECRET:'  ',LINE_CHANNEL_ACCESS_TOKEN:TOKEN}),r=await h.deliver('null',{signature:'invalid'});
  assert.equal(r.statusCode,503);expectHeaders(r);assert.equal(h.calls.length,1);
});
test('GET method delegates to original 405 owner without parsing body',async()=>{
  const h=isolated(),r=await h.deliver('',{method:'GET'});
  assert.equal(h.calls.length,1);expectHeaders(r);
});
test('mixed-case x-line-signature header still accepts valid signed body',async()=>{
  const h=isolated(),raw=Buffer.from('{"events":[]}');
  const r=await h.deliver(raw,{headers:{'X-Line-Signature':h.sign(raw)}});
  assert.equal(r.statusCode,200);expectHeaders(r);assert.equal(h.calls.length,1);
});
test('test doubles without setHeader remain compatible with non-network behavior',async()=>{
  const h=isolated(),r=await h.deliver('null',{setHeader:false});
  assert.equal(r.statusCode,400);assert.equal(h.calls.length,0);
});
