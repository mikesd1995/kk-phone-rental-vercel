'use strict';
// Integration test: actual HTTP, real Admin session signer, V6 adapter and V5
// snapshot reader. All source records are synthetic and live in process memory.
// Never reads Google Sheet, Apps Script, Production secrets or a live URL.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const Fallback=require('../server/admin-sheet-fallback.js');
const Adapter=require('../api/kk-admin-snapshot-v6.js');

function syntheticSnapshot(){
 const raw={
  events:[{event_id:'OPS-TEST-ONLY',event_name:'Synthetic CI Event',event_date:'31/12/2030',venue:'Test Hall',event_status:'open',active_on_web:'TRUE'}],
  bookings:[{__row_number:5,booking_id:'CI-PRIVATE-BOOKING-123',event_id:'OPS-TEST-ONLY',booking_status:'confirmed',customer_name:'CI-PRIVATE-CUSTOMER-SENTINEL',customer_phone:'0000000000',package_type:'phone_only',phone_asset_id:'CI-PHONE',pickup_time:'12:00',payment_status:'paid',amount_received:'9999'}],
  assets:[{asset_id:'CI-PHONE',asset_type:'phone',model_group:'VIVO_X300_PRO',status:'available',rentable_now:'TRUE'}],
  packages:[{template_id:'CI-TPL',model_group:'VIVO_X300_PRO',package_type:'phone_only',standard_price:'690',display_name:'Synthetic Phone',active:'TRUE'}],
  overrides:[],
  web_ready:[{event_id:'OPS-TEST-ONLY',event_name:'Synthetic CI Event',event_date_text:'2030-12-31',venue:'Test Hall',available_phone_count:'1',action_for_web:'show'}],
  web_packages:[{package_id:'CI-PACK',event_id:'OPS-TEST-ONLY',package_type:'phone_only',price:'690',available_count:'1',package_status:'available'}],
  customers:[],health:[],
  visibility_locks:[{__row_number:2,lock_id:'LOCK|OPS-TEST-ONLY',event_id:'OPS-TEST-ONLY',lock_state:'REOPENED'}],
  model_master:[{model_group:'VIVO_X300_PRO',model_display:'Synthetic Phone',asset_type:'phone',active:'TRUE'}]
 };
 return Fallback.buildFromRaw(raw,'SYNTHETIC-CI-ONLY',Date.now());
}
async function startServer(){
 const errors=[];
 const server=http.createServer((req,res)=>{Promise.resolve(Adapter(req,res)).catch(err=>{
   errors.push(err);res.statusCode=500;res.end('synthetic internal failure');
 });});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 return {server,errors,origin:'http://127.0.0.1:'+server.address().port};
}
function restoreEnv(before,keys){
 for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
}

