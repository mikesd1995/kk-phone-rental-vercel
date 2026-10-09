'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const handler=require('../api/kk-intelligence-health');

function fakeRes(){
  let body='';
  const headers={};
  return {
    statusCode:200,
    headers,
    setHeader(k,v){headers[String(k).toLowerCase()]=v;},
    end(v){body=String(v||'');},
    json(){return JSON.parse(body||'{}');}
  };
}
function withEnv(patch,fn){
  const before={};
  for(const k of Object.keys(patch)){
    before[k]=process.env[k];
    const v=patch[k];
    if(v===undefined) delete process.env[k]; else process.env[k]=v;
  }
  return Promise.resolve().then(fn).finally(()=>{
    for(const k of Object.keys(patch)){
      if(before[k]===undefined) delete process.env[k]; else process.env[k]=before[k];
    }
  });
}

test('timing readback infers UTC+07 from live-format generated_at without mutating anything',async()=>{
  const t=Date.parse('2026-09-26T21:30:00Z');
  let n=0;
  const report=await handler._test.appsScriptTimingReadback({
    env:{
      KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/deployment123/exec',
      KK_ADMIN_API_KEY:'do-not-leak',
      GOOGLE_SHEET_ID:'sheet-123'
    },
    now:()=>t+(n++?3000:0),
    fetchImpl:async(url,opts)=>{
      assert.equal(url,'https://script.google.com/macros/s/deployment123/exec');
      const sent=JSON.parse(opts.body);
      assert.deepEqual(sent,{action:'phase1Health',apiKey:'do-not-leak',frontendSheetId:'sheet-123'});
      return {
        ok:true,status:200,
        text:async()=>JSON.stringify({
          ok:true,
          data:{
            spreadsheet_id:'sheet-123',
            frontend_sheet_id:'sheet-123',
            frontend_backend_same_sheet:true,
            admin_api_version:handler._test.EXPECTED_APPS_SCRIPT_VERSION,
            project_timezone:'Asia/Bangkok',
            installed_trigger_count:1,
            installed_triggers:[{handler_function:'kkCleanupOldData30DaysAuto',event_type:'CLOCK',trigger_source:'CLOCK'}],
            cleanup_trigger_present:true,
            cleanup_trigger_count:1,
            cleanup_trigger_schedule:'UNVERIFIED_BY_TRIGGER_API',
            generated_at:'2026-09-27T04:30:01'
          }
        })
      };
    }
  });
  assert.equal(report.status,'READBACK_COMPLETE');
  assert.equal(report.effective_utc_offset,'+07:00');
  assert.equal(report.effective_utc_plus_7_verified,true);
  assert.equal(report.backend_sheet_identity_verified,true);
  assert.equal(report.admin_api_version,handler._test.EXPECTED_APPS_SCRIPT_VERSION);
  assert.equal(report.admin_api_version_verified,true);
  assert.equal(report.source_equivalence,'UNVERIFIED');
  assert.equal(report.named_project_timezone,'Asia/Bangkok');
  assert.equal(report.installed_triggers,'VERIFIED_READBACK');
  assert.equal(report.installed_trigger_count,1);
  assert.equal(report.cleanup_trigger,'VERIFIED_PRESENT_SCHEDULE_UNVERIFIED');
  assert.equal(report.cleanup_trigger_count,1);
  assert.equal(report.cleanup_trigger_schedule,'UNVERIFIED_BY_TRIGGER_API');
  assert.deepEqual(report.safety,{
    read_only:true,apps_script_writes:0,sheet_business_writes:0,trigger_mutations:0,timezone_mutations:0,secrets_exposed:false
  });
  assert.doesNotMatch(JSON.stringify(report),/do-not-leak|deployment123|sheet-123/);
});

