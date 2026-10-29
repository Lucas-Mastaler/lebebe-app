import { describe, expect, it } from 'vitest'
import {
  analisarFiltroEssencialCliente,
  faseAtualCriancaEssencial,
  filtrarCorrespondenciasEssenciaisCliente,
  type FiltroEssencialCliente,
} from './filtro-essenciais-clientes'

const perfil = (id: string, situacao: string, nascimento: string | null, nome = id) => ({
  id,
  dados: { situacao, nome },
  data_referencia_nascimento: nascimento,
})

describe('filtro de Produtos Essenciais em clientes', () => {
  it('valida produto, situação e fase como parâmetros independentes', () => {
    expect(analisarFiltroEssencialCliente({ produtos: [], situacao: null, fase: null })).toEqual({ ok: true, filtro: null })
    expect(analisarFiltroEssencialCliente({ produtos: ['berco'], situacao: 'nao_informado', fase: 'gestacao' })).toEqual({
      ok: true,
      filtro: { produtos: ['berco'], situacao: 'nao_informado', fase: 'gestacao' },
    })
    expect(analisarFiltroEssencialCliente({ produtos: [], situacao: 'sim', fase: '' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssencialCliente({ produtos: ['invalido'], situacao: '', fase: '' })).toMatchObject({ ok: false })
  })

  it('classifica a fase apenas com situação atual e referência de nascimento válida', () => {
    expect(faseAtualCriancaEssencial(perfil('gestacao', 'gestacao', null), '2026-10-29')).toBe('gestacao')
    expect(faseAtualCriancaEssencial(perfil('zero-tres', 'ja_nasceu', '2026-07-01'), '2026-10-29')).toBe('0-3')
    expect(faseAtualCriancaEssencial(perfil('quatro-oito', 'ja_nasceu', '2026-06-01'), '2026-10-29')).toBe('4-8')
    expect(faseAtualCriancaEssencial(perfil('nove-doze', 'ja_nasceu', '2025-10-01'), '2026-10-29')).toBe('9-12')
    expect(faseAtualCriancaEssencial(perfil('acima-doze', 'ja_nasceu', '2025-09-01'), '2026-10-29')).toBe('acima-12')
    expect(faseAtualCriancaEssencial(perfil('sem-data', 'ja_nasceu', null), '2026-10-29')).toBe('nao_informada')
    expect(faseAtualCriancaEssencial(perfil('data-futura', 'ja_nasceu', '2027-01-01'), '2026-10-29')).toBe('nao_informada')
  })

  it('distingue Não de Não informado e usa somente o estado atual por criança/produto', () => {
    const filtros: FiltroEssencialCliente = { produtos: ['berco'], situacao: 'nao_informado', fase: '' }
    const resultados = filtrarCorrespondenciasEssenciaisCliente(
      filtros,
      [
        { cliente_id: 'cliente-1', crianca_id: 'crianca-sim' },
        { cliente_id: 'cliente-2', crianca_id: 'crianca-nao' },
        { cliente_id: 'cliente-3', crianca_id: 'crianca-vazia' },
      ],
      [
        perfil('crianca-sim', 'gestacao', null),
        perfil('crianca-nao', 'gestacao', null),
        perfil('crianca-vazia', 'ja_nasceu', null),
      ],
      [
        { crianca_id: 'crianca-sim', produto: 'berco', resposta: 'sim', registrado_em: '2026-10-01T12:00:00Z' },
        { crianca_id: 'crianca-nao', produto: 'berco', resposta: 'nao', registrado_em: '2026-10-02T12:00:00Z' },
      ],
      '2026-10-29'
    )
    expect(Array.from(resultados.keys())).toEqual(['cliente-3'])
    expect(resultados.get('cliente-3')?.[0]).toMatchObject({
      criancaId: 'crianca-vazia',
      resposta: 'nao_informado',
      registradoEm: null,
      fase: 'nao_informada',
    })
  })

  it('filtra por criança e fase atuais e devolve a data da confirmação vigente', () => {
    const resultados = filtrarCorrespondenciasEssenciaisCliente(
      { produtos: ['coleito'], situacao: 'sim', fase: '0-3' },
      [
        { cliente_id: 'cliente-1', crianca_id: 'crianca-1' },
        { cliente_id: 'cliente-2', crianca_id: 'crianca-2' },
      ],
      [
        perfil('crianca-1', 'ja_nasceu', '2026-07-01', 'Alice'),
        perfil('crianca-2', 'ja_nasceu', '2025-06-01', 'Bia'),
      ],
      [{ crianca_id: 'crianca-1', produto: 'coleito', resposta: 'sim', registrado_em: '2026-10-20T12:00:00Z' }],
      '2026-10-29'
    )
    expect(resultados.size).toBe(1)
    expect(resultados.get('cliente-1')?.[0]).toMatchObject({
      criancaNome: 'Alice',
      faseLabel: '0–3 meses',
      resposta: 'sim',
      registradoEm: '2026-10-20T12:00:00Z',
    })
  })

  it('exige todos os produtos na mesma criança e nunca mistura respostas entre irmãos', () => {
    const vinculos = [
      { cliente_id: 'cliente-misto', crianca_id: 'a' },
      { cliente_id: 'cliente-misto', crianca_id: 'b' },
      { cliente_id: 'cliente-ok', crianca_id: 'c' },
    ]
    const perfis = [perfil('a', 'gestacao', null), perfil('b', 'gestacao', null), perfil('c', 'gestacao', null)]
    const estados = [
      { crianca_id: 'a', produto: 'berco', resposta: 'sim', registrado_em: '2026-10-01' },
      { crianca_id: 'a', produto: 'comoda', resposta: 'nao', registrado_em: '2026-10-01' },
      { crianca_id: 'b', produto: 'berco', resposta: 'nao', registrado_em: '2026-10-01' },
      { crianca_id: 'b', produto: 'comoda', resposta: 'sim', registrado_em: '2026-10-01' },
      { crianca_id: 'c', produto: 'berco', resposta: 'sim', registrado_em: '2026-10-01' },
      { crianca_id: 'c', produto: 'comoda', resposta: 'sim', registrado_em: '2026-10-01' },
    ] as const
    const resultados = filtrarCorrespondenciasEssenciaisCliente({ produtos: ['berco', 'comoda'], situacao: 'sim', fase: '' }, vinculos, perfis, [...estados], '2026-10-29')
    expect(Array.from(resultados.keys())).toEqual(['cliente-ok'])
    expect(resultados.get('cliente-ok')).toHaveLength(2)
  })

  it('exige que todos os produtos estejam como Não na mesma criança', () => {
    const resultados = filtrarCorrespondenciasEssenciaisCliente(
      { produtos: ['berco', 'comoda', 'roupeiro'], situacao: 'nao', fase: '' },
      [{ cliente_id: 'cliente-ok', crianca_id: 'c' }, { cliente_id: 'cliente-incompleto', crianca_id: 'd' }],
      [perfil('c', 'gestacao', null), perfil('d', 'gestacao', null)],
      [
        { crianca_id: 'c', produto: 'berco', resposta: 'nao', registrado_em: '2026-10-01' },
        { crianca_id: 'c', produto: 'comoda', resposta: 'nao', registrado_em: '2026-10-01' },
        { crianca_id: 'c', produto: 'roupeiro', resposta: 'nao', registrado_em: '2026-10-01' },
        { crianca_id: 'd', produto: 'berco', resposta: 'nao', registrado_em: '2026-10-01' },
        { crianca_id: 'd', produto: 'comoda', resposta: 'nao', registrado_em: '2026-10-01' },
      ],
      '2026-10-29'
    )

    expect(Array.from(resultados.keys())).toEqual(['cliente-ok'])
    expect(resultados.get('cliente-ok')).toHaveLength(3)
  })
})
