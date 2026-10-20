'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const Guard=require('../api/kk-admin-guard.js');
const SYNTHETIC_PIN='SYNTHETIC-CUTOVER-PIN';
function setup(t,{configured=true}={}){
 const keys=['KK_ADMIN_PIN','KK_INBOX_SUPABASE_URL','KK_INBOX_SUPABASE_SERVICE_ROLE_KEY','LINE_CHANNEL_ACCESS_TOKEN'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=global.fetch,calls=[];
 process.env.KK_ADMIN_PIN=SYNTHETIC_PIN;
 process.env.LINE_CHANNEL_ACCESS_TOKEN='SYNTHETIC-LINE-NOT-USED';
 if(configured){process.env.KK_INBOX_SUPABASE_URL='https://synthetic-inbox.invalid';process.env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC-NOT-A-KEY';}
 else{delete process.env.KK_INBOX_SUPABASE_URL;delete process.env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY;}
 global.fetch=async(url,options)=>{calls.push(String(url));assert.ok(String(url).startsWith('https://synthetic-inbox.invalid/rest/v1/rpc/'),'Only offline read stub may run');return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});};
 t.after(()=>{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}global.fetch=oldFetch;});
 return calls;
}
function request(body,authorized=true){const r=Readable.from([JSON.stringify(body)]);r.method='POST';r.url='/api/kk-admin';r.headers=authorized?{'x-admin-pin':SYNTHETIC_PIN}:{};return r;}
function response(){return{statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(v){this.body=String(v||'');}};}
test('cutover holds an authenticated owner-approved send before every store/provider request',async t=>{
 const calls=setup(t),out=response();
 await Guard(request({action:'inboxSendLineMessage',owner_approved:true,conversation_id:'synthetic-no-customer',text:'Synthetic offline only'}),out);
 assert.equal(out.statusCode,503);const body=JSON.parse(out.body);
 assert.equal(body.error_code,'INBOX_CUTOVER_SEND_HOLD');assert.equal(body.production_writes,0);assert.equal(body.provider_sends,0);assert.equal(body.retryable,false);assert.equal(calls.length,0);
});
test('cutover send fence does not depend on Inbox store configuration',async t=>{
 const calls=setup(t,{configured:false}),out=response();
 await Guard(request({action:'inboxSendLineMessage',owner_approved:false}),out);
 assert.equal(out.statusCode,503);assert.equal(JSON.parse(out.body).error_code,'INBOX_CUTOVER_SEND_HOLD');assert.equal(calls.length,0);
});
test('cutover fence retains existing authentication before its maintenance response',async t=>{
 const calls=setup(t),out=response();await Guard(request({action:'inboxSendLineMessage'},false),out);
 assert.equal(out.statusCode,401);assert.equal(calls.length,0);assert.notEqual(JSON.parse(out.body).error_code,'INBOX_CUTOVER_SEND_HOLD');
});
test('Inbox read remains available during send-only cutover without any LINE call',async t=>{
 const calls=setup(t),out=response();await Guard(request({action:'inboxListConversations',limit:1}),out);
 assert.equal(out.statusCode,200);const body=JSON.parse(out.body);assert.equal(body.ok,true);assert.deepEqual(body.conversations,[]);assert.equal(body.production_writes,0);assert.equal(body.profile_hydration_enabled,true);assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/kk_inbox_list_conversations'));
});
