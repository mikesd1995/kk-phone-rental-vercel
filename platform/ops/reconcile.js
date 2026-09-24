'use strict';

// Offline observations only. No tool, provider, writer, scheduler or policy mutation.
const C = require('../contracts');
const Bridge = require('../../server/event-lineage-bridge');
const Promotion = require('../../server/tracker-core-promotion-gate');
const SURFACES = ['canonical', 'monthly', 'lineage', 'core', 'web_ready'];
const VERSION = 'kk-ops-reconcile-v1';
const check = C.requireThat;
function closed(value, keys, code = 'SNAPSHOT_SCHEMA_INVALID') {
  check(value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(k => keys.includes(k)), code);
}
function date(value) { check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'EVENT_DATE_INVALID'); return Bridge.normalizeEventDate(value); }
function normalized(value) { return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ') : ''; }
function analyzeSnapshot(snapshot, { now, expectedPolicyVersion, maxAgeMs = 3600000 } = {}) {
  C.utc(now); check(['v4.9.35', 'v4.9.36'].includes(expectedPolicyVersion), 'POLICY_ADAPTER_UNSUPPORTED');
  check(Number.isSafeInteger(maxAgeMs) && maxAgeMs > 0 && maxAgeMs <= 3600000, 'FRESHNESS_LIMIT_INVALID');
  C.assertSafeData(snapshot);
  closed(snapshot, ['schema_version', 'observed_at', 'policy', 'scope', 'surfaces']);
  check(snapshot.schema_version === 'kk-ops-snapshot-v1', 'SNAPSHOT_VERSION_UNSUPPORTED');
  closed(snapshot.policy, ['version', 'active_versions', 'observed_at', 'source_ref']);
  closed(snapshot.scope, ['kind', 'family_id']);
  check(snapshot.scope.kind === 'SELECTED_EVENT_FAMILY' && typeof snapshot.scope.family_id === 'string' && snapshot.scope.family_id.startsWith('FAM|'), 'SCOPE_INVALID');
  closed(snapshot.surfaces, SURFACES);
  const findings = []; const eventResults = []; const parity = []; const coverage = {};
  const add = (code, surface, identity = null) => findings.push({ code, surface, identity });
  const fresh = (time, surface) => {
    try { C.utc(time); } catch { add('TIMESTAMP_INVALID', surface); return false; }
    const age = Date.parse(now) - Date.parse(time);
    if (age < 0) { add('FUTURE_EVIDENCE', surface); return false; }
    if (age > maxAgeMs) { add('STALE_EVIDENCE', surface); return false; }
    return true;
  };
  let complete = fresh(snapshot.observed_at, 'snapshot');
  C.text(snapshot.policy.source_ref);
  complete = fresh(snapshot.policy.observed_at, 'policy') && complete;
  const policyValid = snapshot.policy.version === expectedPolicyVersion && Array.isArray(snapshot.policy.active_versions) && snapshot.policy.active_versions.length === 1 && snapshot.policy.active_versions[0] === expectedPolicyVersion;
  if (!policyValid) { add('POLICY_MISSING_AMBIGUOUS_OR_DRIFT', 'policy'); complete = false; }
  const rows = {};
  const keys = {
    canonical: ['event_family_id','tracker_show_id','event_date','event_name','canonical_status','verifier_confirmed','in_area','rentable','identity_conflict','date_conflict','lifecycle_conflict','score','top_pick','owner_promote','remaining_phone_capacity'],
    monthly: ['event_family_id','tracker_show_id','event_date','event_name','status'],
    lineage: ['mapping_version','event_family_id','tracker_show_id','show_instance_id','event_date','core_event_id','ticket_lifecycle','rental_lifecycle','mapping_status','lineage_key'],
    core: ['event_id','event_name','event_date','status'],
    web_ready: ['event_id','event_name','event_date','visibility']
  };
  for (const name of SURFACES) {
    const s = snapshot.surfaces[name];
    if (!s) { rows[name] = []; coverage[name] = 'UNAVAILABLE'; add('SOURCE_UNAVAILABLE', name); complete = false; continue; }
    closed(s, ['status','observed_at','source_ref','rows']); C.text(s.source_ref);
    check(['COMPLETE','PARTIAL','UNAVAILABLE'].includes(s.status) && Array.isArray(s.rows) && s.rows.length <= 128, 'SURFACE_SCHEMA_INVALID');
    if (s.status === 'UNAVAILABLE') check(s.rows.length === 0, 'UNAVAILABLE_WITH_ROWS');
    s.rows.forEach(r => closed(r, keys[name]));
    rows[name] = s.rows; coverage[name] = s.status;
    if (!fresh(s.observed_at, name)) { coverage[name] = 'STALE_OR_INVALID'; complete = false; }
    if (s.status !== 'COMPLETE') { add('SOURCE_' + s.status, name); complete = false; }
  }
  const family = snapshot.scope.family_id;
  for (const name of ['canonical','lineage']) for (const row of rows[name]) {
    check(row.event_family_id === family, 'ROW_SCOPE_MISMATCH');
  }
  // A declared COMPLETE scope is an attestation by the collector, not independent proof.
  // Compare public identity without deriving stock, booking availability or publication acceptance.
  for (const core of rows.core) {
    const id = core.event_id;
    if (typeof id !== 'string' || !id.startsWith('EVT-')) { add('CORE_ID_INVALID','core'); continue; }
    if (rows.core.filter(r => r.event_id === id).length !== 1) { add('CORE_IDENTITY_COLLISION','core',id); continue; }
    if (rows.core.filter(r => normalized(r.event_name) === normalized(core.event_name) && r.event_date === core.event_date).length !== 1) { add('CORE_IDENTITY_COLLISION','core',id); continue; }
    const matches = rows.web_ready.filter(r => r.event_id === id);
    if (matches.length !== 1) { add(matches.length ? 'WEB_IDENTITY_COLLISION' : 'WEB_COUNTERPART_MISSING','web_ready',id); continue; }
    let same = false;
    try { same = date(core.event_date) === date(matches[0].event_date) && normalized(core.event_name) !== '' && normalized(core.event_name) === normalized(matches[0].event_name); } catch { add('EVENT_DATE_INVALID','core',id); }
    if (!same) { add('CORE_WEB_IDENTITY_MISMATCH','web_ready',id); continue; }
    const visible = ['SHOW','SHOW_FULL'].includes(matches[0].visibility);
    if (!visible) add('WEB_VISIBILITY_UNKNOWN_OR_HIDDEN','web_ready',id);
    parity.push({event_id:id, identity:'MATCHED', visibility:visible ? matches[0].visibility : 'UNKNOWN'});
  }
  for (const web of rows.web_ready) if (!rows.core.some(c => c.event_id === web.event_id)) add('WEB_ORPHAN','web_ready', typeof web.event_id === 'string' ? web.event_id : null);
  const lineageValid = [];
  for (const row of rows.lineage) {
    try {
      const expected = Bridge.buildLineageRecord(row);
      if (row.mapping_status !== 'EXPLICIT' || row.mapping_version !== expected.mapping_version || row.show_instance_id !== expected.show_instance_id || row.lineage_key !== expected.lineage_key) throw new Error('invalid');
      lineageValid.push(row);
    } catch { add('LINEAGE_INTEGRITY_INVALID','lineage',typeof row.tracker_show_id === 'string' ? row.tracker_show_id : null); }
  }
  for (const m of rows.monthly) {
    if (m.event_family_id !== family || typeof m.tracker_show_id !== 'string' || !m.tracker_show_id.startsWith('SHOW')) add('MONTHLY_IDENTITY_UNRESOLVED','monthly');
  }
  const today = new Date(Date.parse(now) + 7 * 3600000).toISOString().slice(0,10);
  for (const event of rows.canonical) {
    const id = typeof event.tracker_show_id === 'string' ? event.tracker_show_id : null;
    const reasons = []; let validDate = false;
    try { validDate = date(event.event_date) >= today; } catch { reasons.push('EVENT_DATE_UNRESOLVED'); }
    if (!validDate && !reasons.length) reasons.push('PAST_EVENT');
    if (!id || !/^(SHOW|SHOWSET)\|.+/.test(id)) reasons.push('STABLE_SHOW_ID_REQUIRED');
    if (!['ACTIVE','VERIFIED'].includes(event.canonical_status)) reasons.push('CANONICAL_NOT_ACTIONABLE');
    for (const k of ['verifier_confirmed','in_area','rentable']) if (event[k] !== true) reasons.push(k.toUpperCase() + '_REQUIRED');
    for (const k of ['identity_conflict','date_conflict','lifecycle_conflict']) if (event[k] !== false) reasons.push(k.toUpperCase() + '_UNRESOLVED');
    if (rows.canonical.filter(r => r.tracker_show_id === id && r.event_date === event.event_date).length !== 1) reasons.push('CANONICAL_IDENTITY_COLLISION');
    const monthly = rows.monthly.filter(m => m.event_family_id === family && m.tracker_show_id === id && m.event_date === event.event_date);
    if (monthly.length !== 1) reasons.push('MONTHLY_EXACT1_REQUIRED');
    else if (!['ACTIVE','VERIFIED'].includes(monthly[0].status) || normalized(monthly[0].event_name) !== normalized(event.event_name)) reasons.push('MONTHLY_DISPOSITION_CONFLICT');
    if (expectedPolicyVersion === 'v4.9.36') {
      if (!(typeof event.score === 'number' && Number.isFinite(event.score) && event.score >= 75 && event.score <= 100) && event.top_pick !== true && event.owner_promote !== true) reasons.push('PROMOTION_NOT_REQUIRED_YET');
      if (event.remaining_phone_capacity === 0) reasons.push('CAPACITY_BLOCKED');
      else if (!Number.isSafeInteger(event.remaining_phone_capacity) || event.remaining_phone_capacity < 0) reasons.push('CAPACITY_UNKNOWN');
    }
    if (!complete) reasons.push('EVIDENCE_COVERAGE_UNKNOWN');
    if (findings.some(f => f.code === 'LINEAGE_INTEGRITY_INVALID' && f.identity === id)) reasons.push('LINEAGE_INTEGRITY_INVALID');
    const mapped = lineageValid.filter(r => r.tracker_show_id === id && r.event_date === event.event_date);
    for (const m of mapped) {
      const targets = rows.core.filter(r => r.event_id === m.core_event_id);
      if (targets.length === 1 && (targets[0].event_date !== event.event_date || normalized(targets[0].event_name) !== normalized(event.event_name))) reasons.push('MAPPED_CORE_IDENTITY_CONFLICT');
      if (findings.some(f => f.code === 'CORE_IDENTITY_COLLISION' && f.identity === m.core_event_id)) reasons.push('CORE_IDENTITY_COLLISION');
    }
    let decision = 'BLOCKED';
    if (!reasons.length) {
      try { const result = Promotion.evaluatePromotion({trackerEvent:event,lineageRows:lineageValid,coreEvents:rows.core,directWriterState:{ready:false}}); decision = result.decision; reasons.push(result.reason); }
      catch { reasons.push('PROMOTION_INPUT_INVALID'); }
    }
    eventResults.push({tracker_show_id:id,event_date:event.event_date || null,decision,reasons,ready_for_execution:false});
  }
  const report = {version:VERSION,observed_at:snapshot.observed_at,analyzed_at:now,policy_version:snapshot.policy.version,scope:snapshot.scope,
    status:!complete ? 'UNKNOWN' : SURFACES.every(k => rows[k].length === 0) ? 'NO_OBSERVATIONS' : findings.length || eventResults.some(r => r.decision !== 'UPDATE_EXISTING_GATED') ? 'ATTENTION_REQUIRED' : 'CONSISTENT_OBSERVATION',
    full_system_verified:false,execution_authorized:false,production_writes:0,model_calls:0,coverage,findings,event_results:eventResults,core_web_parity:parity,
    summary:{canonical_rows:rows.canonical.length,core_rows:rows.core.length,web_rows:rows.web_ready.length,identity_matches:parity.length,findings:findings.length},
    acceptance:{natural_runtime:'NOT_EVALUATED',writer:'NOT_EVALUATED',packages:'NOT_EVALUATED',production_api:'NOT_EVALUATED',booking_capacity:'NOT_INDEPENDENTLY_VERIFIED',rental_lifecycle:'NOT_EVALUATED',notifications:'NOT_EVALUATED'}};
  C.assertSafeData(report); return report;
}
module.exports = {VERSION,SURFACES,analyzeSnapshot};
