import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const TEAM_SLUG = "mikesd1995s-projects";
const TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt";
const PROJECT_NAME = "kk-phone-rental-vercel";
const PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6";
const ENVIRONMENT = "production";
const PROJECT_MEMORY_MAX_ROWS = 80;

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

async function parseRequest(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!/^application\/json(?:;|$)/i.test(contentType)) return null;
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
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

function internalRuntime() {
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = secretKey();
  if (!url || !key) throw new Error("SUPABASE_INTERNAL_CREDENTIALS_MISSING");
  return { url, key };
}

async function getRows(path: string) {
  const {url,key}=internalRuntime();
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      method: "GET",
      headers: {apikey:key,Accept:"application/json"},
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("LEDGER_READ_TIMEOUT");
    }
    throw new Error("LEDGER_READ_TRANSPORT_FAILED");
  }
  if (!response.ok) throw new Error("LEDGER_READ_FAILED");
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("LEDGER_RESPONSE_INVALID");
  return body;
}

async function boundedLedgerRead() {
  const params = new URLSearchParams({
    select: "occurrence_id",
    role: "eq.SCANNER",
    mode: "eq.WITNESS_ONLY",
    order: "scheduled_at.desc",
    limit: "1",
  });
  return (await getRows(`kk_runtime_expectations?${params.toString()}`)).length;
}

function safeDomains(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v=>String(v||"").trim().toLowerCase()).filter(v=>/^[a-z0-9_:-]{2,80}$/.test(v)))].slice(0,12);
}

function safeLimit(value: unknown) {
  const n=Number(value);
  if (!Number.isInteger(n) || n<1) return PROJECT_MEMORY_MAX_ROWS;
  return Math.min(n,PROJECT_MEMORY_MAX_ROWS);
}

async function boundedProjectMemoryRead(body: Record<string, unknown>) {
  const limit=safeLimit(body.limit);
  const domains=safeDomains(body.domains);
  const params=new URLSearchParams({
    select:"memory_id,occurred_at,kind,domain,summary,evidence_refs,supersedes,status,source,source_commit_sha",
    order:"occurred_at.desc",
    limit:String(limit),
  });
  if(domains.length) params.set("domain",`in.(${domains.join(",")})`);
  const rows=await getRows(`kk_project_memory_events?${params.toString()}`);
  return {rows,limit};
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");

  const token = bearer(req);
  if (!token) return fail(401, "OIDC_TOKEN_MISSING");

  try {
    await verifyVercelIdentity(token);
  } catch (err) {
    const code = err instanceof Error ? err.message : "OIDC_VERIFY_FAILED";
    return fail(401, code);
  }

  const body=await parseRequest(req);
  if (!body || body.version !== "v1") {
    return json(400,{ok:false,error_code:"OIDC_REQUEST_CONTRACT_INVALID",authenticated:true,read_only:true,bounded_limit:1,business_writes:0});
  }

  if(body.probe === "runtime-ledger"){
    let rowCount = 0;
    try { rowCount = await boundedLedgerRead(); }
    catch (err) {
      const code = err instanceof Error ? err.message : "LEDGER_READ_FAILED";
      return json(503,{ok:false,error_code:code,authenticated:true,read_only:true,bounded_limit:1,business_writes:0});
    }
    return json(200,{ok:true,authenticated:true,read_only:true,bounded_limit:1,row_count:rowCount,business_writes:0});
  }

  if(body.probe === "project-memory"){
    try {
      const result=await boundedProjectMemoryRead(body);
      return json(200,{
        ok:true,
        authenticated:true,
        read_only:true,
        bounded_limit:result.limit,
        rows:result.rows,
        business_writes:0
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "PROJECT_MEMORY_READ_FAILED";
      return json(503,{ok:false,error_code:code,authenticated:true,read_only:true,bounded_limit:safeLimit(body.limit),rows:[],business_writes:0});
    }
  }

  return json(400,{ok:false,error_code:"OIDC_REQUEST_CONTRACT_INVALID",authenticated:true,read_only:true,bounded_limit:1,business_writes:0});
});
