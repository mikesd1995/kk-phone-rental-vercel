'use strict';

function text(value) {
  return String(value == null ? '' : value).trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function numberPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toMs(value) {
  const t = Date.parse(text(value));
  return Number.isFinite(t) ? t : null;
}

function normalizeCompetitor(value) {
  return text(value)
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function field(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && text(row[key]) !== '') return row[key];
  }
  return '';
}

function canonicalIdentity(row) {
  const eventKey = text(field(row, 'event_key', 'eventKey', 'Event Key'));
  const competitor = normalizeCompetitor(field(row, 'competitor_business_id', 'normalized_competitor', 'competitor_account', 'competitorAccount', 'Competitor Account'));
  const packageKey = text(field(row, 'package_key', 'packageKey', 'Package Key')).toUpperCase();
  return { event_key: eventKey, competitor_key: competitor, package_key: packageKey };
}

function identityKey(row) {
  const id = canonicalIdentity(row);
  if (!id.event_key || !id.competitor_key || !id.package_key) return '';
  return [id.event_key, id.competitor_key, id.package_key].join('|');
}

function currentEligibility(row, options = {}) {
  const nowMs = toMs(options.now || new Date().toISOString());
  const id = canonicalIdentity(row);
  const checkedMs = toMs(field(row, 'last_checked', 'lastChecked', 'Last Checked'));
  const freshUntilMs = toMs(field(row, 'fresh_until', 'freshUntil', 'Fresh Until'));
  const freshness = upper(field(row, 'freshness', 'Freshness'));
  const sourceRow = Number(field(row, 'source_evidence_row', 'sourceEvidenceRow', 'Source Evidence Row'));
  const price = numberPrice(field(row, 'current_bundle_price', 'bundle_price', 'bundlePrice', 'Current Bundle Price', 'Bundle Price'));
  const reasons = [];

  if (!id.event_key) reasons.push('MISSING_EVENT_KEY');
  if (!id.competitor_key) reasons.push('MISSING_COMPETITOR_IDENTITY');
  if (!id.package_key) reasons.push('MISSING_PACKAGE_KEY');
  if (price === null) reasons.push('INVALID_PRICE');
  if (!Number.isInteger(sourceRow) || sourceRow <= 0) reasons.push('MISSING_SOURCE_LINEAGE');
  if (checkedMs === null) reasons.push('MISSING_LAST_CHECKED');
  if (freshUntilMs === null) reasons.push('MISSING_FRESH_UNTIL');
  if (nowMs === null) reasons.push('INVALID_NOW');
  if (checkedMs !== null && nowMs !== null && checkedMs > nowMs) reasons.push('FUTURE_LAST_CHECKED');
  if (freshUntilMs !== null && nowMs !== null && freshUntilMs <= nowMs) reasons.push('TTL_EXPIRED');
  if (freshness !== 'FRESH') reasons.push('NOT_FRESH');

  return {
    eligible: reasons.length === 0,
    reasons,
    identity: id,
    price,
    checked_ms: checkedMs,
    fresh_until_ms: freshUntilMs,
    source_evidence_row: sourceRow
  };
}

function queueIsBookable(row) {
  const status = upper(field(row, 'queue_status', 'queueStatus', 'Queue Status'));
  if (!status) return true;
  if (/(OPEN|AVAILABLE|REOPENED)/.test(status)) return true;
  if (/(FULL|SOLD_OUT|CLOSED|PAUSED|UNAVAILABLE)/.test(status)) return false;
  return true;
}

function observationCheckedMs(row) {
  return toMs(field(row, 'last_checked', 'observed_at', 'checked_at', 'Last Checked', 'Observed At')) || -Infinity;
}

