'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function list(v){ return Array.isArray(v) ? v : []; }

const FORBIDDEN_OPERATIONS=new Set([
  'MERGE_MAIN','FORCE_PUSH','DEPLOY_PRODUCTION','MUTATE_SCHEDULER','MUTATE_MACHINE_SOT',
  'MUTATE_CRM','ACTIVATE_MAKE','CREATE_PRODUCTION_WRITER','PUBLISH_X','SEND_OWNER_MESSAGE',
  'SEND_CUSTOMER_MESSAGE','KYC_MUTATION','PROVIDER_MUTATION'
]);

const SENSITIVE_ENV_PATTERNS=[
  /(^|_)(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)$/i,
  /^(GITHUB_TOKEN|GH_TOKEN|VERCEL_TOKEN|LINE_.*|TELEGRAM_.*|XAMA_.*|MAKE_.*|GOOGLE_.*|OPENAI_API_KEY|ANTHROPIC_API_KEY)$/i
];

function isProtectedBranch(branch){
  const b=text(branch);
  return b==='main' || b==='master' || b==='skills/x-scanner-v2';
}

function pathMatches(path, rule){
  const p=text(path).replace(/^\.\//,'');
  const r=text(rule).replace(/^\.\//,'');
  if(!p || !r) return false;
  if(r.endsWith('/**')) return p===r.slice(0,-3) || p.startsWith(r.slice(0,-2));
  if(r.endsWith('*')) return p.startsWith(r.slice(0,-1));
  return p===r;
}

function isOwnedPath(path, ownedPaths=[]){
  return list(ownedPaths).some(rule=>pathMatches(path,rule));
}

function sensitiveEnvironmentKeys(keys=[]){
  return list(keys).map(text).filter(Boolean).filter(key=>SENSITIVE_ENV_PATTERNS.some(re=>re.test(key)));
}

function evaluateThirdPartyAction(input={}){
  const reasons=[];
  const op=upper(input.operation);
  const branch=text(input.branch);
  const path=text(input.path);
  const write=!!input.write || ['WRITE','EDIT','CREATE','DELETE'].includes(op);
  const sensitiveKeys=sensitiveEnvironmentKeys(input.environment_keys);

  if(FORBIDDEN_OPERATIONS.has(op)) reasons.push(`FORBIDDEN_OPERATION:${op}`);
  if(input.production_target===true) reasons.push('PRODUCTION_TARGET_PROHIBITED');
  if(input.production_credentials_present===true || sensitiveKeys.length) reasons.push('PRODUCTION_OR_SENSITIVE_CREDENTIALS_PRESENT');
  if(input.network_exposure && !['LOOPBACK','NONE','ISOLATED'].includes(upper(input.network_exposure))) reasons.push('NETWORK_EXPOSURE_NOT_ISOLATED');
  if(input.proxy_auth_required===true && input.proxy_auth_enabled!==true) reasons.push('PROXY_AUTH_REQUIRED');
  if(input.global_agent_patch===true) reasons.push('GLOBAL_AGENT_PATCH_PROHIBITED');
  if(input.main_merge_requested===true) reasons.push('MAIN_MERGE_PROHIBITED');

  if(write){
    if(!branch) reasons.push('WRITE_BRANCH_REQUIRED');
    if(isProtectedBranch(branch)) reasons.push('PROTECTED_BRANCH_WRITE_PROHIBITED');
    if(!path) reasons.push('WRITE_PATH_REQUIRED');
    if(path && !isOwnedPath(path,input.owned_paths)) reasons.push('PATH_OUTSIDE_OWNERSHIP');
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
  isProtectedBranch,
  pathMatches,
  isOwnedPath,
  sensitiveEnvironmentKeys,
  evaluateThirdPartyAction,
  integrationStageGate,
  reviewTier
};
