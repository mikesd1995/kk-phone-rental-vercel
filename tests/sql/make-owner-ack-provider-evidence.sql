-- Execute after the actual staging SQL in an isolated PostgreSQL database.
-- Required local roles: anon, authenticated, service_role (BYPASSRLS).
-- Everything is rolled back; no provider, network or canonical Sheet is used.
-- A harness may split at ACK_REGRESSION_ASSERTIONS to retain evidence before
-- the assertion raises. Without a harness this file is also executable as SQL.
begin;

create temporary table ack_regression_evidence (
  ordinal integer primary key,
  case_name text not null,
  rpc_result jsonb not null,
  before_row jsonb not null,
  after_row jsonb not null,
  other_rows_unchanged boolean not null,
  transaction_started_at timestamptz not null,
  observed_at timestamptz not null,
  passed boolean not null
) on commit drop;
grant select, insert on ack_regression_evidence to service_role;

with seeded_clock as (select clock_timestamp() as at)
insert into public.kk_make_owner_notification_outbox
  (notification_id, request_id, event_type, entity_id, content_version,
   text_sha256, created_at, expires_at, status, receipt_id, reserved_at)
select 'ack-regression-' || label, 'ack-regression-request-' || label,
  'OWNER_ALERT', 'local-fixture-' || label, repeat('a',64), repeat('b',64),
  case when label='expired' then at-interval '3 minutes' else at end,
  case when label='expired' then at-interval '1 minute' else at+interval '2 minutes' end,
  'RESERVED', receipt::uuid, at
from seeded_clock cross join (values
  ('null', '00000000-0000-4000-8000-000000000001'),
  ('empty', '00000000-0000-4000-8000-000000000002'),
  ('alpha', '00000000-0000-4000-8000-000000000003'),
  ('long', '00000000-0000-4000-8000-000000000004'),
  ('valid', '00000000-0000-4000-8000-000000000005'),
  ('expired', '00000000-0000-4000-8000-000000000006'),
  ('wrong-id', '00000000-0000-4000-8000-000000000007'),
  ('wrong-receipt', '00000000-0000-4000-8000-000000000008')
) as fixtures(label,receipt);

-- Exercise the SECURITY INVOKER function with its actual granted caller role.
set local role service_role;
do $$
declare
  c record;
  before_value jsonb;
  after_value jsonb;
  before_other jsonb;
  after_other jsonb;
  rpc_value jsonb;
  observed timestamptz;
  ok boolean;
begin
  for c in select * from (values
    (1,'null-provider-id','null',NULL::text,'00000000-0000-4000-8000-000000000001',false,false),
    (2,'empty-provider-id','empty','','00000000-0000-4000-8000-000000000002',false,false),
    (3,'alphabetic-provider-id','alpha','abc','00000000-0000-4000-8000-000000000003',false,false),
    (4,'21-digit-provider-id','long','123456789012345678901','00000000-0000-4000-8000-000000000004',false,false),
    (5,'valid-numeric-provider-id','valid','123456','00000000-0000-4000-8000-000000000005',true,false),
    (6,'same-id-replay','valid','123456','00000000-0000-4000-8000-000000000005',false,false),
    (7,'different-id-replay','valid','987654','00000000-0000-4000-8000-000000000005',false,false),
    (8,'expired-receipt','expired','123456','00000000-0000-4000-8000-000000000006',false,false),
    (9,'wrong-notification-id','wrong-id','123456','00000000-0000-4000-8000-000000000007',false,true),
    (10,'wrong-receipt-id','wrong-receipt','123456','00000000-0000-4000-8000-000000000099',false,false)
  ) as cases(ordinal,case_name,label,provider_id,receipt,want_sent,wrong_id)
  loop
    select to_jsonb(n) into strict before_value
      from public.kk_make_owner_notification_outbox n
      where n.notification_id='ack-regression-' || c.label;
    select coalesce(jsonb_agg(to_jsonb(n) order by n.notification_id),'[]'::jsonb)
      into before_other from public.kk_make_owner_notification_outbox n
      where n.notification_id<>'ack-regression-' || c.label;

    select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rpc_value
      from public.kk_make_owner_notification_ack(
        case when c.wrong_id then 'ack-regression-does-not-exist'
          else 'ack-regression-' || c.label end,
        c.receipt::uuid, c.provider_id) r;

    select to_jsonb(n) into strict after_value
      from public.kk_make_owner_notification_outbox n
      where n.notification_id='ack-regression-' || c.label;
    select coalesce(jsonb_agg(to_jsonb(n) order by n.notification_id),'[]'::jsonb)
      into after_other from public.kk_make_owner_notification_outbox n
      where n.notification_id<>'ack-regression-' || c.label;
    observed:=clock_timestamp();

    if c.want_sent then
      ok:=rpc_value='[{"status":"SENT","provider_message_id":"123456"}]'::jsonb
        and before_value->>'status'='RESERVED'
        and before_value->>'provider_message_id' is null
        and before_value->>'delivered_at' is null
        and after_value->>'status'='SENT'
        and after_value->>'provider_message_id'='123456'
        and after_value->>'delivered_at' is not null
        -- now() is the BEGIN transaction timestamp, not the RPC wall clock.
        and (after_value->>'delivered_at')::timestamptz>=transaction_timestamp()
        and (after_value->>'delivered_at')::timestamptz<=observed
        and (before_value-ARRAY['status','provider_message_id','delivered_at'])
          is not distinct from (after_value-ARRAY['status','provider_message_id','delivered_at']);
    else
      ok:=rpc_value='[]'::jsonb and before_value is not distinct from after_value;
    end if;
    insert into ack_regression_evidence values
      (c.ordinal,c.case_name,rpc_value,before_value,after_value,
       before_other is not distinct from after_other,transaction_timestamp(),
       observed,coalesce(ok,false) and before_other is not distinct from after_other);
  end loop;
end;
$$;

select * from ack_regression_evidence order by ordinal;

-- ACK_REGRESSION_ASSERTIONS
do $$
declare failures text;
begin
  select string_agg(case_name,', ' order by ordinal) into failures
    from ack_regression_evidence where not passed;
  if failures is not null then
    raise exception 'ACK provider evidence regression: %',failures;
  end if;
  if (select count(*) from ack_regression_evidence)<>10 then
    raise exception 'ACK provider evidence regression: incomplete matrix';
  end if;
end;
$$;
rollback;
