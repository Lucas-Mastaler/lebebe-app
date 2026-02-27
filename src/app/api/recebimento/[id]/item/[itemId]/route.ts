import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// PATCH /api/recebimento/[id]/item/[itemId] — update local or divergência
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id, itemId } = await params
  const body = await request.json()

  const supabase = await createClient()

  // Verify recebimento is open
  const { data: rec } = await supabase
    .from('recebimentos')
    .select('status')
    .eq('id', id)
    .single()

  if (!rec || rec.status !== 'aberto') {
    return NextResponse.json({ error: 'Recebimento não está aberto' }, { status: 400 })
  }

  // Build update object with only allowed fields
  const updateFields: Record<string, unknown> = {}
  if (body.corredor_final !== undefined) updateFields.corredor_final = body.corredor_final
  if (body.nivel_final !== undefined) updateFields.nivel_final = body.nivel_final
  if (body.prateleira_final !== undefined) updateFields.prateleira_final = body.prateleira_final
  if (body.divergencia_tipo !== undefined) updateFields.divergencia_tipo = body.divergencia_tipo || null
  if (body.divergencia_obs !== undefined) updateFields.divergencia_obs = body.divergencia_obs || null
  if (body.avaria_foto_url !== undefined) updateFields.avaria_foto_url = body.avaria_foto_url || null

  const newVolumesPorItem = body.volumes_por_item !== undefined 
    ? Math.max(1, parseInt(body.volumes_por_item) || 1)
    : null

  // Handle volumes_por_item change FIRST (before updating item)
  // CRITICAL: Only reset if volumes_por_item CHANGED, not just if it was sent
  if (newVolumesPorItem !== null) {
    // Get current volumes_por_item to check if it changed
    const { data: currentItem } = await supabase
      .from('recebimento_itens')
      .select('volumes_por_item')
      .eq('id', itemId)
      .single()

    const currentVolumesPorItem = currentItem?.volumes_por_item || 1

    // Only proceed if value actually changed
    if (newVolumesPorItem !== currentVolumesPorItem) {
      console.log('[LOG] Atualizando volumes_por_item de', currentVolumesPorItem, 'para:', newVolumesPorItem)

      // Get item to calculate new volumes_previstos_total
      const { data: itemData } = await supabase
        .from('recebimento_itens')
        .select('nfe_item_id, nfe_item:nfe_item_id(quantidade)')
        .eq('id', itemId)
        .single()

      console.log('[LOG] itemData raw:', JSON.stringify(itemData))

      const nfeItem = itemData?.nfe_item as { quantidade: number } | undefined
      const quantidade = nfeItem?.quantidade || 0
      const newVolumesPrevistos = quantidade * newVolumesPorItem
      console.log('[LOG] Quantidade NF:', quantidade, '| Volumes previstos total:', newVolumesPrevistos)

      // Use service client for volume operations (bypass RLS)
      const serviceClient = createServiceClient()

      // CRITICAL: Delete old volume records FIRST
      const { error: deleteError, count: deletedCount } = await serviceClient
        .from('recebimento_item_volumes')
        .delete({ count: 'exact' })
        .eq('recebimento_item_id', itemId)

      if (deleteError) {
        console.error('[LOG] Erro ao deletar volumes antigos:', deleteError)
        return NextResponse.json({ error: 'Erro ao deletar volumes: ' + deleteError.message }, { status: 500 })
      } else {
        console.log('[LOG] Volumes antigos deletados:', deletedCount)
      }

      // Create new volume records (1 per volume type)
      const newVolumes = []
      for (let v = 1; v <= newVolumesPorItem; v++) {
        newVolumes.push({
          recebimento_item_id: itemId,
          volume_numero: v,
          qtd_prevista: quantidade,
          qtd_recebida: 0,
        })
      }

      console.log('[LOG] Criando', newVolumes.length, 'novos volumes:', JSON.stringify(newVolumes))

      if (newVolumes.length > 0) {
        const { error: insertError, data: insertedVolumes } = await serviceClient
          .from('recebimento_item_volumes')
          .insert(newVolumes)
          .select()

        if (insertError) {
          console.error('[LOG] ERRO ao inserir volumes:', insertError)
          return NextResponse.json({ error: 'Erro ao criar volumes: ' + insertError.message }, { status: 500 })
        } else {
          console.log('[LOG] Volumes criados com sucesso:', insertedVolumes?.length || 0)
        }
      }

      // Now add to update fields
      updateFields.volumes_por_item = newVolumesPorItem
      updateFields.volumes_previstos_total = newVolumesPrevistos
      updateFields.volumes_recebidos_total = 0 // Reset received count
    } else {
      console.log('[LOG] volumes_por_item não mudou, mantendo:', currentVolumesPorItem)
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recebimento_itens')
    .update(updateFields)
    .eq('id', itemId)
    .eq('recebimento_id', id)
    .select()
    .single()

  if (error) {
    console.error('[LOG] Erro ao atualizar item:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[LOG] Item atualizado com sucesso:', data.id)
  return NextResponse.json(data)
}
