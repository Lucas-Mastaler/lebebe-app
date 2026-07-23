import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { buscarEnderecoNoGeoCache } from '@/lib/procurar-datas/endereco-cache'
import { normalizarEntradaPesquisaV2 } from '@/lib/procurar-datas/motor/entrada'
import { haversineKm, type Coordenada } from '@/lib/procurar-datas/motor/distancia'
import { gerarJanelaDatasPesquisaV2 } from '@/lib/procurar-datas/motor/janela-datas'
import { buscarAgendaRealDiagnosticaComDados } from '@/lib/procurar-datas/motor/agenda-real-helper'
import { buscarDisponibilidadeRealDiagnosticaComDados } from '@/lib/procurar-datas/motor/disponibilidade-real-helper'
import {
  montarFormGeoCachePorEnderecoAgenda,
  resolverCacheCoordenadasAgendaDiagnostico,
} from '@/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico'
import {
  extrairEnderecoAgendaShAgV2,
  normalizarChaveEnderecoAgendaV2,
  type LinhaAgendaShAgV2,
  type PontoAgendaDescartadoV2,
} from '@/lib/procurar-datas/motor/parse-agenda-shag'
import {
  calcularMapaKmAdicionalPorSlotControladoV2,
  type DetalheSlotMapaKmAdicional,
  type SlotInputMapaKmAdicional,
} from '@/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot'
import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-table-client-diagnostico'
import { gerarCandidatosComDisponibilidadeRealV2 } from '@/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real'
import { recortarCandidatosLegadoEquivalente } from '@/lib/procurar-datas/motor/recortar-candidatos-legado-equivalente'
import { normalizarEquipe } from '@/lib/procurar-datas/motor/equipe'

export const runtime = 'nodejs'
export const maxDuration = 60

type JsonRecord = Record<string, unknown>

type PesquisaAuditoriaRow = {
  id: string
  created_at: string | null
  usuario_id: string | null
  usuario_email: string | null
  client_token: string | null
  run_id: string | null
  motor_versao: string | null
  origem: string | null
  cep: string | null
  numero_residencia: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  endereco_completo: string | null
  latitude: number | string | null
  longitude: number | string | null
  parametros_json: unknown
  resultados_json: unknown
  status: string | null
  erro_mensagem: string | null
  duracao_ms: number | null
  started_at: string | null
  finished_at: string | null
}

type ResultadoSalvoNormalizado = {
  dataISO: string | null
  equipe: string | null
  tipo: string | null
  frete: string | null
  faltam: string | null
  encomenda: string | null
  rank: number | null
  raw: unknown
}

type EnderecoSemCoordenadasAuditoria = {
  slotKey: string | null
  dataISO: string | null
  equipe: string | null
  titulo: string | null
  endereco: string | null
  motivo: string
  chaveNormalizada: string | null
  indiceLinhaOriginal: number | null
  descricao: string | null
}

type FiltroEarlyAuditoria = {
  aplicado: boolean
  descartado: boolean
  tipoFiltroEarly: string
  distanciaHaversineKm: number | null
  limiteHaversineKm: number | null
  distanciaAncoraKm: number | null
  limiteAncoraPremiumKm: number | null
  origemUsada: {
    tipo: 'ponto-agenda' | 'indisponivel'
    endereco: string | null
    titulo: string | null
    cep: string | null
    lat: number | null
    lng: number | null
  }
  destinoUsado: {
    lat: number
    lng: number
    descricao: string | null
  } | null
  osrmPuladoPeloFiltroLegado: boolean
  osrmMatrizExecutadaNaAuditoria: boolean
  deltaInsercaoCalculado: boolean
  motivoTextual: string
}

type SnapshotTecnicoCandidatoSalvo = {
  slotKey: string
  dataISO: string
  equipe: string
  elegivel: boolean
  tipoOriginal: string
  motivos: string[]
  slotAvailMin: number | null
  serviceMin: number | null
  kmAdicionalNaRotaM: number | null
  origemKmAdicionalNaRotaM: string | null
  filtroEarly: unknown
  slotTemPontos: boolean | null
  consistenciaEspacial: unknown
}

type SnapshotTecnicoSalvo = {
  candidatosFinais: SnapshotTecnicoCandidatoSalvo[]
  slotsBloqueados: unknown[]
  contadoresMapaKm: {
    slotsRecebidos: number
    slotsProcessados: number
    slotsComKm: number
    slotsComFallbackHaversine: number
    slotsComErro: number
    slotsDescartados: number
    slotsBloqueadosInconsistenciaEspacial: number
  } | null
  estadoResultado: string | null
  consistenciaEspacial: unknown
  coberturaFontes: unknown
  fonteAgenda: string | null
  fonteDisponibilidade: string | null
}

type RecalculoConclusivo = {
  conclusivo: boolean
  motivos: string[]
}

type DivergenciaSnapshot = {
  slotKey: string | null
  tipo: string
  detalhe: string
  severidade: 'forte' | 'aviso'
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function dataISODeResultado(resultado: JsonRecord): string | null {
  const date = asString(resultado.date)
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const dateISO = asString(resultado.dateISO)
  return dateISO ? dateISO.slice(0, 10) : null
}

function normalizarResultadosSalvos(value: unknown): ResultadoSalvoNormalizado[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = isRecord(item) ? item : {}
    const rank = asNumber(row.rank)
    return {
      dataISO: dataISODeResultado(row),
      equipe: asString(row.team) ?? asString(row.equipe),
      tipo: asString(row.tipo),
      frete: asString(row.frete),
      faltam: asString(row.daysLeftTxt) ?? asString(row.faltam),
      encomenda: asString(row.encomenda),
      rank: rank === null ? null : rank,
      raw: item,
    }
  })
}

