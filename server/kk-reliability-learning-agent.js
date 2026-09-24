'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MEMORY_PATH = path.resolve(__dirname, '../config/kk-reliability-memory.json');
const ALLOWED_ROOT_CAUSE_CONFIDENCE = new Set(['PROVEN','PROBABLE','UNKNOWN','PROVEN_EXTERNAL','UNKNOWN_OWNER']);

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function lower(value) {
  return cleanText(value).toLowerCase();
}

function loadMemory(filePath = DEFAULT_MEMORY_PATH) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || parsed.schema_version !== 'KK_RELIABILITY_MEMORY_V1' || !Array.isArray(parsed.fingerprints)) {
    throw new Error('invalid KK reliability memory');
  }
  return parsed;
}

function observationText(observation = {}) {
  const parts = [
    observation.code,
    observation.category,
    observation.title,
    observation.message,
    observation.symptom,
    observation.notes,
    observation.surface,
    ...(Array.isArray(observation.signals) ? observation.signals : [])
  ];
  return lower(parts.filter(Boolean).join(' | '));
}

function matchFingerprint(observation, fingerprint) {
  const hint = cleanText(observation && observation.fingerprint_hint).toUpperCase();
  if (hint && hint === cleanText(fingerprint.id).toUpperCase()) {
    return { matched: true, score: 100, reason: 'EXACT_FINGERPRINT_HINT' };
  }

  const code = cleanText(observation && observation.code).toUpperCase();
  const codes = ((fingerprint.match && fingerprint.match.codes) || []).map(value => cleanText(value).toUpperCase());
  if (code && codes.includes(code)) {
    return { matched: true, score: 90, reason: 'EXACT_CODE' };
  }

  const text = observationText(observation);
  const phrasesAll = ((fingerprint.match && fingerprint.match.phrases_all) || []).map(lower).filter(Boolean);
  const phrasesAny = ((fingerprint.match && fingerprint.match.phrases_any) || []).map(lower).filter(Boolean);

  let score = 0;
  if (phrasesAll.length && phrasesAll.every(phrase => text.includes(phrase))) score += 50;
  const anyHits = phrasesAny.filter(phrase => text.includes(phrase));
  score += anyHits.length * 20;

  return {
    matched: score >= 40,
    score,
    reason: score >= 40 ? 'TEXT_SIGNATURE' : 'NO_MATCH'
  };
}

function classifyObservation(observation, memory = loadMemory()) {
  const candidates = memory.fingerprints
    .map(fingerprint => ({ fingerprint, match: matchFingerprint(observation, fingerprint) }))
    .filter(item => item.match.matched)
    .sort((a, b) => b.match.score - a.match.score || a.fingerprint.id.localeCompare(b.fingerprint.id));

  if (!candidates.length) {
    return {
      known: false,
      fingerprint_id: null,
      match_score: 0,
      match_reason: 'NO_KNOWN_FINGERPRINT',
      severity: cleanText(observation && observation.severity) || 'P2',
      root_cause_confidence: 'UNKNOWN',
      diagnosis: 'Novel or insufficiently described incident. Preserve evidence and triage before proposing a new architecture.',
      known_repair: null,
      regression_guards: [],
      never_do: []
    };
  }

  const chosen = candidates[0];
  const fp = chosen.fingerprint;
  return {
    known: true,
    fingerprint_id: fp.id,
    match_score: chosen.match.score,
    match_reason: chosen.match.reason,
    severity: fp.severity,
    root_cause_confidence: fp.root_cause_confidence,
    diagnosis: fp.known_recurrence
      ? 'Known recurring incident class. Reuse the existing repair recipe and regression guards before inventing a new component.'
      : 'Known incident class.',
    known_repair: fp.known_repair,
    regression_guards: [...(fp.regression_guards || [])],
    never_do: [...(fp.never_do || [])]
  };
}

