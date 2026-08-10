import { describe, expect, it } from 'vitest'
import { gerarMensagemPedidoPersonalizado } from './mensagem'
import type {
  PedidoPersonalizadoMoriahEntrada,
  ProdutoCatalogoMoriah,
  TapeteMoriahEntrada,
} from './tipos'
import { validarPedidoPersonalizadoMoriah } from './validacao'

const PRODUTOS: ProdutoCatalogoMoriah[] = [
  {
    id: 'produto-21157',
    codigo: '21157',
    descricao: 'TAPETE PERSONALIZADO MORIAH M² (UMA MEDIDA PADRÃO até 1,95 OU 0,95 CM)',
  },
  {
    id: 'produto-21158',
    codigo: '21158',
    descricao: 'TAPETE PERSONALIZADO MORIAH ESPECIAL M² (SEM EMENDA)',
  },
  {
    id: 'produto-21159',
    codigo: '21159',
    descricao: 'TAPETE PERSONALIZADO MORIAH ESPECIAL M² (2 MEDIDAS ACIMA DE 2M COM EMENDA)',
  },
]

function tapete(overrides: Partial<TapeteMoriahEntrada> = {}): TapeteMoriahEntrada {
  return {
    ordem: 1,
    formato: 'RETANGULAR',
    tipo: 'PERSONALIZADO',
    dimensao1Metros: '2,00',
    dimensao2Metros: '3,00',
    cores: [],
    teveAlteracaoLayout: false,
    quantidadeAlteracoesLayout: null,
    ...overrides,
  }
}

function normalizar(tapetes: TapeteMoriahEntrada[], overrides: Partial<PedidoPersonalizadoMoriahEntrada> = {}) {
  const resultado = validarPedidoPersonalizadoMoriah({
    fornecedor: 'moriah_tapetes',
    unidade: 'bigorrilho',
    consultora: 'Niége Silva',
    cliente: 'Cliente Bebê',
    telefone: '41999999999',
    tapetes,
    ...overrides,
  })
  expect(resultado.erros).toEqual([])
  return resultado.dados!
}

