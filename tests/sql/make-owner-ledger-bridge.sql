-- Native acceptance for kk-owner-ledger-bridge-v1.sql, applied separately after
-- review. Execute as the database owner, in one connection. No provider/network
-- calls. Every synthetic row and temporary test trigger is rolled back.
-- This fixture proves SQL behavior only; its synthetic ACK is not delivery proof.
begin;

create temporary table bridge_evidence (
  case_name text primary key, passed boolean not null, detail jsonb not null
) on commit drop;
grant select, insert on bridge_evidence to service_role;
-- ACL probes use invoker assertion helpers under these roles. This grant is
-- confined to the transaction-local evidence table, never production data.
grant insert on bridge_evidence to anon,authenticated;

create function pg_temp.bridge_assert(p_name text, p_passed boolean, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_passed is distinct from true then raise exception 'bridge assertion: % (%)',p_name,p_detail; end if;
  insert into pg_temp.bridge_evidence values(p_name,true,p_detail);
end; $$;

create function pg_temp.bridge_reject(p_name text, p_sql text, p_state text default '23514')
returns void language plpgsql security invoker set search_path = '' as $$
declare actual_state text; actual_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate, actual_message=message_text;
  end;
  perform pg_temp.bridge_assert(p_name,actual_state=p_state,
    pg_catalog.jsonb_build_object('expected_sqlstate',p_state,'actual_sqlstate',actual_state,'message',actual_message));
end; $$;

create function pg_temp.bridge_fixture(p_raw text, p_dedup text default null,
  p_at timestamptz default pg_catalog.transaction_timestamp())
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare binding text; stamp text; suffix text; descriptor jsonb;
begin
  stamp:=pg_catalog.to_char(p_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  -- Construct the same compact 13-string tuple as JSON.stringify(array).
  binding:='[' || pg_catalog.array_to_string(array[
    pg_catalog.to_json('kk-owner-ledger-binding-v1'::text)::text,
    pg_catalog.to_json('1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo'::text)::text,
    pg_catalog.to_json('_Notification_Ledger'::text)::text,
    pg_catalog.to_json('TELEGRAM_OWNER_ALERTS'::text)::text,
    pg_catalog.to_json(p_raw)::text,pg_catalog.to_json(stamp)::text,
    pg_catalog.to_json('SQL synthetic acceptance only — ไม่ใช่การส่งจริง'::text)::text,
    pg_catalog.to_json(coalesce(p_dedup,'dedup:'||p_raw))::text,
    '"family-fixture"','"show-fixture"','"CHANGED"','"P1"','"OWNER_POLICY"'],',') || ']';
  suffix:=pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(
    pg_catalog.encode(pg_catalog.convert_to(p_raw,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  descriptor:=pg_catalog.jsonb_build_object('version','kk-make-owner-transport-v1',
    'audience','KK_OWNER_TELEGRAM_ONLY','notification_id','ks1_'||suffix,
    'request_id','kr1_'||suffix,'entity_id','ke1_'||suffix,'event_type','OWNER_ALERT',
    'content_version',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(binding,'UTF8'),'sha256'),'hex'),
    'text',(binding::jsonb)->>6,'created_at',stamp,'expires_at',
    pg_catalog.to_char((p_at+interval '120 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  return pg_catalog.jsonb_build_object('binding',binding,'audit','audit:'||p_raw,
    'descriptor',descriptor,'fresh_since',p_at-interval '1 second');
end; $$;

create function pg_temp.bridge_call(p_fixture jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select public.kk_make_owner_notification_enqueue(p_fixture->>'binding',p_fixture->>'audit',
    p_fixture->'descriptor',(p_fixture->>'fresh_since')::timestamptz)
$$;

-- Fail before test DML if the additive RPC has not been installed (native RED).
select 'public.kk_make_owner_notification_enqueue(text,text,jsonb,timestamp with time zone)'::regprocedure;

set local role service_role;
do $$
declare f jsonb; first_result jsonb; replay jsonb; claim_result record; ack_count integer;
  changed jsonb; before_count bigint; b jsonb;
begin
  f:=pg_temp.bridge_fixture('bridge-sql-ไทย-001');
  first_result:=pg_temp.bridge_call(f);
  perform pg_temp.bridge_assert('enqueue-exact-join',
    first_result->>'replayed'='false' and first_result->'outbox'->>'status'='QUEUED'
    and first_result->>'immutable_binding_text'=f->>'binding'
    and first_result->>'source_audit_event_id'=f->>'audit'
    and first_result->'mapping_record'->'immutable_binding'=(f->>'binding')::jsonb
    and first_result->'descriptor'=f->'descriptor',first_result);
  replay:=public.kk_make_owner_notification_readback('bridge-sql-ไทย-001');
  perform pg_temp.bridge_assert('readback-exact-join',replay=first_result);
  perform pg_temp.bridge_assert('missing-readback-is-null',
    public.kk_make_owner_notification_readback('bridge-sql-missing') is null);

  select * into strict claim_result from public.kk_make_owner_notification_claim(
    first_result->'descriptor'->>'notification_id',first_result->'descriptor'->>'request_id',
    'OWNER_ALERT',first_result->'descriptor'->>'entity_id',first_result->'descriptor'->>'content_version',
    first_result->>'text_sha256',(first_result->'descriptor'->>'expires_at')::timestamptz);
  perform pg_temp.bridge_assert('existing-claim-preserved',claim_result.status='RESERVED' and claim_result.receipt_id is not null);
  select count(*) into ack_count from public.kk_make_owner_notification_ack(
    first_result->'descriptor'->>'notification_id',claim_result.receipt_id,null);
  perform pg_temp.bridge_assert('existing-null-ack-preserved',ack_count=0);
  select count(*) into ack_count from public.kk_make_owner_notification_ack(
    first_result->'descriptor'->>'notification_id',claim_result.receipt_id,'123456');
  perform pg_temp.bridge_assert('synthetic-ack-function-only',ack_count=1);

  -- A replay may contain regenerated descriptor dates. It returns the original
  -- dates and terminal receipt, rather than re-aging or resetting the row.
  changed:=pg_catalog.jsonb_set(f,'{descriptor,created_at}',pg_catalog.to_jsonb('2000-01-01T00:00:00.000Z'::text));
  changed:=pg_catalog.jsonb_set(changed,'{descriptor,expires_at}',pg_catalog.to_jsonb('2000-01-01T00:02:00.000Z'::text));
  replay:=pg_temp.bridge_call(changed);
  perform pg_temp.bridge_assert('replay-preserves-original-terminal-row',
    replay->>'replayed'='true' and replay->'descriptor'=first_result->'descriptor'
    and replay->'outbox'->>'status'='SENT'
    and replay->'outbox'->>'receipt_id'=claim_result.receipt_id::text);

  changed:=pg_catalog.jsonb_set(f,'{audit}',pg_catalog.to_jsonb('different-audit'::text));
  perform pg_temp.bridge_reject('audit-immutable',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed),'23505');
  b:=(f->>'binding')::jsonb;
  b:=pg_catalog.jsonb_set(b,'{8}','"different-family"');
  changed:=pg_catalog.jsonb_set(f,'{binding}',pg_catalog.to_jsonb(b::text));
  changed:=pg_catalog.jsonb_set(changed,'{descriptor,content_version}',pg_catalog.to_jsonb(
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(b::text,'UTF8'),'sha256'),'hex')));
  perform pg_temp.bridge_reject('binding-immutable',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed),'23505');
  changed:=pg_temp.bridge_fixture('bridge-sql-dedup-002','dedup:bridge-sql-ไทย-001');
  perform pg_temp.bridge_reject('dedup-collision-other-id',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed),'23505');

  perform pg_temp.bridge_reject('null-binding','select public.kk_make_owner_notification_enqueue(null,''a'',''{}'',now())');
  perform pg_temp.bridge_reject('null-audit',pg_catalog.format(
    'select public.kk_make_owner_notification_enqueue(%L,null,%L::jsonb,now())',f->>'binding',f->'descriptor'));
  perform pg_temp.bridge_reject('null-descriptor',pg_catalog.format(
    'select public.kk_make_owner_notification_enqueue(%L,''a'',null,now())',f->>'binding'));
  perform pg_temp.bridge_reject('null-fresh-since',pg_catalog.format(
    'select public.kk_make_owner_notification_enqueue(%L,''a'',%L::jsonb,null)',f->>'binding',f->'descriptor'));
  changed:=pg_catalog.jsonb_set(pg_temp.bridge_fixture('bridge-sql-type-003'),'{binding}','"[null]"');
  perform pg_temp.bridge_reject('binding-null-element',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_catalog.jsonb_set(pg_temp.bridge_fixture('bridge-sql-type-004'),'{descriptor,text}','17');
  perform pg_temp.bridge_reject('descriptor-number-type',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_catalog.jsonb_set(pg_temp.bridge_fixture('bridge-sql-type-005'),'{descriptor,chat_id}','"forbidden"');
  perform pg_temp.bridge_reject('descriptor-extra-field',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_catalog.jsonb_set(pg_temp.bridge_fixture('bridge-sql-hash-006'),'{descriptor,content_version}',pg_catalog.to_jsonb(pg_catalog.repeat('0',64)));
  perform pg_temp.bridge_reject('binding-sha-recomputed',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_catalog.jsonb_set(pg_temp.bridge_fixture('bridge-sql-id-007'),'{descriptor,request_id}','"kr1_wrong"');
  perform pg_temp.bridge_reject('derived-identity-required',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_temp.bridge_fixture('bridge-sql-old-008',null,pg_catalog.now()-interval '121 seconds');
  perform pg_temp.bridge_reject('new-source-stale',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_temp.bridge_fixture('bridge-sql-future-009',null,pg_catalog.now()+interval '16 seconds');
  perform pg_temp.bridge_reject('future-clock-skew',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));
  changed:=pg_temp.bridge_fixture('bridge-sql-ttl-010');
  changed:=pg_catalog.jsonb_set(changed,'{descriptor,expires_at}',pg_catalog.to_jsonb(
    pg_catalog.to_char((pg_catalog.now()+interval '121 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  perform pg_temp.bridge_reject('ttl-over-120s',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',changed));

  perform pg_temp.bridge_reject('outbox-immutable-update',pg_catalog.format(
    'update public.kk_make_owner_notification_outbox set content_version=repeat(''0'',64) where notification_id=%L',first_result->'descriptor'->>'notification_id'));
  perform pg_temp.bridge_reject('terminal-cannot-reset-queued',pg_catalog.format(
    'update public.kk_make_owner_notification_outbox set status=''QUEUED'',receipt_id=null,reserved_at=null,delivered_at=null,provider_message_id=null where notification_id=%L',first_result->'descriptor'->>'notification_id'));
  perform pg_temp.bridge_reject('source-map-update-no-grant','update public.kk_make_owner_notification_source_map set source_audit_event_id=''x''','42501');
  perform pg_temp.bridge_reject('source-map-delete-no-grant','delete from public.kk_make_owner_notification_source_map','42501');
  perform pg_temp.bridge_reject('outbox-delete-no-grant','delete from public.kk_make_owner_notification_outbox','42501');
  perform pg_temp.bridge_reject('outbox-orphan-insert',
    'insert into public.kk_make_owner_notification_outbox(notification_id,request_id,event_type,entity_id,content_version,text_sha256,created_at,expires_at) values(''orphan-test-id'',''orphan-test-request'',''OWNER_ALERT'',''orphan'',repeat(''a'',64),repeat(''b'',64),now(),now()+interval ''120 seconds'')');
end; $$;

reset role;
-- Force the second insert to fail after the source map insert; a native
-- subtransaction must roll back both. The trigger is confined to this harness.
create function pg_temp.bridge_injected_failure() returns trigger language plpgsql as $$
begin
  if new.notification_id='ks1_'||rtrim(translate(encode(convert_to('bridge-sql-rollback-011','UTF8'),'base64'),'+/','-_'),'=') then
    raise exception using errcode='23514',message='synthetic outbox failure';
  end if;
  return new;
end; $$;
create trigger z_bridge_acceptance_failure before insert on public.kk_make_owner_notification_outbox
for each row execute function pg_temp.bridge_injected_failure();
set local role service_role;
do $$
declare f jsonb;
begin
  f:=pg_temp.bridge_fixture('bridge-sql-rollback-011');
  perform pg_temp.bridge_reject('outbox-failure-rejects-whole-enqueue',pg_catalog.format('select pg_temp.bridge_call(%L::jsonb)',f));
  perform pg_temp.bridge_assert('outbox-failure-no-orphan',not exists(
    select 1 from public.kk_make_owner_notification_source_map where source_notification_id='bridge-sql-rollback-011')
    and public.kk_make_owner_notification_readback('bridge-sql-rollback-011') is null);
end; $$;
reset role;

-- Even an owner that bypasses table ACL cannot mutate/delete immutable maps.
select pg_temp.bridge_reject('source-map-owner-update-trigger',
  'update public.kk_make_owner_notification_source_map set source_audit_event_id=''x''','23514');
select pg_temp.bridge_reject('source-map-owner-delete-trigger',
  'delete from public.kk_make_owner_notification_source_map','23514');

set local role anon;
select pg_temp.bridge_reject('anon-read-denied','select * from public.kk_make_owner_notification_source_map','42501');
select pg_temp.bridge_reject('anon-rpc-denied','select public.kk_make_owner_notification_readback(''missing'')','42501');
reset role;
set local role authenticated;
select pg_temp.bridge_reject('authenticated-read-denied','select * from public.kk_make_owner_notification_source_map','42501');
select pg_temp.bridge_reject('authenticated-rpc-denied','select public.kk_make_owner_notification_readback(''missing'')','42501');
reset role;

select case_name,passed,detail from bridge_evidence order by case_name;
-- BRIDGE_REGRESSION_ASSERTIONS
do $$ begin
  if (select count(*) from pg_temp.bridge_evidence)<35 then
    raise exception 'bridge acceptance matrix incomplete';
  end if;
  set constraints all immediate;
end; $$;
rollback;