function extrairSnapshotTecnico(parametros: JsonRecord): SnapshotTecnicoSalvo | null {
  const raw = parametros.snapshotTecnico
  if (!isRecord(raw)) return null
  const candidatosRaw = (raw as JsonRecord).candidatosFinais
  if (!Array.isArray(candidatosRaw)) return null
  const candidatosFinais: SnapshotTecnicoCandidatoSalvo[] = candidatosRaw
    .map((item) => {
      const r = isRecord(item) ? item : {}
      return {
        slotKey: asString(r.slotKey) ?? '',
        dataISO: asString(r.dataISO) ?? '',
        equipe: asString(r.equipe) ?? '',
        elegivel: typeof r.elegivel === 'boolean' ? r.elegivel : false,
        tipoOriginal: asString(r.tipoOriginal) ?? '',
        motivos: Array.isArray(r.motivos) ? r.motivos.filter((m): m is string => typeof m === 'string') : [],
        slotAvailMin: asNumber(r.slotAvailMin),
        serviceMin: asNumber(r.serviceMin),
        kmAdicionalNaRotaM: asNumber(r.kmAdicionalNaRotaM),
        origemKmAdicionalNaRotaM: asString(r.origemKmAdicionalNaRotaM),
        filtroEarly: r.filtroEarly ?? null,
        slotTemPontos: typeof r.slotTemPontos === 'boolean' ? r.slotTemPontos : null,
        consistenciaEspacial: r.consistenciaEspacial ?? null,
      }
    })
    .filter((c) => c.slotKey && c.dataISO)
  const slotsBloqueadosRaw = (raw as JsonRecord).slotsBloqueados
  const slotsBloqueados = Array.isArray(slotsBloqueadosRaw) ? slotsBloqueadosRaw : []
  if (candidatosFinais.length === 0 && slotsBloqueados.length === 0) return null
  const contadoresRaw = (raw as JsonRecord).contadoresMapaKm
  return {
    candidatosFinais,
    slotsBloqueados,
    contadoresMapaKm: isRecord(contadoresRaw)
      ? {
          slotsRecebidos: asNumber(contadoresRaw.slotsRecebidos) ?? 0,
          slotsProcessados: asNumber(contadoresRaw.slotsProcessados) ?? 0,
          slotsComKm: asNumber(contadoresRaw.slotsComKm) ?? 0,
          slotsComFallbackHaversine: asNumber(contadoresRaw.slotsComFallbackHaversine) ?? 0,
          slotsComErro: asNumber(contadoresRaw.slotsComErro) ?? 0,
          slotsDescartados: asNumber(contadoresRaw.slotsDescartados) ?? 0,
          slotsBloqueadosInconsistenciaEspacial:
            asNumber(contadoresRaw.slotsBloqueadosInconsistenciaEspacial) ?? 0,
        }
      : null,
    estadoResultado: asString((raw as JsonRecord).estadoResultado),
    consistenciaEspacial: (raw as JsonRecord).consistenciaEspacial ?? null,
    coberturaFontes: (raw as JsonRecord).coberturaFontes ?? null,
    fonteAgenda: asString((raw as JsonRecord).fonteAgenda),
    fonteDisponibilidade: asString((raw as JsonRecord).fonteDisponibilidade),
  }
}

function avaliarRecalculoConclusivo(input: {
  diagnosticoReal: Awaited<ReturnType<typeof montarDiagnosticoReal>>
  snapshotTecnico: SnapshotTecnicoSalvo | null
}): RecalculoConclusivo {
  const motivos: string[] = []
  const dr = input.diagnosticoReal

  if (!dr.disponivel) {
    motivos.push(`Diagnostico real indisponivel: ${dr.motivoFalhaDiagnosticoReal ?? 'motivo nao informado'}`)
    return { conclusivo: false, motivos }
  }

  const totalLinhasAgenda = dr.totalLinhasAgendaLidas ?? 0
  if (totalLinhasAgenda === 0) {
    motivos.push('Agenda real lida com 0 linhas — recálculo não conclusivo.')
  }

  const totalCandidatos = dr.totalCandidatosReais ?? 0
  if (totalCandidatos === 0) {
    motivos.push('Nenhum candidato real gerado no recálculo — recálculo não conclusivo.')
  }

  const slots = Array.isArray(dr.slots) ? dr.slots : []
  const slotsSemPontos = slots.filter((s: { slotTemPontos?: boolean | null }) => s.slotTemPontos === false)
  if (slots.length > 0 && slotsSemPontos.length === slots.length) {
    motivos.push('Todos os slots do recálculo estão sem pontos de agenda — recálculo não conclusivo.')
  }

  const insercaoCompleta = dr.insercaoRealCompleta
  if (insercaoCompleta === false) {
    const interrompidos = (dr.slotsInterrompidosPorFiltroEarly ?? []).length
    if (interrompidos > 0 && interrompidos === slots.length) {
      motivos.push('Todos os slots do recálculo foram interrompidos por filtro early — recálculo pode não ser conclusivo para tipo/distância.')
    }
  }

  if (input.snapshotTecnico) {
    const snapContadores = input.snapshotTecnico.contadoresMapaKm
    if (snapContadores && snapContadores.slotsComKm > 0 && totalCandidatos === 0) {
      motivos.push('Snapshot da produção tinha slots com km calculado, mas o recálculo atual gerou 0 candidatos — divergência provavelmente por dados de agenda desatualizados.')
    }
  }

  return { conclusivo: motivos.length === 0, motivos }
}

function compararSalvoComSnapshot(
  resultadosSalvos: ResultadoSalvoNormalizado[],
  snapshot: SnapshotTecnicoSalvo
): DivergenciaSnapshot[] {
  const divergencias: DivergenciaSnapshot[] = []
  const snapPorChave = new Map<string, SnapshotTecnicoCandidatoSalvo>()
  for (const snap of snapshot.candidatosFinais) {
    if (snap.slotKey) snapPorChave.set(snap.slotKey, snap)
  }

  for (const resultado of resultadosSalvos) {
    const key = slotKey(resultado.dataISO, resultado.equipe)
    if (!key) continue
    const snap = snapPorChave.get(key)
    if (!snap) {
      divergencias.push({
        slotKey: key,
        tipo: 'resultado-salvo-sem-snapshot',
        detalhe: 'Resultado salvo não encontrado no snapshot técnico da produção.',
        severidade: 'aviso',
      })
      continue
    }
    if (resultado.tipo && snap.tipoOriginal && resultado.tipo !== snap.tipoOriginal) {
      divergencias.push({
        slotKey: key,
        tipo: 'tipo-divergente-snapshot',
        detalhe: `Resultado salvo tipo=${resultado.tipo}; snapshot da produção tipo=${snap.tipoOriginal}.`,
        severidade: 'forte',
      })
    }
    if (!snap.elegivel) {
      divergencias.push({
        slotKey: key,
        tipo: 'snapshot-marca-nao-elegivel',
        detalhe: `Snapshot da produção marca slot como não elegível: ${(snap.motivos ?? []).join('; ') || 'motivo não informado'}.`,
        severidade: 'forte',
      })
    }
  }

  const salvosChaves = new Set(resultadosSalvos.map((r) => slotKey(r.dataISO, r.equipe)).filter(Boolean))
  for (const snap of snapshot.candidatosFinais) {
    if (snap.elegivel && snap.slotKey && !salvosChaves.has(snap.slotKey)) {
      divergencias.push({
        slotKey: snap.slotKey,
        tipo: 'snapshot-elegivel-nao-salvo',
        detalhe: `Snapshot da produção marca slot como elegível (${snap.tipoOriginal}), mas não está nos resultados salvos.`,
        severidade: 'aviso',
      })
    }
  }

  return divergencias
}

