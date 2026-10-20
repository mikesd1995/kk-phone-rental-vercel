'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dispatch=require('../api/kk-scanner-dispatch');

function response(){
  return {statusCode:0,headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;},end(body){this.body=JSON.parse(body);}};
}

test('public owner-notify URL resolves to the existing function in isolated owner mode',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
  const rewrite=config.rewrites.find(row=>row.source==='/api/kk-make-owner-notify');
  assert.ok(rewrite,'owner-notify must have an explicit public rewrite instead of returning 404');
  const destination=new URL(rewrite.destination,'https://local.invalid');
  assert.equal(destination.pathname,'/api/kk-scanner-dispatch');
  assert.deepEqual([...destination.searchParams.entries()],[['owner_transport','v1']]);
  assert.equal(fs.existsSync(path.join(__dirname,'..','api','kk-make-owner-notify.js')),false,'reuse existing function capacity');
});

test('GET in owner mode is rejected before scanner readiness or command routes',async()=>{
  const res=response();
  await dispatch({method:'GET',url:'/api/kk-scanner-dispatch?owner_transport=v1',headers:{}},res);
  assert.equal(res.statusCode,405);
  assert.equal(res.body.error_code,'METHOD_NOT_ALLOWED');
  assert.equal(res.body.ok,false);
  assert.equal(res.body.data,undefined);
  assert.match(res.headers['cache-control'],/no-store/);
});

test('original pretty owner URL uses owner method gate even when rewrite query is not exposed',async()=>{
  for(const method of ['GET','OPTIONS']){
    const out=response();
    await dispatch({method,url:'/api/kk-make-owner-notify',headers:{}},out);
    assert.equal(out.statusCode,405,method);
    assert.equal(out.body.error_code,'METHOD_NOT_ALLOWED');
    assert.equal(out.body.data,undefined);
  }
});

test('every malformed owner selector is rejected before scanner or machine-command processing',async()=>{
  const cases=[
    {url:'/api/kk-scanner-dispatch?owner_transport='},
    {url:'/api/kk-scanner-dispatch?owner_transport=wrong'},
    {url:'/api/kk-scanner-dispatch?owner_transport=v1&owner_transport=v1'},
    {url:'/api/kk-scanner-dispatch?owner_transport=v1&owner_transport=wrong'},
    {url:'/api/kk-make-owner-notify?owner_transport=wrong'},
    {url:'/api/kk-scanner-dispatch',query:{owner_transport:['v1']}},
    {url:'/api/kk-scanner-dispatch',query:{owner_transport:['v1','v1']}},
    {url:'/api/kk-scanner-dispatch',query:{owner_transport:null}},
    {url:'/api/kk-scanner-dispatch',query:{owner_transport:{toString(){return 'v1';}}}}
  ];
  for(const input of cases){
    const out=response();
    await dispatch({...input,method:'POST',headers:{},body:{action:'ultraDeepMachineRun',command_id:'invalid'}},out);
    assert.equal(out.statusCode,400,JSON.stringify(input));
    assert.equal(out.body.error_code,'OWNER_TRANSPORT_SELECTOR_INVALID');
    assert.equal(out.body.data,undefined);
    assert.equal(out.body.send_allowed,false);
  }
});

test('explicit owner selector cannot conflict with an own query selector',async()=>{
  const out=response();
  await dispatch({method:'GET',url:'/api/kk-scanner-dispatch?owner_transport=v1',query:{owner_transport:'wrong'},headers:{}},out);
  assert.equal(out.statusCode,400);
  assert.equal(out.body.error_code,'OWNER_TRANSPORT_SELECTOR_INVALID');
});

test('owner selector does not read a deprecated query getter and normal scanner readiness stays unchanged',async()=>{
  let getterCalls=0;
  const input={method:'GET',url:'/api/kk-scanner-dispatch',headers:{}};
  Object.defineProperty(input,'query',{get(){getterCalls++;throw Error('deprecated getter');}});
  const out=response();
  await dispatch(input,out);
  assert.equal(getterCalls,0);
  assert.equal(out.statusCode,200);
  assert.ok(out.body.data);
});
