import { describe, expect, it } from 'vitest'
import {
  ehCodigoProdutoMoriah,
  ehFormatoTapeteMoriah,
  ehStatusPedidoPersonalizado,
  ehUnidadePedidoPersonalizado,
} from './constantes'
import type {
  CorSelecionadaMoriahEntrada,
  PedidoPersonalizadoMoriahEntrada,
  ProdutoCatalogoMoriah,
  TapeteMoriahEntrada,
} from './tipos'
import {
  converterDataAdministrativaParaISO,
  montarPayloadLayoutMoriahRpc,
  montarPayloadTapetesMoriahRpc,
  validarAlteracoesLayout,
  validarCoresSelecionadas,
  validarPedidoPersonalizadoMoriah,
} from './validacao'

const PRODUTOS: ProdutoCatalogoMoriah[] = [
  { id: 'produto-21157', codigo: '21157', descricao: 'Produto 21157' },
  { id: 'produto-21158', codigo: '21158', descricao: 'Produto 21158' },
  { id: 'produto-21159', codigo: '21159', descricao: 'Produto 21159' },
]

function cores(quantidade: number): CorSelecionadaMoriahEntrada[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    id: `cor-${indice + 1}`,
    ordem: indice + 1,
    numero: String(indice + 1).padStart(2, '0'),
    codigo: `K-${indice + 1}`,
    nome: `Cor ${indice + 1}`,
  }))
}

function tapete(overrides: Partial<TapeteMoriahEntrada> = {}): TapeteMoriahEntrada {
  return {
    ordem: 1,
    formato: 'RETANGULAR',
    dimensao1Metros: '2,00',
    dimensao2Metros: '3,00',
    cores: [],
    teveAlteracaoLayout: false,
    quantidadeAlteracoesLayout: null,
    ...overrides,
  }
}

function pedido(overrides: Partial<PedidoPersonalizadoMoriahEntrada> = {}): PedidoPersonalizadoMoriahEntrada {
  return {
    fornecedor: 'moriah_tapetes',
    unidade: 'bigorrilho',
    consultora: '  Niége   Silva ',
    cliente: '  Cliente  2 ',
    tapetes: [tapete()],
    ...overrides,
  }
}

describe('constantes tipadas', () => {
  it('reconhece somente formatos, status, unidades e produtos permitidos', () => {
    expect(ehFormatoTapeteMoriah('ORGANICO')).toBe(true)
    expect(ehFormatoTapeteMoriah('OVAL')).toBe(false)
    expect(ehStatusPedidoPersonalizado('EM PRODUÇÃO')).toBe(true)
    expect(ehStatusPedidoPersonalizado('CANCELADO')).toBe(false)
    expect(ehUnidadePedidoPersonalizado('feira')).toBe(true)
    expect(ehUnidadePedidoPersonalizado('pos_venda')).toBe(false)
    expect(ehCodigoProdutoMoriah('21159')).toBe(true)
    expect(ehCodigoProdutoMoriah('99999')).toBe(false)
  })
})

describe('validação de cores', () => {
  it.each([0, 1, 6])('aceita %i cores sem aviso', (quantidade) => {
    const resultado = validarCoresSelecionadas(cores(quantidade))
    expect(resultado).toMatchObject({ valido: true, avisos: [] })
    expect(resultado.dados?.map((cor) => cor.id)).toEqual(cores(quantidade).map((cor) => cor.id))
  })

  it.each([7, 8])('aceita %i cores com aviso não bloqueante', (quantidade) => {
    const resultado = validarCoresSelecionadas(cores(quantidade))
    expect(resultado.valido).toBe(true)
    expect(resultado.avisos).toEqual([
      expect.objectContaining({ codigo: 'MUITAS_CORES', mensagem: expect.stringContaining('mais de 6 cores') }),
    ])
  })

  it('rejeita nove cores', () => {
    expect(validarCoresSelecionadas(cores(9)).erros).toContainEqual(expect.objectContaining({ codigo: 'LIMITE_CORES' }))
  })

  it('rejeita cor, ordem e posição inválidas ou duplicadas', () => {
    const resultado = validarCoresSelecionadas([
      { id: 'cor-1', ordem: 1 },
      { id: 'cor-1', ordem: 1 },
      { id: '', ordem: 9 },
    ])
    expect(resultado.erros.map((item) => item.codigo)).toEqual(expect.arrayContaining([
      'COR_DUPLICADA', 'COR_INVALIDA', 'ORDEM_COR_DUPLICADA', 'ORDEM_COR_INVALIDA',
    ]))
  })
})

