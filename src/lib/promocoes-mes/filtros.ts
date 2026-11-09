import { ErroPromocao } from './repositorio'
import { dataIsoValida, type SituacaoPromocao } from './vigencia'

export const PAGE_SIZE_PROMOCOES = 10
const PAGE_SIZE_MAX = 50
const SITUACOES: SituacaoPromocao[] = ['VIGENTE', 'FUTURA', 'ENCERRADA']

export type FiltrosPromocoes = {
  /** Trecho do título (sem diferenciar maiúsculas). */
  titulo: string
  /** Promoções cujo INÍCIO é igual ou posterior a esta data (YYYY-MM-DD). */
  inicioDe: string
  /** Promoções cujo FIM é igual ou anterior a esta data (YYYY-MM-DD). */
  fimAte: string
  situacao: SituacaoPromocao | ''
  page: number
  pageSize: number
}

function inteiroPositivo(valor: string | null, padrao: number, maximo: number) {
  const n = Number.parseInt(valor ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return padrao
  return Math.min(n, maximo)
}

/** Lê e valida os filtros da listagem administrativa. Datas inválidas viram erro 422 (nunca são ignoradas em silêncio). */
export function lerFiltrosPromocoes(params: URLSearchParams): FiltrosPromocoes {
  const titulo = (params.get('titulo') ?? '').trim().slice(0, 120)
  const inicioDe = params.get('inicioDe') ?? ''
  const fimAte = params.get('fimAte') ?? ''
  if (inicioDe && !dataIsoValida(inicioDe)) throw new ErroPromocao('FILTRO_INVALIDO', 422, 'Data inicial do filtro inválida.')
  if (fimAte && !dataIsoValida(fimAte)) throw new ErroPromocao('FILTRO_INVALIDO', 422, 'Data final do filtro inválida.')
  const situacao = params.get('situacao') ?? ''
  if (situacao && !SITUACOES.includes(situacao as SituacaoPromocao)) throw new ErroPromocao('FILTRO_INVALIDO', 422, 'Situação do filtro inválida.')
  return {
    titulo,
    inicioDe,
    fimAte,
    situacao: situacao as FiltrosPromocoes['situacao'],
    page: inteiroPositivo(params.get('page'), 1, 100_000),
    pageSize: inteiroPositivo(params.get('pageSize'), PAGE_SIZE_PROMOCOES, PAGE_SIZE_MAX),
  }
}

/** Escapa curingas do LIKE para que o texto digitado seja sempre literal. */
export function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}
