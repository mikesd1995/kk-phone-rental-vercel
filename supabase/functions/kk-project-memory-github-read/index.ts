import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.2.4";

const REPOSITORY="mikesd1995/kk-phone-rental-vercel";
const REPOSITORY_ID="1234430283";
const OWNER="mikesd1995";
const OWNER_ID="270679422";
const REF="refs/heads/main";
const EVENT_NAME="issues";
const PROJECT_REF="zehlsagzrpromtfqqflt";
const FUNCTION_SLUG="kk-project-memory-github-read";
const AUDIENCE=`https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_SLUG}`;
const MAX_ROWS=80;
const ALLOWED_WORKFLOWS=new Set([
  "mikesd1995/kk-phone-rental-vercel/.github/workflows/kk-content-chat-bridge.yml@refs/heads/main",
  "mikesd1995/kk-phone-rental-vercel/.github/workflows/kk-content-batch-chat-bridge.yml@refs/heads/main",
  "mikesd1995/kk-phone-rental-vercel/.github/workflows/kk-x-posting-plan-chat-bridge.yml@refs/heads/main",
]);
const JWKS=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),{timeoutDuration:3000});

function json(status:number,body:Record<string,unknown>){
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, no-cache, must-revalidate, max-age=0","x-content-type-options":"nosniff"}});
}
function fail(status:number,code:string,authenticated=false){
  return json(status,{ok:false,error_code:code,authenticated,read_only:true,bounded_limit:0,rows:[],business_writes:0});
}
function bearer(req:Request){
  const m=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():"";
}
async function verifyIdentity(token:string){
  let raw:Record<string,unknown>;
  try{raw=decodeJwt(token);}catch{throw new Error("GITHUB_OIDC_TOKEN_MALFORMED");}
  if(String(raw.iss||"")!=="https://token.actions.githubusercontent.com") throw new Error("GITHUB_OIDC_ISSUER_NOT_ALLOWED");
  let verified;
  try{verified=await jwtVerify(token,JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:AUDIENCE});}
  catch{throw new Error("GITHUB_OIDC_VERIFY_FAILED");}
  const p=verified.payload;
  if(
    p.repository!==REPOSITORY ||
    String(p.repository_id||"")!==REPOSITORY_ID ||
    p.repository_owner!==OWNER ||
    String(p.repository_owner_id||"")!==OWNER_ID ||
    p.ref!==REF ||
    p.event_name!==EVENT_NAME ||
    !ALLOWED_WORKFLOWS.has(String(p.workflow_ref||""))
  ) throw new Error("GITHUB_OIDC_CLAIMS_MISMATCH");
  if(!/^[0-9a-f]{40}$/i.test(String(p.sha||""))) throw new Error("GITHUB_OIDC_SHA_INVALID");
  return p;
}
function secretKey(){
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
  try{const parsed=JSON.parse(raw);return typeof parsed?.default==="string"?parsed.default.trim():"";}catch{return "";}
}
function safeDomains(value:unknown){
  if(!Array.isArray(value))return [];
  return [...new Set(value.map(v=>String(v||"").trim().toLowerCase()).filter(v=>/^[a-z0-9_:-]{2,80}$/.test(v)))].slice(0,12);
}
function safeLimit(value:unknown){
  const n=Number(value); return Number.isInteger(n)&&n>0?Math.min(n,MAX_ROWS):MAX_ROWS;
}
async function readMemory(body:Record<string,unknown>){
  const url=(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
  const key=secretKey();
  if(!url||!key)throw new Error("SUPABASE_INTERNAL_CREDENTIALS_MISSING");
  const limit=safeLimit(body.limit),domains=safeDomains(body.domains);
  const params=new URLSearchParams({
    select:"memory_id,occurred_at,kind,domain,summary,evidence_refs,supersedes,status,source,source_commit_sha",
    order:"occurred_at.desc",limit:String(limit)
  });
  if(domains.length)params.set("domain",`in.(${domains.join(",")})`);
  let r:Response;
  try{
    r=await fetch(`${url}/rest/v1/kk_project_memory_events?${params}`,{
      method:"GET",headers:{apikey:key,Accept:"application/json"},signal:AbortSignal.timeout(3000)
    });
  }catch(err){
    if(err instanceof DOMException&&err.name==="TimeoutError")throw new Error("PROJECT_MEMORY_READ_TIMEOUT");
    throw new Error("PROJECT_MEMORY_READ_TRANSPORT_FAILED");
  }
  if(!r.ok)throw new Error("PROJECT_MEMORY_READ_FAILED");
  const rows=await r.json();
  if(!Array.isArray(rows))throw new Error("PROJECT_MEMORY_RESPONSE_INVALID");
  return {rows,limit};
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return fail(405,"METHOD_NOT_ALLOWED");
  const token=bearer(req); if(!token)return fail(401,"GITHUB_OIDC_TOKEN_MISSING");
  try{await verifyIdentity(token);}catch(err){return fail(401,err instanceof Error?err.message:"GITHUB_OIDC_VERIFY_FAILED");}
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return fail(400,"INVALID_JSON",true);}
  if(body.probe!=="project-memory"||body.version!=="v1")return fail(400,"REQUEST_CONTRACT_INVALID",true);
  try{
    const result=await readMemory(body);
    return json(200,{ok:true,authenticated:true,read_only:true,bounded_limit:result.limit,rows:result.rows,business_writes:0});
  }catch(err){
    return json(503,{ok:false,error_code:err instanceof Error?err.message:"PROJECT_MEMORY_READ_FAILED",authenticated:true,read_only:true,bounded_limit:safeLimit(body.limit),rows:[],business_writes:0});
  }
});
