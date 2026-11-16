-- Decisões explícitas de classificação; acesso apenas pelas APIs autenticadas do módulo.
create table public.recebimento_categorias_decisoes (
  descricao_normalizada text primary key,
  categoria text not null check (categoria in ('roupeiro','comoda','berco','cama','prateleira','mesa','painel','revisar')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.recebimento_categorias_decisoes enable row level security;
revoke all on public.recebimento_categorias_decisoes from anon, authenticated;
