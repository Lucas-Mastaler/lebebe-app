import { NextRequest, NextResponse } from 'next/server'
import type { EnderecoValidado, ValidarEnderecoRequest } from '@/lib/procurar-datas/contratos'
import { validarPayloadEndereco } from '@/lib/procurar-datas/validar-endereco-payload'
import {
  buscarEnderecoNoGeoCache,
  montarEnderecoDisplayProcurarDatas,
  normalizarTexto,
} from '@/lib/procurar-datas/endereco-cache'
import { montarFormGeoCachePorEnderecoAgenda } from '@/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico'
import { buscarEnderecoLocationIq } from '@/lib/procurar-datas/locationiq'
import { consultarGoogleGeocodingEnderecoDificil } from '@/lib/procurar-datas/google-geocoding'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-table-client-diagnostico'
import { otimizarRotaDeslocamentosPorMatrizOSRM } from '@/lib/procurar-datas/deslocamentos/otimizar-rota-osrm'
import {
  resolverOrigemFixa,
  origemFixaParaEnderecoValidado,
} from '@/lib/procurar-datas/deslocamentos/origens-fixas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StatusItem =
  | 'CACHE_HIT'
  | 'RESOLVIDO_LOCATIONIQ'
  | 'RESOLVIDO_GOOGLE'
  | 'RESOLVIDO_ORIGEM_FIXA'
  | 'CACHE_AMBIGUO'
  | 'REJEITADO'
  | 'FALHA_TEMPORARIA'
  | 'PAYLOAD_INVALIDO'

type StatusGeral = 'VALIDA' | 'PARCIAL' | 'FALHA' | 'FALHA_ORIGEM' | 'FALHA_OSRM'

type EnderecoInput = Partial<ValidarEnderecoRequest>

type AtendimentoInput = {
  id?: string
  eventId?: string
  linha?: number
  titulo?: string
  enderecoOriginal?: string
  endereco?: EnderecoInput
}

type PayloadDeslocamentos = {
  runId?: string
  dataISO?: string
  equipe?: string
  origem?: string | EnderecoInput
  itens?: AtendimentoInput[]
}

type GrupoAtendimento = {
  chave: string
  enderecoOriginal: string
  form: ValidarEnderecoRequest
  referencias: Array<{
    id: string
    eventId?: string
    linha?: number
    titulo?: string
  }>
}

type ItemResolvido = {
  id: string
  enderecoOriginal: string
  enderecoNormalizado: string
  lat?: number
  lng?: number
  display?: string
  provider?: string
  status: StatusItem
  motivo?: string
  eventIds: string[]
  linhas: number[]
  referencias: GrupoAtendimento['referencias']
}

const OSRM_BASE_URL_DEFAULT_DESLOCAMENTOS = 'https://osrm.lebebe.cloud'
const MAX_ITENS_DEFAULT = 25

