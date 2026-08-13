import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  normalizarBuscaCatalogo,
  normalizarBuscaReferencia,
  validarEntradaLebebeExclusive,
  validarFiltrosCatalogoLebebeExclusive,
} from './lebebe-exclusive'

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
      filtros: { colecao: 'ARVORE', descricao: null, referencia: '110010' },
    })
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

  it('mantém os dois acessos a Mostrar selecionados e não pesquisa ao digitar', () => {
    const fonte = readFileSync(path.join(process.cwd(), 'src/components/pedidos-personalizados/FormularioLebebeExclusive.tsx'), 'utf8')
    expect(fonte.match(/Mostrar selecionados/g)).toHaveLength(2)
    expect(fonte).toContain("if (event.key === 'Enter')")
    expect(fonte).not.toMatch(/useEffect\([^)]*pesquisar/)
    expect(fonte).not.toContain('custoUnitario')
  })
})
