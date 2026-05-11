import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

const CAMPOS_SENSIVEIS = ['ref_meia', 'ref_inteira', 'volumes_por_item'] as const
const CAMPOS_PERMITIDOS = [
  'descricao',
  'corredor_sugerido',
  'nivel_sugerido',
  'prateleira_sugerida',
  'ativo',
  'ref_meia',
  'ref_inteira',
  'volumes_por_item',
] as const

// PATCH /api/matic/sku/[codigo] — atualiza campos de um produto em matic_sku
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { codigo } = await params
  if (!codigo) {
    return NextResponse.json({ error: 'codigo_produto obrigatório' }, { status: 400 })
  }

  const body = await request.json()

  // Rejeitar qualquer tentativa de alterar codigo_produto
  if ('codigo_produto' in body) {
    return NextResponse.json({ error: 'codigo_produto não pode ser alterado' }, { status: 400 })
  }

  // Validar campos recebidos
  const updateData: Record<string, unknown> = {}

  for (const campo of CAMPOS_PERMITIDOS) {
    if (!(campo in body)) continue

    const valor = body[campo]

    if (campo === 'descricao') {
      if (typeof valor !== 'string' || valor.trim() === '') {
        return NextResponse.json({ error: 'descricao não pode ser vazia' }, { status: 400 })
      }
      updateData[campo] = valor.trim()
    } else if (campo === 'volumes_por_item') {
      const num = parseInt(valor)
      if (!Number.isInteger(num) || num < 1) {
        return NextResponse.json({ error: 'volumes_por_item deve ser um inteiro >= 1' }, { status: 400 })
      }
      updateData[campo] = num
    } else if (campo === 'ref_meia' || campo === 'ref_inteira') {
      if (valor === null || valor === '') {
        updateData[campo] = null
      } else if (typeof valor === 'string') {
        const trimmed = valor.trim()
        if (trimmed === '') {
          updateData[campo] = null
        } else {
          updateData[campo] = trimmed
        }
      } else {
        return NextResponse.json({ error: `${campo} deve ser texto ou null` }, { status: 400 })
      }
    } else if (campo === 'ativo') {
      if (typeof valor !== 'boolean') {
        return NextResponse.json({ error: 'ativo deve ser boolean' }, { status: 400 })
      }
      updateData[campo] = valor
    } else {
      // corredor_sugerido, nivel_sugerido, prateleira_sugerida: string ou null
      if (valor === null || valor === '') {
        updateData[campo] = null
      } else if (typeof valor === 'string') {
        updateData[campo] = valor.trim()
      } else {
        return NextResponse.json({ error: `${campo} deve ser texto ou null` }, { status: 400 })
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  // updated_at explícito
  updateData.updated_at = new Date().toISOString()

  const supabase = await createClient()

  // Buscar valores atuais para log dos campos sensíveis
  const camposSensiveisAlterados = CAMPOS_SENSIVEIS.filter(c => c in updateData)
  if (camposSensiveisAlterados.length > 0) {
    const { data: atual, error: fetchError } = await supabase
      .from('matic_sku')
      .select(camposSensiveisAlterados.join(','))
      .eq('codigo_produto', codigo)
      .single()

    if (fetchError) {
      console.error('[LOG][SKU_EDIT] Erro ao buscar valores atuais para log:', fetchError)
    } else if (atual) {
      const diffLog: Record<string, { antes: unknown; depois: unknown }> = {}
      for (const campo of camposSensiveisAlterados) {
        const antes = (atual as Record<string, unknown>)[campo]
        const depois = updateData[campo]
        if (antes !== depois) {
          diffLog[campo] = { antes, depois }
        }
      }
      if (Object.keys(diffLog).length > 0) {
        console.log(
          `[LOG][SKU_EDIT] user=${auth.email} produto=${codigo} campos_sensiveis_alterados=${JSON.stringify(diffLog)}`
        )
      }
    }
  }

  // Executar update
  const { data, error } = await supabase
    .from('matic_sku')
    .update(updateData)
    .eq('codigo_produto', codigo)
    .select()
    .single()

  if (error) {
    console.error('[LOG][SKU_EDIT] Erro ao atualizar matic_sku:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
