import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const TEAM_SLUG = "mikesd1995s-projects";
const TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt";
const PROJECT_NAME = "kk-phone-rental-vercel";
const PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6";
const ENVIRONMENT = "production";

const EXPECTED_AUDIENCE = `https://vercel.com/${TEAM_SLUG}`;
const EXPECTED_SUBJECT =
  `owner:${TEAM_SLUG}:project:${PROJECT_NAME}:environment:${ENVIRONMENT}`;
const ALLOWED_ISSUERS = new Set([
  "https://oidc.vercel.com",
  `https://oidc.vercel.com/${TEAM_SLUG}`,
]);
const JWKS = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
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

function fail(status: number, code: string) {
  return json(status, {
    ok: false,
    error_code: code,
    authenticated: false,
    read_only: true,
    bounded_limit: 1,
    business_writes: 0,
  });
}

function bearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function validProbeRequest(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!/^application\/json(?:;|$)/i.test(contentType)) return false;
  try {
    const body = await req.json();
    return body?.probe === "runtime-ledger" && body?.version === "v1";
  } catch {
    return false;
  }
}

async function verifyVercelIdentity(token: string) {
  let unverified: Record<string, unknown>;
  try {
    unverified = decodeJwt(token);
  } catch {
    throw new Error("OIDC_TOKEN_MALFORMED");
  }
  const issuer = String(unverified.iss || "");
  if (!ALLOWED_ISSUERS.has(issuer)) {
    throw new Error("OIDC_ISSUER_NOT_ALLOWED");
  }

  let verified;
  try {
    verified = await jwtVerify(token, JWKS, {
      issuer,
      audience: EXPECTED_AUDIENCE,
      subject: EXPECTED_SUBJECT,
    });
  } catch {
    throw new Error("OIDC_VERIFY_FAILED");
  }

  const payload = verified.payload;
  if (
    payload.owner_id !== TEAM_ID ||
    payload.project_id !== PROJECT_ID ||
    payload.project !== PROJECT_NAME ||
    payload.environment !== ENVIRONMENT
  ) {
    throw new Error("OIDC_CLAIMS_MISMATCH");
  }
  return payload;
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

async function boundedLedgerRead() {
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = secretKey();
  if (!url || !key) {
    throw new Error("SUPABASE_INTERNAL_CREDENTIALS_MISSING");
  }

  const params = new URLSearchParams({
    select: "occurrence_id",
    role: "eq.SCANNER",
    mode: "eq.WITNESS_ONLY",
    order: "scheduled_at.desc",
    limit: "1",
  });
  let response: Response;
  try {
    response = await fetch(
      `${url}/rest/v1/kk_runtime_expectations?${params.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: key,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(3000),
      },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("LEDGER_READ_TIMEOUT");
    }
    throw new Error("LEDGER_READ_TRANSPORT_FAILED");
  }
  if (!response.ok) {
    throw new Error("LEDGER_READ_FAILED");
  }
  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new Error("LEDGER_RESPONSE_INVALID");
  }
  return body.length;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED");
  }

  const token = bearer(req);
  if (!token) {
    return fail(401, "OIDC_TOKEN_MISSING");
  }

  try {
    await verifyVercelIdentity(token);
  } catch (err) {
    const code = err instanceof Error ? err.message : "OIDC_VERIFY_FAILED";
    return fail(401, code);
  }

  if (!(await validProbeRequest(req))) {
    return json(400, {
      ok: false,
      error_code: "OIDC_REQUEST_CONTRACT_INVALID",
      authenticated: true,
      read_only: true,
      bounded_limit: 1,
      business_writes: 0,
    });
  }

  let rowCount = 0;
  try {
    rowCount = await boundedLedgerRead();
  } catch (err) {
    const code = err instanceof Error ? err.message : "LEDGER_READ_FAILED";
    return json(503, {
      ok: false,
      error_code: code,
      authenticated: true,
      read_only: true,
      bounded_limit: 1,
      business_writes: 0,
    });
  }

  return json(200, {
    ok: true,
    authenticated: true,
    read_only: true,
    bounded_limit: 1,
    row_count: rowCount,
    business_writes: 0,
  });
});
