'use strict';

// Advisory has no writer/tool interface. Provider text never enters the control plane.
const C = require('../contracts');
const { VERSION: ANALYZER_VERSION } = require('./reconcile');
const VERSION = 'kk-ops-advisory-v1';
const ACTIONS = Object.freeze(['INSPECT_SOURCE', 'RECONCILE_IDENTITY', 'REQUEST_OWNER_REVIEW']);
const STATUS = ['UNKNOWN', 'NO_OBSERVATIONS', 'ATTENTION_REQUIRED', 'CONSISTENT_OBSERVATION'];
const SURFACES = ['snapshot', 'policy', 'canonical', 'monthly', 'lineage', 'core', 'web_ready'];
const CODES = new Set([
  'TIMESTAMP_INVALID','FUTURE_EVIDENCE','STALE_EVIDENCE','POLICY_MISSING_AMBIGUOUS_OR_DRIFT',
  'SOURCE_UNAVAILABLE','SOURCE_PARTIAL','CORE_ID_INVALID','CORE_IDENTITY_COLLISION','WEB_IDENTITY_COLLISION',
  'WEB_COUNTERPART_MISSING','EVENT_DATE_INVALID','CORE_WEB_IDENTITY_MISMATCH','WEB_VISIBILITY_UNKNOWN_OR_HIDDEN',
  'WEB_ORPHAN','LINEAGE_INTEGRITY_INVALID','MONTHLY_IDENTITY_UNRESOLVED','EVENT_DATE_UNRESOLVED','PAST_EVENT',
  'STABLE_SHOW_ID_REQUIRED','CANONICAL_NOT_ACTIONABLE','VERIFIER_CONFIRMED_REQUIRED','IN_AREA_REQUIRED','RENTABLE_REQUIRED',
  'IDENTITY_CONFLICT_UNRESOLVED','DATE_CONFLICT_UNRESOLVED','LIFECYCLE_CONFLICT_UNRESOLVED','CANONICAL_IDENTITY_COLLISION',
  'MONTHLY_EXACT1_REQUIRED','MONTHLY_DISPOSITION_CONFLICT','PROMOTION_NOT_REQUIRED_YET','CAPACITY_BLOCKED','CAPACITY_UNKNOWN',
  'EVIDENCE_COVERAGE_UNKNOWN','MAPPED_CORE_IDENTITY_CONFLICT','PROMOTION_INPUT_INVALID','VERIFIER_CONFIRMATION_REQUIRED',
  'CANONICAL_STATUS_NOT_PROMOTABLE','LINEAGE_AMBIGUOUS_OR_INVALID','CORE_EVENT_ID_AMBIGUOUS','LINEAGE_POINTS_TO_MISSING_CORE',
  'DIRECT_WRITER_UPDATE_EVENT_NOT_ACCEPTED','EXISTING_CORE_IDENTITY_MATCH_WITHOUT_EXPLICIT_LINEAGE',
  'MULTIPLE_CORE_IDENTITY_MATCHES','NO_EXPLICIT_LINEAGE_AND_NO_SAFE_EXISTING_CORE_MATCH'
]);
const LABELS = Object.freeze({INSPECT_SOURCE:'ตรวจหลักฐานต้นทางและความครบถ้วนของข้อมูล',RECONCILE_IDENTITY:'ตรวจเทียบรหัสและความสัมพันธ์ของรายการ',REQUEST_OWNER_REVIEW:'เตรียมหลักฐานให้เจ้าของระบบพิจารณา'});
function closed(value, keys) {
  C.requireThat(value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k)), 'ADVICE_SCHEMA_INVALID');
}
function minimizeReport(report) {
  C.assertSafeData(report);
  C.requireThat(report.version === ANALYZER_VERSION && STATUS.includes(report.status) && report.execution_authorized === false && report.full_system_verified === false && report.production_writes === 0, 'REPORT_NOT_OBSERVATION');
  C.requireThat(Array.isArray(report.findings) && Array.isArray(report.event_results), 'REPORT_SCHEMA_INVALID');
  const grouped = new Map();
  const add = (code,surface) => {
    C.requireThat(CODES.has(code) && SURFACES.includes(surface),'REPORT_CODE_UNSUPPORTED');
    const key = surface + ':' + code;
    const current = grouped.get(key) || {code,surface,count:0}; current.count++; grouped.set(key,current);
  };
  for (const f of report.findings) add(f.code,f.surface);
  for (const e of report.event_results) {
    C.requireThat(e.ready_for_execution === false && Array.isArray(e.reasons),'REPORT_NOT_OBSERVATION');
    for (const reason of e.reasons) add(reason,'canonical');
  }
  C.requireThat(grouped.size <= 64,'ADVISORY_INPUT_LIMIT');
  const issues = [...grouped.values()].map((v,i)=>({ref:'issue-'+String(i+1).padStart(3,'0'),...v}));
  // No name, family/show/event ID, source URL, timestamp or external prose crosses this boundary.
  const input = {version:VERSION,report_hash:C.changeHash(report),status:report.status,issues};
  return {...input,input_hash:C.changeHash(input)};
}
function outputSchema(input) {
  return {type:'object',additionalProperties:false,properties:{input_hash:{type:'string',enum:[input.input_hash]},ranked_findings:{type:'array',maxItems:64,items:{type:'object',additionalProperties:false,properties:{ref:{type:'string',enum:input.issues.length ? input.issues.map(x=>x.ref) : ['NO_FINDINGS']},action:{type:'string',enum:ACTIONS}},required:['ref','action']}}},required:['input_hash','ranked_findings']};
}
function validateAdvice(value,input) {
  C.assertSafeData(value); closed(value,['input_hash','ranked_findings']);
  C.requireThat(value.input_hash === input.input_hash,'ADVICE_INPUT_MISMATCH');
  C.requireThat(Array.isArray(value.ranked_findings) && value.ranked_findings.length === input.issues.length,'ADVICE_COVERAGE_INVALID');
  const seen = new Set();
  for (const row of value.ranked_findings) {
    closed(row,['ref','action']);
    C.requireThat(input.issues.some(x=>x.ref===row.ref) && !seen.has(row.ref) && ACTIONS.includes(row.action),'ADVICE_REFERENCE_INVALID'); seen.add(row.ref);
  }
  return {input_hash:input.input_hash,ranked_findings:value.ranked_findings.map(row=>({...row,label_th:LABELS[row.action]})),execution_authorized:false,full_system_verified:false,production_writes:0};
}
module.exports={VERSION,ACTIONS,minimizeReport,outputSchema,validateAdvice};
