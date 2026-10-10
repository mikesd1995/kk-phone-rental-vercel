-- Supabase default grants may re-grant full table privileges to service_role
-- even when a new migration only requests SELECT/INSERT. Revoke explicitly.
-- Immutable source-only scan receipts: service_role never UPDATE/DELETE/TRUNCATE.
begin;
revoke all on table public.kk_ultra_deep_scan_shards
  from public, anon, authenticated, service_role;
grant select, insert on table public.kk_ultra_deep_scan_shards to service_role;
commit;
