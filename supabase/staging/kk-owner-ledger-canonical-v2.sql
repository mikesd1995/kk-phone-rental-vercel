-- SOURCE ONLY. Additive, dormant, no cutover row seeded. Does not touch v1 tables/functions.
-- Apply separately with owner approval after live catalog/ACL/policy comparison.
create table public.kk_owner_canonical_cutover (
 cutover_id uuid primary key, activated_at timestamptz not null, policy_version text not null check(policy_version='v4.9.44'),
 consumer_id text not null check(consumer_id='6176241'), environment text not null check(environment in ('preview','production')),
 enabled boolean not null default false, max_attempts integer not null default 4 check(max_attempts between 1 and 4),
 capture_profile_sha256 text check(capture_profile_sha256 ~ '^[a-f0-9]{64}$'), provider_binding jsonb, unique(environment)
);
create table public.kk_owner_canonical_poll (
 poll_id uuid primary key, cutover_id uuid not null references public.kk_owner_canonical_cutover,
 slot_id bigint not null check(slot_id>0), context jsonb not null, issued boolean not null default false, held jsonb not null default '[]'::jsonb,
 unique(cutover_id,slot_id)
);
create table public.kk_owner_canonical_ticket (
 ticket uuid primary key, poll_id uuid not null references public.kk_owner_canonical_poll,
 source_notification_id text not null, dedup_key text not null, rows jsonb not null, source_row jsonb not null,
 state text not null default 'NEW' check(state in ('NEW','CLAIMING','ADMITTED')),
 unique(poll_id,source_notification_id), unique(poll_id,dedup_key)
);
create table public.kk_owner_canonical_delivery (
 source_notification_id text primary key, dedup_key text not null unique,
 ticket uuid not null unique references public.kk_owner_canonical_ticket,
 notification_id text not null unique, context jsonb not null, source_row jsonb not null,
 binding_text text, descriptor jsonb, descriptor_sha256 text, claimed_row jsonb,
 status text not null default 'CLAIMING' check(status in ('CLAIMING','QUEUED','RESERVED','SENT','REJECTION_PENDING','RETRY_WAIT','FAILED')),
 attempt_count integer not null default 1 check(attempt_count between 1 and 4), next_ticket uuid,
 before_row jsonb, projected_row jsonb, next_retry_at timestamptz, rejection_evidence jsonb,
 receipt_id uuid unique, reserved_at timestamptz, delivered_at timestamptz, provider_message_id text,
 check((status='CLAIMING' and binding_text is null and descriptor is null and claimed_row is null and receipt_id is null) or
       (status<>'CLAIMING' and binding_text is not null and descriptor is not null and claimed_row is not null)),
 check(status not in ('RESERVED','SENT') or (receipt_id is not null and reserved_at is not null)),
 check(status<>'SENT' or (provider_message_id is not null and delivered_at is not null and provider_message_id ~ '^[1-9][0-9]{0,19}$' and delivered_at>=reserved_at))
);
create table public.kk_owner_canonical_attempt (
 ticket uuid primary key references public.kk_owner_canonical_ticket,
 source_notification_id text not null references public.kk_owner_canonical_delivery,
 attempt_no integer not null check(attempt_no between 1 and 4),
 before_row jsonb not null, context jsonb not null, binding_text text, descriptor jsonb, descriptor_sha256 text, claimed_row jsonb,
 status text not null check(status in ('CLAIMING','QUEUED','RESERVED','SENT','REJECTION_PENDING','RETRY_WAIT','FAILED')),
 receipt_id uuid unique, reserved_at timestamptz, delivered_at timestamptz, provider_message_id text,
 rejection_evidence jsonb, next_retry_at timestamptz, projected_row jsonb,
 unique(source_notification_id,attempt_no)
);
-- One durable permission per attempt. An uncertain/lost grant is never reset.
create table public.kk_owner_canonical_dispatch (
 attempt_id uuid primary key references public.kk_owner_canonical_attempt(ticket),
 dispatch_id uuid not null unique, receipt_id uuid not null, started_at timestamptz not null,
 provider_binding jsonb not null
);
alter table public.kk_owner_canonical_cutover enable row level security;
alter table public.kk_owner_canonical_poll enable row level security;
alter table public.kk_owner_canonical_ticket enable row level security;
alter table public.kk_owner_canonical_delivery enable row level security;
alter table public.kk_owner_canonical_attempt enable row level security;
alter table public.kk_owner_canonical_dispatch enable row level security;
revoke all on public.kk_owner_canonical_cutover,public.kk_owner_canonical_poll,public.kk_owner_canonical_ticket,public.kk_owner_canonical_delivery,public.kk_owner_canonical_attempt,public.kk_owner_canonical_dispatch from public,anon,authenticated,service_role;
create function public.kk_owner_canonical_cutover_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (pg_catalog.to_jsonb(new)-'enabled') is distinct from (pg_catalog.to_jsonb(old)-'enabled') then raise exception 'CANONICAL_CUTOVER_IMMUTABLE';end if;
 return new;
end;$$;
revoke all on function public.kk_owner_canonical_cutover_guard() from public,anon,authenticated,service_role;
create trigger kk_owner_canonical_cutover_immutable before update on public.kk_owner_canonical_cutover for each row execute function public.kk_owner_canonical_cutover_guard();

