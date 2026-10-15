'use strict';

const fs=require('fs');
const path=require('path');
const Gateway=require('../server/kk-agent-gateway.js');
const AgentLedger=require('../server/kk-agent-invocation-ledger.js');

const VERSION='KK_X_POSTING_PLAN_CHAT_BRIDGE_V1';
const START='<!-- KK_X_POSTING_PLAN_PAYLOAD_START -->';
const END='<!-- KK_X_POSTING_PLAN_PAYLOAD_END -->';
const TITLE_PREFIX='[KK-X-PLAN]';
const MAX_BODY_BYTES=96*1024;

function text(v){return String(v===undefined||v===null?'':v).trim();}

function extractPayload(body=''){
  const raw=String(body||'');
  if(Buffer.byteLength(raw,'utf8')>MAX_BODY_BYTES){
    throw Object.assign(new Error('bridge payload too large'),{code:'BRIDGE_BODY_TOO_LARGE'});
  }
  const start=raw.indexOf(START);
  const end=raw.indexOf(END);
  if(start<0||end<0||end<=start){
    throw Object.assign(new Error('bridge payload markers missing'),{code:'BRIDGE_MARKERS_MISSING'});
  }
  let json=raw.slice(start+START.length,end).trim();
  json=json.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(json);}
  catch(error){throw Object.assign(new Error('bridge payload JSON invalid'),{code:'BRIDGE_JSON_INVALID'});}
}

function validateBridgeEvent(event={}){
  const issue=event.issue&&typeof event.issue==='object'?event.issue:{};
  const errors=[];
  const title=text(issue.title);
  const association=text(issue.author_association).toUpperCase();
  if(!title.startsWith(TITLE_PREFIX))errors.push('BRIDGE_TITLE_PREFIX_REQUIRED');
  if(association!=='OWNER')errors.push('BRIDGE_OWNER_ONLY');
  if(!Number.isInteger(Number(issue.number))||Number(issue.number)<=0)errors.push('BRIDGE_ISSUE_NUMBER_INVALID');
  return {pass:errors.length===0,errors,issue_number:Number(issue.number)||0,title,author_association:association};
}

// GitHub Issues are not private storage. Refuse full Sheet rows (including
// names, phone numbers and booking notes) before invoking any Marketing Agent.
const SNAPSHOT_FIELDS=Object.freeze({
  booking_rows:new Set(['booking_status','event_id','event_date']),
  visibility_locks:new Set(['event_id','event_date','lock_state']),
  storefront_rows:new Set(['event_id','event_date_text','action_for_web','booking_status_for_web','available_phone_count']),
  post_log:new Set(['event_id','planned_at','published_at','logged_at','status'])
});
function snapshotPrivacyErrors(input={}){
  const errors=[];
  for(const [field,allowed] of Object.entries(SNAPSHOT_FIELDS)){
    const rows=input[field];
    if(rows===undefined||!Array.isArray(rows))continue; // Canonical-source type check happens separately.
    if(rows.length>2000){errors.push('BRIDGE_SNAPSHOT_TOO_LARGE:'+field);continue;}
    for(const row of rows){
      if(!row||typeof row!=='object'||Array.isArray(row)||
        Object.keys(row).some(key=>!allowed.has(key))){
        errors.push('BRIDGE_UNSANITIZED_SNAPSHOT_FORBIDDEN:'+field);
        break;
      }
    }
  }
  return errors;
}

function validateEnvelope(payload={}){
  const request=payload.request&&typeof payload.request==='object'&&!Array.isArray(payload.request)?payload.request:null;
  const errors=[];
  if(!request)errors.push('BRIDGE_REQUEST_REQUIRED');
  if(request&&!text(request.message))errors.push('BRIDGE_REQUEST_MESSAGE_REQUIRED');
  const input=request&&request.input&&typeof request.input==='object'&&!Array.isArray(request.input)?request.input:{};
  if(!Array.isArray(input.candidates)||!input.candidates.length)errors.push('BRIDGE_CANDIDATES_REQUIRED');
  errors.push(...snapshotPrivacyErrors(input));
  return {pass:errors.length===0,errors,request,input};
}

