'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditMakeTelegramScenario}=require('../scripts/audit-make-telegram-ingress.cjs');

const p=(a,o,b)=>b===undefined?{a,o}:{a,o,b};
function fixture(id) {
  const configurations={
    5901592:{trigger:2,guard:3,owner:false,callbacks:true,private:false},
    5988323:{trigger:3,guard:35,owner:true,callbacks:true,private:true},
    6032622:{trigger:3,guard:8,owner:true,callbacks:false,private:true}
  };
  const x=configurations[id], conditions=[];
  const branch=(kind,chatType)=>{
    const start='{{'+x.trigger+'.'+(kind==='message'?'message':'callback_query');
    const chat=kind==='message'?'.chat':'.message.chat';
    const and=[
      p(start+'}}','exist'),
      p(start+'.from.is_bot}}','boolean:equal','false')
    ];
    if(x.owner) and.push(p(start+'.from.id}}','number:equal','999999'));
    if(chatType==='private') and.push(p(start+chat+'.type}}','text:equal','private'));
    else and.push(p(start+chat+'.id}}','number:equal','-100000'));
    return and;
  };
  conditions.push(branch('message','group'));
  if(x.private) conditions.push(branch('message','private'));
  if(x.callbacks) {
    conditions.push(branch('callback','group'));
    if(x.private) conditions.push(branch('callback','private'));
  }
  const guard={id:x.guard,module:id===6032622?'google-sheets:filterRows':'builtin:BasicRouter',
    follows:x.trigger,filter:{name:'INGRESS_ALLOWLIST',conditions}};
  return {
    scenario:{id,status:'inactive'},
    trigger:{moduleId:x.trigger,module:'telegram:WatchUpdates',kind:'webhook'},
    modules:[
      {id:x.trigger,module:'telegram:WatchUpdates',root:'main'},
      guard,
      {id:600,module:'telegram:SendReplyMessage',disabled:true},
      {id:601,module:'google-sheets:updateRow',disabled:true},
      {id:602,module:'google-sheets:addRow',disabled:true}
    ]
  };
}
const check=x=>auditMakeTelegramScenario(x);
test('Make A Telegram legacy strict ingress is structurally acceptable',()=>{
  assert.equal(check(fixture(5901592)).ok,true);
});
test('Make B staging strict ingress is structurally acceptable',()=>{
  assert.equal(check(fixture(5988323)).ok,true);
});
test('Make B historical backup strict ingress is structurally acceptable',()=>{
  assert.equal(check(fixture(6032622)).ok,true);
});
test('fail closed if scenario becomes active before acceptance',()=>{
  const x=fixture(5901592);x.scenario.status='active';
  assert.ok(check(x).problems.includes('LEGACY_SCENARIO_NOT_INACTIVE'));
});
test('fail closed when a sink is enabled',()=>{
  const x=fixture(5988323);x.modules.find(m=>m.id===600).disabled=false;
  assert.ok(check(x).problems.includes('UNQUARANTINED_SINK_MODULE_600'));
});
test('reject bot filter removed from even one route',()=>{
  const x=fixture(5988323);
  x.modules[1].filter.conditions[0]=x.modules[1].filter.conditions[0].filter(p=>!p.a.includes('is_bot'));
  assert.ok(check(x).problems.includes('BOT_NOT_DENIED_message'));
});
test('reject callback bot filter removed from even one route',()=>{
  const x=fixture(5901592);
  x.modules[1].filter.conditions[1]=x.modules[1].filter.conditions[1].filter(p=>!p.a.includes('is_bot'));
  assert.ok(check(x).problems.includes('BOT_NOT_DENIED_callback'));
});
test('reject owner identity removed from staging route',()=>{
  const x=fixture(5988323);
  x.modules[1].filter.conditions[0]=x.modules[1].filter.conditions[0].filter(p=>!p.a.includes('.from.id'));
  assert.ok(check(x).problems.includes('OWNER_NOT_BOUND_message'));
});
test('reject group allowlist removed from legacy route',()=>{
  const x=fixture(5901592);
  x.modules[1].filter.conditions[0]=x.modules[1].filter.conditions[0].filter(p=>!p.a.includes('.chat.id'));
  assert.ok(check(x).problems.includes('CHAT_NOT_BOUND_message'));
});
test('reject unexpected private chat route in Make A',()=>{
  const x=fixture(5901592);
  x.modules[1].filter.conditions.push([
    p('{{2.message}}','exist'),
    p('{{2.message.from.is_bot}}','boolean:equal','false'),
    p('{{2.message.chat.type}}','text:equal','private')
  ]);
  assert.ok(check(x).problems.includes('PRIVATE_NOT_PERMITTED'));
});
test('reject malformed Make filter flat conditions even on a downstream disabled module',()=>{
  const x=fixture(5988323);
  x.modules[2].filter={name:'bad',conditions:[p('{{3.message}}','exist')]};
  assert.ok(check(x).problems.includes('INVALID_FILTER_SHAPE_MODULE_600'));
});
test('reject first hop guard moved away from the trigger',()=>{
  const x=fixture(5988323);x.modules[1].follows=111;
  assert.ok(check(x).problems.includes('MISSING_FIRST_HOP_GUARD'));
});
test('reject missing callback coverage on primary staging ingress',()=>{
  const x=fixture(5988323);
  x.modules[1].filter.conditions=x.modules[1].filter.conditions.filter(c=>!c[0].a.includes('callback_query'));
  assert.ok(check(x).problems.includes('CALLBACK_SCOPE_MISMATCH'));
});
test('reject unknown/unreviewed scenario IDs',()=>{
  const x=fixture(5988323);x.scenario.id=987654;
  assert.deepEqual(check(x).problems,['UNKNOWN_SCENARIO_ID']);
});
