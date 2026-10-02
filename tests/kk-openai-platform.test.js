'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Platform=require('../server/kk-openai-platform.js');
const Agents=require('../server/kk-openai-agent-adapters.js');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const Gateway=require('../server/kk-agent-gateway.js');

function fakeResponse(output,{status=200,requestId='req_test',id='resp_test'}={}){
  return {
    ok:status>=200&&status<300,
    status,
    headers:{get(name){return String(name).toLowerCase()==='x-request-id'?requestId:'';}},
    async json(){
      return {
        id,
        output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}],
        usage:{input_tokens:100,output_tokens:50,total_tokens:150}
      };
    }
  };
}

test('OpenAI platform is disabled by default and never calls the network',async()=>{
  let calls=0;
  const out=await Platform.callStructured({agent:'discovery',schema_name:'x',schema:{type:'object'},input_text:'x'},{
    env:{},
    fetchImpl:async()=>{calls++;throw new Error('must not run');}
  });
  assert.equal(out.status,'DISABLED_OPENAI_PLATFORM');
  assert.equal(out.production_writes,0);
  assert.equal(calls,0);
});

test('enabled platform fails closed when API key is absent',async()=>{
  let calls=0;
  const out=await Platform.callStructured({agent:'storefront',schema_name:'x',schema:{type:'object'},input_text:'x'},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'true'},
    fetchImpl:async()=>{calls++;throw new Error('must not run');}
  });
  assert.equal(out.status,'BLOCKED_OPENAI_CONFIG');
  assert.equal(out.blocker,'OPENAI_API_KEY_MISSING');
  assert.equal(calls,0);
});

test('inbox customer data requires a separate explicit authorization flag',async()=>{
  let calls=0;
  const out=await Agents.draftInboxReply({message_text:'ชื่อ Mike เบอร์ 0800000000'},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',OPENAI_API_KEY:'test'},
    fetchImpl:async()=>{calls++;throw new Error('must not run');}
  });
  assert.equal(out.status,'BLOCKED_CUSTOMER_DATA_NOT_AUTHORIZED');
  assert.equal(out.production_writes,0);
  assert.equal(calls,0);
});

test('storefront AI reviewer sends strict Responses API request with image evidence and stays read-only',async()=>{
  let captured=null;
  const output={overall_status:'REVISE',summary:'Card hierarchy needs work',findings:[{severity:'P1',code:'CARD_OVERFLOW',evidence:'right edge clips',recommended_action:'contain card width',acceptance_test:'no overflow'}],production_writes:0,auto_merge:false,auto_deploy:false};
  const out=await Agents.reviewStorefront({
    target:'storefront',
    metrics:{viewport_width_px:1440,card_columns:2},
    design_council:{status:'REVIEW_COMPLETE'},
    page_text:'KK Phone Rental',
    image_urls:['https://example.com/storefront.png','file:///etc/passwd']
  },{
    env:{KK_OPENAI_PLATFORM_ENABLED:'true',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async(url,init)=>{captured={url,init,body:JSON.parse(init.body)};return fakeResponse(output);}
  });
  assert.equal(out.status,'READY_FOR_DESIGN_SYNTHESIS');
  assert.equal(out.production_writes,0);
  assert.equal(out.review.findings[0].severity,'P1');
  assert.equal(captured.url,'https://api.openai.com/v1/responses');
  assert.equal(captured.body.model,'gpt-6-sol');
  assert.equal(captured.body.store,false);
  assert.equal(captured.body.text.format.type,'json_schema');
  assert.equal(captured.body.text.format.strict,true);
  assert.equal(captured.body.input[0].content.filter(x=>x.type==='input_image').length,1);
  assert.match(captured.init.headers.authorization,/^Bearer /);
});

test('discovery reasoner is non-authoritative and verifier-gated',async()=>{
  const output={classification:'concert',rental_fit_score:88,duplicate_risk:'LOW',reasoning_summary:'strong concert rental fit',evidence_gaps:['venue confirmation'],verifier_questions:['confirm venue'],authoritative:false,verifier_required:true,production_writes:0};
  const out=await Agents.reasonDiscovery({candidate:{title:'Example Concert'}},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async()=>fakeResponse(output)
  });
  assert.equal(out.status,'ADVISORY_READY_FOR_VERIFIER');
  assert.equal(out.authoritative,false);
  assert.equal(out.verifier_required,true);
  assert.equal(out.production_writes,0);
  assert.equal(out.advisory.rental_fit_score,88);
});

