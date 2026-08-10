import { FORMATO_PARA_EXIBICAO, TIPO_TAPETE_PARA_EXIBICAO, UNIDADE_PARA_EXIBICAO } from './constantes'
import { formatarAreaMetrosQuadrados, formatarMedidaMetros } from './medidas'
import type {
  CodigoErroPedidoPersonalizado,
  PedidoPersonalizadoMoriahNormalizado,
  ProblemaPedidoPersonalizado,
  ProdutoCatalogoMoriah,
  ResultadoValidacao,
} from './tipos'

export function gerarMensagemPedidoPersonalizado(
  pedido: PedidoPersonalizadoMoriahNormalizado,
  produtos: readonly ProdutoCatalogoMoriah[]
): ResultadoValidacao<string> {
  const erros: ProblemaPedidoPersonalizado<CodigoErroPedidoPersonalizado>[] = []
  const linhas = [
    'FORNECEDOR: MORIAH TAPETES',
    `UNIDADE: ${UNIDADE_PARA_EXIBICAO[pedido.unidade]}`,
    `CONSULTORA: ${pedido.consultora}`,
    `CLIENTE: ${pedido.cliente}`,
  ]

  if (pedido.numeroLancamento) linhas.push(`Nº DE LANÇAMENTO: ${pedido.numeroLancamento}`)

  pedido.tapetes.forEach((tapete, indice) => {
    const produto = produtos.find((item) => item.codigo === tapete.codigoProduto && item.id.trim() && item.descricao.trim())
    if (!produto) {
      erros.push({
        codigo: 'PRODUTO_CATALOGO_AUSENTE',
        campo: `tapetes.${indice}.produto`,
        mensagem: 'O produto calculado não está disponível no catálogo informado.',
      })
    }

    linhas.push(
      '',
      `TAPETE ${indice + 1}`,
      `TIPO: ${TIPO_TAPETE_PARA_EXIBICAO[tapete.tipo]}`,
      `FORMATO: ${FORMATO_PARA_EXIBICAO[tapete.formato]}`
    )
    if (tapete.formato === 'REDONDO') {
      linhas.push(`DIÂMETRO: ${formatarMedidaMetros(tapete.dimensao1Cm)} M`)
    } else if (tapete.dimensao2Cm === null) {
      erros.push({
        codigo: 'DIMENSOES_INCOMPATIVEIS',
        campo: `tapetes.${indice}.dimensao2Cm`,
        mensagem: 'Retangular e orgânico exigem duas dimensões.',
      })
    } else {
      linhas.push(
        `MEDIDAS: ${formatarMedidaMetros(tapete.dimensao1Cm)} M X ${formatarMedidaMetros(tapete.dimensao2Cm)} M`
      )
    }

    const area = formatarAreaMetrosQuadrados(tapete.areaCobradaCentesimosM2).replace(' m²', '')
    linhas.push(`METRO QUADRADO: ${area} M²`)
    if (produto) linhas.push(`PRODUTO: ${produto.codigo} - ${produto.descricao}`)
    if (tapete.nomeColecaoCatalogo) linhas.push(`NOME DA COLEÇÃO CATÁLOGO: ${tapete.nomeColecaoCatalogo}`)
    if (tapete.referenciaCatalogo) linhas.push(`REFERÊNCIA DO TAPETE DO CATÁLOGO: ${tapete.referenciaCatalogo}`)

    if (tapete.cores.length > 0) {
      const coresCompletas = tapete.cores.every((cor) => cor.numero && cor.codigo && cor.nome)
      if (!coresCompletas) {
        erros.push({
          codigo: 'COR_CATALOGO_INCOMPLETA',
          campo: `tapetes.${indice}.cores`,
          mensagem: 'A mensagem exige número, código e nome das cores selecionadas.',
        })
      } else {
        linhas.push('CORES:')
        for (const cor of tapete.cores) linhas.push(`${cor.numero} - ${cor.codigo} - ${cor.nome}`)
      }
    }

    if (tapete.observacoes) linhas.push(`OBSERVAÇÕES: ${tapete.observacoes}`)
  })

  return {
    valido: erros.length === 0,
    dados: erros.length === 0 ? linhas.join('\n') : null,
    erros,
    avisos: [],
  }
}
