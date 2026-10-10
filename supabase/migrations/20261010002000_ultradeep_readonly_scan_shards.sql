-- KK Ultra Deep read-only, resumable scan checkpoints (proposed; NOT applied to production).
-- This table captures PUBLIC search receipts only. It is NOT authorized to write
-- bookings, owner hidden history, prices, Google Sheets, or storefront.
-- Apply only after source/security acceptance; RLS applies before first insert.
-- Typed SHARDED_READ_ONLY commands must never commit or record business writes.
begin;

alter table public.kk_ultra_deep_commands
 add column if not exists command_kind text not null default 'FULL_READ_ONLY';
do $constraint$
begin
 if not exists(select 1 from pg_constraint where conname='kk_ultra_deep_command_kind_check') then
  alter table public.kk_ultra_deep_commands
   add constraint kk_ultra_deep_command_kind_check
    check(command_kind in('FULL_READ_ONLY','SHARDED_READ_ONLY'));
 end if;
end $constraint$;

do $constraints$
begin
 if not exists(select 1 from pg_constraint where conname='kk_ultra_deep_sharded_readonly_check') then
  alter table public.kk_ultra_deep_commands
   add constraint kk_ultra_deep_sharded_readonly_check
   check(command_kind<>'SHARDED_READ_ONLY' or (commit=false and production_writes=0));
 end if;
end $constraints$;

-- Backward-compatible queue claim returns one extra authenticated command type
-- with typed command_kind in its authenticated result; typed shards always
-- use commit=false and zero business writes.
create or replace function public.kk_ultra_deep_command_claim(p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.kk_ultra_deep_commands%rowtype;
begin
 update public.kk_ultra_deep_commands set state='RUNNING',claimed_at=now(),updated_at=now()
 where command_id=p_command_id and state='PENDING'
 and (command_kind='FULL_READ_ONLY' or (command_kind='SHARDED_READ_ONLY' and commit=false))
 returning * into v;
 if not found then return null; end if;
 return jsonb_build_object('command_id',v.command_id,'month',v.month,
   'commit',v.commit,'command_kind',v.command_kind);
end $$;

create table if not exists public.kk_ultra_deep_scan_shards (
 command_id uuid not null references public.kk_ultra_deep_commands(command_id) on delete cascade,
 month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 phase text not null check(phase in ('KNOWN_MISS','DISCOVERY','REFERENCE','SOURCE_UNIVERSE')),
 plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'),
 shard_start integer not null check(shard_start>=0),
 shard_end integer not null check(shard_end>shard_start and shard_end<=2000 and shard_end-shard_start<=16),
 receipt_hash text not null check(receipt_hash ~ '^[a-f0-9]{64}$'),
 receipt_json jsonb not null,
 production_writes integer not null default 0 check(production_writes=0),
 created_at timestamptz not null default now(),
 primary key(command_id,phase,shard_start),
 check(jsonb_typeof(receipt_json)='object'),
 check(receipt_json->>'month'=month),
 check(receipt_json->>'phase'=phase),
 check(receipt_json->>'plan_hash'=plan_hash),
 check(receipt_json->>'receipt_hash'=receipt_hash),
 check((receipt_json->>'start')::integer=shard_start),
 check((receipt_json->>'end')::integer=shard_end),
 check(receipt_json->>'authoritative'='false'),
 check(receipt_json->>'production_writes'='0')
);
alter table public.kk_ultra_deep_scan_shards enable row level security;
revoke all on table public.kk_ultra_deep_scan_shards from public,anon,authenticated;
grant select,insert on table public.kk_ultra_deep_scan_shards to service_role;
-- No UPDATE or DELETE grant. Receipts are immutable and idempotently stored.

create or replace function public.kk_ultra_deep_scan_shard_insert(
 p_command_id uuid,p_month text,p_phase text,p_plan_hash text,
 p_shard_start integer,p_shard_end integer,p_receipt_hash text,p_receipt_json jsonb
) returns text
language plpgsql security definer set search_path='' as $$
declare v_command public.kk_ultra_deep_commands%rowtype;
declare v_old public.kk_ultra_deep_scan_shards%rowtype;
begin
 select * into v_command from public.kk_ultra_deep_commands
  where command_id=p_command_id and month=p_month and commit=false
    and command_kind='SHARDED_READ_ONLY' and state='RUNNING';
 if not found then raise exception 'SHARD_COMMAND_NOT_AUTHORIZED'; end if;
 if p_shard_start is null or p_shard_end is null or p_shard_start<0 or
    p_shard_end<=p_shard_start or p_shard_end-p_shard_start>16 or p_shard_end>2000
 then raise exception 'SHARD_EXCEEDS_SAFE_BATCH'; end if;
 if p_receipt_json->>'version'<>'KK_ULTRA_DEEP_SHARD_CHECKPOINT_V1' or
    p_receipt_json->>'authoritative'<>'false' or
    p_receipt_json->>'production_writes'<>'0' or
    jsonb_typeof(p_receipt_json->'records')<>'array' or
    jsonb_array_length(p_receipt_json->'records')<>p_shard_end-p_shard_start or
    pg_catalog.octet_length(p_receipt_json::text)>240000
 then raise exception 'SHARD_PAYLOAD_INVALID'; end if;
 insert into public.kk_ultra_deep_scan_shards(
  command_id,month,phase,plan_hash,shard_start,shard_end,receipt_hash,receipt_json
 ) values (
  p_command_id,p_month,p_phase,p_plan_hash,p_shard_start,p_shard_end,p_receipt_hash,p_receipt_json
 ) on conflict(command_id,phase,shard_start) do nothing;
 if found then return 'STORED'; end if;
 select * into v_old from public.kk_ultra_deep_scan_shards
  where command_id=p_command_id and phase=p_phase and shard_start=p_shard_start;
 if found and v_old.month=p_month and v_old.plan_hash=p_plan_hash
   and v_old.shard_end=p_shard_end and v_old.receipt_hash=p_receipt_hash
   and v_old.receipt_json=p_receipt_json then return 'IDEMPOTENT_MATCH'; end if;
 raise exception 'SHARD_IMMUTABLE_CONFLICT';
end $$;

revoke all on function public.kk_ultra_deep_scan_shard_insert(
 uuid,text,text,text,integer,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.kk_ultra_deep_scan_shard_insert(
 uuid,text,text,text,integer,integer,text,jsonb) to service_role;
commit;
