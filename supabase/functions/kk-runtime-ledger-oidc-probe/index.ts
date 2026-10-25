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
    const raw=await req.text();
    if(new TextEncoder().encode(raw).length>262144)return null;
    const body = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function verifyVercelIdentity(token: string, ownerUatRequest=false) {
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
  // Preview remains forbidden for every existing operation. New finite-UAT
  // operations additionally require an exact, expiring native source gate.
  const expectedEnvironment=ownerUatRequest&&unverified.environment==="preview"?"preview":ENVIRONMENT;
  const expectedSubject=expectedEnvironment===ENVIRONMENT?EXPECTED_SUBJECT:
    `owner:${TEAM_SLUG}:project:${PROJECT_NAME}:environment:preview`;

  let verified;
  try {
    verified = await jwtVerify(token, JWKS, {
      issuer,
      audience: EXPECTED_AUDIENCE,
      subject: expectedSubject,
    });
  } catch {
    throw new Error("OIDC_VERIFY_FAILED");
  }

  const payload = verified.payload;
  if (
    payload.owner_id !== TEAM_ID ||
    payload.project_id !== PROJECT_ID ||
    payload.project !== PROJECT_NAME ||
    payload.environment !== expectedEnvironment
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

const OWNER_PROJECT_REF="zehlsagzrpromtfqqflt";
const OWNER_TRANSPORT_VERSION="kk-make-owner-transport-v1";
const OWNER_SOURCE_SHEET="1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo";
const OWNER_OPERATIONS:Record<string,{rpc:string;keys:string[]}>= {
  enqueue:{rpc:"kk_make_owner_notification_enqueue",keys:["p_immutable_binding","p_source_audit_event_id","p_descriptor","p_fresh_since"]},
  readback:{rpc:"kk_make_owner_notification_readback",keys:["p_source_notification_id"]},
  claim:{rpc:"kk_make_owner_notification_claim",keys:["p_notification_id","p_request_id","p_event_type","p_entity_id","p_content_version","p_text_sha256","p_expires_at"]},
  ack:{rpc:"kk_make_owner_notification_ack",keys:["p_notification_id","p_receipt_id","p_provider_message_id"]}
};
// Canonical v2 uses additive storage. The DB gate is locked throughout each RPC;
// the environment comes only from verified same-project OIDC claims.
const CANONICAL_OPERATIONS:Record<string,string[]>={poll:[],'poll-readback':['poll_id'],tickets:['context','rows','candidates','held'],begin:['ticket'],enqueue:['ticket','binding','descriptor','claimed_row'],readback:['notification_id'],reserve:['notification_id'],ack:['notification_id','receipt_id','provider_message_id']};
async function canonicalOwnerOperation(body:Record<string,unknown>,identity:Record<string,unknown>){
  if(Deno.env.get('KK_OWNER_CANONICAL_ENABLED')!=='TRUE')ownerError('CANONICAL_DISABLED_OR_UNBOUND');
  ownerExact(body,['probe','version','operation','parameters']);
  const operation=typeof body.operation==='string'?body.operation:'';
  if(!Object.hasOwn(CANONICAL_OPERATIONS,operation))ownerError('CANONICAL_OPERATION_FORBIDDEN');
  const parameters=ownerExact(body.parameters,CANONICAL_OPERATIONS[operation]);
  if(!['preview','production'].includes(String(identity.environment)))ownerError('CANONICAL_ENVIRONMENT_INVALID');
  const result=await ownerRpc('kk_owner_canonical_operation',{p_operation:operation,p_parameters:parameters,p_environment:identity.environment});
  return {ok:true,authenticated:true,version:'v2',project_ref:OWNER_PROJECT_REF,operation,provider_sends:0,business_writes:0,read_only:operation==='readback'||operation==='poll-readback',result};
}
function ownerError(code:string):never {throw new Error(code);}
function ownerExact(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))ownerError("OWNER_REQUEST_INVALID");
  const r=value as Record<string,unknown>;
  if(Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k)))ownerError("OWNER_REQUEST_INVALID");
  return r;
}
function ownerRaw(value:unknown){
  if(typeof value!=="string"||new TextEncoder().encode(value).length<6||new TextEncoder().encode(value).length>93||/[\u0000-\u001f\u007f-\u009f]/.test(value))ownerError("OWNER_SOURCE_ID_INVALID");
  if(new TextDecoder("utf-8",{fatal:true}).decode(new TextEncoder().encode(value))!==value)ownerError("OWNER_SOURCE_ID_INVALID");
  return value as string;
}
function ownerDecode(value:unknown){
  if(typeof value!=="string"||!/^ks1_[A-Za-z0-9_-]{8,124}$/.test(value))ownerError("OWNER_SOURCE_ID_INVALID");
  try{
    const bytes=Uint8Array.from(atob(value.slice(4).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    const encoded=btoa(String.fromCharCode(...new TextEncoder().encode(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    if(encoded!==value.slice(4))ownerError("OWNER_SOURCE_ID_INVALID");
    return ownerRaw(raw);
  }catch{ownerError("OWNER_SOURCE_ID_INVALID");}
}
async function ownerHash(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function ownerRpc(name:string,parameters:Record<string,unknown>){
  const {url,key}=internalRuntime();
  if(url!==`https://${OWNER_PROJECT_REF}.supabase.co`)ownerError("OWNER_PROJECT_MISMATCH");
  let reply:Response;
  try{reply=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",redirect:"error",headers:{apikey:key,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(parameters),signal:AbortSignal.timeout(3000)});}
  catch{ownerError("OWNER_STORE_UNAVAILABLE");}
  if(!reply.ok)ownerError("OWNER_STORE_REJECTED");
  try{return await reply.json();}catch{ownerError("OWNER_STORE_RESPONSE_INVALID");}
}
async function ownerGate(raw:string,environment:unknown){
  const key="OWNER_TRANSPORT_UAT:"+raw;
  const filter='eq.'+key;
  const params=new URLSearchParams({select:"key,enabled,updated_at,note",key:filter,limit:"2"});
  const rows=await getRows(`kk_control_plane_config?${params}`);
  if(rows.length!==1||rows[0]?.key!==key||rows[0]?.enabled!==true)ownerError("OWNER_UAT_GATE_DISABLED");
  let note:Record<string,unknown>;try{note=JSON.parse(String(rows[0].note));}catch{ownerError("OWNER_UAT_GATE_INVALID");}
  ownerExact(note,["version","expires_at","immutable_binding_sha256","source_audit_event_id","allowed_environment"]);
  const updated=Date.parse(String(rows[0].updated_at)),expires=Date.parse(String(note.expires_at)),now=Date.now();
  if(note.version!=="owner-transport-uat-admission-v1"||note.allowed_environment!==environment||!["production","preview"].includes(String(environment))||typeof note.immutable_binding_sha256!=="string"||!/^[a-f0-9]{64}$/.test(note.immutable_binding_sha256)||note.source_audit_event_id!=="CONTROLLED_UAT|"+raw||!Number.isFinite(updated)||!Number.isFinite(expires)||updated>now+15000||updated<now-300000||expires<=now||expires<=updated||expires>updated+300000)ownerError("OWNER_UAT_GATE_INVALID_OR_EXPIRED");
  return {note,updated_at:rows[0].updated_at};
}
async function ownerBinding(bindingText:unknown,audit:unknown,raw:string,gate:Awaited<ReturnType<typeof ownerGate>>){
  if(typeof bindingText!=="string"||bindingText.length>16000)ownerError("OWNER_UAT_BINDING_INVALID");
  let b:unknown;try{b=JSON.parse(bindingText);}catch{ownerError("OWNER_UAT_BINDING_INVALID");}
  if(!Array.isArray(b)||b.length!==13||b.some(v=>typeof v!=="string")||JSON.stringify(b)!==bindingText||b[0]!=="kk-owner-ledger-binding-v1"||b[1]!==OWNER_SOURCE_SHEET||b[2]!=="_Notification_Ledger"||b[3]!=="TELEGRAM_OWNER_ALERTS"||b[4]!==raw||b[8]!==""||b[9]!==""||b[10]!=="TRANSPORT_UAT"||b[11]!=="TEST"||b[12]!=="OWNER_CONTROLLED_UAT"||!b[6].startsWith("ทดสอบระบบแจ้งเตือน")||b[6].length>2048||audit!==gate.note.source_audit_event_id||await ownerHash(bindingText)!==gate.note.immutable_binding_sha256)ownerError("OWNER_UAT_BINDING_MISMATCH");
  return b;
}
async function ownerOperation(body:Record<string,unknown>,identity:Record<string,unknown>){
  ownerExact(body,["probe","version","operation","parameters"]);
  const operation=typeof body.operation==="string"?body.operation:"",spec=Object.hasOwn(OWNER_OPERATIONS,operation)?OWNER_OPERATIONS[operation]:null;
  if(!spec)ownerError("OWNER_OPERATION_FORBIDDEN");
  const p=ownerExact(body.parameters,spec.keys);
  let raw:string;
  if(operation==="enqueue"){
    let b:unknown;try{b=JSON.parse(String(p.p_immutable_binding));}catch{ownerError("OWNER_UAT_BINDING_INVALID");}
    if(!Array.isArray(b))ownerError("OWNER_UAT_BINDING_INVALID");raw=ownerRaw(b[4]);
  }else raw=operation==="readback"?ownerRaw(p.p_source_notification_id):ownerDecode(p.p_notification_id);
  const gate=await ownerGate(raw,identity.environment);
  let persisted:any=null;
  if(operation==="enqueue"){
    await ownerBinding(p.p_immutable_binding,p.p_source_audit_event_id,raw,gate);
    const d=ownerExact(p.p_descriptor,["version","audience","notification_id","request_id","event_type","entity_id","content_version","text","created_at","expires_at"]);
    if(Object.values(d).some(v=>typeof v!=="string")||typeof p.p_fresh_since!=="string"||d.content_version!==gate.note.immutable_binding_sha256)ownerError("OWNER_REQUEST_INVALID");
  }else{
    persisted=await ownerRpc(OWNER_OPERATIONS.readback.rpc,{p_source_notification_id:raw});
    if(persisted!==null)await ownerBinding(persisted.immutable_binding_text,persisted.source_audit_event_id,raw,gate);
    else if(operation!=="readback")ownerError("OWNER_SOURCE_MAP_MISSING");
    if(operation==="claim"){
      if(Object.values(p).some(v=>typeof v!=="string")||p.p_notification_id!==persisted.descriptor.notification_id||p.p_request_id!==persisted.descriptor.request_id||p.p_event_type!=="OWNER_ALERT"||p.p_entity_id!==persisted.descriptor.entity_id||p.p_content_version!==persisted.descriptor.content_version||p.p_text_sha256!==persisted.text_sha256||Date.parse(String(p.p_expires_at))!==Date.parse(persisted.descriptor.expires_at))ownerError("OWNER_CLAIM_BINDING_MISMATCH");
    }
    if(operation==="ack"&&(typeof p.p_receipt_id!=="string"||!/^([a-f0-9]{8})-([a-f0-9]{4})-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.p_receipt_id)||typeof p.p_provider_message_id!=="string"||!/^[1-9][0-9]{0,19}$/.test(p.p_provider_message_id)))ownerError("OWNER_ACK_INVALID");
  }
  const result=operation==="readback"?persisted:await ownerRpc(spec.rpc,p);
  if(operation==="enqueue")await ownerBinding(result?.immutable_binding_text,result?.source_audit_event_id,raw,gate);
  const after=await ownerGate(raw,identity.environment);
  if(JSON.stringify(after)!==JSON.stringify(gate))ownerError("OWNER_UAT_GATE_CHANGED");
  return {ok:true,authenticated:true,owner_transport_version:OWNER_TRANSPORT_VERSION,project_ref:OWNER_PROJECT_REF,operation,read_only:operation==="readback",provider_sends:0,business_writes:0,result};
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");

  const token = bearer(req);
  if (!token) return fail(401, "OIDC_TOKEN_MISSING");

  const body=await parseRequest(req);
  let identity:Record<string,unknown>;
  try {
    identity=await verifyVercelIdentity(token,(body?.probe==="owner-notification"&&body?.version==="v1")||(body?.probe==='owner-canonical'&&body?.version==='v2'));
  } catch (err) {
    const code = err instanceof Error ? err.message : "OIDC_VERIFY_FAILED";
    return fail(401, code);
  }

  if(body?.probe==='owner-canonical'&&body?.version==='v2'){
    try{return json(200,await canonicalOwnerOperation(body,identity));}
    catch(err){return json(403,{ok:false,error_code:err instanceof Error?err.message:'CANONICAL_OPERATION_FAILED',authenticated:true,send_allowed:false,provider_sends:0,business_writes:0});}
  }
  if (!body || body.version !== "v1") {
    return json(400,{ok:false,error_code:"OIDC_REQUEST_CONTRACT_INVALID",authenticated:true,read_only:true,bounded_limit:1,business_writes:0});
  }

  if(body.probe==="owner-notification"){
    try{return json(200,await ownerOperation(body,identity));}
    catch(err){return json(403,{ok:false,error_code:err instanceof Error?err.message:"OWNER_OPERATION_FAILED",authenticated:true,read_only:true,provider_sends:0,business_writes:0});}
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
