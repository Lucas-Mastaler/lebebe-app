export type AppsScriptProcurarDatasFunction =
  | 'GetFrontOptionLists'
  | 'GetTempoMap'
  | 'GetTempoNecessario'
  | 'LookupCompletoPorEndereco'
  | 'GetProgressUpdate'
  | 'ApiPesquisarDatasApp'
  | 'ApiPreAgendarDireto'

export interface ProcurarDatasEnderecoForm {
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  enderecoCompleto?: string
  lat?: number | null
  lng?: number | null
  destLat?: number | null
  destLng?: number | null
  destDisplay?: string
  destProvider?: string
}

export interface ProcurarDatasServicoForm extends ProcurarDatasEnderecoForm {
  clientToken?: string
  dataInicial?: string
  monthYear?: string
  isRural?: boolean
  isCondominio?: boolean
  isEncomenda?: boolean
  tipoBerco?: string
  comoda?: string
  roupeiro?: string
  poltrona?: string
  painel?: string
  tempoNecessario?: string
}

export interface ProcurarDatasCandidate {
  dateISO: string
  team: string
  frete?: string
  tipo?: string
  isExtra?: boolean
  [key: string]: unknown
}

export interface ProcurarDatasPreAgendamentoMeta {
  tempo?: string
  label?: string
  address?: string
  cep?: string
  params?: string
}

export interface ProcurarDatasApiResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
