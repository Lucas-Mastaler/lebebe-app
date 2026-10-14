import { describe, it, expect } from 'vitest'
import {
  carregarArtigosDecorisi,
  mascararMedidaDecorisi,
  normalizarMedidaDecorisi,
  editarMedidaDecorisi,
  errosArtigoDecorisi,
  errosFormularioDecorisi,
  formatarCentavosDecorisi,
  montarItensFormularioDecorisi,
  metrosParaCentimetrosDecorisi,
  novoArtigoDecorisi,
  preverArtigoDecorisi,
  procurarArteCatalogo,
  type OpcoesFormularioDecorisi,
  type PedidoFormularioDecorisi,
} from './formulario'
import { pesquisarReferenciasPf } from './catalogo'
describe('entrada e validação contextual Decorisi', () => {
  it('valida limites por campo sem alterar o valor digitado', () => {
    const artigo = novoArtigoDecorisi()
    const medida = artigo.medidas[0]
    medida.ambiente = 'a'.repeat(31)
    medida.largura = '21474836,48'
    medida.altura = '0,00'
    const erros = errosArtigoDecorisi(artigo, opcoes)
    expect(Object.keys(erros)).toEqual([
      `${medida.chave}-ambiente`,
      `${medida.chave}-largura`,
      `${medida.chave}-altura`,
    ])
    expect(medida.largura).toBe('21474836,48')
  })
  it('preserva digitação progressiva e sanitiza colagem', () => {
    expect(mascararMedidaDecorisi('3')).toBe('0,03')
    expect(mascararMedidaDecorisi('30')).toBe('0,30')
    expect(mascararMedidaDecorisi('300')).toBe('3,00')
    expect(mascararMedidaDecorisi('350')).toBe('3,50')
    expect(mascararMedidaDecorisi('1234')).toBe('12,34')
    expect(mascararMedidaDecorisi('9999')).toBe('99,99')
    expect(mascararMedidaDecorisi('10000')).toBe('10,00')
    expect(mascararMedidaDecorisi('ab 3.50 m')).toBe('3,50')
    expect(mascararMedidaDecorisi('3,,5')).toBe('0,35')
    expect(normalizarMedidaDecorisi('03,5')).toBe('3,50')
    expect(normalizarMedidaDecorisi('')).toBe('')
  })
  it('edita com seleção, cursor, Backspace, Delete e limite de quatro dígitos', () => {
    expect(editarMedidaDecorisi('3,50', 0, 4, '1e3').valor).toBe('3,50')
    expect(editarMedidaDecorisi('3,50', 0, 4, '-100').valor).toBe('3,50')
    expect(editarMedidaDecorisi('3,50', 0, 4, '3,50').valor).toBe('3,50')
    expect(editarMedidaDecorisi('3,50', 4, 4, '', 'Backspace').valor).toBe(
      '0,35',
    )
    expect(editarMedidaDecorisi('3,50', 0, 4, '1234').valor).toBe('12,34')
    expect(editarMedidaDecorisi('12,34', 5, 5, '5').valor).toBe('12,34')
    expect(editarMedidaDecorisi('3,50', 0, 0, '', 'Delete').valor).toBe('0,50')
    expect(editarMedidaDecorisi('3,50', 1, 2, '9').valor).toBe('39,50')
  })
  it('permite rascunho incompleto e aponta campos necessários para conclusão', () => {
    const artigo = novoArtigoDecorisi()
    expect(errosArtigoDecorisi(artigo, opcoes)).toEqual({})
    const erros = errosArtigoDecorisi(artigo, opcoes, true)
    expect(erros[`${artigo.id}-referencia`]).toBeTruthy()
    expect(erros[`${artigo.medidas[0].chave}-largura`]).toBeTruthy()
    expect(montarItensFormularioDecorisi([artigo])[0]).not.toHaveProperty(
      'produtoRespondido',
    )
  })
  it('associa altura impossível à parede e bloqueia a estimativa sem limitar largura comercial', () => {
    const artigo = novoArtigoDecorisi()
    artigo.referencia = 'DB813'
    artigo.medidas[0].largura = '200,00'
    artigo.medidas[0].altura = '20,00'
    expect(
      errosArtigoDecorisi(artigo, opcoes)[`${artigo.medidas[0].chave}-altura`],
    ).toContain('não cabe')
    expect(preverArtigoDecorisi(artigo, opcoes).quantidade).toBeUndefined()
    artigo.medidas[0].altura = '2,50'
    expect(errosArtigoDecorisi(artigo, opcoes)).toEqual({})
    expect(preverArtigoDecorisi(artigo, opcoes).quantidade).toBeTruthy()
  })
})
const opcoes: OpcoesFormularioDecorisi = {
  db: [{ id: 'db', referencia: 'DB813', repeticao_m: '0.00', versao: 1 }],
  pf: pesquisarReferenciasPf(''),
  unidades: [],
  precos: [36565, 36566, 36567, 36568].map((id, i) => ({
    produto_id_sgi: id,
    codigo: String(19075 + i),
    descricao: null,
    preco: '230.00',
    ativo: true,
    fora_linha: false,
    ultima_validacao_sgi: null,
  })),
}
const identificacao = {
  unidade: 'bigorrilho',
  consultora: 'Teste',
  cliente: 'Cliente',
  telefone: '41999999999',
}
describe('formulário Decorisi', () => {
  it.each([
    ['3,50', 350],
    ['1.01', 101],
    ['0,01', 1],
    ['', null],
    ['21474836.47', 2147483647],
  ])('converte %s sem arredondamento', (valor, cm) =>
    expect(metrosParaCentimetrosDecorisi(valor as string)).toBe(cm),
  )
  it.each([
    '0',
    '-1',
    '1.001',
    'NaN',
    'Infinity',
    '1e3',
    '21474836.48',
    '1,2.3',
  ])('rejeita medida %s', (valor) =>
    expect(() => metrosParaCentimetrosDecorisi(valor)).toThrow(),
  )
  it('rascunho aceita ausência, conserva UUID e não envia preço ou anexos', () => {
    const a = novoArtigoDecorisi()
    a.anexos = [
      {
        id: 'anexo',
        slot: 1,
        nome_original: 'arquivo.pdf',
        mime_type: 'application/pdf',
        tamanho_bytes: 12,
      },
    ]
    const [item] = montarItensFormularioDecorisi([a])
    expect(item.id).toBe(a.id)
    expect(item.medidas[0].larguraCm).toBeNull()
    expect(item).not.toHaveProperty('anexos')
    expect(item).not.toHaveProperty('preco')
  })
  it('catálogo direciona para mesma arte e personalizados continuam distintos', () => {
    const a = { ...novoArtigoDecorisi(), referencia: 'DB813' },
      b = { ...novoArtigoDecorisi(), referencia: 'DB813' }
    expect(procurarArteCatalogo([a], b)).toBe(a.id)
    expect(
      procurarArteCatalogo([a], { ...b, classificacao: 'PERSONALIZADO' }),
    ).toBeNull()
  })
  it.each([
    ['PAPEL', 'CATALOGO', 36565],
    ['PAPEL', 'PERSONALIZADO', 36566],
    ['PAINEL', 'CATALOGO', 36567],
    ['PAINEL', 'PERSONALIZADO', 36568],
  ] as const)('prévia %s/%s usa produto %s', (tipo, classificacao, id) => {
    const a = {
      ...novoArtigoDecorisi(),
      tipo,
      classificacao,
      referencia: tipo === 'PAPEL' ? 'DB813' : 'PF200',
    }
    a.medidas[0] = { ...a.medidas[0], largura: '1,01', altura: '1,01' }
    const previa = preverArtigoDecorisi(a, opcoes)
    expect(previa.produto.produtoIdSgi).toBe(id)
    expect(previa.quantidade).toBe(tipo === 'PAPEL' ? '1' : '1.0201')
    expect(previa.subtotal).toBe(tipo === 'PAPEL' ? '23000' : '23462')
  })
  it('preços dinâmicos e indisponíveis não geram total enganoso', () => {
    const a = novoArtigoDecorisi()
    a.referencia = 'DB813'
    a.medidas[0] = { ...a.medidas[0], largura: '1.01', altura: '1.01' }
    expect(
      preverArtigoDecorisi(a, {
        ...opcoes,
        precos: opcoes.precos.map((p) => ({ ...p, preco: '99.99' })),
      }).subtotal,
    ).toBe('9999')
    for (const preco of [null, 'NaN', 'Infinity', '0', '-1'])
      expect(
        preverArtigoDecorisi(a, {
          ...opcoes,
          precos: opcoes.precos.map((p) => ({ ...p, preco })),
        }).subtotal,
      ).toBeUndefined()
    expect(
      preverArtigoDecorisi(a, { ...opcoes, precos: [] }).pendencia,
    ).toContain('Preço indisponível')
  })
  it('medidas incompletas/impossíveis não calculam', () => {
    const a = novoArtigoDecorisi()
    a.referencia = 'DB813'
    expect(preverArtigoDecorisi(a, opcoes).quantidade).toBeUndefined()
    a.medidas[0] = { ...a.medidas[0], largura: '1', altura: '10' }
    expect(preverArtigoDecorisi(a, opcoes).quantidade).toBeUndefined()
  })
  it('reabre mantendo associação de anexos, produto, referência e ordem das medidas', () => {
    const a = novoArtigoDecorisi()
    const pedido: PedidoFormularioDecorisi = {
      id: 'pedido',
      version: 2,
      status: 'RASCUNHO',
      unidade_id: 'unidade',
      consultora: 'Teste',
      cliente: 'Cliente',
      telefone_normalizado: '41999999999',
      itens: [
        {
          id: a.id,
          ordem: 1,
          tipo: 'PAPEL',
          classificacao: 'CATALOGO',
          referencia_db_id: 'db',
          referencia_pf: null,
          descricao: null,
          observacoes: null,
          medidas: [
            { ordem: 1, ambiente: 'Sala', largura_cm: 101, altura_cm: null },
          ],
          anexos: [
            {
              id: 'anexo',
              slot: 5,
              nome_original: 'arte.pdf',
              mime_type: 'application/pdf',
              tamanho_bytes: 12,
            },
          ],
        },
      ],
    }
    const [r] = carregarArtigosDecorisi(pedido, opcoes)
    expect(r.id).toBe(a.id)
    expect(r.referencia).toBe('DB813')
    expect(r.anexos[0].id).toBe('anexo')
    expect(r.medidas[0].largura).toBe('1,01')
    expect(r.medidas[0].altura).toBe('')
  })
  it('limites e erros inline preservam rascunho incompleto', () => {
    const a = novoArtigoDecorisi()
    expect(errosFormularioDecorisi([a], identificacao)).toEqual({})
    a.medidas[0].largura = '0'
    expect(Object.keys(errosFormularioDecorisi([a], identificacao))).toContain(
      `${a.medidas[0].chave}-largura`,
    )
    expect(() =>
      montarItensFormularioDecorisi(
        Array.from({ length: 11 }, novoArtigoDecorisi),
      ),
    ).toThrow()
    a.medidas = Array.from({ length: 21 }, () => ({
      ...a.medidas[0],
      largura: '',
    }))
    expect(() => montarItensFormularioDecorisi([a])).toThrow()
  })
  it('formatação financeira exata aceita centavos além da precisão de Number', () =>
    expect(formatarCentavosDecorisi('900719925474099199')).toBe(
      'R$ 9.007.199.254.740.991,99',
    ))
})