describe('validação de alterações de layout', () => {
  it.each([null, 0])('aceita falso com quantidade %s e normaliza para null', (quantidade) => {
    expect(validarAlteracoesLayout(false, quantidade)).toMatchObject({
      valido: true,
      dados: { teveAlteracao: false, quantidade: null },
    })
  })

  it('rejeita falso com valor positivo, verdadeiro nulo e verdadeiro zero', () => {
    expect(validarAlteracoesLayout(false, 1).valido).toBe(false)
    expect(validarAlteracoesLayout(true, null).valido).toBe(false)
    expect(validarAlteracoesLayout(true, 0).valido).toBe(false)
  })

  it.each([1, 5])('aceita verdadeiro com %i sem aviso', (quantidade) => {
    expect(validarAlteracoesLayout(true, quantidade)).toMatchObject({ valido: true, avisos: [] })
  })

  it('aceita seis com aviso não bloqueante', () => {
    expect(validarAlteracoesLayout(true, 6)).toMatchObject({
      valido: true,
      avisos: [{ codigo: 'MUITAS_ALTERACOES_LAYOUT' }],
    })
  })
})

describe('datas administrativas', () => {
  it('converte datas reais sem depender de fuso horário', () => {
    expect(converterDataAdministrativaParaISO('05/08/2026').dados).toBe('2026-08-05')
    expect(converterDataAdministrativaParaISO('29/02/2028').dados).toBe('2028-02-29')
    expect(converterDataAdministrativaParaISO(' 05/08/2026 ').dados).toBe('2026-08-05')
  })

  it('rejeita datas inexistentes e ano não bissexto', () => {
    expect(converterDataAdministrativaParaISO('31/02/2026').valido).toBe(false)
    expect(converterDataAdministrativaParaISO('29/02/2027').valido).toBe(false)
    expect(converterDataAdministrativaParaISO('01/01/0000').valido).toBe(false)
  })

  it('mantém campo vazio como null', () => {
    expect(converterDataAdministrativaParaISO('').dados).toBeNull()
    expect(converterDataAdministrativaParaISO(null).dados).toBeNull()
  })

  it('produz o mesmo dia sob fusos extremos', () => {
    const anterior = process.env.TZ
    process.env.TZ = 'Pacific/Kiritimati'
    expect(converterDataAdministrativaParaISO('05/08/2026').dados).toBe('2026-08-05')
    process.env.TZ = 'America/Adak'
    expect(converterDataAdministrativaParaISO('05/08/2026').dados).toBe('2026-08-05')
    process.env.TZ = anterior
  })
})

