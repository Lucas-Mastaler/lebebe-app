import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_ANEXOS_PEDIDOS, EXPIRACAO_URL_ASSINADA_SEGUNDOS } from './anexos-arquivo'

type ErroBanco = { code?: string; message?: string }
type Resultado<T> = { data: T; error: null } | { data: null; error: ErroBanco }

export type AnexoRow = {
  id: string
  tapete_id: string
  slot: number
  caminho_objeto: string
  nome_original: string
  mime_type: string
  tamanho_bytes: number
  created_at: string
}

export type EscopoAnexo = {
  pedido: {
    id: string
    version: number
    status: string
    created_by: string
    fornecedor: { chave: string } | null
  }
  tapete: { id: string; pedido_id: string }
  anexo?: AnexoRow
}

export type PendenciaStorage = {
  id: string
  bucketId: string
  caminhoObjeto: string
  motivo: 'SUBSTITUICAO' | 'REMOCAO_ANEXO' | 'REMOCAO_TAPETE' | 'REMOCAO_PEDIDO' | 'FALHA_APOS_UPLOAD'
  tentativas: number
  proximaTentativaEm: string
  ultimoErro: string | null
  processadoEm: string | null
  createdAt: string
  updatedAt: string
}

const MOTIVOS_PENDENCIA = new Set<PendenciaStorage['motivo']>([
  'SUBSTITUICAO',
  'REMOCAO_ANEXO',
  'REMOCAO_TAPETE',
  'REMOCAO_PEDIDO',
  'FALHA_APOS_UPLOAD',
])

