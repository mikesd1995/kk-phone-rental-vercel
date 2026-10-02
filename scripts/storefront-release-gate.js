'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const Evidence=require('./storefront-evidence.cjs');

const REVIEW_PATH=path.join(process.cwd(),'config','kk-storefront-v5-screenshot-review.json');
const REQUIRED_WIDTHS=Object.freeze([320,375,390,430,480,768,1024,1440]);
const STOREFRONT_RELEASE_PATHS=Object.freeze([
  'index.html',
  'style.css',
  'script.js',
  'config.js',
  'assets/kk-storefront-v2.css',
  'assets/kk-storefront-v3.css',
  'assets/kk-storefront-v5.css',
  'assets/kk-concert-blue-theme-20260922.css'
]);

function text(v){return String(v==null?'':v).trim();}
function assert(condition,code,detail=''){
  if(condition)return;
  const err=new Error(code);
  err.code=code;
  if(detail)err.detail=detail;
  throw err;
}
function normalizeFiles(files){
  return (Array.isArray(files)?files:[]).map(x=>{const v=text(x);return v.startsWith('./')?v.slice(2):v;}).filter(Boolean);
}
function changedFiles(baseSha,candidateSha){
  const base=text(baseSha),candidate=text(candidateSha);
  assert(/^[0-9a-f]{40}$/i.test(base),'BASE_SHA_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(candidate),'CANDIDATE_SHA_REQUIRED');
  const out=execFileSync('git',['diff','--name-only','--diff-filter=ACMRD',base,candidate],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return normalizeFiles(out.split('\\n'));
}
function storefrontReleaseFiles(files){
  const set=new Set(STOREFRONT_RELEASE_PATHS);
  return normalizeFiles(files).filter(file=>set.has(file));
}
function loadReview(reviewPath=REVIEW_PATH){
  assert(fs.existsSync(reviewPath),'OWNER_VISUAL_REVIEW_RECORD_MISSING');
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(reviewPath,'utf8'));}catch(_){throw Object.assign(new Error('OWNER_VISUAL_REVIEW_RECORD_INVALID'),{code:'OWNER_VISUAL_REVIEW_RECORD_INVALID'});}
  return parsed;
}
function reviewAcceptance(review,identity){
  const widths=new Set((review&&Array.isArray(review.reviewed_viewports)?review.reviewed_viewports:[]).map(Number));
  const missingWidths=REQUIRED_WIDTHS.filter(width=>!widths.has(width));
  const accepted=
    review &&
    review.status==='PASS' &&
    review.owner_decision==='ACCEPTED' &&
    review.baseline_comparison_pass===true &&
    Number.isInteger(Number(review.screenshot_artifact_id)) &&
    Number(review.screenshot_artifact_id)>0 &&
    text(review.frontend_digest)===text(identity&&identity.digest) &&
    missingWidths.length===0;
  return {
    pass:Boolean(accepted),
    missing_widths:missingWidths,
    review_status:text(review&&review.status),
    owner_decision:text(review&&review.owner_decision),
    screenshot_artifact_id:Number(review&&review.screenshot_artifact_id)||0,
    expected_frontend_digest:text(identity&&identity.digest),
    reviewed_frontend_digest:text(review&&review.frontend_digest)
  };
}
function evaluate({baseSha,candidateSha,files,review,identity}={}){
  const diff=Array.isArray(files)?normalizeFiles(files):changedFiles(baseSha,candidateSha);
  const storefrontFiles=storefrontReleaseFiles(diff);
  if(!storefrontFiles.length){
    return {
      schema_version:'KK_STOREFRONT_PRODUCTION_RELEASE_GATE_V1',
      status:'PASS',
      reason:'NO_STOREFRONT_RELEASE_CHANGE',
      base_sha:text(baseSha),
      candidate_sha:text(candidateSha),
      storefront_release_files:[],
      owner_visual_acceptance_required:false,
      production_writes:0
    };
  }
  const actualIdentity=identity||Evidence.frontendIdentity();
  const actualReview=review||loadReview();
  const acceptance=reviewAcceptance(actualReview,actualIdentity);
  return {
    schema_version:'KK_STOREFRONT_PRODUCTION_RELEASE_GATE_V1',
    status:acceptance.pass?'PASS':'BLOCKED',
    reason:acceptance.pass?'OWNER_VISUAL_ACCEPTANCE_MATCHES_CANDIDATE':'OWNER_VISUAL_ACCEPTANCE_REQUIRED',
    base_sha:text(baseSha),
    candidate_sha:text(candidateSha),
    storefront_release_files:storefrontFiles,
    owner_visual_acceptance_required:true,
    acceptance,
    production_writes:0
  };
}
function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--base-sha')out.baseSha=text(argv[++i]);
    else if(arg==='--candidate-sha')out.candidateSha=text(argv[++i]);
    else if(arg==='--help')out.help=true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'),{code:'UNKNOWN_ARGUMENT',argument:arg});
  }
  return out;
}
function help(){return 'Usage: node scripts/storefront-release-gate.js --base-sha <production-sha> --candidate-sha <candidate-sha>\n';}
function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){process.stdout.write(help());return;}
  const result=evaluate({baseSha:args.baseSha,candidateSha:args.candidateSha});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='PASS')process.exitCode=2;
}
if(require.main===module){
  try{main();}catch(err){
    process.stderr.write(JSON.stringify({status:'BLOCKED',error_code:text(err&&err.code)||'STOREFRONT_RELEASE_GATE_FAILED',detail:text(err&&err.detail),production_writes:0},null,2)+'\n');
    process.exitCode=2;
  }
}
module.exports={REQUIRED_WIDTHS,STOREFRONT_RELEASE_PATHS,normalizeFiles,storefrontReleaseFiles,reviewAcceptance,evaluate,parseArgs};
