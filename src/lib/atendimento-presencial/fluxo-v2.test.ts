import { describe, expect, it } from 'vitest'
import { MOTIVOS_VISITA, migrarFichaDadosRascunho, validarFichaDadosRascunho, validarFichaParaConclusao, type FichaDadosRascunho } from './ficha-schema'
import { serializarPayloadAutosave } from './autosave-fila'

const legado: FichaDadosRascunho = {
  consultoraNome: 'ANA', criancas: [], departamentos: ['moveis'], produtosInteresse: [],
  resultadoAtendimento: 'sim', motivosResultado: [], etapaAtual: 'ficha',
}
const cliente: FichaDadosRascunho = { ...legado, versaoFluxo: 2, tipoAtendimento: 'cliente' }
const concluir = (ficha: FichaDadosRascunho, clienteId: string | null = 'cliente', numeroLancamento: unknown = 22) =>
  validarFichaParaConclusao({ ficha, clienteId, numeroLancamento })

describe('contratos da Entrega 2', () => {
  it('preserva rascunho e regra legados sem inferir novo fluxo', () => {
    expect(migrarFichaDadosRascunho(legado)).toEqual(legado)
    expect(concluir(legado)).toMatchObject({ ok: false, field: 'motivosResultado' })
    expect(concluir({ ...legado, motivosResultado: ['preco'] })).toEqual({ ok: true, numeroLancamento: 22 })
  })
  it('aceita venda fechada v2 sem motivo, inclusive motivos ocultos incompletos', () => {
    expect(concluir(cliente)).toEqual({ ok: true, numeroLancamento: 22 })
    expect(concluir({ ...cliente, motivosResultado: ['outro', 'virada_cartao'] }).ok).toBe(true)
    expect(concluir(cliente, null)).toMatchObject({ ok: false, field: 'clienteId' })
    expect(concluir(cliente, 'cliente', '')).toMatchObject({ ok: false, field: 'numeroLancamento' })
  })
  it.each(['nao', 'negociacao'] as const)('preserva motivos para %s', (resultadoAtendimento) => {
    const ficha = { ...cliente, resultadoAtendimento }
    expect(concluir(ficha)).toMatchObject({ ok: false, field: 'motivosResultado' })
    expect(concluir({ ...ficha, motivosResultado: ['outro'] })).toMatchObject({ ok: false, field: 'motivoOutro' })
    expect(concluir({ ...ficha, motivosResultado: ['virada_cartao'] })).toMatchObject({ ok: false, field: 'viradaCartao' })
    expect(concluir({ ...ficha, motivosResultado: ['preco'] })).toEqual({ ok: true, numeroLancamento: null })
  })
  it.each(MOTIVOS_VISITA)('conclui visita $chave sem cliente, resultado ou lancamento', ({ chave }) => {
    const ficha: FichaDadosRascunho = { ...cliente, tipoAtendimento: 'nao_cliente', motivoVisita: chave,
      resultadoAtendimento: undefined, departamentos: [], criancas: [{ id: 'oculta', situacao: 'ja_nasceu' }] }
    expect(validarFichaDadosRascunho(ficha).ok).toBe(true)
    if (chave === 'outros') {
      expect(concluir(ficha, null, null)).toMatchObject({ ok: false, field: 'motivoVisitaOutro' })
      expect(concluir({ ...ficha, motivoVisitaOutro: 'Entrega de amostra' }, null, null)).toEqual({ ok: true, numeroLancamento: null })
      expect(validarFichaDadosRascunho({ ...ficha, motivoVisitaOutro: 'Entrega 1' }).ok).toBe(false)
      expect(validarFichaDadosRascunho({ ...ficha, motivoVisitaOutro: '  entrega de amostra  ' })).toMatchObject({ ok: true, dados: { motivoVisitaOutro: 'entrega de amostra' } })
      return
    }
    expect(concluir(ficha, null, null)).toEqual({ ok: true, numeroLancamento: null })
    const ignorado = validarFichaDadosRascunho({ ...ficha, motivoVisitaOutro: 'Texto ignorado' })
    expect(ignorado.ok).toBe(true)
    if (ignorado.ok) expect(ignorado.dados.motivoVisitaOutro).toBeUndefined()
  })
  it.each([0, 300, 301])('limita observacao sem truncar %s caracteres', (tamanho) => {
    const ficha = { ...cliente, observacaoNaoFechamento: 'x'.repeat(tamanho) }
    expect(validarFichaDadosRascunho(ficha).ok).toBe(tamanho <= 300)
    expect(concluir(ficha).ok).toBe(tamanho <= 300)
  })
  it('conta caracteres Unicode como o Postgres', () => {
    expect(validarFichaDadosRascunho({ ...cliente, observacaoNaoFechamento: '🙂'.repeat(300) }).ok).toBe(true)
    expect(validarFichaDadosRascunho({ ...cliente, observacaoNaoFechamento: '🙂'.repeat(301) }).ok).toBe(false)
  })
  it.each([
    { versaoFluxo: 1 }, { versaoFluxo: '2' }, { tipoAtendimento: 'cliente' },
    { versaoFluxo: 2, tipoAtendimento: 'invalido' }, { versaoFluxo: 2, motivoVisita: 'invalido' },
    { versaoFluxo: 2, motivoVisita: null }, { versaoFluxo: 2, observacaoNaoFechamento: 123 },
  ])('rejeita contrato invalido %j', (campos) => {
    expect(validarFichaDadosRascunho({ ...legado, ...campos }).ok).toBe(false)
  })
  it('rascunho v2 incompleto e valido, conclusao exige tipo e visita', () => {
    expect(validarFichaDadosRascunho({ versaoFluxo: 2 }).ok).toBe(true)
    expect(concluir({ ...cliente, tipoAtendimento: undefined })).toMatchObject({ ok: false, field: 'tipoAtendimento' })
    expect(concluir({ ...cliente, tipoAtendimento: 'nao_cliente' })).toMatchObject({ ok: false, field: 'motivoVisita' })
  })
  it('autosave detecta alteracoes dos novos campos e preserva ramos ocultos', () => {
    const dados = { ...cliente, tipoAtendimento: 'nao_cliente' as const, motivoVisita: 'outros' as const,
      observacaoNaoFechamento: 'Em negociacao', motivosResultado: ['preco' as const] }
    expect(migrarFichaDadosRascunho(dados)).toEqual(dados)
    const base = serializarPayloadAutosave({ dadosRascunho: dados, clienteId: 'cliente' })
    for (const campo of ['versaoFluxo', 'tipoAtendimento', 'motivoVisita', 'observacaoNaoFechamento'] as const) {
      expect(serializarPayloadAutosave({ dadosRascunho: { ...dados, [campo]: undefined }, clienteId: 'cliente' })).not.toBe(base)
    }
    expect(serializarPayloadAutosave({ dadosRascunho: { ...dados, motivoVisitaOutro: 'Entrega de amostra' }, clienteId: 'cliente' })).not.toBe(base)
  })
})
