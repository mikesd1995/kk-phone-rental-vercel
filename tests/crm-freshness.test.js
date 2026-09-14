'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const freshness=require('../api/lib/crm-freshness');

function manifest(lastSyncedAt,syncState='OK'){
  return [
    ['key','value','status','note'],
    ['architecture_version','dual-sheet-foundation-v1','ACTIVE_SHADOW',''],
    ['core_sheet_id','core','SOT',''],
    ['secondary_sheet_id','crm','PRIVATE',''],
    ['last_synced_at',lastSyncedAt,syncState,'']
  ];
}

test('fresh CRM snapshot is eligible inside the configured freshness window',()=>{
  const now=Date.parse('2026-09-15T00:00:00+07:00');
  const x=freshness.assessManifest(manifest('2026-09-14T23:45:00+07:00'),{nowMs:now,maxAgeMin:30});
  assert.equal(x.fresh,true);
  assert.equal(x.code,'CRM_SYNC_FRESH');
  assert.equal(x.age_minutes,15);
});

test('stale CRM snapshot is rejected before private analytics cutover',()=>{
  const now=Date.parse('2026-09-15T00:00:00+07:00');
  const x=freshness.assessManifest(manifest('2026-09-14T22:00:00+07:00'),{nowMs:now,maxAgeMin:30});
  assert.equal(x.fresh,false);
  assert.equal(x.code,'CRM_SYNC_STALE');
  assert.equal(x.age_minutes,120);
});

test('missing or invalid sync timestamps remain fail-safe',()=>{
  const missing=freshness.assessManifest(manifest(''),{nowMs:0,maxAgeMin:30});
  const invalid=freshness.assessManifest(manifest('not-a-date'),{nowMs:0,maxAgeMin:30});
  assert.equal(missing.code,'CRM_SYNC_TIMESTAMP_MISSING');
  assert.equal(invalid.code,'CRM_SYNC_TIMESTAMP_INVALID');
  assert.equal(missing.fresh,false);
  assert.equal(invalid.fresh,false);
});

test('explicit non-ready sync state blocks an otherwise recent snapshot',()=>{
  const now=Date.parse('2026-09-15T00:00:00+07:00');
  const x=freshness.assessManifest(manifest('2026-09-14T23:55:00+07:00','RUNNING'),{nowMs:now,maxAgeMin:30});
  assert.equal(x.fresh,false);
  assert.equal(x.code,'CRM_SYNC_STATE_NOT_READY');
});

test('max staleness configuration is bounded',()=>{
  assert.equal(freshness.maxAgeMinutes({KK_CRM_MAX_STALENESS_MINUTES:'2'}),5);
  assert.equal(freshness.maxAgeMinutes({KK_CRM_MAX_STALENESS_MINUTES:'45'}),45);
  assert.equal(freshness.maxAgeMinutes({KK_CRM_MAX_STALENESS_MINUTES:'9999'}),1440);
  assert.equal(freshness.maxAgeMinutes({KK_CRM_MAX_STALENESS_MINUTES:'x'}),30);
});

test('production analytics route is freshness-gated through v6',()=>{
  const vercel=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8'));
  const route=(vercel.rewrites||[]).find(x=>x.source==='/api/kk-rental-dashboard');
  assert.equal(route.destination,'/api/kk-rental-dashboard-v6');
  const source=fs.readFileSync(path.join(__dirname,'..','api','kk-rental-dashboard-v6.js'),'utf8');
  assert.match(source,/CRM_SYNC_STALE|crmFreshness/);
  assert.match(source,/core_fallback/);
  assert.match(source,/KK_CRM_REQUIRE_PRIVATE/);
});
