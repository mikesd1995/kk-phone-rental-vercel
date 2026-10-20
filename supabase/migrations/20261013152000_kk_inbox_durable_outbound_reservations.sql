-- Draft-only additive migration. DO NOT apply to production without owner-reviewed gate.
-- Durable, fail-closed reservation BEFORE LINE sends. No Booking or customer PII writes.
create table if not exists kk_private.inbox_outbound_attempts (
  request_id uuid primary key,
  conversation_id text not null references kk_private.inbox_conversations(conversation_id),
  body_fingerprint text not null check (body_fingerprint ~ '^[a-f0-9]{64}$'),
  retry_key uuid not null default gen_random_uuid() unique,
  status text not null default 'RESERVED' check (status in ('RESERVED','SENT','UNCERTAIN')),
  provider_message_id text not null default '',
  provider_request_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kk_inbox_outbound_dedupe
  on kk_private.inbox_outbound_attempts(conversation_id,body_fingerprint,created_at desc);
alter table kk_private.inbox_outbound_attempts enable row level security;
revoke all on kk_private.inbox_outbound_attempts from public,anon,authenticated;
grant select,insert,update on kk_private.inbox_outbound_attempts to service_role;

-- Transactional advisory lock serializes even different request IDs for same recipient+body.
-- For identical text within 30 days, fail closed; intentional repeats need separately
-- designed owner reconciliation/override (not shipped here).
create or replace function public.kk_inbox_reserve_outbound(
 p_request_id uuid,p_conversation_id text,p_body_fingerprint text
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,kk_private
as $$
declare
 v_match kk_private.inbox_outbound_attempts%rowtype;
 v_new kk_private.inbox_outbound_attempts%rowtype;
begin
 if p_request_id is null or p_conversation_id is null
    or p_body_fingerprint !~ '^[a-f0-9]{64}$' then
   raise exception 'outbound reservation identity invalid';
 end if;
 if not exists(
   select 1 from kk_private.inbox_conversations
   where conversation_id=p_conversation_id and channel='line'
 ) then
   raise exception 'outbound conversation not found';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id||':'||p_body_fingerprint,0));
 select * into v_match from kk_private.inbox_outbound_attempts
 where request_id=p_request_id;
 if found then
   if v_match.conversation_id<>p_conversation_id or v_match.body_fingerprint<>p_body_fingerprint then
     return jsonb_build_object('allowed',false,'status','REQUEST_CONFLICT');
   end if;
   return jsonb_build_object('allowed',false,'status','ALREADY_RESERVED');
 end if;
 select * into v_match from kk_private.inbox_outbound_attempts
 where conversation_id=p_conversation_id and body_fingerprint=p_body_fingerprint
   and created_at >= now() - interval '30 days'
 order by created_at desc limit 1;
 if found then
   return jsonb_build_object('allowed',false,'status','DUPLICATE_CONTENT_UNDER_REVIEW');
 end if;
 insert into kk_private.inbox_outbound_attempts
  (request_id,conversation_id,body_fingerprint)
 values (p_request_id,p_conversation_id,p_body_fingerprint)
 returning * into v_new;
 return jsonb_build_object('allowed',true,'status','RESERVED','retry_key',v_new.retry_key::text);
end;
$$;
revoke all on function public.kk_inbox_reserve_outbound(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_reserve_outbound(uuid,text,text) to service_role;

-- Even if this update fails, the durable RESERVED row prevents a second provider call.
create or replace function public.kk_inbox_finish_outbound(
 p_request_id uuid,p_status text,p_provider_message_id text default '',
 p_provider_request_id text default ''
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,kk_private
as $$
declare
 v_row kk_private.inbox_outbound_attempts%rowtype;
 v_provider text:=btrim(coalesce(p_provider_message_id,''));
 v_request text:=btrim(coalesce(p_provider_request_id,''));
 v_persisted_request text;
begin
 if p_request_id is null or p_status is null or p_status not in ('SENT','UNCERTAIN') then
   raise exception 'outbound completion status invalid';
 end if;
 select * into v_row from kk_private.inbox_outbound_attempts
 where request_id=p_request_id for update;
 if not found then raise exception 'outbound reservation missing'; end if;
 -- Once known, provider identities are immutable, including after owner review.
 if (nullif(btrim(v_row.provider_message_id),'') is not null and
     v_provider<>'' and v_provider<>btrim(v_row.provider_message_id)) or
    (nullif(btrim(v_row.provider_request_id),'') is not null and
     v_request<>'' and v_request<>btrim(v_row.provider_request_id)) then
   raise exception 'outbound provider receipt conflict';
 end if;
 -- Preserve an already accepted receipt and its review evidence byte-for-byte.
 if v_row.status='SENT' then
   return jsonb_build_object('status','SENT','request_id',v_row.request_id::text);
 end if;
 if p_status='SENT' then
   v_provider=coalesce(nullif(v_provider,''),nullif(btrim(v_row.provider_message_id),''),'');
   if v_provider='' then raise exception 'outbound persisted provider receipt required'; end if;
   -- The real server records the outbound message before completing its ledger.
   -- A provider ID alone is not durable proof for this conversation/request/key.
   select btrim(coalesce(m.payload->>'provider_request_id',''))
   into v_persisted_request
   from kk_private.inbox_messages m
   where m.conversation_id=v_row.conversation_id and m.channel='line'
     and m.direction='outbound' and m.message_type='text'
     and m.external_message_id=v_provider
     and lower(btrim(coalesce(m.payload->>'outbound_request_id','')))=v_row.request_id::text
     and lower(btrim(coalesce(m.payload->>'retry_key','')))=v_row.retry_key::text;
   if not found then raise exception 'outbound persisted provider receipt required'; end if;
   if (v_request<>'' and v_request<>v_persisted_request) or
      (nullif(btrim(v_row.provider_request_id),'') is not null and
       btrim(v_row.provider_request_id)<>v_persisted_request) then
     raise exception 'outbound provider receipt conflict';
   end if;
   -- LINE's request header is optional; preserve exactly the persisted value.
   v_request=v_persisted_request;
 end if;
 update kk_private.inbox_outbound_attempts
 set status=p_status,
     provider_message_id=coalesce(nullif(v_provider,''),provider_message_id),
     provider_request_id=coalesce(nullif(v_request,''),provider_request_id),
     updated_at=now()
 where request_id=p_request_id
 returning * into v_row;
 return jsonb_build_object('status',v_row.status,'request_id',v_row.request_id::text);
end;
$$;
revoke all on function public.kk_inbox_finish_outbound(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_finish_outbound(uuid,text,text,text) to service_role;

comment on table kk_private.inbox_outbound_attempts is
 'Private outbound send reservation ledger; HMAC fingerprint only. No customer text. Service-role only. No automatic replay of uncertain sends.';
