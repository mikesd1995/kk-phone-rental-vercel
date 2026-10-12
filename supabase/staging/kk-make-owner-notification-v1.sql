-- KK Phone Rental — owner-only Make transport reservation ledger, stage-gated.
-- Migration is NOT deployed by merging this source; apply only after controlled
-- Supabase project binding, security review and source-of-truth acceptance.
-- The canonical booking/event/price and Notification_Ledger are never mutated here.

create table if not exists public.kk_make_owner_notification_outbox (
  notification_id text primary key,
  request_id text not null unique,
  event_type text not null check (event_type in ('OWNER_ALERT','OWNER_APPROVAL_PREVIEW')),
  entity_id text not null,
  content_version text not null check (content_version ~ '^[a-f0-9]{64}$'),
  text_sha256 text not null check (text_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RESERVED','SENT','FAILED_REQUIRES_REVIEW','EXPIRED')),
  receipt_id uuid unique,
  reserved_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  constraint kk_make_notify_expiry_bound check (
    expires_at > created_at and expires_at <= created_at + interval '2 minutes'
  )
);
create index if not exists kk_make_owner_notify_status_idx
  on public.kk_make_owner_notification_outbox(status,expires_at);
alter table public.kk_make_owner_notification_outbox enable row level security;
revoke all on public.kk_make_owner_notification_outbox from public, anon, authenticated;
grant select, insert, update on public.kk_make_owner_notification_outbox to service_role;

create or replace function public.kk_make_owner_notification_claim(
  p_notification_id text, p_request_id text, p_event_type text,
  p_entity_id text, p_content_version text, p_text_sha256 text,
  p_expires_at timestamptz
) returns table(status text,receipt_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.kk_make_owner_notification_outbox as n
  set status='RESERVED', receipt_id=gen_random_uuid(), reserved_at=now()
  where n.notification_id=p_notification_id
    and n.request_id=p_request_id
    and n.event_type=p_event_type
    and n.entity_id=p_entity_id
    and n.content_version=p_content_version
    and n.text_sha256=p_text_sha256
    and n.expires_at=p_expires_at
    and n.expires_at>now()
    and n.status='QUEUED'
  returning 'RESERVED'::text,n.receipt_id;
end;
$$;
revoke all on function public.kk_make_owner_notification_claim(text,text,text,text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.kk_make_owner_notification_claim(text,text,text,text,text,text,timestamptz)
  to service_role;

create or replace function public.kk_make_owner_notification_ack(
  p_notification_id text, p_receipt_id uuid, p_provider_message_id text
) returns table(status text,provider_message_id text)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_provider_message_id !~ '^[0-9]{1,20}$' then
    return;
  end if;
  return query
  update public.kk_make_owner_notification_outbox as n
  set status='SENT', provider_message_id=p_provider_message_id, delivered_at=now()
  where n.notification_id=p_notification_id
    and n.receipt_id=p_receipt_id
    and n.status='RESERVED'
  returning 'SENT'::text,n.provider_message_id;
end;
$$;
revoke all on function public.kk_make_owner_notification_ack(text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.kk_make_owner_notification_ack(text,uuid,text)
  to service_role;
