import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql'
)

describe('migration melhorias ficha e edicao atendimento presencial', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('preserva a assinatura e o retorno da rpc de conclusao validada', () => {
    expect(sql).toContain('create or replace function public.atendimento_presencial_concluir(')
    expect(sql).not.toMatch(/drop\s+(function|routine)\s+.*atendimento_presencial_concluir/i)
    expect(sql).toContain('returns table(id uuid, version integer)')
    expect(sql).not.toContain('concluido_em timestamptz')
    expect(sql).not.toContain('resultado_atendimento text')
    expect(sql).toContain('return query select v_updated_id, v_updated_version')
    expect(sql).toContain('for update')
    expect(sql).toContain("raise exception 'version_conflict'")
    expect(sql).toContain("raise exception 'rascunho_expirado'")
  })

  it('aceita o payload real e descarta chaves tecnicas no normalizado', () => {
    expect(sql).toContain("'etapaAtual'")
    expect(sql).toContain("'notaTecnica'")
    expect(sql).toContain("not p_permitir_cliente_id and jsonb_typeof(p_dados->'etapaAtual') is distinct from 'string'")
    expect(sql).toContain("p_permitir_cliente_id")
    expect(sql).toContain("p_dados ? 'etapaAtual'")
    expect(sql).toContain("jsonb_typeof(p_dados->'etapaAtual') <> 'string'")
    expect(sql).toContain("jsonb_typeof(p_dados->'notaTecnica') <> 'string'")
    expect(sql).toContain("(chave.valor = 'clienteId' and not p_permitir_cliente_id)")
    expect(sql).toContain("raise exception 'dados_rascunho_chave_invalida'")
    expect(sql.match(/raise exception 'etapa_invalida'/g)).toHaveLength(2)
    expect(sql).toContain("raise exception 'nota_tecnica_invalida'")

    const retornoNormalizado = sql.slice(
      sql.indexOf('return jsonb_build_object('),
      sql.indexOf('exception', sql.indexOf('return jsonb_build_object('))
    )
    expect(retornoNormalizado).not.toContain('etapaAtual')
    expect(retornoNormalizado).not.toContain('notaTecnica')
  })

  it('exige dia e mes juntos na constraint da virada de cartao', () => {
    expect(sql).toContain('(virada_cartao_dia is null and virada_cartao_mes is null)')
    expect(sql).toContain('virada_cartao_dia is not null')
    expect(sql).toContain('virada_cartao_mes is not null')
    expect(sql).toContain('virada_cartao_mes between 1 and 12')
    expect(sql).toContain('virada_cartao_dia between 1 and 31')
    expect(sql).toContain('virada_cartao_mes = 2 and virada_cartao_dia <= 29')
  })

  it('valida virada de cartao no payload antes de converter', () => {
    expect(sql).toContain("'virada_cartao'")
    expect(sql).toContain("raise exception 'virada_cartao_obrigatoria'")
    expect(sql).toContain("raise exception 'virada_cartao_indevida'")
    expect(sql).toContain("jsonb_typeof(p_dados->'viradaCartaoDia') <> 'number'")
    expect(sql).toContain("not ((p_dados->>'viradaCartaoDia') ~ '^[0-9]+$')")
    expect(sql).toContain("v_virada_dia := (p_dados->>'viradaCartaoDia')::smallint")
    expect(sql).toContain('virada_cartao_dia = nullif(v_payload->>\'viradaCartaoDia\', \'\')::smallint')
  })

  it('exige perfis ativos e usa exists para multiplos perfis', () => {
    expect(sql).toContain('exists (')
    expect(sql.match(/apa\.ativo = true/g)?.length ?? 0).toBeGreaterThanOrEqual(8)
    expect(sql).toContain("apa.chave = 'consultora'")
    expect(sql).toContain("apa.chave = 'supervisora_loja'")
    expect(sql).toContain("apa.chave = 'gestao'")
    expect(sql).toContain("when v_tem_perfil_supervisora then 'supervisora_loja'")
    expect(sql).toContain("when v_tem_perfil_consultora then 'consultora'")
    expect(sql).toContain("when v_tem_perfil_gestao then 'gestao'")
  })

  it('autoriza conclusao por perfil mais amplo antes de consultora', () => {
    const conclusao = sql.slice(
      sql.indexOf('create or replace function public.atendimento_presencial_concluir('),
      sql.indexOf('revoke all on function public.atendimento_presencial_concluir')
    )
    const blocoPermissao = conclusao.slice(
      conclusao.indexOf("if v_executor_role = 'superadmin' then"),
      conclusao.indexOf('if v_row.cliente_id is null')
    )

    expect(blocoPermissao).toContain("if v_executor_role = 'superadmin' then")
    expect(blocoPermissao).toContain('elsif v_tem_perfil_supervisora then')
    expect(blocoPermissao).toContain('elsif v_tem_perfil_gestao then')
    expect(blocoPermissao).toContain('elsif v_tem_perfil_consultora then')
    expect(blocoPermissao.indexOf('elsif v_tem_perfil_supervisora then')).toBeLessThan(
      blocoPermissao.indexOf('elsif v_tem_perfil_consultora then')
    )
    expect(blocoPermissao.indexOf('elsif v_tem_perfil_gestao then')).toBeLessThan(
      blocoPermissao.indexOf('elsif v_tem_perfil_consultora then')
    )
    expect(blocoPermissao).not.toContain('elsif v_tem_perfil_supervisora or v_tem_perfil_gestao')
  })

  it('preserva departamentos obrigatorios de 1 a 6 e sem duplicidade', () => {
    expect(sql).toContain("jsonb_typeof(p_dados->'departamentos') is distinct from 'array'")
    expect(sql).toContain("jsonb_array_length(p_dados->'departamentos') = 0 or jsonb_array_length(p_dados->'departamentos') > 6")
    expect(sql).toContain("raise exception 'departamento_obrigatorio'")
    expect(sql).toContain("raise exception 'departamento_duplicado'")
    expect(sql).not.toContain("coalesce(p_dados->'departamentos', '[]'::jsonb)")
  })

  it('preserva regra atual de motivos e adiciona somente virada_cartao ao catalogo', () => {
    expect(sql).toContain("jsonb_array_length(p_dados->'motivosResultado') = 0 or jsonb_array_length(p_dados->'motivosResultado') > 24")
    expect(sql).toContain("raise exception 'motivo_obrigatorio'")
    expect(sql).toContain("'virada_cartao'")
    expect(sql).toContain("raise exception 'motivo_duplicado'")
    expect(sql).not.toContain("jsonb_array_length(p_dados->'motivosResultado') > 25")
    expect(sql).not.toContain("motivos_resultado_incompativeis")
  })

  it('preserva regras de criancas e adiciona nomeNaoInformado sem casts inseguros', () => {
    expect(sql).toContain("jsonb_array_length(p_dados->'criancas') > 8")
    expect(sql).not.toContain("jsonb_array_length(p_dados->'criancas') < 1")
    expect(sql).toContain("jsonb_typeof(v_crianca->'id') is distinct from 'string'")
    expect(sql).toContain("char_length(btrim(v_crianca->>'id')) not between 4 and 80")
    expect(sql).toContain("'nomeNaoInformado'")
    expect(sql).toContain("jsonb_typeof(v_crianca->'nomeNaoInformado') <> 'boolean'")
    expect(sql).toContain("coalesce((v_crianca->>'nomeNaoInformado')::boolean, false)")
    expect(sql).toContain("raise exception 'crianca_nome_nao_informado_invalido'")
    expect(sql).toContain("v_crianca ? 'idadeUnidade' or v_crianca ? 'idadeValor'")
    expect(sql).toContain("v_crianca ? 'dataPrevistaNascimento'")
    expect(sql).toContain("v_crianca->>'dataPrevistaNascimento' !~ '^\\d{4}-\\d{2}-\\d{2}$'")
    expect(sql).toContain("to_char(v_data_prevista, 'YYYY-MM-DD') <> v_data_text")
    expect(sql).toContain("v_crianca ? 'dataPrevistaNascimento'")
    expect(sql).toContain("v_crianca ? 'idadeValor'")
  })

  it('preserva produtos com limite, trim e duplicidade case-insensitive', () => {
    expect(sql).toContain("jsonb_array_length(p_dados->'produtosInteresse') > 20")
    expect(sql).toContain("jsonb_typeof(item.value) <> 'string'")
    expect(sql).toContain("char_length(btrim(item.value #>> '{}')) not between 1 and 80")
    expect(sql).toContain("count(distinct lower(btrim(item.value #>> '{}')))")
    expect(sql).toContain("raise exception 'produto_duplicado'")
  })

  it('corrige edicao com unidade, consultora responsavel e permissoes efetivas', () => {
    expect(sql).toContain('create or replace function public.atendimento_presencial_editar_concluido(')
    expect(sql).toContain('returns table(id uuid, version integer)')
    expect(sql).toContain("raise exception 'unidade_inativa'")
    expect(sql).toContain("raise exception 'consultora_inativa'")
    expect(sql).toContain("raise exception 'consultora_perfil_invalido'")
    expect(sql).toContain("raise exception 'consultora_unidade_invalida'")
    expect(sql).toContain("v_executor_role = 'superadmin'")
    expect(sql).toContain('v_tem_perfil_supervisora and v_executor_unidade')
    expect(sql).toContain("v_row.concluido_em >= now() - interval '3 days'")
    expect(sql).not.toContain('v_tem_perfil_gestao and not')
  })

  it('compara estado funcional antes de apagar e bloqueia edicao vazia', () => {
    expect(sql).toContain("'ordem', c.ordem")
    expect(sql).toContain("'local_id', c.local_id")
    expect(sql).toContain("'nome_nao_informado', c.nome_nao_informado")
    expect(sql).not.toContain("to_jsonb(c) - 'created_at'")
    expect(sql).toContain('if array_length(v_campos_alterados, 1) is null then')
    expect(sql).toContain("raise exception 'nenhuma_alteracao'")

    const beforeNoChange = sql.indexOf("raise exception 'nenhuma_alteracao'")
    const firstDeleteAfterEdit = sql.indexOf('delete from public.atendimento_presencial_criancas where atendimento_id = p_atendimento_id', sql.indexOf('create or replace function public.atendimento_presencial_editar_concluido('))
    expect(beforeNoChange).toBeGreaterThan(0)
    expect(firstDeleteAfterEdit).toBeGreaterThan(beforeNoChange)
  })

  it('mantem historico tecnico e grants restritos', () => {
    expect(sql).toContain("'editado_concluido'")
    expect(sql).toContain("'camposAlterados'")
    expect(sql).toContain("'numeroLancamentoAlterado'")
    expect(sql).toContain("'viradaCartaoAlterada'")
    expect(sql).not.toContain("'observacoesAnterior'")
    expect(sql).not.toContain("'produtosInteresseAnterior'")
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = pg_catalog, public, pg_temp')
    expect(sql).toContain('revoke all on function public.atendimento_presencial_normalizar_payload_ficha(jsonb, boolean)')
    expect(sql).toContain('revoke all on function public.atendimento_presencial_concluir(uuid, integer, uuid, integer)')
    expect(sql).toContain('revoke all on function public.atendimento_presencial_editar_concluido(uuid, integer, uuid, jsonb, integer)')
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })
})
