'use strict';

const RuntimeLedger = require('./runtime-ledger.js');
const VercelOidcBridge = require('./runtime-ledger-oidc-bridge.js');
const GithubOidcBridge = require('./kk-project-memory-github-oidc-bridge.js');

const TABLE = 'kk_agent_invocations';
const VALID_GATE_STATUSES = new Set(['READY_FOR_OWNER_REVIEW','RECORDED','BLOCKED_CONTENT_GATE','BLOCKED_REQUIRED_AGENT_NOT_INVOKED','BLOCKED_LEDGER_UNAVAILABLE','BLOCKED_RUNTIME_NOT_AVAILABLE','BLOCKED_AGENT_EXECUTION_FAILED']);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function boolValue(value) {
  return ['1', 'true', 'yes', 'on'].includes(text(value).toLowerCase());
}

function enabledState(env = process.env) {
  const explicit = text(env.KK_AGENT_INVOCATION_LEDGER_ENABLED);
  if (explicit) return boolValue(explicit);
  return boolValue(env.KK_RUNTIME_LEDGER_ENABLED) ||
    text(env.VERCEL_ENV).toLowerCase() === 'production' ||
    (text(env.GITHUB_ACTIONS).toLowerCase() === 'true' && boolValue(env.KK_AGENT_INVOCATION_GITHUB_OIDC_ENABLED));
}

function configState(env = process.env) {
  const url = text(env.SUPABASE_URL).replace(/\/+$/, '');
  const serverKey = RuntimeLedger.resolveServerKey(env);
  const expectedProjectRef = text(
    env.KK_AGENT_LEDGER_PROJECT_REF || env.KK_RUNTIME_LEDGER_PROJECT_REF
  ).toLowerCase();
  const actualProjectRef = RuntimeLedger.projectRefFromUrl(url);
  const enabled = enabledState(env);
  const projectBindingMatches =
    !!expectedProjectRef && !!actualProjectRef && expectedProjectRef === actualProjectRef;
  const directConfigured = enabled && !!url && !!serverKey.value && projectBindingMatches;
  const vercelOidcCandidate = enabled && !directConfigured && text(env.VERCEL_ENV).toLowerCase() === 'production';
  const githubOidcCandidate = enabled && !directConfigured && !vercelOidcCandidate &&
    text(env.GITHUB_ACTIONS).toLowerCase() === 'true' && boolValue(env.KK_AGENT_INVOCATION_GITHUB_OIDC_ENABLED);

  return {
    enabled,
    configured: directConfigured || vercelOidcCandidate || githubOidcCandidate,
    direct_configured: directConfigured,
    vercel_oidc_candidate: vercelOidcCandidate,
    github_oidc_candidate: githubOidcCandidate,
    mode: directConfigured ? 'direct' : (vercelOidcCandidate ? 'vercel_oidc' : (githubOidcCandidate ? 'github_oidc' : 'disabled')),
    url_configured: !!url,
    server_key_configured: !!serverKey.value,
    key_mode: serverKey.mode,
    project_ref_configured: !!expectedProjectRef,
    project_binding_matches: projectBindingMatches,
    table: TABLE
  };
}

function headers(env) {
  const key = RuntimeLedger.resolveServerKey(env).value;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

function validHash(value) {
  return /^[0-9a-f]{64}$/.test(text(value));
}

function normalizeAgentList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(item => text(item))
      .filter(Boolean)
  )];
}

function validateRow(row = {}) {
  const errors = [];
  if (!/^agi_[A-Za-z0-9_-]{16,96}$/.test(text(row.invocation_id))) errors.push('INVOCATION_ID_INVALID');
  if (!/^[A-Z0-9_]{3,96}$/.test(text(row.request_type))) errors.push('REQUEST_TYPE_INVALID');
  if (!/^[a-z0-9_]{3,64}$/.test(text(row.intent))) errors.push('INTENT_INVALID');
  if (!validHash(row.request_hash)) errors.push('REQUEST_HASH_INVALID');
  if (!validHash(row.truth_hash)) errors.push('TRUTH_HASH_INVALID');
  if (!VALID_GATE_STATUSES.has(text(row.gate_status))) {
    errors.push('GATE_STATUS_INVALID');
  }
  if (Number(row.production_writes || 0) !== 0) errors.push('PRODUCTION_WRITES_NONZERO');
  if (Number(row.publishes || 0) !== 0) errors.push('PUBLISHES_NONZERO');
  const required = normalizeAgentList(row.required_agents);
  const invoked = normalizeAgentList(row.invoked_agents);
  if (!required.length) errors.push('REQUIRED_AGENTS_EMPTY');
  return { errors, required_agents: required, invoked_agents: invoked };
}

