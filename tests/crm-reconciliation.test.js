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

test('production analytics route remains v6 with reconciliation guard',()=>{
  const vercel=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
  const route=(vercel.rewrites||[]).find(x=>x.source==='/api/kk-rental-dashboard');
  assert.equal(route.destination,'/api/kk-rental-dashboard-v6');
  const source=fs.readFileSync(path.join(__dirname,'..','api','kk-rental-dashboard-v6.js'),'utf8');
  assert.match(source,/crmReconciliation\.compare/);
  assert.match(source,/coreFallback/);
  const health=fs.readFileSync(path.join(__dirname,'..','api','kk-intelligence-health.js'),'utf8');
  assert.match(health,/READY_PRIVATE_READ_RECONCILED/);
  assert.match(health,/private_analytics_eligible:eligible/);
});
