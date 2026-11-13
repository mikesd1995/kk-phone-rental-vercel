'use strict';

// OWNER-ONLY / READ-ONLY acceptance: never fetch public GViz or write to Google.
// Default mode checks configuration WITHOUT ANY NETWORK. Add --probe only when
// an owner-approved private transport and independent read-only key are configured.
// Output is aggregate status only; NEVER emit rows, contacts, OAuth tokens, keys or IDs.
const PrivateCore=require('../server/core-sheet-private-reader.js');
const {RANGE_SPECS,schemaResult}=require('../server/core-private-range-contract.js');

// Preserve the old metadata export without maintaining a second range list.
const EXTRA_SPECS=Object.freeze(Object.fromEntries(RANGE_SPECS
  .filter(spec=>['rental_dashboard_data','event_archive'].includes(spec.dataset))
  .map(spec=>[spec.dataset,spec])));
const SAFE_PRIVATE_FAILURE_CODES=new Set([
  'CORE_PRIVATE_CUTOVER_NOT_ENABLED',
  'CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED',
  'CORE_PRIVATE_SHEET_ID_NOT_CONFIGURED',
  'CORE_PRIVATE_SHEET_ID_MISMATCH',
  'CORE_PRIVATE_CREDENTIALS_NOT_CONFIGURED',
  'CORE_PRIVATE_RANGE_INVALID',
  'CORE_PRIVATE_SCHEMA_INVALID',
  // Allow fixed non-sensitive Apps Script statuses, never provider error bodies.
  'CORE_APPS_SCRIPT_NOT_CONFIGURED',
  'CORE_APPS_SCRIPT_ID_MISMATCH',
  'CORE_APPS_SCRIPT_FETCH_UNAVAILABLE',
  'CORE_APPS_SCRIPT_BAD_REDIRECT',
  'CORE_APPS_SCRIPT_HTTP_FAILURE',
  'CORE_APPS_SCRIPT_RESPONSE_INVALID',
  'CORE_APPS_SCRIPT_TIMEOUT',
  'CORE_APPS_SCRIPT_UNAVAILABLE',
  'CRM_SHEET_ID_CONFLICT',
  'CRM_SHEET_ID_MISSING',
  'CRM_READER_NOT_CONFIGURED',
  'CRM_TOKEN_EXCHANGE_FAILED',
  'CRM_PRIVATE_READ_FAILED'
]);
function classify(err){
  // Error.code can be populated by an upstream provider. Never echo arbitrary
  // prefixed text (including credentials/customer values) into public reports.
  const code=String(err&&err.code||'');
  return SAFE_PRIVATE_FAILURE_CODES.has(code)?code:'CORE_PRIVATE_PROBE_FAILED';
}
function hasHeader(values,required){
  if(!required)return Array.isArray(values)&&values.length>0;
  // A1/A4 range begins at the required header; data-row values cannot stand in
  // for a missing header. Fail closed before any owner ACL cutover approval.
  return Array.isArray(values)&&values.length>0&&Array.isArray(values[0])&&
    values[0].some(v=>String(v||'').trim()===required);
}
function plan(env=process.env){
  const source=PrivateCore.state(env);
  return {
    mode:'CONFIG_ONLY',ok:source.strict&&source.explicitSheetId&&source.transportReady,
    strict_enabled:source.strict,explicit_core_id:source.explicitSheetId,
    credentials_ready:source.credentialsReady,
    transport:source.transport,transport_ready:source.transportReady,
    expected_ranges:RANGE_SPECS.length,schema_checks_complete:false,
    consumer_acceptance:'PENDING',cutover_ready:false,
    data_writes:0,permission_writes:0,public_gviz_reads:0
  };
}
async function probe({env=process.env,reader=PrivateCore.readValues}={}){
  const preflight=plan(env);
  if(!preflight.ok) return {...preflight,mode:'PRIVATE_PROBE',status:'NOT_READY',datasets_checked:0,results:[]};
  const results=[];
  for(const spec of RANGE_SPECS){
    try{
      // This is an authenticated read using a pre-existing read-only identity.
      // Never add a public fallback; never print any returned cell values.
      const values=await reader({sheetId:env.GOOGLE_SHEET_ID,sheet:spec.sheet,range:spec.range,env});
      results.push({dataset:spec.dataset,...schemaResult(values,spec)});
    }catch(err){
      results.push({dataset:spec.dataset,ok:false,classification:classify(err)});
    }
  }
  const pass=results.filter(x=>x.ok).length;
  return {
    mode:'PRIVATE_PROBE',ok:pass===results.length,
    status:pass===results.length?'PRIVATE_RANGE_SCHEMAS_PASS':'PRIVATE_READS_BLOCKED',
    datasets_checked:results.length,passed:pass,failed:results.length-pass,results,
    expected_ranges:RANGE_SPECS.length,schema_checks_complete:pass===RANGE_SPECS.length,
    consumer_acceptance:'PENDING',cutover_ready:false,
    data_writes:0,permission_writes:0,public_gviz_reads:0
  };
}
async function main(argv=process.argv,env=process.env){
  const isProbe=argv.includes('--probe');
  const result=isProbe?await probe({env}):plan(env);
  // The caller controls the secure output channel; no secrets, PII or raw row values.
  process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.ok)process.exitCode=2;
  return result;
}
if(require.main===module)main().catch(()=>{
  process.stderr.write('CORE_PRIVATE_PREFLIGHT_UNEXPECTED_ERROR\n');
  process.exitCode=2;
});
module.exports={RANGE_SPECS,EXTRA_SPECS,classify,hasHeader,plan,probe,main};
