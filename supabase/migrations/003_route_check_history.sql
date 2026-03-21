-- supabase/migrations/003_route_check_history.sql
-- Persist route check results so forecast generation can use recent route behavior
-- and users can see the same history across devices.

create table if not exists public.route_check_history (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.users(id) on delete cascade,
  anonymous_id          text,
  checked_at            timestamptz not null default now(),
  origin_label          text not null,
  destination_label     text not null,
  risk_level            text not null default 'unknown',
  confirmed_flood_count integer not null default 0,
  forecast_flood_count  integer not null default 0,
  has_alternative_route boolean not null default false,
  result_json           jsonb not null,

  constraint chk_route_check_history_owner check (
    user_id is not null or anonymous_id is not null
  ),
  constraint chk_route_check_history_risk_level check (
    risk_level in ('low', 'medium', 'high', 'unknown')
  )
);

comment on table public.route_check_history is 'History of route checks used for cross-device recall and forecast context.';
comment on column public.route_check_history.result_json is 'Full route-check response payload captured at check time.';

create index if not exists idx_route_check_history_user
  on public.route_check_history (user_id, checked_at desc)
  where user_id is not null;

create index if not exists idx_route_check_history_anon
  on public.route_check_history (anonymous_id, checked_at desc)
  where anonymous_id is not null;

create index if not exists idx_route_check_history_corridor
  on public.route_check_history (origin_label, destination_label, checked_at desc);

alter table public.route_check_history enable row level security;

create policy "route_check_history_select_own"
  on public.route_check_history for select
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );

create policy "route_check_history_insert_own"
  on public.route_check_history for insert
  with check (
    auth.uid() = user_id
    or anonymous_id is not null
  );

create policy "route_check_history_update_own"
  on public.route_check_history for update
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );

create policy "route_check_history_delete_own"
  on public.route_check_history for delete
  using (
    auth.uid() = user_id
    or anonymous_id = current_setting('app.anonymous_id', true)
  );
