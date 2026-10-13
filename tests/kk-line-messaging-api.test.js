'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Line=require('../server/kk-line-messaging-api.js');

test('getProfile returns display name for LINE user',async()=>{
 let seen;
 const p=await Line.getProfile('U12345678901234567890123456789012','token',async(url,opt)=>{
  seen={url,opt};
  return{ok:true,status:200,text:async()=>JSON.stringify({displayName:'Mint',userId:'U123',pictureUrl:'https://example.com/p.jpg'})};
 });
 assert.match(seen.url,/\/v2\/bot\/profile\/U123/);
 assert.equal(seen.opt.headers.Authorization,'Bearer token');
 assert.equal(p.display_name,'Mint');
});

test('getProfile treats unavailable profile as soft miss',async()=>{
 const p=await Line.getProfile('U12345678901234567890123456789012','token',async()=>({ok:false,status:404,text:async()=>''}));
 assert.equal(p,null);
});

test('pushText always sends retry key and returns provider identity',async()=>{
 let seen;
 const r=await Line.pushText({to:'U12345678901234567890123456789012',text:'hello'},{token:'token',retryKey:'123e4567-e89b-12d3-a456-426614174000',fetchImpl:async(url,opt)=>{
  seen={url,opt};
  return{ok:true,status:200,headers:{get:n=>n.toLowerCase()==='x-line-request-id'?'req-1':''},text:async()=>JSON.stringify({sentMessages:[{id:'msg-1'}]})};
 }});
 assert.match(seen.url,/\/v2\/bot\/message\/push$/);
 assert.equal(seen.opt.headers['X-Line-Retry-Key'],'123e4567-e89b-12d3-a456-426614174000');
 assert.deepEqual(JSON.parse(seen.opt.body),{to:'U12345678901234567890123456789012',messages:[{type:'text',text:'hello'}]});
 assert.equal(r.external_message_id,'msg-1');assert.equal(r.provider_request_id,'req-1');
});

test('pushText fails closed on provider rejection',async()=>{
 await assert.rejects(()=>Line.pushText({to:'U12345678901234567890123456789012',text:'hello'},{token:'token',fetchImpl:async()=>({ok:false,status:401,headers:{get:()=>''},text:async()=>'unauthorized'})}),err=>err&&err.code==='LINE_PUSH_FAILED'&&err.status===401);
});

test('missing sentMessages ID cannot be treated as confirmed provider receipt',async()=>{
 const r=await Line.pushText({to:'U12345678901234567890123456789012',text:'hello'},{
  token:'token',retryKey:'123e4567-e89b-42d3-a456-426614174000',
  fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>''},text:async()=>JSON.stringify({sentMessages:[]})})
 });
 assert.equal(r.provider_confirmed,false);
 assert.equal(r.external_message_id,'');
});

test('genuine provider message ID is required to mark delivery confirmed',async()=>{
 const r=await Line.pushText({to:'U12345678901234567890123456789012',text:'hello'},{
  token:'token',retryKey:'123e4567-e89b-42d3-a456-426614174000',
  fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>''},text:async()=>JSON.stringify({sentMessages:[{id:'msg-verified-2'}]})})
 });
 assert.equal(r.provider_confirmed,true);
 assert.equal(r.external_message_id,'msg-verified-2');
});
