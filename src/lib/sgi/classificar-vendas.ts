// ============================================================
// HELPER: CLASSIFICAÇÃO DE VENDAS SGI POR DEPARTAMENTO/SUBGRUPO
// Reutilizável para endpoints e scripts internos
// ============================================================

import { createServiceClient } from '@/lib/supabase/service'
import { classificarProduto } from './classificacao-produtos'
import type { SupabaseClient } from '@supabase/supabase-js'

const BATCH_SIZE = 200

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClassificarVendasOptions {
  /** Lista específica de números de lançamento para classificar */
  numeroLancamentos?: string[]
  /** Se true, classifica apenas produtos pendentes (depto/subgrupo null) */
  somentePendentes?: boolean
  /** Client Supabase opcional (para reutilização em contextos com client existente) */
  supabaseClient?: SupabaseClient
}

export interface ClassificarVendasResult {
  ok: boolean
  parcial?: boolean
  numeroLancamentos: string[]
  produtosEncontrados: number
  classificadosReferencia: number
  classificadosKeyword: number
  naoClassificados: number
  agregadosAtualizados: number
  erros: string[]
  exemplosNaoClassificados?: Array<{
    numero_lancamento: string
    codigo: string | null
    produto: string | null
  }>
}

interface ProdutoRow {
  id: string
  codigo: string | null
  produto: string | null
  numero_lancamento: string
  documento_saida_id: string
}

interface RefRow {
  codigo_produto: string
  departamento: string
  subgrupo: string
}

interface ClassResult {
  id: string
  departamento_classificado: string
  subgrupo_classificado: string
  classificacao_regra: string
  classificacao_confianca: number
}

// ─── Agregação de venda ───────────────────────────────────────────────────────

const ORDEM_DEPARTAMENTOS = ['Móveis', 'P. Pesada', 'Roupas', 'Enxoval', 'Puericultura leve', 'Outros', 'Não classificado']

