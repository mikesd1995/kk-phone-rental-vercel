'use strict';

const DEFAULT_ZERO_SHOT_MODEL = 'MoritzLaurer/bge-m3-zeroshot-v2.0';
const DEFAULT_EMBED_MODEL = 'intfloat/multilingual-e5-large';
const HF_ROUTER_PREFIX = 'https://router.huggingface.co/hf-inference/models/';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_DUPLICATE_THRESHOLD = 0.92;

const ZERO_SHOT_LABEL_MAP = Object.freeze({
  'concert': 'CONCERT',
  'fan meeting': 'FAN_MEETING',
  'fan sign': 'FAN_SIGN',
  'fan screening': 'FAN_SCREENING',
  'festival': 'FESTIVAL',
  'premiere': 'PREMIERE',
  'graduation event': 'GRADUATION',
  'brand event': 'BRAND_EVENT',
  'artist appearance': 'ARTIST_APPEARANCE',
  'other event': 'OTHER'
});

const EVENT_LABELS = Object.freeze([...new Set(Object.values(ZERO_SHOT_LABEL_MAP))]);

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function boundedText(value, max = 6000) {
  const text = cleanText(value);
  return text.length <= max ? text : text.slice(0, max);
}

function safeModelId(model) {
  const value = cleanText(model);
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('invalid Hugging Face model id');
  }
  return value;
}

function endpointForModel(model) {
  return HF_ROUTER_PREFIX + safeModelId(model);
}

function eventCandidateText(candidate = {}) {
  const parts = [
    candidate.name || candidate.event_name || candidate.title,
    candidate.artist || candidate.artists,
    candidate.venue,
    candidate.event_date_iso || candidate.start_date_iso || candidate.date || candidate.start_date,
    candidate.source_text || candidate.text || candidate.caption,
    candidate.hashtags
  ];
  return boundedText(parts
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(cleanText)
    .filter(Boolean)
    .join(' | '));
}

function embeddingInput(text, model) {
  const clean = boundedText(text);
  if (!clean) return '';
  return /e5/i.test(cleanText(model)) ? `query: ${clean}` : clean;
}

function exactIsoDate(candidate = {}) {
  const values = [
    candidate.event_date_iso,
    candidate.start_date_iso,
    candidate.date,
    candidate.start_date
  ].map(cleanText).filter(Boolean);
  for (const value of values) {
    const match = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (match) return match[1];
  }
  return '';
}

function hardIdentityConflict(left = {}, right = {}) {
  const leftShow = cleanText(left.show_id);
  const rightShow = cleanText(right.show_id);
  if (leftShow && rightShow && leftShow !== rightShow) return 'SHOW_ID_MISMATCH';

  const leftDate = exactIsoDate(left);
  const rightDate = exactIsoDate(right);
  if (leftDate && rightDate && leftDate !== rightDate) return 'EVENT_DATE_MISMATCH';

  return '';
}

function assistConfidence(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'UNKNOWN';
  if (value >= 0.75) return 'HIGH';
  if (value >= 0.55) return 'MEDIUM';
  return 'LOW';
}

function isEnabled(env = process.env) {
  return String(env.HF_EVENT_ASSIST_ENABLED || '').toLowerCase() === 'true';
}

function configuredToken(env = process.env) {
  return cleanText(env.HF_TOKEN);
}