function countHistory(history = []) {
  const counts = new Map();
  for (const item of Array.isArray(history) ? history : []) {
    const id = cleanText(item && (item.fingerprint_id || item.fingerprint));
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function analyzeReliability(observations = [], options = {}) {
  const memory = options.memory || loadMemory(options.memory_path);
  const list = Array.isArray(observations) ? observations : [];
  const historyCounts = countHistory(options.incident_history);
  const currentCounts = new Map();

  const incidents = list.map((observation, index) => {
    const diagnosis = classifyObservation(observation, memory);
    if (diagnosis.fingerprint_id) {
      currentCounts.set(diagnosis.fingerprint_id, (currentCounts.get(diagnosis.fingerprint_id) || 0) + 1);
    }
    return {
      observation_index: index,
      observation_id: cleanText(observation && (observation.id || observation.incident_id)) || `OBS-${index + 1}`,
      ...diagnosis
    };
  });

  for (const incident of incidents) {
    if (!incident.fingerprint_id) {
      incident.occurrence_count = 1;
      incident.recurrence = false;
      continue;
    }
    incident.occurrence_count =
      (historyCounts.get(incident.fingerprint_id) || 0) +
      (currentCounts.get(incident.fingerprint_id) || 0);
    const fp = memory.fingerprints.find(item => item.id === incident.fingerprint_id);
    incident.recurrence = Boolean((fp && fp.known_recurrence) || incident.occurrence_count >= 2);
  }

  const known = incidents.filter(item => item.known);
  const unknown = incidents.filter(item => !item.known);
  const recurring = incidents.filter(item => item.recurrence);

  return {
    schema_version: 'KK_RELIABILITY_AGENT_REPORT_V1',
    mode: 'READ_ONLY_LEARNING_ADVISOR',
    generated_from_observation_count: incidents.length,
    known_incident_count: known.length,
    unknown_incident_count: unknown.length,
    recurring_incident_count: recurring.length,
    incidents,
    next_action_policy: {
      known_recurrence: 'Reuse the known repair and run its regression guards. Do not create a new runner/transport/source of truth merely because the symptom returned.',
      novel_incident: 'Preserve evidence, isolate the first failing boundary, and propose a memory entry only after root-cause confidence and regression coverage are explicit.'
    },
    safety: {
      safe_to_auto_apply: false,
      production_writes: 0,
      task_mutations: 0,
      policy_mutations: 0,
      provider_sends: 0,
      auto_merge: false,
      auto_deploy: false,
      human_approval_required: true
    }
  };
}

function proposeMemoryUpdate(input = {}) {
  const rootCauseConfidence = cleanText(input.root_cause_confidence || 'UNKNOWN').toUpperCase();
  if (!ALLOWED_ROOT_CAUSE_CONFIDENCE.has(rootCauseConfidence)) {
    throw new Error('invalid root_cause_confidence');
  }
  const fingerprintId = cleanText(input.fingerprint_id);
  const knownRepair = cleanText(input.known_repair);
  const evidence = Array.isArray(input.evidence) ? input.evidence.map(cleanText).filter(Boolean) : [];
  const regressionGuards = Array.isArray(input.regression_guards)
    ? input.regression_guards.map(cleanText).filter(Boolean)
    : [];

  const blockers = [];
  if (!fingerprintId) blockers.push('FINGERPRINT_ID_MISSING');
  if (!knownRepair) blockers.push('KNOWN_REPAIR_MISSING');
  if (!evidence.length) blockers.push('EVIDENCE_MISSING');
  if (!regressionGuards.length) blockers.push('REGRESSION_GUARD_MISSING');

  return {
    schema_version: 'KK_RELIABILITY_MEMORY_PATCH_V1',
    status: blockers.length ? 'BLOCKED' : 'PROPOSED',
    blockers,
    requires_human_review: true,
    safe_to_auto_apply: false,
    production_writes: 0,
    fingerprint_id: fingerprintId,
    root_cause_confidence: rootCauseConfidence,
    known_repair: knownRepair,
    evidence,
    regression_guards: regressionGuards,
    never_do: Array.isArray(input.never_do) ? input.never_do.map(cleanText).filter(Boolean) : []
  };
}

function buildAdvisorPrompt(report) {
  if (!report || report.schema_version !== 'KK_RELIABILITY_AGENT_REPORT_V1') {
    throw new Error('valid KK_RELIABILITY_AGENT_REPORT_V1 report required');
  }
  return [
    'You are the KK Phone Rental Reliability Learning Agent.',
    'Your job is to stop repeated engineering incidents from being re-solved from scratch.',
    'Use only the supplied evidence and known failure memory.',
    'For a known fingerprint, reuse the known repair recipe and regression guards before proposing new architecture.',
    'For an unknown fingerprint, isolate the first failing boundary and preserve uncertainty.',
    'Never mutate production, tasks, policy, pricing, bookings, inventory, providers, Make, Scanner or Verifier.',
    'Never claim root cause above the supplied confidence.',
    'Every durable repair must have a regression guard or an explicit BLOCKED learning proposal.',
    `Reliability report: ${JSON.stringify(report)}`,
    'Return: incident fingerprint, evidence, root-cause confidence, reused repair, regression checks, remaining risk, and whether a memory patch should be proposed.'
  ].join('\n');
}

module.exports = {
  DEFAULT_MEMORY_PATH,
  cleanText,
  loadMemory,
  observationText,
  matchFingerprint,
  classifyObservation,
  analyzeReliability,
  proposeMemoryUpdate,
  buildAdvisorPrompt
};
