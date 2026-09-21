import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const REPOSITORY = "mikesd1995/kk-phone-rental-vercel";
const REPOSITORY_ID = "1234430283";
const REPOSITORY_OWNER = "mikesd1995";
const REPOSITORY_OWNER_ID = "270679422";
const WORKFLOW_REF =
  "mikesd1995/kk-phone-rental-vercel/.github/workflows/kk-external-witness-clock.yml@refs/heads/main";
const REF = "refs/heads/main";
const EVENT_NAME = "schedule";
const ISSUER = "https://token.actions.githubusercontent.com";
const PROJECT_REF = "zehlsagzrpromtfqqflt";
const FUNCTION_SLUG = "kk-runtime-ledger-github-witness";
const AUDIENCE =
  `https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_SLUG}`;
const VERSION = "kk-scanner-github-witness-v1";
const ROLE = "SCANNER";
const SOURCE = "GITHUB_ACTIONS_CRON";
const MODE = "WITNESS_ONLY";
const TOP_HOUR_BANGKOK =
  /^\d{4}-\d{2}-\d{2}T\d{2}:00:00\+07:00$/;
const MAX_RECEIVE_LAG_MS = 25 * 60 * 1000;
const MAX_ISSUED_SKEW_MS = 10 * 60 * 1000;

const JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
  { timeoutDuration: 3000 },
);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(status: number, code: string, authenticated = false) {
  return json(status, {
    ok: false,
    error_code: code,
    authenticated,
    witness_only: true,
    witness_writes: 0,
    business_writes: 0,
  });
}

function bearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function verifyGithubIdentity(token: string) {
  let unverified: Record<string, unknown>;
  try {
    unverified = decodeJwt(token);
  } catch {
    throw new Error("GITHUB_OIDC_TOKEN_MALFORMED");
  }
  if (String(unverified.iss || "") !== ISSUER) {
    throw new Error("GITHUB_OIDC_ISSUER_NOT_ALLOWED");
  }

  let verified;
  try {
    verified = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch {
    throw new Error("GITHUB_OIDC_VERIFY_FAILED");
  }

  const p = verified.payload;
  if (
    p.repository !== REPOSITORY ||
    String(p.repository_id || "") !== REPOSITORY_ID ||
    p.repository_owner !== REPOSITORY_OWNER ||
    String(p.repository_owner_id || "") !== REPOSITORY_OWNER_ID ||
    p.ref !== REF ||
    p.event_name !== EVENT_NAME ||
    p.workflow_ref !== WORKFLOW_REF
  ) {
    throw new Error("GITHUB_OIDC_CLAIMS_MISMATCH");
  }
  if (!/^[0-9a-f]{40}$/i.test(String(p.sha || ""))) {
    throw new Error("GITHUB_OIDC_SHA_INVALID");
  }
  if (!/^\d+$/.test(String(p.run_id || ""))) {
    throw new Error("GITHUB_OIDC_RUN_ID_INVALID");
  }
  if (!/^\d+$/.test(String(p.run_attempt || ""))) {
    throw new Error("GITHUB_OIDC_RUN_ATTEMPT_INVALID");
  }
  return p;
}

function occurrenceId(scheduledAt: string) {
  return `SCANNER|${scheduledAt}`;
}

function canonical(row: {
  trigger_version: string;
  role: string;
  occurrence_id: string;
  scheduled_at: string;
  issued_at: string;
  nonce: string;
  source: string;
}) {
  return [
    row.trigger_version,
    row.role,
    row.occurrence_id,
    row.scheduled_at,
    row.issued_at,
    row.nonce,
    row.source,
  ].join("\n");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.default === "string" ? parsed.default.trim() : "";
  } catch {
    return "";
  }
}

