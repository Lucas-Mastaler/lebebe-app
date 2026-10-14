import { DIMENSAO_MAXIMA_DECORISI_CM } from './calculos'
import { referenciaPfValida, referenciaPapelValida } from './catalogo'
import type { ItemDecorisi } from './tipos'

export function validarItensDecorisi(valor: unknown): ItemDecorisi[] {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > 10)
    throw new Error('LIMITE_ITENS_DECORISI')
  const referencias = new Set<string>(),
    ids = new Set<string>()
  return valor.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new Error('ITEM_DECORISI_INVALIDO')
    const v = item as Record<string, unknown>
    if (
      !['PAPEL', 'PAINEL'].includes(String(v.tipo)) ||
      !['CATALOGO', 'PERSONALIZADO'].includes(String(v.classificacao))
    )
      throw new Error('ITEM_DECORISI_INVALIDO')
    const id = typeof v.id === 'string' ? v.id.toLowerCase() : undefined
    if (
      v.id !== undefined &&
      (!id ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id) ||
        ids.has(id))
    )
      throw new Error('ID_ITEM_DECORISI_INVALIDO')
    if (id) ids.add(id)
    const referencia = texto(v.referencia, 5)?.toUpperCase() ?? null
    if (
      referencia &&
      (v.tipo === 'PAPEL'
        ? !referenciaPapelValida(referencia)
        : !referenciaPfValida(referencia))
    )
      throw new Error('REFERENCIA_DECORISI_INVALIDA')
    if (v.classificacao === 'CATALOGO' && referencia) {
      const chave = `${v.tipo}:${referencia}`
      if (referencias.has(chave)) throw new Error('ARTE_CATALOGO_DUPLICADA')
      referencias.add(chave)
    }
    if (!Array.isArray(v.medidas) || v.medidas.length > 20)
      throw new Error('LIMITE_MEDIDAS_DECORISI')
    const medidas = v.medidas.map((m: unknown) => {
      if (!m || typeof m !== 'object')
        throw new Error('MEDIDA_DECORISI_INVALIDA')
      const medida = m as Record<string, unknown>
      function dimensao(d: unknown) {
        if (d === null || d === undefined) return null
        if (
          typeof d !== 'number' ||
          !Number.isInteger(d) ||
          d < 1 ||
          d > DIMENSAO_MAXIMA_DECORISI_CM
        )
          throw new Error('MEDIDA_DECORISI_INVALIDA')
        return d
      }
      return {
        larguraCm: dimensao(medida.larguraCm),
        alturaCm: dimensao(medida.alturaCm),
        ambiente: texto(medida.ambiente, 80),
      }
    })
    return {
      ...(id ? { id } : {}),
      tipo: v.tipo as ItemDecorisi['tipo'],
      classificacao: v.classificacao as ItemDecorisi['classificacao'],
      referencia,
      descricao: texto(v.descricao, 500),
      observacoes: texto(v.observacoes, 500),
      medidas,
    }
  })
}
function texto(valor: unknown, limite: number): string | null {
  if (valor === undefined || valor === null || valor === '') return null
  if (typeof valor !== 'string' || valor.trim().length > limite)
    throw new Error('TEXTO_DECORISI_INVALIDO')
  return valor.trim() || null
}
