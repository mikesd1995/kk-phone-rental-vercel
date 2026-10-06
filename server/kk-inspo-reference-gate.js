'use strict';

const VERSION='KK_INSPO_REFERENCE_GATE_V1';
const PROVIDER=Object.freeze({
  name:'Nutlope/inspo',
  repository:'https://github.com/Nutlope/inspo',
  hosted_mcp:'https://inspomcp.dev/api/mcp',
  license:'MIT',
  authority:'REFERENCE_ONLY',
  writes:0
});

function text(v){return String(v==null?'':v).trim();}
function list(v){return Array.isArray(v)?v.map(text).filter(Boolean):[];}

function classify(input={}){
  const kind=text(input.kind||input.change_type).toLowerCase();
  const redesign=input.redesign===true||['redesign','new_surface','new_page','visual_system','major_layout'].includes(kind);
  const bugfix=input.bugfix===true||['bugfix','hotfix','copy','data_fix'].includes(kind);
  return {
    required:redesign&&!bugfix,
    reason:redesign&&!bugfix?'MAJOR_DESIGN_WORK_REQUIRES_REFERENCE_RESEARCH':'REFERENCE_RESEARCH_OPTIONAL_FOR_SMALL_OR_NONDESIGN_CHANGE'
  };
}

function validateEvidence(input={}){
  const policy=classify(input);
  if(!policy.required) return {schema_version:VERSION,status:'NOT_REQUIRED',policy,blockers:[],provider:PROVIDER};
  const evidence=input.inspo_evidence&&typeof input.inspo_evidence==='object'?input.inspo_evidence:{};
  const refs=list(evidence.references);
  const patterns=list(evidence.patterns_adopt);
  const rejects=list(evidence.patterns_reject);
  const blockers=[];
  if(text(evidence.provider).toLowerCase()!=='nutlope/inspo') blockers.push('INSPO_PROVIDER_EVIDENCE_MISSING');
  if(!text(evidence.research_query||evidence.brief)) blockers.push('INSPO_RESEARCH_BRIEF_MISSING');
  if(refs.length<3) blockers.push('INSPO_REFERENCE_SET_TOO_SMALL');
  if(!patterns.length) blockers.push('INSPO_ADOPTED_PATTERNS_MISSING');
  if(!rejects.length) blockers.push('INSPO_REJECTED_PATTERNS_MISSING');
  if(evidence.copy_site===true||evidence.copy_component_verbatim===true) blockers.push('REFERENCE_COPYING_NOT_ALLOWED');
  if(evidence.business_truth_authority===true) blockers.push('INSPO_CANNOT_AUTHOR_BUSINESS_TRUTH');
  return {
    schema_version:VERSION,
    status:blockers.length?'BLOCKED':'PASS',
    policy,blockers,provider:PROVIDER,
    evidence:{provider:text(evidence.provider),research_query:text(evidence.research_query||evidence.brief),references:refs,patterns_adopt:patterns,patterns_reject:rejects},
    rule:'Inspo supplies reference evidence only. KK Art Director synthesizes brand-fit direction; Design Council and rendered Visual QA remain acceptance authorities.',
    production_writes:0
  };
}

module.exports={VERSION,PROVIDER,classify,validateEvidence};
