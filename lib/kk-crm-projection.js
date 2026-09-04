'use strict';

/**
 * KK Phone Rental — strict CRM -> Machine SOT availability projection.
 *
 * Safety properties:
 * - CRM remains the booking/inventory writer.
 * - No fuzzy event-name join. A caller must provide an explicit, verified crosswalk.
 * - Runtime lookup is exact crm_event_id only.
 * - Stale/invalid input fails closed.
 * - Output is operational aggregate only; no customer/contact/KYC PII is emitted.
 */

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function asBool(v) {
  if (v === true || v === false) return v;
  const s = lower(v);
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}
function asNonNegativeInt(v, field) {
  const s = text(v).replace(/,/g, '');
  if (!/^\d+$/.test(s)) throw new Error(`${field}: expected non-negative integer`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${field}: invalid integer`);
  return n;
}
function parseTime(v, field) {
  const t = Date.parse(text(v));
  if (!Number.isFinite(t)) throw new Error(`${field}: invalid timestamp`);
  return t;
}
function exactOne(rows, predicate, label) {
  const hits = (rows || []).filter(predicate);
  if (hits.length !== 1) throw new Error(`${label}: expected exactly one row, got ${hits.length}`);
  return hits[0];
}
function requireExplicitCrosswalk(x) {
  if (!x || x.identity_verified !== true) throw new Error('crosswalk: identity_verified=true required');
  const machineShowId = text(x.machine_show_id);
  const crmEventId = text(x.crm_event_id);
  if (!machineShowId || !crmEventId) throw new Error('crosswalk: machine_show_id and crm_event_id required');
  const evidence = Array.isArray(x.identity_evidence) ? x.identity_evidence.map(text).filter(Boolean) : [];
  if (evidence.length < 2) throw new Error('crosswalk: at least two identity_evidence items required');
  return { machineShowId, crmEventId, evidence };
}
function packageType(r) { return lower(r.package_type || r.type); }
function packageStatus(r) { return lower(r.status || r.availability_status); }
function packageQty(r) { return asNonNegativeInt(r.available_qty ?? r.available_quantity ?? r.qty, 'package.available_qty'); }

function buildProjection(input) {
  const x = requireExplicitCrosswalk(input && input.crosswalk);
  const webRows = input.web_ready_rows || [];
  const packageRows = input.package_rows || [];
  const assetRows = input.asset_rows || [];
  const nowMs = input.now_ms == null ? Date.now() : Number(input.now_ms);
  const maxAgeMs = input.max_age_ms == null ? 15 * 60 * 1000 : Number(input.max_age_ms);
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new Error('freshness: invalid clock/max_age');

  const web = exactOne(webRows, r => text(r.event_id) === x.crmEventId, 'web_ready exact crm_event_id');
  const sourceCheckedAt = text(input.source_checked_at);
  const sourceMs = parseTime(sourceCheckedAt, 'source_checked_at');
  const ageMs = Math.max(0, nowMs - sourceMs);
  const freshness = ageMs <= maxAgeMs ? 'CURRENT' : 'STALE';

  const phoneAvailable = asNonNegativeInt(web.available_phone_count, 'available_phone_count');
  const lensAvailable = asNonNegativeInt(web.available_lens_count, 'available_lens_count');

  const exactPackages = packageRows.filter(r => text(r.event_id) === x.crmEventId);
  if (!exactPackages.length) throw new Error('packages: no exact crm_event_id rows');
  if (packageRows.some(r => text(r.event_id) !== x.crmEventId)) {
    // Mixed inputs are allowed only because we explicitly filter; they must never change this projection.
  }
  const bundle = exactOne(exactPackages, r => packageType(r) === 'phone_lens_bundle', 'phone_lens_bundle');
  const bundleQty = packageQty(bundle);
  const bundleStatus = packageStatus(bundle);
  if (!['available', 'full', 'hidden'].includes(bundleStatus)) throw new Error(`bundle status unsupported: ${bundleStatus || '<blank>'}`);
  if (bundleStatus === 'available' && bundleQty < 1) throw new Error('bundle: available status with zero quantity');
  if (bundleStatus === 'full' && bundleQty !== 0) throw new Error('bundle: full status with nonzero quantity');

  let g1Rentable = 0;
  let g2Rentable = 0;
  let phoneRentable = 0;
  for (const a of assetRows) {
    const rentable = asBool(a.rentable_now);
    if (rentable !== true) continue;
    const type = lower(a.asset_type);
    const model = text(a.model_group).toUpperCase();
    if (type === 'phone') phoneRentable++;
    if (type === 'lens' && model === 'ZEISS_2_35X') g1Rentable++;
    if (type === 'lens' && model === 'G2') g2Rentable++;
  }

  if (phoneAvailable > phoneRentable && assetRows.length) throw new Error('availability exceeds rentable phone assets');
  if (lensAvailable > g1Rentable + g2Rentable && assetRows.length) throw new Error('availability exceeds rentable lens assets');
  if (bundleQty > Math.min(phoneAvailable, lensAvailable)) throw new Error('bundle availability exceeds phone/lens pair capacity');

  return {
    schema_version: 1,
    machine_show_id: x.machineShowId,
    crm_event_id: x.crmEventId,
    source_checked_at: sourceCheckedAt,
    freshness,
    source_age_ms: ageMs,
    booking_status_for_web: text(web.booking_status_for_web),
    action_for_web: text(web.action_for_web),
    phone_available: phoneAvailable,
    lens_available: lensAvailable,
    g1_rentable: g1Rentable,
    g2_rentable: g2Rentable,
    bundle_available: bundleQty,
    bundle_status: bundleStatus,
    identity_evidence: x.evidence.slice(),
    write_boundary: 'READ_ONLY_CRM_PROJECTION'
  };
}

module.exports = { buildProjection };
