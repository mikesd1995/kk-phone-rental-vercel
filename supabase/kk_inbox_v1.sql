-- KK Unified Inbox v1 durable persistence schema.
-- Apply only to a dedicated/private Supabase project after review.
create schema if not exists kk_private;

create table if not exists kk_private.inbox_messages (
  message_id text primary key,
  conversation_id text not null,
  channel text not null check (channel in ('line','x')),
  external_message_id text not null,
  external_user_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  body_text text not null default '',
  received_at timestamptz,
  sent_at timestamptz,
  redelivery boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(channel, external_message_id)
);
create table if not exists kk_private.inbox_conversations (
  conversation_id text primary key,
  channel text not null check (channel in ('line','x')),
  external_user_id text not null,
  display_name text not null default '',
  status text not null default 'new' check (status in ('new','open','waiting_customer','booked','closed')),
  linked_customer_id text not null default '',
  linked_booking_id text not null default '',
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_message_text text not null default '',
  last_message_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, external_user_id)
);
create table if not exists kk_private.inbox_audit (
  audit_id bigint generated always as identity primary key,
  action text not null,
  conversation_id text not null,
  message_id text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on schema kk_private from public, anon, authenticated;
revoke all on all tables in schema kk_private from public, anon, authenticated;
-- SECURITY INVOKER RPC needs explicit private-schema privileges for the server-only role.
grant usage on schema kk_private to service_role;
grant select, insert, update on kk_private.inbox_messages to service_role;
grant select, insert, update on kk_private.inbox_conversations to service_role;
grant select, insert on kk_private.inbox_audit to service_role;
grant usage, select on all sequences in schema kk_private to service_role;
alter table kk_private.inbox_messages enable row level security;
alter table kk_private.inbox_conversations enable row level security;
alter table kk_private.inbox_audit enable row level security;

create or replace function public.kk_inbox_persist_inbound(p_message jsonb)
returns table(duplicate boolean, writes integer)
language plpgsql
security invoker
set search_path = pg_catalog, kk_private
as $$
declare
  v_message_id text := nullif(btrim(p_message->>'message_id'),'');
  v_conversation_id text := nullif(btrim(p_message->>'conversation_id'),'');
  v_channel text := lower(nullif(btrim(p_message->>'channel'),''));
  v_external_message_id text := nullif(btrim(p_message->>'external_message_id'),'');
  v_external_user_id text := nullif(btrim(p_message->>'external_user_id'),'');
  v_inserted integer := 0;
begin
  if v_message_id is null or v_conversation_id is null or v_external_message_id is null or v_external_user_id is null or v_channel not in ('line','x') then
    raise exception 'invalid inbox message';
  end if;
  insert into kk_private.inbox_messages(message_id,conversation_id,channel,external_message_id,external_user_id,direction,message_type,body_text,received_at,redelivery,payload)
  values(v_message_id,v_conversation_id,v_channel,v_external_message_id,v_external_user_id,'inbound',coalesce(nullif(p_message->>'message_type',''),'text'),coalesce(p_message->>'text',''),nullif(p_message->>'received_at','')::timestamptz,coalesce((p_message->>'redelivery')::boolean,false),p_message)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return query select true,0; return; end if;
  insert into kk_private.inbox_conversations(conversation_id,channel,external_user_id,display_name,status,unread_count,last_message_at,last_message_text,last_message_type)
  values(v_conversation_id,v_channel,v_external_user_id,coalesce(p_message->>'display_name',''),'new',1,nullif(p_message->>'received_at','')::timestamptz,coalesce(p_message->>'text',''),coalesce(p_message->>'message_type','text'))
  on conflict (conversation_id) do update set
    unread_count=kk_private.inbox_conversations.unread_count+1,
    last_message_at=excluded.last_message_at,
    last_message_text=excluded.last_message_text,
    last_message_type=excluded.last_message_type,
    updated_at=now();
  insert into kk_private.inbox_audit(action,conversation_id,message_id,evidence) values('inbound_persisted',v_conversation_id,v_message_id,jsonb_build_object('channel',v_channel));
  return query select false,1;
end $$;

revoke all on function public.kk_inbox_persist_inbound(jsonb) from public, anon, authenticated;
-- Intentionally grant only to service_role; browser clients have no access.
grant execute on function public.kk_inbox_persist_inbound(jsonb) to service_role;


-- Server-only read RPCs for the authenticated Admin Inbox. Browser roles stay revoked.
create or replace function public.kk_inbox_list_conversations(p_channel text default '', p_status text default '', p_search text default '', p_limit integer default 100)
returns jsonb language sql security invoker set search_path=pg_catalog,kk_private as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last),'[]'::jsonb)
 from (select conversation_id,channel,external_user_id,display_name,status,linked_customer_id,linked_booking_id,unread_count,last_message_at,last_message_text,last_message_type,created_at,updated_at
 from kk_private.inbox_conversations
 where (nullif(btrim(p_channel),'') is null or channel=lower(btrim(p_channel)))
 and (nullif(btrim(p_status),'') is null or status=lower(btrim(p_status)))
 and (nullif(btrim(p_search),'') is null or display_name ilike '%'||p_search||'%' or external_user_id ilike '%'||p_search||'%' or last_message_text ilike '%'||p_search||'%' or linked_booking_id ilike '%'||p_search||'%')
 order by last_message_at desc nulls last limit greatest(1,least(coalesce(p_limit,100),200))) x
$$;
create or replace function public.kk_inbox_list_messages(p_conversation_id text,p_limit integer default 200)
returns jsonb language sql security invoker set search_path=pg_catalog,kk_private as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb)
 from (select message_id,conversation_id,channel,external_user_id,direction,message_type,body_text,received_at,sent_at,redelivery,created_at
 from kk_private.inbox_messages where conversation_id=p_conversation_id order by created_at desc limit greatest(1,least(coalesce(p_limit,200),500))) x
$$;
revoke all on function public.kk_inbox_list_conversations(text,text,text,integer) from public,anon,authenticated;
revoke all on function public.kk_inbox_list_messages(text,integer) from public,anon,authenticated;
grant execute on function public.kk_inbox_list_conversations(text,text,text,integer) to service_role;
grant execute on function public.kk_inbox_list_messages(text,integer) to service_role;