function resolveCurrentProjection(observations, options = {}) {
  if (!Array.isArray(observations)) throw new Error('observations must be an array');
  const now = options.now || new Date().toISOString();
  const grouped = new Map();

  for (const row of observations) {
    const key = identityKey(row);
    if (!key) continue;
    const arr = grouped.get(key) || [];
    arr.push(row);
    grouped.set(key, arr);
  }

  const current = [];
  for (const rows of grouped.values()) {
    const ordered = rows.slice().sort((a, b) => observationCheckedMs(b) - observationCheckedMs(a));
    const selected = ordered.find(row => currentEligibility(row, { now }).eligible);
    if (!selected) continue;

    const selectedPrice = numberPrice(field(selected, 'current_bundle_price', 'bundle_price', 'bundlePrice', 'Current Bundle Price', 'Bundle Price'));
    const selectedChecked = observationCheckedMs(selected);
    const previous = ordered.find(row => {
      if (row === selected || observationCheckedMs(row) >= selectedChecked) return false;
      return numberPrice(field(row, 'current_bundle_price', 'bundle_price', 'bundlePrice', 'Current Bundle Price', 'Bundle Price')) !== null;
    });
    const previousPrice = previous
      ? numberPrice(field(previous, 'current_bundle_price', 'bundle_price', 'bundlePrice', 'Current Bundle Price', 'Bundle Price'))
      : null;
    const id = canonicalIdentity(selected);

    current.push({
      event_key: id.event_key,
      competitor_key: id.competitor_key,
      package_key: id.package_key,
      current_bundle_price: selectedPrice,
      previous_bundle_price: previousPrice,
      price_change: previousPrice === null ? null : selectedPrice - previousPrice,
      post_url: text(field(selected, 'post_url', 'postUrl', 'Post URL')),
      last_checked: text(field(selected, 'last_checked', 'lastChecked', 'Last Checked')),
      fresh_until: text(field(selected, 'fresh_until', 'freshUntil', 'Fresh Until')),
      freshness: 'FRESH',
      queue_status: text(field(selected, 'queue_status', 'queueStatus', 'Queue Status')),
      confidence: text(field(selected, 'confidence', 'Confidence')),
      source_evidence_row: Number(field(selected, 'source_evidence_row', 'sourceEvidenceRow', 'Source Evidence Row'))
    });
  }

  return current.sort((a, b) => identityKey(a).localeCompare(identityKey(b)));
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function assessCurrentExactMarket(rows, options = {}) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  const eventKey = text(options.event_key || options.eventKey);
  const packageKey = text(options.package_key || options.packageKey).toUpperCase();
  if (!eventKey) throw new Error('event_key is required');
  if (!packageKey) throw new Error('package_key is required');

  const own = new Set((options.own_competitor_ids || []).map(normalizeCompetitor).filter(Boolean));
  const requireBookableQueue = options.require_bookable_queue !== false;
  const byBusiness = new Map();
  const rejected = [];

  for (const row of rows) {
    const id = canonicalIdentity(row);
    if (id.event_key !== eventKey || id.package_key !== packageKey) continue;
    const eligibility = currentEligibility(row, { now: options.now });
    if (!eligibility.eligible) {
      rejected.push({ row, reasons: eligibility.reasons });
      continue;
    }
    if (own.has(id.competitor_key)) {
      rejected.push({ row, reasons: ['OWN_SHOP_EXCLUDED'] });
      continue;
    }
    if (requireBookableQueue && !queueIsBookable(row)) {
      rejected.push({ row, reasons: ['QUEUE_NOT_BOOKABLE'] });
      continue;
    }

    const existing = byBusiness.get(id.competitor_key);
    if (!existing || eligibility.checked_ms > existing._checked_ms) {
      byBusiness.set(id.competitor_key, Object.assign({}, row, {
        _checked_ms: eligibility.checked_ms,
        _price: eligibility.price,
        _competitor_key: id.competitor_key
      }));
    }
  }

  const accepted = Array.from(byBusiness.values()).sort((a, b) => a._competitor_key.localeCompare(b._competitor_key));
  const prices = accepted.map(row => row._price);
  const count = accepted.length;

  return {
    event_key: eventKey,
    package_key: packageKey,
    independent_competitor_count: count,
    exact_range_eligible: count >= 2,
    exact_median_eligible: count >= 3,
    market_range: count >= 2 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    median: count >= 3 ? median(prices) : null,
    accepted: accepted.map(row => {
      const copy = Object.assign({}, row);
      delete copy._checked_ms;
      delete copy._price;
      delete copy._competitor_key;
      return copy;
    }),
    rejected
  };
}

function assertProjectionReadback(intended, actual) {
  const leftId = canonicalIdentity(intended);
  const rightId = canonicalIdentity(actual);
  const checks = [
    ['event_key', leftId.event_key, rightId.event_key],
    ['competitor_key', leftId.competitor_key, rightId.competitor_key],
    ['package_key', leftId.package_key, rightId.package_key],
    ['current_bundle_price', numberPrice(field(intended, 'current_bundle_price', 'Current Bundle Price')), numberPrice(field(actual, 'current_bundle_price', 'Current Bundle Price'))],
    ['freshness', upper(field(intended, 'freshness', 'Freshness')), upper(field(actual, 'freshness', 'Freshness'))],
    ['fresh_until', text(field(intended, 'fresh_until', 'Fresh Until')), text(field(actual, 'fresh_until', 'Fresh Until'))],
    ['source_evidence_row', Number(field(intended, 'source_evidence_row', 'Source Evidence Row')), Number(field(actual, 'source_evidence_row', 'Source Evidence Row'))]
  ];
  const mismatches = checks.filter(([, a, b]) => a !== b).map(([name]) => name);
  return { ok: mismatches.length === 0, mismatches };
}

module.exports = {
  normalizeCompetitor,
  canonicalIdentity,
  identityKey,
  currentEligibility,
  queueIsBookable,
  resolveCurrentProjection,
  assessCurrentExactMarket,
  assertProjectionReadback
};