create function public.kk_owner_canonical_operation(p_operation text,p_parameters jsonb,p_environment text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 cfg public.kk_owner_canonical_cutover; pol public.kk_owner_canonical_poll; tic public.kk_owner_canonical_ticket;
 rec public.kk_owner_canonical_delivery; att public.kk_owner_canonical_attempt; dispatch public.kk_owner_canonical_dispatch; ctx jsonb; r jsonb; other jsonb; d jsonb; b jsonb; claimed jsonb;
 clock_at timestamptz:=pg_catalog.clock_timestamp(); slot bigint; due_at timestamptz; observed timestamptz;
 id text; dedup text; transport_id text; ticket_id uuid; ids jsonb:='[]'; k text; expected jsonb; text_binding text;
 keys text[]; count_keys integer; claim_at timestamptz; utf16_length bigint; payload text; h jsonb; held_index integer; seen_indices integer[]:=array[]::integer[]; retry_seconds integer; rejection_status integer; internal_held jsonb;
begin
 if p_environment not in ('preview','production') or p_environment is null or p_operation is null or p_parameters is null or pg_catalog.jsonb_typeof(p_parameters) is distinct from 'object' or pg_catalog.octet_length(p_parameters::text)>300000 then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 keys:=case p_operation when 'poll' then array[]::text[] when 'poll-readback' then array['poll_id'] when 'tickets' then array['context','rows','candidates','held'] when 'begin' then array['ticket'] when 'enqueue' then array['ticket','binding','descriptor','claimed_row'] when 'readback' then array['notification_id','attempt_id'] when 'reserve' then array['notification_id','attempt_id'] when 'ack' then array['notification_id','attempt_id','receipt_id','provider_message_id'] when 'reject' then array['notification_id','attempt_id','receipt_id','evidence'] when 'dispatch-start' then array['notification_id','attempt_id','receipt_id','bot_id'] when 'adapter-ack' then array['notification_id','attempt_id','receipt_id','dispatch_id','provider_message_id'] when 'adapter-reject' then array['notification_id','attempt_id','receipt_id','dispatch_id','evidence'] when 'confirm-rejection' then array['notification_id','attempt_id','projected_row'] else null end;
 select count(*) into count_keys from pg_catalog.jsonb_object_keys(p_parameters);
 if keys is null or count_keys<>pg_catalog.cardinality(keys) or not p_parameters ?& keys then raise exception 'CANONICAL_OPERATION_FORBIDDEN';end if;
 if p_operation in ('begin','enqueue') and pg_catalog.jsonb_typeof(p_parameters->'ticket') is distinct from 'string' then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 if p_operation in ('readback','reserve','ack','reject','confirm-rejection','dispatch-start','adapter-ack','adapter-reject') and (pg_catalog.jsonb_typeof(p_parameters->'notification_id') is distinct from 'string' or pg_catalog.jsonb_typeof(p_parameters->'attempt_id') is distinct from 'string') then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 if p_operation in ('dispatch-start','adapter-ack','adapter-reject') and pg_catalog.jsonb_typeof(p_parameters->'receipt_id') is distinct from 'string' then raise exception 'CANONICAL_DISPATCH_INVALID';end if;
 if p_operation in ('adapter-ack','adapter-reject') and pg_catalog.jsonb_typeof(p_parameters->'dispatch_id') is distinct from 'string' then raise exception 'CANONICAL_DISPATCH_INVALID';end if;
 if p_operation in ('ack','adapter-ack') and (pg_catalog.jsonb_typeof(p_parameters->'receipt_id') is distinct from 'string' or pg_catalog.jsonb_typeof(p_parameters->'provider_message_id') is distinct from 'string') then raise exception 'CANONICAL_ACK_INVALID';end if;
 select * into cfg from public.kk_owner_canonical_cutover where environment=p_environment and enabled for share;
 if not found then raise exception 'CANONICAL_DISABLED_OR_UNBOUND';end if;
 if cfg.provider_binding is not null then
  other:=cfg.provider_binding;select count(*) into count_keys from pg_catalog.jsonb_object_keys(other);
  if count_keys<>6 or not other ?& array['kind','app_name','module_id','connection_id','bot_id','manifest_sha256'] or other->>'kind' is distinct from 'make-custom-telegram-response-v1' or
   pg_catalog.jsonb_typeof(other->'module_id') is distinct from 'number' or other->>'module_id' !~ '^[1-9][0-9]{0,8}$' or other->>'module_id'='8' or
   pg_catalog.jsonb_typeof(other->'connection_id') is distinct from 'number' or other->>'connection_id' !~ '^[1-9][0-9]{0,8}$' or other->>'connection_id'='10356915' or
   pg_catalog.jsonb_typeof(other->'bot_id') is distinct from 'string' or other->>'bot_id' !~ '^[1-9][0-9]{3,19}$' or
   pg_catalog.jsonb_typeof(other->'app_name') is distinct from 'string' or pg_catalog.jsonb_typeof(other->'manifest_sha256') is distinct from 'string' or other->>'app_name' !~ '^kk-telegram-response-adapter-[a-zA-Z0-9_-]{1,80}$' or other->>'manifest_sha256' !~ '^[a-f0-9]{64}$' then raise exception 'CANONICAL_ADAPTER_UNBOUND';end if;
 end if;
 clock_at:=pg_catalog.clock_timestamp(); -- Never trust a clock captured before a blocking lock.
 if p_operation='poll' then
  slot:=floor(extract(epoch from (clock_at-cfg.activated_at))/900);due_at:=cfg.activated_at+slot*interval '900 seconds';
  if slot<1 or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_SLOT_NOT_DUE';end if;
  ctx:=pg_catalog.jsonb_build_object('version','kk-owner-canonical-context-v2','cutover_id',cfg.cutover_id::text,'activated_at',pg_catalog.to_char(cfg.activated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'policy_version',cfg.policy_version,'consumer_id',cfg.consumer_id,'max_attempts',cfg.max_attempts::text,
   'script_project_id','1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF','spreadsheet_id','1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo','tab','_Notification_Ledger','transport','TELEGRAM_OWNER_ALERTS','environment',cfg.environment,
   'poll_id',pg_catalog.gen_random_uuid()::text,'slot_id',slot::text,'due_at',pg_catalog.to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'observed_at',pg_catalog.to_char(clock_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'nonce',pg_catalog.gen_random_uuid()::text);
  insert into public.kk_owner_canonical_poll(poll_id,cutover_id,slot_id,context,issued) values((ctx->>'poll_id')::uuid,cfg.cutover_id,slot,ctx,false);return ctx;
 end if;
 if p_operation='poll-readback' then
  if pg_catalog.jsonb_typeof(p_parameters->'poll_id') is distinct from 'string' then raise exception 'CANONICAL_REQUEST_INVALID';end if;
  select * into pol from public.kk_owner_canonical_poll where poll_id=(p_parameters->>'poll_id')::uuid for share;
  if not found or pol.cutover_id<>cfg.cutover_id then raise exception 'CANONICAL_POLL_MISSING';end if;
  return pg_catalog.jsonb_build_object('context',pol.context,'issued',pol.issued,'held',pol.held);
 end if;
 if p_operation='tickets' then
  select * into pol from public.kk_owner_canonical_poll where poll_id=(p_parameters->'context'->>'poll_id')::uuid for update;
  if not found or pol.issued or pol.cutover_id<>cfg.cutover_id or pol.context<>p_parameters->'context' then raise exception 'CANONICAL_POLL_REPLAY_OR_MISMATCH';end if;
 elsif p_operation in ('begin','enqueue') then
  select * into tic from public.kk_owner_canonical_ticket where ticket=(p_parameters->>'ticket')::uuid for update;
  if not found then raise exception 'CANONICAL_TICKET_MISSING';end if;
  select * into pol from public.kk_owner_canonical_poll where poll_id=tic.poll_id;
 else
  select * into rec from public.kk_owner_canonical_delivery where notification_id=p_parameters->>'notification_id' for update;
  if not found then raise exception 'CANONICAL_SOURCE_MISSING';end if;
  clock_at:=pg_catalog.clock_timestamp();
  if rec.context->>'cutover_id'<>cfg.cutover_id::text then raise exception 'CANONICAL_CUTOVER_MISMATCH';end if;
  if rec.ticket is distinct from (p_parameters->>'attempt_id')::uuid then raise exception 'CANONICAL_ATTEMPT_MISMATCH';end if;
  select * into att from public.kk_owner_canonical_attempt where ticket=rec.ticket for update;
  if not found or att.source_notification_id<>rec.source_notification_id or att.attempt_no<>rec.attempt_count then raise exception 'CANONICAL_ATTEMPT_MISMATCH';end if;
  if p_operation='readback' then return pg_catalog.to_jsonb(rec)||case when cfg.provider_binding is null then '{}'::jsonb else pg_catalog.jsonb_build_object('provider_binding',cfg.provider_binding,'provider_dispatch',(select pg_catalog.to_jsonb(x) from public.kk_owner_canonical_dispatch x where x.attempt_id=rec.ticket)) end;end if;
  if p_operation='confirm-rejection' then
   if rec.status not in ('REJECTION_PENDING','RETRY_WAIT','FAILED') or pg_catalog.jsonb_typeof(p_parameters->'projected_row') is distinct from 'object' then raise exception 'CANONICAL_REJECTION_NOT_PENDING';end if;
   expected:=rec.claimed_row||pg_catalog.jsonb_build_object('Status',case when rec.next_retry_at is null then 'FAILED' else 'RETRY_WAIT' end,'Next Retry At',case when rec.next_retry_at is null then '' else pg_catalog.to_char(rec.next_retry_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,'HTTP Status',(rec.rejection_evidence->>'http_status'),'Last Error','TELEGRAM_API_REJECTED_HTTP_'||(rec.rejection_evidence->>'http_status'),'Notes',(rec.claimed_row->>'Notes')||' | '||case when rec.next_retry_at is null then 'REJECTED_TERMINAL' else 'REJECTED_RETRY_SAFE' end);
   if p_parameters->'projected_row'<>expected or rec.projected_row is not null and rec.projected_row<>expected then raise exception 'CANONICAL_PROJECTION_MISMATCH';end if;
   update public.kk_owner_canonical_delivery set status=expected->>'Status',projected_row=expected where source_notification_id=rec.source_notification_id returning * into rec;
   update public.kk_owner_canonical_attempt set status=rec.status,projected_row=expected where ticket=att.ticket;
   return pg_catalog.to_jsonb(rec);
  end if;
  if rec.descriptor is null or (rec.descriptor->>'expires_at')::timestamptz<=clock_at then raise exception 'CANONICAL_ORIGINAL_DESCRIPTOR_EXPIRED';end if;
  if p_operation='dispatch-start' then
   if cfg.provider_binding is null or pg_catalog.jsonb_typeof(p_parameters->'bot_id') is distinct from 'string' or p_parameters->>'bot_id' is distinct from cfg.provider_binding->>'bot_id' or rec.status<>'RESERVED' or rec.receipt_id is distinct from (p_parameters->>'receipt_id')::uuid or (rec.descriptor->>'expires_at')::timestamptz<=clock_at+interval '15 seconds' then raise exception 'CANONICAL_DISPATCH_INVALID';end if;
   if exists(select 1 from public.kk_owner_canonical_dispatch where attempt_id=rec.ticket) then raise exception 'CANONICAL_DISPATCH_ALREADY_STARTED';end if;
   insert into public.kk_owner_canonical_dispatch(attempt_id,dispatch_id,receipt_id,started_at,provider_binding) values(rec.ticket,pg_catalog.gen_random_uuid(),rec.receipt_id,clock_at,cfg.provider_binding) returning * into dispatch;
   return pg_catalog.to_jsonb(rec)||pg_catalog.jsonb_build_object('provider_binding',cfg.provider_binding,'provider_dispatch',pg_catalog.to_jsonb(dispatch));
  end if;
  if p_operation in ('adapter-ack','adapter-reject') then
   select * into dispatch from public.kk_owner_canonical_dispatch where attempt_id=rec.ticket;
   if cfg.provider_binding is null or not found or dispatch.dispatch_id is distinct from (p_parameters->>'dispatch_id')::uuid or dispatch.receipt_id is distinct from rec.receipt_id or dispatch.provider_binding is distinct from cfg.provider_binding then raise exception 'CANONICAL_DISPATCH_MISMATCH';end if;
  elsif p_operation in ('ack','reject') and cfg.provider_binding is not null then raise exception 'CANONICAL_ADAPTER_OUTCOME_REQUIRED';end if;
  if p_operation='reserve' then
   if rec.status<>'QUEUED' then raise exception 'CANONICAL_ALREADY_ATTEMPTED';end if;
   update public.kk_owner_canonical_delivery set status='RESERVED',receipt_id=pg_catalog.gen_random_uuid(),reserved_at=clock_at where notification_id=rec.notification_id returning * into rec;
   update public.kk_owner_canonical_attempt set status='RESERVED',receipt_id=rec.receipt_id,reserved_at=rec.reserved_at where ticket=att.ticket;
   return pg_catalog.jsonb_build_object('status',rec.status,'receipt_id',rec.receipt_id);
  end if;
  if p_operation in ('reject','adapter-reject') then
   other:=p_parameters->'evidence';
   if (cfg.provider_binding is null and cfg.capture_profile_sha256 is null) or rec.status<>'RESERVED' or rec.receipt_id is distinct from (p_parameters->>'receipt_id')::uuid or pg_catalog.jsonb_typeof(other) is distinct from 'object' or
      other->>'profile_sha256' is distinct from coalesce(cfg.provider_binding->>'manifest_sha256',cfg.capture_profile_sha256) or other->>'scenario_id' is distinct from '6176241' or other->>'module_id' is distinct from coalesce(cfg.provider_binding->>'module_id','8') or other->>'connection_id' is distinct from coalesce(cfg.provider_binding->>'connection_id','10356915') or other->>'attempt_id' is distinct from rec.ticket::text or other->>'receipt_id' is distinct from rec.receipt_id::text or other->>'descriptor_sha256' is distinct from rec.descriptor_sha256 or
      pg_catalog.jsonb_typeof(other->'http_status') is distinct from 'number' or pg_catalog.jsonb_typeof(other->'telegram_response') is distinct from 'object' or other->'telegram_response'->'ok' is distinct from 'false'::jsonb or pg_catalog.jsonb_typeof(other->'telegram_response'->'error_code') is distinct from 'number' or
      other ? 'provider_message_id' or other->'telegram_response' ?| array['result','message_id','request_id'] then raise exception 'CANONICAL_REJECTION_EVIDENCE_INVALID';end if;
   select count(*) into count_keys from pg_catalog.jsonb_object_keys(other);
   if count_keys<>9 or not other ?& array['profile_sha256','scenario_id','module_id','connection_id','attempt_id','receipt_id','descriptor_sha256','http_status','telegram_response'] or
      pg_catalog.jsonb_typeof(other->'profile_sha256') is distinct from 'string' or pg_catalog.jsonb_typeof(other->'scenario_id') is distinct from 'string' or pg_catalog.jsonb_typeof(other->'module_id') is distinct from 'number' or pg_catalog.jsonb_typeof(other->'connection_id') is distinct from 'number' or pg_catalog.jsonb_typeof(other->'attempt_id') is distinct from 'string' or pg_catalog.jsonb_typeof(other->'receipt_id') is distinct from 'string' or pg_catalog.jsonb_typeof(other->'descriptor_sha256') is distinct from 'string' then raise exception 'CANONICAL_REJECTION_EVIDENCE_INVALID';end if;
   select count(*) into count_keys from pg_catalog.jsonb_object_keys(other->'telegram_response');
   if count_keys<2 or count_keys>4 or exists(select 1 from pg_catalog.jsonb_object_keys(other->'telegram_response') as x(field_name) where x.field_name not in ('ok','error_code','description','parameters')) or
      (other->'telegram_response' ? 'description' and pg_catalog.jsonb_typeof(other->'telegram_response'->'description') is distinct from 'string') then raise exception 'CANONICAL_REJECTION_EVIDENCE_INVALID';end if;
   rejection_status:=(other->>'http_status')::integer;
   if (other->>'http_status') is distinct from rejection_status::text or other->'telegram_response'->>'error_code' is distinct from rejection_status::text or rejection_status<400 or rejection_status>=500 or rejection_status in (408,409,425) then raise exception 'CANONICAL_REJECTION_UNCERTAIN';end if;
   retry_seconds:=0;
   if other->'telegram_response' ? 'parameters' then
    if pg_catalog.jsonb_typeof(other->'telegram_response'->'parameters') is distinct from 'object' or exists(select 1 from pg_catalog.jsonb_object_keys(other->'telegram_response'->'parameters') as x(field_name) where x.field_name<>'retry_after') then raise exception 'CANONICAL_REJECTION_EVIDENCE_INVALID';end if;
    if other->'telegram_response'->'parameters' ? 'retry_after' then
     if pg_catalog.jsonb_typeof(other->'telegram_response'->'parameters'->'retry_after') is distinct from 'number' or (other->'telegram_response'->'parameters'->>'retry_after') !~ '^[0-9]{1,5}$' then raise exception 'CANONICAL_RETRY_AFTER_INVALID';end if;
     retry_seconds:=(other->'telegram_response'->'parameters'->>'retry_after')::integer;
     if retry_seconds>86400 then raise exception 'CANONICAL_RETRY_AFTER_INVALID';end if;
    end if;
   end if;
   update public.kk_owner_canonical_delivery set status='REJECTION_PENDING',rejection_evidence=other,next_retry_at=case when rejection_status=429 and rec.attempt_count<cfg.max_attempts then clock_at+greatest((300*pg_catalog.power(2,rec.attempt_count-1))::double precision,retry_seconds::double precision)*interval '1 second' else null end where source_notification_id=rec.source_notification_id returning * into rec;
   update public.kk_owner_canonical_attempt set status='REJECTION_PENDING',rejection_evidence=other,next_retry_at=rec.next_retry_at where ticket=att.ticket;
   return pg_catalog.to_jsonb(rec);
  end if;
  if rec.status='SENT' and rec.receipt_id=(p_parameters->>'receipt_id')::uuid and rec.provider_message_id=p_parameters->>'provider_message_id' then return pg_catalog.to_jsonb(rec);end if;
  if rec.status<>'RESERVED' or rec.receipt_id is distinct from (p_parameters->>'receipt_id')::uuid or (p_parameters->>'provider_message_id' ~ '^[1-9][0-9]{0,19}$') is distinct from true then raise exception 'CANONICAL_ACK_MISMATCH';end if;
  update public.kk_owner_canonical_delivery set status='SENT',provider_message_id=p_parameters->>'provider_message_id',delivered_at=clock_at where notification_id=rec.notification_id returning * into rec;
  update public.kk_owner_canonical_attempt set status='SENT',provider_message_id=rec.provider_message_id,delivered_at=rec.delivered_at where ticket=att.ticket;return pg_catalog.to_jsonb(rec);
 end if;
 clock_at:=pg_catalog.clock_timestamp();
 ctx:=pol.context;observed:=(ctx->>'observed_at')::timestamptz;due_at:=(ctx->>'due_at')::timestamptz;
 if pol.cutover_id<>cfg.cutover_id or observed<clock_at-interval '120 seconds' or observed>clock_at+interval '15 seconds' or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_POLL_EXPIRED';end if;
 if p_operation='tickets' then
  if pg_catalog.jsonb_typeof(p_parameters->'context') is distinct from 'object' or pg_catalog.jsonb_typeof(p_parameters->'rows') is distinct from 'array' or pg_catalog.jsonb_array_length(p_parameters->'rows')>128 or pg_catalog.octet_length((p_parameters->'rows')::text)>262144 or pg_catalog.jsonb_typeof(p_parameters->'candidates') is distinct from 'array' or pg_catalog.jsonb_array_length(p_parameters->'candidates')>128 then raise exception 'CANONICAL_SNAPSHOT_BOUNDS';end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_parameters->'candidates') x where pg_catalog.jsonb_typeof(x)<>'string') then raise exception 'CANONICAL_CANDIDATE_INVALID';end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements_text(p_parameters->'candidates') x group by x having count(*)>1) then raise exception 'CANONICAL_CANDIDATE_DUPLICATE';end if;
  if pg_catalog.jsonb_typeof(p_parameters->'held') is distinct from 'array' or pg_catalog.jsonb_array_length(p_parameters->'held')>128 or pg_catalog.octet_length((p_parameters->'held')::text)>32768 then raise exception 'CANONICAL_HELD_METADATA_INVALID';end if;
  for h in select pg_catalog.jsonb_array_elements(p_parameters->'held') loop
   if pg_catalog.jsonb_typeof(h) is distinct from 'object' then raise exception 'CANONICAL_HELD_METADATA_INVALID';end if;
   select count(*) into count_keys from pg_catalog.jsonb_object_keys(h);
   if count_keys<>3 or not h ?& array['row_index','notification_id_sha256','reason_code'] or pg_catalog.jsonb_typeof(h->'row_index') is distinct from 'number' or (h->>'row_index' ~ '^[1-9][0-9]{0,2}$') is distinct from true or pg_catalog.jsonb_typeof(h->'notification_id_sha256') is distinct from 'string' or pg_catalog.jsonb_typeof(h->'reason_code') is distinct from 'string' then raise exception 'CANONICAL_HELD_METADATA_INVALID';end if;
   held_index:=(h->>'row_index')::integer;
   if held_index>pg_catalog.jsonb_array_length(p_parameters->'rows') or held_index=any(seen_indices) or h->>'notification_id_sha256' is distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(case when pg_catalog.jsonb_typeof(p_parameters->'rows'->(held_index-1)->'Notification ID')='string' then (p_parameters->'rows'->(held_index-1)->'Notification ID')::text else E'KK_OWNER_CANONICAL_HELD_NONSTRING_V2\n'||pg_catalog.jsonb_typeof(p_parameters->'rows'->(held_index-1)->'Notification ID') end,'UTF8')),'hex') or h->>'reason_code' not in ('CANONICAL_SOURCE_TYPE_INVALID','CANONICAL_ID_INVALID','CANONICAL_ID_AMBIGUOUS','CANONICAL_DEDUP_AMBIGUOUS','CANONICAL_SOURCE_ALREADY_ATTEMPTED','CANONICAL_NORMAL_SOURCE_REQUIRED','CANONICAL_SOURCE_CUTOVER_INVALID','CANONICAL_SOURCE_HELD','QUIET_HOURS_HOLD','CANONICAL_CORE_SELECTION_HELD','CANONICAL_RENDER_INVALID','SOURCE_URL_REQUIRED','OWNER_ACTION_REQUIRED','NOTIFICATION_TOO_LONG','MACHINE_GARBAGE_PAYLOAD_BLOCKED','GATEWAY_CANDIDATE_REJECTED','CANONICAL_RETRY_HISTORY_UNVERIFIED') then raise exception 'CANONICAL_HELD_METADATA_INVALID';end if;
   seen_indices:=pg_catalog.array_append(seen_indices,held_index);
  end loop;
  internal_held:=p_parameters->'held';
  for id in select pg_catalog.jsonb_array_elements_text(p_parameters->'candidates') loop
   select count(*) into count_keys from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Notification ID'=id;
   if count_keys<>1 then raise exception 'CANONICAL_ID_AMBIGUOUS';end if;
   select x into r from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Notification ID'=id;
   if exists(select 1 from pg_catalog.unnest(seen_indices) i where p_parameters->'rows'->(i-1)->>'Notification ID'=id) then raise exception 'CANONICAL_HELD_CANDIDATE_CONFLICT';end if;
   select count(*) into count_keys from pg_catalog.jsonb_object_keys(r);
   if count_keys<>23 or not r ?& array['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'] then raise exception 'CANONICAL_ROW_INVALID';end if;
   for k in select pg_catalog.jsonb_object_keys(r) loop
    if k<>'Attempt Count' and pg_catalog.jsonb_typeof(r->k) is distinct from 'string' then raise exception 'CANONICAL_ROW_TYPE_INVALID';end if;
   end loop;
   if pg_catalog.jsonb_typeof(r->'Attempt Count') not in ('string','number') then raise exception 'CANONICAL_ROW_TYPE_INVALID';end if;
   if r->>'Status' not in ('QUEUED','RETRY_WAIT') then
    select ord::integer into held_index from pg_catalog.jsonb_array_elements(p_parameters->'rows') with ordinality x(value,ord) where x.value->>'Notification ID'=id;
    internal_held:=internal_held||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row_index',held_index,'notification_id_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((r->'Notification ID')::text,'UTF8')),'hex'),'reason_code','CANONICAL_RETRY_HISTORY_UNVERIFIED'));continue;
   end if;
   dedup:=r->>'Dedup Key';
   if pg_catalog.octet_length(id)<6 or pg_catalog.octet_length(id)>93 or id ~ '[[:cntrl:]]' or id like 'KKUAT_%' or r->>'Transport'<>'TELEGRAM_OWNER_ALERTS' or r->>'Status' not in ('QUEUED','RETRY_WAIT') or dedup='' or dedup is null or r->>'Change Type' in ('','TRANSPORT_UAT') or r->>'Priority' in ('','TEST') or r->>'Quiet Hours Policy' in ('','OWNER_CONTROLLED_UAT') or r->>'Event Family ID'='' or r->>'Audit Event ID'='' or r->>'Audit Event ID' like 'CONTROLLED_UAT|%' or r->>'Notes' ~ 'OWNER_AUTHORIZED_TRANSPORT_UAT' then raise exception 'CANONICAL_NORMAL_SOURCE_REQUIRED';end if;
   if r->>'Status'='QUEUED' then
    if r->>'Attempt Count'<>'0' or r->>'Notes' ~ 'CLAIM\|' then raise exception 'CANONICAL_PRIOR_ATTEMPT';end if;
    foreach k in array array['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'] loop if r->>k is distinct from '' then raise exception 'CANONICAL_PRIOR_ATTEMPT';end if;end loop;
   else
    if pg_catalog.jsonb_typeof(r->'Attempt Count') not in ('number','string') or (r->>'Attempt Count' ~ '^[1-3]$') is distinct from true or r->>'HTTP Status'<>'429' or r->>'Last Error'<>'TELEGRAM_API_REJECTED_HTTP_429' or r->>'Delivery Evidence'<>'' or r->>'Provider Message ID'<>'' or r->>'API Accepted At'<>'' or r->>'Delivery Confirmed At'<>'' or r->>'Feedback Source'<>'' or r->>'Next Retry At'='' then
     select ord::integer into held_index from pg_catalog.jsonb_array_elements(p_parameters->'rows') with ordinality x(value,ord) where x.value->>'Notification ID'=id;
     internal_held:=internal_held||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row_index',held_index,'notification_id_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((r->'Notification ID')::text,'UTF8')),'hex'),'reason_code','CANONICAL_RETRY_HISTORY_UNVERIFIED'));continue;
    end if;
   end if;
   if (r->>'Created At')::timestamptz<cfg.activated_at or (r->>'Created At')::timestamptz>observed or r->>'Payload'='' or pg_catalog.char_length(r->>'Payload')>2048 then raise exception 'CANONICAL_SOURCE_CUTOVER_INVALID';end if;
   payload:=r->>'Payload';select coalesce(pg_catalog.sum(case when pg_catalog.ascii(pg_catalog.substr(payload,i,1))>65535 then 2 else 1 end),0) into utf16_length from pg_catalog.generate_series(1,pg_catalog.char_length(payload)) i;
   if utf16_length>2048 or payload<>pg_catalog.btrim(payload,E' \t\n\r\f'||pg_catalog.chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then raise exception 'CANONICAL_SOURCE_PAYLOAD_INVALID';end if;
   if (extract(hour from clock_at at time zone 'Asia/Bangkok')>=23 or extract(hour from clock_at at time zone 'Asia/Bangkok')<7) and not(r->>'Priority'='P0' and r->>'Change Type' in ('CANCELLATION','POSTPONEMENT','DATE_CHANGE','VENUE_CHANGE')) then raise exception 'CANONICAL_QUIET_HOURS_HOLD';end if;
   select count(*) into count_keys from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Transport'='TELEGRAM_OWNER_ALERTS' and x->>'Dedup Key'=dedup;
   if count_keys<>1 then raise exception 'CANONICAL_DEDUP_AMBIGUOUS';end if;
   select * into rec from public.kk_owner_canonical_delivery q where q.source_notification_id=id or q.dedup_key=dedup for update;
   clock_at:=pg_catalog.clock_timestamp();
   if observed<clock_at-interval '120 seconds' or observed>clock_at+interval '15 seconds' or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_POLL_EXPIRED';end if;
   if found then
    -- The locked delivery row serializes every begin transition. A NEW ticket has not
    -- claimed an attempt; an expired poll may replace that admission pointer only.
    -- Do not lock its ticket here: begin locks ticket then delivery, so reversing
    -- that order would deadlock. A waiting old begin fails expiry/pointer fencing.
    if rec.source_notification_id<>id or rec.dedup_key<>dedup or rec.status<>'RETRY_WAIT' or
       (rec.next_ticket is not null and not exists(
        select 1 from public.kk_owner_canonical_ticket pending join public.kk_owner_canonical_poll prior_poll on prior_poll.poll_id=pending.poll_id
        where pending.ticket=rec.next_ticket and pending.state='NEW' and pending.poll_id<>pol.poll_id and
         pending.source_notification_id=rec.source_notification_id and pending.dedup_key=rec.dedup_key and pending.source_row=rec.projected_row and
         prior_poll.cutover_id=cfg.cutover_id and prior_poll.issued and
         ((prior_poll.context->>'observed_at')::timestamptz<clock_at-interval '120 seconds' or clock_at>(prior_poll.context->>'due_at')::timestamptz+interval '120 seconds') and
         not exists(select 1 from public.kk_owner_canonical_attempt prior_attempt where prior_attempt.ticket=pending.ticket)
       )) or rec.next_retry_at is null or rec.next_retry_at>clock_at or rec.projected_row is distinct from r or rec.attempt_count<>(r->>'Attempt Count')::integer or rec.attempt_count>=cfg.max_attempts or rec.provider_message_id is not null or rec.source_row->>'Created At'<>r->>'Created At' or rec.source_row->>'Payload'<>r->>'Payload' then
     if r->>'Status'='RETRY_WAIT' then
      select ord::integer into held_index from pg_catalog.jsonb_array_elements(p_parameters->'rows') with ordinality x(value,ord) where x.value->>'Notification ID'=id;
      internal_held:=internal_held||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row_index',held_index,'notification_id_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((r->'Notification ID')::text,'UTF8')),'hex'),'reason_code','CANONICAL_RETRY_HISTORY_UNVERIFIED'));
     end if;continue;
    end if;
   elsif r->>'Status'<>'QUEUED' then
    select ord::integer into held_index from pg_catalog.jsonb_array_elements(p_parameters->'rows') with ordinality x(value,ord) where x.value->>'Notification ID'=id;
    internal_held:=internal_held||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('row_index',held_index,'notification_id_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((r->'Notification ID')::text,'UTF8')),'hex'),'reason_code','CANONICAL_RETRY_HISTORY_UNVERIFIED'));continue;
   end if;
   ticket_id:=pg_catalog.gen_random_uuid();insert into public.kk_owner_canonical_ticket values(ticket_id,pol.poll_id,id,dedup,p_parameters->'rows',r,'NEW');
   if rec.source_notification_id=id then update public.kk_owner_canonical_delivery set next_ticket=ticket_id where source_notification_id=id;end if;
   ids:=ids||pg_catalog.jsonb_build_array(ticket_id::text);
  end loop;
  if pg_catalog.jsonb_array_length(internal_held)>128 or pg_catalog.octet_length(internal_held::text)>32768 then raise exception 'CANONICAL_HELD_METADATA_INVALID';end if;
  update public.kk_owner_canonical_poll set issued=true,held=internal_held where poll_id=pol.poll_id;return ids;
 end if;
 if p_operation='begin' then
  if tic.state<>'NEW' then raise exception 'CANONICAL_TICKET_ALREADY_CONSUMED';end if;
  transport_id:='ks1_'||pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(tic.source_notification_id,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  select * into rec from public.kk_owner_canonical_delivery where source_notification_id=tic.source_notification_id for update;
  clock_at:=pg_catalog.clock_timestamp(); -- The delivery lock may outlive the original poll.
  if observed<clock_at-interval '120 seconds' or observed>clock_at+interval '15 seconds' or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_POLL_EXPIRED';end if;
  if found then
   if rec.status<>'RETRY_WAIT' or rec.next_ticket is distinct from tic.ticket or rec.dedup_key<>tic.dedup_key or rec.projected_row is distinct from tic.source_row or rec.next_retry_at>pg_catalog.clock_timestamp() or rec.attempt_count>=cfg.max_attempts then raise exception 'CANONICAL_RETRY_FENCED';end if;
   update public.kk_owner_canonical_delivery set ticket=tic.ticket,context=ctx,before_row=tic.source_row,status='CLAIMING',attempt_count=rec.attempt_count+1,next_ticket=null,binding_text=null,descriptor=null,descriptor_sha256=null,claimed_row=null,receipt_id=null,reserved_at=null,delivered_at=null,provider_message_id=null,next_retry_at=null,projected_row=null,rejection_evidence=null where source_notification_id=tic.source_notification_id returning * into rec;
  else
   insert into public.kk_owner_canonical_delivery(source_notification_id,dedup_key,ticket,notification_id,context,source_row,before_row) values(tic.source_notification_id,tic.dedup_key,tic.ticket,transport_id,ctx,tic.source_row,tic.source_row) returning * into rec;
  end if;
  insert into public.kk_owner_canonical_attempt(ticket,source_notification_id,attempt_no,before_row,context,status) values(tic.ticket,tic.source_notification_id,rec.attempt_count,tic.source_row,ctx,'CLAIMING');
  update public.kk_owner_canonical_ticket set state='CLAIMING' where ticket=tic.ticket;
  return pg_catalog.jsonb_build_object('context',ctx,'rows',tic.rows,'notification_id',tic.source_notification_id,'attempt_id',tic.ticket::text,'attempt_no',rec.attempt_count);
 end if;
 select * into rec from public.kk_owner_canonical_delivery where ticket=tic.ticket for update;
 if not found or rec.status<>'CLAIMING' or tic.state<>'CLAIMING' then raise exception 'CANONICAL_ADMISSION_FENCED';end if;
 clock_at:=pg_catalog.clock_timestamp();
 if observed<clock_at-interval '120 seconds' or observed>clock_at+interval '15 seconds' or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_POLL_EXPIRED';end if;
 r:=tic.source_row;claimed:=p_parameters->'claimed_row';text_binding:=p_parameters->>'binding';b:=text_binding::jsonb;d:=p_parameters->'descriptor';
 if pg_catalog.jsonb_typeof(p_parameters->'binding') is distinct from 'string' or pg_catalog.jsonb_typeof(claimed) is distinct from 'object' or pg_catalog.jsonb_typeof(d) is distinct from 'object' or pg_catalog.jsonb_typeof(b) is distinct from 'array' then raise exception 'CANONICAL_ENQUEUE_TYPE_INVALID';end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(b) x where pg_catalog.jsonb_typeof(x) is distinct from 'string') then raise exception 'CANONICAL_BINDING_TYPE_INVALID';end if;
 if exists(select 1 from pg_catalog.jsonb_each(d) x where pg_catalog.jsonb_typeof(x.value) is distinct from 'string') then raise exception 'CANONICAL_DESCRIPTOR_TYPE_INVALID';end if;
 if pg_catalog.jsonb_typeof(b)<>'array' or pg_catalog.jsonb_array_length(b)<>15 or b->>0<>'kk-owner-ledger-binding-v2' or b->>1<>'1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo' or b->>2<>'_Notification_Ledger' or b->>3<>'TELEGRAM_OWNER_ALERTS' or b->>4<>tic.source_notification_id or (b->>13)::jsonb<>ctx or b->>14 !~ '^CLAIM\|[0-9a-f-]{36}$' then raise exception 'CANONICAL_BINDING_INVALID';end if;
 perform (substring(b->>14 from 7))::uuid;
 expected:=pg_catalog.jsonb_build_array(r->>'Created At',r->>'Payload',r->>'Dedup Key',r->>'Event Family ID',r->>'Show ID',r->>'Change Type',r->>'Priority',r->>'Quiet Hours Policy');
 for slot in 0..7 loop if b->(slot::integer+5) is distinct from expected->slot::integer then raise exception 'CANONICAL_IMMUTABLE_SOURCE_CHANGED';end if;end loop;
 if pg_catalog.jsonb_typeof(claimed->'Last Attempt At') is distinct from 'string' or (claimed->>'Last Attempt At' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') is distinct from true then raise exception 'CANONICAL_CLAIM_TIMESTAMP_INVALID';end if;
 claim_at:=(claimed->>'Last Attempt At')::timestamptz;
 if claim_at is null or not pg_catalog.isfinite(claim_at) or pg_catalog.to_char(claim_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from claimed->>'Last Attempt At' then raise exception 'CANONICAL_CLAIM_TIMESTAMP_INVALID';end if;
 if claim_at<observed or claim_at<clock_at-interval '120 seconds' or claim_at>clock_at+interval '15 seconds' then raise exception 'CANONICAL_CLAIM_EXPIRED';end if;
 expected:=r||pg_catalog.jsonb_build_object('Status','SENDING','Attempt Count',rec.attempt_count,'Last Attempt At',claimed->>'Last Attempt At','Notes',case when r->>'Notes'='' then b->>14 else (r->>'Notes')||' | '||(b->>14) end);
 if claimed<>expected then raise exception 'CANONICAL_CLAIM_CAS_MISMATCH';end if;
 select count(*) into count_keys from pg_catalog.jsonb_object_keys(d);
 if count_keys<>10 or not d ?& array['version','audience','notification_id','request_id','event_type','entity_id','content_version','text','created_at','expires_at'] or d->>'version'<>'kk-make-owner-transport-v1' or d->>'audience'<>'KK_OWNER_TELEGRAM_ONLY' or d->>'event_type'<>'OWNER_ALERT' or d->>'notification_id'<>rec.notification_id or d->>'request_id'<>'kr1_'||substring(rec.notification_id from 5) or d->>'entity_id'<>'ke1_'||substring(rec.notification_id from 5) or d->>'content_version'<>pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(text_binding,'UTF8')),'hex') or d->>'text'='' or pg_catalog.char_length(d->>'text')>2048 then raise exception 'CANONICAL_DESCRIPTOR_INVALID';end if;
 payload:=d->>'text';select coalesce(pg_catalog.sum(case when pg_catalog.ascii(pg_catalog.substr(payload,i,1))>65535 then 2 else 1 end),0) into utf16_length from pg_catalog.generate_series(1,pg_catalog.char_length(payload)) i;
 if utf16_length>2048 or payload<>pg_catalog.btrim(payload,E' \t\n\r\f'||pg_catalog.chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then raise exception 'CANONICAL_DESCRIPTOR_PAYLOAD_INVALID';end if;
 if (d->>'created_at')::timestamptz<claim_at or (d->>'created_at')::timestamptz<clock_at-interval '120 seconds' or (d->>'created_at')::timestamptz>clock_at+interval '15 seconds' or (d->>'expires_at')::timestamptz<=(d->>'created_at')::timestamptz or (d->>'expires_at')::timestamptz>(d->>'created_at')::timestamptz+interval '120 seconds' or (d->>'expires_at')::timestamptz<=clock_at then raise exception 'CANONICAL_ORIGINAL_TTL_INVALID';end if;
 update public.kk_owner_canonical_delivery set status='QUEUED',binding_text=text_binding,descriptor=d,descriptor_sha256=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d::text,'UTF8')),'hex'),claimed_row=claimed where ticket=tic.ticket returning * into rec;
 update public.kk_owner_canonical_attempt set status='QUEUED',binding_text=text_binding,descriptor=d,descriptor_sha256=rec.descriptor_sha256,claimed_row=claimed where ticket=tic.ticket;
 update public.kk_owner_canonical_ticket set state='ADMITTED' where ticket=tic.ticket;return pg_catalog.to_jsonb(rec);
end;
$$;
revoke all on function public.kk_owner_canonical_operation(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.kk_owner_canonical_operation(text,jsonb,text) to service_role;
-- CLAIMING, RESERVED, expired and uncertain attempts have no reset/retry transition.