test('timing endpoint is the only public GET mode and remains secret-safe',async()=>{
  const oldFetch=global.fetch;
  await withEnv({
    KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/live123/exec',
    KK_ADMIN_API_KEY:'secret-key',
    GOOGLE_SHEET_ID:'sheet-live'
  },async()=>{
    let calls=0;
    global.fetch=async()=>{
      calls++;
      return {
        ok:true,status:200,
        text:async()=>JSON.stringify({
          ok:true,
          data:{
            spreadsheet_id:'sheet-live',
            frontend_sheet_id:'sheet-live',
            frontend_backend_same_sheet:true,
            admin_api_version:handler._test.EXPECTED_APPS_SCRIPT_VERSION,
            project_timezone:'Asia/Bangkok',
            installed_trigger_count:1,
            installed_triggers:[{handler_function:'kkCleanupOldData30DaysAuto',event_type:'CLOCK',trigger_source:'CLOCK'}],
            cleanup_trigger_present:true,
            cleanup_trigger_count:1,
            cleanup_trigger_schedule:'UNVERIFIED_BY_TRIGGER_API',
            generated_at:new Date(Date.now()+7*60*60*1000).toISOString().slice(0,19)
          }
        })
      };
    };
    handler._test.resetTimingCache();
    const req={method:'GET',url:'/api/kk-intelligence-health?mode=apps-script-timing',headers:{}};
    const res=fakeRes();
    await handler(req,res);
    const out=res.json();
    assert.equal(res.statusCode,200);
    assert.equal(out.ok,true);
    assert.equal(out.data.status,'READBACK_COMPLETE');
    assert.equal(out.data.effective_utc_plus_7_verified,true);
    assert.equal(out.data.backend_sheet_identity_verified,true);
    assert.equal(out.data.admin_api_version_verified,true);
    assert.equal(out.data.source_equivalence,'UNVERIFIED');
    assert.equal(out.data.named_project_timezone,'Asia/Bangkok');
    assert.equal(out.data.installed_triggers,'VERIFIED_READBACK');
    assert.equal(out.data.installed_trigger_count,1);
    assert.equal(out.data.cleanup_trigger,'VERIFIED_PRESENT_SCHEDULE_UNVERIFIED');
    assert.equal(calls,1);
    const serialized=JSON.stringify(out);
    assert.doesNotMatch(serialized,/secret-key|live123|sheet-live|script\.google\.com/);

    const res2=fakeRes();
    await handler(req,res2);
    assert.equal(res2.headers['x-kk-timing-cache'],'HIT');
    assert.equal(calls,1);
  });
  global.fetch=oldFetch;
});

test('ordinary anonymous GET remains rejected and private POST still requires Admin PIN',async()=>{
  const getRes=fakeRes();
  await handler({method:'GET',url:'/api/kk-intelligence-health',headers:{}},getRes);
  assert.equal(getRes.statusCode,405);

  const postRes=fakeRes();
  await withEnv({KK_ADMIN_PIN:'1234'},()=>handler({method:'POST',url:'/api/kk-intelligence-health',headers:{}},postRes));
  assert.equal(postRes.statusCode,401);
});

test('bad or absent runtime configuration fails closed without fetching',async()=>{
  let calls=0;
  const report=await handler._test.appsScriptTimingReadback({
    env:{KK_ADMIN_SCRIPT_URL:'',KK_ADMIN_API_KEY:'',GOOGLE_SHEET_ID:''},
    fetchImpl:async()=>{calls++;throw new Error('must not call');}
  });
  assert.equal(report.status,'CONFIG_BLOCKED');
  assert.equal(report.error_code,'APPS_SCRIPT_TIMING_CONFIG_UNAVAILABLE');
  assert.equal(report.effective_utc_plus_7_verified,false);
  assert.equal(calls,0);
});

test('canonical Apps Script URL validator rejects non-exec and non-Google hosts',()=>{
  assert.equal(
    handler._test.canonicalAppsScriptExecUrl('https://script.google.com/macros/s/abc123/exec'),
    'https://script.google.com/macros/s/abc123/exec'
  );
  assert.equal(handler._test.canonicalAppsScriptExecUrl('https://script.google.com/macros/s/abc123/dev'),'');
  assert.equal(handler._test.canonicalAppsScriptExecUrl('https://example.com/macros/s/abc123/exec'),'');
});

test('expected Apps Script runtime version is pinned to canonical Code.gs version',()=>{
  const source=fs.readFileSync('apps-script/Code.gs','utf8');
  const m=source.match(/const KK_ADMIN_VERSION = '([^']+)'/);
  assert.ok(m);
  assert.equal(handler._test.EXPECTED_APPS_SCRIPT_VERSION,m[1]);
});

