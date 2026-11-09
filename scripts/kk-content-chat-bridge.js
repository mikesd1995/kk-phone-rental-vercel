'use strict';

const fs=require('fs');
const path=require('path');
const Gateway=require('../server/kk-agent-gateway.js');
const AgentLedger=require('../server/kk-agent-invocation-ledger.js');
const Router=require('../server/kk-content-request-router.js');
const OwnerPolicy=require('../server/kk-owner-x-copy-policy.js');

const VERSION='KK_CONTENT_CHAT_BRIDGE_V1';
const START='<!-- KK_CONTENT_BRIDGE_PAYLOAD_START -->';
const END='<!-- KK_CONTENT_BRIDGE_PAYLOAD_END -->';
const TITLE_PREFIX='[KK-CONTENT-RUN]';
const MAX_BODY_BYTES=64*1024;

function text(v){return String(v===undefined||v===null?'':v).trim();}
function uniq(values){return [...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];}

function extractPayload(body=''){
  const raw=String(body||'');
  if(Buffer.byteLength(raw,'utf8')>MAX_BODY_BYTES){
    const err=new Error('bridge payload too large');
    err.code='BRIDGE_BODY_TOO_LARGE';
    throw err;
  }
  const start=raw.indexOf(START);
  const end=raw.indexOf(END);
  if(start<0||end<0||end<=start){
    const err=new Error('bridge payload markers missing');
    err.code='BRIDGE_MARKERS_MISSING';
    throw err;
  }
  let json=raw.slice(start+START.length,end).trim();
  json=json.replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/,'').replace(/\s*\`\`\`$/,'').trim();
  let payload;
  try{payload=JSON.parse(json);}catch(error){
    const err=new Error('bridge payload JSON invalid');
    err.code='BRIDGE_JSON_INVALID';
    throw err;
  }
  return payload;
}

function validateBridgeEvent(event={}){
  const issue=event.issue&&typeof event.issue==='object'?event.issue:{};
  const title=text(issue.title);
  const association=text(issue.author_association).toUpperCase();
  const errors=[];
  if(!title.startsWith(TITLE_PREFIX)) errors.push('BRIDGE_TITLE_PREFIX_REQUIRED');
  if(association!=='OWNER') errors.push('BRIDGE_OWNER_ONLY');
  if(!Number.isInteger(Number(issue.number))||Number(issue.number)<=0) errors.push('BRIDGE_ISSUE_NUMBER_INVALID');
  return {
    pass:errors.length===0,
    errors,
    issue_number:Number(issue.number)||0,
    title,
    author_association:association
  };
}

function validateEnvelope(payload={}){
  const errors=[];
  const request=payload.request&&typeof payload.request==='object'&&!Array.isArray(payload.request)?payload.request:null;
  const candidates=Array.isArray(payload.candidates)?payload.candidates:[];
  if(!request) errors.push('BRIDGE_REQUEST_REQUIRED');
  if(request&&!text(request.message)) errors.push('BRIDGE_REQUEST_MESSAGE_REQUIRED');
  if(request)errors.push(...OwnerPolicy.validateRequest(request).errors);
  if(candidates.length!==3) errors.push('BRIDGE_EXACTLY_3_CANDIDATES_REQUIRED');
  candidates.forEach((candidate,index)=>{
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)) errors.push('BRIDGE_CANDIDATE_'+(index+1)+'_INVALID');
    else{
      if(!text(candidate.id)) errors.push('BRIDGE_CANDIDATE_'+(index+1)+'_ID_REQUIRED');
      if(!text(candidate.angle)) errors.push('BRIDGE_CANDIDATE_'+(index+1)+'_ANGLE_REQUIRED');
      if(!text(candidate.copy)) errors.push('BRIDGE_CANDIDATE_'+(index+1)+'_COPY_REQUIRED');
      if(!candidate.metrics||typeof candidate.metrics!=='object'||Array.isArray(candidate.metrics)) errors.push('BRIDGE_CANDIDATE_'+(index+1)+'_METRICS_REQUIRED');
    }
  });
  return {pass:errors.length===0,errors,request,candidates};
}

function safeInput(input={}){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const out={...source};
  delete out.admin_pin;
  delete out.api_key;
  delete out.token;
  delete out.password;
  delete out.secret;
  return out;
}

function buildComment(result={}){
  const lines=[];
  lines.push('<!-- '+VERSION+' -->');
  lines.push('## KK Content Agent Bridge');
  lines.push('');
  lines.push('- Status: **'+text(result.status||'BLOCKED')+'**');
  lines.push('- Gateway: `'+text(result.gateway_status||'NOT_RUN')+'`');
  lines.push('- Finalization: `'+text(result.finalization_gate||'NOT_RUN')+'`');
  if(result.invocation){
    lines.push('- Invocation: `'+text(result.invocation.invocation_id)+'`');
    lines.push('- Registry: `'+text(result.invocation.registry_version)+'`');
    lines.push('- Gateway version: `'+text(result.invocation.gateway_version)+'`');
    lines.push('- Required agents: '+uniq(result.invocation.required_agents).map(x=>'`'+x+'`').join(' → '));
    lines.push('- Invoked agents: '+uniq(result.invocation.invoked_agents).map(x=>'`'+x+'`').join(' → '));
  }
  if(result.blocker) lines.push('- Blocker: `'+text(result.blocker)+'`');
  if(result.qa_gate) lines.push('- QA: `'+text(result.qa_gate)+'`');
  if(result.selector_gate) lines.push('- Selector: `'+text(result.selector_gate)+'`');
  if(result.winner){
    lines.push('');
    lines.push('### Final post');
    lines.push('');
    lines.push('~~~text');
    lines.push(text(result.winner));
    lines.push('~~~');
  }
  lines.push('');
  lines.push('Owner review required. Auto-publish = false. Production writes = 0.');
  return lines.join('\n');
}

async function runBridge({event,payload,ledgerFn}={}){
  const eventCheck=validateBridgeEvent(event||{});
  if(!eventCheck.pass){
    return {
      schema_version:VERSION,
      status:'BLOCKED',
      gateway_status:'NOT_RUN',
      finalization_gate:'NOT_RUN',
      blocker:eventCheck.errors.join(','),
      event_check:eventCheck,
      production_writes:0,
      publishes:0
    };
  }

  const envelope=validateEnvelope(payload||{});
  if(!envelope.pass){
    return {
      schema_version:VERSION,
      status:'BLOCKED',
      gateway_status:'NOT_RUN',
      finalization_gate:'NOT_RUN',
      blocker:envelope.errors.join(','),
      event_check:eventCheck,
      production_writes:0,
      publishes:0
    };
  }

  const ledgerRows=[];
  const effectiveLedgerFn=typeof ledgerFn==='function'?ledgerFn:async row=>{
    ledgerRows.push(row);
    return AgentLedger.recordInvocation({row});
  };

  const request={
    ...envelope.request,
    input:safeInput(envelope.request.input||{})
  };
  const gateway=await Gateway.executeAgentRequest(request,{ledgerFn:effectiveLedgerFn});
  if(gateway.status!=='READY_FOR_OWNER_REVIEW'){
    return {
      schema_version:VERSION,
      status:'BLOCKED',
      gateway_status:gateway.status,
      finalization_gate:'NOT_RUN',
      blocker:text(gateway.blocker)||text(gateway.invocation&&gateway.invocation.blocked_reason)||'GATEWAY_NOT_READY',
      event_check:eventCheck,
      invocation:gateway.invocation||null,
      gateway,
      ledger_rows:ledgerRows,
      production_writes:0,
      publishes:0
    };
  }

  const routed=gateway.route||{};
  const finalInput={
    ...request.input,
    requested_intent:gateway.intent,
    commercial_truth_required:routed.commercial_truth_required===true,
    event_truth_required:Boolean(routed.finalization_contract&&routed.finalization_contract.event_truth_required)
  };
  const finalization=Router.finalizeGeneratedCandidates({
    candidates:envelope.candidates,
    input:finalInput,
    marketingPlan:routed.marketing_plan||{}
  });

  if(finalization.gate!=='PASS'||!text(finalization.final_post)){
    return {
      schema_version:VERSION,
      status:'BLOCKED',
      gateway_status:gateway.status,
      finalization_gate:finalization.gate,
      blocker:text(finalization.blocker)||'FINALIZATION_FAILED',
      qa_gate:finalization.qa&&finalization.qa.gate||'',
      selector_gate:finalization.selection&&finalization.selection.gate||'',
      event_check:eventCheck,
      invocation:gateway.invocation||null,
      gateway,
      finalization,
      ledger_rows:ledgerRows,
      production_writes:0,
      publishes:0
    };
  }

  return {
    schema_version:VERSION,
    status:'PASS',
    gateway_status:gateway.status,
    finalization_gate:finalization.gate,
    blocker:'',
    qa_gate:finalization.qa&&finalization.qa.gate||'',
    selector_gate:finalization.selection&&finalization.selection.gate||'',
    winner:finalization.final_post,
    winner_id:finalization.selection&&finalization.selection.winner&&finalization.selection.winner.id||'',
    winner_score:finalization.selection&&finalization.selection.winner&&finalization.selection.winner.score||0,
    evidence_state:finalization.selection&&finalization.selection.evidence_state||'',
    event_check:eventCheck,
    invocation:gateway.invocation||null,
    gateway,
    finalization,
    ledger_rows:ledgerRows,
    owner_review_required:true,
    production_writes:0,
    publishes:0
  };
}

async function cli(){
  const eventPath=text(process.env.GITHUB_EVENT_PATH||process.env.KK_CONTENT_BRIDGE_EVENT_PATH);
  if(!eventPath) throw Object.assign(new Error('GITHUB_EVENT_PATH missing'),{code:'BRIDGE_EVENT_PATH_MISSING'});
  const event=JSON.parse(fs.readFileSync(path.resolve(eventPath),'utf8'));
  const payload=extractPayload(event.issue&&event.issue.body||'');
  const result=await runBridge({event,payload});
  const outDir=text(process.env.KK_CONTENT_BRIDGE_OUT_DIR)||process.cwd();
  const resultPath=path.join(outDir,'kk-content-bridge-result.json');
  const commentPath=path.join(outDir,'kk-content-bridge-comment.md');
  fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n','utf8');
  fs.writeFileSync(commentPath,buildComment(result)+'\n','utf8');
  process.stdout.write(JSON.stringify({
    schema_version:VERSION,
    status:result.status,
    gateway_status:result.gateway_status,
    finalization_gate:result.finalization_gate,
    invocation_id:result.invocation&&result.invocation.invocation_id||'',
    result_path:resultPath,
    comment_path:commentPath
  })+'\n');
  if(result.status!=='PASS') process.exitCode=2;
}

if(require.main===module){
  cli().catch(error=>{
    const failure={
      schema_version:VERSION,
      status:'BLOCKED',
      error_code:text(error&&error.code)||'BRIDGE_EXECUTION_FAILED',
      error:text(error&&error.message)||String(error),
      production_writes:0,
      publishes:0
    };
    try{
      const outDir=text(process.env.KK_CONTENT_BRIDGE_OUT_DIR)||process.cwd();
      fs.writeFileSync(path.join(outDir,'kk-content-bridge-result.json'),JSON.stringify(failure,null,2)+'\n','utf8');
      fs.writeFileSync(path.join(outDir,'kk-content-bridge-comment.md'),buildComment(failure)+'\n','utf8');
    }catch(_){}
    console.error(JSON.stringify(failure));
    process.exitCode=2;
  });
}

module.exports={
  VERSION,START,END,TITLE_PREFIX,MAX_BODY_BYTES,
  extractPayload,validateBridgeEvent,validateEnvelope,safeInput,buildComment,runBridge
};
