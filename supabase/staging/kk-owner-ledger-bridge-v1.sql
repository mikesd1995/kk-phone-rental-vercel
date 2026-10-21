-- Additive, dormant source. This is NOT an applied native migration.
-- Apply only after current Machine SOT/policy, exact native catalog and owner
-- authority readback. No Sheet, provider, runner, Make or existing RPC changes.
-- Native baseline: zehlsagzrpromtfqqflt PostgreSQL 17.6, empty outbox,
-- pgcrypto 1.3 in extensions. Native migration history is assigned by Supabase.

begin;
-- Hold the empty-outbox preflight through additive trigger installation.
lock table public.kk_make_owner_notification_outbox in share row exclusive mode;

do $$
begin
  if exists(select 1 from public.kk_make_owner_notification_outbox) then
    raise exception 'BRIDGE_PREFLIGHT_OUTBOX_NOT_EMPTY';
  end if;
  if not exists(select 1 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgcrypto' and e.extversion='1.3' and n.nspname='extensions') then
    raise exception 'BRIDGE_PREFLIGHT_PGCRYPTO_MISMATCH';
  end if;
  -- These are MD5(prosrc), not MD5(pg_get_functiondef).
  if (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
    where p.oid='public.kk_make_owner_notification_claim(text,text,text,text,text,text,timestamp with time zone)'::regprocedure)
      is distinct from 'b0579d38cd173a9830a367960fe1f400'
    or (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
    where p.oid='public.kk_make_owner_notification_ack(text,uuid,text)'::regprocedure)
      is distinct from '9a9190bc72adbdfa771d628d0b3216e8' then
    raise exception 'BRIDGE_PREFLIGHT_EXISTING_RPC_DRIFT';
  end if;
end; $$;

create table public.kk_make_owner_notification_source_map (
  source_spreadsheet_id text not null,
  source_tab text not null,
  source_transport text not null,
  source_notification_id text not null,
  source_dedup_key text not null,
  source_audit_event_id text not null,
  immutable_binding_text text not null,
  immutable_binding jsonb not null,
  descriptor jsonb not null,
  source_fresh_since timestamptz not null,
  notification_id text not null unique,
  request_id text not null unique,
  entity_id text not null,
  content_version text not null,
  text_sha256 text not null,
  payload text not null,
  admitted_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(source_spreadsheet_id,source_tab,source_transport,source_notification_id),
  unique(source_spreadsheet_id,source_tab,source_transport,source_dedup_key),
  constraint kk_owner_source_fixed_scope check (
    source_spreadsheet_id='1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo'
    and source_tab='_Notification_Ledger' and source_transport='TELEGRAM_OWNER_ALERTS'),
  -- The reverse FK forbids a committed map without its outbox. The outbox
  -- trigger below requires the exact map before allowing the forward insert.
  constraint kk_owner_source_has_outbox foreign key(notification_id)
    references public.kk_make_owner_notification_outbox(notification_id)
    deferrable initially deferred
);
alter table public.kk_make_owner_notification_source_map enable row level security;
revoke all on public.kk_make_owner_notification_source_map from public,anon,authenticated,service_role;
grant select,insert on public.kk_make_owner_notification_source_map to service_role;

create function public.kk_make_owner_notification_bridge_validate(
  p_binding text,p_audit text,p_descriptor jsonb,p_fresh_since timestamptz,p_check_fresh boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b jsonb; suffix text; source_at timestamptz; created timestamptz; expires timestamptz;
  observed timestamptz:=pg_catalog.clock_timestamp(); payload text; utf16_length bigint;
  expected_keys text[]:=array['version','audience','notification_id','request_id','event_type',
    'entity_id','content_version','text','created_at','expires_at'];
  instant_pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]{3})?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
  if p_binding is null or p_audit is null or p_audit='' or p_descriptor is null
    or p_fresh_since is null or p_check_fresh is null or not pg_catalog.isfinite(p_fresh_since) then
    raise exception using errcode='23514',message='BRIDGE_INPUT_NULL_OR_INVALID';
  end if;
  begin b:=p_binding::jsonb;
  exception when invalid_text_representation then
    raise exception using errcode='23514',message='BRIDGE_BINDING_JSON_INVALID';
  end;
  if pg_catalog.jsonb_typeof(b) is distinct from 'array' then
    raise exception using errcode='23514',message='BRIDGE_BINDING_TYPE_INVALID';
  end if;
  if pg_catalog.jsonb_array_length(b)<>13 or exists(select 1 from pg_catalog.jsonb_array_elements(b) x
    where pg_catalog.jsonb_typeof(x) is distinct from 'string') then
    raise exception using errcode='23514',message='BRIDGE_BINDING_13_STRINGS_REQUIRED';
  end if;
  if b->>0<>'kk-owner-ledger-binding-v1'
    or b->>1<>'1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo'
    or b->>2<>'_Notification_Ledger' or b->>3<>'TELEGRAM_OWNER_ALERTS' or b->>7='' then
    raise exception using errcode='23514',message='BRIDGE_FIXED_SCOPE_OR_DEDUP_INVALID';
  end if;
  if pg_catalog.octet_length(b->>4) not between 6 and 93
    or (b->>4) ~ U&'[\0001-\001F\007F-\009F]' then
    raise exception using errcode='23514',message='BRIDGE_RAW_ID_INVALID';
  end if;
  payload:=b->>6;
  select coalesce(pg_catalog.sum(case when pg_catalog.ascii(pg_catalog.substr(payload,i,1))>65535 then 2 else 1 end),0)
    into utf16_length from pg_catalog.generate_series(1,pg_catalog.char_length(payload)) i;
  if payload='' or utf16_length>2048 or payload<>pg_catalog.btrim(payload,
    E' \t\n\r\f'||pg_catalog.chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then
    raise exception using errcode='23514',message='BRIDGE_PAYLOAD_INVALID';
  end if;
  if pg_catalog.jsonb_typeof(p_descriptor) is distinct from 'object' then
    raise exception using errcode='23514',message='BRIDGE_DESCRIPTOR_OBJECT_REQUIRED';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_descriptor))<>10
    or not(p_descriptor ?& expected_keys)
    or exists(select 1 from pg_catalog.jsonb_each(p_descriptor) x
      where pg_catalog.jsonb_typeof(x.value) is distinct from 'string') then
    raise exception using errcode='23514',message='BRIDGE_DESCRIPTOR_10_STRINGS_REQUIRED';
  end if;
  suffix:=pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(pg_catalog.encode(
    pg_catalog.convert_to(b->>4,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  if p_descriptor->>'version'<>'kk-make-owner-transport-v1'
    or p_descriptor->>'audience'<>'KK_OWNER_TELEGRAM_ONLY'
    or p_descriptor->>'event_type'<>'OWNER_ALERT'
    or p_descriptor->>'notification_id'<>'ks1_'||suffix
    or p_descriptor->>'request_id'<>'kr1_'||suffix
    or p_descriptor->>'entity_id'<>'ke1_'||suffix
    or p_descriptor->>'text'<>payload
    or p_descriptor->>'content_version'<>pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(p_binding,'UTF8'),'sha256'),'hex') then
    raise exception using errcode='23514',message='BRIDGE_DESCRIPTOR_BINDING_MISMATCH';
  end if;
  if (b->>5)!~instant_pattern or (p_descriptor->>'created_at')!~instant_pattern
    or (p_descriptor->>'expires_at')!~instant_pattern then
    raise exception using errcode='23514',message='BRIDGE_TIMESTAMP_FORMAT_INVALID';
  end if;
  begin
    source_at:=(b->>5)::timestamptz;
    created:=(p_descriptor->>'created_at')::timestamptz;
    expires:=(p_descriptor->>'expires_at')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode='23514',message='BRIDGE_TIMESTAMP_INVALID';
  end;
  if not pg_catalog.isfinite(source_at) or not pg_catalog.isfinite(created) or not pg_catalog.isfinite(expires)
    or expires<=created or expires>created+interval '120 seconds' then
    raise exception using errcode='23514',message='BRIDGE_TTL_INVALID';
  end if;
  -- Replays only validate immutable content and timestamp syntax/TTL. They
  -- return the original dates/status even after expiry; they never re-age it.
  if p_check_fresh and (source_at<p_fresh_since or source_at<observed-interval '120 seconds'
    or source_at>created or p_fresh_since>created or created>observed+interval '15 seconds'
    or created<observed-interval '120 seconds' or expires<=observed) then
    raise exception using errcode='23514',message='BRIDGE_SOURCE_OR_DESCRIPTOR_NOT_FRESH';
  end if;
  return b;
end; $$;
revoke all on function public.kk_make_owner_notification_bridge_validate(text,text,jsonb,timestamptz,boolean)
  from public,anon,authenticated;
grant execute on function public.kk_make_owner_notification_bridge_validate(text,text,jsonb,timestamptz,boolean) to service_role;

create function public.kk_make_owner_notification_source_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare b jsonb;
begin
  if tg_op<>'INSERT' then
    raise exception using errcode='23514',message='BRIDGE_SOURCE_MAP_IMMUTABLE';
  end if;
  b:=public.kk_make_owner_notification_bridge_validate(new.immutable_binding_text,
    new.source_audit_event_id,new.descriptor,new.source_fresh_since,true);
  -- Derive every carrier column here, including for direct service-role INSERT.
  new.source_spreadsheet_id:=b->>1; new.source_tab:=b->>2; new.source_transport:=b->>3;
  new.source_notification_id:=b->>4; new.source_dedup_key:=b->>7; new.immutable_binding:=b;
  new.notification_id:=new.descriptor->>'notification_id'; new.request_id:=new.descriptor->>'request_id';
  new.entity_id:=new.descriptor->>'entity_id'; new.content_version:=new.descriptor->>'content_version';
  new.payload:=b->>6;
  new.text_sha256:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.payload,'UTF8'),'sha256'),'hex');
  new.admitted_at:=pg_catalog.clock_timestamp();
  return new;