function ordenar(arr: string[]): string[] {
  return [...arr].sort((a, b) => {
    const ia = ORDEM_DEPARTAMENTOS.indexOf(a)
    const ib = ORDEM_DEPARTAMENTOS.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

function agregarVenda(resultados: { departamento: string; subgrupo: string }[]) {
  const deptos = new Set(resultados.map((r) => r.departamento))
  const subgs = new Set(resultados.map((r) => r.subgrupo))

  const temReal = [...deptos].some((d) => d !== 'Outros' && d !== 'Não classificado')
  let dArr = [...deptos]
  if (temReal) dArr = dArr.filter((d) => d !== 'Outros')
  if (dArr.some((d) => d !== 'Não classificado')) dArr = dArr.filter((d) => d !== 'Não classificado')

  let sArr = [...subgs]
  if (temReal) sArr = sArr.filter((s) => s !== 'Serviço/Embalagem')
  if (sArr.some((s) => s !== 'Não classificado')) sArr = sArr.filter((s) => s !== 'Não classificado')

  const deptoOrdenado = ordenar(dArr)
  const subgrupoOrdenado = [...sArr].sort()
  return {
    departamentos_venda: deptoOrdenado,
    subgrupos_venda: subgrupoOrdenado,
    departamentos_venda_texto: deptoOrdenado.join(', ') || 'Não classificado',
    subgrupos_venda_texto: subgrupoOrdenado.join(', ') || 'Não classificado',
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function classificarVendasPorLancamentos(
  options: ClassificarVendasOptions = {}
): Promise<ClassificarVendasResult> {
  const { numeroLancamentos, somentePendentes = true, supabaseClient } = options

  const startTime = Date.now()
  const erros: string[] = []
  const exemplosNaoClassificados: Array<{ numero_lancamento: string; codigo: string | null; produto: string | null }> = []

  // Log inicial
  console.log('[SGI-CLASSIFICACAO] inicio', {
    lancamentos: numeroLancamentos?.length ?? 'todos',
    somentePendentes,
    lancamentosList: numeroLancamentos?.slice(0, 5),
  })

  const supabase = supabaseClient ?? createServiceClient()

  try {
    // 1. Carrega tabela oficial → Map<codigo → {departamento, subgrupo}>
    const { data: refData, error: refError } = await supabase
      .from('sgi_produtos_classificacao_referencia')
      .select('codigo_produto, departamento, subgrupo')
      .eq('ativo', true)

    if (refError) {
      erros.push(`Erro ao carregar tabela oficial: ${refError.message}`)
      console.error('[SGI-CLASSIFICACAO] erro tabela oficial:', refError)
    }

    const refMap = new Map<string, { departamento: string; subgrupo: string }>()
    for (const r of (refData ?? []) as RefRow[]) {
      refMap.set(r.codigo_produto.trim(), { departamento: r.departamento, subgrupo: r.subgrupo })
    }

    console.log(`[SGI-CLASSIFICACAO] tabelaOficialCarregada: ${refMap.size} registros`)

    // 2. Busca produtos conforme filtros
    let produtosQuery = supabase
      .from('sgi_documentos_saida_produtos')
      .select('id, codigo, produto, numero_lancamento, documento_saida_id')

    // Filtra por lançamentos específicos
    if (numeroLancamentos && numeroLancamentos.length > 0) {
      produtosQuery = produtosQuery.in('numero_lancamento', numeroLancamentos)
    }

    // Filtra apenas pendentes (se solicitado)
    if (somentePendentes) {
      produtosQuery = produtosQuery.or('departamento_classificado.is.null,subgrupo_classificado.is.null')
    }

    const { data: produtos, error: prodErr } = await produtosQuery

    if (prodErr) {
      erros.push(`Erro ao buscar produtos: ${prodErr.message}`)
      console.error('[SGI-CLASSIFICACAO] erro buscar produtos:', prodErr)
      return {
        ok: false,
        numeroLancamentos: numeroLancamentos ?? [],
        produtosEncontrados: 0,
        classificadosReferencia: 0,
        classificadosKeyword: 0,
        naoClassificados: 0,
        agregadosAtualizados: 0,
        erros,
      }
    }

    if (!produtos || produtos.length === 0) {
      console.log('[SGI-CLASSIFICACAO] nenhumProdutoParaClassificar')
      return {
        ok: true,
        numeroLancamentos: numeroLancamentos ?? [],
        produtosEncontrados: 0,
        classificadosReferencia: 0,
        classificadosKeyword: 0,
        naoClassificados: 0,
        agregadosAtualizados: 0,
        erros: [],
      }
    }

    console.log(`[SGI-CLASSIFICACAO] produtosEncontrados=${produtos.length}`)

    // 3. Classifica cada produto
    let porReferencia = 0
    let porRegra = 0
    let naoClassificados = 0
    let produtosSemId = 0

    const updates: Array<{
      id: string
      departamento_classificado: string
      subgrupo_classificado: string
      classificacao_regra: string
      classificacao_confianca: number
    }> = []
    const porVenda = new Map<string, { departamento: string; subgrupo: string }[]>()

    for (const p of produtos as ProdutoRow[]) {
      // Validação: produto deve ter id e documento_saida_id válidos
      if (!p.id || !p.documento_saida_id) {
        produtosSemId++
        console.warn(`[SGI-CLASSIFICACAO][AVISO] Produto sem id ou documento_saida_id - ignorado: numero_lancamento=${p.numero_lancamento} codigo=${p.codigo}`)
        continue
      }

      const codigoNorm = p.codigo?.trim() ?? ''
      let departamento: string
      let subgrupo: string
      let regra: string
      let confianca: number

      const ref = codigoNorm ? refMap.get(codigoNorm) : undefined

      if (ref) {
        // Prioridade 1: tabela oficial
        departamento = ref.departamento
        subgrupo = ref.subgrupo
        regra = 'referencia_codigo_produto'
        confianca = 1.0
        porReferencia++
      } else {
        // Prioridade 2: palavras-chave
        const resultado = classificarProduto(p.produto ?? '')
        departamento = resultado.departamento
        subgrupo = resultado.subgrupo
        regra = resultado.regra
        confianca = resultado.confianca

        if (departamento === 'Não classificado') {
          naoClassificados++
          if (exemplosNaoClassificados.length < 10) {
            exemplosNaoClassificados.push({
              numero_lancamento: p.numero_lancamento,
              codigo: p.codigo,
              produto: p.produto,
            })
            console.log(`[SGI-CLASSIFICACAO][SEM-CLASSIFICACAO] numero_lancamento=${p.numero_lancamento} codigo=${p.codigo} descricao="${p.produto}"`)
          }
        } else {
          porRegra++
        }
      }

      updates.push({ id: p.id, departamento_classificado: departamento, subgrupo_classificado: subgrupo, classificacao_regra: regra, classificacao_confianca: confianca })

      if (!porVenda.has(p.numero_lancamento)) porVenda.set(p.numero_lancamento, [])
      porVenda.get(p.numero_lancamento)!.push({ departamento, subgrupo })
    }

    if (produtosSemId > 0) {
      erros.push(`${produtosSemId} produtos ignorados por falta de id ou documento_saida_id`)
    }

    console.log(`[SGI-CLASSIFICACAO] classificadosReferencia=${porReferencia} classificadosKeyword=${porRegra} naoClassificados=${naoClassificados} produtosSemId=${produtosSemId}`)

    // 4. Update produtos em batches (usa update em vez de upsert para evitar constraint violation)
    let updateErrors = 0
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)

      // Update individual por id para cada produto no batch
      const updatePromises = batch.map((item) =>
        supabase
          .from('sgi_documentos_saida_produtos')
          .update({
            departamento_classificado: item.departamento_classificado,
            subgrupo_classificado: item.subgrupo_classificado,
            classificacao_regra: item.classificacao_regra,
            classificacao_confianca: item.classificacao_confianca,
          })
          .eq('id', item.id)
      )

      const results = await Promise.allSettled(updatePromises)
      const batchErrors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

      if (batchErrors.length > 0) {
        updateErrors++
        const errorMessages = batchErrors.map((e) => (e.reason as Error)?.message || String(e.reason)).join('; ')
        erros.push(`Erro update batch ${i}: ${errorMessages}`)
        console.error('[SGI-CLASSIFICACAO] erro update batch:', errorMessages)
      }
    }

    if (updateErrors > 0) {
      console.error(`[SGI-CLASSIFICACAO] ${updateErrors} batches com erro`)
    }

    // 5. Agrega e atualiza vendas em batches
    const vendaUpdates = Array.from(porVenda.entries()).map(([numero_lancamento, resultados]) => ({
      numero_lancamento,
      ...agregarVenda(resultados),
    }))

    let vendaErrors = 0
    for (let i = 0; i < vendaUpdates.length; i += BATCH_SIZE) {
      const batch = vendaUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map((v) =>
          supabase
            .from('sgi_documentos_saida')
            .update({
              departamentos_venda: v.departamentos_venda,
              subgrupos_venda: v.subgrupos_venda,
              departamentos_venda_texto: v.departamentos_venda_texto,
              subgrupos_venda_texto: v.subgrupos_venda_texto,
            })
            .eq('numero_lancamento', v.numero_lancamento)
        )
      ).catch((err) => {
        vendaErrors++
        erros.push(`Erro atualizando vendas batch ${i}: ${String(err)}`)
        console.error('[SGI-CLASSIFICACAO] erro atualizando vendas:', err)
      })
    }

    const agregadosAtualizados = vendaUpdates.length - vendaErrors
    console.log(`[SGI-CLASSIFICACAO] agregadosAtualizados=${agregadosAtualizados}`)

    const duration = Date.now() - startTime

    // Determina status final: ok só se não houver erros críticos de gravação
    const hasCriticalErrors = updateErrors > 0 || vendaErrors > 0
    const ok = !hasCriticalErrors

    if (ok) {
      console.log(`[SGI-CLASSIFICACAO] fim sucesso duracaoMs=${duration}`)
    } else {
      console.error(`[SGI-CLASSIFICACAO] fim com erros duracaoMs=${duration}`)
    }

    return {
      ok,
      parcial: erros.length > 0 && !hasCriticalErrors,
      numeroLancamentos: Array.from(porVenda.keys()),
      produtosEncontrados: produtos.length,
      classificadosReferencia: porReferencia,
      classificadosKeyword: porRegra,
      naoClassificados,
      agregadosAtualizados,
      erros: erros.length > 0 ? erros : [],
      exemplosNaoClassificados: exemplosNaoClassificados.length > 0 ? exemplosNaoClassificados : undefined,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[SGI-CLASSIFICACAO] erro geral:', err)
    return {
      ok: false,
      numeroLancamentos: numeroLancamentos ?? [],
      produtosEncontrados: 0,
      classificadosReferencia: 0,
      classificadosKeyword: 0,
      naoClassificados: 0,
      agregadosAtualizados: 0,
      erros: [errorMsg],
    }
  }
}
