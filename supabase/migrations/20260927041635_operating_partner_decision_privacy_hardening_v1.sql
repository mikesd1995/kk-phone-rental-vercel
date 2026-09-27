alter table public.kk_decision_events
  add constraint kk_decision_events_metrics_whitelist_check
  check (
    metrics
      - 'impressions'
      - 'engagements'
      - 'profile_visits'
      - 'link_clicks'
      - 'inquiries'
      - 'bookings'
      - 'revenue_thb'
      - 'spend_thb'
      - 'booking_velocity'
      - 'inventory_utilization'
      - 'conversion_rate'
      - 'engagement_rate'
      - 'consideration_rate'
      - 'response_rate'
      - 'resolution_minutes'
      - 'error_count'
      - 'latency_ms'
    = '{}'::jsonb
  );

alter table public.kk_decision_events
  add constraint kk_decision_events_subject_ref_no_pii_check
  check (
    subject_ref ~ '^[A-Za-z0-9_.:-]{0,160}$'
    and subject_ref !~ '^\+?[0-9]{8,15}$'
  );

revoke all on table public.kk_decision_events from anon, authenticated, service_role;
grant select, insert on table public.kk_decision_events to service_role;
