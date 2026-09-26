'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const R=require('../scripts/apps-script-timing-readback');

test('infers UTC+07 from an Apps Script local generated_at stamp',()=>{
  const before=Date.parse('2026-09-26T19:15:00Z');
  const after=Date.parse('2026-09-26T19:15:04Z');
  const out=R.inferOffsetMinutes('2026-09-27T02:15:02',before,after);
  assert.equal(out.offset_minutes,420);
  assert.deepEqual(out.matches,[420]);
  assert.equal(R.offsetLabel(out.offset_minutes),'+07:00');
});

test('canonical Apps Script exec URL is required',()=>{
  assert.equal(R.validateExecUrl('https://script.google.com/macros/s/abc123/exec'),'https://script.google.com/macros/s/abc123/exec');
  assert.throws(()=>R.validateExecUrl('https://script.google.com/macros/s/abc123/dev'),/NOT_EXEC/);
  assert.throws(()=>R.validateExecUrl('https://example.com/macros/s/abc123/exec'),/INVALID_HOST/);
});

test('probe posts only read-only phase1Health and never logs secrets in report',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-timing-'));
  const envFile=path.join(dir,'.env.production.local');
  fs.writeFileSync(envFile,[
    'KK_ADMIN_SCRIPT_URL="https://script.google.com/macros/s/deployment123/exec"',
    'KK_ADMIN_API_KEY="super-secret-key"',
    'GOOGLE_SHEET_ID="sheet-123"'
  ].join('\n'));
  const calls=[];
  const before=Date.parse('2026-09-26T19:15:00Z');
  let tick=0;
  const report=await R.run({
    envFile,
    now:()=>before+(tick++?4000:0),
    fetchImpl:async(url,opts)=>{
      calls.push({url,opts});
      return {
        ok:true,status:200,
        async text(){return JSON.stringify({
          ok:true,
          admin_api_version:'v-live',
          data:{
            admin_api_version:'v-live',
            spreadsheet_id:'sheet-123',
            frontend_sheet_id:'sheet-123',
            frontend_backend_same_sheet:true,
            generated_at:'2026-09-27T02:15:02'
          }
        });}
      };
    }
  });
  assert.equal(calls.length,1);
  const sent=JSON.parse(calls[0].opts.body);
  assert.deepEqual(sent,{action:'phase1Health',apiKey:'super-secret-key',frontendSheetId:'sheet-123'});
  assert.equal(report.timing.effective_utc_plus_7_verified,true);
  assert.equal(report.safety.sheet_business_writes,0);
  assert.equal(report.safety.trigger_mutations,0);
  assert.doesNotMatch(JSON.stringify(report),/super-secret-key/);
});

test('trigger evidence remains unverified when deployed phase1Health exposes none',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-trigger-'));
  const envFile=path.join(dir,'.env.production.local');
  fs.writeFileSync(envFile,'KK_ADMIN_SCRIPT_URL="https://script.google.com/macros/s/d/exec"\nKK_ADMIN_API_KEY="x"\nGOOGLE_SHEET_ID="s"');
  const t=Date.parse('2026-09-26T19:15:00Z');
  let n=0;
  const report=await R.run({
    envFile,now:()=>t+(n++?2000:0),
    fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,data:{spreadsheet_id:'s',frontend_sheet_id:'s',frontend_backend_same_sheet:true,generated_at:'2026-09-27T02:15:01'}})})
  });
  assert.equal(report.installed_triggers.readback_exposed_by_phase1_health,false);
  assert.equal(report.installed_triggers.cleanup_trigger_verified,false);
});
