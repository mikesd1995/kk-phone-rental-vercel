'use strict';

const fs=require('fs');
const path=require('path');
const Gateway=require('../server/kk-agent-gateway.js');

const VERSION='KK_X_POSTING_PLAN_CHAT_BRIDGE_V1';
const START='<!-- KK_X_PLAN_PAYLOAD_START -->';
const END='<!-- KK_X_PLAN_PAYLOAD_END -->';
const TITLE_PREFIX='[KK-X-PLAN-RUN]';
const MAX_BODY_BYTES=96*1024;

function text(v){return String(v===undefined||v===null?'':v).trim();}

function extractPayload(body=''){
  const raw=String(body||'');
  if(Buffer.byteLength(raw,'utf8')>MAX_BODY_BYTES) throw Object.assign(new Error('bridge payload too large'),{code:'X_PLAN_BRIDGE_BODY_TOO_LARGE'});
  const start=raw.indexOf(START);
  const end=raw.indexOf(END);
  if(start<0||end<0||end<=start) throw Object.assign(new Error('bridge payload markers missing'),{code:'X_PLAN_BRIDGE_MARKERS_MISSING'});
  let json=raw.slice(start+START.length,end).trim();
  json=json.replace(/^\\`\\`\\`json\\s*/i,'').replace(/^\\`\\`\\`\\s*/,'').replace(/\\s*\\`\\`\\`$/,'').trim();
  try{return JSON.parse(json);}catch(_){throw Object.assign(new Error('bridge payload JSON invalid'),{code:'X_PLAN_BRIDGE_JSON_INVALID'});}
}

function validateEvent(event={}){
  const issue=event.issue&&typeof event.issue==='object'?event.issue:{};
  const errors=[];
  if(!text(issue.title).startsWith(TITLE_PREFIX)) errors.push('X_PLAN_TITLE_PREFIX_REQUIRED');
  if(text(issue.author_association).toUpperCase()!=='OWNER') errors.push('X_PLAN_OWNER_ONLY');
  if(!Number.isInteger(Number(issue.number))||Number(issue.number)<=0) errors.push('X_PLAN_ISSUE_NUMBER_INVALID');
  return {pass:errors.length===0,errors,issue_number:Number(issue.number)||0};
}

function validatePayload(payload={}){
  const errors=[];
  if(!payload||typeof payload!=='object'||Array.isArray(payload)) errors.push('X_PLAN_PAYLOAD_OBJECT_REQUIRED');
  const candidates=Array.isArray(payload.candidates)?payload.candidates:[];
  if(candidates.length<1) errors.push('X_PLAN_CANDIDATES_REQUIRED');
  if(!text(payload.now)) errors.push('X_PLAN_NOW_REQUIRED');
  candidates.forEach((candidate,index)=>{
    if(!candidate||typeof candidate!=='object') errors.push('X_PLAN_CANDIDATE_'+(index+1)+'_INVALID');
    else{
      if(!text(candidate.event||candidate.name)) errors.push('X_PLAN_CANDIDATE_'+(index+1)+'_EVENT_REQUIRED');
      if(candidate.verified_event!==true) errors.push('X_PLAN_CANDIDATE_'+(index+1)+'_VERIFIED_EVENT_REQUIRED');
      if(!Array.isArray(candidate.x_signals)||candidate.x_signals.length<1) errors.push('X_PLAN_CANDIDATE_'+(index+1)+'_X_SIGNALS_REQUIRED');
    }
  });
  return {pass:errors.length===0,errors};
}

function buildComment(result={}){
  const lines=['<!-- '+VERSION+' -->','## KK X Posting Plan Agent',''];
  lines.push('- Status: **'+text(result.status||'BLOCKED')+'**');
  lines.push('- Gateway: '+text(result.gateway_status||'NOT_RUN'));
  if(result.invocation){
    lines.push('- Invocation: '+text(result.invocation.invocation_id));
    lines.push('- Required agents: '+(result.invocation.required_agents||[]).join(' -> '));
    lines.push('- Invoked agents: '+(result.invocation.invoked_agents||[]).join(' -> '));
  }
  if(result.blocker) lines.push('- Blocker: '+text(result.blocker));
  const plan=result.plan||{};
  if(Array.isArray(plan.slots)&&plan.slots.length){
    lines.push('','### Time-slot plan','');
    for(const slot of plan.slots){
      if(slot.action==='POST'){
        lines.push('- **'+slot.start+'-'+slot.end+' '+slot.label+'** -> '+slot.event+' | '+slot.content_mode+' | score '+slot.score);
      }else{
        lines.push('- **'+slot.start+'-'+slot.end+' '+slot.label+'** -> HOLD | '+text(slot.reason));
      }
    }
  }
  lines.push('','Read-only planning only. Auto-publish = false. Auto-schedule = false. Production writes = 0.');
  return lines.join('\\n');
}

async function runBridge({event,payload,ledgerFn}={}){
  const eventCheck=validateEvent(event||{});
  const payloadCheck=validatePayload(payload||{});
  if(!eventCheck.pass||!payloadCheck.pass){
    return {schema_version:VERSION,status:'BLOCKED',gateway_status:'NOT_RUN',blocker:[...eventCheck.errors,...payloadCheck.errors].join(','),production_writes:0};
  }
  const rows=[];
  const effectiveLedger=typeof ledgerFn==='function'?ledgerFn:async row=>{
    rows.push(row);
    return {ok:true,inserted:true,provider:'github_issue_bridge',invocation_id:row.invocation_id};
  };
  const gateway=await Gateway.executeAgentRequest({
    task_type:'x_posting_plan',
    correlation_id:'kk-x-plan-issue-'+eventCheck.issue_number,
    input:payload
  },{ledgerFn:effectiveLedger});

  const plan=gateway.result||null;
  const pass=gateway.status==='RECORDED'&&plan&&plan.status==='READY';
  return {
    schema_version:VERSION,
    status:pass?'PASS':'BLOCKED',
    gateway_status:gateway.status,
    blocker:pass?'':text(gateway.blocker)||text(plan&&plan.status)||'X_PLAN_GATEWAY_NOT_READY',
    invocation:gateway.invocation||null,
    plan,
    ledger_rows:rows,
    production_writes:0
  };
}

async function cli(){
  const eventPath=text(process.env.GITHUB_EVENT_PATH||process.env.KK_X_PLAN_BRIDGE_EVENT_PATH);
  if(!eventPath) throw Object.assign(new Error('GITHUB_EVENT_PATH missing'),{code:'X_PLAN_EVENT_PATH_MISSING'});
  const event=JSON.parse(fs.readFileSync(path.resolve(eventPath),'utf8'));
  const payload=extractPayload(event.issue&&event.issue.body||'');
  const result=await runBridge({event,payload});
  fs.writeFileSync('kk-x-plan-bridge-result.json',JSON.stringify(result,null,2)+'\\n','utf8');
  fs.writeFileSync('kk-x-plan-bridge-comment.md',buildComment(result)+'\\n','utf8');
  process.stdout.write(JSON.stringify({status:result.status,gateway_status:result.gateway_status,invocation_id:result.invocation&&result.invocation.invocation_id||''})+'\\n');
  if(result.status!=='PASS') process.exitCode=2;
}

if(require.main===module){
  cli().catch(error=>{
    const failure={schema_version:VERSION,status:'BLOCKED',gateway_status:'NOT_RUN',error_code:text(error&&error.code)||'X_PLAN_BRIDGE_EXECUTION_FAILED',error:text(error&&error.message)||String(error),production_writes:0};
    try{
      fs.writeFileSync('kk-x-plan-bridge-result.json',JSON.stringify(failure,null,2)+'\\n','utf8');
      fs.writeFileSync('kk-x-plan-bridge-comment.md',buildComment(failure)+'\\n','utf8');
    }catch(_){}
    console.error(JSON.stringify(failure));
    process.exitCode=2;
  });
}

module.exports={VERSION,START,END,TITLE_PREFIX,MAX_BODY_BYTES,extractPayload,validateEvent,validatePayload,buildComment,runBridge};
