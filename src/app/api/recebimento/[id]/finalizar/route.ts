import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { enviarRecebimentoParaPlanilha } from '@/lib/google/sheets-service'

// Helper: remove leading zeros for matching (02685 -> 2685)
function normalizeCode(code: string): string {
  return code.replace(/^0+/, '') || '0'
}

// POST /api/recebimento/[id]/finalizar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  // Verify recebimento exists and is open
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('*, timer_segundos_totais, data_inicio, motorista')
    .eq('id', id)
    .single()

  if (!rec) {
    return NextResponse.json({ error: 'Recebimento não encontrado' }, { status: 404 })
  }

  if (rec.status !== 'aberto') {
    return NextResponse.json({ error: 'Recebimento já está fechado' }, { status: 400 })
  }

  // Identify which NFs are OS type (to exclude their items from validation)
  const { data: nfeLinks } = await supabase
    .from('recebimento_nfes')
    .select('nfe_id, nfe:nfe_id(is_os)')
    .eq('recebimento_id', id)

  const nfeOSIds = new Set(
    (nfeLinks || [])
      .filter((link: Record<string, unknown>) => (link.nfe as { is_os?: boolean } | null)?.is_os)
      .map((link: Record<string, unknown>) => link.nfe_id as string)
  )

  // Fetch all items with their nfe_item link
  const { data: itens } = await supabase
    .from('recebimento_itens')
    .select('id, nfe_item_id, volumes_previstos_total, volumes_recebidos_total, divergencia_tipo')
    .eq('recebimento_id', id)

  // Get nfe_item -> nfe mapping to identify OS items
  const nfeItemIds = (itens || []).map(i => i.nfe_item_id).filter(Boolean)
  let osItemIds = new Set<string>()
  
  if (nfeItemIds.length > 0 && nfeOSIds.size > 0) {
    const { data: nfeItemsData } = await supabase
      .from('nfe_itens')
      .select('id, nfe_id')
      .in('id', nfeItemIds)

    for (const ni of (nfeItemsData || [])) {
      if (nfeOSIds.has(ni.nfe_id)) {
        // Find item with this nfe_item_id and mark as OS
        const item = (itens || []).find(i => i.nfe_item_id === ni.id)
        if (item) osItemIds.add(item.id)
      }
    }
  }

  // Filter to only normal items (exclude OS items which are tracked via recebimento_os)
  const itensNormais = (itens || []).filter(item => !osItemIds.has(item.id))

  console.log(`[LOG] Validação: ${(itens || []).length} itens total, ${osItemIds.size} OS excluídos, ${itensNormais.length} normais para validar`)

  // Recalculate volumes_recebidos_total from actual volume records (fix any desync)
  for (const item of itensNormais) {
    const { data: volumes } = await supabase
      .from('recebimento_item_volumes')
      .select('qtd_recebida')
      .eq('recebimento_item_id', item.id)

    const realTotal = (volumes || []).reduce((sum, v) => sum + (v.qtd_recebida || 0), 0)

    if (realTotal !== item.volumes_recebidos_total) {
      console.log(`[LOG] Corrigindo dessincronia item ${item.id}: banco=${item.volumes_recebidos_total}, real=${realTotal}`)
      await supabase
        .from('recebimento_itens')
        .update({ volumes_recebidos_total: realTotal })
        .eq('id', item.id)
      item.volumes_recebidos_total = realTotal
    }
  }

  // Validate: all normal items must be complete OR have divergência
  const pendentesItens = itensNormais.filter(item => {
    const incompleto = item.volumes_recebidos_total < item.volumes_previstos_total
    const semDivergencia = !item.divergencia_tipo
    return incompleto && semDivergencia
  })

  if (pendentesItens.length > 0) {
    console.log('[LOG] Itens normais incompletos sem divergência:', pendentesItens.map(p => ({
      id: p.id,
      recebido: p.volumes_recebidos_total,
      previsto: p.volumes_previstos_total,
      divergencia: p.divergencia_tipo
    })))
    return NextResponse.json({
      error: `Existem ${pendentesItens.length} item(ns) incompleto(s) sem divergência registrada`,
      itens_pendentes: pendentesItens.map(p => p.id),
    }, { status: 400 })
  }

  // Update matic_sku with learned data (volumes_por_item, corredor, nivel, prateleira)
  const { data: itensCompletos } = await supabase
    .from('recebimento_itens')
    .select(`
      nfe_item_id,
      volumes_por_item,
      corredor_final,
      nivel_final,
      prateleira_final,
      nfe_itens!inner (codigo_produto)
    `)
    .eq('recebimento_id', id)

  for (const item of (itensCompletos || [])) {
    const nfeItem = item.nfe_itens as unknown as { codigo_produto: string }
    const codigoNF = nfeItem?.codigo_produto // Código da NF
    
    if (!codigoNF) continue

    const codigoNormalizado = normalizeCode(codigoNF)

    // Check if SKU exists by normalized ref_meia
    const { data: allSkus } = await supabase
      .from('matic_sku')
      .select('codigo_produto, ref_meia')
      .not('ref_meia', 'is', null)

    // Find SKU with matching normalized ref_meia
    const existingSku = allSkus?.find(sku => 
      normalizeCode(sku.ref_meia || '') === codigoNormalizado
    )

    const updateData: Record<string, unknown> = {
      ref_meia: codigoNormalizado, // Store normalized version
      ativo: true,
      updated_at: new Date().toISOString(),
    }

    // If exists, use its codigo_produto, otherwise create new with normalized code
    if (existingSku) {
      updateData.codigo_produto = existingSku.codigo_produto
    } else {
      updateData.codigo_produto = codigoNormalizado // Use normalized code as internal code for new items
    }

    if (item.volumes_por_item) updateData.volumes_por_item = item.volumes_por_item
    if (item.corredor_final) updateData.corredor_sugerido = item.corredor_final
    if (item.nivel_final) updateData.nivel_sugerido = item.nivel_final
    if (item.prateleira_final) updateData.prateleira_sugerida = item.prateleira_final

    await supabase
      .from('matic_sku')
      .upsert(updateData, { onConflict: 'codigo_produto' })
  }

  console.log(`[LOG] matic_sku atualizada com ${(itensCompletos || []).length} produtos`)

  // Consolidar divergências para "Problemas do recebimento"
  const { data: itensDivergencias } = await supabase
    .from('recebimento_itens')
    .select(`
      divergencia_tipo,
      divergencia_obs,
      nfe_item:nfe_item_id(
        codigo_produto,
        nfe:nfe_id(numero_nf)
      )
    `)
    .eq('recebimento_id', id)
    .not('divergencia_tipo', 'is', null)

  const problemasList: string[] = []
  for (const item of (itensDivergencias || [])) {
    const nfeItemArray = item.nfe_item as Array<{ codigo_produto: string; nfe: Array<{ numero_nf: string }> }> | null
    const nfeItem = Array.isArray(nfeItemArray) ? nfeItemArray[0] : null
    const codigo = nfeItem?.codigo_produto || '?'
    const tipo = item.divergencia_tipo
    const obs = item.divergencia_obs || ''
    problemasList.push(`${codigo} (tipo: ${tipo}, observação: ${obs})`)
  }
  const problemasRecebimento = problemasList.join('; ')

  // Prepare data for Google Sheets
  const dataFim = new Date()
  const dataInicio = rec.data_inicio ? new Date(rec.data_inicio) : dataFim
  
  // Format time as HH:MM:SS (Brazil timezone UTC-3)
  const formatTime = (date: Date) => {
    const brazilDate = new Date(date.getTime() - 3 * 60 * 60 * 1000)
    return brazilDate.toISOString().substring(11, 19)
  }

  const formatarTempo = (segundos: number): string => {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const secs = segundos % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Get NFe numbers and total weight
  const { data: nfesData } = await supabase
    .from('recebimento_nfes')
    .select('nfe:nfe_id(numero_nf, peso_total, volumes_total)')
    .eq('recebimento_id', id)

  const nfeNumeros = (nfesData || []).map((nfe: Record<string, unknown>) => {
    const nfeObj = nfe.nfe as { numero_nf: string } | null
    return nfeObj?.numero_nf
  }).filter(Boolean).join(', ')

  const totalKilos = (nfesData || []).reduce((sum: number, nfe: Record<string, unknown>) => {
    const nfeObj = nfe.nfe as { peso_total: number } | null
    return sum + (nfeObj?.peso_total || 0)
  }, 0)

  const totalVolumes = (nfesData || []).reduce((sum: number, nfe: Record<string, unknown>) => {
    const nfeObj = nfe.nfe as { volumes_total: number } | null
    return sum + (nfeObj?.volumes_total || 0)
  }, 0)

  // Finalize
  const { error } = await supabase
    .from('recebimentos')
    .update({
      status: 'fechado',
      data_fim: dataFim.toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[LOG] Erro ao finalizar recebimento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Salvar problema pendente se informado
  if (body.problema_proximos_carregamentos && body.problema_proximos_carregamentos.trim()) {
    await supabase
      .from('recebimento_problemas_pendentes')
      .insert({
        recebimento_id: id,
        descricao: body.problema_proximos_carregamentos.trim(),
      })
  }

  // Send to Google Sheets via OAuth (usando mesma auth do app)
  let sheetsStatus = 'not_configured'
  let sheetsError: string | null = null
  
  try {
    const sheetData = {
      carimbo: dataFim.toLocaleString('pt-BR'),
      quem_finalizou: body.quem_finalizou || auth.email,
      horario_inicio: formatTime(dataInicio),
      horario_fim: formatTime(dataFim),
      tempo_total_formatado: formatarTempo(rec.timer_segundos_totais || 0),
      quantidade_chapas: body.quantidade_chapas || 0,
      motorista_ajudou: body.motorista_ajudou || 'Não informado',
      quantos_kilos: Math.round(totalKilos),
      quantos_volumes: totalVolumes,
      problemas_recebimento: problemasRecebimento,
      numero_nfs: nfeNumeros,
      problema_proximos_carregamentos: body.problema_proximos_carregamentos || '',
      outros_problemas: body.outros_problemas || '',
    }

    const result = await enviarRecebimentoParaPlanilha(sheetData)
    
    if (result.sucesso) {
      sheetsStatus = 'success'
      console.log('[LOG][SHEETS] ✅ Dados enviados com sucesso para a planilha')
    } else {
      sheetsStatus = 'error'
      sheetsError = result.erro || 'Erro desconhecido'
      console.error('[LOG][SHEETS] ❌ Erro ao enviar para planilha:', sheetsError)
    }
  } catch (err) {
    sheetsStatus = 'error'
    sheetsError = err instanceof Error ? err.message : String(err)
    console.error('[LOG][SHEETS] ❌ Erro ao preparar/enviar dados para Google Sheets:', sheetsError)
  }

  console.log(`[LOG] Recebimento ${id} finalizado por ${auth.email}`)
  console.log(`[LOG][SHEETS] Status final: ${sheetsStatus}${sheetsError ? ` - Erro: ${sheetsError}` : ''}`)

  return NextResponse.json({
    message: 'Recebimento finalizado com sucesso',
    sheets_status: sheetsStatus,
    sheets_error: sheetsError,
  })
}
