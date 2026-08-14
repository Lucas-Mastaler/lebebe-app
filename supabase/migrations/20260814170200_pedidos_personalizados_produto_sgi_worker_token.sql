-- Guarda somente o hash do token do worker. O valor real permanece como
-- Docker Secret na VPS e nunca é persistido no App ou no banco.

create table public.pedidos_personalizados_lebebe_exclusive_sgi_worker (
  id text primary key,
  token_sha256 text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pp_lex_sgi_worker_id_check check (id = 'exclusive_sgi_worker'),
  constraint pp_lex_sgi_worker_hash_check check (token_sha256 ~ '^[a-f0-9]{64}$')
);

create trigger trg_pp_lex_sgi_worker_touch
  before update on public.pedidos_personalizados_lebebe_exclusive_sgi_worker
  for each row execute function public.pedidos_personalizados_touch_updated_at();

alter table public.pedidos_personalizados_lebebe_exclusive_sgi_worker enable row level security;

revoke all on table public.pedidos_personalizados_lebebe_exclusive_sgi_worker
  from public, anon, authenticated;
grant select, insert, update
  on table public.pedidos_personalizados_lebebe_exclusive_sgi_worker to service_role;
