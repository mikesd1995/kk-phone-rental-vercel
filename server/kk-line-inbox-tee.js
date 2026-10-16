'use strict';
const Line=require('./kk-line-webhook.js');
const Media=require('./kk-inbox-media.js');
const VERSION='KK_LINE_INBOX_TEE_V2';

async function persistVerifiedEvents(events=[], persistFn, options={}){
  if(typeof persistFn!=='function') return {schema_version:VERSION,status:'DISABLED_NO_STORE',writes:0,duplicates:0,skipped:0,errors:[]};
  let writes=0,duplicates=0,skipped=0,mediaSaved=0;
  const mediaErrors=[];
  const errors=[];
  for(const event of Array.isArray(events)?events:[]){
    try{
      const message=Line.normalizeEvent(event);
      if(!message){skipped++;continue;}
      if(typeof options.profileFn==='function' && message.channel==='line'){
        try{
          const profile=await options.profileFn(message.external_user_id,event);
          if(profile&&profile.display_name) message.display_name=String(profile.display_name).trim();
        }catch(_){ /* profile hydration is fail-soft; inbound persistence must continue */ }
      }
      const receipt=await persistFn(message);
      if(receipt&&receipt.duplicate===true) duplicates++;
      else writes++;
      if(message.message_type==='image'&&typeof options.mediaFn==='function'){
        try{const saved=await options.mediaFn(event,message);if(saved&&saved.saved)mediaSaved++;}
        catch(err){mediaErrors.push({code:Media.diagnosticCode(err)});}
      }
    }catch(err){
      errors.push({
        webhook_event_id:String(event&&event.webhookEventId||'').trim(),
        code:String(err&&err.code||'INBOX_TEE_EVENT_FAILED'),
        message:String(err&&err.message||'event persistence failed').slice(0,160)
      });
    }
  }
  return {schema_version:VERSION,status:errors.length||mediaErrors.length?'PARTIAL':'ACCEPTED',writes,duplicates,skipped,errors,media_saved:mediaSaved,media_errors:mediaErrors};
}
module.exports={VERSION,persistVerifiedEvents};
