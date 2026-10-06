'use strict';

const fs=require('fs');
const path=require('path');
const Gateway=require('../server/kk-agent-gateway.js');
const AgentLedger=require('../server/kk-agent-invocation-ledger.js');
const Router=require('../server/kk-content-request-router.js');
const BatchQa=require('../server/kk-content-batch-qa.js');

const VERSION='KK_CONTENT_BATCH_CHAT_BRIDGE_V1';
const START='<!-- KK_CONTENT_BATCH_BRIDGE_PAYLOAD_START -->';
const END='<!-- KK_CONTENT_BATCH_BRIDGE_PAYLOAD_END -->';
const TITLE_PREFIX='[KK-CONTENT-BATCH]';
const MAX_BODY_BYTES=256*1024;
const MAX_ITEMS=12;

function text(v){return String(v===undefined||v===null?'':v).trim();}
function uniq(values){return [...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];}

function extractPayload(body=''){
  const raw=String(body||'');
  if(Buffer.byteLength(raw,'utf8')>MAX_BODY_BYTES){
    const err=new Error('batch bridge payload too large');
    err.code='BATCH_BRIDGE_BODY_TOO_LARGE';
    throw err;
  }
  const start=raw.indexOf(START);
  const end=raw.indexOf(END);
  if(start<0||end<0||end<=start){
    const err=new Error('batch bridge payload markers missing');
    err.code='BATCH_BRIDGE_MARKERS_MISSING';
    throw err;
  }
  const json=raw.slice(start+START.length,end).trim();
  try{return JSON.parse(json);}catch(error){
    const err=new Error('batch bridge payload JSON invalid');
    err.code='BATCH_BRIDGE_JSON_INVALID';
    throw err;
  }
}

function validateBridgeEvent(event={}){
  const issue=event.issue&&typeof event.issue==='object'?event.issue:{};
  const title=text(issue.title);
  const association=text(issue.author_association).toUpperCase();
  const errors=[];
  if(!title.startsWith(TITLE_PREFIX))errors.push('BATCH_BRIDGE_TITLE_PREFIX_REQUIRED');
  if(association!=='OWNER')errors.push('BATCH_BRIDGE_OWNER_ONLY');
  if(!Number.isInteger(Number(issue.number))||Number(issue.number)<=0)errors.push('BATCH_BRIDGE_ISSUE_NUMBER_INVALID');
  return {pass:errors.length===0,errors,issue_number:Number(issue.number)||0,title,author_association:association};
}

function validateCandidate(candidate,index,itemIndex){
  const errors=[];
  const prefix='ITEM_'+(itemIndex+1)+'_CANDIDATE_'+(index+1)+'_';
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return [prefix+'INVALID'];
  if(!text(candidate.id))errors.push(prefix+'ID_REQUIRED');
  if(!text(candidate.angle))errors.push(prefix+'ANGLE_REQUIRED');
  if(!text(candidate.copy))errors.push(prefix+'COPY_REQUIRED');
  if(!candidate.metrics||typeof candidate.metrics!=='object'||Array.isArray(candidate.metrics))errors.push(prefix+'METRICS_REQUIRED');
  return errors;
}

