import type { ClassificacaoDecorisi, TipoDecorisi } from './tipos'
import xadrezia from './referencias-xp.json'

export type CatalogoPapelDecorisi = 'DB' | 'XP'
const referenciasXp = new Set(xadrezia.registros.map((r) => r.referencia))
export function referenciaPapelValida(referencia: string) {
  return (
    /^DB[78](0[1-9]|[1-3][0-9]|4[0-5])$/.test(referencia) ||
    referenciasXp.has(referencia)
  )
}
export function pesquisarReferenciasPapel(
  referencias: string[],
  catalogo: CatalogoPapelDecorisi,
  termo: string,
) {
  const busca = termo.trim().toUpperCase()
  return referencias.filter(
    (r) =>
      r.startsWith(catalogo) && referenciaPapelValida(r) && r.includes(busca),
  )
}

export const PRODUTOS_DECORISI = [
  {
    tipo: 'PAPEL',
    classificacao: 'CATALOGO',
    produtoIdSgi: 36565,
    codigo: '19075',
    unidade: 'ROLO',
  },
  {
    tipo: 'PAPEL',
    classificacao: 'PERSONALIZADO',
    produtoIdSgi: 36566,
    codigo: '19076',
    unidade: 'ROLO',
  },
  {
    tipo: 'PAINEL',
    classificacao: 'CATALOGO',
    produtoIdSgi: 36567,
    codigo: '19077',
    unidade: 'M2',
  },
  {
    tipo: 'PAINEL',
    classificacao: 'PERSONALIZADO',
    produtoIdSgi: 36568,
    codigo: '19078',
    unidade: 'M2',
  },
] as const

export const REFERENCIAS_PF_DECORISI = Array.from(
  { length: 81 },
  (_, i) => `PF${200 + i}`,
)
export function referenciaPfValida(referencia: string) {
  return /^PF2(?:[0-7][0-9]|80)$/.test(referencia)
}
export function pesquisarReferenciasPf(termo: string) {
  const busca = termo.trim().toUpperCase()
  return REFERENCIAS_PF_DECORISI.filter((codigo) => codigo.includes(busca))
}
export function produtoComercialDecorisi(
  tipo: TipoDecorisi,
  classificacao: ClassificacaoDecorisi,
) {
  const produto = PRODUTOS_DECORISI.find(
    (p) => p.tipo === tipo && p.classificacao === classificacao,
  )
  if (!produto) throw new Error('PRODUTO_DECORISI_INVALIDO')
  return produto
}
