import type {
  CandidatoFinal,
  PayloadCompacto,
  PesquisarDatasRequest,
} from '../contratos'
import type {
  CandidatoFinalPesquisarDatasV2,
  PesquisarDatasV2Output,
} from './pesquisar-datas-v2'

type FormatoDateISOContratoLegado = 'legado-gmt3' | 'v2'

type CandidatoFinalCompatLegado = CandidatoFinal & {
  /** Campo consumido como fallback pelo frontend legado, embora nao esteja no contrato oficial. */
  date: string
}

export type PayloadCompactoCompatLegado = Omit<PayloadCompacto, 'candidates'> & {
  candidates: CandidatoFinalCompatLegado[]
}

export interface FreteCandidatoLegadoInput {
  dataISO: string
  equipe: string
  tipo: string
  rank?: number
  frete: string
}

export interface MetadadosPayloadLegadoInput {
  cep?: string
  tempo?: string
  label?: string
  address?: string
  addressShort?: string
  startFromISO?: string
  startFromDM?: string
  params?: string
  searchTime?: string | number
}

export interface AdaptarSaidaV2ParaLegadoInput {
  saidaV2: PesquisarDatasV2Output
  requestOriginal: PesquisarDatasRequest
  metadados?: MetadadosPayloadLegadoInput
  fretes?: FreteCandidatoLegadoInput[]
  dataReferenciaISO?: string | null
  formatoDateISO?: FormatoDateISOContratoLegado
}

export interface AdaptarSaidaV2ParaLegadoOutput {
  ok: boolean
  payload: PayloadCompactoCompatLegado
  avisos: string[]
}

const NOMES_DIAS_SEMANA_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

const TIPOS_EXTRA = new Set<string>(['especial', 'premium', 'hora-marcada'])

function extrairDataBase(dataISO: string): string {
  return dataISO.split('T')[0] ?? dataISO
}

function ehDataISOValida(dataISO: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(extrairDataBase(dataISO))
}

function formatarDateISOContrato(dataISO: string, formato: FormatoDateISOContratoLegado): string {
  const base = extrairDataBase(dataISO)
  if (formato === 'legado-gmt3' && ehDataISOValida(base)) {
    return `${base}T03:00:00.000Z`
  }
  return dataISO
}

function formatarDM(dataISO: string): string {
  const match = extrairDataBase(dataISO).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dataISO
  return `${match[3]}/${match[2]}`
}

function obterDiaSemana(dataISO: string): number | null {
  const match = extrairDataBase(dataISO).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const data = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return data.getUTCDay()
}

function diffDiasISO(de: string, para: string): number | null {
  const deBase = extrairDataBase(de)
  const paraBase = extrairDataBase(para)
  const re = /^(\d{4})-(\d{2})-(\d{2})$/
  const deMatch = deBase.match(re)
  const paraMatch = paraBase.match(re)
  if (!deMatch || !paraMatch) return null
  const deMs = Date.UTC(Number(deMatch[1]), Number(deMatch[2]) - 1, Number(deMatch[3]))
  const paraMs = Date.UTC(Number(paraMatch[1]), Number(paraMatch[2]) - 1, Number(paraMatch[3]))
  return Math.ceil((paraMs - deMs) / 86400000)
}

function montarEndereco(request: PesquisarDatasRequest): string {
  const partes = [
    request.logradouro,
    request.numero,
    request.bairro,
    request.cidade,
    request.uf,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)

  return request.enderecoCompleto?.trim() || request.destDisplay?.trim() || partes.join(', ')
}

function montarLabel(address: string, request: PesquisarDatasRequest): string {
  const bairroCidade = [request.bairro, request.cidade]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' - ')

  if (bairroCidade) return bairroCidade
  const partes = address.split(',').map((p) => p.trim()).filter(Boolean)
  return partes.slice(-2).join(' - ')
}

function formatarDataInicialDM(dataISO: string): string {
  return ehDataISOValida(dataISO) ? formatarDM(dataISO) : ''
}

function formatarDataInicialISO(request: PesquisarDatasRequest, metadados?: MetadadosPayloadLegadoInput): string {
  const data = metadados?.startFromISO ?? request.dataInicial ?? ''
  return String(data || '')
}

function pickValor(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'boolean') return value ? 'SIM' : 'NAO'
  return '-'
}

function formatarMesPesquisa(dataInicial: string): string {
  if (!dataInicial) return '-'
  const partes = dataInicial.split('-')
  if (partes.length >= 3) return `${partes[2]}/${partes[1]}/${partes[0]}`
  if (partes.length === 2) return `${partes[1]}/${partes[0]}`
  return dataInicial
}

function montarParams(request: PesquisarDatasRequest, dataInicialISO: string): string {
  return [
    `ÁREA RURAL?: ${request.isRural ? 'Sim' : 'Não'}`,
    `É CONDOMÍNIO?: ${request.isCondominio ? 'Sim' : 'Não'}`,
    `É ENCOMENDA?: ${request.isEncomenda ? 'Sim' : 'Não'}`,
    `PROCURAR A PARTIR DE: ${formatarMesPesquisa(dataInicialISO)}`,
    `BERÇO/CAMA: ${request.tipoBerco || '-'}`,
    `CÔMODA: ${pickValor(request.comoda)}`,
    `ROUPEIRO: ${pickValor(request.roupeiro)}`,
    `POLTRONA: ${pickValor(request.poltrona)}`,
    `PAINEL: ${pickValor(request.painel)}`,
    `TEMPO NECESSÁRIO: ${String(request.tempoNecessario || '')}`,
  ].join('\n')
}

