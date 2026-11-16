import { isDescricaoVolumeAvulso } from './volume-avulso'

export const CATEGORIAS = {
  roupeiro: 'Roupeiros', comoda: 'Cômodas e gaveteiros', berco: 'Berços',
  cama: 'Camas', prateleira: 'Prateleiras', mesa: 'Mesas', painel: 'Painéis e módulos',
  revisar: 'Outros / a revisar',
} as const
export type Categoria = keyof typeof CATEGORIAS
export type DecisoesCategoria = Record<string, Categoria>
export function normalizarDescricao(descricao: string): string {
  return descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
export function classificarDescricao(descricao: string, decisoes: DecisoesCategoria = {}): Categoria {
  const texto = normalizarDescricao(descricao)
  if (decisoes[texto]) return decisoes[texto]
  const encontrados: Categoria[] = []
  if (/\broup/.test(texto)) encontrados.push('roupeiro')
  if (/\b(comoda|gaveteiro)/.test(texto)) encontrados.push('comoda')
  if (/\bberco/.test(texto)) encontrados.push('berco')
  if (/\bcama/.test(texto)) encontrados.push('cama')
  if (/\bprateleira/.test(texto)) encontrados.push('prateleira')
  if (/\bmesa/.test(texto)) encontrados.push('mesa')
  if (/\b(painel|modulo)/.test(texto)) encontrados.push('painel')
  return encontrados.length === 1 ? encontrados[0] : 'revisar'
}
export interface ItemCategoria {
  descricao: string
  quantidade: number | null
  previstos: number
  conferidos: number
}
export function resumirCategorias(itens: ItemCategoria[], decisoes: DecisoesCategoria) {
  const totais = Object.fromEntries(Object.keys(CATEGORIAS).map(c => [c, { quantidade: 0, previstos: 0, conferidos: 0, semQuantidade: 0 }])) as Record<Categoria, { quantidade: number; previstos: number; conferidos: number; semQuantidade: number }>
  for (const item of itens) {
    if (isDescricaoVolumeAvulso(item.descricao)) continue
    const total = totais[classificarDescricao(item.descricao, decisoes)]
    if (item.quantidade == null) total.semQuantidade++
    else total.quantidade += item.quantidade
    total.previstos += item.previstos || 0
    total.conferidos += item.conferidos || 0
  }
  return totais
}
export function quantidadeAgrupada(previstos: number, volumesPorItem: number): number | null {
  return Number.isInteger(previstos) && Number.isInteger(volumesPorItem) && previstos >= 0 && volumesPorItem > 0 && previstos % volumesPorItem === 0 ? previstos / volumesPorItem : null
}
