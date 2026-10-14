'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
const AppsReader=require('../server/core-sheet-apps-script-reader.js');
const READ_KEY='r'.repeat(48),ADMIN_KEY='a'.repeat(48);
function extract(name){
  const marker='function '+name+'(';
  const start=source.indexOf(marker);
  assert.ok(start>=0,'function missing '+name);
  const from=source.indexOf('{',start);
  let depth=0,quote='';
  for(let i=from;i<source.length;i++){
    const c=source[i];
    if(quote){
      if(c.charCodeAt(0)===92)i++;
      else if(c===quote)quote='';
      continue;
    }
    if(c.charCodeAt(0)===34||c.charCodeAt(0)===39||c.charCodeAt(0)===96){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw Error('Unterminated '+name);
}
test('owner read key is unique, at least 32 chars, and independent of Admin mutation key',()=>{
  const build=Function('PropertiesService',extract('kkApiRequirePrivateReadKey_')+';return kkApiRequirePrivateReadKey_;');
  const caller=(reader=READ_KEY,admin=ADMIN_KEY)=>build({
    getScriptProperties:()=>({getProperty:key=>key==='KK_CORE_PRIVATE_READ_KEY'?reader:key==='KK_ADMIN_API_KEY'?admin:''})
  });
  assert.doesNotThrow(()=>caller()({readKey:READ_KEY}));
  assert.throws(()=>caller()({readKey:ADMIN_KEY}),/PRIVATE_CORE_READER_KEY_INVALID/);
  assert.throws(()=>caller()({apiKey:ADMIN_KEY}),/PRIVATE_CORE_READER_KEY_INVALID/);
  assert.throws(()=>caller(ADMIN_KEY,ADMIN_KEY)({readKey:ADMIN_KEY}),/PRIVATE_CORE_READER_KEY_NOT_READY/);
  assert.throws(()=>caller('short')({readKey:'short'}),/PRIVATE_CORE_READER_KEY_NOT_READY/);
  assert.equal(AppsReader.scriptState({
    KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/unit_test/exec',
    KK_ADMIN_API_KEY:ADMIN_KEY,KK_CORE_PRIVATE_READ_KEY:ADMIN_KEY
  }).configured,false);
});
test('read action authenticates separately and cannot dispatch an Admin write with read key',()=>{
  const calls=[];
  const factory=Function(
    'kkApiRequirePrivateReadKey_','kkApiRequireKey_','kkApiPrivateCoreRead_',
    'kkApiJson_','kkApiOk_','kkApiFail_','kkErrorLog_','kkAuditLog_','KK_ADMIN_VERSION',
    extract('doPost')+';return doPost;'
  );
  const dispatch=factory(
    p=>{calls.push('read-auth');if(p.readKey!==READ_KEY)throw Error('private key rejected');},
    p=>{calls.push('admin-auth');if(p.apiKey!==ADMIN_KEY)throw Error('admin key rejected');},
    ()=>{calls.push('read');return {data:{safe:'read-only'}};},
    x=>x, x=>Object.assign({ok:true},x),()=>({ok:false}),
    ()=>{calls.push('error-log')},()=>{calls.push('mutation-log')},'test-version'
  );
  const response=dispatch({postData:{contents:JSON.stringify({action:'privateCoreRead',readKey:READ_KEY})}});
  assert.equal(response.ok,true);
  assert.deepEqual(calls,['read-auth','read']);
  calls.length=0;
  const denied=dispatch({postData:{contents:JSON.stringify({action:'createBooking',readKey:READ_KEY})}});
  assert.equal(denied.ok,false);
  assert.deepEqual(calls,['admin-auth']);
});

test('audit serializer masks protected request fields',()=>{
  const serialize=Function('kkRedactSecretText_',extract('kkSafeStringify_')+';return kkSafeStringify_;')(v=>v);
  const logged=serialize({readKey:'fixture_123',apiKey:'fixture_456',action:'snapshot'});
  assert.doesNotMatch(logged,/fixture_123|fixture_456/);
  assert.match(logged,/redacted/);
});


test('raw error and stack redaction masks both protected credential values',()=>{
 const reader=READ_KEY,admin=ADMIN_KEY;
 const getSecret=Function('PropertiesService',extract('kkRedactSecretText_')+';return kkRedactSecretText_;')({
   getScriptProperties:()=>({getProperty:k=>k==='KK_CORE_PRIVATE_READ_KEY'?reader:k==='KK_ADMIN_API_KEY'?admin:''})
 });
 const unsafe='context '+reader+' private stack '+admin;
 const safe=getSecret(unsafe);
 assert.doesNotMatch(safe,new RegExp(reader));
 assert.doesNotMatch(safe,new RegExp(admin));
 assert.match(safe,/\[redacted\]/);
 assert.match(source,/kkRedactSecretText_\(err && err.message/);
 assert.match(source,/kkRedactSecretText_\(err && err.stack/);
});
test('private reader errors are generic even when upstream error contains protected data',()=>{
 const calls=[];
 const factory=Function('kkApiRequirePrivateReadKey_','kkApiRequireKey_','kkApiPrivateCoreRead_',
   'kkApiJson_','kkApiOk_','kkApiFail_','kkErrorLog_','kkAuditLog_','KK_ADMIN_VERSION',
   extract('doPost')+';return doPost;');
 const doPost=factory(()=>{},()=>{},()=>{throw Error('sensitive upstream secret');},
    x=>x,x=>Object.assign({ok:true},x),e=>({ok:false,error:e.message}),
    ()=>calls.push('error mutation'),()=>calls.push('audit mutation'),'test-version');
 const res=doPost({postData:{contents:JSON.stringify({action:'privateCoreRead',readKey:READ_KEY})}});
 assert.equal(res.ok,false);
 assert.equal(res.error_code,'PRIVATE_CORE_READ_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(res),/sensitive upstream secret/);
 assert.deepEqual(calls,[]);
});
