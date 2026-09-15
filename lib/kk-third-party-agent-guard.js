'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function list(v){ return Array.isArray(v) ? v : []; }
function own(obj,key){ return Object.prototype.hasOwnProperty.call(obj,key); }

const FORBIDDEN_OPERATIONS=new Set([
  'MERGE_MAIN','FORCE_PUSH','DEPLOY_PRODUCTION','MUTATE_SCHEDULER','MUTATE_MACHINE_SOT',
  'MUTATE_CRM','ACTIVATE_MAKE','CREATE_PRODUCTION_WRITER','PUBLISH_X','SEND_OWNER_MESSAGE',
  'SEND_CUSTOMER_MESSAGE','KYC_MUTATION','PROVIDER_MUTATION'
]);

const SENSITIVE_ENV_PATTERNS=[
  /(^|_)(API_KEY|ACCESS_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CLIENT_SECRET|PRIVATE_KEY|SECRET_ACCESS_KEY|ACCESS_KEY_ID|PASSWORD|SECRET|TOKEN|CREDENTIALS?)$/i,
  /^(GITHUB_TOKEN|GH_TOKEN|VERCEL_TOKEN|LINE_.*|TELEGRAM_.*|XAMA_.*|MAKE_.*|GOOGLE_.*|OPENAI_.*|ANTHROPIC_.*|AWS_.*|AZURE_.*|CLOUDFLARE_.*)$/i
];

const SAFE_BRANCH_RE=/^[A-Za-z0-9._/-]+$/;
const SAFE_PATH_RE=/^[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._/@+-]+)*$/;
const ENV_KEY_RE=/^[A-Za-z_][A-Za-z0-9_]*$/;

function normalizeBranch(branch){
  let b=text(branch).replace(/\\/g,'/');
  while(b.startsWith('./')) b=b.slice(2);
  if(b.startsWith('refs/heads/')) b=b.slice('refs/heads/'.length);
  if(!b || !SAFE_BRANCH_RE.test(b) || b.includes('//')) return '';
  const parts=b.split('/');
  if(parts.some(part=>part==='' || part==='.' || part==='..')) return '';
  return b;
}