function mapearPendenciaStorage(linha: unknown): PendenciaStorage | null {
  if (typeof linha !== 'object' || linha === null || Array.isArray(linha)) return null
  const row = linha as Record<string, unknown>
  if (
    typeof row.id !== 'string'
    || typeof row.bucket_id !== 'string'
    || typeof row.caminho_objeto !== 'string'
    || typeof row.motivo !== 'string'
    || !MOTIVOS_PENDENCIA.has(row.motivo as PendenciaStorage['motivo'])
    || !Number.isInteger(row.tentativas)
    || typeof row.proxima_tentativa_em !== 'string'
    || (row.ultimo_erro !== null && typeof row.ultimo_erro !== 'string')
    || (row.processado_em !== null && typeof row.processado_em !== 'string')
    || typeof row.created_at !== 'string'
    || typeof row.updated_at !== 'string'
  ) return null

  return {
    id: row.id,
    bucketId: row.bucket_id,
    caminhoObjeto: row.caminho_objeto,
    motivo: row.motivo as PendenciaStorage['motivo'],
    tentativas: row.tentativas as number,
    proximaTentativaEm: row.proxima_tentativa_em,
    ultimoErro: row.ultimo_erro as string | null,
    processadoEm: row.processado_em as string | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RepositorioAnexos {
  constructor(readonly supabase: SupabaseClient) {}

  async buscarTapeteNoEscopo(pedidoId: string, tapeteId: string, unidades: readonly string[]): Promise<Resultado<EscopoAnexo | null>> {
    if (unidades.length === 0) return { data: null, error: null }
    const pedido = await this.supabase.from('pedidos_personalizados_pedidos').select(`
      id,
      version,
      status,
      created_by,
      fornecedor:pedidos_personalizados_fornecedores!pedidos_personalizados_pedidos_fornecedor_id_fkey(chave)
    `)
      .eq('id', pedidoId).in('unidade_id', [...unidades]).maybeSingle()
    if (pedido.error) return { data: null, error: pedido.error }
    if (!pedido.data) return { data: null, error: null }
    const tapete = await this.supabase.from('pedidos_personalizados_moriah_tapetes').select('id, pedido_id')
      .eq('id', tapeteId).eq('pedido_id', pedidoId).maybeSingle()
    if (tapete.error) return { data: null, error: tapete.error }
    return tapete.data
      ? { data: { pedido: pedido.data as unknown as EscopoAnexo['pedido'], tapete: tapete.data }, error: null }
      : { data: null, error: null }
  }

  async buscarAnexoNoEscopo(anexoId: string, unidades: readonly string[]): Promise<Resultado<EscopoAnexo | null>> {
    const anexo = await this.supabase.from('pedidos_personalizados_anexos')
      .select('id, tapete_id, slot, caminho_objeto, nome_original, mime_type, tamanho_bytes, created_at')
      .eq('id', anexoId).maybeSingle()
    if (anexo.error) return { data: null, error: anexo.error }
    if (!anexo.data) return { data: null, error: null }
    const tapete = await this.supabase.from('pedidos_personalizados_moriah_tapetes').select('id, pedido_id')
      .eq('id', anexo.data.tapete_id).maybeSingle()
    if (tapete.error) return { data: null, error: tapete.error }
    if (!tapete.data) return { data: null, error: null }
    const escopo = await this.buscarTapeteNoEscopo(tapete.data.pedido_id, tapete.data.id, unidades)
    if (escopo.error || !escopo.data) return escopo
    return { data: { ...escopo.data, anexo: anexo.data as AnexoRow }, error: null }
  }

  async listarAnexosTapete(tapeteId: string): Promise<Resultado<Array<Pick<AnexoRow, 'id' | 'slot'>>>> {
    const { data, error } = await this.supabase.from('pedidos_personalizados_anexos').select('id, slot').eq('tapete_id', tapeteId)
    return error ? { data: null, error } : { data: (data ?? []) as Array<Pick<AnexoRow, 'id' | 'slot'>>, error: null }
  }

  async registrar(params: Record<string, unknown>) { return this.rpc('registrar_anexo_pedido_personalizado', params) }
  async substituir(params: Record<string, unknown>) { return this.rpc('substituir_anexo_pedido_personalizado', params) }
  async remover(params: Record<string, unknown>) { return this.rpc('remover_anexo_pedido_personalizado', params) }

  private async rpc(nome: string, params: Record<string, unknown>): Promise<Resultado<Record<string, unknown>>> {
    const { data, error } = await this.supabase.rpc(nome, params)
    if (error) return { data: null, error }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    return row ? { data: row, error: null } : { data: null, error: { message: 'RETORNO_RPC_INVALIDO' } }
  }

  async enfileirarFalhaAposUpload(caminho: string): Promise<Resultado<true>> {
    const { error } = await this.supabase.from('pedidos_personalizados_storage_pendencias').insert({
      bucket_id: BUCKET_ANEXOS_PEDIDOS,
      caminho_objeto: caminho,
      motivo: 'FALHA_APOS_UPLOAD',
    })
    return error ? { data: null, error } : { data: true, error: null }
  }

  async marcarProcessadoPorCaminho(caminho: string, agora: string) {
    return this.supabase.from('pedidos_personalizados_storage_pendencias')
      .update({ processado_em: agora, updated_at: agora, ultimo_erro: null })
      .eq('bucket_id', BUCKET_ANEXOS_PEDIDOS).eq('caminho_objeto', caminho).is('processado_em', null)
  }

  async carregarPendencias(agora: string, limite = 20): Promise<Resultado<PendenciaStorage[]>> {
    const { data, error } = await this.supabase.from('pedidos_personalizados_storage_pendencias')
      .select('id, bucket_id, caminho_objeto, motivo, tentativas, proxima_tentativa_em, ultimo_erro, processado_em, created_at, updated_at')
      .is('processado_em', null)
      .lte('proxima_tentativa_em', agora).order('proxima_tentativa_em').limit(limite)
    if (error) return { data: null, error }
    const pendencias = (data ?? []).map(mapearPendenciaStorage)
    if (pendencias.some((item) => item === null)) {
      return { data: null, error: { message: 'PENDENCIA_STORAGE_INVALIDA' } }
    }
    return { data: pendencias as PendenciaStorage[], error: null }
  }

  async reivindicar(item: PendenciaStorage, leaseAte: string): Promise<Resultado<boolean>> {
    const { data, error } = await this.supabase.from('pedidos_personalizados_storage_pendencias')
      .update({ proxima_tentativa_em: leaseAte, updated_at: new Date().toISOString() }).eq('id', item.id)
      .is('processado_em', null).eq('proxima_tentativa_em', item.proximaTentativaEm).select('id').maybeSingle()
    if (error) return { data: null, error }
    return { data: Boolean(data), error: null }
  }

  async concluir(item: PendenciaStorage, leaseAte: string, agora: string) {
    return this.supabase.from('pedidos_personalizados_storage_pendencias')
      .update({ processado_em: agora, updated_at: agora, ultimo_erro: null }).eq('id', item.id)
      .eq('proxima_tentativa_em', leaseAte).is('processado_em', null)
  }

  async falhar(item: PendenciaStorage, leaseAte: string, proxima: string, erro: string) {
    return this.supabase.from('pedidos_personalizados_storage_pendencias')
      .update({ tentativas: item.tentativas + 1, proxima_tentativa_em: proxima, ultimo_erro: erro, updated_at: new Date().toISOString() })
      .eq('id', item.id).eq('proxima_tentativa_em', leaseAte).is('processado_em', null)
  }
}

export class StorageAnexos {
  constructor(private readonly supabase: SupabaseClient) {}

  async upload(caminho: string, bytes: ArrayBuffer, mimeType: string) {
    const { error } = await this.supabase.storage.from(BUCKET_ANEXOS_PEDIDOS)
      .upload(caminho, bytes, { contentType: mimeType, upsert: false, cacheControl: '3600' })
    return error ? { ok: false as const, error } : { ok: true as const }
  }

  async remover(caminho: string, bucketId = BUCKET_ANEXOS_PEDIDOS) {
    if (bucketId !== BUCKET_ANEXOS_PEDIDOS) {
      return { ok: false as const, error: new Error('BUCKET_INESPERADO') }
    }
    const { data, error } = await this.supabase.storage.from(bucketId).remove([caminho])
    if (!error) return { ok: true as const, inexistente: !data || data.length === 0 }
    const status = Number((error as { status?: number; statusCode?: number | string }).status ?? (error as { statusCode?: number | string }).statusCode)
    if (status === 404 || /not found|not exist/i.test(error.message)) return { ok: true as const, inexistente: true }
    return { ok: false as const, error }
  }

  async urlAssinada(caminho: string) {
    const { data, error } = await this.supabase.storage.from(BUCKET_ANEXOS_PEDIDOS)
      .createSignedUrl(caminho, EXPIRACAO_URL_ASSINADA_SEGUNDOS)
    return error || !data?.signedUrl
      ? { ok: false as const, error: error ?? new Error('URL_ASSINADA_INDISPONIVEL') }
      : { ok: true as const, url: data.signedUrl }
  }
}
