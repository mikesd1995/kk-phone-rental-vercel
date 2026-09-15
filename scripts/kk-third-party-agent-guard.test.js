'use strict';
const assert=require('assert');
const g=require('../lib/kk-third-party-agent-guard');
let n=0;
const ok=(v,msg)=>{assert(v,msg);n++;};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

const OWNED=[
  'docs/kk-phone-rental/**',
  'scripts/dev/**',
  'lib/kk-third-party-agent-guard.js',
  'scripts/kk-third-party-agent-guard.test.js'
];

let r=g.evaluateThirdPartyAction({
  operation:'WRITE',
  write:true,
  branch:'integration/ai-engineering-model-v1',
  path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',
  owned_paths:OWNED,
  production_target:false,
  production_credentials_present:false,
  environment_keys:[],
  network_exposure:'NONE'
});
ok(r.allowed,'owned development-plane doc write is allowed with explicit non-production declarations');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'main',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PROTECTED_BRANCH_WRITE_PROHIBITED'),'main write is denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'refs/heads/main',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PROTECTED_BRANCH_WRITE_PROHIBITED'),'refs/heads/main normalizes to protected main');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'skills/x-scanner-v2',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PROTECTED_BRANCH_WRITE_PROHIBITED'),'canonical dev branch is protected from third-party direct writes');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'api/kk-admin.js',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PATH_OUTSIDE_OWNERSHIP'),'unowned production-adjacent file is denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs/kk-phone-rental/../../api/kk-admin.js',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('WRITE_PATH_INVALID')&&r.reasons.includes('PATH_OUTSIDE_OWNERSHIP'),'traversal-like owned-prefix path is denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs\\kk-phone-rental\\..\\..\\api\\kk-admin.js',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('WRITE_PATH_INVALID'),'backslash traversal path is denied after separator normalization');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'/docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('WRITE_PATH_INVALID'),'absolute path is denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs//kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('WRITE_PATH_INVALID'),'duplicate separators are denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs/%2e%2e/api/kk-admin.js',owned_paths:OWNED,
  production_target:false,production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('WRITE_PATH_INVALID'),'encoded traversal-like path is denied');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_credentials_present:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_TARGET_DECLARATION_REQUIRED'),'generic write cannot omit production-target declaration');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,network_exposure:'NONE'
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_CREDENTIAL_DECLARATION_REQUIRED'),'generic write cannot omit credential declaration');

r=g.evaluateThirdPartyAction({
  operation:'WRITE',write:true,branch:'integration/ai-engineering-model-v1',path:'docs/kk-phone-rental/KK_AGENT_NOTE.md',owned_paths:OWNED,
  production_target:false,production_credentials_present:false
});
ok(!r.allowed&&r.reasons.includes('NETWORK_EXPOSURE_DECLARATION_REQUIRED'),'generic write cannot omit network-exposure declaration');

r=g.evaluateThirdPartyAction({operation:'MERGE_MAIN',branch:'integration/ai-engineering-model-v1'});
ok(!r.allowed&&r.reasons.includes('FORBIDDEN_OPERATION:MERGE_MAIN'),'merge main is categorically denied');

r=g.evaluateThirdPartyAction({operation:'MUTATE_SCHEDULER',branch:'integration/ai-engineering-model-v1'});
ok(!r.allowed&&r.reasons.includes('FORBIDDEN_OPERATION:MUTATE_SCHEDULER'),'scheduler mutation is denied');

r=g.evaluateThirdPartyAction({operation:'MUTATE_MACHINE_SOT',branch:'integration/ai-engineering-model-v1'});
ok(!r.allowed&&r.reasons.includes('FORBIDDEN_OPERATION:MUTATE_MACHINE_SOT'),'Machine SOT mutation is denied');

r=g.evaluateThirdPartyAction({operation:'ACTIVATE_MAKE',branch:'integration/ai-engineering-model-v1'});
ok(!r.allowed&&r.reasons.includes('FORBIDDEN_OPERATION:ACTIVATE_MAKE'),'Make activation is denied');