function erroJson(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

function validarBearer(request: NextRequest): NextResponse | null {
  const token = process.env.APPS_SCRIPT_DESLOCAMENTOS_TOKEN?.trim()
  if (!token) {
    console.error('[DESLOCAMENTOS] APPS_SCRIPT_DESLOCAMENTOS_TOKEN nao configurado')
    return erroJson('deslocamentos_token_nao_configurado', 500)
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${token}`) {
    console.error('[DESLOCAMENTOS] Unauthorized: authorization=' + (authorization ? '[presente]' : '[ausente]'))
    return erroJson('unauthorized', 401)
  }

  return null
}

function normalizarNumeroEstrito(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
}

function cacheTemNumeroEstritoCompativel(form: ValidarEnderecoRequest, resultado: EnderecoValidado): boolean {
  const numeroForm = normalizarNumeroEstrito(form.numero)
  const address = resultado.address as { house_number?: unknown } | undefined
  const numeroCache = normalizarNumeroEstrito(address?.house_number)
  if (!numeroForm || !numeroCache) return false
  return numeroForm === numeroCache
}

function formDeEnderecoInput(input: string | EnderecoInput | undefined): ValidarEnderecoRequest | null {
  if (!input) return null
  if (typeof input === 'string') return montarFormGeoCachePorEnderecoAgenda(input)

  const form: ValidarEnderecoRequest = {
    logradouro: String(input.logradouro ?? '').trim(),
    numero: String(input.numero ?? '').trim(),
    bairro: String(input.bairro ?? '').trim(),
    cidade: String(input.cidade ?? '').trim(),
    uf: String(input.uf ?? '').trim().toUpperCase(),
    cep: String(input.cep ?? '').trim(),
  }
  return validarPayloadEndereco(form) ? null : form
}

function stringOrigem(origem: string | EnderecoInput | undefined): string {
  if (!origem) return ''
  if (typeof origem === 'string') return origem.trim()
  const form: ValidarEnderecoRequest = {
    logradouro: String(origem.logradouro ?? '').trim(),
    numero: String(origem.numero ?? '').trim(),
    bairro: String(origem.bairro ?? '').trim(),
    cidade: String(origem.cidade ?? '').trim(),
    uf: String(origem.uf ?? '').trim().toUpperCase(),
    cep: String(origem.cep ?? '').trim(),
  }
  return montarEnderecoDisplayProcurarDatas(form)
}

function chaveGrupo(form: ValidarEnderecoRequest, enderecoOriginal: string): string {
  return normalizarTexto(montarEnderecoDisplayProcurarDatas(form) || enderecoOriginal)
}

function agruparAtendimentos(itens: AtendimentoInput[]): {
  grupos: GrupoAtendimento[]
  rejeitados: ItemResolvido[]
} {
  const gruposPorChave = new Map<string, GrupoAtendimento>()
  const rejeitados: ItemResolvido[] = []

  itens.forEach((item, indice) => {
    const id = String(item.id ?? item.eventId ?? item.linha ?? `item-${indice + 1}`)
    const enderecoOriginal = String(item.enderecoOriginal ?? '').trim()

    // 1. Verificar local fixo antes de validar payload
    const localFixo = resolverOrigemFixa(enderecoOriginal)
    if (localFixo.ok) {
      const form = montarFormGeoCachePorEnderecoAgenda(enderecoOriginal)
      if (!form) {
        rejeitados.push({
          id,
          enderecoOriginal,
          enderecoNormalizado: normalizarTexto(enderecoOriginal),
          status: 'PAYLOAD_INVALIDO',
          motivo: 'endereco_incompleto',
          eventIds: item.eventId ? [item.eventId] : [],
          linhas: typeof item.linha === 'number' ? [item.linha] : [],
          referencias: [{ id, eventId: item.eventId, linha: item.linha, titulo: item.titulo }],
        })
        return
      }
      const chave = chaveGrupo(form, enderecoOriginal)
      const grupo = gruposPorChave.get(chave) ?? {
        chave,
        enderecoOriginal: enderecoOriginal || montarEnderecoDisplayProcurarDatas(form),
        form,
        referencias: [],
      }
      grupo.referencias.push({ id, eventId: item.eventId, linha: item.linha, titulo: item.titulo })
      gruposPorChave.set(chave, grupo)
      return
    }

    // 2. Se não for local fixo, validar payload
    const form = formDeEnderecoInput(item.endereco ?? enderecoOriginal)
    if (!form) {
      rejeitados.push({
        id,
        enderecoOriginal,
        enderecoNormalizado: normalizarTexto(enderecoOriginal),
        status: 'PAYLOAD_INVALIDO',
        motivo: 'endereco_incompleto',
        eventIds: item.eventId ? [item.eventId] : [],
        linhas: typeof item.linha === 'number' ? [item.linha] : [],
        referencias: [{ id, eventId: item.eventId, linha: item.linha, titulo: item.titulo }],
      })
      return
    }

    const chave = chaveGrupo(form, enderecoOriginal)
    const grupo = gruposPorChave.get(chave) ?? {
      chave,
      enderecoOriginal: enderecoOriginal || montarEnderecoDisplayProcurarDatas(form),
      form,
      referencias: [],
    }
    grupo.referencias.push({ id, eventId: item.eventId, linha: item.linha, titulo: item.titulo })
    gruposPorChave.set(chave, grupo)
  })

  return { grupos: [...gruposPorChave.values()], rejeitados }
}

function resultadoParaItem(
  grupo: GrupoAtendimento,
  resultado: EnderecoValidado,
  status: StatusItem,
  motivo?: string
): ItemResolvido {
  return {
    id: grupo.chave,
    enderecoOriginal: grupo.enderecoOriginal,
    enderecoNormalizado: grupo.chave,
    lat: Number(resultado.lat),
    lng: Number(resultado.lng),
    display: String(resultado.enderecoCompleto ?? resultado.display_name ?? resultado.display ?? grupo.enderecoOriginal),
    provider: String(resultado.provider ?? ''),
    status,
    motivo,
    eventIds: grupo.referencias.map((r) => r.eventId).filter((v): v is string => !!v),
    linhas: grupo.referencias.map((r) => r.linha).filter((v): v is number => typeof v === 'number'),
    referencias: grupo.referencias,
  }
}

async function resolverOrigem(
  origem: string | EnderecoInput | undefined,
  runId: string
): Promise<ItemResolvido> {
  const origemRecebida = stringOrigem(origem)
  console.log(
    `[DESLOCAMENTOS] origem_enviada runId=${runId} origem="${origemRecebida}"`
  )

  const origemFixa = resolverOrigemFixa(origemRecebida)
  if (origemFixa.ok) {
    console.log(
      `[DESLOCAMENTOS] origem_resolvida runId=${runId} estrategia=fixed_known_location label=${origemFixa.label} origemNormalizada="${origemFixa.normalizada}"`
    )
    return {
      id: 'origem',
      enderecoOriginal: origemRecebida,
      enderecoNormalizado: origemFixa.normalizada,
      lat: origemFixa.lat,
      lng: origemFixa.lng,
      display: origemFixa.display,
      provider: origemFixa.estrategia,
      status: 'RESOLVIDO_ORIGEM_FIXA',
      eventIds: [],
      linhas: [],
      referencias: [{ id: 'origem' }],
    }
  }

  const form = formDeEnderecoInput(origem)
  if (!form) {
    console.log(
      `[DESLOCAMENTOS] origem_parse_invalido runId=${runId} origemNormalizada="${origemFixa.normalizada}"`
    )
    return {
      id: 'origem',
      enderecoOriginal: origemRecebida,
      enderecoNormalizado: origemFixa.normalizada,
      status: 'PAYLOAD_INVALIDO',
      motivo: 'origem_incompleta',
      eventIds: [],
      linhas: [],
      referencias: [{ id: 'origem' }],
    }
  }

  const grupo: GrupoAtendimento = {
    chave: 'origem',
    enderecoOriginal: origemRecebida,
    form,
    referencias: [{ id: 'origem' }],
  }

  const resultado = await resolverGrupo(grupo, runId, 'origem_agenda')

  if (!coordenadaValida(resultado)) {
    console.log(
      `[DESLOCAMENTOS] origem_nao_resolvida runId=${runId} motivo=${resultado.motivo ?? resultado.status}`
    )
  }

  return resultado
}

async function resolverGrupo(grupo: GrupoAtendimento, runId: string, finalidade: 'origem_agenda' | 'geocodificacao_endereco'): Promise<ItemResolvido> {
  // 1. Verificar local fixo antes de cache/geocodificadores
  const localFixo = resolverOrigemFixa(grupo.enderecoOriginal)
  if (localFixo.ok) {
    console.log(
      `[DESLOCAMENTOS] item_resolvido runId=${runId} estrategia=fixed_known_location label=${localFixo.label} endereco="${grupo.enderecoOriginal}"`
    )
    return resultadoParaItem(grupo, origemFixaParaEnderecoValidado(localFixo), 'RESOLVIDO_ORIGEM_FIXA')
  }

  const motivosRejeicao: string[] = []

  try {
    const cache = await buscarEnderecoNoGeoCache(grupo.form)
    if (cache.status === 'hit') {
      if (cacheTemNumeroEstritoCompativel(grupo.form, cache.resultado)) {
        return resultadoParaItem(grupo, cache.resultado, 'CACHE_HIT')
      }
      motivosRejeicao.push('cache_numero_estrito_divergente')
    } else if (cache.motivo === 'cache_ambiguo') {
      motivosRejeicao.push('cache_ambiguo')
    } else if (cache.motivo) {
      motivosRejeicao.push(`cache_${cache.motivo}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_cache'
    console.error(`[DESLOCAMENTOS] geo_cache erro runId=${runId} motivo=${message}`)
    motivosRejeicao.push('cache_erro')
  }

  const locationIq = await buscarEnderecoLocationIq(grupo.form, {
    context: {
      origemFluxo: 'procurar_datas',
      finalidade,
      funcaoOrigem: 'deslocamentos_calcular_v1',
      sessaoId: runId,
      proximoFallback: 'google_geocoding',
    },
  })
  if (locationIq.status === 'success') {
    return resultadoParaItem(grupo, locationIq.resultado, 'RESOLVIDO_LOCATIONIQ', motivosRejeicao.join(',') || undefined)
  }
  motivosRejeicao.push(`locationiq_${locationIq.motivo}`)

  const google = await consultarGoogleGeocodingEnderecoDificil(grupo.form, {
    permitirEnderecoComum: true,
  })
  if (google.status === 'success') {
    return resultadoParaItem(grupo, google.resultado, 'RESOLVIDO_GOOGLE', motivosRejeicao.join(',') || undefined)
  }
  motivosRejeicao.push(`google_${google.motivo}`)

  const status: StatusItem = motivosRejeicao.includes('cache_ambiguo') ? 'CACHE_AMBIGUO' : 'REJEITADO'
  return {
    id: grupo.chave,
    enderecoOriginal: grupo.enderecoOriginal,
    enderecoNormalizado: grupo.chave,
    status,
    motivo: motivosRejeicao.join(',') || 'sem_resultado_valido',
    eventIds: grupo.referencias.map((r) => r.eventId).filter((v): v is string => !!v),
    linhas: grupo.referencias.map((r) => r.linha).filter((v): v is number => typeof v === 'number'),
    referencias: grupo.referencias,
  }
}

function resolverOsrmBaseUrl(configUrl: string | undefined): string {
  const valor = String(configUrl ?? '').trim()
  return (valor || OSRM_BASE_URL_DEFAULT_DESLOCAMENTOS).replace(/\/+$/, '')
}

function parseMaxItens(): number {
  const valor = Number(process.env.DESLOCAMENTOS_MAX_ITENS)
  if (!Number.isInteger(valor) || valor < 1) return MAX_ITENS_DEFAULT
  return Math.min(valor, 80)
}

function coordenadaValida(item: ItemResolvido): item is ItemResolvido & { lat: number; lng: number } {
  return Number.isFinite(item.lat) && Number.isFinite(item.lng)
}

function statusGeral(resolvidos: ItemResolvido[], aproveitados: ItemResolvido[], osrmOk: boolean): StatusGeral {
  if (!osrmOk) return 'FALHA_OSRM'
  if (aproveitados.length === 0) return 'FALHA'
  if (aproveitados.length < resolvidos.length) return 'PARCIAL'
  return 'VALIDA'
}

export async function POST(request: NextRequest) {
  const erroAuth = validarBearer(request)
  if (erroAuth) return erroAuth

  let body: PayloadDeslocamentos
  try {
    body = (await request.json()) as PayloadDeslocamentos
  } catch {
    return erroJson('payload_json_invalido', 400)
  }

  const runId = String(body.runId ?? request.headers.get('x-lebebe-run-id') ?? `desloc-${Date.now()}`)
  const itens = Array.isArray(body.itens) ? body.itens : []
  const maxItens = parseMaxItens()
  if (itens.length > maxItens) return erroJson('limite_itens_excedido', 400)

  const origem = await resolverOrigem(body.origem, runId)
  if (!coordenadaValida(origem)) {
    return NextResponse.json({
      ok: true,
      status: 'FALHA_ORIGEM' satisfies StatusGeral,
      runId,
      motivo: origem.motivo ?? origem.status,
      origemRecebida: stringOrigem(body.origem),
      tentativas: ['fixed_known_location', 'geo_cache', 'locationiq', 'google'],
      origem,
      itens: [],
      rota: null,
    })
  }

  const { grupos, rejeitados } = agruparAtendimentos(itens)
  const resolvidos = [...(await Promise.all(grupos.map((grupo) => resolverGrupo(grupo, runId, 'geocodificacao_endereco')))), ...rejeitados]
  const aproveitados = resolvidos.filter(coordenadaValida)

  if (aproveitados.length === 0) {
    return NextResponse.json({
      ok: true,
      status: 'FALHA' satisfies StatusGeral,
      runId,
      motivo: 'nenhum_item_utilizavel',
      origem,
      itens: resolvidos,
      rota: null,
    }, { status: 422 })
  }

  const configs = await buscarConfiguracoesProcurarDatas()
  const osrmBaseUrl = resolverOsrmBaseUrl(configs.ok ? configs.config.osrmBaseUrl : undefined)
  const buscarMatriz = criarBuscarMatrizOSRMTableDiagnosticoV2({
    baseUrl: osrmBaseUrl,
    timeoutMs: Number(process.env.DESLOCAMENTOS_OSRM_TIMEOUT_MS) || 10000,
    annotations: 'distance,duration',
  })

  try {
    const matriz = await buscarMatriz([
      { lat: origem.lat, lng: origem.lng },
      ...aproveitados.map((item) => ({ lat: item.lat, lng: item.lng })),
    ])
    const rota = otimizarRotaDeslocamentosPorMatrizOSRM({
      distances: matriz.distances,
      durations: matriz.durations,
      quantidadeParadas: aproveitados.length,
    })
    if (!rota.ok) {
      return NextResponse.json({
        ok: true,
        status: 'FALHA_OSRM' satisfies StatusGeral,
        runId,
        motivo: rota.erro,
        origem,
        itens: resolvidos,
        rota: null,
        avisos: rota.avisos,
      })
    }

    const ordem = rota.ordemParadas.map((indice) => aproveitados[indice])
    return NextResponse.json({
      ok: true,
      status: statusGeral(resolvidos, aproveitados, true),
      runId,
      dataISO: body.dataISO ?? null,
      equipe: body.equipe ?? null,
      origem,
      itens: resolvidos,
      rota: {
        distanciaTotalKm: rota.distanciaTotalM / 1000,
        distanciaTotalM: rota.distanciaTotalM,
        duracaoTotalSegundos: rota.duracaoTotalSegundos,
        ordem: ordem.map((item, indice) => ({
          indice: indice + 1,
          id: item.id,
          enderecoOriginal: item.enderecoOriginal,
          display: item.display,
          lat: item.lat,
          lng: item.lng,
          provider: item.provider,
          eventIds: item.eventIds,
          linhas: item.linhas,
          referencias: item.referencias,
        })),
      },
      diagnostico: {
        totalEventos: itens.length,
        totalEnderecosUnicos: grupos.length,
        totalAproveitados: aproveitados.length,
        totalRejeitados: resolvidos.length - aproveitados.length,
        osrmBaseUrl,
        configOrigem: configs.ok ? configs.origem : 'erro',
      },
      avisos: rota.avisos,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_osrm'
    console.error(`[DESLOCAMENTOS] OSRM falhou runId=${runId} motivo=${message}`)
    return NextResponse.json({
      ok: true,
      status: 'FALHA_OSRM' satisfies StatusGeral,
      runId,
      motivo: 'osrm_indisponivel',
      origem,
      itens: resolvidos,
      rota: null,
    })
  }
}