function safeInput(input={}){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const out={...source};
  for(const key of ['admin_pin','api_key','token','password','secret'])delete out[key];
  return out;
}

function buildComment(result={}){
  const lines=[
    '<!-- '+VERSION+' -->',
    '## KK X Posting Plan Agent',
    '',
    '- Status: **'+text(result.status||'BLOCKED')+'**',
    '- Gateway: `'+text(result.gateway_status||'NOT_RUN')+'`',
    '- Intent: `'+text(result.intent||'')+'`'
  ];
  if(result.invocation){
    lines.push('- Invocation: `'+text(result.invocation.invocation_id)+'`');
    lines.push('- Required: '+(result.invocation.required_agents||[]).map(x=>'`'+x+'`').join(' → '));
    lines.push('- Invoked: '+(result.invocation.invoked_agents||[]).map(x=>'`'+x+'`').join(' → '));
    lines.push('- Source commit: `'+text(result.invocation.source_commit_sha)+'`');
  }
  if(result.project_memory){
    lines.push('- Project memory: `'+text(result.project_memory.status||'')+'`');
    lines.push('- Durable memory mode: `'+text(result.project_memory.durable_mode||'')+'`');
    lines.push('- Durable memory rows loaded: `'+Number(result.project_memory.durable_context_count||0)+'`');
  }
  if(result.blocker)lines.push('- Blocker: `'+text(result.blocker)+'`');
  if(result.plan){
    lines.push('- Timezone: `'+text(result.plan.timezone)+'`');
    lines.push('');
    lines.push('### Posting slots');
    lines.push('');
    lines.push('| Time | Zone | Action | Event | Score |');
    lines.push('| --- | --- | --- | --- | ---: |');
    for(const slot of result.plan.slots||[]){
      lines.push('| '+text(slot.time)+' | '+text(slot.zone)+' | '+text(slot.action)+' | '+text(slot.event||'—')+' | '+Number(slot.score||0).toFixed(1)+' |');
    }
    lines.push('');
    lines.push('### Ranking');
    lines.push('');
    for(const row of (result.plan.ranking||[]).slice(0,8)){
      lines.push('- **'+text(row.event)+'** — '+Number(row.base_score||0).toFixed(1)+' (recent-post fatigue '+Number(row.recent_post_fatigue||0).toFixed(0)+')');
    }
    const rejected=result.plan.rejected_candidates||[];
    if(rejected.length){
      lines.push('');
      lines.push('Rejected: '+rejected.map(x=>text(x.event)+' ('+text(x.reason)+')').join(', '));
    }
  }
  lines.push('');
  lines.push('Owner review required. Auto-publish = false. Production writes = 0.');
  return lines.join('\n');
}

