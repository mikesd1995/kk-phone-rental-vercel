'use strict';

// Offline review of redacted Make scenario_get readbacks. NEVER invokes Make.
// A PASS means the blueprint has the expected fail-closed shape, NOT runtime UAT.
const fs = require('node:fs');

const POLICIES = Object.freeze({
  5901592: {name:'make_a_legacy', trigger:2, guard:3, ownerOnly:false, callbacks:true, group:true, private:false},
  5988323: {name:'make_b_staging', trigger:3, guard:35, ownerOnly:true, callbacks:true, group:true, private:true},
  6032622: {name:'make_b_historical_backup', trigger:3, guard:8, ownerOnly:true, callbacks:false, group:true, private:true}
});
const SINKS = new Set([
  'telegram:SendReplyMessage',
  'telegram:editMessageText',
  'google-sheets:addRow',
  'google-sheets:updateRow',
  'google-sheets:makeAPICall',
  'ai-local-agent:RunLocalAIAgent'
]);

function isPredicate(clause, field, operator, value) {
  return clause.some(p => p && p.a === field && p.o === operator &&
    (value === undefined || String(p.b) === String(value)));
}
function auditMakeTelegramScenario(payload) {
  const problems=[];
  const scenario=payload && (payload.scenario || payload);
  const id=Number(scenario && scenario.id);
  const policy=POLICIES[id];
  if (!policy) return {ok:false,scenarioId:id||null,problems:['UNKNOWN_SCENARIO_ID']};
  const modules=Array.isArray(payload.modules)?payload.modules:[];
  const byId=new Map(modules.map(m => [Number(m.id), m]));
  const trigger=byId.get(policy.trigger);
  const guard=byId.get(policy.guard);
  if (scenario.status !== 'inactive') problems.push('LEGACY_SCENARIO_NOT_INACTIVE');
  if (!trigger || trigger.module !== 'telegram:WatchUpdates' || trigger.root !== 'main') problems.push('UNEXPECTED_TELEGRAM_TRIGGER');
  if (!guard || guard.follows !== policy.trigger || !guard.filter) problems.push('MISSING_FIRST_HOP_GUARD');

  for (const module of modules) {
    if (module.filter && (!Array.isArray(module.filter.conditions) ||
      module.filter.conditions.length === 0 ||
      module.filter.conditions.some(c => !Array.isArray(c) || c.length === 0))) {
      problems.push('INVALID_FILTER_SHAPE_MODULE_' + module.id);
    }
    if (SINKS.has(module.module) && !module.disabled) problems.push('UNQUARANTINED_SINK_MODULE_' + module.id);
  }

  const conditions=guard && guard.filter && guard.filter.conditions;
  if (Array.isArray(conditions) && conditions.every(Array.isArray)) {
    const kindCount={message:0,callback:0,group:0,private:0};
    for (const clause of conditions) {
      const kind=isPredicate(clause, '{{' + policy.trigger + '.message}}', 'exist')?'message':
        isPredicate(clause, '{{' + policy.trigger + '.callback_query}}', 'exist')?'callback':null;
      if (!kind) {problems.push('INGRESS_UNTYPED_BRANCH');continue;}
      kindCount[kind]++;
      const base='{{' + policy.trigger + '.' + (kind==='message'?'message':'callback_query');
      const botKey=base + '.from.is_bot}}';
      const ownerKey=base + '.from.id}}';
      const groupKey=base + '.chat.id}}';
      const callbackGroupKey=base + '.message.chat.id}}';
      const privateKey=base + '.chat.type}}';
      const callbackPrivateKey=base + '.message.chat.type}}';
      if (!isPredicate(clause,botKey,'boolean:equal','false')) problems.push('BOT_NOT_DENIED_' + kind);
      if (policy.ownerOnly && !clause.some(p => p.a===ownerKey && p.o==='number:equal' && /^\d+$/.test(String(p.b)) && Number(p.b)>0)) {
        problems.push('OWNER_NOT_BOUND_' + kind);
      }
      const hasGroup=clause.some(p => p.a===(kind==='message'?groupKey:callbackGroupKey) &&
        p.o==='number:equal' && /^-\d+$/.test(String(p.b)));
      const hasPrivate=isPredicate(clause,kind==='message'?privateKey:callbackPrivateKey,'text:equal','private');
      if (!hasGroup && !hasPrivate) problems.push('CHAT_NOT_BOUND_' + kind);
      if (hasGroup) kindCount.group++;
      if (hasPrivate) kindCount.private++;
      if (hasGroup && hasPrivate) problems.push('AMBIGUOUS_CHAT_CLAUSE');
    }
    if (kindCount.message===0) problems.push('MESSAGE_NOT_ALLOWED');
    if (policy.callbacks !== (kindCount.callback>0)) problems.push('CALLBACK_SCOPE_MISMATCH');
    if (policy.group && kindCount.group===0) problems.push('GROUP_NOT_BOUND');
    if (policy.private && kindCount.private===0) problems.push('PRIVATE_NOT_BOUND');
    if (!policy.private && kindCount.private>0) problems.push('PRIVATE_NOT_PERMITTED');
  } else if (guard) {
    problems.push('INVALID_INGRESS_CONDITIONS');
  }
  return {ok:problems.length===0,scenarioId:id,policy:policy.name,problems:[...new Set(problems)],moduleCount:modules.length};
}

if (require.main===module) {
  const filename=process.argv[2];
  if (!filename) {
    process.stderr.write('Usage: node scripts/audit-make-telegram-ingress.cjs <redacted-scenario-get.json>\n');
    process.exitCode=2;
  } else {
    try {
      const input=JSON.parse(fs.readFileSync(filename,'utf8'));
      const output=auditMakeTelegramScenario(input);
      process.stdout.write(JSON.stringify(output,null,2)+'\n');
      if (!output.ok) process.exitCode=1;
    } catch (error) {
      process.stderr.write('READBACK_INVALID: '+error.message+'\n');
      process.exitCode=2;
    }
  }
}
module.exports={auditMakeTelegramScenario, POLICIES};
