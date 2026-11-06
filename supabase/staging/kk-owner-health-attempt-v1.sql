-- Dormant source candidate only. Install/owner provisioning require separate approval
-- and fresh live schema/ACL/policy comparison. No authorization row is created here.
begin;
create schema if not exists private;
create table private.kk_owner_health_attempt_v1 (
 attempt_id uuid primary key check(attempt_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 nonce uuid not null unique check(nonce::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 source_sha text not null check(source_sha ~ '^[a-f0-9]{40}$'),
 deployment_id text not null check(deployment_id ~ '^dpl_[A-Za-z0-9]{1,196}$'),
 environment text not null check(environment='production'),
 not_before timestamptz not null,
 expires_at timestamptz not null,
 state text not null default 'DISABLED' check(state in ('DISABLED','ARMED','CONSUMED')),
 consumed_at timestamptz,
 check(expires_at>not_before and expires_at<=not_before+interval '15 minutes'),
 check((state='CONSUMED')=(consumed_at is not null)),
 check(consumed_at is null or (consumed_at>=not_before and consumed_at<expires_at))
);
alter table private.kk_owner_health_attempt_v1 enable row level security;
revoke all on private.kk_owner_health_attempt_v1 from public,anon,authenticated,service_role;

-- Terminal control permission, not a renewable lease. Even owner DML cannot reset
-- a consumed row, delete the tombstone, or rewrite an approved binding/window.
create function private.kk_owner_health_attempt_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'HEALTH_ATTEMPT_IMMUTABLE';end if;
 if (pg_catalog.to_jsonb(new)-array['state','consumed_at']) is distinct from
    (pg_catalog.to_jsonb(old)-array['state','consumed_at']) or
    old.state<>'ARMED' or new.state<>'CONSUMED' or
    old.consumed_at is not null or new.consumed_at is null then
  raise exception 'HEALTH_ATTEMPT_IMMUTABLE';
 end if;
 return new;
end;$$;
revoke all on function private.kk_owner_health_attempt_immutable_v1() from public,anon,authenticated,service_role;
create trigger kk_owner_health_attempt_immutable_v1 before update or delete
on private.kk_owner_health_attempt_v1 for each row execute function private.kk_owner_health_attempt_immutable_v1();

-- SECURITY DEFINER is intentional: service_role can only execute this exact
-- private-row transition, with no direct table read/insert/update/delete grants.
-- Project/Production OIDC authentication is enforced by the fixed Edge caller.
-- The trusted gateway source/deployment metadata is policy-bound, not a signed
-- OIDC source attestation. Owner arming must follow exact release readback.
create function public.kk_claim_owner_health_attempt_v1(
 p_attempt_id uuid,p_nonce uuid,p_source_sha text,p_deployment_id text,p_environment text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 rec private.kk_owner_health_attempt_v1;
 clock_at timestamptz;
 won boolean:=false;
begin
 if p_attempt_id is null or p_nonce is null or
    p_attempt_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or
    p_nonce::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or p_source_sha is null or
    p_source_sha !~ '^[a-f0-9]{40}$' or p_deployment_id is null or
    p_deployment_id !~ '^dpl_[A-Za-z0-9]{1,196}$' or p_environment is distinct from 'production' then
  return pg_catalog.jsonb_build_object('claimed',false,'attempt_id',p_attempt_id,'nonce',p_nonce,'source_sha',p_source_sha,'deployment_id',p_deployment_id,'environment',p_environment,'control_writes',0,'business_writes',0);
 end if;
 select * into rec from private.kk_owner_health_attempt_v1 where attempt_id=p_attempt_id for update;
 if found then
  clock_at:=pg_catalog.clock_timestamp(); -- Must follow any row-lock wait.
  if rec.state='ARMED' and rec.nonce=p_nonce and rec.source_sha=p_source_sha and
     rec.deployment_id=p_deployment_id and rec.environment=p_environment and
     clock_at>=rec.not_before and clock_at<rec.expires_at and
     rec.expires_at<=rec.not_before+interval '15 minutes' then
   update private.kk_owner_health_attempt_v1 set state='CONSUMED',consumed_at=clock_at
   where attempt_id=p_attempt_id and state='ARMED';
   won:=found;
  end if;
 end if;
 -- A duplicate, including a repeated identical request after a lost reply, is
 -- denied. There is no idempotent success replay, reset, refund or reclaim.
 return pg_catalog.jsonb_build_object('claimed',won,'attempt_id',p_attempt_id,'nonce',p_nonce,'source_sha',p_source_sha,'deployment_id',p_deployment_id,'environment',p_environment,'control_writes',case when won then 1 else 0 end,'business_writes',0);
end;$$;
revoke all on function public.kk_claim_owner_health_attempt_v1(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.kk_claim_owner_health_attempt_v1(uuid,uuid,text,text,text) to service_role;
commit;
