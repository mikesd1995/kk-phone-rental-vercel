create table if not exists public.kk_agent_invocations (
  invocation_id text primary key
    check (invocation_id ~ '^agi_[A-Za-z0-9_-]{16,96}$'),
  occurred_at timestamptz not null default now(),
  request_type text not null
    check (request_type ~ '^[A-Z0-9_]{3,96}$'),
  intent text not null
    check (intent ~ '^[a-z0-9_]{3,64}$'),
  route_id text not null default '',
  required_agents jsonb not null default '[]'::jsonb
    check (jsonb_typeof(required_agents)='array' and jsonb_array_length(required_agents)>0),
  invoked_agents jsonb not null default '[]'::jsonb
    check (jsonb_typeof(invoked_agents)='array'),
  agent_versions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(agent_versions)='object'),
  registry_version text not null,
  gateway_version text not null,
  gate_status text not null
    check (gate_status in (
      'READY_FOR_OWNER_REVIEW',
      'BLOCKED_CONTENT_GATE',
      'BLOCKED_REQUIRED_AGENT_NOT_INVOKED',
      'BLOCKED_LEDGER_UNAVAILABLE'
    )),
  blocked_reason text not null default '',
  content_gate text not null default '',
  request_hash text not null
    check (request_hash ~ '^[0-9a-f]{64}$'),
  truth_hash text not null
    check (truth_hash ~ '^[0-9a-f]{64}$'),
  source_commit_sha text not null default '',
  owner_review_required boolean not null default true
    check (owner_review_required = true),
  production_writes integer not null default 0
    check (production_writes = 0),
  publishes integer not null default 0
    check (publishes = 0)
);

comment on table public.kk_agent_invocations is
  'Audit-only KK Agent Gateway invocation evidence. Stores hashes and routing metadata; never business truth or raw prompts.';

alter table public.kk_agent_invocations enable row level security;

revoke all on table public.kk_agent_invocations from anon, authenticated;
grant select, insert on table public.kk_agent_invocations to service_role;

drop policy if exists kk_agent_invocations_deny_public on public.kk_agent_invocations;
create policy kk_agent_invocations_deny_public
on public.kk_agent_invocations
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists kk_agent_invocations_occurred_at_idx
  on public.kk_agent_invocations (occurred_at desc);

create index if not exists kk_agent_invocations_intent_status_idx
  on public.kk_agent_invocations (intent, gate_status, occurred_at desc);
