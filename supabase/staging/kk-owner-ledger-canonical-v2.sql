-- SOURCE ONLY. Additive, dormant, no cutover row seeded. Does not touch v1 tables/functions.
-- Apply separately with owner approval after live catalog/ACL/policy comparison.
create table public.kk_owner_canonical_cutover (
 cutover_id uuid primary key, activated_at timestamptz not null, policy_version text not null check(policy_version='v4.9.44'),
 consumer_id text not null check(consumer_id='6176241'), environment text not null check(environment in ('preview','production')),
 enabled boolean not null default false, unique(environment)
);
create table public.kk_owner_canonical_poll (
 poll_id uuid primary key, cutover_id uuid not null references public.kk_owner_canonical_cutover,
 slot_id bigint not null check(slot_id>0), context jsonb not null, issued boolean not null default false,
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
 binding_text text, descriptor jsonb, claimed_row jsonb,
 status text not null default 'CLAIMING' check(status in ('CLAIMING','QUEUED','RESERVED','SENT')),
 receipt_id uuid unique, reserved_at timestamptz, delivered_at timestamptz, provider_message_id text,
 check((status='CLAIMING' and binding_text is null and descriptor is null and claimed_row is null and receipt_id is null) or
       (status<>'CLAIMING' and binding_text is not null and descriptor is not null and claimed_row is not null)),
 check(status not in ('RESERVED','SENT') or (receipt_id is not null and reserved_at is not null)),
 check(status<>'SENT' or (provider_message_id is not null and delivered_at is not null and provider_message_id ~ '^[1-9][0-9]{0,19}$' and delivered_at>=reserved_at))
);
alter table public.kk_owner_canonical_cutover enable row level security;
alter table public.kk_owner_canonical_poll enable row level security;
alter table public.kk_owner_canonical_ticket enable row level security;
alter table public.kk_owner_canonical_delivery enable row level security;
revoke all on public.kk_owner_canonical_cutover,public.kk_owner_canonical_poll,public.kk_owner_canonical_ticket,public.kk_owner_canonical_delivery from public,anon,authenticated,service_role;
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
 rec public.kk_owner_canonical_delivery; ctx jsonb; r jsonb; other jsonb; d jsonb; b jsonb; claimed jsonb;
 clock_at timestamptz:=pg_catalog.clock_timestamp(); slot bigint; due_at timestamptz; observed timestamptz;
 id text; dedup text; transport_id text; ticket_id uuid; ids jsonb:='[]'; k text; expected jsonb; text_binding text;
 keys text[]; count_keys integer; claim_at timestamptz; utf16_length bigint; payload text;