end; $$;
revoke all on function public.kk_make_owner_notification_source_guard() from public,anon,authenticated,service_role;
create trigger kk_owner_source_immutable before insert or update or delete
  on public.kk_make_owner_notification_source_map for each row
  execute function public.kk_make_owner_notification_source_guard();

create function public.kk_make_owner_notification_outbox_source_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare m public.kk_make_owner_notification_source_map%rowtype;
begin
  if tg_op='DELETE' then
    raise exception using errcode='23514',message='BRIDGE_OUTBOX_DELETE_FORBIDDEN';
  end if;
  if tg_op='UPDATE' and row(new.notification_id,new.request_id,new.event_type,new.entity_id,
    new.content_version,new.text_sha256,new.created_at,new.expires_at) is distinct from
    row(old.notification_id,old.request_id,old.event_type,old.entity_id,
    old.content_version,old.text_sha256,old.created_at,old.expires_at) then
    raise exception using errcode='23514',message='BRIDGE_OUTBOX_CARRIER_IMMUTABLE';
  end if;
  select * into m from public.kk_make_owner_notification_source_map s where s.notification_id=new.notification_id;
  if not found or row(new.request_id,new.event_type,new.entity_id,new.content_version,new.text_sha256,new.created_at,new.expires_at)
    is distinct from row(m.request_id,'OWNER_ALERT'::text,m.entity_id,m.content_version,m.text_sha256,
      (m.descriptor->>'created_at')::timestamptz,(m.descriptor->>'expires_at')::timestamptz) then
    raise exception using errcode='23514',message='BRIDGE_OUTBOX_EXACT_SOURCE_REQUIRED';
  end if;
  if tg_op='INSERT' then
    if new.status<>'QUEUED' or new.receipt_id is not null or new.reserved_at is not null
      or new.provider_message_id is not null or new.delivered_at is not null
      or new.expires_at<=pg_catalog.clock_timestamp() then
      raise exception using errcode='23514',message='BRIDGE_OUTBOX_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;
  if new is not distinct from old then return new; end if;
  if old.status='QUEUED' and new.status='RESERVED'
    and old.receipt_id is null and old.reserved_at is null
    and new.receipt_id is not null and new.reserved_at=pg_catalog.now()
    and new.expires_at>pg_catalog.clock_timestamp()
    and new.delivered_at is null and new.provider_message_id is null then return new; end if;
  if old.status='RESERVED' and new.status='SENT'
    and new.receipt_id is not distinct from old.receipt_id and new.receipt_id is not null
    and new.reserved_at is not distinct from old.reserved_at and new.reserved_at is not null
    and new.provider_message_id is not null and new.provider_message_id ~ '^[0-9]{1,20}$'
    and new.delivered_at=pg_catalog.now() and new.delivered_at>=old.reserved_at
    and new.expires_at>pg_catalog.clock_timestamp() then return new; end if;
  -- Preserve receipt/attempt uncertainty on failure/expiry. No transition out
  -- of these terminal states, and no retry/reset path, is admitted here.
  if old.status in ('QUEUED','RESERVED') and new.status in ('FAILED_REQUIRES_REVIEW','EXPIRED')
    and (new.status<>'EXPIRED' or new.expires_at<=pg_catalog.clock_timestamp())
    and row(new.receipt_id,new.reserved_at,new.provider_message_id,new.delivered_at)
      is not distinct from row(old.receipt_id,old.reserved_at,old.provider_message_id,old.delivered_at) then return new; end if;
  raise exception using errcode='23514',message='BRIDGE_OUTBOX_TRANSITION_FORBIDDEN';
