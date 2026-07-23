import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260723120000_atendimento_presencial_clientes_origem.sql'
)

describe('migration origem inicial de clientes presenciais', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('adiciona colunas nullable de origem sem alterar colunas existentes', () => {
    expect(sql).toContain('add column if not exists origem_consultora_nome text')
    expect(sql).toContain('add column if not exists origem_consultora_usuario_id uuid references public.usuarios_permitidos(id)')
    expect(sql).toContain('add column if not exists origem_unidade_id uuid references public.app_unidades(id)')
    expect(sql).toContain('add column if not exists origem_atendimento_id uuid references public.atendimento_presencial_atendimentos(id)')
  })

  it('faz backfill pelo primeiro atendimento deterministico', () => {
    expect(sql).toContain('row_number() over (')
    expect(sql).toContain('partition by apa.cliente_id')
    expect(sql).toContain('order by apa.created_at asc, apa.id asc')
    expect(sql).toContain('and pa.ordem = 1')
  })

  it('nao sobrescreve origem ja preenchida', () => {
    expect(sql).toContain('origem_consultora_nome = coalesce(apc.origem_consultora_nome, pa.consultora_nome)')
    expect(sql).toContain('origem_unidade_id = coalesce(apc.origem_unidade_id, pa.unidade_id)')
    expect(sql).toContain('origem_atendimento_id = coalesce(apc.origem_atendimento_id, pa.atendimento_id)')
  })

  it('mantem preenchimento futuro via trigger sem depender do frontend', () => {
    expect(sql).toContain('create or replace function public.atendimento_presencial_clientes_preencher_origem()')
    expect(sql).toContain('after insert or update of cliente_id, consultora_nome, dados_rascunho')
    expect(sql).toContain('for each row')
    expect(sql).toContain('when (new.cliente_id is not null)')
  })

  it('cria indices para filtros e ordenacao da listagem', () => {
    expect(sql).toContain('idx_atendimento_presencial_clientes_origem_consultora_nome')
    expect(sql).toContain('idx_atendimento_presencial_clientes_origem_unidade')
    expect(sql).toContain('idx_atendimento_presencial_clientes_created_id')
  })
})
