'use strict';
const {evidenceCount,evidenceTimestamp}=require('./kk-evidence-validation');

/**
 * KK Phone Rental — strict CRM -> Machine SOT availability projection.
 *
 * Safety properties:
 * - CRM remains the booking/inventory writer.
 * - No fuzzy event-name join; an explicit verified crosswalk is mandatory.
 * - Runtime lookup is exact crm_event_id only.
 * - Freshness is clock-verified and future timestamps fail closed.
 * - Bundle capacity is checked against the exact phone/lens model groups.
 * - Output is operational aggregate only; no customer/contact/KYC PII is emitted.
 */

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function asBool(v) {
  if (v === true || v === false) return v;
  if (typeof v !== 'string') return null;
  const s = lower(v);
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}
function asNonNegativeInt(v, field) {
  const n = evidenceCount(v);
  if (n === null) throw new Error(`${field}: expected non-negative integer`);
  return n;
}
function parseTime(v, field) {
  if (!evidenceTimestamp(v)) throw new Error(`${field}: invalid timestamp`);
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
  const uniqueEvidence = [...new Set(evidence)];
  if (uniqueEvidence.length < 2) throw new Error('crosswalk: at least two independent identity_evidence items required');
  return { machineShowId, crmEventId, evidence: uniqueEvidence };
}
function packageType(r) { return lower(r.package_type || r.type); }
function packageStatus(r) { return lower(r.status || r.availability_status); }
function packageQty(r) { return asNonNegativeInt(r.available_qty ?? r.available_quantity ?? r.qty, 'package.available_qty'); }
function upper(v){ return text(v).toUpperCase(); }

function buildProjection(input) {
  const x = requireExplicitCrosswalk(input && input.crosswalk);
  const webRows = input.web_ready_rows || [];
  const packageRows = input.package_rows || [];
  if (!Array.isArray(input.asset_rows)) throw new Error('asset_rows: explicit inventory read required');
  const assetRows = input.asset_rows;
  const nowMs = input.now_ms == null ? Date.now() : evidenceCount(input.now_ms);
  const maxAgeMs = input.max_age_ms == null ? 15 * 60 * 1000 : evidenceCount(input.max_age_ms);
  const futureToleranceMs = input.future_tolerance_ms == null ? 5 * 60 * 1000 : evidenceCount(input.future_tolerance_ms);
  if (nowMs===null || maxAgeMs===null || futureToleranceMs===null) {
    throw new Error('freshness: invalid clock/max_age/future_tolerance');
  }

  const web = exactOne(webRows, r => text(r.event_id) === x.crmEventId, 'web_ready exact crm_event_id');
  const sourceCheckedAt = text(input.source_checked_at);
  const sourceMs = parseTime(sourceCheckedAt, 'source_checked_at');
  if (sourceMs > nowMs + futureToleranceMs) throw new Error('source_checked_at: future timestamp');
  const ageMs = Math.max(0, nowMs - sourceMs);
  const freshness = ageMs <= maxAgeMs ? 'CURRENT' : 'STALE';

  const phoneAvailable = asNonNegativeInt(web.available_phone_count, 'available_phone_count');
  const lensAvailable = asNonNegativeInt(web.available_lens_count, 'available_lens_count');

  const exactPackages = packageRows.filter(r => text(r.event_id) === x.crmEventId);
  if (!exactPackages.length) throw new Error('packages: no exact crm_event_id rows');
  const bundle = exactOne(exactPackages, r => packageType(r) === 'phone_lens_bundle', 'phone_lens_bundle');
  const bundleQty = packageQty(bundle);
  const bundleStatus = packageStatus(bundle);
  if (!['available', 'full', 'hidden'].includes(bundleStatus)) throw new Error(`bundle status unsupported: ${bundleStatus || '<blank>'}`);
  if (bundleStatus === 'available' && bundleQty < 1) throw new Error('bundle: available status with zero quantity');
  if (bundleStatus === 'full' && bundleQty !== 0) throw new Error('bundle: full status with nonzero quantity');

  const bundlePhoneModel = upper(bundle.model_group);
  const bundleLensModel = upper(bundle.lens_group);
  if (!bundlePhoneModel || bundlePhoneModel === 'NONE') throw new Error('bundle: exact phone model_group required');
  if (!bundleLensModel || bundleLensModel === 'NONE') throw new Error('bundle: exact lens_group required');

  let g1Rentable = 0;
  let g2Rentable = 0;
  let allPhoneRentable = 0;
  let exactPhoneRentable = 0;
  let exactLensRentable = 0;
  const assetIds = new Set();
  for (const a of assetRows) {
    if (!a || typeof a.asset_id !== 'string' || !a.asset_id.trim() || assetIds.has(a.asset_id.trim())) throw new Error('asset identity missing or duplicated');
    assetIds.add(a.asset_id.trim());
    const rentable = asBool(a.rentable_now);
    if (rentable === null) throw new Error('asset rentable_now: explicit boolean required');
    if (rentable !== true) continue;
    const type = lower(a.asset_type);
    const model = upper(a.model_group);
    if (type === 'phone') {
      allPhoneRentable++;
      if (model === bundlePhoneModel) exactPhoneRentable++;
    }
    if (type === 'lens') {
      if (model === 'ZEISS_2_35X') g1Rentable++;
      if (model === 'G2') g2Rentable++;
      if (model === bundleLensModel) exactLensRentable++;
    }
  }

  {
    if (phoneAvailable > exactPhoneRentable) throw new Error('availability exceeds rentable exact phone-model assets');
    if (lensAvailable > exactLensRentable) throw new Error('availability exceeds rentable exact lens-model assets');
  }
  if (bundleQty > Math.min(phoneAvailable, lensAvailable)) throw new Error('bundle availability exceeds phone/lens pair capacity');
  if (bundleQty > Math.min(exactPhoneRentable, exactLensRentable)) throw new Error('bundle availability exceeds exact-model physical capacity');

  const effectiveBundleQty = bundleStatus === 'available' ? bundleQty : 0;
  return {
    schema_version: 2,
    machine_show_id: x.machineShowId,
    crm_event_id: x.crmEventId,
    source_checked_at: sourceCheckedAt,
    freshness,
    source_age_ms: ageMs,
    booking_status_for_web: text(web.booking_status_for_web),
    action_for_web: text(web.action_for_web),
    phone_available: phoneAvailable,
    lens_available: lensAvailable,
    bundle_phone_model_group: bundlePhoneModel,
    bundle_lens_model_group: bundleLensModel,
    exact_phone_model_rentable: exactPhoneRentable,
    exact_lens_model_rentable: exactLensRentable,
    all_phone_rentable: allPhoneRentable,
    g1_rentable: g1Rentable,
    g2_rentable: g2Rentable,
    bundle_available: effectiveBundleQty,
    raw_bundle_available: bundleQty,
    bundle_status: bundleStatus,
    identity_evidence: x.evidence.slice(),
    write_boundary: 'READ_ONLY_CRM_PROJECTION'
  };
}

module.exports = { buildProjection };
