'use strict';

const path = require('path');
const Analysis = require('./kk-csv-analysis-agent.js');

const ADAPTER_VERSION = 'KK_OPENAI_AGENTS_ADAPTER_V1';
const INLINE_LIMIT_BYTES = 5 * 1024 * 1024;
const REQUIRED = Object.freeze({
  report_pdf: 'report.pdf',
  findings_json: 'findings.json',
  bundle_zip: 'results.zip'
});

function codedError(code, message, details = {}) {
  return Object.assign(new Error(message || code), { code, ...details });
}

async function resolveClient(options = {}) {
  if (options.client) return options.client;
  const apiKey = String(options.apiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw codedError('OPENAI_API_KEY_MISSING', 'OPENAI_API_KEY is required');
  try {
    const mod = await import('openai');
    const OpenAI = mod.default || mod.OpenAI;
    if (typeof OpenAI !== 'function') {
      throw codedError('OPENAI_SDK_INVALID', 'OpenAI SDK client export not found');
    }
    return new OpenAI({ apiKey });
  } catch (error) {
    if (error?.code && String(error.code).startsWith('OPENAI_')) throw error;
    throw codedError('OPENAI_SDK_UNAVAILABLE', 'OpenAI SDK is unavailable', {
      cause_code: String(error?.code || error?.name || 'ERROR')
    });
  }
}

async function environmentFileFor(request, client, options = {}) {
  if (request.csv_bytes.length <= INLINE_LIMIT_BYTES) {
    return {
      type: 'inline',
      path: '/workspace/input.csv',
      data: request.csv_bytes.toString('base64')
    };
  }

  const toFile = options.toFile || (() => {
    throw codedError(
      'OPENAI_LARGE_FILE_HELPER_MISSING',
      'CSV files above 5 MiB require the OpenAI SDK toFile helper'
    );
  });

  if (!client.files?.create) {
    throw codedError('OPENAI_FILES_API_UNAVAILABLE', 'OpenAI Files API is unavailable');
  }
  const uploadable = await toFile(request.csv_bytes, request.filename);
  const uploaded = await client.files.create({ file: uploadable, purpose: 'user_data' });
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

async function runOpenAIAgentsAnalysis(request, options = {}) {
  const client = await resolveClient(options);
  let toFile = options.toFile;
  if (!toFile && request.csv_bytes.length > INLINE_LIMIT_BYTES && !options.client) {
    try {
      const mod = await import('openai');
      toFile = mod.toFile;
    } catch (_) {
      toFile = null;
    }
  }
  const envFile = await environmentFileFor(request, client, { ...options, toFile });
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
  resolveClient,
  environmentFileFor,
  rootTurnFailure,
  artifactBytes,
  runOpenAIAgentsAnalysis
};
