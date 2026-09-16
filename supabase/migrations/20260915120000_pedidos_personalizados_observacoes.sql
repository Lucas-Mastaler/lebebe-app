create table public.pedidos_personalizados_observacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_personalizados_pedidos(id) on delete restrict,
  usuario_id uuid not null references public.usuarios_permitidos(id) on delete restrict,
  texto text not null,
  created_at timestamptz not null default now(),
  constraint pedidos_personalizados_observacoes_texto_check check (
    char_length(btrim(texto)) between 1 and 2000
  )
);

create index idx_pedidos_personalizados_observacoes_pedido_created_at
  on public.pedidos_personalizados_observacoes (pedido_id, created_at desc, id desc);

alter table public.pedidos_personalizados_observacoes enable row level security;
revoke all on table public.pedidos_personalizados_observacoes from public, anon, authenticated;
grant select, insert on table public.pedidos_personalizados_observacoes to service_role;
