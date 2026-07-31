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
  const fase3Sql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260728180000_hub_vendas_fase3_preparacao.sql'),
    'utf8'
  )
  const hotfixConversaoSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260729183000_hub_vendas_corrige_ambiguidade_conversao.sql'),
    'utf8'
  )
  const fase4Sql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260729210000_hub_vendas_fase4_processamento.sql'),
    'utf8'
  )
  const fase4RetryFixSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260729213000_hub_vendas_fase4_retry_counter_fix.sql'),
    'utf8'
  )
  const fase4ConexaoDestinoFixSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260729220000_hub_vendas_corrige_conexao_destino_erro_fila.sql'),
    'utf8'
  )
  const mensagemNomeSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260730120000_hub_vendas_adiciona_nome_mensagem_recuperacao.sql'),
    'utf8'
  )
  const recuperacaoCronsSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260731120000_hub_vendas_recuperacao_crons_status.sql'),
    'utf8'
  )
  const recuperacaoLimiteTotalSql = readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260731162000_hub_vendas_recuperacao_limite_total.sql'),
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

  it('mantem preparacao de Fase 3 idempotente e sem envio', () => {
    expect(fase3Sql).toContain('idx_hub_vendas_fila_conexao_programado_capacidade')
    expect(fase3Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_preparar_fila_recuperacao')
    expect(fase3Sql).toContain('public.selecionar_proxima_conexao_hub_vendas(v_conexoes_restantes)')
    expect(fase3Sql).toContain("WHERE fila.lead_id = v_lead.id")
    expect(fase3Sql).toContain("status = 'encaminhado_recuperacao'")
    expect(fase3Sql).toContain("status IN ('agendado', 'reservado', 'enviando', 'enviado', 'resultado_incerto')")
    expect(fase3Sql).toContain("v_programado AT TIME ZONE p_timezone")
    expect(fase3Sql).toContain('REVOKE ALL ON FUNCTION public.hub_vendas_preparar_fila_recuperacao')
    expect(fase3Sql).toContain('TO service_role')
    expect(fase3Sql).not.toContain('fetch(')
    expect(fase3Sql).not.toContain('POST /messages')
    expect(fase3Sql).not.toContain('/api/v1/messages')
  })

  it('corrige ambiguidade da RPC de conversao sem alterar escopo operacional', () => {
    expect(hotfixConversaoSql).toContain('DROP FUNCTION IF EXISTS public.hub_vendas_registrar_conversao(uuid, text, timestamptz)')
    expect(hotfixConversaoSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_conversao')
    expect(hotfixConversaoSql).toContain('RETURNS TABLE')
    expect(hotfixConversaoSql).toContain('resultado_semantico text')
    expect(hotfixConversaoSql).toContain('SELECT lead.*')
    expect(hotfixConversaoSql).toContain('FROM public.hub_vendas_leads AS lead')
    expect(hotfixConversaoSql).toContain('WHERE lead.id = p_lead_id')
    expect(hotfixConversaoSql).toContain('UPDATE public.hub_vendas_leads AS lead')
    expect(hotfixConversaoSql).toContain('WHERE lead.id = v_lead.id')
    expect(hotfixConversaoSql).toContain('UPDATE public.hub_vendas_recuperacao_fila AS fila')
    expect(hotfixConversaoSql).toContain('quantidade_reconciliacoes = fila.quantidade_reconciliacoes + 1')
    expect(hotfixConversaoSql).toContain('WHERE fila.lead_id = v_lead.id')
    expect(hotfixConversaoSql).toContain("AND fila.status IN ('agendado', 'reservado', 'enviando', 'resultado_incerto')")
    expect(hotfixConversaoSql).toContain('SECURITY DEFINER')
    expect(hotfixConversaoSql).toContain('SET search_path = pg_catalog, public')
    expect(hotfixConversaoSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(hotfixConversaoSql).toContain('TO service_role')
    expect(hotfixConversaoSql).not.toContain('WHERE lead_id = v_lead.id')
    expect(hotfixConversaoSql).not.toContain("AND status IN ('agendado', 'reservado', 'enviando', 'resultado_incerto')")
    expect(hotfixConversaoSql).not.toContain('#variable_conflict')
    expect(hotfixConversaoSql).not.toContain('/api/v1/messages')
    expect(hotfixConversaoSql).not.toContain('hub_vendas_config')
  })

  it('cria transicoes atomicas da Fase 4 sem endpoint externo na migration', () => {
    expect(fase4Sql).toContain('ADD COLUMN IF NOT EXISTS tentativas_envio')
    expect(fase4Sql).toContain('idx_hub_vendas_fila_reserva_vencida')
    expect(fase4Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_reservar_filas_recuperacao')
    expect(fase4Sql).toContain('FOR UPDATE SKIP LOCKED')
    expect(fase4Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_marcar_fila_enviando')
    expect(fase4Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_confirmar_fila_enviada')
    expect(fase4Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_resultado_incerto')
    expect(fase4Sql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_erro_fila')
    expect(fase4Sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(fase4Sql).toContain('TO service_role')
    expect(fase4Sql).not.toContain('/messages')
    expect(fase4Sql).not.toContain('/contacts')
    expect(fase4Sql).not.toContain('DIGISAC_TOKEN')
  })

  it('mantem retry da Fase 4 contabilizado antes e depois do envio', () => {
    expect(fase4RetryFixSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_erro_fila')
    expect(fase4RetryFixSql).toContain('v_tentativas_final integer')
    expect(fase4RetryFixSql).toContain("WHEN v_fila.status = 'reservado' THEN v_fila.tentativas_envio + 1")
    expect(fase4RetryFixSql).toContain('WHEN p_retentavel IS TRUE AND v_tentativas_final <= 3')
    expect(fase4RetryFixSql).toContain("tentativas_envio = CASE WHEN fila.status = 'reservado' THEN fila.tentativas_envio + 1 ELSE fila.tentativas_envio END")
    expect(fase4RetryFixSql).toContain('v_fila.conexao_destino_id')
    expect(fase4RetryFixSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(fase4RetryFixSql).toContain('TO service_role')
    expect(fase4RetryFixSql).not.toContain('v_fila.conexao_destino,')
    expect(fase4RetryFixSql).not.toContain('ARRAY[v_fila.conexao_destino,')
    expect(fase4RetryFixSql).not.toContain('/messages')
    expect(fase4RetryFixSql).not.toContain('/contacts')
    expect(fase4RetryFixSql).not.toContain('DIGISAC_TOKEN')
  })

  it('corrige pausa automatica por conexao_destino_id e exige message id no envio', () => {
    expect(fase4ConexaoDestinoFixSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_registrar_erro_fila')
    expect(fase4ConexaoDestinoFixSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_confirmar_fila_enviada')
    expect(fase4ConexaoDestinoFixSql).toContain('v_pausas->v_fila.conexao_destino_id')
    expect(fase4ConexaoDestinoFixSql).toContain('ARRAY[v_fila.conexao_destino_id')
    expect(fase4ConexaoDestinoFixSql).toContain('IF p_digisac_message_id IS NULL OR btrim(p_digisac_message_id) = \'\' THEN')
    expect(fase4ConexaoDestinoFixSql).toContain('hub_vendas_digisac_message_id_obrigatorio')
    expect(fase4ConexaoDestinoFixSql).toContain('WHEN p_retentavel IS TRUE AND v_tentativas_final <= 3')
    expect(fase4ConexaoDestinoFixSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(fase4ConexaoDestinoFixSql).toContain('TO service_role')
    expect(fase4ConexaoDestinoFixSql).not.toContain('v_fila.conexao_destino,')
    expect(fase4ConexaoDestinoFixSql).not.toContain('ARRAY[v_fila.conexao_destino,')
    expect(fase4ConexaoDestinoFixSql).not.toContain('/messages')
    expect(fase4ConexaoDestinoFixSql).not.toContain('/contacts')
    expect(fase4ConexaoDestinoFixSql).not.toContain('DIGISAC_TOKEN')
  })

  it('atualiza somente o texto da mensagem direta com placeholder de nome', () => {
    expect(mensagemNomeSql).toContain("WHERE config.chave = 'mensagens_recuperacao'")
    expect(mensagemNomeSql).toContain("versao.item->>'id' = 'direta'")
    expect(mensagemNomeSql).toContain('Olá, [NOME]!')
    expect(mensagemNomeSql).toContain('Le Bébé [LOJA]')
    expect(mensagemNomeSql).toContain('jsonb_array_elements')
    expect(mensagemNomeSql).toContain('jsonb_agg')
    expect(mensagemNomeSql).not.toContain("chave = 'automacao'")
    expect(mensagemNomeSql).not.toContain("'ativa', true")
    expect(mensagemNomeSql).not.toContain("'pausada', false")
    expect(mensagemNomeSql).not.toContain('INSERT INTO public.hub_vendas_recuperacao_fila')
    expect(mensagemNomeSql).not.toContain('/messages')
    expect(mensagemNomeSql).not.toContain('DIGISAC_TOKEN')
  })

  it('cria manutencao segura de filas abandonadas sem reenvio automatico', () => {
    expect(recuperacaoCronsSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_recuperar_filas_abandonadas')
    expect(recuperacaoCronsSql).toContain('p_reserva_timeout_minutos integer DEFAULT 10')
    expect(recuperacaoCronsSql).toContain('p_envio_timeout_minutos integer DEFAULT 15')
    expect(recuperacaoCronsSql).toContain('FOR UPDATE SKIP LOCKED')
    expect(recuperacaoCronsSql).toContain("fila.status = 'reservado'")
    expect(recuperacaoCronsSql).toContain('fila.requisicao_iniciada_em IS NULL')
    expect(recuperacaoCronsSql).toContain('fila.digisac_message_id IS NULL')
    expect(recuperacaoCronsSql).toContain("status = 'agendado'")
    expect(recuperacaoCronsSql).toContain("status = 'resultado_incerto'")
    expect(recuperacaoCronsSql).toContain("status = 'enviado'")
    expect(recuperacaoCronsSql).toContain('digisac_message_id IS NOT NULL')
    expect(recuperacaoCronsSql).toContain('hub_vendas_status_contadores')
    expect(recuperacaoCronsSql).toContain('idx_hub_vendas_fila_reservado_abandonado')
    expect(recuperacaoCronsSql).toContain('idx_hub_vendas_fila_enviando_abandonado')
    expect(recuperacaoCronsSql).toContain('limite_por_execucao')
    expect(recuperacaoCronsSql).toContain('modo_ativacao_gradual')
    expect(recuperacaoCronsSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(recuperacaoCronsSql).toContain('TO service_role')
    expect(recuperacaoCronsSql).not.toContain('/messages')
    expect(recuperacaoCronsSql).not.toContain('/contacts')
    expect(recuperacaoCronsSql).not.toContain('DIGISAC_TOKEN')
  })

  it('mantem limite global na recuperacao de filas abandonadas', () => {
    expect(recuperacaoLimiteTotalSql).toContain('CREATE OR REPLACE FUNCTION public.hub_vendas_recuperar_filas_abandonadas')
    expect(recuperacaoLimiteTotalSql).toContain('v_restante integer')
    expect(recuperacaoLimiteTotalSql).toContain('GET DIAGNOSTICS v_processadas = ROW_COUNT')
    expect(recuperacaoLimiteTotalSql).toContain('v_restante := v_restante - v_processadas')
    expect(recuperacaoLimiteTotalSql).toContain('LIMIT v_restante')
    expect(recuperacaoLimiteTotalSql).toContain('FOR UPDATE SKIP LOCKED')
    expect(recuperacaoLimiteTotalSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(recuperacaoLimiteTotalSql).toContain('TO service_role')
    expect(recuperacaoLimiteTotalSql).not.toContain('/messages')
    expect(recuperacaoLimiteTotalSql).not.toContain('/contacts')
    expect(recuperacaoLimiteTotalSql).not.toContain('DIGISAC_TOKEN')
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
