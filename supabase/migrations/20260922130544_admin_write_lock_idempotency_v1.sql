create table if not exists public.kk_admin_write_locks (
  scope text primary key,
  holder_request_id text,
  fencing_token bigint not null default 0 check (fencing_token >= 0),
  lease_until timestamptz,
  acquired_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.kk_admin_write_locks enable row level security;
revoke all on table public.kk_admin_write_locks from anon, authenticated;
grant select, insert, update, delete on table public.kk_admin_write_locks to service_role;

insert into public.kk_admin_write_locks(scope, holder_request_id, fencing_token, lease_until, acquired_at, updated_at)
values ('core-admin', null, 0, null, null, now())
on conflict (scope) do nothing;

create table if not exists public.kk_admin_write_receipts (
  request_id text primary key,
  action text not null,
  payload_hash text not null,
  state text not null check (state in ('PREPARED','COMMITTED','FAILED')),
  fencing_token bigint,
  result_hash text,
  result_json jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kk_admin_write_receipts enable row level security;
revoke all on table public.kk_admin_write_receipts from anon, authenticated;
grant select, insert, update, delete on table public.kk_admin_write_receipts to service_role;

create or replace function public.kk_admin_lock_acquire(
  p_scope text,
  p_request_id text,
  p_lease_seconds integer default 20
)
returns table(acquired boolean, fencing_token bigint, lease_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token bigint;
  v_lease timestamptz;
begin
  if p_scope is null or length(trim(p_scope)) < 1 or length(p_scope) > 80 then
    raise exception 'LOCK_SCOPE_INVALID';
  end if;
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 160 then
    raise exception 'LOCK_REQUEST_ID_INVALID';
  end if;
  if p_lease_seconds < 5 or p_lease_seconds > 60 then
    raise exception 'LOCK_LEASE_INVALID';
  end if;

  insert into public.kk_admin_write_locks(scope, holder_request_id, fencing_token, lease_until, acquired_at, updated_at)
  values (p_scope, null, 0, null, null, now())
  on conflict (scope) do nothing;

  update public.kk_admin_write_locks
  set holder_request_id = p_request_id,
      fencing_token = kk_admin_write_locks.fencing_token + 1,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      acquired_at = now(),
      updated_at = now()
  where scope = p_scope
    and (
      holder_request_id = p_request_id
      or lease_until is null
      or lease_until <= now()
    )
  returning kk_admin_write_locks.fencing_token, kk_admin_write_locks.lease_until
  into v_token, v_lease;

  if found then
    return query select true, v_token, v_lease;
  end if;

  return query
  select false, l.fencing_token, l.lease_until
  from public.kk_admin_write_locks l
  where l.scope = p_scope;
end;
$$;

create or replace function public.kk_admin_lock_release(
  p_scope text,
  p_request_id text,
  p_fencing_token bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released boolean := false;
begin
  update public.kk_admin_write_locks
  set holder_request_id = null,
      lease_until = null,
      updated_at = now()
  where scope = p_scope
    and holder_request_id = p_request_id
    and fencing_token = p_fencing_token
  returning true into v_released;
  return coalesce(v_released, false);
end;
$$;

create or replace function public.kk_admin_receipt_prepare(
  p_request_id text,
  p_action text,
  p_payload_hash text,
  p_fencing_token bigint
)
returns table(receipt_state text, created boolean, conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.kk_admin_write_receipts%rowtype;
begin
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 160 then
    raise exception 'RECEIPT_REQUEST_ID_INVALID';
  end if;
  if p_action is null or length(trim(p_action)) < 1 or length(p_action) > 80 then
    raise exception 'RECEIPT_ACTION_INVALID';
  end if;
  if p_payload_hash is null or length(trim(p_payload_hash)) < 32 or length(p_payload_hash) > 128 then
    raise exception 'RECEIPT_HASH_INVALID';
  end if;

  insert into public.kk_admin_write_receipts(
    request_id, action, payload_hash, state, fencing_token, result_json, created_at, updated_at
  )
  values (
    p_request_id, p_action, p_payload_hash, 'PREPARED', p_fencing_token, '{}'::jsonb, now(), now()
  )
  on conflict (request_id) do nothing;

  if found then
    return query select 'PREPARED'::text, true, false;
    return;
  end if;

  select * into v_existing
  from public.kk_admin_write_receipts
  where request_id = p_request_id;

  if v_existing.action <> p_action or v_existing.payload_hash <> p_payload_hash then
    return query select v_existing.state, false, true;
  else
    return query select v_existing.state, false, false;
  end if;
end;
$$;

create or replace function public.kk_admin_receipt_commit(
  p_request_id text,
  p_fencing_token bigint,
  p_result_hash text,
  p_result_json jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done boolean := false;
begin
  update public.kk_admin_write_receipts
  set state = 'COMMITTED',
      fencing_token = p_fencing_token,
      result_hash = p_result_hash,
      result_json = coalesce(p_result_json, '{}'::jsonb),
      error_code = null,
      updated_at = now()
  where request_id = p_request_id
    and state in ('PREPARED','COMMITTED')
  returning true into v_done;
  return coalesce(v_done, false);
end;
$$;

create or replace function public.kk_admin_receipt_fail(
  p_request_id text,
  p_fencing_token bigint,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done boolean := false;
begin
  update public.kk_admin_write_receipts
  set state = 'FAILED',
      fencing_token = p_fencing_token,
      error_code = left(coalesce(p_error_code,'WRITE_FAILED'),120),
      updated_at = now()
  where request_id = p_request_id
    and state = 'PREPARED'
  returning true into v_done;
  return coalesce(v_done, false);
end;
$$;

revoke all on function public.kk_admin_lock_acquire(text,text,integer) from public, anon, authenticated;
revoke all on function public.kk_admin_lock_release(text,text,bigint) from public, anon, authenticated;
revoke all on function public.kk_admin_receipt_prepare(text,text,text,bigint) from public, anon, authenticated;
revoke all on function public.kk_admin_receipt_commit(text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.kk_admin_receipt_fail(text,bigint,text) from public, anon, authenticated;

grant execute on function public.kk_admin_lock_acquire(text,text,integer) to service_role;
grant execute on function public.kk_admin_lock_release(text,text,bigint) to service_role;
grant execute on function public.kk_admin_receipt_prepare(text,text,text,bigint) to service_role;
grant execute on function public.kk_admin_receipt_commit(text,bigint,text,jsonb) to service_role;
grant execute on function public.kk_admin_receipt_fail(text,bigint,text) to service_role;