describe('validação completa do pedido Moriah', () => {
  it('normaliza um pedido mínimo válido e calcula área e produto', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      fornecedor: ' moriah_tapetes ',
      unidade: ' bigorrilho ',
      status: ' CADASTRADO ',
      tapetes: [tapete({ formato: ' RETANGULAR ' })],
    }))
    expect(resultado).toMatchObject({ valido: true, erros: [] })
    expect(resultado.dados).toMatchObject({
      fornecedor: 'moriah_tapetes',
      unidade: 'bigorrilho',
      consultora: 'NIÉGE SILVA',
      cliente: 'CLIENTE 2',
      status: 'CADASTRADO',
      tapetes: [{ dimensao1Cm: 200, dimensao2Cm: 300, areaCobradaCentesimosM2: 600, codigoProduto: '21158' }],
    })
  })

  it('aceita dez tapetes com ordens únicas', () => {
    const tapetes = Array.from({ length: 10 }, (_, indice) => tapete({ ordem: indice + 1 }))
    expect(validarPedidoPersonalizadoMoriah(pedido({ tapetes })).valido).toBe(true)
  })

  it('rejeita onze tapetes e unidade pos_venda', () => {
    const tapetes = Array.from({ length: 11 }, (_, indice) => tapete({ ordem: indice + 1 }))
    const resultado = validarPedidoPersonalizadoMoriah(pedido({ unidade: 'pos_venda', tapetes }))
    expect(resultado.erros.map((item) => item.codigo)).toEqual(expect.arrayContaining(['UNIDADE_INVALIDA', 'LIMITE_TAPETES']))
  })

  it('rejeita tapete inválido e acumula vários erros sem dados pessoais nas mensagens', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      fornecedor: 'decorisi',
      consultora: 'A1',
      cliente: '   ',
      comprador: 'J@',
      numeroLancamento: '12A',
      numeroPedidoCompra: '1'.repeat(21),
      dataEntrega: '31/02/2026',
      tapetes: [tapete({ formato: 'REDONDO', dimensao1Metros: '0,099', dimensao2Metros: '2,00', referenciaCatalogo: 'ABC 123' })],
    }))
    expect(resultado.valido).toBe(false)
    expect(resultado.dados).toBeNull()
    expect(resultado.erros.map((item) => item.codigo)).toEqual(expect.arrayContaining([
      'FORNECEDOR_INVALIDO', 'CONSULTORA_INVALIDA', 'CLIENTE_OBRIGATORIO', 'COMPRADOR_INVALIDO',
      'NUMERO_LANCAMENTO_INVALIDO', 'NUMERO_PEDIDO_COMPRA_INVALIDO', 'DATA_INVALIDA',
      'MEDIDA_INVALIDA', 'DIMENSOES_INCOMPATIVEIS', 'REFERENCIA_INVALIDA',
    ]))
    expect(resultado.erros.map((item) => item.mensagem).join(' ')).not.toContain('A1')
  })

  it('preserva zeros, valida coleção/referência e limites de observação', () => {
    const valido = validarPedidoPersonalizadoMoriah(pedido({
      numeroLancamento: ' 0001 ',
      numeroPedidoCompra: ' 0002 ',
      comprador: '  João   Silva ',
      tapetes: [tapete({
        nomeColecaoCatalogo: ' coleção formas ',
        referenciaCatalogo: ' abc-123 ',
        observacoes: `  ${'a'.repeat(500)}  `,
      })],
    }))
    expect(valido.dados).toMatchObject({
      numeroLancamento: '0001',
      numeroPedidoCompra: '0002',
      comprador: 'JOÃO SILVA',
      tapetes: [{ nomeColecaoCatalogo: 'COLEÇÃO FORMAS', referenciaCatalogo: 'ABC-123', observacoes: 'a'.repeat(500) }],
    })
    const invalido = validarPedidoPersonalizadoMoriah(pedido({ tapetes: [tapete({ observacoes: 'a'.repeat(501) })] }))
    expect(invalido.erros).toContainEqual(expect.objectContaining({ codigo: 'OBSERVACOES_EXCEDIDAS' }))
  })

  it('aceita os novos limites de lançamento, coleção e referência', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      numeroLancamento: '000001',
      tapetes: [tapete({
        nomeColecaoCatalogo: 'C'.repeat(30),
        referenciaCatalogo: 'R'.repeat(20),
      })],
    }))
    expect(resultado.valido).toBe(true)
    expect(resultado.dados).toMatchObject({
      numeroLancamento: '000001',
      tapetes: [{ nomeColecaoCatalogo: 'C'.repeat(30), referenciaCatalogo: 'R'.repeat(20) }],
    })
  })

  it.each(['', '1', '000001'])('aceita lançamento vazio ou com até 6 dígitos: %s', (numeroLancamento) => {
    expect(validarPedidoPersonalizadoMoriah(pedido({ numeroLancamento })).valido).toBe(true)
  })

  it.each(['1234567', '12A456', '12 456', '+12345', '1,2345'])('rejeita lançamento inválido: %s', (numeroLancamento) => {
    expect(validarPedidoPersonalizadoMoriah(pedido({ numeroLancamento })).erros).toContainEqual(
      expect.objectContaining({ campo: 'numeroLancamento', codigo: 'NUMERO_LANCAMENTO_INVALIDO' })
    )
  })

  it('rejeita lançamento com 7, coleção com 31 e referência com 21 caracteres', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      numeroLancamento: '0000001',
      tapetes: [tapete({
        nomeColecaoCatalogo: 'C'.repeat(31),
        referenciaCatalogo: 'R'.repeat(21),
      })],
    }))
    expect(resultado.erros).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'numeroLancamento', mensagem: expect.stringContaining('máximo 6 dígitos') }),
      expect.objectContaining({ campo: 'tapetes.0.nomeColecaoCatalogo', mensagem: expect.stringContaining('máximo 30 caracteres') }),
      expect.objectContaining({ campo: 'tapetes.0.referenciaCatalogo', mensagem: expect.stringContaining('máximo 20 caracteres') }),
    ]))
  })

  it('produz mensagens específicas para campos obrigatórios e medidas', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      unidade: '',
      consultora: '',
      cliente: '',
      tapetes: [tapete({ dimensao1Metros: '', dimensao2Metros: '' })],
    }))
    expect(resultado.erros).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'unidade', mensagem: 'Selecione uma unidade.' }),
      expect.objectContaining({ campo: 'consultora', mensagem: 'Informe o nome da consultora.' }),
      expect.objectContaining({ campo: 'cliente', mensagem: 'Informe o nome do cliente.' }),
      expect.objectContaining({ campo: 'tapetes.0.dimensao1Metros', mensagem: 'Informe a largura do tapete.' }),
      expect.objectContaining({ campo: 'tapetes.0.dimensao2Metros', mensagem: 'Informe o comprimento do tapete.' }),
    ]))
  })

  it('aceita referência com hífen e rejeita espaço ou símbolo', () => {
    expect(validarPedidoPersonalizadoMoriah(pedido({ tapetes: [tapete({ referenciaCatalogo: 'ABC-123' })] })).valido).toBe(true)
    for (const referenciaCatalogo of ['ABC 123', 'ABC_123']) {
      expect(validarPedidoPersonalizadoMoriah(pedido({ tapetes: [tapete({ referenciaCatalogo })] })).erros).toContainEqual(
        expect.objectContaining({ campo: 'tapetes.0.referenciaCatalogo', codigo: 'REFERENCIA_INVALIDA' })
      )
    }
  })

  it('mantém erros bloqueantes separados dos avisos não bloqueantes', () => {
    const resultado = validarPedidoPersonalizadoMoriah(pedido({
      unidade: 'pos_venda',
      tapetes: [tapete({ dimensao1Metros: '2,03', cores: cores(7), teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 6 })],
    }))
    expect(resultado.erros).toContainEqual(expect.objectContaining({ codigo: 'UNIDADE_INVALIDA' }))
    expect(resultado.avisos.map((item) => item.codigo)).toEqual(expect.arrayContaining([
      'MEDIDA_FORA_INTERVALO_RECOMENDADO', 'MUITAS_CORES', 'MUITAS_ALTERACOES_LAYOUT',
    ]))
  })
})

