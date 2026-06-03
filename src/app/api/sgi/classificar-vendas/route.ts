import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { classificarProduto } from '@/lib/sgi/classificacao-produtos'

export const runtime = 'nodejs'

const BATCH_SIZE = 200

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Endpoint ─────────────────────────────────────────────────────────────────

export async function POST() {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // 1. Carrega tabela oficial → Map<codigo → {departamento, subgrupo}>
  const { data: refData } = await supabase
    .from('sgi_produtos_classificacao_referencia')
    .select('codigo_produto, departamento, subgrupo')
    .eq('ativo', true)

  const refMap = new Map<string, { departamento: string; subgrupo: string }>()
  for (const r of (refData ?? []) as RefRow[]) {
    refMap.set(r.codigo_produto.trim(), { departamento: r.departamento, subgrupo: r.subgrupo })
  }

  console.log(`[classificar-vendas] Tabela oficial carregada: ${refMap.size} registros`)

  // 2. Busca todos os produtos
  const { data: produtos, error: prodErr } = await supabase
    .from('sgi_documentos_saida_produtos')
    .select('id, codigo, produto, numero_lancamento, documento_saida_id')

  if (prodErr || !produtos) {
    return NextResponse.json({ error: 'Erro ao buscar produtos', detail: prodErr?.message }, { status: 500 })
  }

  // 3. Classifica cada produto
  let porReferencia = 0
  let porRegra = 0
  let naoClassificados = 0

  const exemplosReferencia: unknown[] = []
  const exemplosRegra: unknown[] = []
  const exemplosNaoClass: unknown[] = []

  const updates: ClassResult[] = []
  const porVenda = new Map<string, { departamento: string; subgrupo: string }[]>()

  for (const p of produtos as ProdutoRow[]) {
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
      if (exemplosReferencia.length < 10) {
        exemplosReferencia.push({ codigo: p.codigo, produto: p.produto, departamento, subgrupo })
      }
    } else {
      // Prioridade 2: palavras-chave
      const resultado = classificarProduto(p.produto ?? '')
      departamento = resultado.departamento
      subgrupo = resultado.subgrupo
      regra = resultado.regra
      confianca = resultado.confianca

      if (departamento === 'Não classificado') {
        naoClassificados++
        if (exemplosNaoClass.length < 10) {
          exemplosNaoClass.push({ codigo: p.codigo, produto: p.produto, numero_lancamento: p.numero_lancamento })
        }
      } else {
        porRegra++
        if (exemplosRegra.length < 10) {
          exemplosRegra.push({ codigo: p.codigo, produto: p.produto, departamento, subgrupo, regra })
        }
      }
    }

    updates.push({ id: p.id, departamento_classificado: departamento, subgrupo_classificado: subgrupo, classificacao_regra: regra, classificacao_confianca: confianca })

    if (!porVenda.has(p.numero_lancamento)) porVenda.set(p.numero_lancamento, [])
    porVenda.get(p.numero_lancamento)!.push({ departamento, subgrupo })
  }

  // 4. Upsert produtos em batches
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const { error: upsertErr } = await supabase
      .from('sgi_documentos_saida_produtos')
      .upsert(batch, { onConflict: 'id' })
    if (upsertErr) console.error('[classificar-vendas] erro upsert batch:', upsertErr)
  }

  // 5. Agrega e atualiza vendas em batches
  const vendaUpdates = Array.from(porVenda.entries()).map(([numero_lancamento, resultados]) => ({
    numero_lancamento,
    ...agregarVenda(resultados),
  }))

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
    )
  }

  return NextResponse.json({
    ok: true,
    total_produtos: produtos.length,
    total_referencia_oficial: refMap.size,
    classificados_por_referencia: porReferencia,
    classificados_por_regra: porRegra,
    nao_classificados: naoClassificados,
    vendas_atualizadas: porVenda.size,
    exemplos_referencia: exemplosReferencia,
    exemplos_regra: exemplosRegra,
    exemplos_nao_classificados: exemplosNaoClass,
  })
}