function normalizarOsrmBaseUrl(url: string | null | undefined): string {
  return String(url || '').trim().replace(/\/+$/, '') || 'https://osrm.lebebe.cloud'
}

function slotKey(dataISO: string | null, equipe: string | null): string | null {
  if (!dataISO || !equipe) return null
  const equipeNormalizada = normalizarEquipe(equipe)
  return equipeNormalizada ? `${dataISO}::${equipeNormalizada}` : null
}

function dataISODeAgendaRaw(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const texto = asString(value)
  if (!texto) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!br) return null
  return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
}

async function enriquecerCacheAgendaComGeoCacheSeguro(input: {
  linhasAgenda: LinhaAgendaShAgV2[]
  slotsAlvo: Map<string, { dataISO: string; equipe: string }>
  cacheCoordenadasPorEndereco: Record<string, { lat: number; lng: number }>
}) {
  const avisos: string[] = []
  let tentativas = 0
  let hits = 0
  let misses = 0
  let semPayloadEstruturado = 0
  const enderecosTentados = new Set<string>()

  for (const linha of input.linhasAgenda) {
    if (!Array.isArray(linha)) continue
    const dataISO = dataISODeAgendaRaw(linha[0])
    const equipe = normalizarEquipe(linha[6])
    const key = slotKey(dataISO, equipe)
    if (!key || !input.slotsAlvo.has(key)) continue

    const extracao = extrairEnderecoAgendaShAgV2(linha)
    if (!extracao) continue

    const chaveCache = normalizarChaveEnderecoAgendaV2(extracao.endereco)
    if (input.cacheCoordenadasPorEndereco[chaveCache]) continue
    if (enderecosTentados.has(chaveCache)) continue
    enderecosTentados.add(chaveCache)

    const form = montarFormGeoCachePorEnderecoAgenda(extracao.endereco)
    if (!form) {
      semPayloadEstruturado++
      continue
    }

    tentativas++
    const cache = await buscarEnderecoNoGeoCache(form)
    if (cache.status === 'hit') {
      const lat = cache.resultado.lat
      const lng = cache.resultado.lng
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        misses++
        continue
      }
      input.cacheCoordenadasPorEndereco[chaveCache] = {
        lat,
        lng,
      }
      hits++
    } else {
      misses++
    }
  }

  if (hits > 0) {
    avisos.push(`Auditoria: geo_cache seguro por campos resolveu ${hits}/${tentativas} endereco(s) de agenda sem coordenadas.`)
  }
  if (misses > 0) {
    avisos.push(`Auditoria: geo_cache seguro por campos nao encontrou match para ${misses} endereco(s) de agenda.`)
  }
  if (semPayloadEstruturado > 0) {
    avisos.push(`Auditoria: ${semPayloadEstruturado} endereco(s) de agenda sem payload estruturado suficiente para lookup seguro no geo_cache.`)
  }

  return { tentativas, hits, misses, semPayloadEstruturado, avisos }
}

function montarPayloadDaPesquisa(row: PesquisaAuditoriaRow, parametros: JsonRecord): PesquisarDatasRequest {
  const lat = asNumber(row.latitude)
  const lng = asNumber(row.longitude)
  return {
    cep: row.cep ?? undefined,
    numero: row.numero_residencia ?? undefined,
    logradouro: row.logradouro ?? undefined,
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    uf: row.uf ?? undefined,
    enderecoCompleto: row.endereco_completo ?? undefined,
    lat,
    lng,
    destLat: lat,
    destLng: lng,
    dataInicial: asString(parametros.dataInicial) ?? undefined,
    isRural: asBoolean(parametros.areaRural),
    isCondominio: asBoolean(parametros.condominio),
    isEncomenda: asBoolean(parametros.encomenda),
    tipoBerco: asString(parametros.bercoCama) ?? undefined,
    comoda: asString(parametros.comoda) ?? undefined,
    roupeiro: asString(parametros.roupeiro) ?? undefined,
    poltrona: asString(parametros.poltrona) ?? undefined,
    painel: asString(parametros.painel) ?? undefined,
    tempoNecessario: asString(parametros.tempoNecessario) ?? undefined,
    valorInicialMinimo: asNumber(parametros.valorInicialMinimo) ?? undefined,
  }
}

async function buscarPesquisa(runIdOuPesquisaId: string): Promise<PesquisaAuditoriaRow | null> {
  const supabase = createServiceClient()
  const select =
    'id, created_at, usuario_id, usuario_email, client_token, run_id, motor_versao, origem, cep, numero_residencia, logradouro, bairro, cidade, uf, endereco_completo, latitude, longitude, parametros_json, resultados_json, status, erro_mensagem, duracao_ms, started_at, finished_at'

  if (isUuid(runIdOuPesquisaId)) {
    const { data, error } = await supabase
      .from('procurar_datas_pesquisas_auditoria')
      .select(select)
      .eq('id', runIdOuPesquisaId)
      .maybeSingle()
    if (error) throw error
    if (data) return data as PesquisaAuditoriaRow
  }

  const { data: porRunId, error: erroRunId } = await supabase
    .from('procurar_datas_pesquisas_auditoria')
    .select(select)
    .eq('run_id', runIdOuPesquisaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroRunId) throw erroRunId
  if (porRunId) return porRunId as PesquisaAuditoriaRow

  const { data: porClientToken, error: erroClientToken } = await supabase
    .from('procurar_datas_pesquisas_auditoria')
    .select(select)
    .eq('client_token', runIdOuPesquisaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroClientToken) throw erroClientToken
  return (porClientToken as PesquisaAuditoriaRow | null) ?? null
}

