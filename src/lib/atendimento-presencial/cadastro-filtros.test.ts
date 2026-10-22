import { serializarHistoricoAtendimento } from './historico-cliente'
import { describe, expect, it } from 'vitest'
import { validarAtualizacaoCliente, validarPayloadCliente } from './clientes'
import { normalizarNomeConsultora } from './ficha-schema'
import {
  FILTROS_ADICIONAIS,
  correspondeNome,
  dentroDoPeriodo,
  filtrarDadosListagem,
  lerFiltrosListagem,
  lerPaginas,
} from './filtros-listagem'
import {
  mascararTelefoneClienteBR,
  normalizarTelefone,
  normalizarTelefoneClienteBR,
} from './telefone'

describe('cadastro presencial e filtros aprovados', () => {
  it('histórico mostra o nome daquele atendimento sem usar o e-mail como nome', () => {
    const base = {
      row: {
        id: 'atendimento',
        consultora_usuario_id: 'login',
        unidade_id: 'filial',
        consultora_nome: ' Ana C ',
      },
      unidadeNome: 'FILIAL',
      consultoraEmail: 'login@example.invalid',
      departamentos: [],
      produtosInteresse: [],
    }
    expect(serializarHistoricoAtendimento(base).consultora).toBe('ANA C')
    expect(
      serializarHistoricoAtendimento({
        ...base,
        row: { ...base.row, consultora_nome: null },
      }).consultora,
    ).toBeNull()
  })
  it.each([
    '41 99646-5656',
    '(41) 99646-5656',
    '+55 (41) 99646-5656',
    '41 3333-4444',
    '55 99999-9999',
  ])('aceita formato brasileiro sem rejeitar repetição: %s', (telefone) => {
    expect(normalizarTelefoneClienteBR(telefone).valido).toBe(true)
    expect(validarPayloadCliente({ nome: 'CLIENTE', telefone }).ok).toBe(true)
  })
  it.each([
    '10996465656',
    '00996465656',
    '41896465656',
    '4163334444',
    '419964656567',
    '123',
  ])('rejeita DDD, prefixo ou tamanho inválido: %s', (telefone) =>
    expect(normalizarTelefoneClienteBR(telefone).valido).toBe(false),
  )
  it('mantém excedentes visíveis e preserva normalizador usado por outros módulos', () => {
    expect(mascararTelefoneClienteBR('419964656567')).toBe('419964656567')
    expect(normalizarTelefone('41896465656').valido).toBe(true)
    expect(normalizarTelefoneClienteBR('41896465656').valido).toBe(false)
  })
  it('edita somente nome sem enviar nem revalidar o telefone legado', () => {
    expect(
      validarAtualizacaoCliente({ nome: ' cliente  corrigida ', version: 3 }),
    ).toEqual({ ok: true, version: 3, campos: { nome: 'CLIENTE CORRIGIDA' } })
    expect(validarAtualizacaoCliente({ nome: 'A', version: 3 })).toMatchObject({
      ok: false,
      field: 'nome',
    })
    expect(
      validarAtualizacaoCliente({ nome: 'CLIENTE', version: 0 }),
    ).toMatchObject({ ok: false, field: 'version' })
    expect(
      validarAtualizacaoCliente({ telefone: '41896465656', version: 3 }),
    ).toMatchObject({ ok: false, field: 'telefone' })
    expect(
      validarAtualizacaoCliente({ telefone: null, version: 3 }),
    ).toMatchObject({
      ok: true,
      campos: { telefone_informado: null, telefone_normalizado: null },
    })
  })
  it('unifica caixa, espaços e acentos sem unir nomes distintos', () => {
    expect(
      ['ana', 'Ana', ' ANA ', 'ana  '].map(normalizarNomeConsultora),
    ).toEqual(['ANA', 'ANA', 'ANA', 'ANA'])
    expect(normalizarNomeConsultora(' Ana   C ')).toBe('ANA C')
    expect(normalizarNomeConsultora('Márcia')).toBe('MARCIA')
    expect(normalizarNomeConsultora('LETÍCIA')).toBe(normalizarNomeConsultora('LETICIA'))
  })
  it('busca sobrenome além dos primeiros trinta caracteres do cadastro', () => {
    expect(
      correspondeNome(
        'CLIENTE COM NOME COMPOSTO MAIOR QUE TRINTA CARACTERES SILVA',
        'SILVA',
      ),
    ).toBe(true)
  })
  it('usa o dia completo de São Paulo, inclusive perto da meia-noite UTC', () => {
    expect(
      dentroDoPeriodo('2026-10-09T02:59:59Z', '2026-10-09', '2026-10-09'),
    ).toBe(false)
    expect(
      dentroDoPeriodo('2026-10-09T03:00:00Z', '2026-10-09', '2026-10-09'),
    ).toBe(true)
    expect(
      dentroDoPeriodo('2026-10-10T02:59:59Z', '2026-10-09', '2026-10-09'),
    ).toBe(true)
    expect(
      dentroDoPeriodo('2026-10-10T03:00:00Z', '2026-10-09', '2026-10-09'),
    ).toBe(false)
  })
  it('distingue telefone presente de validade e exclui Não clientes de Com/Sem telefone', () => {
    const item = {
      data: '2026-10-09T12:00Z',
      tipo: 'cliente',
      clienteId: 'cliente',
      telefone: '41896465656',
    }
    expect(
      filtrarDadosListagem(item, { ...FILTROS_ADICIONAIS, contato: 'com' }),
    ).toBe(true)
    expect(
      filtrarDadosListagem(
        { ...item, telefone: null },
        { ...FILTROS_ADICIONAIS, contato: 'sem' },
      ),
    ).toBe(true)
    expect(
      filtrarDadosListagem(
        { ...item, tipo: 'nao_cliente', clienteId: null },
        { ...FILTROS_ADICIONAIS, contato: 'sem' },
      ),
    ).toBe(false)
    expect(
      filtrarDadosListagem(
        { ...item, telefone: '41996465656' },
        { ...FILTROS_ADICIONAIS, telefoneCliente: '+55 (41) 99646-5656' },
      ),
    ).toBe(true)
  })
  it('filtra rascunhos sem atribuir tipo, vínculo ou telefone fictícios', () => {
    const now = Date.parse('2026-10-19T12:00Z')
    const item = {
      data: '2026-10-19T12:00Z',
      tipo: null,
      clienteId: null,
      telefone: null,
      expiraEm: '2026-10-20T11:00Z',
    }
    expect(
      filtrarDadosListagem(
        item,
        {
          ...FILTROS_ADICIONAIS,
          tipoAtendimento: 'nao_informado',
          vinculoCliente: 'sem',
          expiracao: '24h',
        },
        now,
      ),
    ).toBe(true)
    expect(
      filtrarDadosListagem(
        { ...item, expiraEm: '2026-10-21T11:00Z' },
        { ...FILTROS_ADICIONAIS, expiracao: '24h' },
        now,
      ),
    ).toBe(false)
  })
  it('valida período e lançamento; aceita opções múltiplas repetidas no querystring', () => {
    for (const query of [
      'atendimentoDe=2026-02-30',
      'atendimentoDe=2026-10-10&atendimentoAte=2026-10-09',
      'numeroLancamento=0',
      'numeroLancamento=1.2',
      'tipoAtendimento=inexistente',
    ]) {
      expect(() => lerFiltrosListagem(new URLSearchParams(query))).toThrow()
    }
    expect(
      lerFiltrosListagem(
        new URLSearchParams('departamentos=moveis&departamentos=enxoval'),
      ).departamentos,
    ).toEqual(['moveis', 'enxoval'])
  })
  it('lê todas as páginas sem limitar contagens aos primeiros 500', async () => {
    const linhas = Array.from({ length: 1005 }, (_, id) => ({ id }))
    const chamadas: number[] = []
    const result = await lerPaginas(async (de, ate) => {
      chamadas.push(de)
      return { data: linhas.slice(de, ate + 1), error: null }
    })
    expect(result).toHaveLength(1005)
    expect(chamadas).toEqual([0, 500, 1000])
    await expect(
      lerPaginas(async () => ({
        data: null,
        error: new Error('Falha controlada'),
      })),
    ).rejects.toThrow('Falha controlada')
  })
})