async function readTrigger(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!/^application\/json(?:;|$)/i.test(contentType)) {
    throw new Error("CONTENT_TYPE_INVALID");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  const version = String(body.version || "");
  const role = String(body.role || "");
  const source = String(body.source || "");
  const scheduledAt = String(body.scheduled_at || "");
  const issuedAt = String(body.issued_at || "");
  const occurrence = String(body.occurrence_id || "");

  if (version !== VERSION) throw new Error("TRIGGER_VERSION_INVALID");
  if (role !== ROLE) throw new Error("TRIGGER_ROLE_INVALID");
  if (source !== SOURCE) throw new Error("TRIGGER_SOURCE_INVALID");
  if (!TOP_HOUR_BANGKOK.test(scheduledAt)) {
    throw new Error("TRIGGER_SCHEDULE_INVALID");
  }
  if (occurrence !== occurrenceId(scheduledAt)) {
    throw new Error("TRIGGER_OCCURRENCE_ID_INVALID");
  }

  const scheduledMs = Date.parse(scheduledAt);
  const issuedMs = Date.parse(issuedAt);
  const nowMs = Date.now();
  if (Number.isNaN(scheduledMs)) throw new Error("TRIGGER_SCHEDULE_INVALID");
  if (Number.isNaN(issuedMs)) throw new Error("TRIGGER_ISSUED_AT_INVALID");
  if (nowMs - scheduledMs < -5 * 60 * 1000 ||
      nowMs - scheduledMs > MAX_RECEIVE_LAG_MS) {
    throw new Error("TRIGGER_SCHEDULE_STALE");
  }
  if (Math.abs(nowMs - issuedMs) > MAX_ISSUED_SKEW_MS) {
    throw new Error("TRIGGER_ISSUED_AT_STALE");
  }

  return { version, role, source, scheduledAt, issuedAt, occurrence };
}

async function recordExpectation(row: Record<string, unknown>) {
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = secretKey();
  if (!url || !key) {
    throw new Error("SUPABASE_INTERNAL_CREDENTIALS_MISSING");
  }

  let response: Response;
  try {
    response = await fetch(
      `${url}/rest/v1/kk_runtime_expectations?on_conflict=occurrence_id`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify([row]),
        signal: AbortSignal.timeout(3000),
      },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("LEDGER_WRITE_TIMEOUT");
    }
    throw new Error("LEDGER_WRITE_TRANSPORT_FAILED");
  }
  if (!response.ok) throw new Error("LEDGER_WRITE_FAILED");
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("LEDGER_RESPONSE_INVALID");
  return body.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");

  const token = bearer(req);
  if (!token) return fail(401, "GITHUB_OIDC_TOKEN_MISSING");

  let identity;
  try {
    identity = await verifyGithubIdentity(token);
  } catch (err) {
    return fail(401, err instanceof Error ? err.message : "GITHUB_OIDC_VERIFY_FAILED");
  }

  let trigger;
  try {
    trigger = await readTrigger(req);
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : "TRIGGER_INVALID", true);
  }

  const runId = String(identity.run_id);
  const runAttempt = String(identity.run_attempt);
  const nonce =
    `gh-${runId}-${runAttempt}-${trigger.scheduledAt.replace(/[^0-9]/g, "")}`;
  const row = {
    occurrence_id: trigger.occurrence,
    role: ROLE,
    scheduled_at: trigger.scheduledAt,
    issued_at: trigger.issuedAt,
    source: SOURCE,
    trigger_version: VERSION,
    nonce,
    payload_hash: "",
    status: "EXPECTED",
    mode: MODE,
  };
  row.payload_hash = await sha256Hex(canonical(row));

  let inserted = false;
  try {
    inserted = await recordExpectation(row);
  } catch (err) {
    return fail(503, err instanceof Error ? err.message : "LEDGER_WRITE_FAILED", true);
  }

  return json(202, {
    ok: true,
    authenticated: true,
    witness_only: true,
    occurrence_id: row.occurrence_id,
    ledger_inserted: inserted,
    idempotent_duplicate: !inserted,
    witness_writes: inserted ? 1 : 0,
    scanner_execution_started: false,
    business_writes: 0,
  });
});
