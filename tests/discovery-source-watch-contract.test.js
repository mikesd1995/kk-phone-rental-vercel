'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Watch = require('../server/discovery-source-watch-contract');

function hash(value) {
  return Watch.sha256(value);
}

function observation(overrides = {}) {
  return {
    observation_id: 'OBS-20260920-001',
    provider: 'CHANGEDETECTION_IO',
    source_tier: 'OFFICIAL',
    state: 'CHANGED',
    source_url: 'https://example.com/events',
    observed_at: '2026-09-20T03:30:00+07:00',
    previous_content_hash: hash('before'),
    content_hash: hash('after'),
    change_id: 'change-001',
    evidence_ref: 'evidence://change-001',
    source_label: 'Example official events',
    ...overrides
  };
}

function discoveryResult(overrides = {}) {
  return {
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    candidates: [
      {
        candidate_id: 'CAND-001',
        title: 'Example Concert',
        event_date: '2026-10-10',
        venue: 'Example Hall',
        artist: ['Artist A'],
        source_url: 'https://example.com/events/example-concert',
        confidence: 0.94
      }
    ],
    ...overrides
  };
}

const NOW = Date.parse('2026-09-20T04:00:00+07:00');

test('unchanged source skips downstream discovery entirely', async () => {
  let calls = 0;
  const same = hash('same-content');
  const result = await Watch.runGuardedDiscovery(
    observation({
      state: 'UNCHANGED',
      content_hash: same,
      previous_content_hash: same
    }),
    {
      nowMs: NOW,
      discoverFn: async () => {
        calls++;
        return discoveryResult();
      }
    }
  );

  assert.equal(result.status, 'NO_CHANGE');
  assert.equal(result.discovery_call_attempted, false);
  assert.equal(result.discovery_call_count, 0);
  assert.equal(calls, 0);
  assert.equal(result.production_writes, 0);
});