async function recordInvocation({
  env = process.env,
  fetchImpl = global.fetch,
  row
} = {}) {
  const cfg = configState(env);
  if (!cfg.enabled) {
    throw Object.assign(new Error('agent invocation ledger is disabled'), {
      code: 'AGENT_INVOCATION_LEDGER_DISABLED'
    });
  }
  if (!cfg.configured) {
    throw Object.assign(new Error('agent invocation ledger is not configured'), {
      code: 'AGENT_INVOCATION_LEDGER_NOT_CONFIGURED'
    });
  }
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('fetch implementation unavailable'), {
      code: 'AGENT_INVOCATION_LEDGER_FETCH_UNAVAILABLE'
    });
  }

  const check = validateRow(row);
  if (check.errors.length) {
    const error = Object.assign(new Error('agent invocation row invalid'), {
      code: 'AGENT_INVOCATION_ROW_INVALID',
      blockers: check.errors
    });
    throw error;
  }

  const payload = {
    invocation_id: text(row.invocation_id),
    request_type: text(row.request_type),
    intent: text(row.intent),
    route_id: text(row.route_id),
    required_agents: check.required_agents,
    invoked_agents: check.invoked_agents,
    agent_versions: row.agent_versions && typeof row.agent_versions === 'object' ? row.agent_versions : {},
    registry_version: text(row.registry_version),
    gateway_version: text(row.gateway_version),
    gate_status: text(row.gate_status),
    blocked_reason: text(row.blocked_reason),
    content_gate: text(row.content_gate),
    request_hash: text(row.request_hash),
    truth_hash: text(row.truth_hash),
    source_commit_sha: text(row.source_commit_sha),
    owner_review_required: row.owner_review_required === true,
    production_writes: 0,
    publishes: 0
  };

  if (!cfg.direct_configured) {
    const remote = cfg.vercel_oidc_candidate
      ? await VercelOidcBridge.writeAgentInvocation({row:payload,fetchImpl})
      : await GithubOidcBridge.writeAgentInvocation({env,row:payload,fetchImpl});
    if (!remote || remote.ok !== true) {
      throw Object.assign(new Error('agent invocation OIDC ledger write failed'), {
        code: remote && remote.error_code || 'AGENT_INVOCATION_OIDC_WRITE_FAILED'
      });
    }
    return {
      ok:true,
      inserted:remote.inserted===true,
      idempotent_duplicate:remote.idempotent_duplicate===true,
      invocation_id:payload.invocation_id,
      mode:cfg.mode
    };
  }

  const endpoint = `${text(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/${TABLE}?on_conflict=invocation_id`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      ...headers(env),
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation'
    },
    body: JSON.stringify([payload])
  });
  const body = await parseJsonSafe(response);
  if (!response.ok) {
    const error = Object.assign(new Error('agent invocation ledger write failed'), {
      code: 'AGENT_INVOCATION_LEDGER_WRITE_FAILED',
      status: response.status
    });
    if (body && typeof body === 'object') error.remote_code = body.code || '';
    throw error;
  }

  const inserted = Array.isArray(body) && body.length > 0;
  return {
    ok: true,
    inserted,
    idempotent_duplicate: !inserted,
    invocation_id: payload.invocation_id
  };
}

async function listRecentInvocations({
  env = process.env,
  fetchImpl = global.fetch,
  limit = 20
} = {}) {
  const cfg = configState(env);
  if (!cfg.enabled || !cfg.configured) {
    throw Object.assign(new Error('agent invocation ledger unavailable'), {
      code: cfg.enabled ? 'AGENT_INVOCATION_LEDGER_NOT_CONFIGURED' : 'AGENT_INVOCATION_LEDGER_DISABLED'
    });
  }
  const safeLimit = Math.max(1, Math.min(Number.isInteger(Number(limit)) ? Number(limit) : 20, 100));
  if (!cfg.direct_configured) {
    if (!cfg.vercel_oidc_candidate) {
      throw Object.assign(new Error('agent invocation ledger read unavailable in GitHub OIDC mode'), {code:'AGENT_INVOCATION_LEDGER_READ_NOT_SUPPORTED'});
    }
    const remote=await VercelOidcBridge.readAgentInvocations({limit:safeLimit,fetchImpl});
    if(!remote||remote.ok!==true)throw Object.assign(new Error('agent invocation OIDC ledger read failed'),{code:remote&&remote.error_code||'AGENT_INVOCATION_OIDC_READ_FAILED'});
    return {ok:true,rows:remote.rows,mode:cfg.mode};
  }
  const params = new URLSearchParams({
    select: 'invocation_id,occurred_at,request_type,intent,route_id,required_agents,invoked_agents,agent_versions,registry_version,gateway_version,gate_status,blocked_reason,content_gate,source_commit_sha,owner_review_required,production_writes,publishes',
    order: 'occurred_at.desc',
    limit: String(safeLimit)
  });
  const endpoint = `${text(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/${TABLE}?${params.toString()}`;
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      ...headers(env),
      Accept: 'application/json'
    }
  });
  const body = await parseJsonSafe(response);
  if (!response.ok || !Array.isArray(body)) {
    throw Object.assign(new Error('agent invocation ledger read failed'), {
      code: 'AGENT_INVOCATION_LEDGER_READ_FAILED',
      status: response.status
    });
  }
  return { ok: true, rows: body };
}

module.exports = {
  TABLE,
  VALID_GATE_STATUSES,
  configState,
  validateRow,
  recordInvocation,
  listRecentInvocations
};
