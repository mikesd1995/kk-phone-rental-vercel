'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../.github/workflows/kk-external-witness-clock.yml'),'utf8');
const inline=source.split("node <<'NODE'\n")[1].split('\n          NODE')[0].split('\n').map(line=>line.replace(/^          /,'')).join('\n');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run(status,body){
  const logs=[]; const requests=[];
  const fakeFetch=async(url,options)=>{
    requests.push({url,options});
    if(requests.length===1)return {ok:true,status:200,json:async()=>({value:'test-oidc-token'})};
    return {ok:status>=200&&status<300,status,json:async()=>body};
  };
  const FakeDate=class extends Date{static now(){return Date.parse('2026-09-28T00:30:59Z');}};
  let error;
  try{await new AsyncFunction('process','fetch','console','Date',inline)(
    {env:{EDGE_URL:'https://edge.invalid/witness',ACTIONS_ID_TOKEN_REQUEST_URL:'https://oidc.invalid/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'test-request-token'}},
    fakeFetch,{log:v=>logs.push(String(v)),error:v=>logs.push(String(v))},FakeDate);
  }catch(e){error=e;}
  return {logs:logs.join('\n'),requests,error};
}
test('late Edge rejection reports timing cause and remains a failed run',async()=>{
  const r=await run(400,{ok:false,error_code:'TRIGGER_SCHEDULE_STALE'});
  assert.match(r.error.message,/WITNESS_EDGE_REJECTED_400_TRIGGER_SCHEDULE_STALE/);
  assert.match(r.logs,/failure_class=SCHEDULE_WINDOW_EXCEEDED/);
  const sent=JSON.parse(r.requests[1].options.body);
  assert.equal(sent.scheduled_at,'2026-09-28T07:00:00+07:00');
  assert.equal(sent.issued_at,'2026-09-28T07:30:59+07:00');
  assert.equal(r.requests.length,2);
});
test('disabled gate reports control state and remains a failed run',async()=>{
  const r=await run(503,{ok:false,error_code:'WITNESS_KILL_SWITCH_DISABLED'});
  assert.match(r.error.message,/WITNESS_KILL_SWITCH_DISABLED/);
  assert.match(r.logs,/failure_class=CONTROL_GATE_DISABLED/);
  assert.equal(r.requests.length,2);
});
test('unknown Edge failure is not blamed on scheduling or quota',async()=>{
  const r=await run(503,{ok:false,error_code:'LEDGER_WRITE_FAILED'});
  assert.match(r.error.message,/LEDGER_WRITE_FAILED/);
  assert.match(r.logs,/failure_class=EDGE_REJECTION_UNCLASSIFIED/);
  assert.doesNotMatch(r.logs,/test-oidc-token|test-request-token/);
});
test('accepted witness preserves zero-business-write result',async()=>{
  const r=await run(202,{ok:true,business_writes:0,scanner_execution_started:false,ledger_inserted:true});
  assert.equal(r.error,undefined);
  assert.match(r.logs,/GITHUB_OIDC_WITNESS_ACCEPTED/);
  assert.doesNotMatch(r.logs,/failure_class=/);
});
test('successful HTTP cannot hide authority boundary violation',async()=>{
  const r=await run(202,{ok:true,business_writes:1,scanner_execution_started:true});
  assert.match(r.error.message,/WITNESS_AUTHORITY_BOUNDARY_VIOLATION/);
  assert.doesNotMatch(r.logs,/GITHUB_OIDC_WITNESS_ACCEPTED/);
});
