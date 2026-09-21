begin;

create table if not exists public.kk_control_plane_config (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  note text not null default ''
);

alter table public.kk_control_plane_config enable row level security;

revoke all on table public.kk_control_plane_config from public, anon, authenticated;
grant select, update on table public.kk_control_plane_config to service_role;

insert into public.kk_control_plane_config (key, enabled, note)
values (
  'github_oidc_witness_v1',
  false,
  'Fail-closed control for zero-cost GitHub OIDC witness clock. Enable only under explicit Machine-SOT policy.'
)
on conflict (key) do update
set
  enabled = false,
  updated_at = now(),
  note = excluded.note;

commit;
