'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');

const Phase1=require('../server/admin-direct-writer-phase1.js');
const Proxy=require('../server/admin-proxy.js');

function activeEnv(extra={}){
  return Object.assign({
    GOOGLE_SHEET_ID:'12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU',
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
    KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
    KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1',
    KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:'updateEvent,updatePackage,upsertEventOverride'
  },extra);
}

function eventData(){
  return {
    events:[['EVT-1','Old Event',46273,'Old Venue','https://img/old','open',true,'note']],
    packages:[],
    overrides:[],
    web:[['EVT-1-TPL-A','EVT-1','phone_only','VIVO_X300_PRO','Vivo X300 Pro','NONE','',890,2,'available',10,'',2,'']],
    webPriceFormula:[['=IF(B5="","",890)']]
  };
}

test('Phase 1 routing is fail-closed until explicit action allowlist is present',()=>{
  const base=activeEnv({KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:''});
  const state=Phase1.routingState(base);
  assert.equal(state.writer_ready,true);
  assert.equal(state.ready,false);
  assert.deepEqual(state.configured_actions,[]);
  assert.equal(state.booking_routed,false);
  assert.equal(state.asset_routed,false);
  assert.equal(state.create_event_routed,false);
});

test('updateEvent planner is update-in-place, preserves web price cells, and refuses poster writes',()=>{
  const p=Phase1.buildUpdateEventPlan({
    action:'updateEvent',
    event_id:'EVT-1',
    event_name:'New Event',
    event_date:'2026-09-09',
    venue:'New Venue',
    status:'closed',
    active_on_web:false,
    note:'new note'
  },eventData());
  assert.equal(p.legacy_required,undefined);
  assert.equal(p.result.event_id,'EVT-1');
  assert.equal(p.result.row_number,5);
  assert.equal(p.result.web_package_prices_preserved,1);
  assert.equal(p.mutations[0].sheet,'01_Events');
  assert.equal(p.mutations[0].row,5);
  assert.equal(p.mutations[0].values[1],'New Event');
  assert.equal(p.mutations[0].values[3],'New Venue');
  assert.equal(p.mutations[0].values[5],'closed');
  assert.equal(p.mutations[0].values[6],false);
  assert.equal(p.mutations[1].sheet,'09_Web_Packages');
  assert.equal(p.mutations[1].column,8);
  assert.equal(p.mutations[1].values[0],'=IF(B5="","",890)');
  assert.equal(p.readbacks[1].render,'FORMULA');

  const legacy=Phase1.buildUpdateEventPlan({
    action:'updateEvent',event_id:'EVT-1',poster_url:'https://drive.google.com/new'
  },eventData());
  assert.equal(legacy.legacy_required,true);
  assert.equal(legacy.reason,'POSTER_WRITE_REQUIRES_APPS_SCRIPT');
});

