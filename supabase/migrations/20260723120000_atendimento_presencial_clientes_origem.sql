-- Persist initial origin for Atendimento Presencial clients.
-- Nullable columns keep legacy/directly-created clients compatible.

alter table public.atendimento_presencial_clientes
  add column if not exists origem_consultora_nome text,
  add column if not exists origem_consultora_usuario_id uuid references public.usuarios_permitidos(id) on delete restrict,
  add column if not exists origem_unidade_id uuid references public.app_unidades(id) on delete restrict,
  add column if not exists origem_atendimento_id uuid references public.atendimento_presencial_atendimentos(id) on delete set null;

alter table public.atendimento_presencial_clientes
  drop constraint if exists atendimento_presencial_clientes_origem_consultora_nome_check,
  add constraint atendimento_presencial_clientes_origem_consultora_nome_check
  check (
    origem_consultora_nome is null
    or (
      char_length(btrim(origem_consultora_nome)) between 2 and 30
      and btrim(origem_consultora_nome) ~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$'
    )
  );

with primeiros_atendimentos as (
  select
    apa.cliente_id,
    apa.id as atendimento_id,
    apa.consultora_usuario_id,
    apa.unidade_id,
    nullif(
      regexp_replace(
        btrim(coalesce(apa.consultora_nome, apa.dados_rascunho->>'consultoraNome', '')),
        '[[:space:]]+',
        ' ',
        'g'
      ),
      ''
    ) as consultora_nome,
    row_number() over (
      partition by apa.cliente_id
      order by apa.created_at asc, apa.id asc
    ) as ordem
  from public.atendimento_presencial_atendimentos apa
  where apa.cliente_id is not null
)
update public.atendimento_presencial_clientes apc
set
  origem_consultora_nome = coalesce(apc.origem_consultora_nome, pa.consultora_nome),
  origem_consultora_usuario_id = coalesce(apc.origem_consultora_usuario_id, pa.consultora_usuario_id),
  origem_unidade_id = coalesce(apc.origem_unidade_id, pa.unidade_id),
  origem_atendimento_id = coalesce(apc.origem_atendimento_id, pa.atendimento_id)
from primeiros_atendimentos pa
where pa.cliente_id = apc.id
  and pa.ordem = 1
  and (
    apc.origem_consultora_nome is null
    or apc.origem_consultora_usuario_id is null
    or apc.origem_unidade_id is null
    or apc.origem_atendimento_id is null
  );

create index if not exists idx_atendimento_presencial_clientes_origem_consultora_nome
  on public.atendimento_presencial_clientes (lower(origem_consultora_nome))
  where origem_consultora_nome is not null;

create index if not exists idx_atendimento_presencial_clientes_origem_unidade
  on public.atendimento_presencial_clientes (origem_unidade_id)
  where origem_unidade_id is not null;

create index if not exists idx_atendimento_presencial_clientes_created_id
  on public.atendimento_presencial_clientes (created_at, id);

create or replace function public.atendimento_presencial_clientes_preencher_origem()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_consultora_nome text;
begin
  if new.cliente_id is null then
    return new;
  end if;

  v_consultora_nome := nullif(
    regexp_replace(
      btrim(coalesce(new.consultora_nome, new.dados_rascunho->>'consultoraNome', '')),
      '[[:space:]]+',
      ' ',
      'g'
    ),
    ''
  );

  update public.atendimento_presencial_clientes apc
  set
    origem_consultora_nome = coalesce(apc.origem_consultora_nome, v_consultora_nome),
    origem_consultora_usuario_id = coalesce(apc.origem_consultora_usuario_id, new.consultora_usuario_id),
    origem_unidade_id = coalesce(apc.origem_unidade_id, new.unidade_id),
    origem_atendimento_id = coalesce(apc.origem_atendimento_id, new.id)
  where apc.id = new.cliente_id
    and (
      apc.origem_consultora_nome is null
      or apc.origem_consultora_usuario_id is null
      or apc.origem_unidade_id is null
      or apc.origem_atendimento_id is null
    );

  return new;
end;
$$;

drop trigger if exists trg_atendimento_presencial_clientes_preencher_origem
  on public.atendimento_presencial_atendimentos;

create trigger trg_atendimento_presencial_clientes_preencher_origem
  after insert or update of cliente_id, consultora_nome, dados_rascunho
  on public.atendimento_presencial_atendimentos
  for each row
  when (new.cliente_id is not null)
  execute function public.atendimento_presencial_clientes_preencher_origem();