begin
 if p_environment not in ('preview','production') or p_environment is null or p_operation is null or p_parameters is null or pg_catalog.jsonb_typeof(p_parameters) is distinct from 'object' or pg_catalog.octet_length(p_parameters::text)>300000 then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 keys:=case p_operation when 'poll' then array[]::text[] when 'tickets' then array['context','rows','candidates'] when 'begin' then array['ticket'] when 'enqueue' then array['ticket','binding','descriptor','claimed_row'] when 'readback' then array['notification_id'] when 'reserve' then array['notification_id'] when 'ack' then array['notification_id','receipt_id','provider_message_id'] else null end;
 select count(*) into count_keys from pg_catalog.jsonb_object_keys(p_parameters);
 if keys is null or count_keys<>pg_catalog.cardinality(keys) or not p_parameters ?& keys then raise exception 'CANONICAL_OPERATION_FORBIDDEN';end if;
 if p_operation in ('begin','enqueue') and pg_catalog.jsonb_typeof(p_parameters->'ticket') is distinct from 'string' then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 if p_operation in ('readback','reserve','ack') and pg_catalog.jsonb_typeof(p_parameters->'notification_id') is distinct from 'string' then raise exception 'CANONICAL_REQUEST_INVALID';end if;
 if p_operation='ack' and (pg_catalog.jsonb_typeof(p_parameters->'receipt_id') is distinct from 'string' or pg_catalog.jsonb_typeof(p_parameters->'provider_message_id') is distinct from 'string') then raise exception 'CANONICAL_ACK_INVALID';end if;
 select * into cfg from public.kk_owner_canonical_cutover where environment=p_environment and enabled for share;
 if not found then raise exception 'CANONICAL_DISABLED_OR_UNBOUND';end if;
 if p_operation='poll' then
  slot:=floor(extract(epoch from (clock_at-cfg.activated_at))/900);due_at:=cfg.activated_at+slot*interval '900 seconds';
  if slot<1 or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_SLOT_NOT_DUE';end if;
  ctx:=pg_catalog.jsonb_build_object('version','kk-owner-canonical-context-v2','cutover_id',cfg.cutover_id::text,'activated_at',pg_catalog.to_char(cfg.activated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'policy_version',cfg.policy_version,'consumer_id',cfg.consumer_id,
   'script_project_id','1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF','spreadsheet_id','1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo','tab','_Notification_Ledger','transport','TELEGRAM_OWNER_ALERTS','environment',cfg.environment,
   'poll_id',pg_catalog.gen_random_uuid()::text,'slot_id',slot::text,'due_at',pg_catalog.to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'observed_at',pg_catalog.to_char(clock_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'nonce',pg_catalog.gen_random_uuid()::text);
  insert into public.kk_owner_canonical_poll values((ctx->>'poll_id')::uuid,cfg.cutover_id,slot,ctx,false);return ctx;
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
  if rec.context->>'cutover_id'<>cfg.cutover_id::text then raise exception 'CANONICAL_CUTOVER_MISMATCH';end if;
  if p_operation='readback' then return pg_catalog.to_jsonb(rec);end if;
  if rec.descriptor is null or (rec.descriptor->>'expires_at')::timestamptz<=clock_at then raise exception 'CANONICAL_ORIGINAL_DESCRIPTOR_EXPIRED';end if;
  if p_operation='reserve' then
   if rec.status<>'QUEUED' then raise exception 'CANONICAL_ALREADY_ATTEMPTED';end if;
   update public.kk_owner_canonical_delivery set status='RESERVED',receipt_id=pg_catalog.gen_random_uuid(),reserved_at=clock_at where notification_id=rec.notification_id returning * into rec;
   return pg_catalog.jsonb_build_object('status',rec.status,'receipt_id',rec.receipt_id);
  end if;
  if rec.status='SENT' and rec.receipt_id=(p_parameters->>'receipt_id')::uuid and rec.provider_message_id=p_parameters->>'provider_message_id' then return pg_catalog.to_jsonb(rec);end if;
  if rec.status<>'RESERVED' or rec.receipt_id is distinct from (p_parameters->>'receipt_id')::uuid or (p_parameters->>'provider_message_id' ~ '^[1-9][0-9]{0,19}$') is distinct from true then raise exception 'CANONICAL_ACK_MISMATCH';end if;
  update public.kk_owner_canonical_delivery set status='SENT',provider_message_id=p_parameters->>'provider_message_id',delivered_at=clock_at where notification_id=rec.notification_id returning * into rec;return pg_catalog.to_jsonb(rec);
 end if;
 ctx:=pol.context;observed:=(ctx->>'observed_at')::timestamptz;due_at:=(ctx->>'due_at')::timestamptz;
 if pol.cutover_id<>cfg.cutover_id or observed<clock_at-interval '120 seconds' or observed>clock_at+interval '15 seconds' or clock_at>due_at+interval '120 seconds' then raise exception 'CANONICAL_POLL_EXPIRED';end if;
 if p_operation='tickets' then
  if pg_catalog.jsonb_typeof(p_parameters->'context') is distinct from 'object' or pg_catalog.jsonb_typeof(p_parameters->'rows') is distinct from 'array' or pg_catalog.jsonb_array_length(p_parameters->'rows')>128 or pg_catalog.octet_length((p_parameters->'rows')::text)>262144 or pg_catalog.jsonb_typeof(p_parameters->'candidates') is distinct from 'array' or pg_catalog.jsonb_array_length(p_parameters->'candidates')>128 then raise exception 'CANONICAL_SNAPSHOT_BOUNDS';end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_parameters->'candidates') x where pg_catalog.jsonb_typeof(x)<>'string') then raise exception 'CANONICAL_CANDIDATE_INVALID';end if;
  for id in select pg_catalog.jsonb_array_elements_text(p_parameters->'candidates') loop
   select count(*) into count_keys from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Notification ID'=id;
   if count_keys<>1 then raise exception 'CANONICAL_ID_AMBIGUOUS';end if;
   select x into r from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Notification ID'=id;
   select count(*) into count_keys from pg_catalog.jsonb_object_keys(r);
   if count_keys<>23 or not r ?& array['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'] then raise exception 'CANONICAL_ROW_INVALID';end if;
   for k in select pg_catalog.jsonb_object_keys(r) loop
    if k<>'Attempt Count' and pg_catalog.jsonb_typeof(r->k) is distinct from 'string' then raise exception 'CANONICAL_ROW_TYPE_INVALID';end if;
   end loop;
   if pg_catalog.jsonb_typeof(r->'Attempt Count') not in ('string','number') then raise exception 'CANONICAL_ROW_TYPE_INVALID';end if;
   dedup:=r->>'Dedup Key';
   if pg_catalog.octet_length(id)<6 or pg_catalog.octet_length(id)>93 or id ~ '[[:cntrl:]]' or id like 'KKUAT_%' or r->>'Transport'<>'TELEGRAM_OWNER_ALERTS' or r->>'Status'<>'QUEUED' or r->>'Attempt Count'<>'0' or dedup='' or dedup is null or r->>'Change Type' in ('','TRANSPORT_UAT') or r->>'Priority' in ('','TEST') or r->>'Quiet Hours Policy' in ('','OWNER_CONTROLLED_UAT') or r->>'Event Family ID'='' or r->>'Audit Event ID'='' or r->>'Audit Event ID' like 'CONTROLLED_UAT|%' or r->>'Notes' ~ 'CLAIM\||OWNER_AUTHORIZED_TRANSPORT_UAT' then raise exception 'CANONICAL_NORMAL_SOURCE_REQUIRED';end if;
   foreach k in array array['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'] loop if r->>k is distinct from '' then raise exception 'CANONICAL_PRIOR_ATTEMPT';end if;end loop;
   if (r->>'Created At')::timestamptz<cfg.activated_at or (r->>'Created At')::timestamptz>observed or r->>'Payload'='' or pg_catalog.char_length(r->>'Payload')>2048 then raise exception 'CANONICAL_SOURCE_CUTOVER_INVALID';end if;
   payload:=r->>'Payload';select coalesce(pg_catalog.sum(case when pg_catalog.ascii(pg_catalog.substr(payload,i,1))>65535 then 2 else 1 end),0) into utf16_length from pg_catalog.generate_series(1,pg_catalog.char_length(payload)) i;
   if utf16_length>2048 or payload<>pg_catalog.btrim(payload,E' \t\n\r\f'||pg_catalog.chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then raise exception 'CANONICAL_SOURCE_PAYLOAD_INVALID';end if;
   if (extract(hour from clock_at at time zone 'Asia/Bangkok')>=23 or extract(hour from clock_at at time zone 'Asia/Bangkok')<7) and not(r->>'Priority'='P0' and r->>'Change Type' in ('CANCELLATION','POSTPONEMENT','DATE_CHANGE','VENUE_CHANGE')) then raise exception 'CANONICAL_QUIET_HOURS_HOLD';end if;
   select count(*) into count_keys from pg_catalog.jsonb_array_elements(p_parameters->'rows') x where x->>'Transport'='TELEGRAM_OWNER_ALERTS' and x->>'Dedup Key'=dedup;
   if count_keys<>1 then raise exception 'CANONICAL_DEDUP_AMBIGUOUS';end if;
   if exists(select 1 from public.kk_owner_canonical_delivery q where q.source_notification_id=id or q.dedup_key=dedup) then continue;end if;
   ticket_id:=pg_catalog.gen_random_uuid();insert into public.kk_owner_canonical_ticket values(ticket_id,pol.poll_id,id,dedup,p_parameters->'rows',r,'NEW');ids:=ids||pg_catalog.jsonb_build_array(ticket_id::text);
  end loop;
  update public.kk_owner_canonical_poll set issued=true where poll_id=pol.poll_id;return ids;
 end if;
 if p_operation='begin' then
  if tic.state<>'NEW' then raise exception 'CANONICAL_TICKET_ALREADY_CONSUMED';end if;
  transport_id:='ks1_'||pg_catalog.rtrim(pg_catalog.translate(pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(tic.source_notification_id,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  insert into public.kk_owner_canonical_delivery(source_notification_id,dedup_key,ticket,notification_id,context,source_row) values(tic.source_notification_id,tic.dedup_key,tic.ticket,transport_id,ctx,tic.source_row);
  update public.kk_owner_canonical_ticket set state='CLAIMING' where ticket=tic.ticket;
  return pg_catalog.jsonb_build_object('context',ctx,'rows',tic.rows,'notification_id',tic.source_notification_id);
 end if;
 select * into rec from public.kk_owner_canonical_delivery where ticket=tic.ticket for update;
 if not found or rec.status<>'CLAIMING' or tic.state<>'CLAIMING' then raise exception 'CANONICAL_ADMISSION_FENCED';end if;
 r:=tic.source_row;claimed:=p_parameters->'claimed_row';text_binding:=p_parameters->>'binding';b:=text_binding::jsonb;d:=p_parameters->'descriptor';
 if pg_catalog.jsonb_typeof(p_parameters->'binding') is distinct from 'string' or pg_catalog.jsonb_typeof(claimed) is distinct from 'object' or pg_catalog.jsonb_typeof(d) is distinct from 'object' or pg_catalog.jsonb_typeof(b) is distinct from 'array' then raise exception 'CANONICAL_ENQUEUE_TYPE_INVALID';end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(b) x where pg_catalog.jsonb_typeof(x) is distinct from 'string') then raise exception 'CANONICAL_BINDING_TYPE_INVALID';end if;
 if exists(select 1 from pg_catalog.jsonb_each(d) x where pg_catalog.jsonb_typeof(x.value) is distinct from 'string') then raise exception 'CANONICAL_DESCRIPTOR_TYPE_INVALID';end if;
 if pg_catalog.jsonb_typeof(b)<>'array' or pg_catalog.jsonb_array_length(b)<>15 or b->>0<>'kk-owner-ledger-binding-v2' or b->>1<>'1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo' or b->>2<>'_Notification_Ledger' or b->>3<>'TELEGRAM_OWNER_ALERTS' or b->>4<>tic.source_notification_id or (b->>13)::jsonb<>ctx or b->>14 !~ '^CLAIM\|[0-9a-f-]{36}$' then raise exception 'CANONICAL_BINDING_INVALID';end if;
 perform (substring(b->>14 from 7))::uuid;
 expected:=pg_catalog.jsonb_build_array(r->>'Created At',r->>'Payload',r->>'Dedup Key',r->>'Event Family ID',r->>'Show ID',r->>'Change Type',r->>'Priority',r->>'Quiet Hours Policy');
 for slot in 0..7 loop if b->(slot::integer+5) is distinct from expected->slot::integer then raise exception 'CANONICAL_IMMUTABLE_SOURCE_CHANGED';end if;end loop;
 claim_at:=(claimed->>'Last Attempt At')::timestamptz;
 if claim_at<observed or claim_at<clock_at-interval '120 seconds' or claim_at>clock_at+interval '15 seconds' then raise exception 'CANONICAL_CLAIM_EXPIRED';end if;
 expected:=r||pg_catalog.jsonb_build_object('Status','SENDING','Attempt Count',1,'Last Attempt At',claimed->>'Last Attempt At','Notes',case when r->>'Notes'='' then b->>14 else (r->>'Notes')||' | '||(b->>14) end);
 if claimed<>expected then raise exception 'CANONICAL_CLAIM_CAS_MISMATCH';end if;
 select count(*) into count_keys from pg_catalog.jsonb_object_keys(d);
 if count_keys<>10 or not d ?& array['version','audience','notification_id','request_id','event_type','entity_id','content_version','text','created_at','expires_at'] or d->>'version'<>'kk-make-owner-transport-v1' or d->>'audience'<>'KK_OWNER_TELEGRAM_ONLY' or d->>'event_type'<>'OWNER_ALERT' or d->>'notification_id'<>rec.notification_id or d->>'request_id'<>'kr1_'||substring(rec.notification_id from 5) or d->>'entity_id'<>'ke1_'||substring(rec.notification_id from 5) or d->>'content_version'<>pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(text_binding,'UTF8')),'hex') or d->>'text'='' or pg_catalog.char_length(d->>'text')>2048 then raise exception 'CANONICAL_DESCRIPTOR_INVALID';end if;
 payload:=d->>'text';select coalesce(pg_catalog.sum(case when pg_catalog.ascii(pg_catalog.substr(payload,i,1))>65535 then 2 else 1 end),0) into utf16_length from pg_catalog.generate_series(1,pg_catalog.char_length(payload)) i;
 if utf16_length>2048 or payload<>pg_catalog.btrim(payload,E' \t\n\r\f'||pg_catalog.chr(11)||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then raise exception 'CANONICAL_DESCRIPTOR_PAYLOAD_INVALID';end if;
 if (d->>'created_at')::timestamptz<claim_at or (d->>'created_at')::timestamptz<clock_at-interval '120 seconds' or (d->>'created_at')::timestamptz>clock_at+interval '15 seconds' or (d->>'expires_at')::timestamptz<=(d->>'created_at')::timestamptz or (d->>'expires_at')::timestamptz>(d->>'created_at')::timestamptz+interval '120 seconds' or (d->>'expires_at')::timestamptz<=clock_at then raise exception 'CANONICAL_ORIGINAL_TTL_INVALID';end if;
 update public.kk_owner_canonical_delivery set status='QUEUED',binding_text=text_binding,descriptor=d,claimed_row=claimed where ticket=tic.ticket returning * into rec;
 update public.kk_owner_canonical_ticket set state='ADMITTED' where ticket=tic.ticket;return pg_catalog.to_jsonb(rec);
end;
$$;
revoke all on function public.kk_owner_canonical_operation(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.kk_owner_canonical_operation(text,jsonb,text) to service_role;
-- CLAIMING, RESERVED, expired and uncertain attempts have no reset/retry transition.