test('changed official source allows exactly one staging-only discovery call', async () => {
  let calls = 0;
  const result = await Watch.runGuardedDiscovery(observation(), {
    nowMs: NOW,
    discoverFn: async checked => {
      calls++;
      assert.equal(checked.provider, 'CHANGEDETECTION_IO');
      return discoveryResult();
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.status, 'DISCOVERY_STAGING_HANDOFF_PREPARED');
  assert.equal(result.discovery_call_count, 1);
  assert.equal(result.handoff.handoff_state, 'DISCOVERY_STAGING_ONLY');
  assert.equal(result.handoff.route, 'EXISTING_SCANNER_STAGING_TO_VERIFIER');
  assert.equal(result.handoff.authoritative, false);
  assert.equal(result.handoff.verifier_required, true);
  assert.equal(result.handoff.production_writes, 0);
  assert.equal(result.handoff.direct_business_write_allowed, false);
  assert.equal(result.handoff.direct_notification_allowed, false);
});

test('new source detected by Exa can enter staging but remains nonauthoritative', async () => {
  const result = await Watch.runGuardedDiscovery(
    observation({
      provider: 'EXA',
      state: 'NEW',
      previous_content_hash: null
    }),
    {
      nowMs: NOW,
      discoverFn: async () => discoveryResult()
    }
  );

  assert.equal(result.status, 'DISCOVERY_STAGING_HANDOFF_PREPARED');
  assert.equal(result.handoff.source_provider, 'EXA');
  assert.equal(result.handoff.authoritative, false);
  assert.equal(result.handoff.verifier_required, true);
});

test('http or credential-bearing source URL is rejected before discovery', async () => {
  let calls = 0;
  for (const source_url of [
    'http://example.com/events',
    'https://user:pass@example.com/events'
  ]) {
    const result = await Watch.runGuardedDiscovery(
      observation({ source_url }),
      {
        nowMs: NOW,
        discoverFn: async () => {
          calls++;
          return discoveryResult();
        }
      }
    );
    assert.equal(result.status, 'BLOCKED_INVALID_OBSERVATION');
    assert.ok(result.preflight.blockers.includes('SOURCE_URL_MUST_BE_HTTPS'));
  }
  assert.equal(calls, 0);
});

test('unsupported provider or source tier fails closed', async () => {
  let calls = 0;
  const result = await Watch.runGuardedDiscovery(
    observation({ provider: 'UNKNOWN_CRAWLER', source_tier: 'UNTRUSTED' }),
    {
      nowMs: NOW,
      discoverFn: async () => {
        calls++;
        return discoveryResult();
      }
    }
  );

  assert.equal(result.status, 'BLOCKED_INVALID_OBSERVATION');
  assert.ok(result.preflight.blockers.includes('PROVIDER_NOT_ALLOWED'));
  assert.ok(result.preflight.blockers.includes('SOURCE_TIER_NOT_ALLOWED'));
  assert.equal(calls, 0);
});

test('changed observation requires two distinct valid hashes', async () => {
  let calls = 0;
  const same = hash('same');
  const result = await Watch.runGuardedDiscovery(
    observation({ previous_content_hash: same, content_hash: same }),
    {
      nowMs: NOW,
      discoverFn: async () => {
        calls++;
        return discoveryResult();
      }
    }
  );

  assert.equal(result.status, 'BLOCKED_INVALID_OBSERVATION');
  assert.ok(result.preflight.blockers.includes('CHANGED_HASH_NOT_DIFFERENT'));
  assert.equal(calls, 0);
});

test('stale observation cannot trigger discovery', async () => {
  let calls = 0;
  const result = await Watch.runGuardedDiscovery(
    observation({ observed_at: '2026-09-01T03:30:00+07:00' }),
    {
      nowMs: NOW,
      discoverFn: async () => {
        calls++;
        return discoveryResult();
      }
    }
  );

  assert.equal(result.status, 'BLOCKED_INVALID_OBSERVATION');
  assert.ok(result.preflight.blockers.includes('OBSERVATION_STALE'));
  assert.equal(calls, 0);
});

test('discovery result attempting final authority is rejected', async () => {
  const result = await Watch.runGuardedDiscovery(observation(), {
    nowMs: NOW,
    discoverFn: async () => discoveryResult({
      authoritative: true,
      verified: true,
      sheet_write: true
    })
  });

  assert.equal(result.status, 'DISCOVERY_RESULT_REJECTED');
  assert.ok(result.blockers.includes('DISCOVERY_RESULT_MUST_BE_NONAUTHORITATIVE'));
  assert.ok(result.blockers.includes('DISCOVERY_RESULT_FORBIDDEN_AUTHORITY_FIELD:verified'));
  assert.ok(result.blockers.includes('DISCOVERY_RESULT_FORBIDDEN_AUTHORITY_FIELD:sheet_write'));
  assert.equal(result.handoff, null);
  assert.equal(result.production_writes, 0);
});

test('provider failure produces no staging handoff and no fabricated decision', async () => {
  const result = await Watch.runGuardedDiscovery(observation(), {
    nowMs: NOW,
    discoverFn: async () => {
      const error = new Error('provider down');
      error.code = 'UPSTREAM_503';
      throw error;
    }
  });

  assert.equal(result.status, 'DISCOVERY_PROVIDER_UNAVAILABLE_NONAUTHORITATIVE');
  assert.equal(result.discovery_call_count, 1);
  assert.equal(result.handoff, null);
  assert.equal(result.authoritative, false);
  assert.equal(result.production_writes, 0);
  assert.equal(result.final_truth_mutation, false);
  assert.equal(result.notification_sends, 0);
});

test('candidate count is bounded before staging handoff', async () => {
  const candidates = Array.from({ length: 101 }, (_, index) => ({
    candidate_id: 'CAND-' + index
  }));
  const result = await Watch.runGuardedDiscovery(observation(), {
    nowMs: NOW,
    discoverFn: async () => discoveryResult({ candidates })
  });

  assert.equal(result.status, 'DISCOVERY_RESULT_REJECTED');
  assert.ok(result.blockers.includes('DISCOVERY_RESULT_CANDIDATE_BOUND_EXCEEDED'));
});

test('source-watch contract is staged and not imported by production entrypoints', () => {
  const root = path.resolve(__dirname, '..');
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }

  walk(path.join(root, 'api'));
  walk(path.join(root, 'admin'));
  files.push(path.join(root, 'script.js'));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('discovery-source-watch-contract'),
      false,
      'production entrypoint imports staged discovery source-watch contract: ' +
        path.relative(root, file)
    );
  }
});