test('mismatched deployed Apps Script version is visible but never treated as source equivalence',async()=>{
  const t=Date.parse('2026-10-02T15:00:00Z');
  let n=0;
  const report=await handler._test.appsScriptTimingReadback({
    env:{KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/deploy/exec',KK_ADMIN_API_KEY:'secret',GOOGLE_SHEET_ID:'sheet'},
    now:()=>t+(n++?1000:0),
    fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,data:{
      spreadsheet_id:'sheet',frontend_backend_same_sheet:true,admin_api_version:'older-version',generated_at:'2026-10-02T22:00:00'
    }})})
  });
  assert.equal(report.status,'READBACK_COMPLETE');
  assert.equal(report.admin_api_version_verified,false);
  assert.equal(report.source_equivalence,'UNVERIFIED');
  assert.equal(report.safety.apps_script_writes,0);
});

test('transient Apps Script health failures use a short anti-hammer cache window',()=>{
  assert.equal(handler._test.timingCacheTtl({status:'READBACK_COMPLETE'}),5*60*1000);
  assert.equal(handler._test.timingCacheTtl({status:'READBACK_BLOCKED'}),30*1000);
  assert.ok(handler._test.APPS_SCRIPT_TIMING_FAILURE_CACHE_TTL_MS < handler._test.APPS_SCRIPT_TIMING_CACHE_TTL_MS);
});

test('canonical phase1 health authority diagnostics are read-only and never claim trigger schedule',()=>{
  const source=fs.readFileSync('apps-script/Code.gs','utf8');
  const start=source.indexOf('function kkProjectAuthorityDiagnostics_()');
  const end=source.indexOf('\nfunction kkPhase1Diagnostics_',start);
  assert.ok(start>=0&&end>start);
  const fn=source.slice(start,end);
  assert.match(fn,/Session\.getScriptTimeZone\(\)/);
  assert.match(fn,/ScriptApp\.getProjectTriggers\(\)/);
  assert.match(fn,/cleanup_trigger_schedule: 'UNVERIFIED_BY_TRIGGER_API'/);
  assert.doesNotMatch(fn,/newTrigger|deleteTrigger|setProperty|setValues|appendRow/);
});

test('authority fields remain fail-closed when deployed 9.5.9 does not expose them',async()=>{
  const t=Date.parse('2026-10-02T15:00:00Z');
  let n=0;
  const report=await handler._test.appsScriptTimingReadback({
    env:{KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/deploy/exec',KK_ADMIN_API_KEY:'secret',GOOGLE_SHEET_ID:'sheet'},
    now:()=>t+(n++?1000:0),
    fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,data:{
      spreadsheet_id:'sheet',frontend_backend_same_sheet:true,admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',generated_at:'2026-10-02T22:00:00'
    }})})
  });
  assert.equal(report.named_project_timezone,'UNVERIFIED');
  assert.equal(report.installed_triggers,'UNVERIFIED');
  assert.equal(report.cleanup_trigger,'UNVERIFIED');
  assert.equal(report.source_equivalence,'UNVERIFIED');
});

for (const value of [null, '', '0', false, [], -1, 0.5, 9007199254740992]) {
  test(`trigger counts reject non-canonical evidence: ${JSON.stringify(value)}`, async()=>{
    const report=await handler._test.appsScriptTimingReadback({
      env:{KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/deploy/exec',KK_ADMIN_API_KEY:'secret',GOOGLE_SHEET_ID:'sheet'},
      fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({ok:true,data:{installed_trigger_count:value,cleanup_trigger_count:value}})})
    });
    assert.equal(report.installed_trigger_count,null);
    assert.equal(report.cleanup_trigger_count,null);
    assert.equal(report.installed_triggers,'UNVERIFIED');
  });
}
test('explicit numeric zero remains valid trigger count evidence', async()=>{
  const report=await handler._test.appsScriptTimingReadback({
    env:{KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/deploy/exec',KK_ADMIN_API_KEY:'secret',GOOGLE_SHEET_ID:'sheet'},
    fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({ok:true,data:{installed_trigger_count:0,cleanup_trigger_count:0,cleanup_trigger_present:false,installed_triggers:[]}})})
  });
  assert.equal(report.installed_trigger_count,0);
  assert.equal(report.cleanup_trigger_count,0);
  assert.equal(report.installed_triggers,'VERIFIED_READBACK');
  assert.equal(report.cleanup_trigger,'VERIFIED_ABSENT');
});
