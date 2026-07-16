import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_MOTIVO_OUTRO_MAX_CHARS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PAYLOAD_MAX_BYTES,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  MOTIVOS_RESULTADO_GRUPOS,
  validarFichaDadosRascunho,
  type FichaDadosRascunho,
} from './ficha-schema'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260716100000_conclude_atendimento_presencial.sql'
)

describe('migration conclusao atendimento presencial', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const maiorRascunhoAtualConfirmadoMcpBytes = 300

  function texto(tamanho: number, prefixo: string) {
    return `${prefixo}${'x'.repeat(tamanho)}`.slice(0, tamanho)
  }

  function payloadMaximoFuncional(): FichaDadosRascunho {
    const motivos = MOTIVOS_RESULTADO_GRUPOS.flatMap((grupo) => grupo.motivos.map((item) => item.chave))

    return {
      cliente: {
        parentesco: 'mae',
      },
      criancas: Array.from({ length: 8 }, (_, index) => ({
        id: `crianca-local-${index.toString().padStart(2, '0')}`,
        situacao: index % 2 === 0 ? 'gestacao' : 'ja_nasceu',
        nome: texto(80, `Crianca ${index} `),
        sexo: index % 2 === 0 ? 'menina' : 'menino',
        ...(index % 2 === 0
          ? { dataPrevistaNascimento: '2027-12-20' }
          : { idadeUnidade: 'meses' as const, idadeValor: 11 }),
      })),
      departamentos: DEPARTAMENTOS_INTERESSE.map((item) => item.chave),
      produtosInteresse: Array.from({ length: FICHA_PRODUTOS_MAX_ITENS }, (_, index) =>
        texto(FICHA_PRODUTO_MAX_CHARS, `Produto ${index.toString().padStart(2, '0')} `)
      ),
      resultadoAtendimento: 'nao',
      motivosResultado: motivos,
      motivoOutro: texto(FICHA_MOTIVO_OUTRO_MAX_CHARS, 'Outro '),
      observacoes: texto(FICHA_OBSERVACOES_MAX_CHARS, 'Observacao '),
      etapaAtual: 'revisao',
    }
  }

  function tamanhoPayloadBytes(payload: unknown) {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8')
  }

  it('cria rpc sem confiar em perfil ou role enviados pela api', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.atendimento_presencial_concluir(')
    expect(sql).toContain('p_usuario_id uuid')
    expect(sql).not.toContain('p_perfil text')
    expect(sql).not.toContain('p_role text')
    expect(sql).toContain('FROM public.usuarios_permitidos up')
    expect(sql).toContain('AND up.ativo = true')
    expect(sql).toContain("v_executor_role = 'superadmin'")
    expect(sql).toContain("v_executor_perfil IN ('supervisora_loja', 'gestao')")
  })

  it('endurece security definer, grants e policies das novas tabelas', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.atendimento_presencial_concluir(uuid, integer, uuid, integer)')
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.atendimento_presencial_concluir(uuid, integer, uuid, integer)')
    expect(sql).toContain('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.%I FROM anon, authenticated')
    expect(sql).toContain('GRANT ALL ON public.%I TO service_role')
    expect(sql).toContain('FOR INSERT TO authenticated WITH CHECK (false)')
    expect(sql).toContain('FOR UPDATE TO authenticated USING (false) WITH CHECK (false)')
    expect(sql).toContain('FOR DELETE TO authenticated USING (false)')
  })

  it('revalida consultora, unidade, executor e cliente ativa no banco', () => {
    expect(sql).toContain('FROM public.app_unidades au')
    expect(sql).toContain('AND au.ativo = true')
    expect(sql).toContain('FROM public.usuarios_permitidos up')
    expect(sql).toContain('up.id = v_row.consultora_usuario_id')
    expect(sql).toContain('AND up.ativo = true')
    expect(sql).toContain("apa.chave = 'consultora'")
    expect(sql).toContain('WHERE auu.usuario_id = v_row.consultora_usuario_id')
    expect(sql).toContain('WHERE auu.usuario_id = p_usuario_id')
    expect(sql).toContain('FROM public.atendimento_presencial_clientes apc')
    expect(sql).toContain("AND apc.status = 'ativo'")
  })

  it('valida JSONB antes de expandir arrays e respeita limites do schema TypeScript', () => {
    expect(sql).toContain("jsonb_typeof(v_dados->'criancas') IS DISTINCT FROM 'array'")
    expect(sql).toContain("jsonb_typeof(v_dados->'departamentos') IS DISTINCT FROM 'array'")
    expect(sql).toContain("jsonb_typeof(v_dados->'produtosInteresse') IS DISTINCT FROM 'array'")
    expect(sql).toContain("jsonb_typeof(v_dados->'motivosResultado') IS DISTINCT FROM 'array'")
    expect(sql).toContain("jsonb_array_length(v_dados->'criancas') > 8")
    expect(sql).toContain("jsonb_array_length(v_dados->'produtosInteresse') > 20")
    expect(sql).toContain("jsonb_array_length(v_dados->'motivosResultado') = 0 OR jsonb_array_length(v_dados->'motivosResultado') > 24")
    expect(sql).toContain('char_length(observacoes) <= 2000')
    expect(sql).toContain('char_length(btrim(motivo_outro)) BETWEEN 1 AND 120')
    expect(sql).toContain('pg_column_size(dados_rascunho) <= 16384')
    expect(sql).not.toContain('pg_column_size(dados_rascunho) <= 4096')
  })

  it('mantem margem segura para o payload maximo funcional de rascunho', () => {
    const payload = payloadMaximoFuncional()
    const validacao = validarFichaDadosRascunho(payload)

    expect(validacao).toMatchObject({ ok: true })
    if (!validacao.ok) throw new Error('payload maximo funcional invalido')

    const tamanho = tamanhoPayloadBytes(validacao.dados)

    expect(tamanho).toBeLessThan(FICHA_PAYLOAD_MAX_BYTES)
    expect(FICHA_PAYLOAD_MAX_BYTES - tamanho).toBeGreaterThan(1024)
    expect(maiorRascunhoAtualConfirmadoMcpBytes).toBeLessThan(FICHA_PAYLOAD_MAX_BYTES)
  })

  it('rejeita rascunho artificial acima de 16 KB no schema funcional', () => {
    const payload = {
      ...payloadMaximoFuncional(),
      observacoes: 'x'.repeat(FICHA_PAYLOAD_MAX_BYTES + 1),
    }

    expect(tamanhoPayloadBytes(payload)).toBeGreaterThan(FICHA_PAYLOAD_MAX_BYTES)
    expect(validarFichaDadosRascunho(payload)).toMatchObject({
      ok: false,
      field: 'dadosRascunho',
    })
  })

  it('mantem atomicidade, versionamento por trigger e limpa o JSONB apenas na atualizacao final', () => {
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('v_row.version <> p_expected_version')
    expect(sql).not.toContain('version = version + 1')
    expect(sql).toContain("IF v_row.status <> 'rascunho' THEN")
    expect(sql).toContain("RAISE EXCEPTION 'atendimento_not_draft'")
    expect(sql).toContain("dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v1')")
    expect(sql).toContain('RETURNING apa.id, apa.version')
    expect(sql).toContain("'version', v_updated_version")
  })

  it('inclui constraints e indices aderentes as consultas de registros', () => {
    expect(sql).toContain('CHECK (numero_lancamento IS NULL OR numero_lancamento BETWEEN 1 AND 999999)')
    expect(sql).toContain("(resultado_atendimento = 'sim' AND numero_lancamento IS NOT NULL)")
    expect(sql).toContain("(resultado_atendimento IN ('nao', 'negociacao') AND numero_lancamento IS NULL)")
    expect(sql).toContain('idx_atendimento_presencial_atendimentos_lancamento')
    expect(sql).toContain('idx_atendimento_presencial_atendimentos_unidade_concluido')
    expect(sql).toContain('idx_atendimento_presencial_atendimentos_consultora_concluido')
    expect(sql).toContain('idx_atendimento_presencial_historico_usuario')
  })
})