describe('adaptadores puros compatíveis com as RPCs da Fase 1B', () => {
  it('gera o JSONB comercial com nomes snake_case e sem layout', () => {
    const validacao = validarPedidoPersonalizadoMoriah(pedido({
      tapetes: [tapete({ id: 'tapete-1', cores: cores(1), teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 2 })],
    }))
    const resultado = montarPayloadTapetesMoriahRpc(validacao.dados!.tapetes, PRODUTOS)
    expect(resultado.dados).toEqual([{
      id: 'tapete-1',
      ordem: 1,
      formato: 'RETANGULAR',
      dimensao_1_cm: 200,
      dimensao_2_cm: 300,
      area_cobrada_centesimos_m2: 600,
      produto_id: 'produto-21158',
      nome_colecao_catalogo: null,
      referencia_catalogo: null,
      observacoes: null,
      cores: [{ cor_id: 'cor-1', ordem: 1 }],
    }])
    expect(JSON.stringify(resultado.dados)).not.toContain('layout')
  })

  it('rejeita catálogo sem o código calculado', () => {
    const validacao = validarPedidoPersonalizadoMoriah(pedido())
    expect(montarPayloadTapetesMoriahRpc(validacao.dados!.tapetes, []).erros[0].codigo).toBe('PRODUTO_CATALOGO_AUSENTE')
  })

  it('gera layout administrativo separado e omite quantidade quando falso', () => {
    const validacao = validarPedidoPersonalizadoMoriah(pedido({ tapetes: [tapete({ id: 'tapete-1' })] }))
    expect(montarPayloadLayoutMoriahRpc(validacao.dados!.tapetes).dados).toEqual([{
      tapete_id: 'tapete-1',
      teve_alteracao_layout: false,
    }])
  })

  it('exige id persistido para o payload administrativo', () => {
    const validacao = validarPedidoPersonalizadoMoriah(pedido())
    expect(montarPayloadLayoutMoriahRpc(validacao.dados!.tapetes).erros[0].codigo).toBe('TAPETE_ID_INVALIDO')
  })
})
