'use strict';
const Line=require('./kk-line-webhook.js');
const VERSION='KK_LINE_INBOX_TEE_V1';

async function persistVerifiedEvents(events=[], persistFn){
  if(typeof persistFn!=='function') return {schema_version:VERSION,status:'DISABLED_NO_STORE',writes:0,duplicates:0,skipped:0,errors:[]};
  let writes=0,duplicates=0,skipped=0;
  const errors=[];
  for(const event of Array.isArray(events)?events:[]){
    try{
      const message=Line.normalizeEvent(event);
      if(!message){skipped++;continue;}
      const receipt=await persistFn(message);
      if(receipt&&receipt.duplicate===true) duplicates++;
      else writes++;
    }catch(err){
      errors.push({
        webhook_event_id:String(event&&event.webhookEventId||'').trim(),
        code:String(err&&err.code||'INBOX_TEE_EVENT_FAILED'),
        message:String(err&&err.message||'event persistence failed').slice(0,160)
      });
    }
  }
  return {schema_version:VERSION,status:errors.length?'PARTIAL':'ACCEPTED',writes,duplicates,skipped,errors};
}
module.exports={VERSION,persistVerifiedEvents};
