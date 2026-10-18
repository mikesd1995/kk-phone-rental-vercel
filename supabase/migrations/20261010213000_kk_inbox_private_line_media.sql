-- KK Unified Inbox private LINE image archive; additive, no booking/event/pricing mutation.
-- service_role only. Never make this bucket public or expose service keys to browser.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kk-inbox-media','kk-inbox-media',false,8388608,
 array['image/jpeg','image/png','image/gif','image/webp']::text[])
on conflict (id) do nothing;

do $$
begin
 if not exists(select 1 from storage.buckets where id='kk-inbox-media' and public=false)
 then raise exception 'inbox media bucket must exist and stay private';
 end if;
end $$;

-- An exact membership assertion before any image can leave the Admin API.
-- This RPC is callable by service_role only, never by anonymous clients.
create or replace function public.kk_inbox_media_metadata(
 p_conversation_id text,p_message_id text
) returns jsonb
language sql security invoker set search_path=pg_catalog,kk_private
as $$
 select to_jsonb(x) from (
  select message_id,conversation_id,channel,direction,message_type,
    nullif(payload->>'line_message_id','') as provider_message_id
  from kk_private.inbox_messages
  where conversation_id=btrim(p_conversation_id)
    and message_id=btrim(p_message_id)
    and channel='line' and direction='inbound' and message_type='image'
  limit 1
 ) x
$$;
revoke all on function public.kk_inbox_media_metadata(text,text) from public,anon,authenticated;
grant execute on function public.kk_inbox_media_metadata(text,text) to service_role;

comment on function public.kk_inbox_media_metadata(text,text) is
 'Private, exact-membership LINE image lookup for authenticated KK Admin server; no public image URLs';
