-- DRAFT ONLY: review/intentional-repeat gate layered AFTER durable ledger migration.
-- NEVER apply to Production before isolated PostgreSQL TEST, owner acceptance and CI.
alter table kk_private.inbox_outbound_attempts
 add column if not exists review_status text not null default 'UNREVIEWED'
   check(review_status in ('UNREVIEWED','NEEDS_INVESTIGATION','VERIFIED_SENT')),
 add column if not exists review_evidence_ref text not null default '',
 add column if not exists review_note text not null default '',
 add column if not exists reviewed_at timestamptz,
 add column if not exists reviewed_by text not null default '',
 add column if not exists intentional_repeat_of uuid
    references kk_private.inbox_outbound_attempts(request_id),
 add column if not exists intentional_repeat_reason text not null default '';

-- Service-role-only, read-only status. Never expose secret HMAC or provider retry keys.
create or replace function public.kk_inbox_list_outbound_attempts(
 p_conversation_id text,p_limit integer default 30
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,kk_private
as $$
declare v_rows jsonb;
begin
 if nullif(btrim(p_conversation_id),'') is null then
   raise exception 'outbound conversation required';
 end if;
 if not exists(select 1 from kk_private.inbox_conversations
               where conversation_id=p_conversation_id and channel='line') then
   raise exception 'outbound conversation not found';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb)
 into v_rows from (
   select request_id::text,conversation_id,status,review_status,
          created_at,updated_at,reviewed_at,reviewed_by,
          provider_message_id,provider_request_id,
          review_evidence_ref,review_note,
          intentional_repeat_of::text as intentional_repeat_of
   from kk_private.inbox_outbound_attempts
   where conversation_id=p_conversation_id
   order by created_at desc,request_id desc
   limit least(greatest(coalesce(p_limit,30),1),50)
 ) t;
 return v_rows;
end;
$$;
revoke all on function public.kk_inbox_list_outbound_attempts(text,integer) from public,anon,authenticated;
grant execute on function public.kk_inbox_list_outbound_attempts(text,integer) to service_role;