test('unsafe discovery model output is blocked even if provider returned JSON',async()=>{
  const output={classification:'concert',rental_fit_score:99,duplicate_risk:'LOW',reasoning_summary:'x',evidence_gaps:[],verifier_questions:[],authoritative:true,verifier_required:false,production_writes:1};
  const out=await Agents.reasonDiscovery({candidate:{title:'Example'}},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async()=>fakeResponse(output)
  });
  assert.equal(out.status,'BLOCKED_UNSAFE_MODEL_OUTPUT');
  assert.ok(out.blockers.includes('MODEL_CLAIMS_AUTHORITY'));
  assert.ok(out.blockers.includes('VERIFIER_NOT_REQUIRED'));
  assert.ok(out.blockers.includes('PRODUCTION_WRITES_NONZERO'));
  assert.equal(Object.hasOwn(out,'advisory'),false);
});

test('inbox AI can only return an owner-reviewed draft and never authorize send or booking writes',async()=>{
  const output={intent:'booking',summary:'Customer wants a phone package',extracted:{customer_name:'Mike',phone:'0800000000',event_name:'Example',event_date:'2026-10-10',package_request:'phone',pickup_time:'14:00'},reply_draft:'รับข้อมูลแล้ว เดี๋ยวตรวจคิวให้ค่ะ',owner_review_required:true,send_authorized:false,booking_write_authorized:false,production_writes:0};
  const out=await Agents.draftInboxReply({channel:'line',message_text:'ขอจอง Example',business_context:{verified:true}},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',KK_OPENAI_ALLOW_CUSTOMER_DATA:'1',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async()=>fakeResponse(output)
  });
  assert.equal(out.status,'DRAFT_READY_FOR_OWNER_REVIEW');
  assert.equal(out.owner_review_required,true);
  assert.equal(out.send_authorized,false);
  assert.equal(out.booking_write_authorized,false);
  assert.equal(out.production_writes,0);
});

test('provider HTTP failure remains fail-closed and does not expose raw input',async()=>{
  const secret='customer private text';
  const out=await Agents.reasonDiscovery({candidate:{title:secret}},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async()=>fakeResponse({}, {status:429,requestId:'req_rate'})
  });
  assert.equal(out.status,'BLOCKED_OPENAI_PROVIDER');
  assert.equal(out.request_id,'req_rate');
  assert.equal(JSON.stringify(out).includes(secret),false);
  assert.equal(out.production_writes,0);
});

test('model routing defaults to cost-aware Luna for discovery/inbox and Sol for storefront',()=>{
  assert.equal(Platform.modelFor('storefront',{}),'gpt-6-sol');
  assert.equal(Platform.modelFor('discovery',{}),'gpt-6-luna');
  assert.equal(Platform.modelFor('inbox',{}),'gpt-6-luna');
  assert.equal(Platform.modelFor('storefront',{KK_OPENAI_MODEL_STOREFRONT:'custom-model'}),'custom-model');
});


test('OpenAI agents are registered as callable zero-write gateway routes',async()=>{
  const audit=Registry.runtimeProofAudit();
  assert.equal(audit.pass,true);
  assert.equal(Registry.routeForIntent('storefront_ai_review').required_agents.length,8);
  assert.ok(Registry.routeForIntent('storefront_ai_review').required_agents.includes('kk-openai-storefront-reviewer'));
  assert.ok(Registry.routeForIntent('storefront_ai_review').required_agents.includes('kk-storefront-visual-critic'));
  assert.deepEqual(Registry.routeForIntent('ultra_deep_ai_reasoning').downstream_agents,['kk-event-verifier']);
  assert.equal(Registry.routeForIntent('unified_inbox_ai_draft').owner_review_required,true);
  const disabled=await Router.executeTask('storefront_ai_review',{target:'test'},{env:{},fetchImpl:async()=>{throw new Error('no network');}});
  assert.equal(disabled.invoked_agents.length,8);
  assert.ok(disabled.invoked_agents.includes('kk-openai-storefront-reviewer'));
  assert.equal(disabled.result.status,'DISABLED_OPENAI_PLATFORM');
  assert.equal(disabled.result.ai_review.status,'DISABLED_OPENAI_PLATFORM');
  assert.equal(disabled.result.deterministic_council.reviews.length,7);
  assert.equal(disabled.result.production_writes,0);
});