function resumirDetalheSlot(detalhe: DetalheSlotMapaKmAdicional | undefined) {
  if (!detalhe) return null
  return {
    ok: detalhe.ok,
    origemKmAdicionalNaRotaM: detalhe.origemKmAdicionalNaRotaM,
    pontosRotaBase: detalhe.deltaInsercao?.pontosRotaBase?.length ?? detalhe.parseAgenda?.resumo.pontosValidos ?? null,
    candidatosInsercao: detalhe.deltaInsercao?.candidatosInsercao?.length ?? null,
    melhorInsercao: detalhe.deltaInsercao?.melhorInsercao ?? null,
    parseAgenda: detalhe.parseAgenda?.resumo ?? null,
    avisos: detalhe.avisos,
    erros: detalhe.erros,
    descartados: detalhe.descartados,
    filtroEarlyLegado: detalhe.filtroEarlyLegado ?? null,
  }
}

function arredondarKm(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(3)) : null
}

function montarFiltroEarlyAuditoria(input: {
  detalhe: DetalheSlotMapaKmAdicional | undefined
  destino: (Coordenada & { descricao?: string }) | null
}): FiltroEarlyAuditoria | null {
  const filtro = input.detalhe?.filtroEarlyLegado
  if (!filtro) return null

  const pontos = input.detalhe?.parseAgenda?.pontos ?? []
  let pontoMaisProximo: (typeof pontos)[number] | null = null
  let menorDistanciaKm = Infinity
  if (input.destino) {
    for (const ponto of pontos) {
      const dist = haversineKm(ponto.coordenadas, input.destino)
      if (dist < menorDistanciaKm) {
        menorDistanciaKm = dist
        pontoMaisProximo = ponto
      }
    }
  }

  const origemEndereco = pontoMaisProximo?.endereco ?? filtro.ancoraEndereco ?? null
  const origemTitulo = pontoMaisProximo?.tituloEvento ?? filtro.ancoraTitulo ?? null
  const distanciaHaversineKm = arredondarKm(filtro.nearestStraightKm)
  const limiteHaversineKm = arredondarKm(filtro.limiteHaversineKm)
  const distanciaAncoraKm = arredondarKm(filtro.ancoraDistanciaKm)
  const limiteAncoraPremiumKm = arredondarKm(filtro.limiteAncoraPremiumKm)

  let motivoTextual = `Filtro early legado avaliado: ${filtro.motivo}.`
  if (filtro.descartado && filtro.motivo === 'haversine-reta') {
    motivoTextual =
      `Menor distancia Haversine ponto da agenda -> destino (${distanciaHaversineKm ?? '?'} km) ` +
      `excedeu o limite (${limiteHaversineKm ?? '?'} km). No legado, este filtro descarta o slot antes do delta de insercao.`
  } else if (filtro.descartado && filtro.motivo === 'ancora-osrm-premium') {
    motivoTextual =
      `Distancia OSRM da ancora -> destino (${distanciaAncoraKm ?? '?'} km) excedeu o limite premium ` +
      `(${limiteAncoraPremiumKm ?? '?'} km). No legado, este filtro descarta o slot antes do delta de insercao.`
  } else if (filtro.motivo === 'passou') {
    motivoTextual = 'Filtro early legado avaliado e aprovado; delta de insercao pode ser calculado.'
  }

  return {
    aplicado: filtro.aplicado,
    descartado: filtro.descartado,
    tipoFiltroEarly: filtro.motivo,
    distanciaHaversineKm,
    limiteHaversineKm,
    distanciaAncoraKm,
    limiteAncoraPremiumKm,
    origemUsada: {
      tipo: origemEndereco ? 'ponto-agenda' : 'indisponivel',
      endereco: origemEndereco,
      titulo: origemTitulo,
      cep: pontoMaisProximo?.cep ?? filtro.ancoraCep ?? null,
      lat: pontoMaisProximo?.coordenadas.lat ?? null,
      lng: pontoMaisProximo?.coordenadas.lng ?? null,
    },
    destinoUsado: input.destino
      ? {
          lat: input.destino.lat,
          lng: input.destino.lng,
          descricao: input.destino.descricao ?? null,
        }
      : null,
    osrmPuladoPeloFiltroLegado: filtro.descartado && filtro.motivo === 'haversine-reta',
    osrmMatrizExecutadaNaAuditoria: Boolean(input.detalhe?.matrizOSRM),
    deltaInsercaoCalculado: Boolean(input.detalhe?.deltaInsercao),
    motivoTextual,
  }
}

function extrairEnderecosSemCoordenadasSlot(input: {
  slotKey: string | null
  dataISO: string | null
  equipe: string | null
  detalhe: DetalheSlotMapaKmAdicional | undefined
}): EnderecoSemCoordenadasAuditoria[] {
  const descartados = input.detalhe?.parseAgenda?.descartados ?? []
  return descartados
    .filter((descarte): descarte is PontoAgendaDescartadoV2 => descarte?.motivo === 'sem_coordenadas_cache')
    .map((descarte) => {
      const endereco = asString(descarte.dadosBrutos.endereco)
      return {
        slotKey: input.slotKey,
        dataISO: input.dataISO,
        equipe: input.equipe,
        titulo: asString(descarte.dadosBrutos.titulo),
        endereco,
        motivo: descarte.motivo,
        chaveNormalizada: endereco ? normalizarChaveEnderecoAgendaV2(endereco) : null,
        indiceLinhaOriginal: Number.isFinite(descarte.indiceLinhaOriginal) ? descarte.indiceLinhaOriginal : null,
        descricao: asString(descarte.descricao),
      }
    })
}

