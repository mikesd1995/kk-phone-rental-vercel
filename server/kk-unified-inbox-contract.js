'use strict';

const crypto = require('crypto');
const VERSION = 'KK_UNIFIED_INBOX_V1';
const CHANNELS = Object.freeze(['line','x']);
const STATUSES = Object.freeze(['new','open','waiting_customer','booked','closed']);

function text(v){ return String(v == null ? '' : v).trim(); }
function requireChannel(channel){
  const value=text(channel).toLowerCase();
  if(!CHANNELS.includes(value)) throw Object.assign(new Error('unsupported inbox channel'),{code:'UNSUPPORTED_INBOX_CHANNEL'});
  return value;
}
function stableId(prefix, value){
  return prefix+'_'+crypto.createHash('sha256').update(text(value)).digest('hex').slice(0,24);
}
function normalizeInbound(input={}){
  const channel=requireChannel(input.channel);
  const externalMessageId=text(input.external_message_id);
  const externalUserId=text(input.external_user_id);
  if(!externalMessageId) throw Object.assign(new Error('external_message_id required'),{code:'INBOX_MESSAGE_ID_REQUIRED'});
  if(!externalUserId) throw Object.assign(new Error('external_user_id required'),{code:'INBOX_USER_ID_REQUIRED'});
  return {
    schema_version:VERSION,
    message_id:stableId('msg',channel+':'+externalMessageId),
    conversation_id:stableId('conv',channel+':'+externalUserId),
    channel,
    direction:'inbound',
    external_message_id:externalMessageId,
    external_user_id:externalUserId,
    display_name:text(input.display_name),
    message_type:text(input.message_type)||'text',
    text:text(input.text),
    received_at:text(input.received_at)||new Date().toISOString(),
    redelivery:input.redelivery===true,
    raw_ref:text(input.raw_ref),
    line_message_id:channel==='line'?text(input.line_message_id):'',
    status:'new'
  };
}
function outboundDraft(input={}){
  const channel=requireChannel(input.channel);
  const conversationId=text(input.conversation_id);
  const body=text(input.text);
  if(!conversationId) throw Object.assign(new Error('conversation_id required'),{code:'INBOX_CONVERSATION_REQUIRED'});
  if(!body) throw Object.assign(new Error('message text required'),{code:'INBOX_TEXT_REQUIRED'});
  return {
    schema_version:VERSION,
    draft_id:'draft_'+crypto.randomUUID().replace(/-/g,''),
    conversation_id:conversationId,
    channel,
    text:body,
    owner_review_required:true,
    send_authorized:false,
    production_writes:0,
    created_at:new Date().toISOString()
  };
}
function authorizeSend(draft={}, actor='owner'){
  if(draft.owner_review_required!==true) throw Object.assign(new Error('owner review contract missing'),{code:'OWNER_REVIEW_CONTRACT_MISSING'});
  return {...draft,send_authorized:true,authorized_by:text(actor)||'owner',authorized_at:new Date().toISOString()};
}
module.exports={VERSION,CHANNELS,STATUSES,requireChannel,normalizeInbound,outboundDraft,authorizeSend};
