'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(
  __dirname,'..','supabase','functions','kk-project-memory-github-read','index.ts'
),'utf8');

function functionSource(name){
  const start=source.indexOf('function '+name+'()');
  if(start<0)throw new Error(name+' missing');
  const end=source.indexOf('\n}',start);
  if(end<0)throw new Error(name+' missing closing brace');
  return source.slice(start,end+2);
}

// Exercise the real checked-in Edge helper, not a reimplementation.
// Deno secrets below are fake in-memory fixtures and nothing is sent to Supabase.
function resolveWithFakeEnv(env){
  let reads=0;
  const context={
    Deno:{env:{get(key){reads+=1;return env[key]||undefined;}}}
  };
  vm.runInNewContext(
    functionSource('secretKey')+'\n'+functionSource('internalRuntime'),
    context,{timeout:300}
  );
  const outcome={reads,invoke:()=>context.internalRuntime()};
  return outcome;
}

test('GitHub OIDC Agent Ledger credential helper is non-recursive and produces correct URL/key',()=>{
  const fixture=resolveWithFakeEnv({
    SUPABASE_URL:'https://example-ledger.supabase.co///',
    SUPABASE_SECRET_KEYS:JSON.stringify({default:'fake-test-only-key'})
  });
  const result=fixture.invoke();
  assert.equal(result.url,'https://example-ledger.supabase.co');
  assert.equal(result.key,'fake-test-only-key');
  assert.doesNotMatch(functionSource('internalRuntime'),/=\s*internalRuntime\s*\(/);
});

test('missing URL, missing key and malformed keys must fail closed before audit write',()=>{
  for(const [name,env] of [
    ['url-missing',{SUPABASE_SECRET_KEYS:'{"default":"test"}'}],
    ['key-missing',{SUPABASE_URL:'https://example.supabase.co'}],
    ['key-malformed',{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEYS:'{bad JSON'}],
    ['key-empty',{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEYS:'{"default":" "}' }]
  ]){
    const fixture=resolveWithFakeEnv(env);
    assert.throws(fixture.invoke,/SUPABASE_INTERNAL_CREDENTIALS_MISSING/,name);
  }
});

test('authenticate OIDC identity before routing any ledger write',()=>{
  assert.match(source,/await verifyIdentity\(token\)/);
  assert.match(source,/p\.ref!==REF/);
  assert.match(source,/p\.event_name!==EVENT_NAME/);
  assert.match(source,/ALLOWED_WORKFLOWS\.has\(String\(p\.workflow_ref\|\|""\)\)/);
  assert.match(source,/const REF="refs\/heads\/main"/);
  assert.match(source,/if\(body\.probe==="agent-invocation-write"\)/);
  assert.ok(source.indexOf('await verifyIdentity(token)')<
    source.indexOf('if(body.probe==="agent-invocation-write")'));
});

test('only append audit invocation; reject invalid payload and return zero business writes',()=>{
  const writer=source.slice(source.indexOf('async function writeAgentInvocation('),
    source.indexOf('\nfunction safeDomains('));
  assert.match(writer,/const checked=normalizeAgentInvocation\(body\.row\)/);
  assert.ok(writer.indexOf('checked.errors.length')<writer.indexOf('const {url,key}=internalRuntime()'));
  assert.match(writer,/\/rest\/v1\/kk_agent_invocations\?on_conflict=invocation_id/);
  assert.match(writer,/resolution=ignore-duplicates,return=representation/);
  assert.match(source,/AGENT_INVOCATION_ROW_INVALID/);
  assert.match(source,/business_writes:0/);
  assert.match(source,/production_writes:0/);
  assert.match(source,/publishes:0/);
  assert.doesNotMatch(writer,/\/rest\/v1\/(?:bookings|events|orders|customers|inbox_messages)/);
});

test('read-only project memory route remains separate from audit writer',()=>{
  assert.match(source,/if\(body\.probe==="project-memory"\)/);
  assert.match(source,/read_only:true,bounded_limit:result\.limit/);
  assert.match(source,/select:"memory_id,occurred_at,kind,domain,summary,evidence_refs,supersedes,status,source,source_commit_sha"/);
  assert.match(source,/if\(!url\|\|!key\)throw new Error\("SUPABASE_INTERNAL_CREDENTIALS_MISSING"\)/);
  assert.match(source,/rows:\[\],business_writes:0/);
});


function fakeWriterHarness({validationErrors=[],upstreamRows=[{invocation_id:'agi_fixture_1234567890abcdef'}],upstreamOk=true,throwFetch=false}={}){
  const calls=[];
  const actualWriteSource=source.slice(
    source.indexOf('async function writeAgentInvocation('),
    source.indexOf('\nfunction safeDomains(')
  ).replace('body:Record<string,unknown>','body').replace('let r:Response;','let r;');
  const context={
    Deno:{env:{get(name){
      if(name==='SUPABASE_URL')return 'https://test-ledger.supabase.co/';
      if(name==='SUPABASE_SECRET_KEYS')return '{"default":"FAKE_UNIT_TEST_KEY"}';
      return undefined;
    }}},
    normalizeAgentInvocation:()=>({
      row:{
        invocation_id:'agi_fixture_1234567890abcdef',
        required_agents:['kk-marketing-agent','kk-content-selector'],
        gate_status:'READY_FOR_OWNER_REVIEW',
        production_writes:0,publishes:0
      },
      errors:validationErrors
    }),
    fetch:async (url,options)=>{
      calls.push({url,options});
      if(throwFetch)throw new Error('FAKE_TRANSPORT_FAILURE');
      return {ok:upstreamOk,json:async()=>upstreamRows};
    },
    AbortSignal:{timeout:(ms)=>({timeout_ms:ms})},
    DOMException
  };
  vm.runInNewContext(
    functionSource('secretKey')+'\n'+functionSource('internalRuntime')+'\n'+actualWriteSource,
    context,{timeout:300}
  );
  return {invoke:()=>context.writeAgentInvocation({row:{}}),calls};
}

test('audit writer POSTs one zero-business-write row to exact idempotent table',async()=>{
  const h=fakeWriterHarness();
  const result=await h.invoke();
  assert.equal(result.invocation_id,'agi_fixture_1234567890abcdef');
  assert.equal(result.inserted,true);
  assert.equal(h.calls.length,1);
  const call=h.calls[0];
  assert.equal(call.url,
    'https://test-ledger.supabase.co/rest/v1/kk_agent_invocations?on_conflict=invocation_id');
  assert.equal(call.options.method,'POST');
  assert.equal(call.options.headers.apikey,'FAKE_UNIT_TEST_KEY');
  assert.equal(call.options.headers.Prefer,'resolution=ignore-duplicates,return=representation');
  assert.deepEqual(JSON.parse(call.options.body),[{
    invocation_id:'agi_fixture_1234567890abcdef',
    required_agents:['kk-marketing-agent','kk-content-selector'],
    gate_status:'READY_FOR_OWNER_REVIEW',
    production_writes:0,publishes:0
  }]);
});

test('idempotent duplicate reports no insert and does not claim a new audit write',async()=>{
  const h=fakeWriterHarness({upstreamRows:[]});
  const result=await h.invoke();
  assert.equal(result.inserted,false);
  assert.equal(h.calls.length,1);
});

test('invalid agent invocation blocks before fetching or using runtime credentials',async()=>{
  const h=fakeWriterHarness({validationErrors:['INVOCATION_ID_INVALID']});
  await assert.rejects(h.invoke(),/AGENT_INVOCATION_ROW_INVALID/);
  assert.equal(h.calls.length,0);
});

test('upstream HTTP failure and transport exceptions are never treated as persisted',async()=>{
  const http=fakeWriterHarness({upstreamOk:false});
  await assert.rejects(http.invoke(),/AGENT_INVOCATION_WRITE_FAILED/);
  assert.equal(http.calls.length,1);
  const network=fakeWriterHarness({throwFetch:true});
  await assert.rejects(network.invoke(),/AGENT_INVOCATION_WRITE_TRANSPORT_FAILED/);
  assert.equal(network.calls.length,1);
});

test('malformed upstream readback blocks rather than inventing a successful insert',async()=>{
  const h=fakeWriterHarness({upstreamRows:{wrong:'shape'}});
  await assert.rejects(h.invoke(),/AGENT_INVOCATION_WRITE_RESPONSE_INVALID/);
});
