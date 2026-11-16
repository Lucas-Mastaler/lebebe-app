import { NextResponse } from 'next/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { quantidadeAgrupada, type ItemCategoria } from '@/lib/recebimento/categorias'

export async function GET() {
  const auth = await validateMaticUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const db = await createClient()
  const itens: ItemCategoria[] = []
  const tamanho = 500
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await db.from('recebimento_itens').select('id, volumes_previstos_total, volumes_recebidos_total, volumes_por_item, recebimento:recebimento_id!inner(status), nfe_item:nfe_item_id!inner(descricao, nfe:nfe_id!inner(is_os))').eq('recebimento.status', 'fechado').order('id').range(pagina * tamanho, pagina * tamanho + tamanho - 1)
    if (error) return NextResponse.json({ error: 'Não foi possível carregar o histórico de categorias.' }, { status: 500 })
    type Linha = { volumes_previstos_total: number; volumes_recebidos_total: number; volumes_por_item: number; nfe_item: { descricao: string; nfe: { is_os: boolean | null } } }
    const linhas = (data || []) as unknown as Linha[]
    for (const linha of linhas) {
      if (linha.nfe_item.nfe.is_os) continue
      itens.push({ descricao: linha.nfe_item.descricao || '', quantidade: quantidadeAgrupada(linha.volumes_previstos_total, linha.volumes_por_item), previstos: linha.volumes_previstos_total, conferidos: linha.volumes_recebidos_total })
    }
    if (linhas.length < tamanho) break
  }
  return NextResponse.json(itens)
}
