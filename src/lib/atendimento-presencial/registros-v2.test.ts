import { describe, expect, it } from 'vitest'
import { MOTIVOS_VISITA, validarFichaDadosRascunho, validarFichaParaConclusao } from './ficha-schema'
import { serializarAtendimentoPresencial, type AtendimentoPresencialRow } from './rascunhos'
import { descreverContratoHistorico, getMotivoVisitaLabel, montarPayloadEdicaoAtendimento, normalizarDetalheParaFichaEdicao, registroNaoCliente, type RegistroAtendimentoDetalheDTO } from './registros'

function detalheV2(): RegistroAtendimentoDetalheDTO {
  return {
    atendimento: { ...serializarAtendimentoPresencial({
      id: 'registro', cliente_id: '123e4567-e89b-12d3-a456-426614174004', status: 'concluido',
      dados_rascunho: { schema: 'atendimento_presencial_concluido_v2' }, version: 4,
      versao_fluxo: 2, tipo_atendimento: 'cliente', resultado_atendimento: 'negociacao',
      observacoes: 'Observação geral\nSegunda linha', observacao_nao_fechamento: 'Aguardar orçamento\nRetornar amanhã',
      consultora_nome: 'Ana', motivo_outro: 'Complemento histórico',
    } as unknown as AtendimentoPresencialRow), resultadoAtendimento: 'negociacao' },
    cliente: null,
    criancas: [{ id: 'db-1', local_id: 'local-1', ordem: 1, situacao: 'presente_outra_pessoa', nome: null,
      sexo: null, idade_unidade: null, idade_valor: null, data_prevista_nascimento: '2026-12-01' }],
    departamentos: [{ id: 'd1', departamento: 'moveis' }], produtosInteresse: [{ id: 'p1', descricao: 'Berço' }],
    motivos: [{ id: 'm1', motivo: 'outro', complemento: 'Complemento histórico' }], historico: [],
  }
}

describe('leitura e edição compatível dos registros', () => {
  it.each(MOTIVOS_VISITA)('identifica não cliente e motivo $label sem requisitos comerciais', ({ chave, label }) => {
    const detalhe = detalheV2()
    Object.assign(detalhe.atendimento, { tipoAtendimento: 'nao_cliente', motivoVisita: chave, clienteId: null,
      resultadoAtendimento: null, observacaoNaoFechamento: null })
    detalhe.criancas = []; detalhe.departamentos = []; detalhe.produtosInteresse = []; detalhe.motivos = []
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    expect(registroNaoCliente(detalhe.atendimento)).toBe(true)
    expect(getMotivoVisitaLabel(ficha.motivoVisita)).toBe(label)
    expect(validarFichaParaConclusao({ ficha, clienteId: null, numeroLancamento: null })).toMatchObject({ ok: true })
    expect(montarPayloadEdicaoAtendimento({ detalhe, ficha, numeroLancamento: null }).dadosRascunho).toMatchObject({ versaoFluxo: 2, tipoAtendimento: 'nao_cliente', motivoVisita: chave })
  })

  it.each(['sim', 'nao', 'negociacao'] as const)('mantém resultado %s, crianças, motivos e observações na ida e volta', (resultado) => {
    const detalhe = detalheV2()
    detalhe.atendimento.resultadoAtendimento = resultado
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    const payload = montarPayloadEdicaoAtendimento({ detalhe, ficha, numeroLancamento: resultado === 'sim' ? 225 : null })
    expect(registroNaoCliente(detalhe.atendimento)).toBe(false)
    expect(payload.dadosRascunho).toMatchObject({ versaoFluxo: 2, tipoAtendimento: 'cliente', resultadoAtendimento: resultado,
      observacaoNaoFechamento: 'Aguardar orçamento\nRetornar amanhã', observacoes: 'Observação geral\nSegunda linha',
      motivosResultado: ['outro'], motivoOutro: 'Complemento histórico',
      criancas: [{ id: 'local-1', situacao: 'presente_outra_pessoa', dataPrevistaNascimento: '2026-12-01' }] })
    expect(validarFichaDadosRascunho(JSON.parse(JSON.stringify(payload.dadosRascunho)))).toMatchObject({ ok: true })
    expect(detalhe.atendimento.version).toBe(4)
  })

  it('não promove legado nem recupera campos finais de rascunho descartado', () => {
    const detalhe = detalheV2()
    Object.assign(detalhe.atendimento, { versaoFluxo: null, tipoAtendimento: null, observacaoNaoFechamento: null })
    detalhe.atendimento.dadosRascunho.observacoes = 'Obsoleta'
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    expect(ficha).not.toHaveProperty('versaoFluxo')
    expect(ficha.observacoes).toBe('Observação geral\nSegunda linha')
    expect(registroNaoCliente({})).toBe(false)
  })

  it('preserva campos v2 ausentes em formulário antigo e permite limpar observação explicitamente', () => {
    const detalhe = detalheV2()
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    delete ficha.versaoFluxo; delete ficha.tipoAtendimento; delete ficha.observacaoNaoFechamento
    const montar = () => montarPayloadEdicaoAtendimento({ detalhe, ficha, numeroLancamento: null })
    expect(montar().dadosRascunho).toMatchObject({ versaoFluxo: 2, tipoAtendimento: 'cliente', observacaoNaoFechamento: detalhe.atendimento.observacaoNaoFechamento })
    ficha.observacaoNaoFechamento = ''
    expect(montar().dadosRascunho.observacaoNaoFechamento).toBe('')
  })

  it('campos opcionais nulos não criam dados fictícios', () => {
    const detalhe = detalheV2()
    detalhe.atendimento.observacaoNaoFechamento = null
    detalhe.atendimento.observacoes = null
    detalhe.criancas[0].data_prevista_nascimento = null
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    expect(ficha.observacaoNaoFechamento).toBeUndefined()
    expect(ficha.observacoes).toBeUndefined()
    expect(ficha.criancas[0].nome).toBeUndefined()
    expect(ficha.criancas[0].dataPrevistaNascimento).toBeUndefined()
  })

  it('apresenta somente valores efetivamente presentes no histórico', () => {
    expect(descreverContratoHistorico({ resultadoAnterior: 'sim', resultadoNovo: 'nao' })).toEqual([])
    expect(descreverContratoHistorico({ versaoFluxo: 2, tipoAtendimento: 'nao_cliente', motivoVisita: 'representante',
      observacaoNaoFechamentoAnterior: 'Texto original', observacaoNaoFechamentoNova: '' })).toEqual([
      'Fluxo: 2', 'Tipo: Não cliente', 'Motivo da visita: Representante',
      'Observação de não fechamento anterior: Texto original', 'Observação de não fechamento nova: ',
    ])
    expect(getMotivoVisitaLabel('codigo_futuro')).toBe('codigo_futuro')
  })
})