async function montarDiagnosticoReal(input: {
  pesquisa: PesquisaAuditoriaRow
  payload: PesquisarDatasRequest
  resultadosSalvos: ResultadoSalvoNormalizado[]
}) {
  const entradaNormalizada = normalizarEntradaPesquisaV2(input.payload)
  const avisos: string[] = []
  const limitacoesHistoricas = [
    'A auditoria historica salva parametros, resultados finais e snapshot técnico dos candidatos (campos técnicos por slot, capturados antes do adapter).',
    'Este diagnostico recalcula com dados reais atuais do Google Sheets; divergencias podem refletir mudancas posteriores na planilha.',
    'Quando o snapshot técnico está disponível, a comparação resultado salvo x snapshot da produção deve ser usada como referência principal.',
    'Blocos sinteticos nao sao usados como conclusao nesta rota.',
  ]

  const configResult = await buscarConfiguracoesProcurarDatas()
  if (!configResult.ok) {
    return {
      disponivel: false,
      motivoFalhaDiagnosticoReal: `Config operacional nao carregada: ${configResult.erro}`,
      agendaReal: { ok: false, erro: 'nao executada' },
      disponibilidadeReal: { ok: false, erro: 'nao executada' },
      slots: [],
      candidatosReaisTotal: null,
      avisos,
      limitacoesHistoricas,
    }
  }

  if (!entradaNormalizada.dataInicialISO || !entradaNormalizada.coordenadasDestino || entradaNormalizada.tempoNecessarioMin === null) {
    return {
      disponivel: false,
      motivoFalhaDiagnosticoReal: `Entrada salva insuficiente para recalculo: ${entradaNormalizada.avisos.join('; ')}`,
      agendaReal: { ok: false, erro: 'nao executada' },
      disponibilidadeReal: { ok: false, erro: 'nao executada' },
      slots: [],
      candidatosReaisTotal: null,
      avisos: entradaNormalizada.avisos,
      limitacoesHistoricas,
    }
  }

  const janela = gerarJanelaDatasPesquisaV2({
    dataInicialISO: entradaNormalizada.dataInicialISO,
    diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
  })
  avisos.push(...janela.avisos)
  if (!janela.ok) {
    return {
      disponivel: false,
      motivoFalhaDiagnosticoReal: 'Janela de datas nao foi gerada com sucesso.',
      agendaReal: { ok: false, erro: 'nao executada' },
      disponibilidadeReal: { ok: false, erro: 'nao executada' },
      slots: [],
      candidatosReaisTotal: null,
      avisos,
      limitacoesHistoricas,
    }
  }

  const [agendaReal, disponibilidadeReal] = await Promise.all([
    buscarAgendaRealDiagnosticaComDados(2000),
    buscarDisponibilidadeRealDiagnosticaComDados(entradaNormalizada.dataInicialISO, 200, 20, 'entrada'),
  ])

  const agendaOk = agendaReal.diagnostico.ok === true
  const disponibilidadeOk = disponibilidadeReal.diagnostico.ok === true
  if (!agendaOk || !disponibilidadeOk) {
    return {
      disponivel: false,
      motivoFalhaDiagnosticoReal: [
        agendaOk ? null : `Agenda real falhou: ${'erro' in agendaReal.diagnostico ? agendaReal.diagnostico.erro : 'erro nao informado'}`,
        disponibilidadeOk ? null : `Disponibilidade real falhou: ${'erro' in disponibilidadeReal.diagnostico ? disponibilidadeReal.diagnostico.erro : 'erro nao informado'}`,
      ].filter(Boolean).join('; '),
      agendaReal: agendaReal.diagnostico,
      disponibilidadeReal: disponibilidadeReal.diagnostico,
      slots: [],
      candidatosReaisTotal: null,
      avisos,
      limitacoesHistoricas,
    }
  }

  const cacheAgenda = await resolverCacheCoordenadasAgendaDiagnostico({
    linhasAgenda: agendaReal.linhasAgenda,
    supabaseTable: configResult.config.supabaseTable,
  })
  avisos.push(...cacheAgenda.avisos)

  const slotsAlvoMap = new Map<string, { dataISO: string; equipe: string }>()
  for (const resultado of input.resultadosSalvos) {
    const key = slotKey(resultado.dataISO, resultado.equipe)
    if (key && resultado.dataISO && resultado.equipe) {
      slotsAlvoMap.set(key, { dataISO: resultado.dataISO, equipe: resultado.equipe })
    }
  }
  const cacheSeguroAgenda = await enriquecerCacheAgendaComGeoCacheSeguro({
    linhasAgenda: agendaReal.linhasAgenda,
    slotsAlvo: slotsAlvoMap,
    cacheCoordenadasPorEndereco: cacheAgenda.cacheCoordenadasPorEndereco,
  })
  avisos.push(...cacheSeguroAgenda.avisos)

  const slotsAlvo: SlotInputMapaKmAdicional[] = Array.from(slotsAlvoMap.values()).map((slot) => ({
    dataISO: slot.dataISO,
    equipe: slot.equipe,
    linhasAgenda: agendaReal.linhasAgenda,
    cacheCoordenadasPorEndereco: cacheAgenda.cacheCoordenadasPorEndereco,
  }))

  const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
    baseUrl: normalizarOsrmBaseUrl(configResult.config.osrmBaseUrl),
    timeoutMs: 5000,
  })

  const mapaPorSlot = await calcularMapaKmAdicionalPorSlotControladoV2({
    slots: slotsAlvo,
    destino: {
      lat: entradaNormalizada.coordenadasDestino.lat,
      lng: entradaNormalizada.coordenadasDestino.lng,
      descricao: entradaNormalizada.enderecoCompleto ?? input.payload.destDisplay,
    },
    configOrigem: {
      latDeposito: configResult.config.latDeposito,
      lngDeposito: configResult.config.lngDeposito,
      latCasaE1: configResult.config.latCasaE1,
      lngCasaE1: configResult.config.lngCasaE1,
      latCasaE2: configResult.config.latCasaE2,
      lngCasaE2: configResult.config.lngCasaE2,
    },
    configFiltroEarlyLegado: {
      kmMaxEntrePontosKm: configResult.config.kmMaxEntrePontosKm,
      kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
    },
    buscarMatrizOSRM,
    incluirDetalhesInsercao: true,
  })
  avisos.push(...mapaPorSlot.avisos, ...mapaPorSlot.erros)

  const slotTemPontosPorDataEquipe: Record<string, boolean> = {}
  for (const detalhe of mapaPorSlot.detalhesPorSlot) {
    slotTemPontosPorDataEquipe[detalhe.chave] = (detalhe.parseAgenda?.resumo.pontosValidos ?? 0) > 0
  }

  const candidatos = gerarCandidatosComDisponibilidadeRealV2({
    janelaDatas: janela.datas,
    disponibilidades: disponibilidadeReal.disponibilidades,
    tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
    distanciaKm: null,
    kmAdicionalNaRotaM: null,
    valorFrete: null,
    tipoFrete: null,
    isCondominio: entradaNormalizada.isCondominio,
    isRural: entradaNormalizada.isRural,
    slotTemPontosPorDataEquipe,
    mapaKmAdicionalPorSlot: mapaPorSlot.mapa,
    configOperacional: {
      kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
      kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
      kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
      kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
      kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
      horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
    },
  })
  avisos.push(
    ...candidatos.avisos.filter(
      (aviso) =>
        !aviso.includes('distanciaKm n') &&
        !aviso.includes('kmAdicionalNaRotaM n')
    )
  )

  const recorte = recortarCandidatosLegadoEquivalente({
    candidatos: candidatos.candidatosOrdenados,
    maxNormais: 3,
  })
  avisos.push(...recorte.avisos)

  const detalhesPorChave = new Map(mapaPorSlot.detalhesPorSlot.map((detalhe) => [detalhe.chave, detalhe]))
  const candidatosPorChave = new Map(candidatos.candidatos.map((candidato) => [`${candidato.dataISO}::${normalizarEquipe(candidato.equipe) ?? candidato.equipe}`, candidato]))
  const recorteChaves = new Set(recorte.candidatosFinais.map((candidato) => `${candidato.dataISO}::${normalizarEquipe(candidato.equipe) ?? candidato.equipe}`))

  const slots = input.resultadosSalvos.map((resultado) => {
    const key = slotKey(resultado.dataISO, resultado.equipe)
    const detalhe = key ? detalhesPorChave.get(key) : undefined
    const candidato = key ? candidatosPorChave.get(key) : undefined
    const enderecosSemCoordenadas = extrairEnderecosSemCoordenadasSlot({
      slotKey: key,
      dataISO: resultado.dataISO,
      equipe: resultado.equipe,
      detalhe,
    })
    const filtroEarly = montarFiltroEarlyAuditoria({
      detalhe,
      destino: entradaNormalizada.coordenadasDestino
        ? {
            lat: entradaNormalizada.coordenadasDestino.lat,
            lng: entradaNormalizada.coordenadasDestino.lng,
            descricao: entradaNormalizada.enderecoCompleto ?? input.payload.destDisplay,
          }
        : null,
    })
    const insercaoInterrompidaPorFiltroEarly = filtroEarly?.descartado === true
    const insercaoRealCompleta = enderecosSemCoordenadas.length === 0 && !insercaoInterrompidaPorFiltroEarly
    const validacaoInsercaoReal = insercaoInterrompidaPorFiltroEarly
      ? 'interrompida_por_filtro_early'
      : insercaoRealCompleta
        ? 'completa'
        : 'incompleta_sem_coordenadas'
    const motivoInsercaoRealIncompleta = insercaoInterrompidaPorFiltroEarly
      ? 'Filtro early legado descartou o slot antes do delta de insercao; km por insercao real nao foi calculado.'
      : insercaoRealCompleta
        ? null
        : 'Pontos reais da agenda foram descartados por falta de coordenadas; km por insercao nao deve ser tratado como validado.'
    return {
      slotKey: key,
      dataISO: resultado.dataISO,
      equipe: resultado.equipe,
      resultadoSalvo: resultado,
      kmAdicionalNaRotaM: detalhe?.kmAdicionalNaRotaM ?? candidato?.distancia.kmAdicionalNaRotaM ?? null,
      kmAdicionalKm:
        detalhe?.kmAdicionalNaRotaM == null ? null : Number((detalhe.kmAdicionalNaRotaM / 1000).toFixed(3)),
      slotAvailMin: candidato?.operacional.slotAvailMin ?? candidato?.operacional.disponivelMin ?? null,
      serviceMin: candidato?.operacional.serviceMin ?? candidato?.operacional.tempoNecessarioMin ?? null,
      equipeAtiva: candidato?.operacional.ativa ?? null,
      motivoIndisponibilidade: candidato?.motivos.join('; ') || null,
      tipoRecalculado: candidato?.tipo ?? null,
      elegivelRecalculado: candidato?.elegivel ?? null,
      limiteBaseM: candidato?.limites.limiteBaseM ?? null,
      limiteEspecialM: candidato?.limites.limiteEspecialM ?? null,
      limitePremiumM: candidato?.limites.limitePremiumM ?? null,
      motivosAceiteRecusa: candidato?.motivos ?? [],
      origemKmAdicionalNaRotaM: detalhe?.origemKmAdicionalNaRotaM ?? null,
      slotTemPontos: candidato?.slotTemPontos ?? (key ? slotTemPontosPorDataEquipe[key] ?? null : null),
      insercaoRealCompleta,
      validacaoInsercaoReal,
      motivoInsercaoRealIncompleta,
      filtroEarlyAplicado: filtroEarly?.aplicado ?? false,
      filtroEarly,
      enderecosSemCoordenadas,
      entrouNoRecorteAtual: key ? recorteChaves.has(key) : false,
      motivos: candidato?.motivos ?? [],
      avisos: candidato?.avisos ?? [],
      fonteDados: candidato || detalhe ? 'real' : 'indisponivel',
      detalheSlot: resumirDetalheSlot(detalhe),
    }
  })
  const enderecosSemCoordenadas = slots.flatMap((slot) => slot.enderecosSemCoordenadas)
  const slotsInterrompidosPorFiltroEarly = slots.filter((slot) => slot.filtroEarly?.descartado)

  return {
    disponivel: true,
    motivoFalhaDiagnosticoReal: null,
    agendaReal: agendaReal.diagnostico,
    disponibilidadeReal: disponibilidadeReal.diagnostico,
    fonteAgenda: 'google-sheets',
    fonteDisponibilidade: 'google-sheets',
    totalLinhasAgendaLidas: agendaReal.linhasAgenda.length,
    totalDisponibilidadesLidas: disponibilidadeReal.disponibilidades.length,
    totalCandidatosReais: candidatos.candidatos.length,
    cacheAgenda: {
      hashesConsultados: cacheAgenda.hashesConsultados,
      hitsSupabase: cacheAgenda.hitsSupabase,
      enderecosSemHash: cacheAgenda.enderecosSemHash,
    },
    resolucaoCoordenadasAgenda: {
      estrategiaPrimaria: 'resolverCacheCoordenadasAgendaDiagnostico',
      fallbackAuditoriaCacheSeguro: 'buscarEnderecoNoGeoCache',
      geocodificacaoExternaAutomatica: false,
      motivoGeocodificacaoExternaAutomatica:
        'Nao executada nesta rota de auditoria; o ajuste e cache-only e nao chama provedores externos nem Apps Script.',
      hashesConsultados: cacheAgenda.hashesConsultados,
      hitsSupabase: cacheAgenda.hitsSupabase,
      cacheSeguroPorCampos: cacheSeguroAgenda,
    },
    mapaKmPorSlot: {
      contadores: mapaPorSlot.contadores,
      ok: mapaPorSlot.ok,
    },
    recorteAtual: {
      resumo: recorte.resumo,
      diasUsados: recorte.diasUsados,
    },
    slots,
    enderecosSemCoordenadas,
    insercaoRealCompleta: enderecosSemCoordenadas.length === 0 && slotsInterrompidosPorFiltroEarly.length === 0,
    slotsInterrompidosPorFiltroEarly: slotsInterrompidosPorFiltroEarly.map((slot) => ({
      slotKey: slot.slotKey,
      tipoFiltroEarly: slot.filtroEarly?.tipoFiltroEarly ?? null,
      motivoTextual: slot.filtroEarly?.motivoTextual ?? null,
    })),
    avisos,
    limitacoesHistoricas,
  }
}

