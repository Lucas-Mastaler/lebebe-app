create table if not exists public.search_execution_audit (
  id bigserial primary key,
  client_token text null,
  origin text not null default 'MODAL',
  user_email text null,
  cep text null,
  endereco_pesquisado text null,
  endereco_curto text null,
  tempo_necessario text null,
  is_rural boolean not null default false,
  is_condominio boolean not null default false,
  total_duration_ms integer not null,
  search_time_seconds numeric(10,1) null,
  total_candidates integer not null default 0,
  total_candidates_normal integer not null default 0,
  total_candidates_especial integer not null default 0,
  total_candidates_premium integer not null default 0,
  total_candidates_hora_marcada integer not null default 0,
  total_slots_processed integer not null default 0,
  total_slots_available integer not null default 0,
  early_stop boolean not null default false,
  status text not null default 'success',
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_execution_audit_created_at
  on public.search_execution_audit (created_at desc);

create index if not exists idx_search_execution_audit_status_created_at
  on public.search_execution_audit (status, created_at desc);

create index if not exists idx_search_execution_audit_origin_created_at
  on public.search_execution_audit (origin, created_at desc);

create index if not exists idx_search_execution_audit_duration
  on public.search_execution_audit (total_duration_ms desc);

create or replace view public.vw_search_performance_30_dias as
select
  count(*) as total_searches,
  round(avg(total_duration_ms), 2) as avg_total_duration_ms,
  round(avg(total_duration_ms) / 1000.0, 2) as avg_total_duration_sec,
  round(percentile_cont(0.5) within group (order by total_duration_ms), 2) as median_total_duration_ms,
  round(percentile_cont(0.95) within group (order by total_duration_ms), 2) as p95_total_duration_ms,
  round(percentile_cont(0.99) within group (order by total_duration_ms), 2) as p99_total_duration_ms,
  min(total_duration_ms) as min_total_duration_ms,
  max(total_duration_ms) as max_total_duration_ms,
  round(avg(total_candidates), 2) as avg_total_candidates,
  round(avg(total_slots_processed), 2) as avg_slots_processed,
  round(avg(case when total_slots_available > 0 then (total_slots_processed::numeric / total_slots_available::numeric) * 100 else null end), 2) as avg_slots_processed_pct,
  round(100.0 * avg(case when early_stop then 1 else 0 end), 2) as early_stop_rate_pct,
  round(100.0 * avg(case when status = 'success' then 1 else 0 end), 2) as success_rate_pct
from public.search_execution_audit
where created_at >= now() - interval '30 days';

create or replace view public.vw_search_performance_diaria as
select
  date(created_at) as data,
  count(*) as total_searches,
  round(avg(total_duration_ms), 2) as avg_total_duration_ms,
  round(avg(total_duration_ms) / 1000.0, 2) as avg_total_duration_sec,
  round(percentile_cont(0.5) within group (order by total_duration_ms), 2) as median_total_duration_ms,
  round(percentile_cont(0.95) within group (order by total_duration_ms), 2) as p95_total_duration_ms,
  min(total_duration_ms) as min_total_duration_ms,
  max(total_duration_ms) as max_total_duration_ms,
  round(avg(total_candidates), 2) as avg_total_candidates,
  round(avg(total_slots_processed), 2) as avg_slots_processed,
  round(100.0 * avg(case when early_stop then 1 else 0 end), 2) as early_stop_rate_pct,
  round(100.0 * avg(case when status = 'success' then 1 else 0 end), 2) as success_rate_pct
from public.search_execution_audit
where created_at >= now() - interval '90 days'
group by date(created_at)
order by data desc;

create or replace view public.vw_search_performance_origem as
select
  origin,
  status,
  count(*) as total_searches,
  round(avg(total_duration_ms), 2) as avg_total_duration_ms,
  round(avg(total_duration_ms) / 1000.0, 2) as avg_total_duration_sec,
  round(percentile_cont(0.5) within group (order by total_duration_ms), 2) as median_total_duration_ms,
  round(percentile_cont(0.95) within group (order by total_duration_ms), 2) as p95_total_duration_ms,
  round(avg(total_candidates), 2) as avg_total_candidates,
  round(avg(total_slots_processed), 2) as avg_slots_processed,
  round(100.0 * avg(case when early_stop then 1 else 0 end), 2) as early_stop_rate_pct
from public.search_execution_audit
where created_at >= now() - interval '30 days'
group by origin, status
order by origin, status;

create or replace view public.vw_search_execucoes_lentas as
select
  id,
  created_at,
  origin,
  status,
  cep,
  endereco_pesquisado,
  endereco_curto,
  total_duration_ms,
  round(total_duration_ms / 1000.0, 2) as total_duration_sec,
  total_candidates,
  total_candidates_normal,
  total_candidates_especial,
  total_candidates_premium,
  total_candidates_hora_marcada,
  total_slots_processed,
  total_slots_available,
  early_stop,
  error_message
from public.search_execution_audit
where total_duration_ms is not null
order by total_duration_ms desc, created_at desc;

create or replace view public.vw_search_capacidade_resultado as
select
  date(created_at) as data,
  round(avg(total_duration_ms), 2) as avg_total_duration_ms,
  round(avg(total_duration_ms) / 1000.0, 2) as avg_total_duration_sec,
  round(avg(total_candidates), 2) as avg_total_candidates,
  round(avg(total_candidates_normal), 2) as avg_candidates_normal,
  round(avg(total_candidates_especial), 2) as avg_candidates_especial,
  round(avg(total_candidates_premium), 2) as avg_candidates_premium,
  round(avg(total_candidates_hora_marcada), 2) as avg_candidates_hora_marcada,
  round(avg(total_slots_processed), 2) as avg_slots_processed,
  round(avg(case when total_slots_available > 0 then (total_slots_processed::numeric / total_slots_available::numeric) * 100 else null end), 2) as avg_slots_processed_pct
from public.search_execution_audit
where created_at >= now() - interval '90 days'
  and status = 'success'
group by date(created_at)
order by data desc;
