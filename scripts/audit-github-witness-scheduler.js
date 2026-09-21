'use strict';

const TARGET_WORKFLOW = 'kk-external-witness-clock.yml';

function apiHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kk-phone-rental-witness-audit',
  };
}

async function githubGet(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: apiHeaders(token) });
  const text = await response.text();
  if (!response.ok) {
    const err = new Error('GITHUB_API_HTTP_' + response.status);
    err.status = response.status;
    err.body = text.slice(0, 300);
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

function classify(workflowState, totalScheduleRuns) {
  if (workflowState !== 'active') return 'WORKFLOW_NOT_ACTIVE';
  if (Number(totalScheduleRuns || 0) === 0) return 'WORKFLOW_ACTIVE_BUT_NO_SCHEDULE_RUNS';
  return 'SCHEDULE_RUNS_PRESENT';
}

function sanitizeRun(run) {
  return {
    id: run.id,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    head_branch: run.head_branch,
    head_sha: run.head_sha,
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

async function audit(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const repository = options.repository || process.env.GITHUB_REPOSITORY || '';
  const fetchImpl = options.fetchImpl || fetch;
  if (!token) throw new Error('GITHUB_TOKEN_MISSING');
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY_INVALID');

  const base = 'https://api.github.com/repos/' + repository;
  const [repoMeta, workflow, runs] = await Promise.all([
    githubGet(base, token, fetchImpl),
    githubGet(base + '/actions/workflows/' + encodeURIComponent(TARGET_WORKFLOW), token, fetchImpl),
    githubGet(base + '/actions/runs?event=schedule&per_page=20', token, fetchImpl),
  ]);

  const total = Number(runs.total_count || 0);
  return {
    ok: true,
    version: 'kk-witness-scheduler-audit-v1',
    repository,
    default_branch: repoMeta.default_branch || null,
    workflow: {
      id: workflow.id || null,
      name: workflow.name || null,
      path: workflow.path || null,
      state: workflow.state || null,
      created_at: workflow.created_at || null,
      updated_at: workflow.updated_at || null,
    },
    schedule_runs: {
      total_count: total,
      latest: Array.isArray(runs.workflow_runs) ? runs.workflow_runs.slice(0, 5).map(sanitizeRun) : [],
    },
    classification: classify(workflow.state, total),
    authority: {
      witness_credit_granted: false,
      manual_dispatch_performed: false,
      production_writes: 0,
      business_writes: 0,
    },
  };
}

async function main() {
  const report = await audit();
  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + '\n');
  if (process.env.REPORT_PATH) {
    require('node:fs').writeFileSync(process.env.REPORT_PATH, json + '\n', 'utf8');
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(JSON.stringify({
      ok: false,
      version: 'kk-witness-scheduler-audit-v1',
      error_code: String(err && err.message || err),
      production_writes: 0,
      business_writes: 0,
    }) + '\n');
    process.exit(1);
  });
}

module.exports = { TARGET_WORKFLOW, apiHeaders, githubGet, classify, sanitizeRun, audit };
