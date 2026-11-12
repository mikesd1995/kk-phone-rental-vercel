-- KK Phone Rental — customer LINE Login / Terms evidence, source-only migration.
-- NOT applied to any database by this commit. Independent DBA/security review required.
-- Only a server-held service-role credential may call the RPCs. Never expose it in browser.
-- Existing Inbox, bookings, Admin and Owner Locks remain unchanged.

begin;

create table if not exists public.kk_customer_line_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  provider_id text not null check (length(provider_id) between 1 and 128),
  line_user_id text not null check (line_user_id ~ '^U[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists kk_customer_line_sessions_expiry
  on public.kk_customer_line_sessions (expires_at);

create table if not exists public.kk_customer_terms_evidence (
  id bigint generated always as identity primary key,
  provider_id text not null check (length(provider_id) between 1 and 128),
  line_user_id text not null check (line_user_id ~ '^U[0-9a-f]{32}$'),
  terms_version text not null check (length(terms_version) between 1 and 80),
  accepted_at timestamptz not null default now(),
  evidence_source text not null check (evidence_source in ('AUTHENTICATED_WEB_ACTION', 'SIGNED_LINE_WEBHOOK')),
  evidence_reference text not null unique check (length(evidence_reference) between 12 and 160),
  evidence_verified boolean not null default true check (evidence_verified = true),
  constraint kk_customer_terms_identity_version_key unique (provider_id, line_user_id, terms_version)
);
create index if not exists kk_customer_terms_identity
  on public.kk_customer_terms_evidence (provider_id, line_user_id, terms_version);

alter table public.kk_customer_line_sessions enable row level security;
alter table public.kk_customer_terms_evidence enable row level security;
revoke all on table public.kk_customer_line_sessions from public, anon, authenticated;
revoke all on table public.kk_customer_terms_evidence from public, anon, authenticated;
revoke all on sequence public.kk_customer_terms_evidence_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.kk_customer_line_sessions to service_role;
grant select, insert on table public.kk_customer_terms_evidence to service_role;
grant usage, select on sequence public.kk_customer_terms_evidence_id_seq to service_role;

create or replace function public.kk_customer_session_create(
  p_token_hash text, p_provider_id text, p_line_user_id text, p_expires_at timestamptz
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
     or length(p_provider_id) not between 1 and 128
     or p_line_user_id !~ '^U[0-9a-f]{32}$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '7 days 5 minutes'
  then raise exception 'CUSTOMER_SESSION_INVALID'; end if;
  insert into public.kk_customer_line_sessions(token_hash, provider_id, line_user_id, expires_at)
  values (p_token_hash, p_provider_id, p_line_user_id, p_expires_at);
  return true;
end; $$;

create or replace function public.kk_customer_session_lookup(
  p_token_hash text
) returns table(provider_id text, line_user_id text)
language sql security invoker set search_path = ''
as $$
  select s.provider_id, s.line_user_id from public.kk_customer_line_sessions s
  where s.token_hash = p_token_hash and s.expires_at > now() and s.revoked_at is null
  limit 1;
$$;

create or replace function public.kk_customer_session_revoke(
  p_token_hash text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare n integer;
begin
  update public.kk_customer_line_sessions
  set revoked_at = now()
  where token_hash = p_token_hash and revoked_at is null;
  get diagnostics n = row_count;
  return n > 0;
end; $$;

create or replace function public.kk_customer_terms_lookup(
  p_token_hash text, p_terms_version text
) returns table(provider_id text, line_user_id text, terms_version text,
                accepted_at timestamptz, evidence_source text,
                evidence_reference text, evidence_verified boolean)
language sql security invoker set search_path = ''
as $$
  select e.provider_id, e.line_user_id, e.terms_version, e.accepted_at,
         e.evidence_source, e.evidence_reference, e.evidence_verified
  from public.kk_customer_line_sessions s
  join public.kk_customer_terms_evidence e
    on e.provider_id = s.provider_id and e.line_user_id = s.line_user_id
  where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now()
    and e.terms_version = p_terms_version
  limit 1;
$$;

create or replace function public.kk_customer_terms_accept(
  p_token_hash text, p_terms_version text, p_evidence_reference text
) returns table(provider_id text, line_user_id text, terms_version text,
                accepted_at timestamptz, evidence_source text,
                evidence_reference text, evidence_verified boolean)
language plpgsql security invoker set search_path = ''
as $$
declare v_provider text; v_user text;
begin
  if p_terms_version !~ '^KK-TERMS-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or p_evidence_reference !~ '^web:[A-Za-z0-9_-]{20,128}$'
  then raise exception 'CUSTOMER_TERMS_REQUEST_INVALID'; end if;
  select s.provider_id, s.line_user_id into v_provider, v_user
  from public.kk_customer_line_sessions s
  where s.token_hash = p_token_hash and s.expires_at > now() and s.revoked_at is null;
  if not found then raise exception 'CUSTOMER_SESSION_EXPIRED'; end if;
  insert into public.kk_customer_terms_evidence (
    provider_id, line_user_id, terms_version, evidence_source, evidence_reference, evidence_verified
  ) values (
    v_provider, v_user, p_terms_version, 'AUTHENTICATED_WEB_ACTION', p_evidence_reference, true
  ) on conflict on constraint kk_customer_terms_identity_version_key do nothing;
  return query select e.provider_id, e.line_user_id, e.terms_version,
                      e.accepted_at, e.evidence_source, e.evidence_reference, e.evidence_verified
  from public.kk_customer_terms_evidence e
  where e.provider_id = v_provider and e.line_user_id = v_user and e.terms_version = p_terms_version
  limit 1;
end; $$;

-- Signed Messaging API webhook identity receipt; server-held service_role only.
create or replace function public.kk_customer_terms_lookup_for_line_webhook(
  p_provider_id text, p_line_user_id text, p_terms_version text
) returns table(provider_id text, line_user_id text, terms_version text,
                accepted_at timestamptz, evidence_source text,
                evidence_reference text, evidence_verified boolean)
language sql security invoker set search_path = ''
as $$
  select e.provider_id, e.line_user_id, e.terms_version, e.accepted_at,
         e.evidence_source, e.evidence_reference, e.evidence_verified
  from public.kk_customer_terms_evidence e
  where e.provider_id = p_provider_id and e.line_user_id = p_line_user_id
    and e.terms_version = p_terms_version and e.evidence_verified is true
    and p_provider_id is not null and length(p_provider_id) between 1 and 128
    and p_line_user_id ~ '^U[0-9a-f]{32}$'
    and p_terms_version ~ '^KK-TERMS-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  limit 1;
$$;

revoke all on function public.kk_customer_terms_lookup_for_line_webhook(text,text,text)
  from public, anon, authenticated;
grant execute on function public.kk_customer_terms_lookup_for_line_webhook(text,text,text)
  to service_role;

revoke all on function public.kk_customer_session_create(text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.kk_customer_session_lookup(text) from public, anon, authenticated;
revoke all on function public.kk_customer_session_revoke(text) from public, anon, authenticated;
revoke all on function public.kk_customer_terms_lookup(text,text) from public, anon, authenticated;
revoke all on function public.kk_customer_terms_accept(text,text,text) from public, anon, authenticated;
grant execute on function public.kk_customer_session_create(text,text,text,timestamptz) to service_role;
grant execute on function public.kk_customer_session_lookup(text) to service_role;
grant execute on function public.kk_customer_session_revoke(text) to service_role;
grant execute on function public.kk_customer_terms_lookup(text,text) to service_role;
grant execute on function public.kk_customer_terms_accept(text,text,text) to service_role;

commit;

-- Security review gates before running migration:
-- 1) confirm this is the OWNER-approved Supabase project and preserve full schema rollback.
-- 2) test anon/authenticated cannot SELECT/INSERT/UPDATE or invoke any of these RPCs.
-- 3) ensure previous table/function names did not exist with other ownership/privileges.
-- 4) separately agree Terms evidence retention, access audit and lawful erasure handling.
-- 5) only then set backend feature flag; no auto-schema mutation from app runtime.
