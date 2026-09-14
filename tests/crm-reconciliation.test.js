'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const recon=require('../api/lib/crm-reconciliation');

const base=[['source','booking_id','status','event_id','event_date','amount'],['current','B001','confirmed','E001','2026-09-15','690'],['archive','B002','completed','E000','2026-08-20','590']];

test('exact read models reconcile',()=>{
  const x=recon.compare(base,JSON.parse(JSON.stringify(base)),{requireData:true});
  assert.equal(x.ok,true);
  assert.equal(x.code,'CRM_RECON_OK');
  assert.equal(x.core_row_count,2);
  assert.equal(x.crm_row_count,2);
});

test('row-count mismatch blocks private analytics',()=>{
  const x=recon.compare(base,base.slice(0,2),{requireData:true});
  assert.equal(x.ok,false);
  assert.equal(x.code,'CRM_RECON_COUNT_MISMATCH');
});

test('same row count but changed data hash is detected',()=>{
  const changed=JSON.parse(JSON.stringify(base));
  changed[2][5]='999';
  const x=recon.compare(base,changed,{requireData:true});
  assert.equal(x.ok,false);
  assert.equal(x.code,'CRM_RECON_HASH_MISMATCH');
});

test('required empty dataset fails closed',()=>{
  const x=recon.compare([['source','booking_id']],[['source','booking_id']],{requireData:true});
  assert.equal(x.ok,false);
  assert.equal(x.code,'CRM_RECON_REQUIRED_EMPTY');
});

test('CSV parser preserves quoted values',()=>{
  const rows=recon.parseCsv('a,b\n"x,y","z""q"');
  assert.deepEqual(rows,[['a','b'],['x,y','z"q']]);
});

test('multi-dataset reconciliation blocks when any private runtime dataset differs',()=>{
  const ok=recon.compare(base,base,{requireData:true});
  const bad=recon.compare([['event_id'],['E1']],[['event_id'],['E2']],{requireData:false});
  const x=recon.combine({rental_dashboard_data:ok,event_archive:bad});
  assert.equal(x.ok,false);
  assert.equal(x.failed_dataset,'event_archive');
  assert.equal(x.code,'CRM_RECON_HASH_MISMATCH');
  assert.equal(x.datasets.rental_dashboard_data.ok,true);
  assert.equal(x.datasets.event_archive.ok,false);
});

test('multi-dataset reconciliation passes only when every runtime dataset matches',()=>{
  const a=recon.compare(base,base,{requireData:true});
  const b=recon.compare([['event_id'],['E1']],[['event_id'],['E1']],{requireData:false});
  const x=recon.combine({rental_dashboard_data:a,event_archive:b});
  assert.equal(x.ok,true);
  assert.equal(x.code,'CRM_RECON_ALL_OK');
});

test('production analytics route remains session-protected v6 and covers all private v5 datasets',()=>{
  const vercel=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
  const route=(vercel.rewrites||[]).find(x=>x.source==='/api/kk-rental-dashboard');
  assert.equal(route.destination,'/api/kk-rental-dashboard-session-proxy');
  const sessionProxy=fs.readFileSync(path.join(__dirname,'..','api','kk-rental-dashboard-session-proxy.js'),'utf8');
  assert.match(sessionProxy,/require\('\.\/kk-rental-dashboard-v6\.js'\)/);
  const source=fs.readFileSync(path.join(__dirname,'..','api','kk-rental-dashboard-v6.js'),'utf8');
  assert.match(source,/rental_dashboard_data/);
  assert.match(source,/event_archive/);
  assert.match(source,/13_Event_Archive/);
  assert.match(source,/crmReconciliation\.combine/);
  assert.match(source,/coreFallback/);
  const health=fs.readFileSync(path.join(__dirname,'..','api','kk-intelligence-health.js'),'utf8');
  assert.match(health,/reconciliation_datasets/);
  assert.match(health,/READY_PRIVATE_READ_RECONCILED/);
  assert.match(health,/private_analytics_eligible:eligible/);
});
