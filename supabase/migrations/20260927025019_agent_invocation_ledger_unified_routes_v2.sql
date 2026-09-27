alter table public.kk_agent_invocations
  drop constraint if exists kk_agent_invocations_gate_status_check;

alter table public.kk_agent_invocations
  add constraint kk_agent_invocations_gate_status_check
  check (gate_status in (
    'READY_FOR_OWNER_REVIEW',
    'RECORDED',
    'BLOCKED_CONTENT_GATE',
    'BLOCKED_REQUIRED_AGENT_NOT_INVOKED',
    'BLOCKED_LEDGER_UNAVAILABLE',
    'BLOCKED_RUNTIME_NOT_AVAILABLE',
    'BLOCKED_AGENT_EXECUTION_FAILED'
  ));

alter table public.kk_agent_invocations
  drop constraint if exists kk_agent_invocations_owner_review_required_check;

comment on column public.kk_agent_invocations.owner_review_required is
  'True for public content requiring owner approval; false for internal read-only agent/audit invocations.';

revoke all on table public.kk_agent_invocations from anon, authenticated, service_role;
grant select, insert on table public.kk_agent_invocations to service_role;
