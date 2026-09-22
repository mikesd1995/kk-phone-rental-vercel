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

  update public.kk_admin_write_locks as l
  set holder_request_id = p_request_id,
      fencing_token = l.fencing_token + 1,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      acquired_at = now(),
      updated_at = now()
  where l.scope = p_scope
    and (
      l.holder_request_id = p_request_id
      or l.lease_until is null
      or l.lease_until <= now()
    )
  returning l.fencing_token, l.lease_until
  into v_token, v_lease;

  if found then
    return query select true, v_token, v_lease;
    return;
  end if;

  return query
  select false, l.fencing_token, l.lease_until
  from public.kk_admin_write_locks as l
  where l.scope = p_scope;
end;
$$;

revoke all on function public.kk_admin_lock_acquire(text,text,integer) from public, anon, authenticated;
grant execute on function public.kk_admin_lock_acquire(text,text,integer) to service_role;
