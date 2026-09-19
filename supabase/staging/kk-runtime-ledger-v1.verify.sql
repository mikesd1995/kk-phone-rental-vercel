-- KK Phone Rental runtime ledger V1 provisioning acceptance.
-- READ-ONLY VERIFICATION: raises on any contract violation; performs no persistent mutation.
-- Run only after kk-runtime-ledger-v1.sql has been applied to the intended dedicated KK project.

do $$
declare
  v_table_name text;
  v_col_name text;
  v_seq_name text;
begin
  foreach v_table_name in array array[
    'kk_runtime_expectations',
    'kk_runtime_observations',
    'kk_task_state_events',
    'kk_control_plane_incidents'
  ]
  loop
    if to_regclass('public.' || v_table_name) is null then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: missing table public.%', v_table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table_name
        and c.relrowsecurity = true
    ) then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: RLS disabled on public.%', v_table_name;
    end if;

    if has_table_privilege('anon', 'public.' || v_table_name, 'SELECT')
       or has_table_privilege('anon', 'public.' || v_table_name, 'INSERT')
       or has_table_privilege('anon', 'public.' || v_table_name, 'UPDATE')
       or has_table_privilege('anon', 'public.' || v_table_name, 'DELETE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: anon privilege leak on public.%', v_table_name;
    end if;

    if has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || v_table_name, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || v_table_name, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || v_table_name, 'DELETE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: authenticated privilege leak on public.%', v_table_name;
    end if;

    if has_table_privilege('service_role', 'public.' || v_table_name, 'DELETE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: service_role DELETE must remain denied on public.%', v_table_name;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.kk_runtime_expectations', 'SELECT')
     or not has_table_privilege('service_role', 'public.kk_runtime_expectations', 'INSERT') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: expectations SELECT/INSERT grant missing';
  end if;

  if has_table_privilege('service_role', 'public.kk_runtime_expectations', 'UPDATE') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: expectations table-wide UPDATE must remain denied';
  end if;

  if not has_column_privilege('service_role', 'public.kk_runtime_expectations', 'status', 'UPDATE') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: expectations status UPDATE grant missing';
  end if;

  for v_col_name in
    select cols.column_name
    from information_schema.columns as cols
    where cols.table_schema='public'
      and cols.table_name='kk_runtime_expectations'
      and cols.column_name <> 'status'
  loop
    if has_column_privilege('service_role', 'public.kk_runtime_expectations', v_col_name, 'UPDATE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: unexpected expectations UPDATE grant on column %', v_col_name;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.kk_runtime_observations', 'SELECT')
     or not has_table_privilege('service_role', 'public.kk_runtime_observations', 'INSERT')
     or has_table_privilege('service_role', 'public.kk_runtime_observations', 'UPDATE') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: observations grants are not exact';
  end if;

  if not has_table_privilege('service_role', 'public.kk_task_state_events', 'SELECT')
     or not has_table_privilege('service_role', 'public.kk_task_state_events', 'INSERT')
     or has_table_privilege('service_role', 'public.kk_task_state_events', 'UPDATE') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: task-state grants are not exact';
  end if;

  if not has_table_privilege('service_role', 'public.kk_control_plane_incidents', 'SELECT')
     or not has_table_privilege('service_role', 'public.kk_control_plane_incidents', 'INSERT') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: incident SELECT/INSERT grant missing';
  end if;

  if has_table_privilege('service_role', 'public.kk_control_plane_incidents', 'UPDATE') then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: incidents table-wide UPDATE must remain denied';
  end if;

  foreach v_col_name in array array[
    'classification',
    'severity',
    'occurrence_id',
    'run_id',
    'root_cause_state',
    'evidence'
  ]
  loop
    if not has_column_privilege(
      'service_role',
      'public.kk_control_plane_incidents',
      v_col_name,
      'UPDATE'
    ) then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: incident UPDATE grant missing on column %', v_col_name;
    end if;
  end loop;

  for v_col_name in
    select cols.column_name
    from information_schema.columns as cols
    where cols.table_schema='public'
      and cols.table_name='kk_control_plane_incidents'
      and cols.column_name not in (
        'classification',
        'severity',
        'occurrence_id',
        'run_id',
        'root_cause_state',
        'evidence'
      )
  loop
    if has_column_privilege(
      'service_role',
      'public.kk_control_plane_incidents',
      v_col_name,
      'UPDATE'
    ) then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: unexpected incident UPDATE grant on column %', v_col_name;
    end if;
  end loop;

  foreach v_seq_name in array array[
    'kk_runtime_observations_id_seq',
    'kk_task_state_events_id_seq',
    'kk_control_plane_incidents_id_seq'
  ]
  loop
    if to_regclass('public.' || v_seq_name) is null then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: missing sequence public.%', v_seq_name;
    end if;

    if not has_sequence_privilege('service_role', 'public.' || v_seq_name, 'USAGE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: service_role sequence USAGE missing on public.%', v_seq_name;
    end if;

    if has_sequence_privilege('service_role', 'public.' || v_seq_name, 'SELECT')
       or has_sequence_privilege('service_role', 'public.' || v_seq_name, 'UPDATE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: service_role sequence privilege broader than USAGE on public.%', v_seq_name;
    end if;

    if has_sequence_privilege('anon', 'public.' || v_seq_name, 'USAGE')
       or has_sequence_privilege('authenticated', 'public.' || v_seq_name, 'USAGE') then
      raise exception 'KK_RUNTIME_LEDGER_VERIFY: public sequence privilege leak on public.%', v_seq_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint pc
    where pc.conrelid='public.kk_runtime_expectations'::regclass
      and pc.contype='u'
      and pg_get_constraintdef(pc.oid) like 'UNIQUE (nonce)%'
  ) then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: nonce uniqueness constraint missing';
  end if;

  if not exists (
    select 1
    from pg_constraint pc
    where pc.conrelid='public.kk_runtime_expectations'::regclass
      and pc.contype='c'
      and pg_get_constraintdef(pc.oid) like '%mode = ''WITNESS_ONLY''%'
  ) then
    raise exception 'KK_RUNTIME_LEDGER_VERIFY: WITNESS_ONLY mode constraint missing';
  end if;

  raise notice 'KK_RUNTIME_LEDGER_VERIFY: PASS';
end
$$;
