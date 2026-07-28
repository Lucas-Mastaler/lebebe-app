import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260724200159_hub_vendas_fase1_base.sql'
)

describe('migration hub vendas fase 1', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const fase2Sql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260728120000_hub_vendas_fase2_conversao_rpc.sql'),
    'utf8'
  )

  function trechoEntre(inicio: string, fim: string) {
    const inicioIndex = sql.indexOf(inicio)
    const fimIndex = sql.indexOf(fim, inicioIndex + inicio.length)

    expect(inicioIndex).toBeGreaterThanOrEqual(0)
    expect(fimIndex).toBeGreaterThan(inicioIndex)

    return sql.slice(inicioIndex, fimIndex)
  }

  it('cria somente a base estrutural de banco da fase 1', () => {
    expect(sql).toContain('CREATE TABLE public.hub_vendas_leads')
    expect(sql).toContain('CREATE TABLE public.hub_vendas_recuperacao_fila')
    expect(sql).toContain('CREATE TABLE public.hub_vendas_config')
    expect(sql).toContain('CREATE TABLE public.hub_vendas_eventos_processados')
    expect(sql).not.toContain('/api/digisac/webhook/hub-vendas')
    expect(sql).not.toContain('/api/cron/hub-vendas')
    expect(sql).not.toContain('vercel.json')
  })

  it('modela leads por telefone ddi e ciclo sem estados tecnicos', () => {
    const leadsSql = trechoEntre(
      'CREATE TABLE public.hub_vendas_leads',
      'CREATE INDEX idx_hub_vendas_leads_status_entrada'
    )

    expect(leadsSql).toContain('telefone_normalizado_ddi text NOT NULL')
    expect(leadsSql).toContain('CONSTRAINT hub_vendas_leads_telefone_ciclo_unique')
    expect(leadsSql).toContain('UNIQUE (telefone_normalizado_ddi, ciclo_numero)')
    expect(leadsSql).toContain("'aguardando_conversao'")
    expect(leadsSql).toContain("'cliente_em_atendimento'")
    expect(leadsSql).not.toContain("'processando'")
    expect(leadsSql).not.toContain("'resultado_incerto'")
  })

  it('mantem uma fila por lead e indices para processamento e limite diario', () => {
    expect(sql).toContain('CONSTRAINT hub_vendas_fila_lead_unique UNIQUE (lead_id)')
    expect(sql).toContain('idx_hub_vendas_fila_status_programado')
    expect(sql).toContain('idx_hub_vendas_fila_conexao_enviado')
    expect(sql).toContain('idx_hub_vendas_fila_contact')
    expect(sql).toContain('idx_hub_vendas_fila_ticket')
    expect(sql).toContain("'resultado_incerto'")
    expect(sql).toContain('quantidade_reconciliacoes integer NOT NULL DEFAULT 0')
  })

  it('reserva eventos por message id antes dos efeitos de negocio', () => {
    expect(sql).toContain('CREATE TABLE public.hub_vendas_eventos_processados')
    expect(sql).toContain('digisac_message_id text NOT NULL')
    expect(sql).toContain('CONSTRAINT hub_vendas_eventos_message_unique UNIQUE (digisac_message_id)')
    expect(sql).toContain("status text NOT NULL DEFAULT 'processando'")
    expect(sql).toContain("'processado'")
    expect(sql).toContain("'ignorado'")
    expect(sql).toContain("'erro'")
    expect(sql).toContain('tentativas integer NOT NULL DEFAULT 0')
    expect(sql).toContain('CHECK (tentativas >= 0)')
  })

  it('mantem conversao de Fase 2 em RPC atomica separada', () => {
    expect(fase2Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_conversao')
    expect(fase2Sql).toContain('FOR UPDATE')
    expect(fase2Sql).toContain("p_timestamp_evento >= v_lead.data_entrada_hub + interval '24 hours'")
    expect(fase2Sql).toContain('array_append(v_lead.lojas_chamadas, p_loja)')
    expect(fase2Sql).toContain('REVOKE ALL ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)')
    expect(fase2Sql).toContain('GRANT EXECUTE ON FUNCTION public.hub_vendas_registrar_conversao(uuid, text, timestamptz)')
    expect(fase2Sql).not.toContain('/api/digisac/webhook/hub-vendas')
    expect(fase2Sql).not.toContain('/api/cron/hub-vendas')
  })

  it('ativa rls sem policies para authenticated e restringe acesso operacional', () => {
    expect(sql).toContain('ALTER TABLE public.hub_vendas_leads ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.hub_vendas_recuperacao_fila ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.hub_vendas_config ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.hub_vendas_eventos_processados ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.hub_vendas_leads FROM anon, authenticated')
    expect(sql).toContain('GRANT ALL ON public.hub_vendas_leads TO service_role')
    expect(sql).not.toContain('FOR SELECT TO authenticated')
    expect(sql).not.toContain('USING (true)')
    expect(sql).not.toContain('USING (false)')
  })

  it('cria rodizio atomico com advisory lock e execute restrito', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.selecionar_proxima_conexao_hub_vendas(')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public')
    expect(sql).toContain('pg_advisory_xact_lock(v_lock_key_1, v_lock_key_2)')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.selecionar_proxima_conexao_hub_vendas(text[])')
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.selecionar_proxima_conexao_hub_vendas(text[])')
    expect(sql).toContain('TO service_role')
  })

  it('cadastra configuracoes iniciais com automacao inativa e mensagens inativas', () => {
    expect(sql).toContain("'automacao'")
    expect(sql).toContain("'parametros'")
    expect(sql).toContain('"timezone": "America/Sao_Paulo"')
    expect(sql).toContain('"limite_diario": 15')
    expect(sql).toContain('"intervalo_min_seg": 180')
    expect(sql).toContain('"intervalo_max_seg": 300')
    expect(sql).toContain('"dias_semana": [1, 2, 3, 4, 5, 6]')
    expect(sql).toContain('"ativa": false')
    expect(sql).toContain('"id": "direta"')
    expect(sql).toContain('"id": "acolhedora"')
    expect(sql).toContain('"id": "consultiva"')
    expect(sql).toContain('"id": "objetiva"')
    expect(sql).toContain('"id": "leve"')
    expect(sql).toContain('"ativa": false')
  })

  it('cadastra modulo e conexao vendas sem conceder permissoes de perfil', () => {
    expect(sql).toContain("'hub_vendas_recuperacao'")
    expect(sql).toContain("'/hub-vendas/recuperacao'")
    expect(sql).toContain("'4af28025-c210-4336-a560-785d2fb8a778'")
    expect(sql).toContain("'VENDAS (Hub)'")
    expect(sql).not.toContain('app_permissoes_perfil')
    expect(sql).not.toContain('default_department_id =')
  })
})