export function montarChaveFreteCandidatoLegado(input: {
  dataISO: string
  equipe: string
  tipo: string
  rank?: number
}): string {
  const data = extrairDataBase(input.dataISO)
  const rank = typeof input.rank === 'number' ? String(input.rank) : ''
  return [data, input.equipe, input.tipo, rank].join('::')
}

function montarMapaFretes(fretes: FreteCandidatoLegadoInput[] | undefined): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const item of fretes ?? []) {
    mapa.set(montarChaveFreteCandidatoLegado(item), item.frete)
    mapa.set(
      montarChaveFreteCandidatoLegado({
        dataISO: item.dataISO,
        equipe: item.equipe,
        tipo: item.tipo,
      }),
      item.frete
    )
  }
  return mapa
}

function resolverFrete(
  candidato: CandidatoFinalPesquisarDatasV2,
  mapaFretes: Map<string, string>
): string {
  return (
    mapaFretes.get(
      montarChaveFreteCandidatoLegado({
        dataISO: candidato.dataISO,
        equipe: candidato.equipe,
        tipo: candidato.tipo,
        rank: candidato.rank,
      })
    ) ??
    mapaFretes.get(
      montarChaveFreteCandidatoLegado({
        dataISO: candidato.dataISO,
        equipe: candidato.equipe,
        tipo: candidato.tipo,
      })
    ) ??
    ''
  )
}

function adaptarCandidato(input: {
  candidato: CandidatoFinalPesquisarDatasV2
  rankFallback: number
  dataReferenciaISO: string | null
  formatoDateISO: FormatoDateISOContratoLegado
  mapaFretes: Map<string, string>
  avisos: string[]
}): CandidatoFinalCompatLegado {
  const { candidato, rankFallback, dataReferenciaISO, formatoDateISO, mapaFretes, avisos } = input
  const dataBase = extrairDataBase(candidato.dataISO)
  const diaSemana = obterDiaSemana(dataBase)
  const frete = resolverFrete(candidato, mapaFretes)
  const rank = Number.isFinite(candidato.rank) && candidato.rank > 0
    ? candidato.rank
    : rankFallback

  if (!frete) {
    avisos.push(
      `frete ausente para candidato ${dataBase} / ${candidato.equipe} / ${candidato.tipo}. Nao calculado a partir de kmAdicionalNaRotaM.`
    )
  }

  const diff = dataReferenciaISO ? diffDiasISO(dataReferenciaISO, dataBase) : null
  if (dataReferenciaISO && diff === null) {
    avisos.push(`daysLeftTxt nao calculado para data ${dataBase}.`)
  }

  const tipo = candidato.tipo || 'normal'

  return {
    rank,
    dateISO: formatarDateISOContrato(dataBase, formatoDateISO),
    date: dataBase,
    dateDM: formatarDM(dataBase),
    weekday: diaSemana === null ? '' : NOMES_DIAS_SEMANA_PT[diaSemana] ?? '',
    daysLeftTxt: diff === null ? '' : `${diff} d`,
    encomenda: 'Não',
    frete,
    team: candidato.equipe,
    tipo,
    isExtra: TIPOS_EXTRA.has(tipo),
    avisoHoraMarcada:
      tipo === 'hora-marcada'
        ? 'limite de horário de entrega até as 16h'
        : '',
  }
}

export function adaptarSaidaV2ParaPayloadLegado(
  input: AdaptarSaidaV2ParaLegadoInput
): AdaptarSaidaV2ParaLegadoOutput {
  const avisos: string[] = []
  const formatoDateISO = input.formatoDateISO ?? 'legado-gmt3'
  const request = input.requestOriginal
  const metadados = input.metadados
  const address = metadados?.address ?? montarEndereco(request)
  const startFromISO = formatarDataInicialISO(request, metadados)
  const mapaFretes = montarMapaFretes(input.fretes)

  const candidatosOrigem = input.saidaV2.resultadoFinal?.candidatosFinais ?? []
  const candidates = candidatosOrigem.map((candidato, index) =>
    adaptarCandidato({
      candidato,
      rankFallback: index + 1,
      dataReferenciaISO: input.dataReferenciaISO ?? (startFromISO || null),
      formatoDateISO,
      mapaFretes,
      avisos,
    })
  )

  const payload: PayloadCompactoCompatLegado = {
    ok: input.saidaV2.ok,
    cep: metadados?.cep ?? request.cep ?? '',
    tempo: metadados?.tempo ?? request.tempoNecessario ?? '',
    label: metadados?.label ?? montarLabel(address, request),
    address,
    addressShort: metadados?.addressShort ?? address,
    startFromISO,
    startFromDM: metadados?.startFromDM ?? formatarDataInicialDM(startFromISO),
    isRural: request.isRural === true,
    isCondominio: request.isCondominio === true,
    params: metadados?.params ?? montarParams(request, startFromISO),
    candidates,
    searchTime:
      metadados?.searchTime === undefined
        ? ''
        : String(metadados.searchTime),
  }

  if (!input.saidaV2.ok) {
    avisos.push('saidaV2.ok=false; payload legado foi montado com candidatos disponiveis no output recebido.')
  }

  if (candidates.length === 0) {
    avisos.push('saidaV2 sem candidatos finais para adaptar.')
  }

  return {
    ok: input.saidaV2.ok,
    payload,
    avisos,
  }
}