test('updatePackage planner preserves untouched columns and matches Apps Script update semantics',()=>{
  const data={packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','note',true,10,'old']]};
  const p=Phase1.buildUpdatePackagePlan({
    action:'updatePackage',template_id:'TPL-PHONE',standard_price:790,display_name:'Phone New',active:false,use_case:'stage'
  },data);
  assert.equal(p.result.row_number,5);
  assert.deepEqual(p.mutations[0].values,[
    'TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',790,'Phone New','note',false,10,'stage'
  ]);
});

test('override planner routes only one existing row and refreshes only matching web price rows',()=>{
  const data={
    events:[['EVT-1','E',46273,'V','','open',true,'']],
    packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','',true,10,'']],
    overrides:[['EVT-1','TPL-PHONE',890,'','','','']],
    web:[
      ['EVT-1-TPL-PHONE','EVT-1','phone_only','VIVO_X300_PRO','Phone','NONE','',890,2,'available',10,'',2,''],
      ['EVT-1-TPL-OTHER','EVT-1','lens_only','NONE','','ZEISS_2_35X','Lens',390,2,'available',20,'',2,'']
    ]
  };
  const p=Phase1.buildOverridePlan({
    action:'upsertEventOverride',event_id:'EVT-1',template_id:'EVT-1-TPL-PHONE',
    override_price:690,active_override:true,override_note:'promo',sort_order_override:5,use_case_override:'concert'
  },data);
  assert.equal(p.legacy_required,undefined);
  assert.equal(p.result.row_number,5);
  assert.equal(p.result.web_price_rows_refreshed,1);
  assert.deepEqual(p.mutations[0].values,['EVT-1','TPL-PHONE',690,true,'promo',5,'concert']);
  assert.equal(p.mutations[1].sheet,'09_Web_Packages');
  assert.equal(p.mutations[1].row,5);
  assert.equal(p.mutations[1].values[0],690);

  const clear=Phase1.buildOverridePlan({
    action:'upsertEventOverride',event_id:'EVT-1',template_id:'TPL-PHONE',override_price:''
  },data);
  assert.match(clear.mutations[1].values[0],/^=IF\(B5=/);
  assert.match(clear.mutations[1].values[0],/TPL-PHONE/);
  assert.equal(clear.readbacks[1].render,'FORMULA');
});

test('new or duplicate override rows stay on Apps Script lock path',()=>{
  const base={
    events:[['EVT-1','E',46273,'V','','open',true,'']],
    packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','',true,10,'']],
    web:[]
  };
  const create=Phase1.buildOverridePlan({
    action:'upsertEventOverride',event_id:'EVT-1',template_id:'TPL-PHONE',override_price:690
  },Object.assign({},base,{overrides:[]}));
  assert.equal(create.legacy_required,true);
  assert.equal(create.reason,'OVERRIDE_CREATE_REQUIRES_APPS_SCRIPT_LOCK');

  const dup=Phase1.buildOverridePlan({
    action:'upsertEventOverride',event_id:'EVT-1',template_id:'TPL-PHONE',override_price:690
  },Object.assign({},base,{overrides:[
    ['EVT-1','TPL-PHONE',890],['EVT-1','TPL-PHONE',790]
  ]}));
  assert.equal(dup.legacy_required,true);
  assert.equal(dup.reason,'OVERRIDE_DUPLICATE_CLEANUP_REQUIRES_APPS_SCRIPT_LOCK');
});

test('atomic request builder never targets Booking or Asset sheets and appends audit in same batch',()=>{
  const plan=Phase1.buildUpdatePackagePlan({
    action:'updatePackage',template_id:'TPL-PHONE',standard_price:790
  },{packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','',true,10,'']]});
  const requests=Phase1.requestsForPlan(plan,{
    '01_Events':11,'03_Packages':12,'04_Event_Overrides':13,'09_Web_Packages':14,'15_Admin_Audit_Log':15
  },'req-12345678',new Date('2026-09-22T14:00:00Z'));
  assert.equal(requests.length,2);
  assert.equal(requests[0].updateCells.range.sheetId,12);
  assert.equal(requests[1].appendCells.sheetId,15);
  const raw=JSON.stringify(requests);
  assert.doesNotMatch(raw,/00_Master_Booking|02_Assets/);
  assert.match(raw,/req-12345678/);
});

test('tryExecute performs one atomic batch and exact readback only after every activation gate passes',async()=>{
  const calls=[];
  const result=await Phase1.tryExecute({
    action:'updatePackage',template_id:'TPL-PHONE',standard_price:790,request_id:'req-12345678'
  },{
    env:activeEnv({KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:'updatePackage'}),
    tokenProvider:async()=> 'token',
    findAuditRequest:async()=>null,
    loadModel:async()=>({packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','',true,10,'']]}),
    sheetMap:async()=>({
      '01_Events':11,'03_Packages':12,'04_Event_Overrides':13,'09_Web_Packages':14,'15_Admin_Audit_Log':15
    }),
    executeBatch:async reqs=>{calls.push(['batch',reqs]);return {replies:[]};},
    verifyReadbacks:async plan=>{calls.push(['readback',plan.action]);return true;},
    verifyAudit:async id=>{calls.push(['audit',id]);return {ok:true,row_number:1200};}
  });
  assert.equal(result.handled,true);
  assert.equal(result.body.ok,true);
  assert.equal(result.body.write_transport,'direct-google-sheets');
  assert.equal(result.body.no_legacy_fallback,true);
  assert.equal(result.body.data.request_id,'req-12345678');
  assert.equal(result.body.data.audit_row_number,1200);
  assert.equal(calls[0][0],'batch');
  assert.equal(calls[1][0],'readback');
  assert.equal(calls[2][0],'audit');
});

test('tryExecute does not touch Google when writer identity/acceptance is not ready',async()=>{
  let calls=0;
  const out=await Phase1.tryExecute({action:'updatePackage',template_id:'TPL-PHONE'},{
    env:{
      GOOGLE_SHEET_ID:'12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU',
      KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:'updatePackage'
    },
    tokenProvider:async()=>{calls++;return 'should-not-run';}
  });
  assert.equal(out.handled,false);
  assert.equal(out.reason,'WRITER_NOT_READY');
  assert.equal(calls,0);
});

test('direct execution failure is marked no-fallback instead of silently retrying through Apps Script',async()=>{
  await assert.rejects(
    ()=>Phase1.tryExecute({
      action:'updatePackage',template_id:'TPL-PHONE',standard_price:790
    },{
      env:activeEnv({KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:'updatePackage'}),
      tokenProvider:async()=> 'token',
      findAuditRequest:async()=>null,
      loadModel:async()=>({packages:[['TPL-PHONE','VIVO_X300_PRO','phone_only','NONE',890,'Phone','',true,10,'']]}),
      sheetMap:async()=>({
        '01_Events':11,'03_Packages':12,'04_Event_Overrides':13,'09_Web_Packages':14,'15_Admin_Audit_Log':15
      }),
      executeBatch:async()=>{throw Object.assign(new Error('batch failed'),{code:'TEST_BATCH_FAILED'});}
    }),
    err=>err&&err.code==='TEST_BATCH_FAILED'&&err.no_legacy_fallback===true
  );
});

function req(body){
  const r=Readable.from([JSON.stringify(body)]);
  r.method='POST';
  r.url='/api/kk-admin';
  r.headers={'x-admin-pin':'1234'};
  return r;
}
function res(){
  return {
    statusCode:0,headers:{},body:'',
    setHeader(k,v){this.headers[k]=v;},
    end(v){this.body=String(v||'');}
  };
}

test('Admin proxy can serve an accepted direct write even when Apps Script transport is unconfigured',async t=>{
  const oldEnv={...process.env};
  process.env.KK_ADMIN_PIN='1234';
  delete process.env.KK_ADMIN_SCRIPT_URL;
  delete process.env.KK_ADMIN_API_KEY;
  const oldTry=Phase1.tryExecute;
  Phase1.tryExecute=async()=>({
    handled:true,status:200,
    body:{ok:true,data:{template_id:'TPL-PHONE'},write_transport:'direct-google-sheets',no_legacy_fallback:true}
  });
  t.after(()=>{process.env=oldEnv;Phase1.tryExecute=oldTry;});
  const out=res();
  await Proxy(req({action:'updatePackage',template_id:'TPL-PHONE'}),out);
  assert.equal(out.statusCode,200);
  assert.equal(JSON.parse(out.body).ok,true);
  assert.equal(out.headers['X-KK-Admin-Write-Transport'],'DIRECT_GOOGLE_SHEETS');
});

test('Admin proxy never falls through to Apps Script after an accepted direct route fails',async t=>{
  const oldEnv={...process.env};
  process.env.KK_ADMIN_PIN='1234';
  process.env.KK_ADMIN_SCRIPT_URL='https://script.google.com/macros/s/test/exec';
  process.env.KK_ADMIN_API_KEY='key';
  const oldTry=Phase1.tryExecute;
  const oldFetch=global.fetch;
  let upstreamCalls=0;
  Phase1.tryExecute=async()=>{throw Object.assign(new Error('readback failed'),{
    code:'DIRECT_PHASE1_READBACK_MISMATCH',mutation_committed:true,no_legacy_fallback:true
  });};
  global.fetch=async()=>{upstreamCalls++;throw new Error('legacy must not run');};
  t.after(()=>{process.env=oldEnv;Phase1.tryExecute=oldTry;global.fetch=oldFetch;});
  const out=res();
  await Proxy(req({action:'updatePackage',template_id:'TPL-PHONE'}),out);
  const body=JSON.parse(out.body);
  assert.equal(out.statusCode,502);
  assert.equal(body.no_legacy_fallback,true);
  assert.equal(body.mutation_committed,true);
  assert.equal(out.headers['X-KK-Admin-Direct-No-Fallback'],'TRUE');
  assert.equal(upstreamCalls,0);
});


test('request_id replay returns prior accepted result without a second business mutation',async()=>{
  let loadCalls=0,batchCalls=0;
  const result=await Phase1.tryExecute({
    action:'updatePackage',template_id:'TPL-PHONE',standard_price:790,request_id:'req-replay-12345'
  },{
    env:activeEnv({KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS:'updatePackage'}),
    tokenProvider:async()=> 'token',
    findAuditRequest:async id=>({
      row_number:1201,
      action:'updatePackage',
      status:'OK',
      result:{template_id:'TPL-PHONE',row_number:5,request_id:id}
    }),
    loadModel:async()=>{loadCalls++;return {};},
    executeBatch:async()=>{batchCalls++;return {};}
  });
  assert.equal(result.handled,true);
  assert.equal(result.body.idempotent_replay,true);
  assert.equal(result.body.data.idempotent_replay,true);
  assert.equal(result.body.data.audit_row_number,1201);
  assert.equal(loadCalls,0);
  assert.equal(batchCalls,0);
});

test('Admin UI assigns one request_id per write call and allows only accepted direct actions during legacy outage',()=>{
  const fs=require('node:fs');
  const ui=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
  assert.match(ui,/function directPhase1ActionAvailable\(action\)/);
  assert.match(ui,/direct_writer_phase1_state/);
  assert.match(ui,/outbound\.request_id=adminRequestId\(\)/);
  assert.match(ui,/degraded_read_only[\s\S]{0,400}!directPhase1/);
});
