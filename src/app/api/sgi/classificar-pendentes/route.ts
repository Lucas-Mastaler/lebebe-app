import { NextRequest, NextResponse } from 'next/server'
import { classificarVendasPorLancamentos } from '@/lib/sgi/classificar-vendas'

export const runtime = 'nodejs'

/**
 * POST /api/sgi/classificar-pendentes
 *
 * Endpoint interno para classificar vendas importadas pela VPS.
 * Requer header x-internal-token para autenticação.
 *
 * Body:
 * {
 *   "numeroLancamentos": ["55653", "55644", "55655"],
 *   "somentePendentes": true  // opcional, default true
 * }
 */

export async function POST(request: NextRequest) {
  // ─── Validação de segurança ───────────────────────────────────────────────────
  const tokenRecebido = request.headers.get('x-internal-token')?.trim()
  const tokenEsperado = process.env.SGI_CLASSIFICACAO_TOKEN?.trim()

  // DEBUG: Log seguro para diagnosticar diferenças de token
  function fingerprintToken(token?: string | null) {
    if (!token) return { presente: false, tamanho: 0, inicio: null, fim: null }
    return {
      presente: true,
      tamanho: token.length,
      inicio: token.slice(0, 4),
      fim: token.slice(-4),
    }
  }

  console.log('[SGI-CLASSIFICAR-PENDENTES][AUTH-DEBUG]', {
    recebido: fingerprintToken(tokenRecebido),
    esperado: fingerprintToken(tokenEsperado),
    confere: tokenRecebido === tokenEsperado,
  })

  if (!tokenEsperado) {
    console.error('[SGI-CLASSIFICAR-PENDENTES] SGI_CLASSIFICACAO_TOKEN não configurado no ambiente')
    return NextResponse.json(
      { ok: false, erro: 'Token não configurado no servidor' },
      { status: 500 }
    )
  }

  if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
    console.warn('[SGI-CLASSIFICAR-PENDENTES] Tentativa de acesso não autorizado', {
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: request.headers.get('user-agent')?.slice(0, 50) ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, erro: 'Não autorizado' },
      { status: 401 }
    )
  }

  // ─── Parsing do body ─────────────────────────────────────────────────────────
  let body: { numeroLancamentos?: string[]; somentePendentes?: boolean }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, erro: 'Body inválido - esperado JSON' },
      { status: 400 }
    )
  }

  const { numeroLancamentos, somentePendentes = true } = body

  // Validação: deve ter pelo menos um critério
  if (!numeroLancamentos || !Array.isArray(numeroLancamentos) || numeroLancamentos.length === 0) {
    return NextResponse.json(
      { ok: false, erro: 'numeroLancamentos é obrigatório e deve ser um array não vazio' },
      { status: 400 }
    )
  }

  // Validação: máximo de lançamentos por chamada (proteção)
  const MAX_LANCAMENTOS = 500
  if (numeroLancamentos.length > MAX_LANCAMENTOS) {
    return NextResponse.json(
      { ok: false, erro: `Máximo de ${MAX_LANCAMENTOS} lançamentos por chamada` },
      { status: 400 }
    )
  }

  // ─── Execução ─────────────────────────────────────────────────────────────────
  console.log('[SGI-CLASSIFICAR-PENDENTES] requisicao autorizada', {
    lancamentos: numeroLancamentos.length,
    somentePendentes,
  })

  const resultado = await classificarVendasPorLancamentos({
    numeroLancamentos,
    somentePendentes,
  })

  // ─── Retorno ─────────────────────────────────────────────────────────────────
  const statusCode = resultado.ok ? 200 : 500

  return NextResponse.json(
    {
      ok: resultado.ok,
      numeroLancamentos: resultado.numeroLancamentos,
      produtosEncontrados: resultado.produtosEncontrados,
      classificadosReferencia: resultado.classificadosReferencia,
      classificadosKeyword: resultado.classificadosKeyword,
      naoClassificados: resultado.naoClassificados,
      agregadosAtualizados: resultado.agregadosAtualizados,
      erros: resultado.erros.length > 0 ? resultado.erros : undefined,
      exemplosNaoClassificados: resultado.exemplosNaoClassificados,
    },
    { status: statusCode }
  )
}