test('HTTP login -> signed cookie -> real V5 synthetic snapshot projection, then negative access cases', {timeout:15000},async()=>{
 const keys=['KK_ADMIN_PIN','KK_ADMIN_SESSION_SECRET','GOOGLE_SHEET_ID','KK_ADMIN_SCRIPT_URL','KK_ADMIN_API_KEY','KK_ADMIN_READ_MODE','KK_ADMIN_FALLBACK_REQUIRE_PRIVATE'];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const original=Fallback.buildSnapshot;
 let server;
 let sourceReads=0;
 try{
  process.env.KK_ADMIN_PIN='CI-ONLY-LOCAL-PIN-NO-PRODUCTION-SECRET';
  process.env.KK_ADMIN_SESSION_SECRET='CI-ONLY-SIGNED-SESSION-NO-PRODUCTION-KEY';
  process.env.GOOGLE_SHEET_ID='SYNTHETIC-CI-ONLY';
  process.env.KK_ADMIN_SCRIPT_URL='';
  process.env.KK_ADMIN_API_KEY='';
  process.env.KK_ADMIN_READ_MODE='direct-sheet-primary';
  process.env.KK_ADMIN_FALLBACK_REQUIRE_PRIVATE='false';
  Fallback.buildSnapshot=async({sheetId})=>{
   sourceReads++;
   assert.equal(sheetId,'SYNTHETIC-CI-ONLY');
   return syntheticSnapshot();
  };
  const run=await startServer();server=run.server;
  const base=run.origin;
  const withoutCookie=await fetch(base+'/api/kk-admin?action=operationsSnapshot');
  assert.equal(withoutCookie.status,401);
  assert.equal((await withoutCookie.json()).ok,false);
  assert.equal(sourceReads,0,'unauthenticated request must not access any source');
  for(const gate of ['auth','asset','make-health','make-verify','app']){
   const spoof=await fetch(base+'/api/kk-admin?action=operationsSnapshot&__kk_gate='+encodeURIComponent(gate),{redirect:'manual'});
   assert.equal(spoof.status,401,'untrusted gate must not override Operations authorization: '+gate);
   assert.equal(sourceReads,0);
  }

  const pinOnly=await fetch(base+'/api/kk-admin?action=operationsSnapshot',{headers:{'x-admin-pin':process.env.KK_ADMIN_PIN}});
  assert.equal(pinOnly.status,401);
  assert.equal(sourceReads,0,'PIN-only request must not access operations snapshot');

  const badOrigin=await fetch(base+'/api/kk-admin-auth',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://wrong.example'},body:JSON.stringify({pin:process.env.KK_ADMIN_PIN})});
  assert.equal(badOrigin.status,403);
  assert.equal(sourceReads,0);

  const login=await fetch(base+'/api/kk-admin-auth',{
   method:'POST',
   headers:{'Content-Type':'application/json','Origin':base},
   body:JSON.stringify({pin:process.env.KK_ADMIN_PIN})
  });
  assert.equal(login.status,200);
  const auth=await login.json();assert.equal(auth.authenticated,true);
  const cookie=String(login.headers.get('set-cookie')||'').split(';')[0];
  assert.match(cookie,/^__Host-kk_admin_session=/);
  assert.match(String(login.headers.get('set-cookie')||''),/HttpOnly/i);
  assert.match(String(login.headers.get('set-cookie')||''),/SameSite=Strict/i);

  const good=await fetch(base+'/api/kk-admin?action=operationsSnapshot',{headers:{Cookie:cookie,'x-admin-pin':'UNTRUSTED-PIN'}});
  assert.equal(good.status,200);
  assert.match(String(good.headers.get('cache-control')),/no-store/);
  assert.equal(good.headers.get('x-kk-ops-projection-version'),'kk-admin-ops-projection-v1');
  const body=await good.json();
  assert.equal(body.ok,true);assert.equal(body.data.events[0].event_id,'OPS-TEST-ONLY');
  assert.equal(body.data.bookings.length,1);assert.ok(body.data.bookings[0].booking_id);
  const json=JSON.stringify(body);
  for(const marker of ['CI-PRIVATE-BOOKING-123','CI-PRIVATE-CUSTOMER-SENTINEL','0000000000','9999','customer_phone','payment_status','SYNTHETIC-CI-ONLY','UNTRUSTED-PIN']){
   assert.ok(!json.includes(marker),'private marker leaked: '+marker);
  }
  assert.equal(sourceReads,1);

  const assetsNoCookie=await fetch(base+'/admin/operations-dashboard.js',{redirect:'manual'});
  assert.equal(assetsNoCookie.status,307);
  assert.equal(assetsNoCookie.headers.get('location'),'/admin');
  const assetsWithCookie=await fetch(base+'/admin/operations-dashboard.js',{headers:{Cookie:cookie}});
  assert.equal(assetsWithCookie.status,200);
  assert.match(String(assetsWithCookie.headers.get('content-type')),/javascript/);

  const app=await fetch(base+'/admin/app',{headers:{Cookie:cookie},redirect:'manual'});
  assert.equal(app.status,200);
  assert.match(String(app.headers.get('content-security-policy')),/frame-ancestors 'none'/);
  assert.ok(!run.errors.length);
 }finally{
  Fallback.buildSnapshot=original;
  restoreEnv(before,keys);
  if(server)await new Promise(resolve=>{server.closeAllConnections?.();server.close(resolve)});
 }
});
