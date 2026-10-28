'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const Entry=require('../api/line-webhook.js');
const SECRET='synthetic-signature-secret';
const TOKEN='synthetic-channel-token';
function sign(raw,secret=SECRET){
  return crypto.createHmac('sha256',secret).update(raw).digest('base64');
}
function response(){
  return {statusCode:0,body:undefined,end(body){this.body=body;}};
}
async function deliver(raw,{signature=sign(raw),headers,stream=false}={}){
  const req=stream?Readable.from([Buffer.from(raw)]):{rawBody:Buffer.from(raw)};
  req.method='POST';req.headers=headers||{'x-line-signature':signature};
  const res=response();await Entry(req,res);return res;
}
async function env(fn){
  const old={secret:process.env.LINE_CHANNEL_SECRET,token:process.env.LINE_CHANNEL_ACCESS_TOKEN};
  process.env.LINE_CHANNEL_SECRET=SECRET;
  process.env.LINE_CHANNEL_ACCESS_TOKEN=TOKEN;
  try{return await fn()}finally{
    if(old.secret===undefined)delete process.env.LINE_CHANNEL_SECRET;else process.env.LINE_CHANNEL_SECRET=old.secret;
    if(old.token===undefined)delete process.env.LINE_CHANNEL_ACCESS_TOKEN;else process.env.LINE_CHANNEL_ACCESS_TOKEN=old.token;
  }
}
test('valid signed LINE envelope remains accepted by admission',()=>{
  const raw=Buffer.from('{"events":[]}');
  assert.deepEqual(Entry._test.signedEnvelopePreflight(raw,sign(raw),SECRET),{ok:true});
});
test('signed LINE envelope with ordinary benign event passes shape validation',()=>{
  const raw=Buffer.from(JSON.stringify({destination:'USYN',events:[{type:'follow',source:{userId:'synthetic'}}]}));
  assert.equal(Entry._test.signedEnvelopePreflight(raw,sign(raw),SECRET).ok,true);
});
test('invalid signature rejected before JSON shape inspection',()=>{
  const raw=Buffer.from('null');
  assert.equal(Entry._test.signedEnvelopePreflight(raw,'invalid',SECRET).statusCode,401);
});
test('signature against a different body rejected',()=>{
  const raw=Buffer.from('{"events":[]}');
  assert.equal(Entry._test.signedEnvelopePreflight(raw,sign(Buffer.from('{"events":[1]}')),SECRET).statusCode,401);
});
test('signed malformed JSON is a controlled 400',()=>{
  const raw=Buffer.from('{broken');
  assert.equal(Entry._test.signedEnvelopePreflight(raw,sign(raw),SECRET).statusCode,400);
});
test('signed primitives, arrays and null are rejected before booking',()=>{
  for(const payload of ['null','false','42','"hi"','[]']){
    const raw=Buffer.from(payload);
    const result=Entry._test.signedEnvelopePreflight(raw,sign(raw),SECRET);
    assert.equal(result.statusCode,400,payload);
  }
});
test('signed missing/non-array events rejected',()=>{
  for(const payload of ['{}','{"events":null}','{"events":{}}','{"events":"x"}']){
    const raw=Buffer.from(payload);
    assert.equal(Entry._test.signedEnvelopePreflight(raw,sign(raw),SECRET).statusCode,400,payload);
  }
});
test('valid signed null intercepted at actual entrypoint with 400',()=>env(async()=>{
  const r=await deliver(Buffer.from('null'));
  assert.equal(r.statusCode,400);
  assert.equal(r.body,'Invalid LINE events');
}));
test('unsigned request intercepted at actual entrypoint with 401',()=>env(async()=>{
  const r=await deliver(Buffer.from('null'),{signature:'wrong'});
  assert.equal(r.statusCode,401);
  assert.equal(r.body,'Invalid signature');
}));
test('valid signed empty events delegates unchanged, even when streamed',()=>env(async()=>{
  const r=await deliver(Buffer.from('{"events":[]}'),{stream:true});
  assert.equal(r.statusCode,200);
  assert.equal(r.body,'OK');
}));
test('raw-body limit remains enforced before any admission work',()=>env(async()=>{
  const raw=Buffer.alloc(Entry._test.MAX_LINE_WEBHOOK_BYTES+1,65);
  const oldError=console.error;console.error=()=>{};
  try{
    const r=await deliver(raw,{signature:'invalid'});
    assert.equal(r.statusCode,413);
    assert.equal(r.body,'Request body too large');
  }finally{console.error=oldError;}
}));
test('missing production config delegates to original handler for existing 503 policy',async()=>{
  const old=process.env.LINE_CHANNEL_SECRET;delete process.env.LINE_CHANNEL_SECRET;
  try{
    const r=await deliver(Buffer.from('null'),{signature:'invalid'});
    assert.equal(r.statusCode,503);
    assert.equal(r.body,'LINE Messaging API is not configured');
  }finally{if(old===undefined)delete process.env.LINE_CHANNEL_SECRET;else process.env.LINE_CHANNEL_SECRET=old;}
});
test('API body parser stays disabled to preserve raw LINE signature bytes',()=>{
  assert.deepEqual(Entry.config,{api:{bodyParser:false}});
});