-- Review is evidence annotation, NEVER itself a provider send or unlocked retry.
-- VERIFIED_SENT requires a confirmed SENT ledger record and exact provider ID.
-- UNCERTAIN/RESERVED are always ineligible for repeat.
create or replace function public.kk_inbox_review_outbound(
 p_conversation_id text,p_request_id uuid,p_review_status text,
 p_evidence_ref text,p_note text
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,kk_private
as $$
declare v_row kk_private.inbox_outbound_attempts%rowtype;
begin
 if nullif(btrim(p_conversation_id),'') is null or p_request_id is null or
    p_review_status not in ('NEEDS_INVESTIGATION','VERIFIED_SENT') or
    length(btrim(coalesce(p_evidence_ref,'')))>160 or
    length(btrim(coalesce(p_note,'')))>240 then
    raise exception 'invalid owner review request';
 end if;
 select * into v_row from kk_private.inbox_outbound_attempts
 where request_id=p_request_id and conversation_id=p_conversation_id
 for update;
 if not found then raise exception 'outbound attempt not found in conversation'; end if;
 if v_row.review_status='VERIFIED_SENT' and p_review_status<>'VERIFIED_SENT' then
    raise exception 'verified send cannot be silently downgraded';
 end if;
 if p_review_status='VERIFIED_SENT' and
    (v_row.status<>'SENT' or nullif(v_row.provider_message_id,'') is null
     or length(btrim(coalesce(p_evidence_ref,'')))<6) then
    raise exception 'cannot verify sent without durable provider receipt and evidence';
 end if;
 update kk_private.inbox_outbound_attempts
 set review_status=p_review_status,
     review_evidence_ref=btrim(coalesce(p_evidence_ref,'')),
     review_note=btrim(coalesce(p_note,'')),
     reviewed_by='owner',reviewed_at=now(),updated_at=now()
 where request_id=p_request_id;
 insert into kk_private.inbox_audit(action,conversation_id,message_id,evidence)
 values ('outbound_owner_review',p_conversation_id,p_request_id::text,
         jsonb_build_object('status',p_review_status,'evidence_ref',left(btrim(coalesce(p_evidence_ref,'')),160),
                            'reviewed_by','owner'));
 return jsonb_build_object('ok',true,'request_id',p_request_id::text,
                           'review_status',p_review_status,'provider_sends',0);
end;
$$;
revoke all on function public.kk_inbox_review_outbound(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_review_outbound(text,uuid,text,text,text) to service_role;

-- Preserve immutable request IDs. Existing 30-day body duplicate hold stays.
-- An intentional exact-text repeat requires latest matching previous attempt SENT,
-- owner-verified, provider ID, evidence and an explicit reason/new request UUID.
-- It NEVER allows replay of RESERVED/UNCERTAIN, including with owner review.
create or replace function public.kk_inbox_reserve_outbound(
 p_request_id uuid,p_conversation_id text,p_body_fingerprint text,
 p_repeat_of uuid default null,p_repeat_reason text default ''
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,kk_private
as $$
declare
 v_match kk_private.inbox_outbound_attempts%rowtype;
 v_new kk_private.inbox_outbound_attempts%rowtype;
 v_reason text:=btrim(coalesce(p_repeat_reason,''));
begin
 if p_request_id is null or nullif(btrim(p_conversation_id),'') is null
    or p_body_fingerprint !~ '^[a-f0-9]{64}$'
    or length(v_reason)>240 then
   raise exception 'outbound reservation identity invalid';
 end if;
 if not exists(select 1 from kk_private.inbox_conversations
               where conversation_id=p_conversation_id and channel='line') then
   raise exception 'outbound conversation not found';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id||':'||p_body_fingerprint,0));
 select * into v_match from kk_private.inbox_outbound_attempts
 where request_id=p_request_id;
 if found then
   return jsonb_build_object('allowed',false,
     'status',case when v_match.conversation_id<>p_conversation_id
                       or v_match.body_fingerprint<>p_body_fingerprint
                   then 'REQUEST_CONFLICT' else 'ALREADY_RESERVED' end);
 end if;
 -- An older unresolved send in the 30-day window takes precedence even
 -- if a newer row somehow appears SENT. Never override ambiguous delivery.
 if exists(select 1 from kk_private.inbox_outbound_attempts
   where conversation_id=p_conversation_id and body_fingerprint=p_body_fingerprint
   and created_at >= now()-interval '30 days'
   and status in ('RESERVED','UNCERTAIN')) then
   return jsonb_build_object('allowed',false,'status','UNRESOLVED_OUTBOUND_IN_WINDOW');
 end if;
 select * into v_match from kk_private.inbox_outbound_attempts
 where conversation_id=p_conversation_id and body_fingerprint=p_body_fingerprint
   and created_at >= now()-interval '30 days'
 order by created_at desc,request_id desc limit 1;
 if found then
   if p_repeat_of is null or p_repeat_of<>v_match.request_id
      or v_match.status<>'SENT' or v_match.review_status<>'VERIFIED_SENT'
      or nullif(v_match.provider_message_id,'') is null
      or length(btrim(v_match.review_evidence_ref))<6 or
      length(v_reason)<12 then
     return jsonb_build_object('allowed',false,'status','DUPLICATE_CONTENT_UNDER_REVIEW');
   end if;
 elsif p_repeat_of is not null then
   return jsonb_build_object('allowed',false,'status','REPEAT_PARENT_NOT_LATEST');
 end if;
 insert into kk_private.inbox_outbound_attempts
  (request_id,conversation_id,body_fingerprint,intentional_repeat_of,intentional_repeat_reason)
 values (p_request_id,p_conversation_id,p_body_fingerprint,p_repeat_of,v_reason)
 returning * into v_new;
 return jsonb_build_object('allowed',true,'status','RESERVED',
                           'retry_key',v_new.retry_key::text);
end;
$$;
revoke all on function public.kk_inbox_reserve_outbound(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_reserve_outbound(uuid,text,text,uuid,text) to service_role;
-- Remove obsolete callable 3-arg RPC signature: otherwise old clients can bypass the new
-- reviewed-repeat rules or PostgREST may select an ambiguous overload.
drop function if exists public.kk_inbox_reserve_outbound(uuid,text,text);
comment on function public.kk_inbox_reserve_outbound(uuid,text,text,uuid,text) is
 'Durable at-most-once LINE send; intentional repeats require latest verified SENT owner-reviewed proof and new click. Never retry uncertain.';

-- Historical messages must not be fabricated into reservation/receipt rows.
-- Read the complete30-day legacy window before a new server reservation instead.
-- Existing new-ledger messages remain governed by the reservation/review rules.
create or replace function public.kk_inbox_has_legacy_outbound(
 p_conversation_id text,p_body_text text
) returns boolean language plpgsql stable security invoker
set search_path = pg_catalog,kk_private
as $$
declare
 v_conversation_id text:=nullif(btrim(p_conversation_id),'');
 v_body text:=nullif(btrim(p_body_text),'');
begin
 if v_conversation_id is null or v_body is null or length(p_body_text)>5000 then
   raise exception 'legacy outbound history identity invalid';
 end if;
 if not exists(select 1 from kk_private.inbox_conversations
               where conversation_id=v_conversation_id and channel='line') then
   raise exception 'outbound conversation not found';
 end if;
 return exists(
  select 1 from kk_private.inbox_messages m
  where m.conversation_id=v_conversation_id and m.channel='line'
    and m.direction='outbound' and btrim(m.body_text)=v_body
    and coalesce(m.sent_at,m.created_at)>=now()-interval '30 days'
    and not exists(
      select 1 from kk_private.inbox_outbound_attempts a
      where a.conversation_id=m.conversation_id
        and a.request_id::text=lower(btrim(coalesce(m.payload->>'outbound_request_id','')))
    )
 );
end;
$$;
revoke all on function public.kk_inbox_has_legacy_outbound(text,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_has_legacy_outbound(text,text) to service_role;
comment on function public.kk_inbox_has_legacy_outbound(text,text) is
 'Read-only complete30-day LINE legacy text duplicate check; boolean only, no history backfill or provider call. Service-role only.';

-- The old 3-argument RPC was dropped; refresh PostgREST signature cache.
notify pgrst, 'reload schema';