function normalizeOwnedPath(path){
  let p=text(path).replace(/\\/g,'/');
  while(p.startsWith('./')) p=p.slice(2);
  if(!p || p.startsWith('/') || /^[A-Za-z]:\//.test(p) || p.startsWith('//')) return '';
  if(/%(?:2e|2f|5c)/i.test(p) || p.includes('//') || !SAFE_PATH_RE.test(p)) return '';
  const parts=p.split('/');
  if(parts.some(part=>part==='' || part==='.' || part==='..')) return '';
  return p;
}

function normalizeOwnedRule(rule){
  let r=text(rule).replace(/\\/g,'/');
  while(r.startsWith('./')) r=r.slice(2);
  let suffix='';
  if(r.endsWith('/**')){ suffix='/**'; r=r.slice(0,-3); }
  else if(r.endsWith('*')){ suffix='*'; r=r.slice(0,-1); }
  const base=normalizeOwnedPath(r);
  return base ? base+suffix : '';
}

function isProtectedBranch(branch){
  const b=normalizeBranch(branch);
  return b==='main' || b==='master' || b==='skills/x-scanner-v2';
}

function pathMatches(path, rule){
  const p=normalizeOwnedPath(path);
  const r=normalizeOwnedRule(rule);
  if(!p || !r) return false;
  if(r.endsWith('/**')){
    const base=r.slice(0,-3);
    return p===base || p.startsWith(base+'/');
  }
  if(r.endsWith('*')) return p.startsWith(r.slice(0,-1));
  return p===r;
}

function isOwnedPath(path, ownedPaths=[]){
  return list(ownedPaths).some(rule=>pathMatches(path,rule));
}

function sensitiveEnvironmentKeys(keys=[]){
  return list(keys)
    .map(text)
    .filter(key=>ENV_KEY_RE.test(key))
    .filter(key=>SENSITIVE_ENV_PATTERNS.some(re=>re.test(key)));
}

function evaluateThirdPartyAction(input={}){
  const context=(input && typeof input==='object' && !Array.isArray(input)) ? input : {};
  const reasons=[];
  const op=upper(context.operation);
  const branch=text(context.branch);
  const path=text(context.path);
  const write=!!context.write || ['WRITE','EDIT','CREATE','DELETE'].includes(op);

  if(!op) reasons.push('OPERATION_REQUIRED');
  if(own(context,'environment_keys') && !Array.isArray(context.environment_keys)) reasons.push('ENVIRONMENT_KEYS_MALFORMED');
  const rawEnvironmentKeys=list(context.environment_keys).map(text).filter(Boolean);
  if(rawEnvironmentKeys.some(key=>!ENV_KEY_RE.test(key))) reasons.push('ENVIRONMENT_KEY_NAME_INVALID');
  const sensitiveKeys=sensitiveEnvironmentKeys(rawEnvironmentKeys);

  if(FORBIDDEN_OPERATIONS.has(op)) reasons.push(`FORBIDDEN_OPERATION:${op}`);
  if(context.production_target===true) reasons.push('PRODUCTION_TARGET_PROHIBITED');
  if(context.production_credentials_present===true || sensitiveKeys.length) reasons.push('PRODUCTION_OR_SENSITIVE_CREDENTIALS_PRESENT');
  if(context.network_exposure && !['LOOPBACK','NONE','ISOLATED'].includes(upper(context.network_exposure))) reasons.push('NETWORK_EXPOSURE_NOT_ISOLATED');
  if(context.proxy_auth_required===true && context.proxy_auth_enabled!==true) reasons.push('PROXY_AUTH_REQUIRED');
  if(context.global_agent_patch===true) reasons.push('GLOBAL_AGENT_PATCH_PROHIBITED');
  if(context.main_merge_requested===true) reasons.push('MAIN_MERGE_PROHIBITED');

  if(write){
    if(!branch) reasons.push('WRITE_BRANCH_REQUIRED');
    else if(!normalizeBranch(branch)) reasons.push('WRITE_BRANCH_INVALID');
    if(isProtectedBranch(branch)) reasons.push('PROTECTED_BRANCH_WRITE_PROHIBITED');

    if(!path) reasons.push('WRITE_PATH_REQUIRED');
    else if(!normalizeOwnedPath(path)) reasons.push('WRITE_PATH_INVALID');

    if(!Array.isArray(context.owned_paths) || context.owned_paths.length===0) reasons.push('OWNED_PATHS_REQUIRED');
    if(path && !isOwnedPath(path,context.owned_paths)) reasons.push('PATH_OUTSIDE_OWNERSHIP');

    if(!own(context,'production_target')) reasons.push('PRODUCTION_TARGET_DECLARATION_REQUIRED');
    if(!own(context,'production_credentials_present')) reasons.push('PRODUCTION_CREDENTIAL_DECLARATION_REQUIRED');
    if(!own(context,'network_exposure')) reasons.push('NETWORK_EXPOSURE_DECLARATION_REQUIRED');
  }

  const unique=Array.from(new Set(reasons));
  return {
    allowed:unique.length===0,
    decision:unique.length===0?'ALLOW':'DENY',
    reasons:unique,
    sensitive_environment_keys:sensitiveKeys
  };
}

function integrationStageGate(input={}){
  const stage=upper(input.stage || 'A');
  const passed=new Set(list(input.passed_stages).map(upper));
  const reasons=[];
  if(stage==='A') return {allowed:true,reasons:[]};
  if(stage==='B' && !passed.has('A')) reasons.push('STAGE_A_REQUIRED');
  if(stage==='C' && (!passed.has('A') || !passed.has('B'))) reasons.push('STAGE_A_B_REQUIRED');
  if(stage==='D' && (!passed.has('A') || !passed.has('B') || !passed.has('C'))) reasons.push('STAGE_A_B_C_REQUIRED');
  if(!['A','B','C','D'].includes(stage)) reasons.push('UNKNOWN_STAGE');
  return {allowed:reasons.length===0,reasons};
}

function reviewTier(input={}){
  const op=upper(input.operation);
  if(FORBIDDEN_OPERATIONS.has(op) || input.production_target===true) return 'BLOCKED';
  if(input.security_boundary===true || input.auth_boundary===true || input.runtime_control_plane===true) return 'AUDIT';
  if(input.code_change===true || input.executable_change===true) return 'PARENT_VERIFY';
  return 'SELF_REVIEW';
}

module.exports={
  FORBIDDEN_OPERATIONS,
  normalizeBranch,
  normalizeOwnedPath,
  isProtectedBranch,
  pathMatches,
  isOwnedPath,
  sensitiveEnvironmentKeys,
  evaluateThirdPartyAction,
  integrationStageGate,
  reviewTier
};