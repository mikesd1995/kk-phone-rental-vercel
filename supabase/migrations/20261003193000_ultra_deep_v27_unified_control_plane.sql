-- Ultra Deep V27 unified control-plane schema.
-- Applied first to kk-unified-inbox with business writes disabled.
begin;
create table if not exists public.kk_admin_write_locks (
 scope text primary key, holder_request_id text,
 fencing_token bigint not null default 0 check(fencing_token>=0),
 lease_until timestamptz, acquired_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.kk_admin_write_receipts (
 request_id text primary key, action text not null, payload_hash text not null,
 state text not null check(state in('PREPARED','COMMITTED','FAILED')), fencing_token bigint,
 result_hash text, result_json jsonb not null default '{}'::jsonb, error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.kk_ultra_deep_commands (
 command_id uuid primary key, month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 commit boolean not null default false,
 state text not null default 'PENDING' check(state in('PENDING','RUNNING','COMPLETE','FAILED')),
 claimed_at timestamptz, completed_at timestamptz,
 production_writes integer not null default 0 check(production_writes>=0), error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.kk_admin_write_locks enable row level security;
alter table public.kk_admin_write_receipts enable row level security;
alter table public.kk_ultra_deep_commands enable row level security;
revoke all on table public.kk_admin_write_locks from public,anon,authenticated;
revoke all on table public.kk_admin_write_receipts from public,anon,authenticated;
revoke all on table public.kk_ultra_deep_commands from public,anon,authenticated;
grant select,insert,update,delete on table public.kk_admin_write_locks to service_role;
grant select,insert,update,delete on table public.kk_admin_write_receipts to service_role;
grant select,insert,update on table public.kk_ultra_deep_commands to service_role;
insert into public.kk_admin_write_locks(scope) values('core-admin') on conflict(scope) do nothing;

create or replace function public.kk_ultra_deep_command_claim(p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.kk_ultra_deep_commands%rowtype;
begin
 update public.kk_ultra_deep_commands set state='RUNNING',claimed_at=now(),updated_at=now()
 where command_id=p_command_id and state='PENDING' returning * into v;
 if not found then return null; end if;
 return jsonb_build_object('command_id',v.command_id,'month',v.month,'commit',v.commit);
end $$;
create or replace function public.kk_ultra_deep_command_complete(p_command_id uuid,p_status text,p_production_writes integer,p_error_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v boolean:=false;
begin
 if p_status not in('COMPLETE','FAILED') then raise exception 'COMMAND_STATUS_INVALID'; end if;
 if p_production_writes is null or p_production_writes<0 then raise exception 'PRODUCTION_WRITES_INVALID'; end if;
 update public.kk_ultra_deep_commands set state=p_status,production_writes=p_production_writes,
 error_code=case when p_status='COMPLETE' then null else left(coalesce(p_error_code,'FULL_LOOP_FAILED'),120) end,
 completed_at=now(),updated_at=now() where command_id=p_command_id and state='RUNNING' returning true into v;
 return coalesce(v,false);
end $$;
revoke all on function public.kk_ultra_deep_command_claim(uuid) from public,anon,authenticated;
revoke all on function public.kk_ultra_deep_command_complete(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.kk_ultra_deep_command_claim(uuid) to service_role;
grant execute on function public.kk_ultra_deep_command_complete(uuid,text,integer,text) to service_role;
commit;
