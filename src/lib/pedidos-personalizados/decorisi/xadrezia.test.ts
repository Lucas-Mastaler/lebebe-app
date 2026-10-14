import { describe, expect, it } from 'vitest'
import db from './referencias-db.json'
import xp from './referencias-xp.json'
import {
  pesquisarReferenciasPapel,
  referenciaPapelValida,
  produtoComercialDecorisi,
} from './catalogo'
import { validarItensDecorisi } from './validacao'
import {
  carregarArtigosDecorisi,
  montarItensFormularioDecorisi,
  novoArtigoDecorisi,
  preverArtigoDecorisi,
  type OpcoesFormularioDecorisi,
  type PedidoFormularioDecorisi,
} from './formulario'
import { calcularPapelDecorisi } from './calculos'

const referencias = [...db.registros, ...xp.registros]
const opcoes: OpcoesFormularioDecorisi = {
  db: referencias.map((r) => ({
    id: r.referencia,
    referencia: r.referencia,
    repeticao_m: r.repeticaoM,
    versao: 1,
  })),
  pf: ['PF200'],
  unidades: [],
  precos: [
    {
      produto_id_sgi: 36565,
      codigo: '19075',
      descricao: null,
      preco: '10.00',
      ativo: true,
      fora_linha: false,
      ultima_validacao_sgi: null,
    },
  ],
}
describe('Xadrezia e Doce Bebê', () => {
  it('mantém os 90 DB e inclui exclusivamente os 132 XP únicos da fonte rastreável', () => {
    expect(db.registros).toHaveLength(90)
    expect(xp.registros).toHaveLength(132)
    expect(new Set(referencias.map((r) => r.referencia)).size).toBe(222)
    expect(xp.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(xp.fonte).toBe('https://decorisi.com.br/#calculadora')
    expect(
      xp.registros.every(
        (r) =>
          referenciaPapelValida(r.referencia) &&
          /^\d+(\.\d{1,2})?$/.test(r.repeticaoM),
      ),
    ).toBe(true)
    expect(referenciaPapelValida('XP000')).toBe(false)
    expect(referenciaPapelValida('XP133')).toBe(false)
  })
  it('filtra por catálogo e pesquisa código ou número sem misturar coleções', () => {
    const codigos = referencias.map((r) => r.referencia)
    expect(pesquisarReferenciasPapel(codigos, 'DB', '')).toHaveLength(90)
    expect(pesquisarReferenciasPapel(codigos, 'XP', '')).toHaveLength(132)
    expect(pesquisarReferenciasPapel(codigos, 'XP', 'xp001')).toEqual(['XP001'])
    expect(pesquisarReferenciasPapel(codigos, 'XP', '001')).toEqual(['XP001'])
    expect(pesquisarReferenciasPapel(codigos, 'DB', 'XP001')).toEqual([])
  })
  it.each(['CATALOGO', 'PERSONALIZADO'] as const)(
    'aceita XP em papel %s, preserva SGI e rejeita painel XP',
    (classificacao) => {
      const artigo = novoArtigoDecorisi()
      Object.assign(artigo, {
        classificacao,
        referencia: 'XP001',
        catalogoPapel: 'XP',
        descricao: 'Alterar cores',
      })
      const itens = montarItensFormularioDecorisi([artigo])
      expect(validarItensDecorisi(itens)[0].referencia).toBe('XP001')
      expect(
        produtoComercialDecorisi('PAPEL', classificacao).produtoIdSgi,
      ).toBe(classificacao === 'CATALOGO' ? 36565 : 36566)
      expect(() =>
        validarItensDecorisi([{ ...itens[0], tipo: 'PAINEL' }]),
      ).toThrow('REFERENCIA_DECORISI_INVALIDA')
      artigo.catalogoPapel = 'DB'
      expect(() => montarItensFormularioDecorisi([artigo])).toThrow(
        'catálogo escolhido',
      )
    },
  )
  it('usa a repetição XP selecionada na função comercial existente', () => {
    for (const referencia of xp.registros) {
      const artigo = novoArtigoDecorisi()
      artigo.referencia = referencia.referencia
      artigo.medidas[0].largura = '3,50'
      artigo.medidas[0].altura = '2,70'
      const repeticaoCm = Number(referencia.repeticaoM) * 100
      expect(preverArtigoDecorisi(artigo, opcoes).quantidade).toBe(
        calcularPapelDecorisi(
          [{ larguraCm: 350, alturaCm: 270 }],
          Math.round(repeticaoCm),
        ).quantidade,
      )
    }
  })
  it('reabre XP e medidas PT-BR sem alterar centímetros ou perder identificação', () => {
    const pedido: PedidoFormularioDecorisi = {
      id: crypto.randomUUID(),
      version: 1,
      status: 'RASCUNHO',
      unidade_id: 'teste',
      consultora: 'Teste',
      cliente: 'Sintético',
      telefone_normalizado: '41999999999',
      itens: [
        {
          id: crypto.randomUUID(),
          ordem: 1,
          tipo: 'PAPEL',
          classificacao: 'CATALOGO',
          referencia_db_id: 'XP001',
          referencia_pf: null,
          descricao: null,
          observacoes: null,
          anexos: [],
          medidas: [
            { ordem: 1, ambiente: 'Quarto', largura_cm: 350, altura_cm: 270 },
          ],
        },
      ],
    }
    const [artigo] = carregarArtigosDecorisi(pedido, opcoes)
    expect(artigo.referencia).toBe('XP001')
    expect(artigo.medidas[0].largura).toBe('3,50')
    expect(montarItensFormularioDecorisi([artigo])[0].medidas[0]).toEqual({
      ambiente: 'Quarto',
      larguraCm: 350,
      alturaCm: 270,
    })
  })
})
