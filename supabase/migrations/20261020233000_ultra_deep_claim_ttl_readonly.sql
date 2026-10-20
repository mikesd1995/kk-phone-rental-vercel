-- KK Ultra Deep / runtime-ledger: atomic fail-closed claim protection.
-- Draft migration ONLY. Apply to kk-phone-rental-runtime-ledger ONLY after owner approval,
-- current schema fingerprint check, zero-cost read-only acceptance and rollback plan.
-- Supabase project ref observed 2026-10-20: zehlsagzrpromtfqqflt.
-- No UPDATE of existing queued rows; old commands remain unchanged and cannot be claimed.
BEGIN;
CREATE OR REPLACE FUNCTION public.kk_ultra_deep_command_claim(p_command_id uuid)
RETURNS TABLE(command_id uuid, month text, commit boolean)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.kk_ultra_deep_commands AS c
  SET status='CLAIMED', claimed_at=now()
  WHERE c.command_id=p_command_id
    AND c.status='QUEUED'
    AND c.commit IS FALSE
    AND c.created_at >= now() - interval '60 minutes'
    AND c.created_at <= now()
  RETURNING c.command_id,c.month,c.commit;
END
$function$;
COMMENT ON FUNCTION public.kk_ultra_deep_command_claim(uuid) IS
 'READONLY queue claim: atomic status gate, 60-minute expiry, commit=false. Require owner-approved deployment; no stale replay.';
COMMIT;
