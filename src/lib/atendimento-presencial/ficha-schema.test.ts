import { describe, expect, it } from 'vitest'
import {
  converterDataInputParaISO,
  converterViradaCartaoInput,
  criarCriancaRascunho,
  formatarDataISOParaInput,
  formatarDataPrevistaInput,
  formatarViradaCartao,
  formatarViradaCartaoInput,
  limparNomeCriancaDigitacao,
  migrarFichaDadosRascunho,
  nomeCriancaValido,
  valorOrdenavelViradaCartao,
  validarFichaDadosRascunho,
  validarFichaParaConclusao,
  validarNumeroLancamento,
  normalizarNumeroLancamento,
} from './ficha-schema'

describe('schema da ficha de atendimento presencial', () => {
  it.each([22, 225, 2234, 34566, 1, 999999])('aceita lancamento %s sem exigir minimo de digitos', (numero) => {
    expect(validarNumeroLancamento(String(numero))).toEqual({ ok: true, numeroLancamento: numero })
    expect(validarNumeroLancamento(numero)).toEqual({ ok: true, numeroLancamento: numero })
    expect(validarFichaParaConclusao({ clienteId: 'cliente-1', numeroLancamento: String(numero), ficha: {
      consultoraNome: 'Ana', criancas: [], departamentos: ['moveis'], produtosInteresse: [],
      resultadoAtendimento: 'sim', motivosResultado: ['preco'], etapaAtual: 'revisao',
    } })).toEqual({ ok: true, numeroLancamento: numero })
  })

  it.each(['', '   ', undefined, null])('distingue lancamento ausente: %s', (valor) => {
    expect(validarNumeroLancamento(valor)).toMatchObject({ ok: false, field: 'numeroLancamento', message: 'Informe o numero do lancamento.' })
  })

  it.each(['22a', '-22', '22.5', '22,5', '2e2', {}, 22.5])('nao converte formato invalido %s em outro lancamento', (valor) => {
    expect(normalizarNumeroLancamento(valor)).toBeNull()
    expect(validarNumeroLancamento(valor)).toMatchObject({ ok: false, message: 'Use somente digitos para informar um numero inteiro de lancamento.' })
  })

  it.each([0, '0', -1, 1000000, '1000000'])('explica faixa invalida para %s', (valor) => {
    expect(validarNumeroLancamento(valor)).toMatchObject({ ok: false, message: 'O numero do lancamento deve estar entre 1 e 999999.' })
  })

  it('mantem zeros iniciais e espacos sem nova restricao de digitos', () => {
    expect(validarNumeroLancamento(' 000022 ')).toEqual({ ok: true, numeroLancamento: 22 })
    expect(validarNumeroLancamento('0000001')).toEqual({ ok: true, numeroLancamento: 1 })
  })

  it('preserva texto de lancamento invalido no rascunho em vez de corta-lo ou apagar dados', () => {
    const entradasFormulario = { novoCliente: { nome: '', telefone: '', parentesco: '' as const, parentescoOutro: '' },
      dataPrevistaInputs: {}, viradaCartaoInput: '', produtoDigitado: '', numeroLancamento: '1000000', telefonePendente: null }
    const resultado = validarFichaDadosRascunho({ entradasFormulario, criancas: [], departamentos: ['moveis'],
      produtosInteresse: ['Berco'], motivosResultado: ['preco'], observacoes: 'Preservar', etapaAtual: 'revisao' })
    expect(resultado).toMatchObject({ ok: true, dados: { entradasFormulario: { numeroLancamento: '1000000' }, observacoes: 'Preservar', produtosInteresse: ['Berco'] } })
  })
  it('preserva nome, sexo, data e inputs incompletos em sucessivas normalizacoes do servidor', () => {
    const dados = {
      criancas: [{ id: 'crianca-teste', situacao: 'gestacao', nome: 'Maria Clara', sexo: 'menina', dataPrevistaNascimento: '2027-02-15' }],
      entradasFormulario: {
        novoCliente: { nome: 'Cadastro em edicao', telefone: '(41) 9', parentesco: '', parentescoOutro: '' },
        dataPrevistaInputs: { outra: '15/02' }, viradaCartaoInput: '12/', produtoDigitado: 'Berco', numeroLancamento: '123',
        telefonePendente: { clienteId: 'cliente-teste', valor: '(41) 99' },
      },
    }
    const primeira = validarFichaDadosRascunho(dados)
    expect(primeira.ok).toBe(true)
    if (!primeira.ok) return
    const segunda = migrarFichaDadosRascunho(JSON.parse(JSON.stringify(primeira.dados)))
    expect(segunda.criancas).toEqual([{ ...dados.criancas[0], nome: 'MARIA CLARA' }])
    expect(segunda.entradasFormulario).toEqual(dados.entradasFormulario)
    expect(segunda.etapaAtual).toBe('ficha')
  })

  it('rejeita nome invalido sem apagar silenciosamente a crianca', () => {
    expect(validarFichaDadosRascunho({ criancas: [{ id: 'crianca-teste', nome: 'Maria123' }] })).toMatchObject({ ok: false, field: 'criancas' })
  })

  it('normaliza nomes de crianca com acentos em maiusculas ao validar o rascunho', () => {
    const resultado = validarFichaDadosRascunho({ criancas: [{ id: 'crianca-teste', situacao: 'gestacao', nome: 'joão pedro' }] })
    expect(resultado).toMatchObject({ ok: true, dados: { criancas: [{ nome: 'JOÃO PEDRO' }] } })
  })

  it('preserva unidade da idade antes de informar o valor', () => {
    expect(migrarFichaDadosRascunho({ criancas: [{ id: 'crianca-teste', situacao: 'ja_nasceu', idadeUnidade: 'meses' }] }).criancas[0].idadeUnidade).toBe('meses')
  })
  it('aceita payload vazio e cria defaults', () => {
    expect(validarFichaDadosRascunho({})).toEqual({
      ok: true,
      dados: {
        criancas: [],
        departamentos: [],
        produtosInteresse: [],
        motivosResultado: [],
        etapaAtual: 'ficha',
      },
    })
  })

  it('rejeita campos desconhecidos', () => {
    expect(validarFichaDadosRascunho({ unidadeId: 'x' })).toMatchObject({
      ok: false,
      field: 'dadosRascunho',
    })
  })

  it('normaliza gestacao sem conversao UTC', () => {
    const resultado = validarFichaDadosRascunho({
      criancas: [{ id: 'crianca-1', situacao: 'gestacao', dataPrevistaNascimento: '2026-12-20' }],
    })

    expect(resultado).toMatchObject({
      ok: true,
      dados: { criancas: [{ dataPrevistaNascimento: '2026-12-20' }] },
    })
  })

  it('formata e converte data prevista em DD/MM/AAAA sem salvar parcial', () => {
    expect(formatarDataPrevistaInput('20122026')).toBe('20/12/2026')
    expect(formatarDataPrevistaInput('2026-12-20')).toBe('20/12/2026')
    expect(formatarDataPrevistaInput('20/1')).toBe('20/1')
    expect(converterDataInputParaISO('20/12/2026')).toBe('2026-12-20')
    expect(converterDataInputParaISO('20/12')).toBe('')
    expect(converterDataInputParaISO('31/02/2026')).toBe('')
    expect(formatarDataISOParaInput('2026-12-20')).toBe('20/12/2026')
  })

  it('mantem idade valida e descarta idade invalida', () => {
    const resultado = validarFichaDadosRascunho({
      criancas: [
        { id: 'crianca-1', situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 11 },
        { id: 'crianca-2', situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 12 },
        { id: 'crianca-3', situacao: 'ja_nasceu', idadeUnidade: 'anos', idadeValor: 6 },
        { id: 'crianca-4', situacao: 'ja_nasceu', idadeUnidade: 'anos', idadeValor: 7 },
      ],
    })

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.dados.criancas[0]).toMatchObject({ idadeUnidade: 'meses', idadeValor: 11 })
      expect(resultado.dados.criancas[1].idadeValor).toBeUndefined()
      expect(resultado.dados.criancas[2]).toMatchObject({ idadeUnidade: 'anos', idadeValor: 6 })
      expect(resultado.dados.criancas[3].idadeValor).toBeUndefined()
    }
  })

  it('normaliza departamentos e produtos', () => {
    const resultado = validarFichaDadosRascunho({
      departamentos: ['p_pesada', 'p_pesada', 'invalido'],
      produtosInteresse: [' Carrinho Salsa 4 ', '', 'Carrinho Salsa 4', 'Berco branco'],
    })

    expect(resultado).toMatchObject({
      ok: true,
      dados: {
        departamentos: ['p_pesada'],
        produtosInteresse: ['Carrinho Salsa 4', 'Berco branco'],
      },
    })
  })

  it('aceita nome da crianca com acento, espaco, hifen e apostrofo', () => {
    const resultado = validarFichaDadosRascunho({
      criancas: [{ id: 'crianca-1', situacao: 'nao_informado', nome: "  Maria Luisa D'Avila-Sao  " }],
    })

    expect(resultado).toMatchObject({
      ok: true,
      dados: { criancas: [{ nome: "MARIA LUISA D'AVILA-SAO" }] },
    })
  })

  it('aceita nome nao informado e rejeita nome junto com a flag', () => {
    expect(validarFichaDadosRascunho({
      criancas: [{ id: 'crianca-1', situacao: 'gestacao', nomeNaoInformado: true }],
    })).toMatchObject({
      ok: true,
      dados: { criancas: [{ nomeNaoInformado: true }] },
    })

    expect(validarFichaDadosRascunho({
      criancas: [{ id: 'crianca-1', situacao: 'gestacao', nome: 'Maria', nomeNaoInformado: true }],
    })).toMatchObject({
      ok: false,
      field: 'criancas',
    })
  })

  it('bloqueia numeros, simbolos indevidos e emoji no nome da crianca', () => {
    expect(nomeCriancaValido('Maria Luisa')).toBe(true)
    expect(nomeCriancaValido('Maria 2')).toBe(false)
    expect(nomeCriancaValido('Maria @')).toBe(false)
    expect(nomeCriancaValido('Maria 🙂')).toBe(false)
    expect(limparNomeCriancaDigitacao('Maria 2@🙂 Luisa')).toBe('Maria  Luisa')
  })

  it('normaliza resultado, motivos, outro, observacoes e etapa', () => {
    const resultado = validarFichaDadosRascunho({
      resultadoAtendimento: 'sim',
      motivosResultado: ['preco', 'outro', 'preco', 'invalido'],
      motivoOutro: '  cliente pediu retorno  ',
      observacoes: ' linha 1\nlinha 2 ',
      etapaAtual: 'revisao',
    })

    expect(resultado).toMatchObject({
      ok: true,
      dados: {
        resultadoAtendimento: 'sim',
        motivosResultado: ['preco', 'outro'],
        motivoOutro: 'cliente pediu retorno',
        observacoes: 'linha 1\nlinha 2',
        etapaAtual: 'revisao',
      },
    })
  })

  it('mantem resultado canonico e nao aceita label traduzida como valor interno', () => {
    for (const resultadoAtendimento of ['sim', 'nao', 'negociacao']) {
      expect(validarFichaParaConclusao({
        clienteId: 'cliente-1',
        numeroLancamento: resultadoAtendimento === 'sim' ? '123' : '',
        ficha: {
          consultoraNome: 'Ana Clara',
          criancas: [],
          departamentos: ['p_pesada'],
          produtosInteresse: [],
          resultadoAtendimento: resultadoAtendimento as 'sim' | 'nao' | 'negociacao',
          motivosResultado: ['preco'],
          etapaAtual: 'revisao',
        },
      })).toMatchObject({ ok: true })
    }

    const payloadComLabel = validarFichaDadosRascunho({
      consultoraNome: 'Ana Clara',
      resultadoAtendimento: 'Não',
      motivosResultado: ['preco'],
      departamentos: ['p_pesada'],
    })

    expect(payloadComLabel).toMatchObject({ ok: true })
    if (payloadComLabel.ok) {
      expect(payloadComLabel.dados).not.toHaveProperty('resultadoAtendimento')
      expect(validarFichaParaConclusao({
        clienteId: 'cliente-1',
        ficha: payloadComLabel.dados,
      })).toMatchObject({
        ok: false,
        field: 'resultadoAtendimento',
        message: 'Selecione o resultado do atendimento.',
      })
    }
  })

  it('normaliza motivo virada de cartao somente com DD/MM valido', () => {
    expect(formatarViradaCartaoInput('0508')).toBe('05/08')
    expect(formatarViradaCartaoInput('05/2026')).toBe('05/20')
    expect(converterViradaCartaoInput('05/08')).toEqual({ dia: 5, mes: 8 })
    expect(converterViradaCartaoInput('31/04')).toBeNull()
    expect(converterViradaCartaoInput('29/02')).toEqual({ dia: 29, mes: 2 })
    expect(formatarViradaCartao(5, 8)).toBe('05/08')
    expect(valorOrdenavelViradaCartao(5, 8)).toBe(805)

    const resultado = validarFichaDadosRascunho({
      motivosResultado: ['virada_cartao'],
      viradaCartaoDia: 5,
      viradaCartaoMes: 8,
    })

    expect(resultado).toMatchObject({
      ok: true,
      dados: {
        motivosResultado: ['virada_cartao'],
        viradaCartaoDia: 5,
        viradaCartaoMes: 8,
      },
    })

    expect(migrarFichaDadosRascunho({
      motivosResultado: ['preco'],
      viradaCartaoDia: 5,
      viradaCartaoMes: 8,
    })).not.toHaveProperty('viradaCartaoDia')
  })

  it('migra rascunho antigo com notaTecnica para schema vazio', () => {
    expect(migrarFichaDadosRascunho({ notaTecnica: 'texto antigo' })).toEqual({
      criancas: [],
      departamentos: [],
      produtosInteresse: [],
      motivosResultado: [],
      etapaAtual: 'ficha',
    })
  })

  it('migra etapas antigas para a ficha unificada', () => {
    for (const etapaAtual of ['cliente', 'criancas', 'interesses', 'observacoes']) {
      expect(migrarFichaDadosRascunho({ etapaAtual }).etapaAtual).toBe('ficha')
    }
    expect(migrarFichaDadosRascunho({ etapaAtual: 'resultado' }).etapaAtual).toBe('resultado')
    expect(migrarFichaDadosRascunho({ etapaAtual: 'revisao' }).etapaAtual).toBe('revisao')
  })

  it('cria crianca com id local estavel', () => {
    expect(criarCriancaRascunho('local-1')).toEqual({ id: 'local-1', situacao: 'gestacao' })
  })

  it('valida campos obrigatorios para conclusao definitiva', () => {
    expect(validarFichaParaConclusao({
      clienteId: null,
      numeroLancamento: '123',
      ficha: {
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'sim',
        motivosResultado: ['preco'],
        etapaAtual: 'revisao',
      },
    })).toMatchObject({ ok: false, field: 'clienteId' })

    expect(validarFichaParaConclusao({
      clienteId: 'cliente-1',
      numeroLancamento: '',
      ficha: {
        consultoraNome: 'Ana Clara',
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'sim',
        motivosResultado: ['preco'],
        etapaAtual: 'revisao',
      },
    })).toMatchObject({ ok: false, field: 'numeroLancamento' })

    expect(validarFichaParaConclusao({
      clienteId: 'cliente-1',
      numeroLancamento: '987',
      ficha: {
        consultoraNome: 'Ana Clara',
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'sim',
        motivosResultado: ['preco'],
        etapaAtual: 'revisao',
      },
    })).toEqual({ ok: true, numeroLancamento: 987 })

    expect(validarFichaParaConclusao({
      clienteId: 'cliente-1',
      numeroLancamento: '987',
      ficha: {
        consultoraNome: 'Ana Clara',
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'nao',
        motivosResultado: ['preco'],
        etapaAtual: 'revisao',
      },
    })).toEqual({ ok: true, numeroLancamento: null })

    expect(validarFichaParaConclusao({
      clienteId: 'cliente-1',
      numeroLancamento: '',
      ficha: {
        consultoraNome: 'Ana Clara',
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'nao',
        motivosResultado: ['virada_cartao'],
        etapaAtual: 'revisao',
      },
    })).toMatchObject({ ok: false, field: 'viradaCartao' })
  })
})


it('preserva oito criancas e rejeita a nona sem retornar payload truncado', () => {
  const criancas = Array.from({ length: 9 }, (_, i) => ({ id: `crianca-${i}`, situacao: 'gestacao' }))
  expect(validarFichaDadosRascunho({ criancas: criancas.slice(0, 8) })).toMatchObject({ ok: true, dados: { criancas: criancas.slice(0, 8) } })
  expect(validarFichaDadosRascunho({ criancas })).toMatchObject({ ok: false, field: 'criancas' })
})