describe('mensagem comercial de Pedidos Personalizados', () => {
  it('gera mensagem mínima de um tapete retangular', () => {
    const resultado = gerarMensagemPedidoPersonalizado(normalizar([tapete()]), PRODUTOS)
    expect(resultado.valido).toBe(true)
    expect(resultado.dados).toContain('FORNECEDOR: MORIAH TAPETES')
    expect(resultado.dados).toContain('UNIDADE: BIGORRILHO')
    expect(resultado.dados).toContain('CONSULTORA: NIÉGE SILVA')
    expect(resultado.dados).toContain('CLIENTE: CLIENTE BEBÊ')
    expect(resultado.dados).toContain('TAPETE 1\nTIPO: PERSONALIZADO\nFORMATO: RETANGULAR\nMEDIDAS: 2,00 M X 3,00 M')
    expect(resultado.dados).toContain('METRO QUADRADO: 6,00 M²')
    expect(resultado.dados).toContain(`PRODUTO: 21158 - ${PRODUTOS[1].descricao}`)
  })

  it('inclui todos os tapetes e formata redondo, retangular e orgânico', () => {
    const pedido = normalizar([
      tapete({ ordem: 1, formato: 'REDONDO', dimensao1Metros: '2,00', dimensao2Metros: null }),
      tapete({ ordem: 2 }),
      tapete({ ordem: 3, formato: 'ORGANICO', dimensao1Metros: '2,01', dimensao2Metros: '2,01' }),
    ])
    const mensagem = gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).dados!
    expect(mensagem).toContain('TAPETE 1\nTIPO: PERSONALIZADO\nFORMATO: REDONDO\nDIÂMETRO: 2,00 M')
    expect(mensagem).toContain('TAPETE 2\nTIPO: PERSONALIZADO\nFORMATO: RETANGULAR')
    expect(mensagem).toContain('TAPETE 3\nTIPO: PERSONALIZADO\nFORMATO: ORGÂNICO')
    expect(mensagem).toContain(`PRODUTO: 21159 - ${PRODUTOS[2].descricao}`)
  })

  it('exibe PORTÃO sem alterar a chave interna', () => {
    const pedido = normalizar([tapete()], { unidade: 'portao' })
    expect(pedido.unidade).toBe('portao')
    expect(gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).dados).toContain('UNIDADE: PORTÃO')
  })

  it('inclui opcionais preenchidos, acentos, observações multilinha e seis cores na ordem', () => {
    const cores = Array.from({ length: 6 }, (_, indice) => ({
      id: `cor-${indice + 1}`,
      ordem: indice + 1,
      numero: String(indice + 1).padStart(2, '0'),
      codigo: `K-${indice + 1}`,
      nome: indice === 0 ? 'Índigo' : `Cor ${indice + 1}`,
    }))
    const pedido = normalizar([
      tapete({
        dimensao1Metros: '0,95',
        nomeColecaoCatalogo: ' Coleção Formas ',
        referenciaCatalogo: ' abc-123 ',
        observacoes: 'Primeira linha\nSegunda linha',
        cores,
      }),
    ], { numeroLancamento: ' 000123 ' })
    const mensagem = gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).dados!
    expect(mensagem).toContain('Nº DE LANÇAMENTO: 000123')
    expect(mensagem).toContain(`PRODUTO: 21157 - ${PRODUTOS[0].descricao}`)
    expect(mensagem).toContain('NOME DA COLEÇÃO CATÁLOGO: COLEÇÃO FORMAS')
    expect(mensagem).toContain('REFERÊNCIA DO TAPETE DO CATÁLOGO: ABC-123')
    expect(mensagem).toContain('CORES:\n01 - K-1 - Índigo\n02 - K-2 - Cor 2')
    expect(mensagem).toContain('06 - K-6 - Cor 6')
    expect(mensagem).toContain('OBSERVAÇÕES: Primeira linha\nSegunda linha')
  })

  it('omite campos opcionais vazios e a seção de zero cores', () => {
    const mensagem = gerarMensagemPedidoPersonalizado(normalizar([tapete()]), PRODUTOS).dados!
    expect(mensagem).not.toContain('Nº DE LANÇAMENTO')
    expect(mensagem).not.toContain('NOME DA COLEÇÃO')
    expect(mensagem).not.toContain('REFERÊNCIA DO TAPETE')
    expect(mensagem).not.toContain('CORES:')
    expect(mensagem).not.toContain('OBSERVAÇÕES:')
  })

  it('não inclui anexos, layout, status, comprador, pedido de compra, datas, preço ou percentual', () => {
    const pedido = normalizar([tapete({ teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 6 })], {
      comprador: 'João Silva',
      numeroPedidoCompra: '0005',
      dataEntrega: '05/08/2026',
      dataPedidoFornecedor: '06/08/2026',
      status: 'EM PRODUÇÃO',
    })
    const mensagem = gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).dados!
    for (const termo of ['ANEXO', 'LAYOUT', 'STATUS:', 'COMPRADOR:', 'PEDIDO DE COMPRA', '05/08/2026', '06/08/2026', 'PREÇO', '%']) {
      expect(mensagem).not.toContain(termo)
    }
  })

  it('rejeita produto ausente sem criar segunda fonte de descrição', () => {
    const resultado = gerarMensagemPedidoPersonalizado(normalizar([tapete()]), [])
    expect(resultado).toMatchObject({ valido: false, dados: null, erros: [{ codigo: 'PRODUTO_CATALOGO_AUSENTE' }] })
  })

  it('rejeita cor sem dados de catálogo necessários à mensagem', () => {
    const pedido = normalizar([tapete({ cores: [{ id: 'cor-1', ordem: 1 }] })])
    expect(gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).erros[0].codigo).toBe('COR_CATALOGO_INCOMPLETA')
  })

  it('identifica claramente um tapete Catálogo e nunca exibe seção de cores vazia', () => {
    const pedido = normalizar([tapete({
      tipo: 'CATALOGO',
      nomeColecaoCatalogo: 'Coleção Formas',
      referenciaCatalogo: 'ABC-123',
    })])
    const mensagem = gerarMensagemPedidoPersonalizado(pedido, PRODUTOS).dados!
    expect(mensagem).toContain('TIPO: CATÁLOGO')
    expect(mensagem).toContain('NOME DA COLEÇÃO CATÁLOGO: COLEÇÃO FORMAS')
    expect(mensagem).toContain('REFERÊNCIA DO TAPETE DO CATÁLOGO: ABC-123')
    expect(mensagem).not.toContain('CORES:')
  })
})