function salvoCoerenteComSnapshot(
  slotKeyAlvo: string | null,
  resultadoSalvo: ResultadoSalvoNormalizado | null,
  snapshotTecnico: SnapshotTecnicoSalvo | null
): boolean {
  if (!slotKeyAlvo || !resultadoSalvo || !snapshotTecnico) return false
  const snap = snapshotTecnico.candidatosFinais.find((c) => c.slotKey === slotKeyAlvo)
  if (!snap) return false
  if (!snap.elegivel) return false
  if (resultadoSalvo.tipo && snap.tipoOriginal && resultadoSalvo.tipo !== snap.tipoOriginal) return false
  const motivosRecusa = (snap.motivos ?? []).filter((m) => m && m.trim().length > 0)
  if (motivosRecusa.length > 0) return false
  if (snap.slotAvailMin !== null && snap.serviceMin !== null && snap.slotAvailMin < snap.serviceMin) return false
  if (snap.kmAdicionalNaRotaM === null || !Number.isFinite(snap.kmAdicionalNaRotaM)) return false
  return true
}

function montarDivergencias(
  resultadosSalvos: ResultadoSalvoNormalizado[],
  diagnosticoReal: Awaited<ReturnType<typeof montarDiagnosticoReal>>,
  recalculoConclusivo: RecalculoConclusivo,
  snapshotTecnico: SnapshotTecnicoSalvo | null
) {
  const divergencias: Array<{ slotKey: string | null; tipo: string; detalhe: string; severidade: 'forte' | 'aviso' }> = []
  if (!diagnosticoReal.disponivel) {
    divergencias.push({
      slotKey: null,
      tipo: 'diagnostico-real-indisponivel',
      detalhe: diagnosticoReal.motivoFalhaDiagnosticoReal ?? 'Diagnostico real indisponivel.',
      severidade: 'aviso',
    })
    return divergencias
  }

  const slots = Array.isArray(diagnosticoReal.slots) ? diagnosticoReal.slots : []
  for (const slot of slots) {
    const salvo = slot.resultadoSalvo
    if (slot.insercaoRealCompleta === false) {
      const detalhe = slot.filtroEarly?.descartado
        ? `Km por insercao nao validado: filtro early legado (${slot.filtroEarly.tipoFiltroEarly}) interrompeu o calculo do delta.`
        : `Km por insercao nao validado: ${slot.enderecosSemCoordenadas.length} ponto(s) real(is) da agenda sem coordenadas.`
      divergencias.push({
        slotKey: slot.slotKey,
        tipo: slot.filtroEarly?.descartado
          ? 'insercao-real-interrompida-por-filtro-early'
          : 'insercao-real-incompleta-sem-coordenadas',
        detalhe,
        severidade: 'aviso',
      })
    }
    if (salvo?.tipo && slot.tipoRecalculado && salvo.tipo !== slot.tipoRecalculado) {
      const coerenteSnap = salvoCoerenteComSnapshot(slot.slotKey, salvo, snapshotTecnico)
      const rebaixar = !recalculoConclusivo.conclusivo || coerenteSnap
      divergencias.push({
        slotKey: slot.slotKey,
        tipo: 'tipo-divergente',
        detalhe: rebaixar
          ? coerenteSnap
            ? `Resultado salvo tipo=${salvo.tipo}; diagnostico atual tipo=${slot.tipoRecalculado}. Resultado salvo está coerente com o snapshot técnico da produção. A divergência vem do recálculo atual com dados atuais, possivelmente por mudança posterior de agenda/disponibilidade.`
            : `Resultado salvo tipo=${salvo.tipo}; diagnostico atual tipo=${slot.tipoRecalculado}. AVISO: recálculo não conclusivo (${recalculoConclusivo.motivos.join('; ')}). Divergência rebaixada para aviso.`
          : `Resultado salvo tipo=${salvo.tipo}; diagnostico atual tipo=${slot.tipoRecalculado}.`,
        severidade: rebaixar ? 'aviso' : 'forte',
      })
    }
    if (slot.elegivelRecalculado === false) {
      const coerenteSnap = salvoCoerenteComSnapshot(slot.slotKey, salvo, snapshotTecnico)
      const rebaixar = !recalculoConclusivo.conclusivo || coerenteSnap
      divergencias.push({
        slotKey: slot.slotKey,
        tipo: 'resultado-salvo-nao-elegivel-atual',
        detalhe: rebaixar
          ? coerenteSnap
            ? `Resultado salvo existe, mas o diagnostico atual marcou como nao elegivel: ${slot.motivoIndisponibilidade ?? 'motivo nao informado'}. Resultado salvo está coerente com o snapshot técnico da produção. A divergência vem do recálculo atual com dados atuais, possivelmente por mudança posterior de agenda/disponibilidade.`
            : `Resultado salvo existe, mas o diagnostico atual marcou como nao elegivel: ${slot.motivoIndisponibilidade ?? 'motivo nao informado'}. AVISO: recálculo não conclusivo — divergência rebaixada para aviso.`
          : `Resultado salvo existe, mas o diagnostico atual marcou como nao elegivel: ${slot.motivoIndisponibilidade ?? 'motivo nao informado'}.`,
        severidade: rebaixar ? 'aviso' : 'forte',
      })
    }
    if (slot.entrouNoRecorteAtual === false) {
      const coerenteSnap = salvoCoerenteComSnapshot(slot.slotKey, salvo, snapshotTecnico)
      const rebaixar = !recalculoConclusivo.conclusivo || coerenteSnap
      divergencias.push({
        slotKey: slot.slotKey,
        tipo: 'resultado-salvo-fora-do-recorte-atual',
        detalhe: rebaixar
          ? coerenteSnap
            ? 'O slot salvo nao apareceu no recorte final recalculado com os dados atuais. Resultado salvo está coerente com o snapshot técnico da produção. A divergência vem do recálculo atual com dados atuais, possivelmente por mudança posterior de agenda/disponibilidade.'
            : 'O slot salvo nao apareceu no recorte final recalculado com os dados atuais. AVISO: recálculo não conclusivo — pode ser mudança na planilha, não bug.'
          : 'O slot salvo nao apareceu no recorte final recalculado com os dados atuais.',
        severidade: rebaixar ? 'aviso' : 'forte',
      })
    }
  }

  const slotsComChave = new Set(slots.map((slot) => slot.slotKey).filter(Boolean))
  for (const resultado of resultadosSalvos) {
    const key = slotKey(resultado.dataISO, resultado.equipe)
    if (key && !slotsComChave.has(key)) {
      divergencias.push({
        slotKey: key,
        tipo: 'slot-salvo-sem-diagnostico-atual',
        detalhe: 'Nao foi encontrado diagnostico atual para o slot salvo.',
        severidade: 'aviso',
      })
    }
  }

  return divergencias
}

