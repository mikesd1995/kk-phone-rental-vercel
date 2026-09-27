create table if not exists public.kk_decision_events (
  event_id text primary key
    check (event_id ~ '^dle_[A-Za-z0-9_-]{16,96}$'),
  decision_id text not null
    check (decision_id ~ '^dec_[A-Za-z0-9_-]{8,96}$'),
  occurred_at timestamptz not null default now(),
  event_type text not null
    check (event_type in ('RECOMMENDATION','OWNER_DECISION','OUTCOME','LESSON')),
  decision_type text not null
    check (decision_type in ('event_opportunity','content','pricing','customer','engineering','operations','storefront','system')),
  subject_ref text not null default ''
    check (length(subject_ref) <= 160),
  recommendation_code text not null default ''
    check (recommendation_code ~ '^[A-Z0-9_:-]{0,128}$'),
  owner_action text not null default ''
    check (owner_action in ('','APPROVED','REJECTED','MODIFIED','DEFERRED')),
  confidence numeric(5,2)
    check (confidence is null or (confidence >= 0 and confidence <= 100)),
  expected_score numeric(5,2)
    check (expected_score is null or (expected_score >= 0 and expected_score <= 100)),
  outcome_score numeric(5,2)
    check (outcome_score is null or (outcome_score >= 0 and outcome_score <= 100)),
  evidence_hash text not null
    check (evidence_hash ~ '^[0-9a-f]{64}$'),
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object')
    check (not (metrics ?| array[
      'customer_name','name','phone','email','address','payment_details',
      'card_number','secret','password','raw_prompt','prompt','message'
    ])),
  lesson_code text not null default ''
    check (lesson_code ~ '^[A-Z0-9_:-]{0,128}$'),
  source text not null default 'KK_OPERATING_PARTNER_V1'
    check (length(source) between 1 and 128),
  source_commit_sha text not null default ''
    check (source_commit_sha = '' or source_commit_sha ~ '^[0-9a-f]{40}$'),
  production_writes integer not null default 0
    check (production_writes = 0),
  publishes integer not null default 0
    check (publishes = 0),
  check (event_type <> 'OWNER_DECISION' or owner_action <> ''),
  check (event_type <> 'OUTCOME' or outcome_score is not null or metrics <> '{}'::jsonb)
);

comment on table public.kk_decision_events is
  'Append-only KK Operating Partner decision/outcome learning ledger. Advisory evidence only; no customer PII or business-truth authority.';

alter table public.kk_decision_events enable row level security;

revoke all on table public.kk_decision_events from anon, authenticated, service_role;
grant select, insert on table public.kk_decision_events to service_role;

drop policy if exists kk_decision_events_deny_public on public.kk_decision_events;
create policy kk_decision_events_deny_public
on public.kk_decision_events
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists kk_decision_events_decision_time_idx
  on public.kk_decision_events (decision_id, occurred_at asc);

create index if not exists kk_decision_events_type_time_idx
  on public.kk_decision_events (decision_type, event_type, occurred_at desc);
