import type {
  CodigoProdutoMoriah,
  FormatoTapeteMoriah,
  StatusPedidoPersonalizado,
  UnidadePedidoPersonalizado,
} from './tipos'

export const FORMATOS_TAPETE_MORIAH = ['REDONDO', 'RETANGULAR', 'ORGANICO'] as const

export const STATUS_PEDIDO_PERSONALIZADO = [
  'CADASTRADO',
  'AGUARDANDO LAYOUT',
  'AGUARDANDO APROVAÇÃO DO CLIENTE',
  'EM PRODUÇÃO',
  'RECEBIDO',
  'CANCELADO',
] as const

export const UNIDADES_PEDIDO_PERSONALIZADO = [
  'bigorrilho',
  'portao',
  'marechal',
  'feira',
] as const

export const FORNECEDOR_MORIAH = 'moriah_tapetes' as const
export const CODIGOS_PRODUTO_MORIAH = ['21157', '21158', '21159'] as const

export const LIMITE_TAPETES_POR_PEDIDO = 10
export const LIMITE_CORES_POR_TAPETE = 6
export const MEDIDA_MINIMA_CM = 10
export const MEDIDA_MAXIMA_CM = 1500

export const AVISO_MEDIDA_RECOMENDADA =
  'A Moriah produz preferencialmente em medidas de 5 cm em 5 cm. A medida final pode ser aproximada pelo fabricante e sofrer variação de até 2%.'

export const AVISO_MUITAS_ALTERACOES_LAYOUT =
  'Este tapete possui mais de 5 alterações de layout e poderá ter custo adicional.'

export const UNIDADE_PARA_EXIBICAO: Record<UnidadePedidoPersonalizado, string> = {
  bigorrilho: 'BIGORRILHO',
  portao: 'PORTÃO',
  marechal: 'MARECHAL',
  feira: 'FEIRA',
}

export const FORMATO_PARA_EXIBICAO: Record<FormatoTapeteMoriah, string> = {
  REDONDO: 'REDONDO',
  RETANGULAR: 'RETANGULAR',
  ORGANICO: 'ORGÂNICO',
}

export function ehFormatoTapeteMoriah(valor: string): valor is FormatoTapeteMoriah {
  return FORMATOS_TAPETE_MORIAH.includes(valor as FormatoTapeteMoriah)
}

export function ehStatusPedidoPersonalizado(valor: string): valor is StatusPedidoPersonalizado {
  return STATUS_PEDIDO_PERSONALIZADO.includes(valor as StatusPedidoPersonalizado)
}

export function ehUnidadePedidoPersonalizado(valor: string): valor is UnidadePedidoPersonalizado {
  return UNIDADES_PEDIDO_PERSONALIZADO.includes(valor as UnidadePedidoPersonalizado)
}

export function ehCodigoProdutoMoriah(valor: string): valor is CodigoProdutoMoriah {
  return CODIGOS_PRODUTO_MORIAH.includes(valor as CodigoProdutoMoriah)
}