export async function POST(request: NextRequest) {
  const access = await requireModuleAccess('procurar_datas_auditoria')
  if (!access.ok) return access.response

  try {
    const body = (await request.json()) as { runIdOuPesquisaId?: unknown }
    const runIdOuPesquisaId = asString(body.runIdOuPesquisaId)

    if (!runIdOuPesquisaId) {
      return NextResponse.json(
        { ok: false, error: 'Informe runIdOuPesquisaId.' },
        { status: 400 }
      )
    }

    const pesquisaRow = await buscarPesquisa(runIdOuPesquisaId)
    if (!pesquisaRow) {
      return NextResponse.json(
        { ok: false, error: 'Pesquisa de auditoria nao encontrada por id, run_id ou client_token.' },
        { status: 404 }
      )
    }

    const parametros = isRecord(pesquisaRow.parametros_json) ? pesquisaRow.parametros_json : {}
    const resultadosSalvos = normalizarResultadosSalvos(pesquisaRow.resultados_json)
    const snapshotTecnico = extrairSnapshotTecnico(parametros)
    const payload = montarPayloadDaPesquisa(pesquisaRow, parametros)
    const diagnosticoReal = await montarDiagnosticoReal({
      pesquisa: pesquisaRow,
      payload,
      resultadosSalvos,
    })

    const recalculoConclusivo = avaliarRecalculoConclusivo({
      diagnosticoReal,
      snapshotTecnico,
    })

    const divergenciasSnapshot = snapshotTecnico
      ? compararSalvoComSnapshot(resultadosSalvos, snapshotTecnico)
      : []

    const pesquisa = {
      id: pesquisaRow.id,
      runId: pesquisaRow.run_id,
      clientToken: pesquisaRow.client_token,
      createdAt: pesquisaRow.created_at,
      usuarioEmail: pesquisaRow.usuario_email,
      status: pesquisaRow.status,
      motor: pesquisaRow.motor_versao,
      origem: pesquisaRow.origem,
      duracaoMs: pesquisaRow.duracao_ms,
      startedAt: pesquisaRow.started_at,
      finishedAt: pesquisaRow.finished_at,
    }
    const entrada = {
      cep: pesquisaRow.cep,
      endereco: {
        logradouro: pesquisaRow.logradouro,
        numero: pesquisaRow.numero_residencia,
        bairro: pesquisaRow.bairro,
        cidade: pesquisaRow.cidade,
        uf: pesquisaRow.uf,
        completo: pesquisaRow.endereco_completo,
      },
      coordenadas: {
        lat: asNumber(pesquisaRow.latitude),
        lng: asNumber(pesquisaRow.longitude),
      },
      dataInicial: payload.dataInicial ?? null,
      tempoNecessario: payload.tempoNecessario ?? null,
      itens: {
        tipoBerco: payload.tipoBerco ?? null,
        comoda: payload.comoda ?? null,
        roupeiro: payload.roupeiro ?? null,
        poltrona: payload.poltrona ?? null,
        painel: payload.painel ?? null,
      },
      condominio: payload.isCondominio ?? null,
      rural: payload.isRural ?? null,
      encomenda: payload.isEncomenda ?? null,
      valorInicialMinimo: payload.valorInicialMinimo ?? null,
      parametrosRaw: parametros,
    }

    const limitacoesHistoricas = [
      ...(diagnosticoReal.limitacoesHistoricas ?? []),
      snapshotTecnico
        ? 'Snapshot técnico da produção disponível em parametros_json.snapshotTecnico. Use como referência principal para auditoria quando o recálculo atual não for conclusivo.'
        : 'Snapshot técnico da produção não disponível nesta auditoria. Recálculo atual é a única base de comparação, mas pode não ser conclusivo se a agenda mudou.',
    ]

    const avisosComparacao = [
      ...(diagnosticoReal.avisos ?? []),
      'fonteCandidatos: real quando a leitura atual de agenda/disponibilidade e o recalc do slot foram possiveis.',
      'fonteDisponibilidade: google-sheets quando a leitura real foi possivel.',
      'naoUsarComoConclusao: true para qualquer bloco sintetico; esta rota nao usa sintetico como conclusao.',
    ]
    if (!recalculoConclusivo.conclusivo) {
      avisosComparacao.push(
        `recalculoNaoConclusivo: ${recalculoConclusivo.motivos.join('; ')}`
      )
    }
    if (snapshotTecnico) {
      avisosComparacao.push(
        'snapshotTecnicoDisponivel: true — snapshot da produção salvo no momento da busca. Comparação resultado salvo x snapshot da produção incluída.'
      )
    }

    const comparacao = {
      divergencias: montarDivergencias(resultadosSalvos, diagnosticoReal, recalculoConclusivo, snapshotTecnico),
      divergenciasSnapshot,
      avisos: avisosComparacao,
      limitacoesHistoricas,
      fonteCandidatos: diagnosticoReal.disponivel ? 'real' : 'indisponivel',
      fonteDisponibilidade: diagnosticoReal.disponivel ? 'google-sheets' : 'indisponivel',
      naoUsarComoConclusao: false,
      recalculoConclusivo,
    }

    const respostaSemTexto = {
      ok: true,
      pesquisa,
      entrada,
      resultadosSalvos,
      snapshotTecnicoDisponivel: snapshotTecnico !== null,
      snapshotTecnico,
      diagnosticoReal,
      comparacao,
    }
    const textoCopiavel = JSON.stringify(respostaSemTexto, null, 2)

    return NextResponse.json({
      ...respostaSemTexto,
      textoCopiavel,
    })
  } catch (error) {
    console.error('[PROCURAR_DATAS][v2/auditar-run] erro', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado ao auditar execucao.',
      },
      { status: 500 }
    )
  }
}
