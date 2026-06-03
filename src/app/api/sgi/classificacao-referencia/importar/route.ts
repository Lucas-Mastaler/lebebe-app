import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateComercialUser } from '@/lib/auth/sgi-auth'

export const runtime = 'nodejs'

// ─── Normalização de cabeçalhos ───────────────────────────────────────────────

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const ALIAS_CODIGO = ['codigo', 'codigo_produto', 'code', 'cod']
const ALIAS_DESCRICAO = ['descricao', 'descricao_oficial', 'description', 'nome', 'produto']
const ALIAS_DEPARTAMENTO = ['departamento', 'department', 'dept', 'depto']
const ALIAS_SUBGRUPO = ['subgrupo', 'subgroup', 'sub', 'grupo']

function resolverCampo(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => normHeader(h) === alias)
    if (idx !== -1) return idx
  }
  return -1
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ItemImportacao {
  codigo: string
  descricao: string
  departamento: string
  subgrupo: string
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────

/**
 * POST /api/sgi/classificacao-referencia/importar
 *
 * Aceita dois formatos:
 *
 * 1. JSON direto:
 *    { items: [{ codigo, descricao, departamento, subgrupo }] }
 *
 * 2. CSV/TSV em multipart ou como string no campo "csv":
 *    { csv: "codigo\tdescricao\tdepartamento\tsubgrupo\n..." }
 */
export async function POST(request: NextRequest) {
  const auth = await validateComercialUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  let items: ItemImportacao[] = []

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json()

    if (Array.isArray(body.items)) {
      // Formato normalizado
      items = body.items.map((i: Record<string, string>) => ({
        codigo: String(i.codigo ?? i.codigo_produto ?? '').trim(),
        descricao: String(i.descricao ?? i.descricao_oficial ?? '').trim(),
        departamento: String(i.departamento ?? '').trim(),
        subgrupo: String(i.subgrupo ?? '').trim(),
      }))
    } else if (typeof body.csv === 'string') {
      items = parseCsv(body.csv)
    } else {
      return NextResponse.json({ error: 'Formato inválido. Envie { items: [...] } ou { csv: "..." }' }, { status: 400 })
    }
  } else if (contentType.includes('text/')) {
    const text = await request.text()
    items = parseCsv(text)
  } else {
    return NextResponse.json({ error: 'Content-Type não suportado. Use application/json ou text/csv' }, { status: 415 })
  }

  // Validação básica
  const invalidos = items.filter((i) => !i.codigo || !i.departamento || !i.subgrupo)
  if (invalidos.length > 0 && invalidos.length === items.length) {
    return NextResponse.json({
      error: 'Nenhum item válido encontrado. Campos obrigatórios: codigo, departamento, subgrupo',
      exemplos: invalidos.slice(0, 3),
    }, { status: 400 })
  }

  const validos = items.filter((i) => i.codigo && i.departamento && i.subgrupo)

  if (validos.length === 0) {
    return NextResponse.json({ error: 'Nenhum item com código, departamento e subgrupo preenchidos' }, { status: 400 })
  }

  // Upsert em lotes de 500
  const supabase = createServiceClient()
  const BATCH = 500
  let inseridos = 0
  let erros: string[] = []

  for (let i = 0; i < validos.length; i += BATCH) {
    const lote = validos.slice(i, i + BATCH).map((item) => ({
      codigo_produto: item.codigo,
      descricao_oficial: item.descricao || null,
      departamento: item.departamento,
      subgrupo: item.subgrupo,
      origem: 'manual',
      ativo: true,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('sgi_produtos_classificacao_referencia')
      .upsert(lote, {
        onConflict: 'codigo_produto',
        ignoreDuplicates: false,
      })

    if (error) {
      erros.push(`Lote ${i / BATCH + 1}: ${error.message}`)
    } else {
      inseridos += lote.length
    }
  }

  return NextResponse.json({
    ok: true,
    total_recebidos: items.length,
    total_validos: validos.length,
    total_invalidos: invalidos.length,
    total_importados: inseridos,
    erros: erros.length > 0 ? erros : undefined,
  })
}

// ─── Parser CSV/TSV ───────────────────────────────────────────────────────────

function parseCsv(text: string): ItemImportacao[] {
  const linhas = text.split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length < 2) return []

  // Detectar separador: tab ou ponto e vírgula ou vírgula
  const cabecalho = linhas[0]
  const sep = cabecalho.includes('\t') ? '\t' : cabecalho.includes(';') ? ';' : ','

  const headers = cabecalho.split(sep).map((h) => h.replace(/^["']|["']$/g, '').trim())

  const idxCodigo = resolverCampo(headers, ALIAS_CODIGO)
  const idxDescricao = resolverCampo(headers, ALIAS_DESCRICAO)
  const idxDepartamento = resolverCampo(headers, ALIAS_DEPARTAMENTO)
  const idxSubgrupo = resolverCampo(headers, ALIAS_SUBGRUPO)

  if (idxCodigo === -1 || idxDepartamento === -1 || idxSubgrupo === -1) {
    return []
  }

  const items: ItemImportacao[] = []
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.replace(/^["']|["']$/g, '').trim())
    const codigo = cols[idxCodigo] ?? ''
    if (!codigo) continue
    items.push({
      codigo,
      descricao: idxDescricao !== -1 ? (cols[idxDescricao] ?? '') : '',
      departamento: cols[idxDepartamento] ?? '',
      subgrupo: cols[idxSubgrupo] ?? '',
    })
  }
  return items
}
