'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Reader=require('../server/core-sheet-apps-script-reader.js');
const env={
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
  KK_CORE_PRIVATE_READ_KEY:'r'.repeat(48), KK_ADMIN_API_KEY:'admin-not-read',
  GOOGLE_SHEET_ID:'SYNTHETIC_CORE_ID'
};
const options={sheetId:env.GOOGLE_SHEET_ID,sheet:'08_Web_Ready',range:'A4:K',env};
const stable=(code)=>e=>e?.code===code && e.message===code;
test('forged CORE_APPS_SCRIPT_* code cannot leak provider message',async()=>{
  const leak='SYNTHETIC_PRIVATE_CUSTOMER_MARKER';
  for(const code of ['CORE_APPS_SCRIPT_UNAVAILABLE','CORE_APPS_SCRIPT_BAD_REDIRECT','CORE_APPS_SCRIPT_HTTP_FAILURE','CORE_APPS_SCRIPT_BAD_REDIRECT_'+leak]){
    await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>{throw Object.assign(new Error(leak),{code})}}),stable('CORE_APPS_SCRIPT_UNAVAILABLE'));
  }
});
test('normal unknown thrown provider error remains sanitized',async()=>{
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>{throw Error('SECRET_API_VALUE')}}),stable('CORE_APPS_SCRIPT_UNAVAILABLE'));
});
test('abort error becomes fixed timeout code without provider text',async()=>{
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>{throw Object.assign(Error('PRIVATE_MARKER'),{name:'AbortError',code:'CORE_APPS_SCRIPT_OTHER'})}}),stable('CORE_APPS_SCRIPT_TIMEOUT'));
});
test('internally generated redirect guard keeps exact safe classification',async()=>{
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>({status:302,ok:false,headers:{get:()=> 'https://evil.test/access'}})}),stable('CORE_APPS_SCRIPT_BAD_REDIRECT'));
});
test('internally generated HTTP failure keeps exact safe classification',async()=>{
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>({status:503,ok:false,url:env.KK_ADMIN_SCRIPT_URL})}),stable('CORE_APPS_SCRIPT_HTTP_FAILURE'));
});
test('valid bounded private data remains readable with no additional network calls',async()=>{
 let n=0;
 const rows=await Reader.readValues({...options,fetchImpl:async()=>{n++;return {status:200,ok:true,url:env.KK_ADMIN_SCRIPT_URL,json:async()=>({ok:true,data:{spreadsheet_id:env.GOOGLE_SHEET_ID,sheet:options.sheet,range:options.range,values:[['event_id'],['E1']]}})}}});
 assert.deepEqual(rows,[['event_id'],['E1']]);assert.equal(n,1);
});
test('forwarded second GET transport spoofed error never leaks and receives no key',async()=>{
 let count=0;const leak='SYNTHETIC_SECOND_GET_PRIVATE';
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async(url,init)=>{count++;if(count===1)return {status:302,ok:false,headers:{get:()=> 'https://script.googleusercontent.com/macros/echo'}}; assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.headers,undefined);throw Object.assign(new Error(leak),{code:'CORE_APPS_SCRIPT_BAD_REDIRECT'});}}),stable('CORE_APPS_SCRIPT_UNAVAILABLE'));
 assert.equal(count,2);
});
test('private Core stream reader accepts bounded multi-chunk JSON and never invokes response.json',async()=>{
 const responseBody=JSON.stringify({
   ok:true,data:{spreadsheet_id:env.GOOGLE_SHEET_ID,sheet:options.sheet,
     range:options.range,values:[['event_id'],['E1']]}
 });
 const bytes=Buffer.from(responseBody,'utf8');
 let chunksRead=0;
 const stream=new ReadableStream({
   start(controller){
     controller.enqueue(bytes.subarray(0,19));
     controller.enqueue(bytes.subarray(19));
     controller.close();
   }
 });
 const values=await Reader.readValues({...options,fetchImpl:async()=>({
   status:200,ok:true,url:env.KK_ADMIN_SCRIPT_URL,
   headers:{get:()=>String(bytes.length)},
   body:stream,json:async()=>{throw Error('UNBOUNDED_JSON_USED');}
 })});
 assert.deepEqual(values,[['event_id'],['E1']]);
 assert.equal(chunksRead,0); // No fallback to JSON object adaptation.
});

test('private Core rejects declared oversized Content-Length before reading body',async()=>{
 let reads=0;
 const response={status:200,ok:true,url:env.KK_ADMIN_SCRIPT_URL,
   headers:{get:key=>key==='content-length'?String(9*1024*1024):null},
   body:{getReader(){reads++;throw Error('BODY_MUST_NOT_BE_READ');}},
   json:async()=>{throw Error('JSON_MUST_NOT_BE_USED');}};
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>response}),
   stable('CORE_APPS_SCRIPT_RESPONSE_INVALID'));
 assert.equal(reads,0);
});

test('private Core aborts streaming input beyond byte cap and never returns rows',async()=>{
 let canceled=false,readCount=0;
 const chunk=Buffer.alloc(1024*1024,'x');
 const stream=new ReadableStream({
   pull(controller){
     readCount++;
     controller.enqueue(chunk);
   },
   cancel(){canceled=true;}
 },{highWaterMark:0});
 await assert.rejects(()=>Reader.readValues({...options,fetchImpl:async()=>({
   status:200,ok:true,url:env.KK_ADMIN_SCRIPT_URL,
   headers:{get:()=>null},body:stream,
   json:async()=>{throw Error('MUST_NOT_PARSE_UNBOUNDED');}
 })}),stable('CORE_APPS_SCRIPT_RESPONSE_INVALID'));
 assert.equal(canceled,true);
 assert.ok(readCount<=10);
});

test('unconfigured read-only key blocks before provider requests',async()=>{
 let count=0;
 await assert.rejects(()=>Reader.readValues({...options,env:{...env,KK_CORE_PRIVATE_READ_KEY:''},fetchImpl:async()=>{count++;throw Error('forbidden')}}),stable('CORE_APPS_SCRIPT_NOT_CONFIGURED'));
 assert.equal(count,0);
});
