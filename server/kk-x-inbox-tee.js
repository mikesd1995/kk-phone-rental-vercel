'use strict';
const XWebhook=require('./kk-x-webhook');
const XAdapter=require('./kk-x-inbox-adapter');

async function persistVerifiedPayload(payload,persistFn){
 if(typeof persistFn!=='function')return {status:'DISABLED_NO_STORE',writes:0,duplicates:0,skipped:0,failures:0};
 const raw=XWebhook.inboundEvents(payload);
 let writes=0,duplicates=0,skipped=0,failures=0;
 for(const event of raw){
  const normalized=XAdapter.normalizeDmEvent({
   id:event.id,
   sender_id:event.sender_id,
   type:'message_create',
   created_at:event.created_timestamp,
   message_create:{message_data:{text:event.text}}
  });
  if(!normalized){skipped++;continue;}
  try{
   const receipt=await persistFn(normalized);
   if(receipt&&receipt.duplicate)duplicates++;
   else writes+=Number(receipt&&receipt.writes||1);
  }catch(_){failures++;}
 }
 return {status:failures?'PARTIAL':'OK',writes,duplicates,skipped,failures};
}
module.exports={persistVerifiedPayload};