function validateEnvelope(payload={}){
  const items=Array.isArray(payload.items)?payload.items:[];
  const errors=[];
  if(items.length<2)errors.push('BATCH_REQUIRES_AT_LEAST_2_ITEMS');
  if(items.length>MAX_ITEMS)errors.push('BATCH_TOO_MANY_ITEMS');
  items.forEach((item,itemIndex)=>{
    const prefix='ITEM_'+(itemIndex+1)+'_';
    const request=item&&item.request&&typeof item.request==='object'&&!Array.isArray(item.request)?item.request:null;
    const candidates=item&&Array.isArray(item.candidates)?item.candidates:[];
    if(!request)errors.push(prefix+'REQUEST_REQUIRED');
    if(request&&!text(request.message))errors.push(prefix+'REQUEST_MESSAGE_REQUIRED');
    if(candidates.length!==3)errors.push(prefix+'EXACTLY_3_CANDIDATES_REQUIRED');
    candidates.forEach((candidate,index)=>errors.push(...validateCandidate(candidate,index,itemIndex)));
  });
  return {pass:errors.length===0,errors,items};
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

async function runOne(item,ledgerFn){
  const request={...item.request,input:safeInput(item.request&&item.request.input||{})};
  const gateway=await Gateway.executeAgentRequest(request,{ledgerFn});
  if(gateway.status!=='READY_FOR_OWNER_REVIEW'){
    return {
      status:'BLOCKED',
      gateway_status:gateway.status,
      blocker:text(gateway.blocker)||text(gateway.invocation&&gateway.invocation.blocked_reason)||'GATEWAY_NOT_READY',
      invocation:gateway.invocation||null,
      gateway
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
    candidates:item.candidates,
    input:finalInput,
    marketingPlan:routed.marketing_plan||{}
  });

  if(finalization.gate!=='PASS'||!text(finalization.final_post)){
    return {
      status:'BLOCKED',
      gateway_status:gateway.status,
      finalization_gate:finalization.gate,
      blocker:text(finalization.blocker)||'FINALIZATION_FAILED',
      qa_gate:finalization.qa&&finalization.qa.gate||'',
      selector_gate:finalization.selection&&finalization.selection.gate||'',
      invocation:gateway.invocation||null,
      gateway,
      finalization
    };
  }

  return {
    status:'PASS',
    event:text(finalInput.event)||text(item.subject),
    subject:text(item.subject)||text(finalInput.event),
    input:finalInput,
    gateway_status:gateway.status,
    finalization_gate:finalization.gate,
    qa_gate:finalization.qa&&finalization.qa.gate||'',
    selector_gate:finalization.selection&&finalization.selection.gate||'',
    winner:finalization.final_post,
    winner_id:finalization.selection&&finalization.selection.winner&&finalization.selection.winner.id||'',
    winner_score:finalization.selection&&finalization.selection.winner&&finalization.selection.winner.score||0,
    invocation:gateway.invocation||null
  };
}

function buildComment(result={}){
  const lines=[];
  lines.push('<!-- '+VERSION+' -->');
  lines.push('## KK Content Agent Batch Bridge');
  lines.push('');
  lines.push('- Status: **'+text(result.status||'BLOCKED')+'**');
  lines.push('- Items: '+String(Number(result.item_count)||0));
  if(result.blocker)lines.push('- Blocker: '+text(result.blocker));
  if(result.batch_qa){
    lines.push('- Batch QA: '+text(result.batch_qa.gate));
    if(Array.isArray(result.batch_qa.errors)&&result.batch_qa.errors.length){
      lines.push('- Batch QA errors: '+result.batch_qa.errors.map(text).join(', '));
    }
  }
  if(Array.isArray(result.items)){
    for(const item of result.items){
      lines.push('');
      lines.push('### '+(text(item.subject)||text(item.event)||'Content item'));
      lines.push('');
      lines.push('- Gateway: '+text(item.gateway_status||'NOT_RUN'));
      lines.push('- Finalization: '+text(item.finalization_gate||'NOT_RUN'));
      lines.push('- QA: '+text(item.qa_gate||''));
      lines.push('- Selector: '+text(item.selector_gate||''));
      if(item.invocation){
        lines.push('- Invocation: '+text(item.invocation.invocation_id));
        lines.push('- Required agents: '+uniq(item.invocation.required_agents).join(' -> '));
        lines.push('- Invoked agents: '+uniq(item.invocation.invoked_agents).join(' -> '));
      }
      if(result.status==='PASS'&&text(item.winner)){
        lines.push('');
        lines.push('~~~text');
        lines.push(text(item.winner));
        lines.push('~~~');
      }
    }
  }
  lines.push('');
  lines.push('Owner review required. Auto-publish = false. Production writes = 0.');
  return lines.join('\n');
}

async function runBridge({event,payload,ledgerFn}={}){
  const eventCheck=validateBridgeEvent(event||{});
  if(!eventCheck.pass){
    return {
      schema_version:VERSION,status:'BLOCKED',blocker:eventCheck.errors.join(','),
      event_check:eventCheck,item_count:0,items:[],production_writes:0,publishes:0
    };
  }

  const envelope=validateEnvelope(payload||{});
  if(!envelope.pass){
    return {
      schema_version:VERSION,status:'BLOCKED',blocker:envelope.errors.join(','),
      event_check:eventCheck,item_count:envelope.items.length,items:[],production_writes:0,publishes:0
    };
  }

  const ledgerRows=[];
  const effectiveLedgerFn=typeof ledgerFn==='function'?ledgerFn:async row=>{
    ledgerRows.push(row);
    return AgentLedger.recordInvocation({row});
  };

  const results=[];
  for(const item of envelope.items){
    const one=await runOne(item,effectiveLedgerFn);
    results.push(one);
    if(one.status!=='PASS'){
      return {
        schema_version:VERSION,status:'BLOCKED',blocker:'ITEM_FINALIZATION_FAILED',
        event_check:eventCheck,item_count:envelope.items.length,items:results,ledger_rows:ledgerRows,
        production_writes:0,publishes:0
      };
    }
  }

  const batchQa=BatchQa.validateFinalPostBatch(results.map(item=>({post:item.winner,input:item.input})));
  if(batchQa.gate!=='PASS'){
    return {
      schema_version:VERSION,status:'BLOCKED',blocker:'BATCH_DIVERSITY_QA_FAILED',
      event_check:eventCheck,item_count:results.length,items:results,batch_qa:batchQa,ledger_rows:ledgerRows,
      production_writes:0,publishes:0
    };
  }

  return {
    schema_version:VERSION,status:'PASS',blocker:'',
    event_check:eventCheck,item_count:results.length,items:results,batch_qa:batchQa,ledger_rows:ledgerRows,
    owner_review_required:true,production_writes:0,publishes:0
  };
}

async function cli(){
  const eventPath=text(process.env.GITHUB_EVENT_PATH||process.env.KK_CONTENT_BATCH_BRIDGE_EVENT_PATH);
  if(!eventPath)throw Object.assign(new Error('GITHUB_EVENT_PATH missing'),{code:'BATCH_BRIDGE_EVENT_PATH_MISSING'});
  const event=JSON.parse(fs.readFileSync(path.resolve(eventPath),'utf8'));
  const payload=extractPayload(event.issue&&event.issue.body||'');
  const result=await runBridge({event,payload});
  const outDir=text(process.env.KK_CONTENT_BATCH_BRIDGE_OUT_DIR)||process.cwd();
  const resultPath=path.join(outDir,'kk-content-batch-bridge-result.json');
  const commentPath=path.join(outDir,'kk-content-batch-bridge-comment.md');
  fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n','utf8');
  fs.writeFileSync(commentPath,buildComment(result)+'\n','utf8');
  process.stdout.write(JSON.stringify({
    schema_version:VERSION,status:result.status,item_count:result.item_count,
    batch_qa:result.batch_qa&&result.batch_qa.gate||'NOT_RUN',
    result_path:resultPath,comment_path:commentPath
  })+'\n');
  if(result.status!=='PASS')process.exitCode=2;
}

if(require.main===module){
  cli().catch(error=>{
    const failure={
      schema_version:VERSION,status:'BLOCKED',
      error_code:text(error&&error.code)||'BATCH_BRIDGE_EXECUTION_FAILED',
      error:text(error&&error.message)||String(error),
      item_count:0,items:[],production_writes:0,publishes:0
    };
    try{
      const outDir=text(process.env.KK_CONTENT_BATCH_BRIDGE_OUT_DIR)||process.cwd();
      fs.writeFileSync(path.join(outDir,'kk-content-batch-bridge-result.json'),JSON.stringify(failure,null,2)+'\n','utf8');
      fs.writeFileSync(path.join(outDir,'kk-content-batch-bridge-comment.md'),buildComment(failure)+'\n','utf8');
    }catch(_){}
    console.error(JSON.stringify(failure));
    process.exitCode=2;
  });
}

module.exports={
  VERSION,START,END,TITLE_PREFIX,MAX_BODY_BYTES,MAX_ITEMS,
  extractPayload,validateBridgeEvent,validateEnvelope,safeInput,runOne,buildComment,runBridge
};