test('Ultra Deep AI route always carries deterministic gap planning and stays verifier-gated',async()=>{
  const out=await Router.executeTask('ultra_deep_ai_reasoning',{observations:[]},{env:{},fetchImpl:async()=>{throw new Error('no network');}});
  assert.deepEqual(out.invoked_agents,['kk-discovery-source-watch','kk-discovery-scanner','kk-openai-discovery-reasoner']);
  assert.equal(out.result.deterministic_plan.status,'SEARCH_GAPS_REQUIRED');
  assert.equal(out.result.ai_reasoning.status,'DISABLED_OPENAI_PLATFORM');
  assert.equal(out.result.authoritative,false);
  assert.equal(out.result.verifier_required,true);
  assert.equal(out.result.production_writes,0);
});


test('image evidence rejects local/private network URLs and accepts public HTTPS/data images',()=>{
  assert.equal(Platform.allowedImageUrl('https://example.com/a.png'),true);
  assert.equal(Platform.allowedImageUrl('data:image/png;base64,AAAA'),true);
  assert.equal(Platform.allowedImageUrl('file:///tmp/a.png'),false);
  assert.equal(Platform.allowedImageUrl('https://localhost/a.png'),false);
  assert.equal(Platform.allowedImageUrl('https://127.0.0.1/a.png'),false);
  assert.equal(Platform.allowedImageUrl('https://10.0.0.5/a.png'),false);
  assert.equal(Platform.allowedImageUrl('https://192.168.1.9/a.png'),false);
  assert.equal(Platform.allowedImageUrl('https://172.20.0.2/a.png'),false);
});

test('safety metadata cannot be overridden by model/provider extras',async()=>{
  const output={classification:'concert',rental_fit_score:60,duplicate_risk:'LOW',reasoning_summary:'x',evidence_gaps:[],verifier_questions:[],authoritative:false,verifier_required:true,production_writes:0};
  const out=await Agents.reasonDiscovery({candidate:{title:'x'}},{
    env:{KK_OPENAI_PLATFORM_ENABLED:'1',OPENAI_API_KEY:'sk-test'},
    fetchImpl:async()=>fakeResponse(output)
  });
  assert.equal(out.production_writes,0);
  assert.equal(out.auto_merge,false);
  assert.equal(out.auto_deploy,false);
});


test('authenticated Agent Gateway path records hybrid OpenAI route evidence without raw payload persistence',async()=>{
  const rows=[];
  const result=await Gateway.executeAgentRequest({
    task_type:'storefront_ai_review',
    correlation_id:'openai-gateway-test',
    input:{target:'test storefront',page_text:'private-looking fixture text'}
  },{
    env:{},
    projectMemoryBypass:true,
    ledgerFn:async row=>{rows.push(row);return {ok:true,inserted:true,invocation_id:row.invocation_id};},
    fetchImpl:async()=>{throw new Error('network must remain disabled');}
  });
  assert.equal(result.status,'RECORDED');
  assert.equal(result.result.ai_review.status,'DISABLED_OPENAI_PLATFORM');
  assert.equal(result.invocation.required_agents.length,8);
  assert.equal(result.invocation.invoked_agents.length,8);
  assert.equal(rows.length,1);
  assert.match(rows[0].request_hash,/^[0-9a-f]{64}$/);
  assert.match(rows[0].truth_hash,/^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(rows[0]).includes('private-looking fixture text'),false);
  assert.equal(result.production_writes,0);
});


test('OpenAI API key is never forwarded to an environment-controlled alternate origin',()=>{
  assert.equal(Platform.configState({KK_OPENAI_BASE_URL:'https://proxy.example.com/v1'}).base_url,'https://api.openai.com/v1');
  assert.equal(Platform.configState({KK_OPENAI_BASE_URL:'http://127.0.0.1/v1'}).base_url,'https://api.openai.com/v1');
});
