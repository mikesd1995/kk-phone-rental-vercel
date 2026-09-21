'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Tool=require('../scripts/accept-private-reader');
const Freshness=require('../api/lib/crm-freshness');
const Reconciliation=require('../api/lib/crm-reconciliation');

const CORE=Tool.DEFAULT_CORE_SHEET_ID;
const CRM=Tool.DEFAULT_CRM_SHEET_ID;
const COVERAGE=Tool.DATASETS.map(x=>x.name).join(';');

function manifest({core=CORE,crm=CRM,last='2026-09-21T09:00:00+07:00',coverage=COVERAGE,state='SYNCED'}={}){
  return [
    ['key','value','status','note'],
    ['architecture_version','dual-sheet-foundation-v1','ACTIVE_READ_MODEL',''],
    ['core_sheet_id',core,'SOT',''],
    ['secondary_sheet_id',crm,'PRIVATE',''],
    ['sync_coverage',coverage,'RUNTIME_PROVEN_FULL',''],
    ['last_synced_at',last,state,''],
    ['sync_state',state,state,'']
  ];
}

function envConfigured(){
  return {
    KK_CRM_SHEET_ID:CRM,
    GOOGLE_SHEET_ID:CORE,
    KK_CRM_MAX_STALENESS_MINUTES:'75',
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----'
  };
}

function configuredPrivateReader({manifestValues=manifest(),datasetValue=[['h1','h2'],['1','sensitive@example.com']],error=null,counter=null}={}){
  return {
    configState(){return {configured:true,authMode:'service_account'};},
    async readValues({range}){
      if(counter) counter.push(range);
      if(error) throw error;
      if(range.startsWith('00_Data_Source_Manifest!')) return manifestValues;
      return datasetValue;
    }
  };
}

function reconciler({datasetValue=[['h1','h2'],['1','sensitive@example.com']],mismatchDataset=''}={}){
  return {
    compare:Reconciliation.compare,
    combine:Reconciliation.combine,
    async fetchPublicValues({sheet}){
      if(sheet===mismatchDataset) return [['h1','h2'],['DIFFERENT','value']];
      return datasetValue;
    }
  };
}

test('dataset contract is exactly the manifest 8-dataset read model',()=>{
  assert.equal(Tool.DATASETS.length,8);
  assert.deepEqual(
    Tool.DATASETS.map(x=>x.name).sort(),
    [
      '00_Rental_Dashboard',
      '11_Customer_Stats',
      '12_Booking_Archive',
      '13_Event_Archive',
      '14_Event_Override_Archive',
      '15_Admin_Audit_Log',
      '16_Admin_Error_Log',
      '_Rental_Dashboard_Data'
    ].sort()
  );
});

test('missing credentials fail before any network read',async()=>{
  let reads=0;
  const evidence=await Tool.runAcceptance({
    env:{KK_CRM_SHEET_ID:CRM,GOOGLE_SHEET_ID:CORE},
    privateSheetsImpl:{
      configState(){return {configured:false,authMode:'none'};},
      async readValues(){reads++; throw new Error('must not read');}
    },
    freshnessImpl:Freshness,
    reconciliationImpl:Reconciliation
  });
  assert.equal(evidence.result,'BLOCKED_READER_NOT_CONFIGURED');
  assert.equal(evidence.network_reads,0);
  assert.equal(evidence.writes,0);
  assert.equal(reads,0);
});

test('stale manifest blocks before 8-dataset reads',async()=>{
  const reads=[];
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader({
      manifestValues:manifest({last:'2026-09-15T14:15:14+07:00'}),
      counter:reads
    }),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler(),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  assert.equal(evidence.result,'BLOCKED_SYNC_NOT_FRESH');
  assert.equal(evidence.manifest.fresh,false);
  assert.equal(evidence.manifest.sync_status,'CRM_SYNC_STALE');
  assert.equal(reads.length,1);
  assert.equal(evidence.network_reads,1);
  assert.equal(evidence.writes,0);
});

test('manifest sheet identity mismatch fails closed before dataset reads',async()=>{
  const reads=[];
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader({
      manifestValues:manifest({crm:'wrong-sheet'}),
      counter:reads
    }),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler(),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  assert.equal(evidence.result,'BLOCKED_MANIFEST_ID_MISMATCH');
  assert.equal(reads.length,1);
  assert.equal(evidence.writes,0);
});

test('manifest coverage must contain exactly all 8 datasets',async()=>{
  const reads=[];
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader({
      manifestValues:manifest({coverage:'00_Rental_Dashboard;_Rental_Dashboard_Data'}),
      counter:reads
    }),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler(),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  assert.equal(evidence.result,'BLOCKED_SYNC_COVERAGE_MISMATCH');
  assert.equal(evidence.manifest.coverage_match,false);
  assert.equal(reads.length,1);
});

test('fresh private reader plus exact 8-of-8 reconciliation passes without exposing row values',async()=>{
  const raw=[['h1','h2'],['1','sensitive@example.com']];
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader({datasetValue:raw}),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler({datasetValue:raw}),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  assert.equal(evidence.result,'PASS_PRIVATE_READER_RECONCILED');
  assert.equal(evidence.reconciliation.ok,true);
  assert.equal(evidence.reconciliation.dataset_count,8);
  assert.equal(evidence.network_reads,17);
  assert.equal(evidence.writes,0);
  assert.equal(JSON.stringify(evidence).includes('sensitive@example.com'),false);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE KEY'),false);
});

test('one dataset mismatch blocks acceptance and identifies only safe dataset diagnostics',async()=>{
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader(),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler({mismatchDataset:'13_Event_Archive'}),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  assert.equal(evidence.result,'BLOCKED_RECONCILIATION');
  assert.equal(evidence.reconciliation.ok,false);
  assert.equal(evidence.reconciliation.failed_dataset,'13_Event_Archive');
  assert.equal(evidence.reconciliation.datasets['13_Event_Archive'].ok,false);
  assert.equal(evidence.writes,0);
});

test('private reader errors expose code only, not exception message or credentials',async()=>{
  const err=Object.assign(new Error('secret-token-should-never-appear'),{code:'CRM_PRIVATE_READ_FAILED'});
  const evidence=await Tool.runAcceptance({
    env:envConfigured(),
    privateSheetsImpl:configuredPrivateReader({error:err}),
    freshnessImpl:Freshness,
    reconciliationImpl:reconciler(),
    nowMs:Date.parse('2026-09-21T09:15:00+07:00')
  });
  const serialized=JSON.stringify(evidence);
  assert.equal(evidence.result,'BLOCKED_PRIVATE_READ_ERROR');
  assert.equal(evidence.error_code,'CRM_PRIVATE_READ_FAILED');
  assert.equal(serialized.includes('secret-token-should-never-appear'),false);
  assert.equal(serialized.includes('reader@example.iam.gserviceaccount.com'),false);
  assert.equal(serialized.includes('PRIVATE KEY'),false);
  assert.equal(evidence.writes,0);
});

test('exit codes distinguish pass, missing credential and gated failures',()=>{
  assert.equal(Tool.exitCodeFor('PASS_PRIVATE_READER_RECONCILED'),0);
  assert.equal(Tool.exitCodeFor('BLOCKED_READER_NOT_CONFIGURED'),78);
  assert.equal(Tool.exitCodeFor('BLOCKED_SYNC_NOT_FRESH'),2);
  assert.equal(Tool.exitCodeFor('BLOCKED_RECONCILIATION'),5);
});
