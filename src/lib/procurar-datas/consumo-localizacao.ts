import { createServiceClient } from '@/lib/supabase/service'

export type ProvedorLocalizacao = 'nominatim' | 'google-maps-link' | 'locationiq' | 'google-geocoding' | 'viacep' | 'brasilapi' | 'appsscript-endereco'
export const MENSAGEM_LIMITE_LOCALIZACAO = 'Limite mensal de consultas de localização atingido. Você ainda pode pesquisar utilizando coordenadas do Google Maps.'
export class ErroConsumoLocalizacao extends Error {
  constructor(public motivo: 'limite-mensal' | 'controle-indisponivel') {
    super(motivo === 'limite-mensal' ? MENSAGEM_LIMITE_LOCALIZACAO : 'Consulta complementar indisponível. Você ainda pode pesquisar utilizando coordenadas do Google Maps.')
  }
}
export type ResumoConsumoLocalizacao = {
  mes: string; limite: number; total: number; restantes: number; proximoReinicio: string
  provedores: Array<{ provedor: string; total: number; falhas: number; pendentes: number }>
}
export type ControleConsumo = {
  reservar(provedor: ProvedorLocalizacao, signal?: AbortSignal): Promise<string | null>
  concluir(id: string, sucesso: boolean, http?: number): Promise<void>
}
export const controleConsumoLocalizacao: ControleConsumo = {
  async reservar(provedor, signal) {
    const { data, error } = await createServiceClient().rpc('procurar_datas_reservar_consulta_localizacao', { p_provedor: provedor }).abortSignal(signal ?? AbortSignal.timeout(10000))
    if (error) throw new ErroConsumoLocalizacao('controle-indisponivel')
    return data as string | null
  },
  async concluir(id, sucesso, http) {
    const { error } = await createServiceClient().rpc('procurar_datas_concluir_consulta_localizacao', { p_id: id, p_sucesso: sucesso, p_http_status: http ?? null }).abortSignal(AbortSignal.timeout(3000))
    if (error) console.warn('[procurar-datas:consumo-localizacao]', { etapa: 'conclusao', codigo: error.code })
  },
}
/** Reserva antes do envio. Sem controle persistente, nenhuma nova chamada externa é iniciada. */
export async function fetchLocalizacao(provedor: ProvedorLocalizacao, input: Parameters<typeof fetch>[0], init?: RequestInit,
  deps: { fetchImpl?: typeof fetch; controle?: ControleConsumo } = {}): Promise<Response> {
  const controle = deps.controle ?? controleConsumoLocalizacao
  const signal = init?.signal ?? AbortSignal.timeout(10000)
  if (signal.aborted) throw signal.reason
  let id: string | null
  try { id = await controle.reservar(provedor, signal) } catch { throw new ErroConsumoLocalizacao('controle-indisponivel') }
  if (!id) throw new ErroConsumoLocalizacao('limite-mensal')
  let sucesso = false
  let http: number | undefined
  try {
    const response = await (deps.fetchImpl ?? fetch)(input, { ...init, signal })
    http = response.status
    sucesso = response.ok || provedor === 'google-maps-link' && http >= 300 && http < 400
    if (sucesso && provedor !== 'google-maps-link') {
      // Inclui falhas de leitura/timeout do corpo e erros de API em respostas HTTP 200.
      sucesso = false
      const payload = await response.clone().json()
      sucesso = !payload?.error && !payload?.erro && !payload?.message &&
        (provedor !== 'google-geocoding' || payload?.status === 'OK')
    }
    return response
  } finally {
    // Uma falha na confirmação não libera a reserva nem induz nova chamada.
    try { await controle.concluir(id, sucesso, http) } catch { console.warn('[procurar-datas:consumo-localizacao]', { etapa: 'conclusao-indisponivel', provedor }) }
  }
}
export async function consultarResumoConsumoLocalizacao(): Promise<ResumoConsumoLocalizacao | null> {
  try {
    const { data, error } = await createServiceClient().rpc('procurar_datas_resumo_consultas_localizacao').abortSignal(AbortSignal.timeout(5000))
    return error ? null : data as ResumoConsumoLocalizacao
  } catch { return null }
}
