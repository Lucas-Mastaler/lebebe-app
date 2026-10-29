import { describe, expect, it } from 'vitest'
import {
  analisarFiltroEssencialCliente,
  faseAtualCriancaEssencial,
  filtrarCorrespondenciasEssenciaisCliente,
} from './filtro-essenciais-clientes'

const perfil = (id: string, situacao: string, nascimento: string | null, nome = id) => ({
  id,
  dados: { situacao, nome },
  data_referencia_nascimento: nascimento,
})

describe('filtro de Produtos Essenciais em clientes', () => {
  it('valida produto, situação e fase como parâmetros independentes', () => {
    expect(analisarFiltroEssencialCliente({ produto: null, situacao: null, fase: null })).toEqual({ ok: true, filtro: null })
    expect(analisarFiltroEssencialCliente({ produto: 'berco', situacao: 'nao_informado', fase: 'gestacao' })).toEqual({
      ok: true,
      filtro: { produto: 'berco', situacao: 'nao_informado', fase: 'gestacao' },
    })
    expect(analisarFiltroEssencialCliente({ produto: '', situacao: 'sim', fase: '' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssencialCliente({ produto: 'invalido', situacao: '', fase: '' })).toMatchObject({ ok: false })
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
    const filtros = { produto: 'berco', situacao: 'nao_informado', fase: '' } as const
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
        { crianca_id: 'crianca-sim', resposta: 'sim', registrado_em: '2026-10-01T12:00:00Z' },
        { crianca_id: 'crianca-nao', resposta: 'nao', registrado_em: '2026-10-02T12:00:00Z' },
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
      { produto: 'coleito', situacao: 'sim', fase: '0-3' },
      [
        { cliente_id: 'cliente-1', crianca_id: 'crianca-1' },
        { cliente_id: 'cliente-2', crianca_id: 'crianca-2' },
      ],
      [
        perfil('crianca-1', 'ja_nasceu', '2026-07-01', 'Alice'),
        perfil('crianca-2', 'ja_nasceu', '2025-06-01', 'Bia'),
      ],
      [{ crianca_id: 'crianca-1', resposta: 'sim', registrado_em: '2026-10-20T12:00:00Z' }],
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
})
