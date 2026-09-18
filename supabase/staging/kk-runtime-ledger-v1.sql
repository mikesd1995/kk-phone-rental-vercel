-- KK Phone Rental external runtime audit ledger V1.
-- STAGING SQL ONLY. Not applied to any Supabase project by this commit.
-- Apply only after the dedicated KK Supabase project is explicitly identified.

begin;

create table if not exists public.kk_runtime_expectations (
  occurrence_id text primary key,
  role text not null check (role in ('SCANNER','VERIFIER')),
  scheduled_at timestamptz not null,
  issued_at timestamptz not null,
  source text not null,
  trigger_version text not null,
  nonce text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'EXPECTED' check (status in ('EXPECTED','STARTED','TERMINAL','MISSED','BLOCKED')),
  mode text not null default 'WITNESS_ONLY',
  received_at timestamptz not null default now(),
  unique (role, scheduled_at)
);

create table if not exists public.kk_runtime_observations (
  id bigint generated always as identity primary key,
  occurrence_id text not null references public.kk_runtime_expectations(occurrence_id) on delete restrict,
  observed_at timestamptz not null default now(),
  stage text not null check (stage in ('EXPECTED','STARTED','CORE_LOCK','ROLE_LOCK','MANIFEST','TERMINAL','ERROR')),
  run_id text,
  classification text,
  evidence_hash text check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.kk_task_state_events (
  id bigint generated always as identity primary key,
  task_id text not null,
  role text not null check (role in ('SCANNER','VERIFIER','CANARY','OTHER')),
  observed_at timestamptz not null default now(),
  is_enabled boolean,
  updated_at_source timestamptz,
  last_run_time_source timestamptz,
  source text not null,
  classification text,
  evidence_hash text check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.kk_control_plane_incidents (
  id bigint generated always as identity primary key,
  incident_key text not null unique,
  role text not null check (role in ('SCANNER','VERIFIER','CANARY','CONTROL')),
  occurred_at timestamptz not null,
  classification text not null,
  severity text not null check (severity in ('P0','P1','P2','P3')),
  occurrence_id text,
  run_id text,
  root_cause_state text not null default 'UNKNOWN' check (root_cause_state in ('UNKNOWN','PROBABLE','PROVEN')),
  evidence jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists kk_runtime_observations_occurrence_idx
  on public.kk_runtime_observations (occurrence_id, observed_at);

create index if not exists kk_task_state_events_role_time_idx
  on public.kk_task_state_events (role, observed_at desc);

create index if not exists kk_control_plane_incidents_time_idx
  on public.kk_control_plane_incidents (occurred_at desc);

alter table public.kk_runtime_expectations enable row level security;
alter table public.kk_runtime_observations enable row level security;
alter table public.kk_task_state_events enable row level security;
alter table public.kk_control_plane_incidents enable row level security;

revoke all on table public.kk_runtime_expectations from public, anon, authenticated;
revoke all on table public.kk_runtime_observations from public, anon, authenticated;
revoke all on table public.kk_task_state_events from public, anon, authenticated;
revoke all on table public.kk_control_plane_incidents from public, anon, authenticated;

grant select, insert, update on table public.kk_runtime_expectations to service_role;
grant select, insert on table public.kk_runtime_observations to service_role;
grant select, insert on table public.kk_task_state_events to service_role;
grant select, insert, update on table public.kk_control_plane_incidents to service_role;

grant usage, select on all sequences in schema public to service_role;

comment on table public.kk_runtime_expectations is
  'External clock expectations for KK control-plane occurrences. No business truth.';
comment on table public.kk_runtime_observations is
  'Append-only runtime boundary observations linked to an expected occurrence.';
comment on table public.kk_task_state_events is
  'External observations of task registry state; not task authority.';
comment on table public.kk_control_plane_incidents is
  'Control-plane incident ledger. Root cause must remain UNKNOWN unless directly evidenced.';

commit;
