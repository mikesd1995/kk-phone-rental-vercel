-- Run only AFTER the exact reviewed additive bridge is installed and read back.
-- One connection, entire script, stop on any error. No DDL/provider/Sheet calls.
-- SET LOCAL ROLE exercises the real invoker ACL. Synthetic SENT is SQL-only.
-- The final SELECT runs AFTER ROLLBACK; root must also perform a fresh readback.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
set local role service_role;

do $bridge_native_probe$
declare
  raw_id text := 'bridge-native-probe-20261021-001';
  other_id text := 'bridge-native-probe-20261021-002';
  payload text := 'SQL synthetic probe only — ไม่ใช่การส่งจริง';
  source_at timestamptz := pg_catalog.date_trunc('milliseconds',pg_catalog.clock_timestamp());
  fresh_since timestamptz;
  stamp text; suffix text; binding text; other_binding text; audit_id text;
  descriptor jsonb; other_descriptor jsonb; changed jsonb; bound_array jsonb;
  first_result jsonb; replay jsonb; state_readback jsonb;
  claimed record; acknowledged record; wrong_receipt uuid; affected bigint;
  test_case jsonb; negative_cases jsonb;
  actual_state text; actual_message text;
  passed_cases text[] := array[]::text[];
begin
  if current_user <> 'service_role' then raise exception 'PROBE_ROLE_NOT_SERVICE_ROLE'; end if;
  if pg_catalog.to_regprocedure('public.kk_make_owner_notification_enqueue(text,text,jsonb,timestamp with time zone)') is null
    or pg_catalog.to_regprocedure('public.kk_make_owner_notification_readback(text)') is null then
    raise exception 'PROBE_BRIDGE_NOT_INSTALLED';
  end if;
  if exists(select 1 from public.kk_make_owner_notification_outbox)
    or exists(select 1 from public.kk_make_owner_notification_source_map) then
    raise exception 'PROBE_REQUIRES_EMPTY_MAP_AND_OUTBOX';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'service-role-and-rowless-preflight');

  fresh_since := source_at-interval '1 second';
  stamp := pg_catalog.to_char(source_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  -- Compact 13-string encoding matches JSON.stringify(array); hash exact text.
  binding := '['||pg_catalog.array_to_string(array[
    pg_catalog.to_json('kk-owner-ledger-binding-v1'::text)::text,
    pg_catalog.to_json('1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo'::text)::text,
    pg_catalog.to_json('_Notification_Ledger'::text)::text,
    pg_catalog.to_json('TELEGRAM_OWNER_ALERTS'::text)::text,
    pg_catalog.to_json(raw_id)::text,pg_catalog.to_json(stamp)::text,
    pg_catalog.to_json(payload)::text,pg_catalog.to_json('dedup:'||raw_id)::text,
    '"family-probe"','"show-probe"','"CHANGED"','"P1"','"OWNER_POLICY"'],',')||']';
  audit_id := 'audit:'||raw_id;
  suffix := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(
    pg_catalog.encode(pg_catalog.convert_to(raw_id,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  descriptor := pg_catalog.jsonb_build_object(
    'version','kk-make-owner-transport-v1','audience','KK_OWNER_TELEGRAM_ONLY',
    'notification_id','ks1_'||suffix,'request_id','kr1_'||suffix,'entity_id','ke1_'||suffix,
    'event_type','OWNER_ALERT','content_version',pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(binding,'UTF8'),'sha256'),'hex'),'text',payload,
    'created_at',stamp,'expires_at',pg_catalog.to_char(
      (source_at+interval '120 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

  first_result := public.kk_make_owner_notification_enqueue(binding,audit_id,descriptor,fresh_since);
  if (first_result->>'replayed'='false' and first_result->'descriptor'=descriptor
    and first_result->>'immutable_binding_text'=binding and first_result->>'source_audit_event_id'=audit_id
    and first_result->'mapping_record'->'immutable_binding'=binding::jsonb
    and first_result->'outbox'->>'status'='QUEUED'
    and first_result->>'text_sha256'=pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(payload,'UTF8'),'sha256'),'hex')
    and (select count(*)=1 from public.kk_make_owner_notification_source_map)
    and (select count(*)=1 from public.kk_make_owner_notification_outbox)) is distinct from true then
    raise exception 'PROBE_FAIL enqueue-exact-pair';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'enqueue-exact-pair');
  if public.kk_make_owner_notification_readback(raw_id) is distinct from first_result then
    raise exception 'PROBE_FAIL exact-readback';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'exact-readback');
  replay := public.kk_make_owner_notification_enqueue(binding,audit_id,descriptor,fresh_since);
  if (replay->>'replayed'='true' and replay-'replayed'=first_result-'replayed') is distinct from true then
    raise exception 'PROBE_FAIL queued-replay-is-idempotent';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'queued-replay-is-idempotent');

  select * into strict claimed from public.kk_make_owner_notification_claim(
    descriptor->>'notification_id',descriptor->>'request_id','OWNER_ALERT',descriptor->>'entity_id',
    descriptor->>'content_version',first_result->>'text_sha256',(descriptor->>'expires_at')::timestamptz);
  if (claimed.status='RESERVED' and claimed.receipt_id is not null) is distinct from true then
    raise exception 'PROBE_FAIL exact-claim';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'exact-claim');
  select count(*) into affected from public.kk_make_owner_notification_claim(
    descriptor->>'notification_id',descriptor->>'request_id','OWNER_ALERT',descriptor->>'entity_id',
    descriptor->>'content_version',first_result->>'text_sha256',(descriptor->>'expires_at')::timestamptz);
  if affected<>0 then raise exception 'PROBE_FAIL second-claim-rejected'; end if;
  passed_cases := pg_catalog.array_append(passed_cases,'second-claim-rejected');

  select count(*) into affected from public.kk_make_owner_notification_ack(
    descriptor->>'notification_id',claimed.receipt_id,null);
  if affected<>0 then raise exception 'PROBE_FAIL null-provider-ack-rejected'; end if;
  passed_cases := pg_catalog.array_append(passed_cases,'null-provider-ack-rejected');
  select count(*) into affected from public.kk_make_owner_notification_ack(
    descriptor->>'notification_id',claimed.receipt_id,'invalid-provider-id');
  if affected<>0 then raise exception 'PROBE_FAIL malformed-provider-ack-rejected'; end if;
  passed_cases := pg_catalog.array_append(passed_cases,'malformed-provider-ack-rejected');
  wrong_receipt := case when claimed.receipt_id='00000000-0000-0000-0000-000000000000'::uuid
    then '00000000-0000-0000-0000-000000000001'::uuid
    else '00000000-0000-0000-0000-000000000000'::uuid end;
  select count(*) into affected from public.kk_make_owner_notification_ack(
    descriptor->>'notification_id',wrong_receipt,'123456');
  state_readback := public.kk_make_owner_notification_readback(raw_id);
  if (affected=0 and state_readback->'outbox'->>'status'='RESERVED'
    and state_readback->'outbox'->>'receipt_id'=claimed.receipt_id::text
    and state_readback->'outbox'->>'provider_message_id' is null
    and state_readback->'outbox'->>'delivered_at' is null) is distinct from true then
    raise exception 'PROBE_FAIL invalid-acks-preserve-reservation';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'invalid-acks-preserve-reservation');

  -- A fixed synthetic number tests SQL only. No provider request was made.
  select * into strict acknowledged from public.kk_make_owner_notification_ack(
    descriptor->>'notification_id',claimed.receipt_id,'123456');
  state_readback := public.kk_make_owner_notification_readback(raw_id);
  if (acknowledged.status='SENT' and acknowledged.provider_message_id='123456'
    and state_readback->'outbox'->>'receipt_id'=claimed.receipt_id::text
    and (state_readback->'outbox'->>'delivered_at')::timestamptz=pg_catalog.now()
    and state_readback->'outbox'->>'status'='SENT') is distinct from true then
    raise exception 'PROBE_FAIL synthetic-ack-preserves-receipt';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'synthetic-ack-preserves-receipt');
  select count(*) into affected from public.kk_make_owner_notification_ack(
    descriptor->>'notification_id',claimed.receipt_id,'654321');
  if affected<>0 or public.kk_make_owner_notification_readback(raw_id) is distinct from state_readback then
    raise exception 'PROBE_FAIL second-ack-does-not-overwrite';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'second-ack-does-not-overwrite');
  changed := descriptor||pg_catalog.jsonb_build_object('created_at','2000-01-01T00:00:00.000Z',
    'expires_at','2000-01-01T00:02:00.000Z');
  replay := public.kk_make_owner_notification_enqueue(binding,audit_id,changed,fresh_since);
  if (replay->>'replayed'='true' and replay-'replayed'=state_readback-'replayed'
    and replay->'descriptor'=descriptor) is distinct from true then
    raise exception 'PROBE_FAIL terminal-replay-no-reset-or-reaging';
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'terminal-replay-no-reset-or-reaging');

  bound_array := pg_catalog.jsonb_set(binding::jsonb,'{8}','"changed-family"'::jsonb);
  changed := descriptor||pg_catalog.jsonb_build_object('content_version',pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(bound_array::text,'UTF8'),'sha256'),'hex'));
  -- A distinct raw identity with the SAME dedup must lose; do not overwrite.
  other_binding := pg_catalog.jsonb_set(binding::jsonb,'{4}',pg_catalog.to_jsonb(other_id))::text;
  suffix := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(
    pg_catalog.encode(pg_catalog.convert_to(other_id,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  other_descriptor := descriptor||pg_catalog.jsonb_build_object('notification_id','ks1_'||suffix,
    'request_id','kr1_'||suffix,'entity_id','ke1_'||suffix,'content_version',pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(other_binding,'UTF8'),'sha256'),'hex'));
  negative_cases := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('name','null-binding','state','23514','message','BRIDGE_INPUT_NULL_OR_INVALID',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(null,%L,%L::jsonb,%L::timestamptz)',audit_id,descriptor,fresh_since)),
    pg_catalog.jsonb_build_object('name','null-audit','state','23514','message','BRIDGE_INPUT_NULL_OR_INVALID',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,null,%L::jsonb,%L::timestamptz)',binding,descriptor,fresh_since)),
    pg_catalog.jsonb_build_object('name','null-descriptor','state','23514','message','BRIDGE_INPUT_NULL_OR_INVALID',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,null,%L::timestamptz)',binding,audit_id,fresh_since)),
    pg_catalog.jsonb_build_object('name','null-fresh-since','state','23514','message','BRIDGE_INPUT_NULL_OR_INVALID',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,%L::jsonb,null)',binding,audit_id,descriptor)),
    pg_catalog.jsonb_build_object('name','changed-audit-rejected','state','23505','message','BRIDGE_IMMUTABLE_BINDING_CONFLICT',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,%L::jsonb,%L::timestamptz)',binding,'changed-audit',descriptor,fresh_since)),
    pg_catalog.jsonb_build_object('name','changed-binding-rejected','state','23505','message','BRIDGE_IMMUTABLE_BINDING_CONFLICT',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,%L::jsonb,%L::timestamptz)',bound_array::text,audit_id,changed,fresh_since)),
    pg_catalog.jsonb_build_object('name','same-dedup-other-identity-rejected','state','23505','message','BRIDGE_DEDUP_IDENTITY_CONFLICT',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,%L::jsonb,%L::timestamptz)',other_binding,'audit:'||other_id,other_descriptor,fresh_since)),
    pg_catalog.jsonb_build_object('name','ttl-over-120s-rejected','state','23514','message','BRIDGE_TTL_INVALID',
      'sql',pg_catalog.format('select public.kk_make_owner_notification_enqueue(%L,%L,%L::jsonb,%L::timestamptz)',binding,audit_id,
        descriptor||pg_catalog.jsonb_build_object('expires_at',pg_catalog.to_char((source_at+interval '121 seconds')
        at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),fresh_since)),
    pg_catalog.jsonb_build_object('name','outbox-carrier-immutable','state','23514','message','BRIDGE_OUTBOX_CARRIER_IMMUTABLE',
      'sql',pg_catalog.format('update public.kk_make_owner_notification_outbox set content_version=repeat(''0'',64) where notification_id=%L',descriptor->>'notification_id')),
    pg_catalog.jsonb_build_object('name','terminal-reset-rejected','state','23514','message','BRIDGE_OUTBOX_TRANSITION_FORBIDDEN',
      'sql',pg_catalog.format('update public.kk_make_owner_notification_outbox set status=''QUEUED'',receipt_id=null,reserved_at=null,provider_message_id=null,delivered_at=null where notification_id=%L',descriptor->>'notification_id')),
    pg_catalog.jsonb_build_object('name','source-update-no-privilege','state','42501',
      'sql',pg_catalog.format('update public.kk_make_owner_notification_source_map set source_audit_event_id=''changed'' where source_notification_id=%L',raw_id)),
    pg_catalog.jsonb_build_object('name','source-delete-no-privilege','state','42501',
      'sql',pg_catalog.format('delete from public.kk_make_owner_notification_source_map where source_notification_id=%L',raw_id)),
    pg_catalog.jsonb_build_object('name','outbox-delete-no-privilege','state','42501',
      'sql',pg_catalog.format('delete from public.kk_make_owner_notification_outbox where notification_id=%L',descriptor->>'notification_id')));
  for test_case in select value from pg_catalog.jsonb_array_elements(negative_cases) loop
    actual_state := null; actual_message := null;
    begin
      execute test_case->>'sql';
    exception when others then
      get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
    end;
    -- Assert OUTSIDE the catcher, so unexpected success cannot catch itself.
    if actual_state is distinct from test_case->>'state'
      or (test_case ? 'message' and actual_message is distinct from test_case->>'message') then
      raise exception 'PROBE_FAIL %: expected % / %, got % / %',test_case->>'name',
        test_case->>'state',test_case->>'message',actual_state,actual_message;
    end if;
    passed_cases := pg_catalog.array_append(passed_cases,test_case->>'name');
  end loop;

  -- A map-only insertion must fail the actual deferred FK when forced now.
  -- Its exception subtransaction must remove the attempted orphan map.
  other_binding := pg_catalog.jsonb_set(other_binding::jsonb,'{7}',
    pg_catalog.to_jsonb('dedup:'||other_id))::text;
  other_descriptor := other_descriptor||pg_catalog.jsonb_build_object('content_version',pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(other_binding,'UTF8'),'sha256'),'hex'));
  actual_state := null;
  begin
    insert into public.kk_make_owner_notification_source_map(
      immutable_binding_text,source_audit_event_id,descriptor,source_fresh_since)
    values(other_binding,'audit:'||other_id,other_descriptor,fresh_since);
    set constraints public.kk_owner_source_has_outbox immediate;
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate;
  end;
  if actual_state is distinct from '23503' or exists(select 1
    from public.kk_make_owner_notification_source_map where source_notification_id=other_id) then
    raise exception 'PROBE_FAIL reverse-fk-rejects-map-only-orphan: %',actual_state;
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'reverse-fk-rejects-map-only-orphan');

  -- No failure trigger is created: a deliberately invalid initial status
  -- fails the existing guard, and the whole local two-insert subtransaction rolls back.
  actual_state := null; actual_message := null;
  begin
    insert into public.kk_make_owner_notification_source_map(
      immutable_binding_text,source_audit_event_id,descriptor,source_fresh_since)
    values(other_binding,'audit:'||other_id,other_descriptor,fresh_since);
    insert into public.kk_make_owner_notification_outbox(notification_id,request_id,event_type,
      entity_id,content_version,text_sha256,created_at,expires_at,status)
    values(other_descriptor->>'notification_id',other_descriptor->>'request_id','OWNER_ALERT',
      other_descriptor->>'entity_id',other_descriptor->>'content_version',first_result->>'text_sha256',
      (other_descriptor->>'created_at')::timestamptz,(other_descriptor->>'expires_at')::timestamptz,'SENT');
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
  end;
  if actual_state is distinct from '23514' or actual_message is distinct from 'BRIDGE_OUTBOX_INITIAL_STATE_INVALID'
    or exists(select 1 from public.kk_make_owner_notification_source_map where source_notification_id=other_id)
    or public.kk_make_owner_notification_readback(other_id) is not null then
    raise exception 'PROBE_FAIL bad-initial-state-rolls-back-pair: % / %',actual_state,actual_message;
  end if;
  passed_cases := pg_catalog.array_append(passed_cases,'bad-initial-state-rolls-back-pair');

  set constraints all immediate;
  if (public.kk_make_owner_notification_readback(raw_id) is distinct from state_readback)
    or (select count(*) from public.kk_make_owner_notification_source_map)<>1
    or (select count(*) from public.kk_make_owner_notification_outbox)<>1
    or pg_catalog.cardinality(passed_cases)<>27 then
    raise exception 'PROBE_FAIL final-integrity-or-case-count: %',pg_catalog.cardinality(passed_cases);
  end if;
  raise notice 'BRIDGE_NATIVE_PROBE_JSON=%',pg_catalog.jsonb_build_object(
    'status','SQL_SYNTHETIC_ASSERTIONS_PASSED_BEFORE_ROLLBACK','assertions',pg_catalog.cardinality(passed_cases),
    'cases',passed_cases,'source_notification_id',raw_id,'receipt_id',claimed.receipt_id,
    'provider_message_id','123456','provider_call_made',false,'real_delivery_verified',false,
    'rollback_status','PENDING_FOLLOWING_STATEMENT');
end;
$bridge_native_probe$;

reset role;
rollback;

-- This result is useful even when the client suppresses NOTICE. Accept it only
-- from the entire exact script with no earlier SQL error; root re-reads separately.
with actual as (
  select (select count(*) from public.kk_make_owner_notification_source_map) as map_rows,
    (select count(*) from public.kk_make_owner_notification_outbox) as outbox_rows
)
select pg_catalog.jsonb_build_object(
  'status',case when map_rows=0 and outbox_rows=0 then 'SQL_PROBE_REACHED_POST_ROLLBACK_ROWS_ZERO'
    else 'ROLLBACK_READBACK_MISMATCH' end,
  'assertions_expected_before_rollback',27,'map_rows_after_rollback',map_rows,
  'outbox_rows_after_rollback',outbox_rows,'provider_call_made',false,'real_delivery_verified',false,
  'requires_full_script_without_error',true,'requires_root_fresh_readback',true) as bridge_native_probe
from actual;
