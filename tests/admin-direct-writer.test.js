const test=require('node:test');
const assert=require('node:assert/strict');

const W=require('../server/admin-direct-writer.js');

function env(extra={}){
  return Object.assign({
    GOOGLE_SHEET_ID:W.CORE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----'
  },extra);
}

test.afterEach(()=>W.resetTokenCache());

test('direct writer stays fail-closed without credentials',()=>{
  const s=W.state({GOOGLE_SHEET_ID:W.CORE_SHEET_ID,KK_ADMIN_DIRECT_WRITER_ENABLED:'1',KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'});
  assert.equal(s.credentials_ready,false);
  assert.equal(s.ready,false);
  assert.throws(()=>W.requireActivated({GOOGLE_SHEET_ID:W.CORE_SHEET_ID}),/credentials|disabled/i);
});

test('credentials alone never activate production writes',()=>{
  const s=W.state(env());
  assert.equal(s.credentials_ready,true);
  assert.equal(s.enabled,false);
  assert.equal(s.accepted,false);
  assert.equal(s.write_probe_passed,false);
  assert.equal(s.ready,false);
});

test('writer requires enable, acceptance, probe and canonical sheet together',()=>{
  const almost=env({KK_ADMIN_DIRECT_WRITER_ENABLED:'1',KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1'});
  assert.equal(W.state(almost).ready,false);
  assert.throws(()=>W.requireActivated(almost),err=>err&&err.code==='DIRECT_WRITER_WRITE_PROBE_REQUIRED');

  const wrong=env({
    GOOGLE_SHEET_ID:'different-sheet',
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
    KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
    KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'
  });
  assert.equal(W.state(wrong).ready,false);
  assert.throws(()=>W.requireActivated(wrong),err=>err&&err.code==='DIRECT_WRITER_SHEET_MISMATCH');

  const ready=env({
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
    KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
    KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'
  });
  assert.equal(W.state(ready).ready,true);
});

test('action/range allowlist preserves formula columns and rejects arbitrary sheets',()=>{
  assert.equal(W.validateTarget('createBooking','00_Master_Booking!B25:T25').ok,true);
  assert.equal(W.validateTarget('createBooking','00_Master_Booking!A25:T25').ok,false);
  assert.equal(W.validateTarget('createEvent','01_Events!A25:H25').ok,true);
  assert.equal(W.validateTarget('createEvent','01_Events!A25:I25').ok,false);
  assert.equal(W.validateTarget('createEvent','01_Events!AA25:AH25').ok,false);
  assert.equal(W.validateTarget('upsertEventOverride','04_Event_Overrides!A25:G25').ok,true);
  assert.equal(W.validateTarget('upsertEventOverride','04_Event_Overrides!AA25:AG25').ok,false);
  assert.equal(W.validateTarget('auditLog','15_Admin_Audit_Log!A25:J25').ok,true);
  assert.equal(W.validateTarget('createBooking','Settings!B25:T25').ok,false);
  assert.equal(W.validateTarget('deleteAsset','02_Assets!A5:G5').ok,false);
});

test('updateValues refuses network when activation gate is incomplete',async()=>{
  let calls=0;
  await assert.rejects(
    ()=>W.updateValues({
      action:'createBooking',
      range:'00_Master_Booking!B25:T25',
      values:[['x']],
      env:env(),
      fetchImpl:async()=>{calls++;throw new Error('network should not run');},
      tokenProvider:async()=>{calls++;return 'token';}
    }),
    err=>err&&err.code==='DIRECT_WRITER_DISABLED'
  );
  assert.equal(calls,0);
});

test('updateValues sends only an allowlisted canonical range after all gates pass',async()=>{
  const requests=[];
  const active=env({
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
    KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
    KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'
  });
  const result=await W.updateValues({
    action:'createBooking',
    range:'00_Master_Booking!B25:T25',
    values:[['2026-09-22','confirmed','EVT-1']],
    env:active,
    tokenProvider:async()=> 'safe-test-token',
    fetchImpl:async(url,options)=>{
      requests.push({url:String(url),options});
      return {
        ok:true,status:200,
        async json(){return {updatedRange:'00_Master_Booking!B25:T25',updatedRows:1,updatedCells:3};}
      };
    }
  });
  assert.equal(result.ok,true);
  assert.equal(result.updated_rows,1);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/spreadsheets\/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU\/values/);
  assert.equal(requests[0].options.method,'PUT');
  assert.equal(requests[0].options.headers.Authorization,'Bearer safe-test-token');
});
