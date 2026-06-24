// Contratos TypeScript para as rotas Next.js de /api/procurar-datas/**
//
// Baseado em:
// - Leitura real das rotas em src/app/api/procurar-datas/.../route.ts
// - src/lib/procurar-datas/types.ts
// - src/lib/procurar-datas/api.ts
// - docs/procurar-datas-contratos-payloads.md
// - docs/procurar-datas-fixtures-por-rota.md
//
// Regras aplicadas:
// - Campos confirmados no código real são obrigatórios.
// - Campos documentados mas ainda não validados contra resposta real são opcionais + comentário JSDoc.
// - Não redefinir tipos já existentes em types.ts; importá-los.
// - Não alterar comportamento runtime.

import type {
  ProcurarDatasServicoForm,
  ProcurarDatasEnderecoForm,
  ProcurarDatasCandidate,
  ProcurarDatasPreAgendamentoMeta,
} from './types'

// ---------------------------------------------------------------------------
// Tipos auxiliares reaproveitados
// ---------------------------------------------------------------------------

/** Coordenada geográfica (lat/lng). */
export interface Coordenada {
  lat: number
  lng: number
}

// ---------------------------------------------------------------------------
// Candidato final — retornado no payload de pesquisa (Apps Script → frontend)
// ---------------------------------------------------------------------------

/** Candidato formatado para exibição no frontend e pré-agendamento. */
export interface CandidatoFinal {
  /** Calculado como contador sequencial no payload final; não é score de ranking interno. */
  rank: number
  dateISO: string
  dateDM: string
  weekday: string
  daysLeftTxt: string
  encomenda: string
  /** Valor monetário formatado (ex: "R$ 150"). Não é 'number'. */
  frete: string
  team: string
  tipo: 'normal' | 'especial' | 'premium' | 'hora-marcada' | string
  isExtra: boolean
  avisoHoraMarcada: string
}

// ---------------------------------------------------------------------------
// Payload compacto — encapsulado dentro do progresso quando status = "done"
// ---------------------------------------------------------------------------

/** Payload completo salvo pelo Apps Script no estado 'done'. */
export interface PayloadCompacto {
  ok: boolean
  cep: string
  /** Tempo de serviço no formato HH:MM. */
  tempo: string
  /** Bairro/cidade simplificado (produzido por parsing de endereço). */
  label: string
  address: string
  addressShort: string
  startFromISO: string
  startFromDM: string
  isRural: boolean
  isCondominio: boolean
  params: string
  candidates: CandidatoFinal[]
  /** Segundos como string (ex: "45.2"). Use 'parseFloat' antes de operar como número. */
  searchTime: string
}

// ---------------------------------------------------------------------------
// Progresso de pesquisa — retornado por '/api/procurar-datas/progresso'
// ---------------------------------------------------------------------------

export type ProgressoPesquisaStatus = 'waiting' | 'queued' | 'running' | 'done' | 'error'

/**
 * Objeto de progresso retornado pelo Apps Script e repassado pelo Next.js.
 *
 * Nota: campos como 'payload', 'error', 'startedAt', 'finishedAt' e 'durationMs'
 * são condicionais ao status. 'clientToken' está ausente no estado 'waiting'.
 */
export interface ProgressoPesquisa {
  status: ProgressoPesquisaStatus
  /** Ausente em 'waiting'. */
  clientToken?: string
  /** Presente apenas em 'done'. */
  payload?: PayloadCompacto
  normais: CandidatoFinal[]
  extras: CandidatoFinal[]
  timestamp: number
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  /** Diagnostico v2 opcional, presente apenas quando uma rota interna ativa a flag diagnostica. */
  diagnosticoPerformanceV2?: unknown
  /** Diagnostico dirigido opcional do resultado v2 na tela. */
  diagnosticoResultadoTelaV2SantoAmaro?: unknown
  /** Diagnostico enxuto do delta do 16/07 em Santo Amaro. */
  diagnosticoDeltaSantoAmaro16Jul?: unknown
  /** Presente apenas em 'error'. */
  error?: string
}

// ---------------------------------------------------------------------------
// Resposta de erro genérica — usada por todas as rotas
// ---------------------------------------------------------------------------

export interface ErroProcurarDatasResponse {
  ok: false
  error: string
}

// ---------------------------------------------------------------------------
// 1. POST /api/procurar-datas/pesquisar
// ---------------------------------------------------------------------------

