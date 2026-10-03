#!/usr/bin/env node
'use strict';
const Gateway=require('../server/kk-agent-gateway.js');
const CodeIntel=require('../server/kk-code-intelligence.js');
const path=require('path');
(async()=>{
 const task='Audit PR 430 Unified Inbox: LINE/X ingress isolation, idempotency, provider fail-closed boundaries, Admin Inbox mobile UX, disabled outbound, and regression scope';
 const pack=CodeIntel.contextPack(task,{root:path.resolve(__dirname,'..')});
 if(!(pack.selected_files||[]).length) throw Object.assign(new Error('code intelligence returned empty context'),{code:'INBOX_CODE_CONTEXT_EMPTY'});
 const result=await Gateway.executeAgentRequest({
  task_type:'admin_unified_inbox_review',
  correlation_id:'pr430-unified-inbox-review',
  input:{
   code_context:{query:task,matched_routes:pack.matched_routes||[],files:(pack.selected_files||[]).map(item=>item.path),tests:pack.targeted_tests||[],targeted_test_command:CodeIntel.targetedTestCommand(pack)},
   reliability_observations:[],
   reliability_invariants:[
    'LINE Inbox persistence is a post-signature isolated tee and must not replace or retry the existing Booking path.',
    'Provider redelivery persists exactly once by deterministic provider/message identity.',
    'Admin outbound, provider sends, auto-merge and production business writes remain disabled.',
    'LINE durable-store and X provider activation require separate real-provider acceptance.'
   ],
   ux:{viewport:{width:390,height:844},platform:'ios',metrics:{document_scroll_width_px:390,content_width_px:390,min_form_control_font_px:16,tap_targets:[{id:'inbox-search',width:320,height:44},{id:'channel-filter',width:160,height:44},{id:'status-filter',width:180,height:44}],filter_rows:1,card_columns:1,card_min_width_px:320},screenshot_observations:[]}
  }
 },{ledgerFn:async row=>({ok:true,inserted:true,invocation_id:row.invocation_id,mode:'BOUNDED_LOCAL_EVIDENCE'})});
 console.log(JSON.stringify({status:result.status,invoked_agents:result.invocation&&result.invocation.invoked_agents,result:result.result,production_writes:result.production_writes,publishes:result.publishes},null,2));
 if(result.status!=='RECORDED')process.exitCode=2;
 else if(!result.result||!result.result.code_context||!Array.isArray(result.result.code_context.files)||!result.result.code_context.files.length)process.exitCode=3;
})().catch(e=>{console.error(e&&e.stack||String(e));process.exitCode=1;});
