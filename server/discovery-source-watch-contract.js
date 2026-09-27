'use strict';

const crypto = require('crypto');

const CONTRACT_VERSION = 'discovery-source-watch-v1';
const ALLOWED_PROVIDERS = new Set([
  'CHANGEDETECTION_IO',
  'EXA',
  'CRAWL4AI',
  'FIRECRAWL',
  'OFFICIAL_SOURCE_WATCH'
]);
const ALLOWED_SOURCE_TIERS = new Set([
  'OFFICIAL',
  'TICKETING',
  'VENUE',
  'ARTIST_AGENCY',
  'BRAND_SPONSOR',
  'SOCIAL',
  'COMPETITOR',
  'PUBLIC_CALENDAR',
  'SECONDARY'
]);
const ALLOWED_STATES = new Set(['NEW', 'CHANGED', 'UNCHANGED', 'ERROR']);
const CHANGE_STATES = new Set(['NEW', 'CHANGED']);
const FORBIDDEN_AUTHORITY_FIELDS = [
  'final_decision',
  'verified',
  'approved',
  'final_truth',
  'monthly_write',
  'pricing_write',
  'booking_write',
  'inventory_write',
  'notification_send',
  'sheet_write',
  'machine_sot_write'
];

function text(value) {
  return String(value == null ? '' : value).trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function validSha256(value) {
  return /^[0-9a-f]{64}$/i.test(text(value));
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch (_error) {
    return null;
  }
}

function normalizeObservation(input = {}) {
  const provider = upper(input.provider);
  const sourceTier = upper(input.source_tier);
  const state = upper(input.state);
  const observedAtRaw = text(input.observed_at);
  const observedAtMs = Date.parse(observedAtRaw);
  const sourceUrl = parseHttpsUrl(input.source_url);

  return {
    contract_version: CONTRACT_VERSION,
    observation_id: text(input.observation_id),
    provider,
    source_tier: sourceTier,
    state,
    source_url: sourceUrl ? sourceUrl.toString() : text(input.source_url),
    observed_at: Number.isFinite(observedAtMs) ? new Date(observedAtMs).toISOString() : null,
    content_hash: text(input.content_hash).toLowerCase(),
    previous_content_hash: text(input.previous_content_hash).toLowerCase() || null,
    change_id: text(input.change_id) || null,
    evidence_ref: text(input.evidence_ref) || null,
    source_label: text(input.source_label) || null
  };
}

function validateObservation(input = {}, options = {}) {
  const observation = normalizeObservation(input);
  const blockers = [];
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxFutureSkewMs = Number.isFinite(options.maxFutureSkewMs)
    ? options.maxFutureSkewMs
    : 5 * 60 * 1000;
  const maxAgeMs = Number.isFinite(options.maxAgeMs)
    ? options.maxAgeMs
    : 7 * 24 * 60 * 60 * 1000;

  if (!observation.observation_id) blockers.push('OBSERVATION_ID_MISSING');
  if (!ALLOWED_PROVIDERS.has(observation.provider)) blockers.push('PROVIDER_NOT_ALLOWED');
  if (!ALLOWED_SOURCE_TIERS.has(observation.source_tier)) blockers.push('SOURCE_TIER_NOT_ALLOWED');
  if (!ALLOWED_STATES.has(observation.state)) blockers.push('STATE_NOT_ALLOWED');

  const parsedUrl = parseHttpsUrl(observation.source_url);
  if (!parsedUrl) blockers.push('SOURCE_URL_MUST_BE_HTTPS');

  if (!observation.observed_at) {
    blockers.push('OBSERVED_AT_INVALID');
  } else {
    const observedAtMs = Date.parse(observation.observed_at);
    if (observedAtMs > nowMs + maxFutureSkewMs) blockers.push('OBSERVED_AT_IN_FUTURE');
    if (nowMs - observedAtMs > maxAgeMs) blockers.push('OBSERVATION_STALE');
  }

  if (observation.state !== 'ERROR' && !validSha256(observation.content_hash)) {
    blockers.push('CONTENT_HASH_INVALID');
  }

  if (observation.state === 'CHANGED') {
    if (!validSha256(observation.previous_content_hash)) blockers.push('PREVIOUS_CONTENT_HASH_INVALID');
    if (
      validSha256(observation.content_hash) &&
      validSha256(observation.previous_content_hash) &&
      observation.content_hash === observation.previous_content_hash
    ) {
      blockers.push('CHANGED_HASH_NOT_DIFFERENT');
    }
  }

  if (observation.state === 'UNCHANGED' && validSha256(observation.previous_content_hash)) {
    if (observation.content_hash !== observation.previous_content_hash) {
      blockers.push('UNCHANGED_HASH_MISMATCH');
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    observation
  };
}

function evaluateObservation(input = {}, options = {}) {
  const checked = validateObservation(input, options);
  const base = {
    contract_version: CONTRACT_VERSION,
    observation: checked.observation,
    blockers: checked.blockers,
    authoritative: false,
    verifier_required: true,
    downstream_discovery_allowed: false,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    direct_business_write_allowed: false,
    direct_notification_allowed: false
  };

  if (!checked.ok) {
    return { ...base, status: 'BLOCKED_INVALID_OBSERVATION' };
  }

  if (checked.observation.state === 'ERROR') {
    return { ...base, status: 'SOURCE_OBSERVATION_ERROR' };
  }

  if (checked.observation.state === 'UNCHANGED') {
    return { ...base, status: 'NO_CHANGE' };
  }

  return {
    ...base,
    status: 'DISCOVERY_STAGING_ELIGIBLE',
    downstream_discovery_allowed: true
  };
}

function validateDiscoveryResult(result) {
  const blockers = [];
  if (!result || typeof result !== 'object') return ['DISCOVERY_RESULT_MISSING'];

  if (result.authoritative !== false) blockers.push('DISCOVERY_RESULT_MUST_BE_NONAUTHORITATIVE');
  if (result.verifier_required !== true) blockers.push('DISCOVERY_RESULT_MUST_REQUIRE_VERIFIER');
  if (Number(result.production_writes || 0) !== 0) blockers.push('DISCOVERY_RESULT_PRODUCTION_WRITES_NONZERO');
  if (result.final_truth_mutation !== undefined && result.final_truth_mutation !== false) {
    blockers.push('DISCOVERY_RESULT_FINAL_TRUTH_MUTATION_NOT_FALSE');
  }
  if (result.notification_sends !== undefined && Number(result.notification_sends) !== 0) {
    blockers.push('DISCOVERY_RESULT_NOTIFICATION_SENDS_NONZERO');
  }

  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  if (candidates.length > 100) blockers.push('DISCOVERY_RESULT_CANDIDATE_BOUND_EXCEEDED');

  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    const value = result[field];
    if (value !== undefined && value !== false && value !== null && value !== '' && value !== 0) {
      blockers.push(`DISCOVERY_RESULT_FORBIDDEN_AUTHORITY_FIELD:${field}`);
    }
  }

  return blockers;
}

function summarizeCandidates(result = {}) {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  return candidates.slice(0, 100).map((candidate, index) => ({
    candidate_id: text(candidate.candidate_id) || `WATCH-CANDIDATE-${index + 1}`,
    title: text(candidate.title) || null,
    event_date: text(candidate.event_date) || null,
    venue: text(candidate.venue) || null,
    artist: Array.isArray(candidate.artist)
      ? candidate.artist.map(text).filter(Boolean).slice(0, 20)
      : (text(candidate.artist) ? [text(candidate.artist)] : []),
    source_url: parseHttpsUrl(candidate.source_url)
      ? parseHttpsUrl(candidate.source_url).toString()
      : null,
    confidence: Number.isFinite(Number(candidate.confidence))
      ? Number(candidate.confidence)
      : null
  }));
}

function buildStagingHandoff(preflight, result) {
  const blockers = validateDiscoveryResult(result);
  if (blockers.length) {
    const error = new Error('discovery result violates staging authority contract');
    error.code = 'DISCOVERY_RESULT_CONTRACT_VIOLATION';
    error.blockers = blockers;
    throw error;
  }

  return {
    handoff_version: 'discovery-staging-handoff-v1',
    handoff_state: 'DISCOVERY_STAGING_ONLY',
    route: 'EXISTING_SCANNER_STAGING_TO_VERIFIER',
    source_observation_id: preflight.observation.observation_id,
    source_provider: preflight.observation.provider,
    source_tier: preflight.observation.source_tier,
    source_url: preflight.observation.source_url,
    source_state: preflight.observation.state,
    candidates: summarizeCandidates(result),
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    direct_business_write_allowed: false,
    direct_notification_allowed: false
  };
}

async function runGuardedDiscovery(input = {}, options = {}) {
  const preflight = evaluateObservation(input, options);
  const base = {
    contract_version: CONTRACT_VERSION,
    preflight,
    discovery_call_attempted: false,
    discovery_call_count: 0,
    handoff: null,
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0
  };

  if (!preflight.downstream_discovery_allowed) {
    return { ...base, status: preflight.status };
  }

  if (typeof options.discoverFn !== 'function') {
    return {
      ...base,
      status: 'BLOCKED_DISCOVERY_FUNCTION_MISSING',
      blockers: ['DISCOVERY_FUNCTION_MISSING']
    };
  }

  let result;
  try {
    result = await options.discoverFn(preflight.observation);
  } catch (error) {
    return {
      ...base,
      discovery_call_attempted: true,
      discovery_call_count: 1,
      status: 'DISCOVERY_PROVIDER_UNAVAILABLE_NONAUTHORITATIVE',
      error_class: text(error && (error.code || error.name)) || 'ERROR',
      blockers: ['DISCOVERY_PROVIDER_CALL_FAILED']
    };
  }

  const blockers = validateDiscoveryResult(result);
  if (blockers.length) {
    return {
      ...base,
      discovery_call_attempted: true,
      discovery_call_count: 1,
      status: 'DISCOVERY_RESULT_REJECTED',
      blockers
    };
  }

  return {
    ...base,
    discovery_call_attempted: true,
    discovery_call_count: 1,
    status: 'DISCOVERY_STAGING_HANDOFF_PREPARED',
    handoff: buildStagingHandoff(preflight, result)
  };
}

module.exports = {
  CONTRACT_VERSION,
  ALLOWED_PROVIDERS,
  ALLOWED_SOURCE_TIERS,
  ALLOWED_STATES,
  CHANGE_STATES,
  sha256,
  normalizeObservation,
  validateObservation,
  evaluateObservation,
  validateDiscoveryResult,
  buildStagingHandoff,
  runGuardedDiscovery
};