/** Request: 'ProcurarDatasServicoForm' (já tipado em 'types.ts'). */
export type PesquisarDatasRequest = ProcurarDatasServicoForm

export type PesquisarDatasStatus = 'started' | 'already_started'

export interface PesquisarDatasResponseSucesso {
  ok: true
  clientToken: string
  status: PesquisarDatasStatus
}

export type PesquisarDatasResponse = PesquisarDatasResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 2. GET /api/procurar-datas/progresso
// ---------------------------------------------------------------------------

/** Query param: '?clientToken=...'. */
export interface ProgressoPesquisaQuery {
  clientToken: string
}

export interface ProgressoPesquisaResponseSucesso {
  ok: true
  progress: ProgressoPesquisa
}

export type ProgressoPesquisaResponse = ProgressoPesquisaResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 3. POST /api/procurar-datas/pre-agendar
// ---------------------------------------------------------------------------

export interface PreAgendarRequest {
  cand: ProcurarDatasCandidate
  meta: ProcurarDatasPreAgendamentoMeta
}

export interface PreAgendarResponseSucesso {
  ok: true
  titulo: string
  eventLink: string
}

export type PreAgendarResponse = PreAgendarResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 4. POST /api/procurar-datas/calcular-tempo
// ---------------------------------------------------------------------------

/** Request: subconjunto de 'ProcurarDatasServicoForm' (tipoBerco, comoda, roupeiro, poltrona, painel, isCondominio). */
export type CalcularTempoRequest = ProcurarDatasServicoForm

export interface CalcularTempoResponseSucesso {
  ok: true
  /** HH:MM ou '""' quando a combinação não existe no mapa. */
  tempoNecessario: string
}

export type CalcularTempoResponse = CalcularTempoResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 5. GET /api/procurar-datas/opcoes
// ---------------------------------------------------------------------------

export interface OpcoesFront {
  tipoBerco: string[]
  comoda: string[]
  roupeiro: string[]
  poltrona: string[]
  painel: string[]
  baseSemana: number
  adicionalCondominio: number
}

/** Chave: 'tipoBerco|comoda|roupeiro|poltrona|painel' → valor: '"HH:MM"'. */
export type TempoMap = Record<string, string>

export interface OpcoesProcurarDatasResponseSucesso {
  ok: true
  opcoes: OpcoesFront
  tempoMap: TempoMap
}

export type OpcoesProcurarDatasResponse = OpcoesProcurarDatasResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 6. POST /api/procurar-datas/validar-endereco
// ---------------------------------------------------------------------------

/** Request: 'ProcurarDatasEnderecoForm' (já tipado em 'types.ts'). */
export type ValidarEnderecoRequest = ProcurarDatasEnderecoForm

/**
 * Resultado da validação de endereço.
 *
 * ⚠️ Parcial: a estrutura completa do retorno de 'LookupCompletoPorEndereco'
 * ainda não foi totalmente mapeada contra respostas reais. Os campos listados
 * abaixo são os confirmados nas fixtures; campos extras podem existir.
 */
export interface EnderecoValidado {
  enderecoCompleto?: string
  lat?: number
  lng?: number
  cep?: string
  /** Campos adicionais podem ser retornados pelo Apps Script. */
  [key: string]: unknown
}

export interface ValidarEnderecoResponseSucesso {
  ok: true
  resultado: EnderecoValidado
}

export type ValidarEnderecoResponse = ValidarEnderecoResponseSucesso | ErroProcurarDatasResponse

// ---------------------------------------------------------------------------
// 7. POST /api/procurar-datas/valor-inicial
// ---------------------------------------------------------------------------

/** Request: 'ProcurarDatasServicoForm'. */
export type ValorInicialRequest = ProcurarDatasServicoForm

/**
 * Resultado do cálculo de valor inicial.
 *
 * Baseado nos campos confirmados em 'valor-inicial/route.ts' e em
 * 'docs/procurar-datas-contratos-payloads.md' §14.
 */
export interface ValorInicialResultado {
  ok?: boolean
  valor: number | null
  valorFormatado: string
  /** Alias de 'valorFormatado'. */
  valorFmt: string
  distanciaKm: number | null
  /** 'true' quando OSRM falhou e haversine foi usado como fallback. */
  fallbackUsado: boolean
  msg: string
}

export interface ValorInicialResponseSucesso {
  ok: true
  resultado: ValorInicialResultado
}

export type ValorInicialResponse = ValorInicialResponseSucesso | ErroProcurarDatasResponse
