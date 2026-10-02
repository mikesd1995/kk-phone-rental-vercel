'use strict';

const fs=require('node:fs');
const Router=require('../server/kk-agent-task-router.js');
const Platform=require('../server/kk-openai-platform.js');

function emitReport(report,{error=false}={}){
  const body=JSON.stringify(report,null,2)+'\n';
  const outputPath=String(process.env.KK_OPENAI_REPORT_PATH||'').trim();
  if(outputPath){
    fs.writeFileSync(outputPath,body,{encoding:'utf8',mode:0o600});
    return;
  }
  (error?process.stderr:process.stdout).write(body);
}

async function main(){
  const env=process.env;
  const config=Platform.configState(env);
  const rows=[];

  rows.push(await Router.executeTask('storefront_ai_review',{
    target:'KK storefront staging dry-run',
    metrics:{viewport_width_px:390,viewport_height_px:844,card_columns:2,event_card_count:4},
    page_text:'KK Phone Rental staging synthetic review',
    owner_observations:'Synthetic dry-run only. No customer data.'
  },{env}));

  rows.push(await Router.executeTask('ultra_deep_ai_reasoning',{
    candidate:{title:'Synthetic Concert',event_date:'2026-12-31',venue:'Synthetic Hall'},
    observations:[],
    evidence:[{source_tier:'OFFICIAL',source_url:'https://example.com/synthetic-event'}],
    known_events:[]
  },{env}));

  if(config.allow_customer_data){
    rows.push(await Router.executeTask('unified_inbox_ai_draft',{
      channel:'line',
      message_text:'Synthetic customer asks whether a phone is available for Synthetic Concert.',
      conversation_context:'Synthetic test fixture only.',
      business_context:{availability_verified:false}
    },{env}));
  }else{
    rows.push({invoked_agents:['kk-openai-inbox-drafter'],result:{status:'SKIPPED_CUSTOMER_DATA_GATE',production_writes:0}});
  }

  const report={
    schema_version:'KK_OPENAI_AGENT_DRY_RUN_V1',
    enabled:config.enabled,
    api_key_present:config.api_key_present,
    api_key_diagnostics:Platform.apiKeyDiagnostics(env.OPENAI_API_KEY),
    allow_customer_data:config.allow_customer_data,
    models:config.models,
    results:rows.map(row=>{
      const ai=row.result&&(
        row.result.ai_review||
        row.result.ai_reasoning||
        row.result
      )||{};
      return {
        invoked_agents:row.invoked_agents,
        status:row.result&&row.result.status,
        ai_status:ai.status||row.result&&row.result.status,
        model:ai.model||'',
        blocker:ai.blocker||'',
        http_status:Number(ai.http_status)||0,
        provider_error_type:ai.provider_error_type||'',
        provider_error_code:ai.provider_error_code||'',
        provider_error_param:ai.provider_error_param||'',
        request_id:ai.request_id||'',
        retry_after:ai.retry_after||'',
        production_writes:Number(row.result&&row.result.production_writes)||0
      };
    })
  };
  if(report.results.some(row=>row.production_writes!==0)) process.exitCode=2;
  emitReport(report);
}

main().catch(error=>{
  emitReport({
    schema_version:'KK_OPENAI_AGENT_DRY_RUN_V1',
    status:'FAILED',
    error_code:String(error&&(error.code||error.name)||'ERROR'),
    production_writes:0
  },{error:true});
  process.exitCode=1;
});