async function runBridge({event,payload,ledgerFn}={}){
  const eventCheck=validateBridgeEvent(event||{});
  if(!eventCheck.pass){
    return {schema_version:VERSION,status:'BLOCKED',gateway_status:'NOT_RUN',intent:'',blocker:eventCheck.errors.join(','),event_check:eventCheck,production_writes:0,publishes:0};
  }
  const envelope=validateEnvelope(payload||{});
  if(!envelope.pass){
    return {schema_version:VERSION,status:'BLOCKED',gateway_status:'NOT_RUN',intent:'',blocker:envelope.errors.join(','),event_check:eventCheck,production_writes:0,publishes:0};
  }

  const ledgerRows=[];
  const effectiveLedgerFn=typeof ledgerFn==='function'?ledgerFn:async row=>{
    ledgerRows.push(row);
    return AgentLedger.recordInvocation({row});
  };
  const request={
    ...envelope.request,
    input:safeInput(envelope.input)
  };
  const gateway=await Gateway.executeAgentRequest(request,{
    ledgerFn:effectiveLedgerFn
  });
  if(gateway.status!=='RECORDED'||gateway.intent!=='x_posting_plan'||!gateway.result){
    return {
      schema_version:VERSION,
      status:'BLOCKED',
      gateway_status:gateway.status,
      intent:gateway.intent||'',
      blocker:text(gateway.blocker)||text(gateway.invocation&&gateway.invocation.blocked_reason)||'X_POSTING_PLAN_NOT_RECORDED',
      event_check:eventCheck,
      invocation:gateway.invocation||null,
      gateway,
      ledger_rows:ledgerRows,
      production_writes:0,
      publishes:0
    };
  }
  // A recorded invocation is not proof of a promotable event.
  // Never turn a fail-closed planner result into a PASS owner schedule.
  if(gateway.result.status!=='READY_FOR_OWNER_REVIEW'){
    return {
      schema_version:VERSION,status:'BLOCKED',
      gateway_status:gateway.status,intent:gateway.intent,
      blocker:text(gateway.result.status)||'POSTING_PLAN_NOT_READY',
      event_check:eventCheck,invocation:gateway.invocation,
      plan:gateway.result,project_memory:gateway.project_memory,
      ledger_rows:ledgerRows,owner_review_required:true,
      production_writes:0,publishes:0
    };
  }
  return {
    schema_version:VERSION,
    status:'PASS',
    gateway_status:gateway.status,
    intent:gateway.intent,
    blocker:'',
    event_check:eventCheck,
    invocation:gateway.invocation,
    plan:gateway.result,
    project_memory:gateway.project_memory,
    ledger_rows:ledgerRows,
    owner_review_required:true,
    production_writes:0,
    publishes:0
  };
}

async function cli(){
  const eventPath=text(process.env.GITHUB_EVENT_PATH||process.env.KK_X_PLAN_BRIDGE_EVENT_PATH);
  if(!eventPath)throw Object.assign(new Error('GITHUB_EVENT_PATH missing'),{code:'BRIDGE_EVENT_PATH_MISSING'});
  const event=JSON.parse(fs.readFileSync(path.resolve(eventPath),'utf8'));
  const payload=extractPayload(event.issue&&event.issue.body||'');
  const result=await runBridge({event,payload});
  const outDir=text(process.env.KK_X_PLAN_BRIDGE_OUT_DIR)||process.cwd();
  fs.writeFileSync(path.join(outDir,'kk-x-posting-plan-bridge-result.json'),JSON.stringify(result,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(outDir,'kk-x-posting-plan-bridge-comment.md'),buildComment(result)+'\n','utf8');
  process.stdout.write(JSON.stringify({
    schema_version:VERSION,
    status:result.status,
    gateway_status:result.gateway_status,
    intent:result.intent,
    invocation_id:result.invocation&&result.invocation.invocation_id||''
  })+'\n');
  if(result.status!=='PASS')process.exitCode=2;
}

if(require.main===module){
  cli().catch(error=>{
    const failure={schema_version:VERSION,status:'BLOCKED',gateway_status:'NOT_RUN',intent:'',error_code:text(error&&error.code)||'BRIDGE_EXECUTION_FAILED',error:text(error&&error.message)||String(error),production_writes:0,publishes:0};
    try{
      const outDir=text(process.env.KK_X_PLAN_BRIDGE_OUT_DIR)||process.cwd();
      fs.writeFileSync(path.join(outDir,'kk-x-posting-plan-bridge-result.json'),JSON.stringify(failure,null,2)+'\n','utf8');
      fs.writeFileSync(path.join(outDir,'kk-x-posting-plan-bridge-comment.md'),buildComment({...failure,blocker:failure.error_code})+'\n','utf8');
    }catch(_){}
    console.error(JSON.stringify(failure));
    process.exitCode=2;
  });
}

module.exports={VERSION,START,END,TITLE_PREFIX,MAX_BODY_BYTES,extractPayload,validateBridgeEvent,validateEnvelope,snapshotPrivacyErrors,safeInput,buildComment,runBridge};
