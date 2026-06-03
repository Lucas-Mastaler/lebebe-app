import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import type { SgiVendaDetalhe, SgiVendaClienteResumo } from '@/types/sgi'
import { gerarVariacoesTelefone } from '@/lib/digisac/sgi-sync'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero_lancamento: string }> }
) {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { numero_lancamento } = await params

  if (!numero_lancamento?.trim()) {
    return NextResponse.json({ error: 'Número de lançamento obrigatório' }, { status: 400 })
  }

  console.log('[API][SGI][VENDA] GET numero_lancamento=', numero_lancamento)

  const supabase = await createClient()

  // ── Buscar vendas relacionadas do mesmo cliente (por telefone) ───────
  let vendasCliente: SgiVendaClienteResumo[] = []
  try {
    // Buscar todos os telefones da venda atual
    const { data: contatosAtuais } = await supabase
      .from('sgi_documentos_saida_contatos')
      .select('telefone_normalizado, telefone_normalizado_ddi')
      .eq('numero_lancamento', numero_lancamento.trim())

    if (contatosAtuais && contatosAtuais.length > 0) {
      // Coletar todas as variações de telefone
      const todasVariacoes = new Set<string>()
      contatosAtuais.forEach(c => {
        if (c.telefone_normalizado) {
          gerarVariacoesTelefone(c.telefone_normalizado).forEach(v => todasVariacoes.add(v))
        }
        if (c.telefone_normalizado_ddi) {
          gerarVariacoesTelefone(c.telefone_normalizado_ddi).forEach(v => todasVariacoes.add(v))
        }
      })
      const variacoesArray = Array.from(todasVariacoes)

      if (variacoesArray.length > 0) {
        // Buscar outras vendas com telefones em comum
        const { data: vendasRelacionadas } = await supabase
          .from('sgi_documentos_saida_contatos')
          .select(`
            numero_lancamento,
            telefone_normalizado,
            telefone_normalizado_ddi
          `)
          .or(variacoesArray.map(v => `telefone_normalizado.eq.${v},telefone_normalizado_ddi.eq.${v}`).join(','))
          .neq('numero_lancamento', numero_lancamento.trim())

        if (vendasRelacionadas && vendasRelacionadas.length > 0) {
          const lancamentosUnicos = [...new Set(vendasRelacionadas.map(v => v.numero_lancamento))]

          // Buscar dados completos das vendas relacionadas
          const { data: vendasDados } = await supabase
            .from('sgi_documentos_saida')
            .select(`
              numero_lancamento,
              data_fechamento,
              cliente,
              filial,
              vendedor,
              operacao,
              status,
              valor_total,
              digisac_chamados_ciclo,
              digisac_status
            `)
            .in('numero_lancamento', lancamentosUnicos)
            .order('data_fechamento', { ascending: false })

          if (vendasDados) {
            vendasCliente = vendasDados.map(v => ({
              numero_lancamento: v.numero_lancamento,
              data_fechamento: v.data_fechamento,
              cliente: v.cliente,
              filial: v.filial,
              vendedor: v.vendedor,
              operacao: v.operacao,
              status: v.status,
              valor_total: v.valor_total,
              digisac_chamados_ciclo: v.digisac_chamados_ciclo,
              digisac_status: v.digisac_status,
              venda_atual: false,
            }))
          }
        }
      }
    }
  } catch (err) {
    console.error('[API][SGI][VENDA] Erro ao buscar vendas relacionadas:', err)
  }

  const { data: doc, error: docError } = await supabase
    .from('sgi_documentos_saida')
    .select('*')
    .eq('numero_lancamento', numero_lancamento.trim())
    .single()

  if (docError || !doc) {
    console.error('[API][SGI][VENDA] Não encontrado:', docError)
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }

  const [contatosResult, produtosResult, pagamentosResult] = await Promise.all([
    supabase
      .from('sgi_documentos_saida_contatos')
      .select('id, documento_saida_id, numero_lancamento, telefone_original, telefone_normalizado, telefone_normalizado_ddi, principal')
      .eq('documento_saida_id', doc.id)
      .order('principal', { ascending: false }),
    supabase
      .from('sgi_documentos_saida_produtos')
      .select('id, documento_saida_id, numero_lancamento, codigo, produto, local_estocagem, quantidade, quantidade_texto, valor_total, valor_total_texto, categoria_sugerida, departamento_classificado, subgrupo_classificado')
      .eq('documento_saida_id', doc.id),
    supabase
      .from('sgi_documentos_saida_pagamentos')
      .select('id, documento_saida_id, numero_lancamento, forma_pagamento, numero_parcelas, numero_parcelas_texto, percentual, percentual_texto, valor, valor_texto, nsu, numero_autorizacao')
      .eq('documento_saida_id', doc.id),
  ])

  // Adicionar a venda atual no início da lista
  const vendaAtualResumo: SgiVendaClienteResumo = {
    numero_lancamento: doc.numero_lancamento,
    data_fechamento: doc.data_fechamento,
    cliente: doc.cliente,
    filial: doc.filial,
    vendedor: doc.vendedor,
    operacao: doc.operacao,
    status: doc.status,
    valor_total: doc.valor_total,
    digisac_chamados_ciclo: doc.digisac_chamados_ciclo,
    digisac_status: doc.digisac_status,
    venda_atual: true,
  }

  const detalhe: SgiVendaDetalhe = {
    ...doc,
    contatos_lista: contatosResult.data ?? [],
    produtos: produtosResult.data ?? [],
    pagamentos: pagamentosResult.data ?? [],
    vendasCliente: [vendaAtualResumo, ...vendasCliente],
  }

  return NextResponse.json(detalhe)
}