end; $$;
revoke all on function public.kk_make_owner_notification_outbox_source_guard() from public,anon,authenticated,service_role;
create trigger kk_owner_outbox_exact_source before insert or update or delete
  on public.kk_make_owner_notification_outbox for each row
  execute function public.kk_make_owner_notification_outbox_source_guard();

create function public.kk_make_owner_notification_readback(p_source_notification_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('replayed',false,'mapping_record',
    pg_catalog.jsonb_build_object('source_tuple',pg_catalog.jsonb_build_object(
      'spreadsheet_id',s.source_spreadsheet_id,'tab',s.source_tab,'transport',s.source_transport,'notification_id',s.source_notification_id),
      'transport_identity',pg_catalog.jsonb_build_object('notification_id',s.notification_id,'request_id',s.request_id,'entity_id',s.entity_id),
      'immutable_binding',s.immutable_binding),
    'immutable_binding_text',s.immutable_binding_text,'source_audit_event_id',s.source_audit_event_id,
    'descriptor',s.descriptor,'text_sha256',s.text_sha256,'outbox',pg_catalog.to_jsonb(n))
  from public.kk_make_owner_notification_source_map s join public.kk_make_owner_notification_outbox n
    on n.notification_id=s.notification_id and n.request_id=s.request_id and n.event_type='OWNER_ALERT'
    and n.entity_id=s.entity_id and n.content_version=s.content_version and n.text_sha256=s.text_sha256
    and n.created_at=(s.descriptor->>'created_at')::timestamptz and n.expires_at=(s.descriptor->>'expires_at')::timestamptz
  where s.source_spreadsheet_id='1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo'
    and s.source_tab='_Notification_Ledger' and s.source_transport='TELEGRAM_OWNER_ALERTS'
    and s.source_notification_id=p_source_notification_id
$$;
revoke all on function public.kk_make_owner_notification_readback(text) from public,anon,authenticated;
grant execute on function public.kk_make_owner_notification_readback(text) to service_role;

create function public.kk_make_owner_notification_enqueue(
  p_immutable_binding text,p_source_audit_event_id text,p_descriptor jsonb,p_fresh_since timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b jsonb; existing public.kk_make_owner_notification_source_map%rowtype;
  result jsonb; inserted boolean:=false;
begin
  b:=public.kk_make_owner_notification_bridge_validate(p_immutable_binding,p_source_audit_event_id,p_descriptor,p_fresh_since,false);
  select * into existing from public.kk_make_owner_notification_source_map s
    where s.source_spreadsheet_id=b->>1 and s.source_tab=b->>2 and s.source_transport=b->>3 and s.source_notification_id=b->>4
    ;
  if not found then
    begin
      insert into public.kk_make_owner_notification_source_map(immutable_binding_text,source_audit_event_id,descriptor,source_fresh_since)
        values(p_immutable_binding,p_source_audit_event_id,p_descriptor,p_fresh_since)
        returning * into existing;
      inserted:=true;
    exception when unique_violation then
      -- A concurrent request may win either authoritative unique constraint.
      -- Never overwrite it, even when its outbox is now reserved/terminal.
      select * into existing from public.kk_make_owner_notification_source_map s
        where s.source_spreadsheet_id=b->>1 and s.source_tab=b->>2 and s.source_transport=b->>3 and s.source_notification_id=b->>4
        ;
      if not found then raise exception using errcode='23505',message='BRIDGE_DEDUP_IDENTITY_CONFLICT'; end if;
    end;
  end if;
  if existing.immutable_binding_text<>p_immutable_binding or existing.source_audit_event_id<>p_source_audit_event_id
    or (existing.descriptor-array['created_at','expires_at']) is distinct from (p_descriptor-array['created_at','expires_at']) then
    raise exception using errcode='23505',message='BRIDGE_IMMUTABLE_BINDING_CONFLICT';
  end if;
  if inserted then
    insert into public.kk_make_owner_notification_outbox(notification_id,request_id,event_type,entity_id,
      content_version,text_sha256,created_at,expires_at)
    values(existing.notification_id,existing.request_id,'OWNER_ALERT',existing.entity_id,existing.content_version,
      existing.text_sha256,(existing.descriptor->>'created_at')::timestamptz,(existing.descriptor->>'expires_at')::timestamptz);
  end if;
  result:=public.kk_make_owner_notification_readback(b->>4);
  if result is null then raise exception using errcode='23514',message='BRIDGE_EXACT_READBACK_MISSING'; end if;
  return pg_catalog.jsonb_set(result,'{replayed}',pg_catalog.to_jsonb(not inserted));
end; $$;
revoke all on function public.kk_make_owner_notification_enqueue(text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.kk_make_owner_notification_enqueue(text,text,jsonb,timestamptz) to service_role;

-- service_role is still the trusted server caller. These guards constrain its
-- carrier/state writes; they cannot authenticate a Sheet read or a real provider
-- receipt. Current authoritative reader/policy and actual provider readback are
-- separate runtime admission gates. Existing claim/ACK bodies and ACL are intact.
commit;
