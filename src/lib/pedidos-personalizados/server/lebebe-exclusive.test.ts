import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  normalizarBuscaCatalogo,
  normalizarBuscaReferencia,
  validarEntradaLebebeExclusive,
  validarFiltrosCatalogoLebebeExclusive,
} from './lebebe-exclusive'
import {
  lerErroDetalhado,
  montarPayloadLebebeExclusive,
  paginasVisiveisLebebeExclusive,
  quantidadeItemLebebeExclusiveEhValida,
} from '@/components/pedidos-personalizados/FormularioLebebeExclusive'

const PRODUTO = '10000000-0000-4000-8000-000000000001'

describe('Lebebe Exclusive', () => {
  it('normaliza acentos e formas comerciais da referência somente para busca', () => {
    expect(normalizarBuscaCatalogo('  Coleção Árvore  ')).toBe('COLECAO ARVORE')
    expect(normalizarBuscaReferencia(' 110.010 – A ')).toBe('110010A')
  })

  it('exige busca manual com três caracteres úteis e combina os filtros informados', () => {
    expect(validarFiltrosCatalogoLebebeExclusive(new URL('http://local?colecao=ab')).ok).toBe(false)
    expect(validarFiltrosCatalogoLebebeExclusive(new URL('http://local')).ok).toBe(false)
    expect(validarFiltrosCatalogoLebebeExclusive(new URL('http://local?colecao=Árvore&referencia=110.010'))).toEqual({
      ok: true,
      filtros: { colecao: 'ARVORE', descricao: null, referencia: '110010', pagina: 1 },
    })
    expect(validarFiltrosCatalogoLebebeExclusive(new URL('http://local?colecao=Árvore&pagina=0')).ok).toBe(false)
  })

  it('aceita somente identidade e itens, sem preço ou custo enviados pelo navegador', () => {
    const base = {
      fornecedor: 'lebebe_exclusive',
      unidade: 'marechal',
      consultora: 'Ana C',
      cliente: 'Cliente Teste',
      telefone: '(41) 99912-3456',
      numeroLancamento: '78495',
      itens: [{ produtoId: PRODUTO, ordem: 1, quantidade: 2, nomeOuLetra: 'Helena' }],
    }
    const resultado = validarEntradaLebebeExclusive(base, { comercial: false })
    expect(resultado).toMatchObject({
      ok: true,
      dados: {
        consultora: 'ANA C',
        cliente: 'CLIENTE TESTE',
        telefoneNormalizado: '41999123456',
        itens: [{ produto_id: PRODUTO, ordem: 1, quantidade: 2, nome_ou_letra: 'Helena' }],
      },
    })
    expect(validarEntradaLebebeExclusive({ ...base, custo: 10 }, { comercial: false })).toMatchObject({ ok: false })
    expect(validarEntradaLebebeExclusive({ ...base, itens: [{ ...base.itens[0], preco: 1 }] }, { comercial: false })).toMatchObject({ ok: false })
  })

  it('monta o payload Exclusive por lista permitida e não herda tapetes do estado Moriah', () => {
    const identificacaoComEstadoMoriah = {
      unidade: 'marechal' as const,
      consultora: 'Ana C',
      cliente: 'Cliente Teste',
      telefone: '(41) 99912-3456',
      numeroLancamento: '78495',
      tapetes: [{ formato: 'RETANGULAR' }],
    }
    const payload = montarPayloadLebebeExclusive({
      identificacao: identificacaoComEstadoMoriah,
      idempotencyKey: '60000000-0000-4000-8000-000000000001',
      itens: [{ id: PRODUTO, quantidade: 2, nomeOuLetra: '' }],
    })

    expect(payload).toMatchObject({ fornecedor: 'lebebe_exclusive', unidade: 'marechal', itens: [{ produtoId: PRODUTO, quantidade: 2, nomeOuLetra: null }] })
    expect(payload).not.toHaveProperty('tapetes')
    expect(validarEntradaLebebeExclusive(payload, { comercial: false }).ok).toBe(true)
  })

  it('explica campo extra e quantidade inválida por caminho sem expor valores', async () => {
    const base = {
      idempotencyKey: '60000000-0000-4000-8000-000000000001',
      fornecedor: 'lebebe_exclusive',
      unidade: 'marechal',
      consultora: 'Ana C',
      cliente: 'Cliente Teste',
      telefone: '(41) 99912-3456',
      numeroLancamento: null,
      itens: [{ produtoId: PRODUTO, ordem: 1, quantidade: 2, nomeOuLetra: null }],
    }
    expect(validarEntradaLebebeExclusive({ ...base, tapetes: [] }, { comercial: false })).toMatchObject({
      ok: false,
      codigo: 'CAMPO_NAO_PERMITIDO',
      problemas: [{ campo: 'tapetes' }],
    })
    const invalido = validarEntradaLebebeExclusive({ ...base, itens: [{ ...base.itens[0], quantidade: 0 }] }, { comercial: false })
    expect(invalido).toMatchObject({ ok: false, codigo: 'QUANTIDADE_INVALIDA', problemas: [{ campo: 'itens.0.quantidade' }] })

    const erro = await lerErroDetalhado(new Response(JSON.stringify({
      erro: 'QUANTIDADE_INVALIDA',
      mensagem: 'Não foi possível salvar o pedido.',
      problemas: [{ codigo: 'QUANTIDADE_INVALIDA', campo: 'itens.0.quantidade', mensagem: 'A quantidade do item 1 deve ser maior que zero.' }],
    }), { status: 422 }))
    expect(erro).toEqual({ mensagem: 'A quantidade do item 1 deve ser maior que zero.', campo: 'itens.0.quantidade' })
  })

  it('mantém os três acessos a Mostrar selecionados e não pesquisa ao digitar', () => {
    const fonte = readFileSync(path.join(process.cwd(), 'src/components/pedidos-personalizados/FormularioLebebeExclusive.tsx'), 'utf8')
    expect(fonte.match(/<BotaoMostrarSelecionados/g)).toHaveLength(3)
    expect(fonte).toContain("if (event.key === 'Enter')")
    expect(fonte).not.toMatch(/useEffect\([^)]*pesquisar/)
    expect(fonte).not.toContain('custoUnitario')
  })

  it('seleciona exclusivamente por quantidade válida e mantém a tabela responsiva', () => {
    const fonte = readFileSync(path.join(process.cwd(), 'src/components/pedidos-personalizados/FormularioLebebeExclusive.tsx'), 'utf8')
    expect(fonte).toContain('function atualizarQuantidade')
    expect(quantidadeItemLebebeExclusiveEhValida('1')).toBe(true)
    expect(quantidadeItemLebebeExclusiveEhValida('12')).toBe(true)
    expect(quantidadeItemLebebeExclusiveEhValida('')).toBe(false)
    expect(quantidadeItemLebebeExclusiveEhValida('0')).toBe(false)
    expect(quantidadeItemLebebeExclusiveEhValida('1.5')).toBe(false)
    expect(quantidadeItemLebebeExclusiveEhValida('abc')).toBe(false)
    expect(fonte).toContain('proximos.delete(produto.id)')
    expect(fonte).toContain('function atualizarNomeOuLetra')
    expect(fonte).toContain('rascunhosItens')
    expect(fonte).not.toContain('alternarProduto')
    expect(fonte).not.toContain('type="checkbox"')
    expect(fonte).not.toContain('>Selecionar</th>')
    expect(fonte).toContain('Itens selecionados: <span')
    expect(fonte).toContain('{selecionados.size}</span> | Total: {formatarMoeda(total)}')
    expect(fonte).not.toContain('min-w-[1050px]')
    expect(fonte).toContain('table-fixed')
    expect(fonte).toContain('lg:hidden')
  })

  it('mantém uma navegação compacta com a primeira, atual e última página', () => {
    expect(paginasVisiveisLebebeExclusive(4, 4)).toEqual([1, 2, 3, 4])
    expect(paginasVisiveisLebebeExclusive(52, 103)).toEqual([1, '…', 51, 52, 53, '…', 103])
  })
})