function redactSecret(value, secret = '') {
  let text = String(value == null ? '' : value);
  const token = String(secret || '');
  if (token) text = text.split(token).join('[REDACTED]');
  return text.replace(/Bearer\s+[^\s"'\x60,;]+/gi, 'Bearer [REDACTED]');
}

function skipped(reason) {
  return {
    status: 'SKIPPED',
    reason,
    authoritative: false,
    production_writes: 0
  };
}

async function hfJsonRequest({
  token,
  model,
  payload,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
}) {
  if (!token) throw new Error('HF token is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) {
    throw new Error('timeoutMs must be between 500 and 30000');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(endpointForModel(model), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'kk-phone-rental-hf-event-assist/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const contentLength = Number(response.headers && response.headers.get && response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    throw new Error('Hugging Face response exceeds size limit');
  }

  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > maxResponseBytes) {
    throw new Error('Hugging Face response exceeds size limit');
  }

  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_) {
    throw new Error(`Hugging Face returned non-JSON HTTP ${response.status}`);
  }

  if (!response.ok) {
    const remote = redactSecret(cleanText(parsed && (parsed.error || parsed.message)), token);
    throw new Error(`Hugging Face HTTP ${response.status}${remote ? `: ${remote}` : ''}`);
  }
  return parsed;
}

function normalizeZeroShot(output) {
  if (!Array.isArray(output)) throw new Error('invalid zero-shot response');
  return output
    .map(item => {
      const raw = cleanText(item && item.label).toLowerCase().replace(/_/g, ' ');
      const label = ZERO_SHOT_LABEL_MAP[raw] || raw.toUpperCase().replace(/\\s+/g, '_');
      return { label, score: Number(item && item.score) };
    })
    .filter(item => EVENT_LABELS.includes(item.label) && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
}

async function classifyEventCandidate(candidate, options = {}) {
  const env = options.env || process.env;
  if (!isEnabled(env)) return skipped('HF_EVENT_ASSIST_DISABLED');
  const token = options.token || configuredToken(env);
  if (!token) return skipped('HF_TOKEN_MISSING');

  const input = eventCandidateText(candidate);
  if (!input) return skipped('EMPTY_CANDIDATE');
  const model = options.model || env.HF_ZERO_SHOT_MODEL || DEFAULT_ZERO_SHOT_MODEL;
  const output = await hfJsonRequest({
    token,
    model,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    payload: {
      inputs: input,
      parameters: {
        candidate_labels: Object.keys(ZERO_SHOT_LABEL_MAP),
        hypothesis_template: 'This is a {} event.',
        multi_label: false
      }
    }
  });
  const ranked = normalizeZeroShot(output);
  if (!ranked.length) throw new Error('zero-shot response contained no accepted event labels');

  return {
    status: 'ASSISTED',
    task: 'ZERO_SHOT_EVENT_CLASSIFICATION',
    model,
    top_label: ranked[0].label,
    top_score: ranked[0].score,
    confidence_band: assistConfidence(ranked[0].score),
    ranked,
    authoritative: false,
    verifier_required: true,
    production_writes: 0
  };
}

function normalizeEmbeddingOutput(output, expectedRows) {
  if (!Array.isArray(output) || output.length !== expectedRows) {
    throw new Error('invalid embedding response row count');
  }
  const rows = output.map(row => {
    if (!Array.isArray(row) || !row.length || row.some(v => !Number.isFinite(Number(v)))) {
      throw new Error('invalid embedding vector');
    }
    return row.map(Number);
  });
  const dims = new Set(rows.map(row => row.length));
  if (dims.size !== 1) throw new Error('embedding dimensions do not match');
  return rows;
}

async function embedEventCandidates(candidates, options = {}) {
  const env = options.env || process.env;
  if (!isEnabled(env)) return skipped('HF_EVENT_ASSIST_DISABLED');
  const token = options.token || configuredToken(env);
  if (!token) return skipped('HF_TOKEN_MISSING');
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 64) {
    throw new Error('candidates must contain 1..64 items');
  }

  const rawInputs = candidates.map(eventCandidateText);
  if (rawInputs.some(x => !x)) throw new Error('all candidates require non-empty text');
  const model = options.model || env.HF_EMBED_MODEL || DEFAULT_EMBED_MODEL;
  const inputs = rawInputs.map(text => embeddingInput(text, model));
  const output = await hfJsonRequest({
    token,
    model,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    payload: {
      inputs,
      normalize: true,
      truncate: true,
      truncation_direction: 'right'
    }
  });

  return {
    status: 'ASSISTED',
    task: 'EVENT_EMBEDDING',
    model,
    vectors: normalizeEmbeddingOutput(output, inputs.length),
    authoritative: false,
    verifier_required: true,
    production_writes: 0
  };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    throw new Error('vectors must have the same non-zero dimension');
  }
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('vector contains non-numeric value');
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  if (aa === 0 || bb === 0) return 0;
  return dot / (Math.sqrt(aa) * Math.sqrt(bb));
}

function duplicatePairs(candidates, vectors, options = {}) {
  if (!Array.isArray(candidates) || !Array.isArray(vectors) || candidates.length !== vectors.length) {
    throw new Error('candidates/vectors length mismatch');
  }
  const threshold = Number(options.threshold == null ? DEFAULT_DUPLICATE_THRESHOLD : options.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('duplicate threshold must be between 0 and 1');
  }

  const pairs = [];
  const conflicts = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      if (similarity < threshold) continue;

      const conflict = hardIdentityConflict(candidates[i], candidates[j]);
      const item = {
        left_index: i,
        right_index: j,
        left_key: cleanText(candidates[i] && (candidates[i].candidate_id || candidates[i].show_id || candidates[i].name)),
        right_key: cleanText(candidates[j] && (candidates[j].candidate_id || candidates[j].show_id || candidates[j].name)),
        similarity: Number(similarity.toFixed(6))
      };

      if (conflict) {
        conflicts.push({
          ...item,
          conflict,
          disposition: 'SIMILAR_BUT_DISTINCT_IDENTITY_REQUIRES_VERIFIER'
        });
        continue;
      }

      pairs.push({
        ...item,
        disposition: 'POSSIBLE_DUPLICATE_REQUIRES_VERIFIER'
      });
    }
  }
  return {
    status: 'ASSISTED',
    task: 'EVENT_DEDUP_ASSIST',
    threshold,
    pairs,
    conflicts,
    authoritative: false,
    verifier_required: true,
    production_writes: 0
  };
}

module.exports = {
  DEFAULT_ZERO_SHOT_MODEL,
  DEFAULT_EMBED_MODEL,
  DEFAULT_DUPLICATE_THRESHOLD,
  EVENT_LABELS,
  ZERO_SHOT_LABEL_MAP,
  eventCandidateText,
  embeddingInput,
  exactIsoDate,
  hardIdentityConflict,
  assistConfidence,
  redactSecret,
  endpointForModel,
  isEnabled,
  classifyEventCandidate,
  embedEventCandidates,
  cosineSimilarity,
  duplicatePairs
};
