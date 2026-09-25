'use strict';

// A bounded observation adapter. The trusted host supplies read-only Google Sheets
// methods; this module has no credential, fetch, writer, or scheduling capability.
const { createHash } = require('node:crypto');
const C = require('../contracts');
const VERSION = 'kk-ops-sheets-collector-v1';
const TRACKER = '1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo';
const CORE = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const PLAN = Object.freeze(Object.fromEntries(Object.entries({
  policy: { spreadsheetId: TRACKER, sheetName: '_Policy_Registry', sheetId: 1419001010, range: 'A1:N2000', headerRow: 1, columns: 14, endRow: 2000 },
  canonical: { spreadsheetId: TRACKER, sheetName: '_Event_Lifecycle', sheetId: 1506306919, range: 'A1:AN500', headerRow: 1, columns: 40, endRow: 500 },
  lineage: { spreadsheetId: TRACKER, sheetName: '_Core_Event_Lineage_Map', sheetId: 1999002002, range: 'A1:M500', headerRow: 1, columns: 13, endRow: 500 },
  core: { spreadsheetId: CORE, sheetName: '01_Events', sheetId: 416044968, range: 'A4:I1000', headerRow: 4, columns: 9, endRow: 1000 },
  web_ready: { spreadsheetId: CORE, sheetName: '08_Web_Ready', sheetId: 1887878700, range: 'A4:K1000', headerRow: 4, columns: 11, endRow: 1000 }
}).map(([key, value]) => [key, Object.freeze(value)])));
const HEADERS = Object.freeze(Object.fromEntries(Object.entries({
  policy: ['Rule ID','Domain','Rule / Value','Applies To','Type','Owner','Policy Version','Effective At','Active','Severity','Evidence Surface','Description','Updated At','Notes'],
  canonical: ['Event Family ID','Canonical Event Name','Show ID','Show Date','Show Time','Venue ID','Venue Name','Organizer','Lifecycle State','Ticket Stage','Ticket Round ID','Ticket Sale At','Public Eligibility','Opportunity Score','Hot Until','Last Verified At','Event Fingerprint','Status','Notes','Transaction ID','Evidence Freshness','Last Reconciled At','Next Watch At','Watch Interval Hours','Watch Reason','Horizon Class','Archive Eligible At','KK Action Score','Outcome Model Version','Outcome Confidence','Service Area Eligibility','Geo Gate Status','Geo Verified At','Geo Policy Version','Manifest ID','Work Packet ID','Logistics Tier','Logistics Burden Score','Transition Rule ID','Last Transition At'],
  lineage: ['Lineage Key','Mapping Version','Event Family ID','Tracker Show ID','Show Instance ID','Event Date','Core Event ID','Ticket Lifecycle','Rental Lifecycle','Mapping Status','Evidence','Mapped At','Notes'],
  core: ['event_id','event_name','event_date','venue','poster_image_url','event_status','active_on_web','event_note','data_health'],
  web_ready: ['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web','line_message_template']
}).map(([key, value]) => [key, Object.freeze(value)])));
const check = C.requireThat;
const source = p => `sheets:${p.spreadsheetId}/${p.sheetName}!${p.range}`;
const text = value => typeof value === 'string' ? value.trim() : null;
const isRecord = value => value && Object.getPrototypeOf(value) === Object.prototype;
function digest(value) {
  let raw;
  try { raw = JSON.stringify(value); } catch { C.fail('SOURCE_SCHEMA_INVALID'); }
  check(typeof raw === 'string' && Buffer.byteLength(raw) <= 2 * 1024 * 1024, 'SOURCE_RESPONSE_TOO_LARGE');
  return createHash('sha256').update(raw).digest('hex');
}
function sheetProperties(metadata, plan) {
  check(isRecord(metadata) && metadata.spreadsheetId === plan.spreadsheetId && Array.isArray(metadata.sheets), 'SOURCE_METADATA_INVALID');
  const matches = metadata.sheets.filter(s => s && s.properties && (s.properties.sheetId === plan.sheetId || s.properties.title === plan.sheetName));
  check(matches.length === 1, 'SOURCE_SHEET_IDENTITY_MISMATCH');
  const p = matches[0].properties;
  check(p.sheetId === plan.sheetId && p.title === plan.sheetName && isRecord(p.gridProperties), 'SOURCE_SHEET_IDENTITY_MISMATCH');
  const { rowCount, columnCount } = p.gridProperties;
  check(Number.isSafeInteger(rowCount) && rowCount >= plan.endRow && Number.isSafeInteger(columnCount) && columnCount >= plan.columns, 'SOURCE_GRID_INVALID');
  return p;
}
function qualifiedRange(value, plan) {
  if (typeof value !== 'string') return false;
  const split = value.lastIndexOf('!');
  if (split < 1 || value.slice(split + 1) !== plan.range) return false;
  let name = value.slice(0, split);
  if (name.startsWith("'") && name.endsWith("'")) name = name.slice(1, -1).replace(/''/g, "'");
  return name === plan.sheetName;
}
function rangeRows(response, key) {
  const plan = PLAN[key];
  check(isRecord(response) && response.majorDimension === 'ROWS' && qualifiedRange(response.range, plan), 'SOURCE_RANGE_MISMATCH');
  check(Array.isArray(response.values) && response.values.length > 0 && response.values.length <= plan.endRow - plan.headerRow + 1, 'SOURCE_VALUES_MISSING_OR_INVALID');
  for (const row of response.values) {
    check(Array.isArray(row) && Object.keys(row).length === row.length && row.length <= plan.columns, 'SOURCE_VALUES_MISSING_OR_INVALID');
    check(row.every(v => v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && Buffer.byteLength(v) <= 32768)), 'SOURCE_VALUES_MISSING_OR_INVALID');
  }
  check(response.values[0].length === HEADERS[key].length && response.values[0].every((v, i) => v === HEADERS[key][i]) && new Set(response.values[0]).size === HEADERS[key].length, 'SOURCE_HEADER_DRIFT');
  return response.values.slice(1);
}
function policyVersion(rows) {
  const active = rows.filter(r => r[0] === 'POLICY_VERSION' && isActive(r[8]));
  check(active.length > 0 && active.every(r => typeof r[6] === 'string' && /^v\d+\.\d+\.\d+$/.test(r[6])), 'POLICY_MISSING_OR_INVALID');
  const compare = (a, b) => {
    const aa = a.slice(1).split('.').map(Number), bb = b.slice(1).split('.').map(Number);
    check([...aa, ...bb].every(Number.isSafeInteger), 'POLICY_MISSING_OR_INVALID');
    for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1;
    return 0;
  };
  const versions = active.map(r => r[6]).sort(compare);
  const highest = versions.at(-1);
  check(versions.filter(v => v === highest).length === 1, 'POLICY_AMBIGUOUS');
  return highest;
}
function isActive(value) { return value === true || (typeof value === 'string' && ['TRUE','ACTIVE'].includes(value.toUpperCase())); }
function effectiveTime(value) {
  if(typeof value!=='string')return null;
  const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if(!m||Number(m[2])>23||Number(m[3])>59||Number(m[4])>59||Number(m[6]||0)>14||Number(m[7]||0)>59||(Number(m[6])===14&&Number(m[7])!==0))return null;
  const date=Date.parse(m[1]+'T00:00:00.000Z'),time=Date.parse(value);
  if(!Number.isFinite(date)||!Number.isFinite(time)||new Date(date).toISOString().slice(0,10)!==m[1])return null;
  return time;
}
function policyObservation(rows, expected, now) {
  const primary = policyVersion(rows);
  const active = rows.filter(r => isActive(r[8]));
  const versions = [...new Set(active.map(r=>r[6]))];
  check(versions.every(v=>typeof v==='string'&&/^v\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/.test(v)), 'POLICY_MISSING_OR_INVALID');
  const parts = v => v.slice(1).split('.').map(Number);
  const newer = v => { if(!/^v\d+\.\d+(?:\.\d+)?$/.test(v))return true;const a=parts(v),b=parts(primary);for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return false; };
  const unsupported = versions.filter(newer);
  const primarySupported = ['v4.9.35','v4.9.36'].includes(primary);
  const effectiveTimes=active.map(r=>effectiveTime(r[7]));
  const unresolvedEffective=effectiveTimes.some(t=>t===null);
  const futureEffective = effectiveTimes.some(t=>t!==null&&t>Date.parse(now));
  return {primary_version:primary,active_rule_versions:versions,active_rules_sha256:digest(active),
    status: primary===expected&&primarySupported&&!unsupported.length&&!futureEffective&&!unresolvedEffective ? 'SUPPORTED_OBSERVATION' : 'BLOCKED',
    reason: primary!==expected ? 'POLICY_VERSION_DRIFT' : !primarySupported||unsupported.length ? 'POLICY_ADAPTER_UNSUPPORTED' : futureEffective||unresolvedEffective ? 'POLICY_EFFECTIVE_TIME_UNRESOLVED' : null,
    unsupported_rule_versions:unsupported,future_effective_rules:futureEffective,effective_time_unresolved:unresolvedEffective};
}
function eventDate(value) {
  const raw = text(value);
  if (raw === null) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const candidate = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return raw;
  const time = Date.parse(candidate + 'T00:00:00.000Z');
  // Ranges, locale-ambiguous dates and invalid calendar dates remain unresolved.
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === candidate ? candidate : raw;
}
function score(value) {
  if (typeof value === 'string' && /^(?:\d{1,3})(?:\.\d+)?$/.test(value)) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
function projectRows(key, rows, familyId, ids) {
  let selected;
  if (key === 'canonical') selected = rows.filter(r => r[0] === familyId).map(r => ({
    event_family_id: familyId, tracker_show_id: text(r[2]), event_date: eventDate(r[3]), event_name: text(r[1]), canonical_status: text(r[17]),
    verifier_confirmed: null, in_area: null, rentable: null, identity_conflict: null, date_conflict: null, lifecycle_conflict: null,
    score: score(r[13]), top_pick: null, owner_promote: null, remaining_phone_capacity: null
  }));
  if (key === 'lineage') selected = rows.filter(r => r[2] === familyId).map(r => ({
    mapping_version: text(r[1]), event_family_id: familyId, tracker_show_id: text(r[3]), show_instance_id: text(r[4]), event_date: eventDate(r[5]),
    core_event_id: text(r[6]), ticket_lifecycle: text(r[7]), rental_lifecycle: text(r[8]), mapping_status: text(r[9]), lineage_key: text(r[0])
  }));
  if (key === 'core') selected = rows.filter(r => ids.has(r[0])).map(r => ({ event_id: r[0], event_name: text(r[1]), event_date: eventDate(r[2]), status: text(r[5]) }));
  if (key === 'web_ready') selected = rows.filter(r => ids.has(r[0])).map(r => ({ event_id: r[0], event_name: text(r[1]), event_date: eventDate(r[2]), visibility: ['SHOW', 'SHOW_FULL'].includes(text(r[9])?.toUpperCase()) ? text(r[9]).toUpperCase() : null }));
  check(selected.length <= 128, 'SELECTED_ROW_LIMIT_EXCEEDED');
  return selected;
}

async function collectSnapshot({ reader, familyId, eventIds = [], expectedPolicyVersion, now, timeoutMs = 15000 } = {}) {
  C.utc(now);
  check(typeof expectedPolicyVersion==='string' && /^v\d+\.\d+\.\d+$/.test(expectedPolicyVersion), 'POLICY_VERSION_INVALID');
  check(typeof familyId === 'string' && /^FAM\|[^\r\n]{1,250}$/.test(familyId) && familyId.trim() === familyId, 'SCOPE_INVALID');
  check(Array.isArray(eventIds) && eventIds.length <= 128 && new Set(eventIds).size === eventIds.length && eventIds.every(id => typeof id === 'string' && /^EVT-[A-Za-z0-9_|.-]{1,250}$/.test(id)), 'EVENT_IDS_INVALID');
  check(reader && typeof reader.getMetadata === 'function' && typeof reader.getRange === 'function', 'READ_ONLY_READER_REQUIRED');
  check(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 15000, 'READ_TIMEOUT_INVALID');
  const evidence = { version: VERSION, observed_at: now, reads: [], production_writes: 0, model_calls: 0, full_system_verified: false, monthly_reason: 'STABLE_MONTHLY_IDENTITY_ADAPTER_UNAVAILABLE' };
  async function read(method, request) {
    let timer;
    let result;
    try {
      result = await Promise.race([
        Promise.resolve().then(() => reader[method](Object.freeze({ ...request }))),
        new Promise((_, reject) => { timer = setTimeout(() => { const e = new Error('SOURCE_READ_TIMEOUT'); e.collectorTimeout = true; reject(e); }, timeoutMs); })
      ]);
    } catch (error) {
      const code = error?.collectorTimeout === true ? 'SOURCE_READ_TIMEOUT' : 'SOURCE_READ_FAILED';
      evidence.reads.push({ method, ...request, status: 'UNAVAILABLE', code });
      C.fail(code);
    } finally { clearTimeout(timer); }
    // Hash only: raw source notes, URLs and private fields never enter evidence.
    const hash = digest(result);
    evidence.reads.push({ method, ...request, status: 'RECEIVED', sha256: hash });
    return result;
  }
  const trackerMetadata = await read('getMetadata', { spreadsheetId: TRACKER });
  const policyProperties = sheetProperties(trackerMetadata, PLAN.policy);
  check(policyProperties.gridProperties.rowCount === PLAN.policy.endRow, 'POLICY_COVERAGE_INCOMPLETE');
  const getRange = key => read('getRange', { spreadsheetId: PLAN[key].spreadsheetId, sheetName: PLAN[key].sheetName, range: PLAN[key].range });
  const policy = policyObservation(rangeRows(await getRange('policy'), 'policy'),expectedPolicyVersion,now);
  evidence.policy=policy;
  if(policy.status==='BLOCKED') return {status:'BLOCKED',snapshot:null,evidence};
  const activeVersion = policy.primary_version;
  const metadata = { [TRACKER]: trackerMetadata };
  try { metadata[CORE] = await read('getMetadata', { spreadsheetId: CORE }); } catch { /* Surfaces remain unavailable; policy observation survives. */ }
  const snapshot = {
    schema_version: 'kk-ops-snapshot-v1', observed_at: now,
    policy: { version: activeVersion, active_versions: [activeVersion], observed_at: now, source_ref: source(PLAN.policy) },
    scope: { kind: 'SELECTED_EVENT_FAMILY', family_id: familyId },
    surfaces: { monthly: { status: 'UNAVAILABLE', observed_at: now, source_ref: 'collector:monthly-identity-unavailable', rows: [] } }
  };
  const collected = {};
  for (const key of ['canonical', 'lineage', 'core', 'web_ready']) {
    const plan = PLAN[key];
    const surface = { status: 'UNAVAILABLE', observed_at: now, source_ref: source(plan), rows: [] };
    snapshot.surfaces[key] = surface;
    try {
      const properties = sheetProperties(metadata[plan.spreadsheetId], plan);
      collected[key] = rangeRows(await getRange(key), key);
      surface.status = properties.gridProperties.rowCount > plan.endRow ? 'PARTIAL' : 'COMPLETE';
      evidence[key] = { grid_rows: properties.gridProperties.rowCount, sampled_last_row: plan.endRow, status: surface.status };
    } catch (error) {
      const allowed = ['SOURCE_METADATA_INVALID','SOURCE_SHEET_IDENTITY_MISMATCH','SOURCE_GRID_INVALID','SOURCE_RANGE_MISMATCH','SOURCE_VALUES_MISSING_OR_INVALID','SOURCE_HEADER_DRIFT','SOURCE_READ_FAILED','SOURCE_READ_TIMEOUT','SOURCE_RESPONSE_TOO_LARGE','SOURCE_SCHEMA_INVALID'];
      evidence[key] = { status: 'UNAVAILABLE', code: allowed.includes(error?.code) ? error.code : 'SOURCE_SCHEMA_INVALID' };
    }
  }
  const ids = new Set(eventIds);
  for (const key of ['canonical', 'lineage']) if (collected[key]) {
    snapshot.surfaces[key].rows = projectRows(key, collected[key], familyId, ids);
    if (key === 'lineage') for (const row of snapshot.surfaces.lineage.rows) if (typeof row.core_event_id === 'string' && /^EVT-[A-Za-z0-9_|.-]{1,250}$/.test(row.core_event_id)) ids.add(row.core_event_id);
  }
  check(ids.size <= 128, 'SELECTED_EVENT_LIMIT_EXCEEDED');
  for (const key of ['core', 'web_ready']) if (collected[key]) snapshot.surfaces[key].rows = projectRows(key, collected[key], familyId, ids);
  for (const key of ['canonical', 'lineage', 'core', 'web_ready']) evidence[key].selected_rows = snapshot.surfaces[key].rows.length;
  // A read-only collection is not an atomic transaction across Sheets. Detect policy drift
  // during this bounded read, and withhold the snapshot if its authority changed.
  const finalPolicy=policyObservation(rangeRows(await getRange('policy'),'policy'),expectedPolicyVersion,now);
  if(finalPolicy.status==='BLOCKED'||finalPolicy.active_rules_sha256!==policy.active_rules_sha256) {
    evidence.policy={...finalPolicy,status:'BLOCKED',reason:'POLICY_CHANGED_DURING_READ'};
    return {status:'BLOCKED',snapshot:null,evidence};
  }
  C.assertSafeData(snapshot);
  C.assertSafeData(evidence);
  return { status:'OBSERVED',snapshot, evidence };
}

module.exports = { VERSION, PLAN, HEADERS, collectSnapshot };