r=g.evaluateThirdPartyAction({operation:'PUBLISH_X',branch:'integration/ai-engineering-model-v1'});
ok(!r.allowed&&r.reasons.includes('FORBIDDEN_OPERATION:PUBLISH_X'),'public X publish is denied');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',environment_keys:['GITHUB_TOKEN']
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_OR_SENSITIVE_CREDENTIALS_PRESENT'),'sensitive environment key blocks action');
eq(r.sensitive_environment_keys,['GITHUB_TOKEN'],'sensitive key is surfaced by name only');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',environment_keys:['STRIPE_API_KEY','SERVICE_ACCESS_TOKEN','APP_CLIENT_SECRET','SIGNING_PRIVATE_KEY','AWS_SECRET_ACCESS_KEY','GOOGLE_APPLICATION_CREDENTIALS']
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_OR_SENSITIVE_CREDENTIALS_PRESENT'),'common suffix and provider credential aliases are blocked');
eq(r.sensitive_environment_keys,[
  'STRIPE_API_KEY','SERVICE_ACCESS_TOKEN','APP_CLIENT_SECRET','SIGNING_PRIVATE_KEY','AWS_SECRET_ACCESS_KEY','GOOGLE_APPLICATION_CREDENTIALS'
],'only sensitive environment key names are surfaced');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',environment_keys:['AWS_REGION','GOOGLE_CLOUD_PROJECT']
});
ok(r.allowed,'non-secret provider configuration names are not overclassified as credentials');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',environment_keys:['OPENAI_API_KEY=super-secret-value']
});
ok(!r.allowed&&r.reasons.includes('ENVIRONMENT_KEY_NAME_INVALID'),'key=value input is malformed and denied rather than echoing a value');
eq(r.sensitive_environment_keys,[],'malformed key=value input never surfaces secret-bearing text');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',environment_keys:{OPENAI_API_KEY:'secret'}
});
ok(!r.allowed&&r.reasons.includes('ENVIRONMENT_KEYS_MALFORMED'),'non-array environment key context fails closed');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',production_credentials_present:true
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_OR_SENSITIVE_CREDENTIALS_PRESENT'),'explicit production credentials block action');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',production_target:true
});
ok(!r.allowed&&r.reasons.includes('PRODUCTION_TARGET_PROHIBITED'),'production target is denied during isolated evaluation');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',network_exposure:'LAN'
});
ok(!r.allowed&&r.reasons.includes('NETWORK_EXPOSURE_NOT_ISOLATED'),'LAN exposure is denied');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',proxy_auth_required:true,proxy_auth_enabled:false,network_exposure:'LOOPBACK'
});
ok(!r.allowed&&r.reasons.includes('PROXY_AUTH_REQUIRED'),'required proxy auth must be enabled');

r=g.evaluateThirdPartyAction({
  operation:'READ',branch:'integration/ai-engineering-model-v1',global_agent_patch:true
});
ok(!r.allowed&&r.reasons.includes('GLOBAL_AGENT_PATCH_PROHIBITED'),'global agent patching is denied');

r=g.evaluateThirdPartyAction({});
ok(!r.allowed&&r.reasons.includes('OPERATION_REQUIRED'),'missing operation fails closed');

ok(g.pathMatches('scripts/dev/foo.js','scripts/dev/**'),'recursive owned path rule matches');
ok(g.pathMatches('scripts/dev/foo.js','scripts/dev/*'),'legacy star-prefix owned rule remains compatible');
ok(!g.pathMatches('scripts/foo.js','scripts/dev/**'),'owned path rule does not overmatch');
ok(!g.pathMatches('scripts/dev/../prod.js','scripts/dev/**'),'path matcher rejects traversal-like input');
ok(!g.pathMatches('scripts//dev/foo.js','scripts/dev/**'),'path matcher rejects duplicate separators');
ok(!g.pathMatches('/scripts/dev/foo.js','scripts/dev/**'),'path matcher rejects absolute input');
ok(g.isProtectedBranch('main'),'main is protected');
ok(g.isProtectedBranch('refs/heads/main'),'fully-qualified main ref is protected');
ok(!g.isProtectedBranch('integration/ai-engineering-model-v1'),'integration branch is not protected');

let stage=g.integrationStageGate({stage:'B',passed_stages:['A']});
ok(stage.allowed,'Stage B allowed after A');
stage=g.integrationStageGate({stage:'D',passed_stages:['A','B']});
ok(!stage.allowed&&stage.reasons.includes('STAGE_A_B_C_REQUIRED'),'Stage D cannot skip C');
stage=g.integrationStageGate({stage:'D',passed_stages:['A','B','C']});
ok(stage.allowed,'Stage D allowed only after A/B/C');
eq(g.reviewTier({operation:'PUBLISH_X'}),'BLOCKED','forbidden operation review tier is BLOCKED');
eq(g.reviewTier({runtime_control_plane:true}),'AUDIT','runtime control-plane change requires audit tier');
eq(g.reviewTier({code_change:true}),'PARENT_VERIFY','ordinary code change requires parent verification');
eq(g.reviewTier({}),'SELF_REVIEW','docs-only low risk defaults to self-review');

console.log(`kk-third-party-agent-guard: ${n}/${n} PASS`);
