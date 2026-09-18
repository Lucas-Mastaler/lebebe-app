create table public.recebimento_pausas (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos(id),
  ultima_atividade timestamptz not null,
  inicio_pausa timestamptz not null,
  fim_pausa timestamptz not null,
  duracao_pausa_segundos integer not null,
  status text not null default 'pendente',
  decisao text,
  periodo_trabalhado_inicio timestamptz,
  periodo_trabalhado_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recebimento_pausas_status_check
    check (status in ('pendente', 'revisado')),
  constraint recebimento_pausas_decisao_check
    check (decisao is null or decisao in ('trabalhando', 'pausado', 'editado')),
  constraint recebimento_pausas_status_decisao_coerente
    check (
      (status = 'pendente' and decisao is null)
      or (status = 'revisado' and decisao is not null)
    ),
  constraint recebimento_pausas_janela_valida
    check (fim_pausa > inicio_pausa and inicio_pausa >= ultima_atividade),
  constraint recebimento_pausas_duracao_positiva
    check (duracao_pausa_segundos > 0),
  constraint recebimento_pausas_editado_periodo_check
    check (
      decisao is distinct from 'editado'
      or (
        periodo_trabalhado_inicio is not null
        and periodo_trabalhado_fim is not null
        and periodo_trabalhado_fim > periodo_trabalhado_inicio
        and periodo_trabalhado_inicio >= inicio_pausa
        and periodo_trabalhado_fim <= fim_pausa
      )
    ),
  constraint recebimento_pausas_gap_unico
    unique (recebimento_id, ultima_atividade)
);

create index recebimento_pausas_recebimento_id_idx
  on public.recebimento_pausas (recebimento_id);

create index recebimento_pausas_pendentes_idx
  on public.recebimento_pausas (recebimento_id, status)
  where status = 'pendente';

alter table public.recebimento_pausas enable row level security;

create policy recebimento_pausas_select
  on public.recebimento_pausas for select
  using (is_matic_user());

create policy recebimento_pausas_insert
  on public.recebimento_pausas for insert
  with check (is_matic_user());

create policy recebimento_pausas_update
  on public.recebimento_pausas for update
  using (is_matic_user())
  with check (is_matic_user());
