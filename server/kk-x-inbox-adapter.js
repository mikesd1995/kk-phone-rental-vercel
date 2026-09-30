'use strict';

const Inbox = require('./kk-unified-inbox-contract');

function text(v){ return String(v == null ? '' : v).trim(); }
function xCredentials(env=process.env){
  const clientId=text(env.KK_X_CLIENT_ID);
  const clientSecret=text(env.KK_X_CLIENT_SECRET);
  const accessToken=text(env.KK_X_USER_ACCESS_TOKEN);
  if(!clientId || !clientSecret || !accessToken) return null;
  return {clientId,clientSecret,accessToken};
}
function normalizeDmEvent(event={}){
  const eventId=text(event.id || event.event_id);
  const senderId=text(event.sender_id);
  if(!eventId || !senderId) return null;
  const data=event.dm_event || event;
  const body=data.message_create?.message_data?.text ?? data.text ?? '';
  return Inbox.normalizeInbound({
    channel:'x',
    external_message_id:eventId,
    external_user_id:senderId,
    display_name:text(event.sender_username || event.username),
    message_type:text(event.type)||'MessageCreate',
    text:body,
    received_at:text(event.created_at),
    raw_ref:eventId
  });
}
function normalizeDmEvents(payload={}){
  const events=Array.isArray(payload.dm_events) ? payload.dm_events : Array.isArray(payload.data) ? payload.data : [];
  return events.map(normalizeDmEvent).filter(Boolean);
}
function entitlementState(env=process.env){
  return xCredentials(env) ? {status:'CREDENTIALS_PRESENT_UNVERIFIED',production_writes:0} : {status:'DISABLED_NO_CREDENTIALS',production_writes:0};
}
module.exports={xCredentials,normalizeDmEvent,normalizeDmEvents,entitlementState};
