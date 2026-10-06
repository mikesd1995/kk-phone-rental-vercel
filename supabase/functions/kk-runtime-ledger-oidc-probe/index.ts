import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const TEAM_SLUG = "mikesd1995s-projects";
const TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt";
const PROJECT_NAME = "kk-phone-rental-vercel";
const PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6";
const ENVIRONMENT = "production";
const PROJECT_MEMORY_MAX_ROWS = 80;
const AGENT_INVOCATION_MAX_ROWS = 100;
const AGENT_GATE_STATUSES = new Set([
  "READY_FOR_OWNER_REVIEW","RECORDED","BLOCKED_CONTENT_GATE",
  "BLOCKED_REQUIRED_AGENT_NOT_INVOKED","BLOCKED_LEDGER_UNAVAILABLE",
  "BLOCKED_RUNTIME_NOT_AVAILABLE","BLOCKED_AGENT_EXECUTION_FAILED"
]);

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


function safeText(value: unknown, max=256) {
  const v=String(value??"").trim();
  return v.length<=max?v:"";
}
function safeAgentList(value: unknown) {
  if(!Array.isArray(value)) return [];
  return [...new Set(value.map(v=>safeText(v,80)).filter(v=>/^[a-z0-9_-]{3,80}$/.test(v)))].slice(0,24);
}
function safeAgentVersions(value: unknown) {
  if(!value || typeof value!=="object" || Array.isArray(value)) return {};
  const out:Record<string,string>={};
  for(const [key,raw] of Object.entries(value as Record<string,unknown>)){
    if(Object.keys(out).length>=24) break;
    if(!/^[a-z0-9_-]{3,80}$/.test(key)) continue;
    const v=safeText(raw,120);
    if(v) out[key]=v;
  }
  return out;
}
function normalizeAgentInvocation(value: unknown) {
  const x=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const row={
    invocation_id:safeText(x.invocation_id,100),
    request_type:safeText(x.request_type,96).toUpperCase(),
    intent:safeText(x.intent,64).toLowerCase(),
    route_id:safeText(x.route_id,120),
    required_agents:safeAgentList(x.required_agents),
    invoked_agents:safeAgentList(x.invoked_agents),
    agent_versions:safeAgentVersions(x.agent_versions),
    registry_version:safeText(x.registry_version,120),
    gateway_version:safeText(x.gateway_version,120),
    gate_status:safeText(x.gate_status,64).toUpperCase(),
    blocked_reason:safeText(x.blocked_reason,240),
    content_gate:safeText(x.content_gate,80),
    request_hash:safeText(x.request_hash,64).toLowerCase(),
    truth_hash:safeText(x.truth_hash,64).toLowerCase(),
    source_commit_sha:safeText(x.source_commit_sha,64),
    owner_review_required:x.owner_review_required===true,
    production_writes:0,
    publishes:0
  };
  const errors:string[]=[];
  if(!/^agi_[A-Za-z0-9_-]{16,96}$/.test(row.invocation_id)) errors.push("INVOCATION_ID_INVALID");
  if(!/^[A-Z0-9_]{3,96}$/.test(row.request_type)) errors.push("REQUEST_TYPE_INVALID");
  if(!/^[a-z0-9_]{3,64}$/.test(row.intent)) errors.push("INTENT_INVALID");
  if(!AGENT_GATE_STATUSES.has(row.gate_status)) errors.push("GATE_STATUS_INVALID");
  if(!/^[0-9a-f]{64}$/.test(row.request_hash)) errors.push("REQUEST_HASH_INVALID");
  if(!/^[0-9a-f]{64}$/.test(row.truth_hash)) errors.push("TRUTH_HASH_INVALID");
  if(row.required_agents.length<1) errors.push("REQUIRED_AGENTS_EMPTY");
  if(Number(x.production_writes||0)!==0) errors.push("PRODUCTION_WRITES_NONZERO");
  if(Number(x.publishes||0)!==0) errors.push("PUBLISHES_NONZERO");
  return {row,errors};
}
async function postAuditRow(table:string,row:Record<string,unknown>,conflictKey:string) {
  const {url,key}=internalRuntime();
  let response:Response;
  try{
    response=await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictKey)}`,{
      method:"POST",
      headers:{apikey:key,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=representation"},
      body:JSON.stringify([row]),
      signal:AbortSignal.timeout(3000)
    });
  }catch(err){
    if(err instanceof DOMException&&err.name==="TimeoutError") throw new Error("AUDIT_WRITE_TIMEOUT");
    throw new Error("AUDIT_WRITE_TRANSPORT_FAILED");
  }
  if(!response.ok) throw new Error("AUDIT_WRITE_FAILED");
  const body=await response.json();
  if(!Array.isArray(body)) throw new Error("AUDIT_WRITE_RESPONSE_INVALID");
  return {inserted:body.length===1};
}
async function boundedAgentInvocationRead(body:Record<string,unknown>) {
  const requested=Number(body.limit);
  const limit=Number.isInteger(requested)&&requested>0?Math.min(requested,AGENT_INVOCATION_MAX_ROWS):20;
  const params=new URLSearchParams({
    select:"invocation_id,occurred_at,request_type,intent,route_id,required_agents,invoked_agents,agent_versions,registry_version,gateway_version,gate_status,blocked_reason,content_gate,source_commit_sha,owner_review_required,production_writes,publishes",
    order:"occurred_at.desc",
    limit:String(limit)
  });
  const rows=await getRows(`kk_agent_invocations?${params.toString()}`);
  return {rows,limit};
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

  if(body.probe === "agent-invocation-write"){
    const checked=normalizeAgentInvocation(body.row);
    if(checked.errors.length){
      return json(400,{ok:false,error_code:"AGENT_INVOCATION_ROW_INVALID",blockers:checked.errors,authenticated:true,read_only:false,audit_writes:0,business_writes:0});
    }
    try{
      const result=await postAuditRow("kk_agent_invocations",checked.row,"invocation_id");
      return json(200,{ok:true,authenticated:true,read_only:false,invocation_id:checked.row.invocation_id,inserted:result.inserted,audit_writes:result.inserted?1:0,business_writes:0});
    }catch(err){
      const code=err instanceof Error?err.message:"AGENT_INVOCATION_WRITE_FAILED";
      return json(503,{ok:false,error_code:code,authenticated:true,read_only:false,audit_writes:0,business_writes:0});
    }
  }

  if(body.probe === "agent-invocation-read"){
    try{
      const result=await boundedAgentInvocationRead(body);
      return json(200,{ok:true,authenticated:true,read_only:true,bounded_limit:result.limit,rows:result.rows,business_writes:0});
    }catch(err){
      const code=err instanceof Error?err.message:"AGENT_INVOCATION_READ_FAILED";
      return json(503,{ok:false,error_code:code,authenticated:true,read_only:true,bounded_limit:0,rows:[],business_writes:0});
    }
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
