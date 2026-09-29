'use strict';

const path = require('path');
const Analysis = require('./kk-csv-analysis-agent.js');

const ADAPTER_VERSION = 'KK_OPENAI_AGENTS_REST_ADAPTER_V2';
const INLINE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const REQUIRED = Object.freeze({
  report_pdf: 'report.pdf',
  findings_json: 'findings.json',
  bundle_zip: 'results.zip'
});

function codedError(code, message, details = {}) {
  return Object.assign(new Error(message || code), { code, ...details });
}

async function ensureOk(response, codePrefix = 'OPENAI_API_HTTP') {
  if (response?.ok) return response;
  const status = Number(response?.status || 0);
  let body = '';
  try {
    body = String(await response.text()).slice(0, 1000);
  } catch (_) {
    body = '';
  }
  throw codedError(`${codePrefix}_${status || 'ERROR'}`, `OpenAI API request failed with HTTP ${status || 'unknown'}`, {
    http_status: status,
    response_excerpt: body
  });
}

async function* parseSse(response) {
  await ensureOk(response, 'OPENAI_AGENT_STREAM_HTTP');
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw codedError('OPENAI_AGENT_STREAM_BODY_MISSING', 'Agent stream response has no readable body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n')
        .trim();
      if (data && data !== '[DONE]') {
        try {
          yield JSON.parse(data);
        } catch (_) {
          throw codedError('OPENAI_AGENT_STREAM_JSON_INVALID', 'Agent stream contained invalid JSON');
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  const tail = buffer.trim();
  if (tail) {
    const data = tail
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (data && data !== '[DONE]') {
      try {
        yield JSON.parse(data);
      } catch (_) {
        throw codedError('OPENAI_AGENT_STREAM_JSON_INVALID', 'Agent stream contained invalid trailing JSON');
      }
    }
  }
}

function createFetchAgentsClient(options = {}) {
  const apiKey = String(options.apiKey || '').trim();
  const fetchImpl = options.fetchImpl || global.fetch;
  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  if (!apiKey) throw codedError('OPENAI_API_KEY_MISSING', 'OPENAI_API_KEY is required');
  if (typeof fetchImpl !== 'function') {
    throw codedError('OPENAI_FETCH_UNAVAILABLE', 'A fetch implementation is required');
  }

  function headers(json = true) {
    const out = {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'agents=v1'
    };
    if (json) out['Content-Type'] = 'application/json';
    return out;
  }

  async function jsonRequest(url, init) {
    const response = await fetchImpl(url, init);
    await ensureOk(response);
    try {
      return await response.json();
    } catch (_) {
      throw codedError('OPENAI_API_JSON_INVALID', 'OpenAI API returned invalid JSON');
    }
  }

  const client = {
    __kk_native_rest: true,
    files: {
      create: async spec => {
        const form = new FormData();
        const purpose = String(spec?.purpose || 'user_data');
        const filename = String(spec?.filename || 'input.csv');
        const file = spec?.file;
        const blob = file instanceof Blob
          ? file
          : new Blob([file], { type: 'text/csv' });
        form.append('purpose', purpose);
        form.append('file', blob, filename);
        return jsonRequest(`${baseUrl}/files`, {
          method: 'POST',
          headers: headers(false),
          body: form
        });
      }
    },
    beta: {
      agents: {
        sessions: {
          create: async args => {
            const response = await fetchImpl(`${baseUrl}/agents/sessions`, {
              method: 'POST',
              headers: headers(true),
              body: JSON.stringify(args)
            });
            if (args?.stream === true) return parseSse(response);
            await ensureOk(response);
            return response.json();
          },
          artifacts: {
            list: sessionId => ({
              async *[Symbol.asyncIterator]() {
                let after = '';
                do {
                  const suffix = after ? `?after=${encodeURIComponent(after)}` : '';
                  const page = await jsonRequest(
                    `${baseUrl}/agents/sessions/${encodeURIComponent(sessionId)}/artifacts${suffix}`,
                    { method: 'GET', headers: headers(false) }
                  );
                  const rows = Array.isArray(page?.data) ? page.data : [];
                  for (const artifact of rows) yield artifact;
                  if (!page?.has_more || rows.length === 0) break;
                  after = String(page.last_id || rows[rows.length - 1]?.id || '').trim();
                  if (!after) break;
                } while (true);
              }
            }),
            content: async (artifactId, params = {}) => {
              const sessionId = String(params.session_id || '').trim();
              if (!sessionId) {
                throw codedError('OPENAI_ARTIFACT_SESSION_ID_MISSING', 'session_id is required');
              }
              const response = await fetchImpl(
                `${baseUrl}/agents/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/content`,
                { method: 'GET', headers: headers(false) }
              );
              return ensureOk(response, 'OPENAI_ARTIFACT_HTTP');
            }
          }
        }
      }
    }
  };
  return client;
}

async function resolveClient(options = {}) {
  if (options.client) return options.client;
  const apiKey = String(options.apiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw codedError('OPENAI_API_KEY_MISSING', 'OPENAI_API_KEY is required');
  return createFetchAgentsClient({
    apiKey,
    fetchImpl: options.fetchImpl || global.fetch,
    baseUrl: options.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL
  });
}

async function environmentFileFor(request, client, options = {}) {
  if (request.csv_bytes.length <= INLINE_LIMIT_BYTES) {
    return {
      type: 'inline',
      path: '/workspace/input.csv',
      data: request.csv_bytes.toString('base64')
    };
  }

  if (!client.files?.create) {
    throw codedError('OPENAI_FILES_API_UNAVAILABLE', 'OpenAI Files API is unavailable');
  }

  let uploaded;
  if (client.__kk_native_rest === true) {
    uploaded = await client.files.create({
      file: request.csv_bytes,
      filename: request.filename,
      purpose: 'user_data'
    });
  } else {
    const toFile = options.toFile;
    if (typeof toFile !== 'function') {
      throw codedError(
        'OPENAI_LARGE_FILE_HELPER_MISSING',
        'Injected SDK clients require a toFile helper for CSV files above 5 MiB'
      );
    }
    const uploadable = await toFile(request.csv_bytes, request.filename);
    uploaded = await client.files.create({ file: uploadable, purpose: 'user_data' });
  }

  if (!uploaded?.id) throw codedError('OPENAI_FILE_UPLOAD_FAILED', 'OpenAI file upload returned no id');
  return {
    type: 'file_id',
    file_id: uploaded.id,
    path: '/workspace/input.csv'
  };
}

function rootTurnFailure(event) {
  if (!event || typeof event !== 'object') return null;
  if (
    event.type === 'agent.session.failed' ||
    event.type === 'agent.session.environment.failed'
  ) {
    return codedError('OPENAI_AGENT_SESSION_FAILED', 'OpenAI agent session failed');
  }
  if (
    event.type === 'agent.session.turn.failed' &&
    (event.turn?.subagent_id === null || event.turn?.subagent_id === undefined)
  ) {
    return codedError('OPENAI_AGENT_TURN_FAILED', 'OpenAI root agent turn failed');
  }
  if (
    event.type === 'agent.session.turn.cancelled' &&
    (event.turn?.subagent_id === null || event.turn?.subagent_id === undefined)
  ) {
    return codedError('OPENAI_AGENT_TURN_CANCELLED', 'OpenAI root agent turn was cancelled');
  }
  return null;
}

async function artifactBytes(client, sessionId, artifactId) {
  const response = await client.beta.agents.sessions.artifacts.content(
    artifactId,
    { session_id: sessionId }
  );
  if (!response || typeof response.arrayBuffer !== 'function') {
    throw codedError('OPENAI_ARTIFACT_CONTENT_INVALID', 'Artifact content response is not readable');
  }
  return Buffer.from(await response.arrayBuffer());
}

function handleFor(artifact, sessionId, turnId) {
  return {
    artifact_id: artifact.id,
    session_id: sessionId,
    turn_id: turnId,
    path: artifact.path,
    size_bytes: Number(artifact.size_bytes || 0)
  };
}

async function downloadOpenAIAgentArtifact(handle, options = {}) {
  const artifactId = String(handle?.artifact_id || '').trim();
  const sessionId = String(handle?.session_id || '').trim();
  const artifactPath = String(handle?.path || '').trim();
  if (!artifactId || !sessionId || !artifactPath.startsWith('/workspace/outputs/')) {
    throw codedError('OPENAI_ARTIFACT_HANDLE_INVALID', 'Artifact handle is incomplete or outside /workspace/outputs');
  }
  const client = await resolveClient(options);
  const bytes = await artifactBytes(client, sessionId, artifactId);
  if (!bytes.length) throw codedError('ANALYSIS_ARTIFACT_EMPTY', 'Downloaded artifact is empty');
  return bytes;
}

async function runOpenAIAgentsAnalysis(request, options = {}) {
  const client = await resolveClient(options);
  const envFile = await environmentFileFor(request, client, options);
  const model = String(options.model || process.env.KK_CSV_ANALYSIS_MODEL || 'gpt-6-sol');
  const events = await client.beta.agents.sessions.create({
    agent: {
      model,
      instructions: Analysis.buildAgentInstructions(),
      reasoning: { effort: String(options.reasoningEffort || 'medium') }
    },
    environment: {
      type: 'openai_hosted',
      network: { access: 'disabled' },
      packages: {
        python: ['pandas', 'numpy', 'matplotlib', 'reportlab']
      },
      setup_commands: [
        { command: 'mkdir -p /workspace/outputs /workspace/work' }
      ],
      files: [envFile]
    },
    input: Analysis.buildAgentTask(request),
    stream: true
  });

  let sessionId = '';
  let turnId = '';
  for await (const event of events) {
    const failure = rootTurnFailure(event);
    if (failure) throw failure;
    if (event?.type === 'agent.session.created' && event.session?.id) {
      sessionId = String(event.session.id);
    }
    if (
      event?.type === 'agent.session.turn.completed' &&
      (event.turn?.subagent_id === null || event.turn?.subagent_id === undefined) &&
      event.turn?.id
    ) {
      turnId = String(event.turn.id);
    }
  }

  if (!sessionId) throw codedError('OPENAI_AGENT_SESSION_ID_MISSING', 'Agent stream returned no session id');
  if (!turnId) throw codedError('OPENAI_AGENT_ROOT_TURN_INCOMPLETE', 'Agent stream returned no completed root turn');

  const produced = [];
  for await (const artifact of client.beta.agents.sessions.artifacts.list(sessionId)) {
    if (String(artifact.turn_id || '') !== turnId) continue;
    if (!String(artifact.path || '').startsWith('/workspace/outputs/')) continue;
    if (Number(artifact.size_bytes || 0) <= 0) {
      throw codedError('ANALYSIS_ARTIFACT_EMPTY', `Artifact is empty: ${artifact.path}`);
    }
    produced.push(artifact);
  }

  const byName = new Map(produced.map(item => [path.posix.basename(item.path), item]));
  for (const name of Object.values(REQUIRED)) {
    if (!byName.has(name)) {
      throw codedError('ANALYSIS_ARTIFACTS_INCOMPLETE', `Missing required artifact: ${name}`);
    }
  }

  const findingsArtifact = byName.get(REQUIRED.findings_json);
  let findings;
  try {
    const bytes = await artifactBytes(client, sessionId, findingsArtifact.id);
    findings = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    if (error?.code && String(error.code).startsWith('OPENAI_')) throw error;
    throw codedError('FINDINGS_JSON_INVALID', 'findings.json could not be parsed');
  }

  const chartArtifacts = produced
    .filter(item => /^chart_\d{2}\.png$/i.test(path.posix.basename(item.path)))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    schema_version: 'KK_CSV_ANALYSIS_ENGINE_RESULT_V1',
    adapter_version: ADAPTER_VERSION,
    engine_mode: 'openai_agents',
    model,
    question: String(findings.question || request.question),
    answer: String(findings.answer || ''),
    dataset: findings.dataset,
    findings: Array.isArray(findings.findings) ? findings.findings : [],
    caveats: Array.isArray(findings.caveats) ? findings.caveats : [],
    charts: Array.isArray(findings.charts) ? findings.charts : [],
    artifacts: {
      report_pdf: REQUIRED.report_pdf,
      findings_json: REQUIRED.findings_json,
      charts: chartArtifacts.map(item => path.posix.basename(item.path)),
      bundle_zip: REQUIRED.bundle_zip
    },
    artifact_transport: 'openai_agents_artifacts',
    artifact_handles: {
      report_pdf: handleFor(byName.get(REQUIRED.report_pdf), sessionId, turnId),
      findings_json: handleFor(findingsArtifact, sessionId, turnId),
      charts: chartArtifacts.map(item => handleFor(item, sessionId, turnId)),
      bundle_zip: handleFor(byName.get(REQUIRED.bundle_zip), sessionId, turnId)
    },
    production_writes: 0,
    publishes: 0
  };
}

module.exports = {
  ADAPTER_VERSION,
  INLINE_LIMIT_BYTES,
  DEFAULT_BASE_URL,
  codedError,
  ensureOk,
  parseSse,
  createFetchAgentsClient,
  resolveClient,
  environmentFileFor,
  rootTurnFailure,
  artifactBytes,
  downloadOpenAIAgentArtifact,
  runOpenAIAgentsAnalysis
};
