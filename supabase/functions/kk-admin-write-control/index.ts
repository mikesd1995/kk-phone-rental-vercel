import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const TEAM_SLUG = "mikesd1995s-projects";
const TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt";
const PROJECT_NAME = "kk-phone-rental-vercel";
const PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6";
const ENVIRONMENT = "production";
const VERSION = "kk-admin-write-control-v27";
const SCOPE = "core-admin";

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
      "x-kk-admin-write-control-version": VERSION,
    },
  });
}

function fail(status: number, code: string, authenticated = false) {
  return json(status, {
    ok: false,
    error_code: code,
    authenticated,
    business_writes: 0,
    google_sheet_writes: 0,
  });
}

function bearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
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

function supabaseBase() {
  return (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
}

function safeRequestId(value: unknown) {
  const v = String(value || "").trim();
  return v.length >= 8 && v.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(v) ? v : "";
}

function safeHash(value: unknown) {
  const v = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(v) ? v : "";
}

function safeActionName(value: unknown) {
  const v = String(value || "").trim();
  return v.length >= 1 && v.length <= 80 && /^[A-Za-z][A-Za-z0-9_-]*$/.test(v) ? v : "";
}

function safeFence(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

async function rest(path: string, init: RequestInit) {
  const url = supabaseBase();
  const key = secretKey();
  if (!url || !key) throw new Error("SUPABASE_INTERNAL_CREDENTIALS_MISSING");

  let response: Response;
  try {
    response = await fetch(url + path, {
      ...init,
      headers: {
        apikey: key,
        accept: "application/json",
        "content-type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("CONTROL_DB_TIMEOUT");
    }
    throw new Error("CONTROL_DB_TRANSPORT_FAILED");
  }

  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) throw new Error("CONTROL_DB_REQUEST_FAILED");
  return body;
}

async function rpc(name: string, payload: Record<string, unknown>) {
  return rest(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function health() {
  const params = new URLSearchParams({
    select: "scope,fencing_token,holder_request_id,lease_until",
    scope: `eq.${SCOPE}`,
    limit: "1",
  });
  const body = await rest(`/rest/v1/kk_admin_write_locks?${params.toString()}`, {
    method: "GET",
  });
  const rows = Array.isArray(body) ? body : [];
  const row = rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : {};
  return {
    ok: rows.length === 1,
    version: VERSION,
    authenticated: true,
    scope: SCOPE,
    configured: rows.length === 1,
    fencing_token: Number(row.fencing_token || 0),
    lock_held: !!row.holder_request_id &&
      !!row.lease_until &&
      Date.parse(String(row.lease_until)) > Date.now(),
    business_writes: 0,
    google_sheet_writes: 0,
  };
}

async function receiptGet(requestId: string) {
  const params = new URLSearchParams({
    select: "request_id,action,payload_hash,state,fencing_token,result_hash,result_json,error_code,created_at,updated_at",
    request_id: `eq.${requestId}`,
    limit: "1",
  });
  const body = await rest(`/rest/v1/kk_admin_write_receipts?${params.toString()}`, {
    method: "GET",
  });
  const rows = Array.isArray(body) ? body : [];
  return rows.length ? rows[0] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");

  const token = bearer(req);
  if (!token) return fail(401, "OIDC_TOKEN_MISSING");

  try {
    await verifyVercelIdentity(token);
  } catch (err) {
    return fail(401, err instanceof Error ? err.message : "OIDC_VERIFY_FAILED");
  }

  const contentType = req.headers.get("content-type") || "";
  if (!/^application\/json(?:;|$)/i.test(contentType)) {
    return fail(415, "CONTENT_TYPE_INVALID", true);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return fail(400, "REQUEST_JSON_INVALID", true);
  }

  if (body.version !== "v1") return fail(400, "CONTROL_VERSION_INVALID", true);
  const action = String(body.action || "");

  try {
    if (action === "health") {
      return json(200, await health());
    }

    const requestId = safeRequestId(body.request_id);
    if (!requestId) return fail(400, "REQUEST_ID_INVALID", true);

    if (action === "acquire") {
      const lease = Number(body.lease_seconds ?? 60);
      if (!Number.isInteger(lease) || lease < 30 || lease > 60) {
        return fail(400, "LEASE_SECONDS_INVALID", true);
      }
      const result = await rpc("kk_admin_lock_acquire", {
        p_scope: SCOPE,
        p_request_id: requestId,
        p_lease_seconds: lease,
      });
      const rows = Array.isArray(result) ? result : [];
      const row = rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : {};
      if (rows.length !== 1) return fail(503, "LOCK_RESPONSE_INVALID", true);
      return json(200, {
        ok: true,
        authenticated: true,
        acquired: row.acquired === true,
        fencing_token: Number(row.fencing_token || 0),
        lease_until: row.lease_until || null,
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    if (action === "release") {
      const fence = safeFence(body.fencing_token);
      if (fence === null) return fail(400, "FENCING_TOKEN_INVALID", true);
      const released = await rpc("kk_admin_lock_release", {
        p_scope: SCOPE,
        p_request_id: requestId,
        p_fencing_token: fence,
      });
      return json(200, {
        ok: true,
        authenticated: true,
        released: released === true,
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    if (action === "commandClaim") {
      const commandId = String(body.command_id || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) return fail(400, "COMMAND_ID_INVALID", true);
      const result = await rpc("kk_ultra_deep_command_claim", { p_command_id: commandId });
      const command = result && typeof result === "object" && !Array.isArray(result) ? result : null;
      if (!command) return fail(409, "COMMAND_NOT_PENDING", true);
      return json(200, { ok: true, authenticated: true, command, business_writes: 0, google_sheet_writes: 0 });
    }

    // Scanner checkpoint artifacts use the same Vercel Production OIDC boundary
    // as commandClaim. They cannot modify storefront, prices or booking truth.
    if (action === "shardCommandInspect") {
      const commandId = String(body.command_id || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))
        return fail(400, "COMMAND_ID_INVALID", true);
      const params=new URLSearchParams({
        select:"command_id,month,commit,state,command_kind,production_writes",
        command_id:"eq."+commandId,limit:"1"
      });
      const data=await rest("/rest/v1/kk_ultra_deep_commands?"+params.toString(),{method:"GET"});
      const rows=Array.isArray(data)?data:[];
      const command=rows[0]&&typeof rows[0]==="object"?rows[0] as Record<string,unknown>:null;
      if (!command || command.commit!==false ||
        command.command_kind!=="SHARDED_READ_ONLY" || command.production_writes!==0 ||
        !["PENDING","RUNNING"].includes(String(command.state)))
        return fail(409, "SHARD_COMMAND_NOT_AUTHORIZED", true);
      return json(200,{ok:true,authenticated:true,command:{
        command_id:commandId,month:command.month,commit:false,
        command_kind:"SHARDED_READ_ONLY",state:command.state
      },business_writes:0,google_sheet_writes:0});
    }

    if (action === "shardReceiptStore") {
      const commandId = String(body.command_id || "").trim();
      const envelope = body.receipt && typeof body.receipt === "object" &&
        !Array.isArray(body.receipt) ? body.receipt as Record<string, unknown> : null;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))
        return fail(400, "COMMAND_ID_INVALID", true);
      if (!envelope || envelope.version !== "KK_ULTRA_DEEP_SHARD_CHECKPOINT_V1" ||
          envelope.authoritative !== false || envelope.production_writes !== 0)
        return fail(400, "SHARD_ENVELOPE_INVALID", true);
      const month = String(envelope.month || "");
      const phase = String(envelope.phase || "");
      const start = Number(envelope.start), end = Number(envelope.end);
      if (!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(month) ||
          !["KNOWN_MISS","DISCOVERY","REFERENCE","SOURCE_UNIVERSE"].includes(phase) ||
          !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
          start < 0 || end <= start || end - start > 16 || end > 2000 ||
          !safeHash(envelope.plan_hash) || !safeHash(envelope.receipt_hash) ||
          !Array.isArray(envelope.records) || envelope.records.length !== end-start)
        return fail(400, "SHARD_SCOPE_INVALID", true);
      const {receipt_hash: suppliedHash, ...unsigned } = envelope;
      const canonicalBytes = new TextEncoder().encode(JSON.stringify(unsigned));
      if (canonicalBytes.byteLength > 240000) return fail(413, "SHARD_PAYLOAD_TOO_LARGE", true);
      const sha = await crypto.subtle.digest("SHA-256", canonicalBytes);
      const actualHash = Array.from(new Uint8Array(sha)).map(x=>x.toString(16).padStart(2,"0")).join("");
      if (actualHash !== suppliedHash) return fail(400, "SHARD_INTEGRITY_HASH_MISMATCH", true);
      const stored = await rpc("kk_ultra_deep_scan_shard_insert", {
        p_command_id:commandId,p_month:month,p_phase:phase,
        p_plan_hash:envelope.plan_hash,p_shard_start:start,p_shard_end:end,
        p_receipt_hash:suppliedHash,p_receipt_json:envelope
      });
      if (!["STORED","IDEMPOTENT_MATCH"].includes(String(stored)))
        return fail(503, "SHARD_STORAGE_RESPONSE_INVALID", true);
      return json(200, {ok:true,authenticated:true,status:stored,
        command_id:commandId,month,phase,start,end,receipt_hash:suppliedHash,
        business_writes:0,google_sheet_writes:0});
    }

    if (action === "shardReceiptList") {
      const commandId = String(body.command_id || "").trim();
      const phase = String(body.phase || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))
        return fail(400, "COMMAND_ID_INVALID", true);
      if (!["KNOWN_MISS","DISCOVERY","REFERENCE","SOURCE_UNIVERSE"].includes(phase))
        return fail(400, "SHARD_PHASE_INVALID", true);
      const params=new URLSearchParams({select:"receipt_json",
        command_id:"eq."+commandId,phase:"eq."+phase,order:"shard_start.asc",limit:"20"});
      const rows=await rest("/rest/v1/kk_ultra_deep_scan_shards?"+params.toString(),{method:"GET"});
      const receipts=Array.isArray(rows)?rows.map(x=>x&&x.receipt_json).filter(Boolean):[];
      return json(200,{ok:true,authenticated:true,command_id:commandId,
        phase,receipts,read_only:true,business_writes:0,google_sheet_writes:0});
    }

    if (action === "commandComplete") {
      const commandId = String(body.command_id || "").trim();
      const status = String(body.status || "");
      const productionWrites = Number(body.production_writes ?? 0);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) return fail(400, "COMMAND_ID_INVALID", true);
      if (!["COMPLETE", "FAILED"].includes(status)) return fail(400, "COMMAND_STATUS_INVALID", true);
      if (!Number.isInteger(productionWrites) || productionWrites < 0) return fail(400, "PRODUCTION_WRITES_INVALID", true);
      const completed = await rpc("kk_ultra_deep_command_complete", {
        p_command_id: commandId,
        p_status: status,
        p_production_writes: productionWrites,
        p_error_code: body.error_code == null ? null : String(body.error_code).slice(0, 120),
      });
      return json(200, { ok: completed === true, authenticated: true, completed: completed === true, business_writes: 0, google_sheet_writes: 0 });
    }

    if (action === "receiptGet") {
      return json(200, {
        ok: true,
        authenticated: true,
        receipt: await receiptGet(requestId),
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    const fence = safeFence(body.fencing_token);
    if (fence === null) return fail(400, "FENCING_TOKEN_INVALID", true);

    if (action === "receiptPrepare") {
      const writeAction = safeActionName(body.write_action);
      const payloadHash = safeHash(body.payload_hash);
      if (!writeAction) return fail(400, "WRITE_ACTION_INVALID", true);
      if (!payloadHash) return fail(400, "PAYLOAD_HASH_INVALID", true);
      const result = await rpc("kk_admin_receipt_prepare", {
        p_request_id: requestId,
        p_action: writeAction,
        p_payload_hash: payloadHash,
        p_fencing_token: fence,
      });
      const rows = Array.isArray(result) ? result : [];
      if (rows.length !== 1) return fail(503, "RECEIPT_RESPONSE_INVALID", true);
      return json(200, {
        ok: true,
        authenticated: true,
        receipt: rows[0],
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    if (action === "receiptCommit") {
      const resultHash = safeHash(body.result_hash);
      if (!resultHash) return fail(400, "RESULT_HASH_INVALID", true);
      const meta = body.result_meta && typeof body.result_meta === "object"
        ? body.result_meta as Record<string, unknown>
        : {};
      const allowedMeta: Record<string, unknown> = {};
      for (const key of ["row_number", "entity_id", "entity_type", "write_action"]) {
        const value = meta[key];
        if (typeof value === "string" || typeof value === "number") {
          allowedMeta[key] = value;
        }
      }
      const committed = await rpc("kk_admin_receipt_commit", {
        p_request_id: requestId,
        p_fencing_token: fence,
        p_result_hash: resultHash,
        p_result_json: allowedMeta,
      });
      return json(200, {
        ok: true,
        authenticated: true,
        committed: committed === true,
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    if (action === "receiptFail") {
      const errorCode = String(body.error_code || "WRITE_FAILED").slice(0, 120);
      const failed = await rpc("kk_admin_receipt_fail", {
        p_request_id: requestId,
        p_fencing_token: fence,
        p_error_code: errorCode,
      });
      return json(200, {
        ok: true,
        authenticated: true,
        failed: failed === true,
        business_writes: 0,
        google_sheet_writes: 0,
      });
    }

    return fail(400, "ACTION_NOT_ALLOWED", true);
  } catch (err) {
    return fail(503, err instanceof Error ? err.message : "CONTROL_RUNTIME_FAILED", true);
  }
});
