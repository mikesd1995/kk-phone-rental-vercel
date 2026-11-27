#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

function result(id,pass,detail){
  return {id,pass:!!pass,detail:String(detail||'')};
}

function audit(){
  const admin=read('admin/admin.js');
  const storefront=read('script.js');
  const api=read('api/kk-data.js');
  const vercel=JSON.parse(read('vercel.json'));
  const visibility=read('server/event-visibility-owner-guard.js');
  const adminGuard=read('api/kk-admin-guard.js');
  const verifier=read('server/kk-verifier-storefront-promotion.js');
  const apps=read('apps-script/Code.gs');
  const workflow=read('.github/workflows/admin-regression.yml');
  const snapshotHealth=read('admin/snapshot-health.js');
  const directPhase1=read('server/admin-direct-writer-phase1.js');
  const revenueCore=read('server/rental-dashboard-core.js');

  const route=(vercel.headers||[]).find(x=>x&&x.source==='/api/kk-data');
  const cache=route && (route.headers||[]).find(x=>String(x&&x.key||'').toLowerCase()==='cache-control');
  const allowedStart=api.indexOf('const ALLOWED = {');
  const allowedEnd=api.indexOf('\n};',allowedStart);
  const allowlist=allowedStart>=0&&allowedEnd>allowedStart ? api.slice(allowedStart,allowedEnd+3) : '';

  const checks=[
    result(
      'ADMIN_MUTATION_FRESH_READBACK',
      /async function refresh\(\{waitForActive=false\}=\{\}\)/.test(admin) &&
      /await api\("updateBooking", payload\)[\s\S]{0,700}await refresh\(\{waitForActive:true\}\)/.test(admin),
      'Booking mutation must force a fresh authoritative snapshot after any active refresh.'
    ),
    result(
      'CANONICAL_POSTER_SOT_PRECEDENCE',
      /var rawPoster\s*=\s*String\(r\.poster_image_url\|\|""\)\.trim\(\)\s*\|\|\s*storefrontPosterOverride\(r\);/.test(storefront) &&
      !/var rawPoster\s*=\s*storefrontPosterOverride\(r\)\s*\|\|/.test(storefront),
      'Canonical poster_image_url must outrank emergency storefront fallbacks.'
    ),
    result(
      'PUBLIC_DATA_NO_STORE_HANDLER',
      /res\.setHeader\('Cache-Control', 'no-store, max-age=0, must-revalidate'\)/.test(api),
      'Live inventory and pricing responses must be no-store in the handler.'
    ),
    result(
      'PUBLIC_DATA_NO_STORE_EDGE',
      !!cache && /no-store/i.test(String(cache.value||'')) &&
      !/s-maxage|stale-while-revalidate/i.test(String(cache.value||'')),
      'Vercel edge policy must not cache /api/kk-data.'
    ),
    result(
      'PUBLIC_FEED_ALLOWLIST_ONLY',
      /'08_Web_Ready'/.test(allowlist) &&
      /'09_Web_Packages'/.test(allowlist) &&
      !/'03_Packages'|'04_Event_Overrides'|'00_Master_Booking'/.test(allowlist),
      'Unauthenticated public feed must expose derived customer-facing tables only.'
    ),
    result(
      'PUBLIC_INTERNAL_TEXT_REDACTION',
      /function looksInternalPublicText/.test(api) &&
      /sanitizePublicCsv\(sheet, text\)/.test(api) &&
      /X-KK-Public-Fields-Redacted/.test(api),
      'Operational annotations must be stripped before customer-facing CSV leaves the API.'
    ),
    result(
      'OWNER_HIDDEN_TOMBSTONE_END_TO_END',
      /EVENT_VISIBILITY_TOMBSTONE_LOCKED/.test(visibility) &&
      /evaluateCreateAgainstHistory\(snapshot,payload\)/.test(adminGuard) &&
      /OWNER_HIDDEN_RECREATE_PROHIBITED/.test(verifier) &&
      /EVENT_VISIBILITY_TOMBSTONE_LOCKED/.test(apps),
      'Persistent owner-hidden history must block silent recreation across guard, verifier and Apps Script.'
    ),
    result(
      'PRIVATE_READER_CANONICAL_SHEET_ID',
      /privateEnvSheetId/.test(api) &&
      /sheet-id-config-conflict/.test(api) &&
      /envSheetId && privateEnvSheetId && envSheetId!==privateEnvSheetId/.test(api),
      'Public/private reader Sheet IDs must resolve to one canonical workbook or fail closed.'
    ),
    result(
      'PRIVATE_READER_FAIL_CLOSED',
      /KK_PUBLIC_SHEET_REQUIRE_PRIVATE/.test(api) &&
      /private-not-configured/.test(api) &&
      /private-read-failed/.test(api) &&
      /if \(requirePrivate\)/.test(api),
      'Strict private-reader mode must return unavailable instead of silently falling back public.'
    ),
    result(
      'CANONICAL_IDENTITY_AND_PROJECTION_EVIDENCE',
      /missing event_id/.test(snapshotHealth) &&
      /duplicate booking_id/.test(snapshotHealth) &&
      /not present in bookings/.test(snapshotHealth) &&
      /orphan_package_count/.test(snapshotHealth) &&
      /orphan_web_ready_count/.test(snapshotHealth) &&
      /negative_availability_count/.test(snapshotHealth),
      'Repair admission requires canonical identity, booking projection, referential and availability evidence.'
    ),
    result(
      'GENERATED_PRICE_FORMULA_PRESERVED',
      /function webPackagePriceFormula/.test(directPhase1) &&
      /04_Event_Overrides/.test(directPhase1) &&
      /09_Web_Packages/.test(directPhase1) &&
      /FORMULA/.test(directPhase1) &&
      /stale hard-coded value/.test(directPhase1),
      'Generated web price H must remain a canonical formula and be read back as FORMULA after override writes.'
    ),
    result(
      'REVENUE_POLICY_FAIL_CLOSED',
      /new Set\(\["pending","confirmed","prepared","picked_up","returned","uploaded"\]\)/.test(revenueCore) &&
      /new Set\(\["completed",\.\.\.activeSet\]\)/.test(revenueCore) &&
      /cancelled, no_show, blank/.test(revenueCore),
      'Revenue must include completed as Actual, active workflow states as Future, and exclude cancelled/no_show/blank/unknown.'
    ),
    result(
      'CI_CONTINUOUS_GATE_WIRED',
      /Continuous invariant gate/.test(workflow) &&
      /npm run audit:invariants/.test(workflow),
      'Invariant audit must execute on every PR and main push.'
    )
  ];

  const failed=checks.filter(x=>!x.pass);
  return {
    schema:'kk-continuous-invariant-gate/v1',
    status:failed.length?'BLOCKED':'PASS',
    checks,
    failed_checks:failed.map(x=>x.id),
    production_writes:0,
    business_data_mutations:0
  };
}

if(require.main===module){
  try{
    const report=audit();
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    process.exitCode=report.status==='PASS'?0:2;
  }catch(error){
    process.stderr.write(String(error&&error.stack||error)+'\n');
    process.exitCode=1;
  }
}

module.exports={audit};
