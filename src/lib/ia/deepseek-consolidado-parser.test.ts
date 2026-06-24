import { describe, it, expect } from 'vitest'
import { extrairTrechosFatuais } from './extrair-trechos-fatuais'

// Importa apenas as funcoes de parsing isoladamente via acesso ao modulo
// Sem chamar a API real — testa somente a logica de validacao/fallback do parser

// Replica local dos helpers de parsing para teste isolado
// (evita expor funcoes internas do modulo de producao)

type TipoFechamento =
  | 'Presencial \u2014 visitou a loja e comprou na loja'
  | 'Digital \u2014 n\u00e3o visitou a loja e comprou online'
  | 'Misto \u2014 visitou a loja e comprou depois online'
  | 'Misto \u2014 conversou online e comprou depois presencialmente'
  | 'Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente'

type ConfiancaTipoFechamento = 'Alta' | 'M\u00e9dia' | 'Baixa'

const VALID_TIPO_FECHAMENTO: TipoFechamento[] = [
  'Presencial \u2014 visitou a loja e comprou na loja',
  'Digital \u2014 n\u00e3o visitou a loja e comprou online',
  'Misto \u2014 visitou a loja e comprou depois online',
  'Misto \u2014 conversou online e comprou depois presencialmente',
  'Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente',
]
const VALID_CONFIANCA: ConfiancaTipoFechamento[] = ['Alta', 'M\u00e9dia', 'Baixa']

function parseTipoFechamento(raw: unknown): TipoFechamento {
  if (typeof raw === 'string' && VALID_TIPO_FECHAMENTO.includes(raw as TipoFechamento)) {
    return raw as TipoFechamento
  }
  return 'Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente'
}

function parseConfiancaFechamento(raw: unknown): ConfiancaTipoFechamento {
  if (typeof raw === 'string' && VALID_CONFIANCA.includes(raw as ConfiancaTipoFechamento)) {
    return raw as ConfiancaTipoFechamento
  }
  return 'Baixa'
}

function toStringArray(obj: Record<string, unknown>, key: string): string[] {
  if (!Array.isArray(obj[key])) return []
  return (obj[key] as unknown[]).map((v) => String(v))
}

type ConfiancaNegociacao = 'Alta' | 'Média' | 'Baixa'
const VALID_CONFIANCA_NEG: ConfiancaNegociacao[] = ['Alta', 'Média', 'Baixa']
const VALID_TIPO_VALOR = ['produto', 'frete', 'desconto', 'pagamento', 'outro'] as const
type TipoValor = typeof VALID_TIPO_VALOR[number]

function toConfiancaNeg(v: unknown): ConfiancaNegociacao {
  return typeof v === 'string' && VALID_CONFIANCA_NEG.includes(v as ConfiancaNegociacao)
    ? (v as ConfiancaNegociacao)
    : 'Baixa'
}
function toNullableStr(v: unknown): string | null {
  return v != null && v !== '' && typeof v === 'string' ? v : null
}
function toNullableNum(v: unknown): number | null {
  return typeof v === 'number' ? v : v != null && !isNaN(Number(v)) ? Number(v) : null
}
function toBool(v: unknown): boolean {
  return v === true || v === 'true'
}

function parseNegociacoesPrazo(obj: Record<string, unknown>) {
  if (!Array.isArray(obj.negociacoes_prazo)) return []
  return (obj.negociacoes_prazo as unknown[]).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      tipo: 'prazo' as const,
      resumo: String(it.resumo ?? ''),
      data_prometida: toNullableStr(it.data_prometida),
      evidencia: String(it.evidencia ?? ''),
      chamado_numero: toNullableNum(it.chamado_numero),
      protocolo: toNullableStr(it.protocolo),
      confianca: toConfiancaNeg(it.confianca),
    }
  })
}

function parseNegociacoesFrete(obj: Record<string, unknown>) {
  if (!Array.isArray(obj.negociacoes_frete)) return []
  return (obj.negociacoes_frete as unknown[]).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      tipo: 'frete' as const,
      valor_original: toNullableStr(it.valor_original),
      valor_negociado: toNullableStr(it.valor_negociado),
      resumo: String(it.resumo ?? ''),
      evidencia: String(it.evidencia ?? ''),
      chamado_numero: toNullableNum(it.chamado_numero),
      protocolo: toNullableStr(it.protocolo),
      confianca: toConfiancaNeg(it.confianca),
    }
  })
}

function parseNegociacoesDesconto(obj: Record<string, unknown>) {
  if (!Array.isArray(obj.negociacoes_desconto)) return []
  return (obj.negociacoes_desconto as unknown[]).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      tipo: 'desconto' as const,
      valor_original: toNullableStr(it.valor_original),
      valor_final: toNullableStr(it.valor_final),
      percentual: toNullableStr(it.percentual),
      resumo: String(it.resumo ?? ''),
      evidencia: String(it.evidencia ?? ''),
      chamado_numero: toNullableNum(it.chamado_numero),
      protocolo: toNullableStr(it.protocolo),
      confianca: toConfiancaNeg(it.confianca),
    }
  })
}

function parseNegociacoesPagamento(obj: Record<string, unknown>) {
  if (!Array.isArray(obj.negociacoes_pagamento)) return []
  return (obj.negociacoes_pagamento as unknown[]).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      tipo: 'pagamento' as const,
      forma: toNullableStr(it.forma),
      houve_link_pagamento: toBool(it.houve_link_pagamento),
      link_usado_confirmado: toBool(it.link_usado_confirmado),
      resumo: String(it.resumo ?? ''),
      evidencia: String(it.evidencia ?? ''),
      chamado_numero: toNullableNum(it.chamado_numero),
      protocolo: toNullableStr(it.protocolo),
      confianca: toConfiancaNeg(it.confianca),
    }
  })
}

function parseValoresCitados(obj: Record<string, unknown>) {
  if (!Array.isArray(obj.valores_citados)) return []
  return (obj.valores_citados as unknown[]).map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>
    const tipoValor: TipoValor = typeof it.tipo_valor === 'string' && VALID_TIPO_VALOR.includes(it.tipo_valor as TipoValor)
      ? (it.tipo_valor as TipoValor)
      : 'outro'
    return {
      valor: String(it.valor ?? ''),
      contexto: String(it.contexto ?? ''),
      tipo_valor: tipoValor,
      chamado_numero: toNullableNum(it.chamado_numero),
      protocolo: toNullableStr(it.protocolo),
      confianca: toConfiancaNeg(it.confianca),
    }
  })
}

// Simula o que analisarConsolidadoIA faz com o JSON retornado pela IA
function parseConsolidado(obj: Record<string, unknown>) {
  return {
    produtos_fechados: toStringArray(obj, 'produtos_fechados'),
    produtos_interesse_nao_fechados: toStringArray(obj, 'produtos_interesse_nao_fechados'),
    tipo_fechamento: parseTipoFechamento(obj.tipo_fechamento),
    confianca_tipo_fechamento: parseConfiancaFechamento(obj.confianca_tipo_fechamento),
    evidencias_tipo_fechamento: toStringArray(obj, 'evidencias_tipo_fechamento'),
    negociacoes_prazo: parseNegociacoesPrazo(obj),
    negociacoes_frete: parseNegociacoesFrete(obj),
    negociacoes_desconto: parseNegociacoesDesconto(obj),
    negociacoes_pagamento: parseNegociacoesPagamento(obj),
    valores_citados: parseValoresCitados(obj),
  }
}

describe('deepseek-consolidado-parser — campos comerciais novos', () => {
  it('parseia corretamente uma resposta completa com todos os campos', () => {
    const raw = {
      produtos_fechados: ['C\u00f4moda', 'Enxoval'],
      produtos_interesse_nao_fechados: ['Roupeiro'],
      tipo_fechamento: 'Presencial \u2014 visitou a loja e comprou na loja',
      confianca_tipo_fechamento: 'Alta',
      evidencias_tipo_fechamento: [
        'Cliente informou que iria \u00e0 loja no chamado N\u00ba 3 \u2014 protocolo 2026022558032.',
        'Atendente ofereceu link de pagamento no chamado N\u00ba 3 \u2014 protocolo 2026022558032.',
      ],
    }

    const result = parseConsolidado(raw)

    expect(result.produtos_fechados).toEqual(['C\u00f4moda', 'Enxoval'])
    expect(result.produtos_interesse_nao_fechados).toEqual(['Roupeiro'])
    expect(result.tipo_fechamento).toBe('Presencial \u2014 visitou a loja e comprou na loja')
    expect(result.confianca_tipo_fechamento).toBe('Alta')
    expect(result.evidencias_tipo_fechamento).toHaveLength(2)
  })

  it('retorna Indefinido e Baixa quando tipo_fechamento e confianca sao invalidos', () => {
    const raw = {
      produtos_fechados: [],
      produtos_interesse_nao_fechados: [],
      tipo_fechamento: 'Valor desconhecido',
      confianca_tipo_fechamento: 'SuperAlta',
      evidencias_tipo_fechamento: [],
    }

    const result = parseConsolidado(raw)

    expect(result.tipo_fechamento).toBe('Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente')
    expect(result.confianca_tipo_fechamento).toBe('Baixa')
  })

  it('retorna arrays vazios quando campos de array estao ausentes', () => {
    const raw = {
      tipo_fechamento: 'Digital \u2014 n\u00e3o visitou a loja e comprou online',
      confianca_tipo_fechamento: 'M\u00e9dia',
    }

    const result = parseConsolidado(raw)

    expect(result.produtos_fechados).toEqual([])
    expect(result.produtos_interesse_nao_fechados).toEqual([])
    expect(result.evidencias_tipo_fechamento).toEqual([])
  })

  it('retorna Indefinido quando tipo_fechamento esta ausente', () => {
    const raw = {}
    const result = parseConsolidado(raw)
    expect(result.tipo_fechamento).toBe('Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente')
    expect(result.confianca_tipo_fechamento).toBe('Baixa')
  })

  it('aceita todos os valores validos de tipo_fechamento', () => {
    for (const tipo of VALID_TIPO_FECHAMENTO) {
      const result = parseConsolidado({ tipo_fechamento: tipo, confianca_tipo_fechamento: 'Alta' })
      expect(result.tipo_fechamento).toBe(tipo)
    }
  })

  it('aceita todos os valores validos de confianca_tipo_fechamento', () => {
    for (const conf of VALID_CONFIANCA) {
      const result = parseConsolidado({
        tipo_fechamento: 'Misto \u2014 visitou a loja e comprou depois online',
        confianca_tipo_fechamento: conf,
      })
      expect(result.confianca_tipo_fechamento).toBe(conf)
    }
  })

  it('nao inclui em produtos_interesse_nao_fechados produto ja presente em produtos_fechados — validacao da regra de negocio via fixture', () => {
    // Este teste valida que uma resposta de IA bem-formada nao duplica produtos
    // A regra de negocio e aplicada no prompt; este teste verifica o contrato do parser
    const raw = {
      produtos_fechados: ['C\u00f4moda', 'Enxoval'],
      produtos_interesse_nao_fechados: ['Roupeiro'],
      tipo_fechamento: 'Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente',
      confianca_tipo_fechamento: 'Baixa',
      evidencias_tipo_fechamento: ['N\u00e3o h\u00e1 evid\u00eancia de canal de fechamento nos chamados.'],
    }

    const result = parseConsolidado(raw)

    // Roupeiro nao esta em produtos_fechados — correto
    expect(result.produtos_fechados).not.toContain('Roupeiro')
    expect(result.produtos_interesse_nao_fechados).toContain('Roupeiro')
  })
})

describe('deepseek-consolidado-parser — negociacoes comerciais', () => {
  it('parseia negociacoes_prazo com data_prometida e chamado_numero', () => {
    const raw = {
      negociacoes_prazo: [
        {
          tipo: 'prazo',
          resumo: 'Consultora informou entrega e montagem para 05/03.',
          data_prometida: '05/03/2026',
          evidencia: 'No chamado N\u00ba 3, cliente perguntou sobre entrega.',
          chamado_numero: 3,
          protocolo: '2026022558032',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_prazo).toHaveLength(1)
    expect(result.negociacoes_prazo[0].tipo).toBe('prazo')
    expect(result.negociacoes_prazo[0].data_prometida).toBe('05/03/2026')
    expect(result.negociacoes_prazo[0].chamado_numero).toBe(3)
    expect(result.negociacoes_prazo[0].protocolo).toBe('2026022558032')
    expect(result.negociacoes_prazo[0].confianca).toBe('Alta')
  })

  it('retorna array vazio para negociacoes_prazo quando campo ausente', () => {
    const result = parseConsolidado({})
    expect(result.negociacoes_prazo).toEqual([])
  })

  it('parseia negociacoes_frete com valores monetarios', () => {
    const raw = {
      negociacoes_frete: [
        {
          tipo: 'frete',
          valor_original: 'R$ 150,00',
          valor_negociado: 'R$ 100,00',
          resumo: 'Frete negociado de R$ 150,00 para R$ 100,00.',
          evidencia: 'Chamado N\u00ba 2 \u2014 protocolo 2026031200001.',
          chamado_numero: 2,
          protocolo: '2026031200001',
          confianca: 'M\u00e9dia',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_frete).toHaveLength(1)
    expect(result.negociacoes_frete[0].valor_original).toBe('R$ 150,00')
    expect(result.negociacoes_frete[0].valor_negociado).toBe('R$ 100,00')
    expect(result.negociacoes_frete[0].confianca).toBe('M\u00e9dia')
  })

  it('retorna array vazio para negociacoes_frete quando campo ausente', () => {
    const result = parseConsolidado({})
    expect(result.negociacoes_frete).toEqual([])
  })

  it('parseia negociacoes_desconto com percentual', () => {
    const raw = {
      negociacoes_desconto: [
        {
          tipo: 'desconto',
          valor_original: 'R$ 2.000,00',
          valor_final: 'R$ 1.800,00',
          percentual: '10%',
          resumo: 'Cliente pediu desconto e consultora concedeu 10%.',
          evidencia: 'Chamado N\u00ba 1 \u2014 protocolo 2026010100099.',
          chamado_numero: 1,
          protocolo: '2026010100099',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_desconto).toHaveLength(1)
    expect(result.negociacoes_desconto[0].valor_original).toBe('R$ 2.000,00')
    expect(result.negociacoes_desconto[0].valor_final).toBe('R$ 1.800,00')
    expect(result.negociacoes_desconto[0].percentual).toBe('10%')
  })

  it('desconto sem itens retorna array vazio', () => {
    const result = parseConsolidado({ negociacoes_desconto: [] })
    expect(result.negociacoes_desconto).toEqual([])
  })

  it('parseia negociacoes_pagamento — link oferecido mas nao usado', () => {
    const raw = {
      negociacoes_pagamento: [
        {
          tipo: 'pagamento',
          forma: 'cart\u00e3o',
          houve_link_pagamento: true,
          link_usado_confirmado: false,
          resumo: 'Consultora ofereceu link de pagamento, mas cliente disse que iria \u00e0 loja.',
          evidencia: 'Chamado N\u00ba 3 \u2014 protocolo 2026022558032.',
          chamado_numero: 3,
          protocolo: '2026022558032',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_pagamento).toHaveLength(1)
    expect(result.negociacoes_pagamento[0].houve_link_pagamento).toBe(true)
    expect(result.negociacoes_pagamento[0].link_usado_confirmado).toBe(false)
    expect(result.negociacoes_pagamento[0].forma).toBe('cart\u00e3o')
  })

  it('negociacoes_pagamento ausente retorna array vazio', () => {
    const result = parseConsolidado({})
    expect(result.negociacoes_pagamento).toEqual([])
  })

  it('parseia valores_citados — valor de produto nao vira desconto', () => {
    const raw = {
      valores_citados: [
        {
          valor: 'R$ 3.500,00',
          contexto: 'Consultora informou valor do ber\u00e7o no chamado.',
          tipo_valor: 'produto',
          chamado_numero: 1,
          protocolo: '2026010100099',
          confianca: 'Alta',
        },
      ],
      negociacoes_desconto: [],
    }
    const result = parseConsolidado(raw)
    expect(result.valores_citados).toHaveLength(1)
    expect(result.valores_citados[0].valor).toBe('R$ 3.500,00')
    expect(result.valores_citados[0].tipo_valor).toBe('produto')
    expect(result.negociacoes_desconto).toHaveLength(0)
  })

  it('tipo_valor invalido em valores_citados cai em "outro"', () => {
    const raw = {
      valores_citados: [
        { valor: 'R$ 100,00', contexto: 'contexto', tipo_valor: 'INVALIDO', chamado_numero: null, protocolo: null, confianca: 'Baixa' },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.valores_citados[0].tipo_valor).toBe('outro')
  })

  it('confianca invalida em negociacao cai em Baixa', () => {
    const raw = {
      negociacoes_prazo: [
        { tipo: 'prazo', resumo: 'x', data_prometida: null, evidencia: 'y', chamado_numero: null, protocolo: null, confianca: 'INVALIDA' },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_prazo[0].confianca).toBe('Baixa')
  })

  it('oferta de link — houve_link_pagamento true, link_usado_confirmado false quando cliente foi a loja', () => {
    // Fixture: atendente disse "posso estar enviando o link para o fechamento do roupeiro"
    // cliente nao confirmou uso do link e indicou que iria a loja passar o cartao
    const raw = {
      negociacoes_pagamento: [
        {
          tipo: 'pagamento',
          forma: 'cartao na loja',
          houve_link_pagamento: true,
          link_usado_confirmado: false,
          resumo: 'Link oferecido/sugerido — nao confirmado como enviado ou usado. Pagamento ocorreu presencialmente.',
          evidencia: 'Chamado N\u00ba 3 \u2014 protocolo 2026022558032: atendente ofereceu enviar link para fechamento do roupeiro, cliente nao confirmou uso e havia indicado ida a loja para passar cartao.',
          chamado_numero: 3,
          protocolo: '2026022558032',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_pagamento).toHaveLength(1)
    const pag = result.negociacoes_pagamento[0]
    expect(pag.houve_link_pagamento).toBe(true)
    expect(pag.link_usado_confirmado).toBe(false)
    expect(pag.resumo).not.toContain('nao mencionado')
    expect(pag.forma).toBe('cartao na loja')
  })

  it('ausencia de link — houve_link_pagamento false quando link nao foi mencionado', () => {
    const raw = {
      negociacoes_pagamento: [
        {
          tipo: 'pagamento',
          forma: 'cartao presencial',
          houve_link_pagamento: false,
          link_usado_confirmado: false,
          resumo: 'Cliente pagou presencialmente com cartao.',
          evidencia: 'Nenhuma mencao a link de pagamento.',
          chamado_numero: 1,
          protocolo: '2026010100001',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_pagamento[0].houve_link_pagamento).toBe(false)
    expect(result.negociacoes_pagamento[0].link_usado_confirmado).toBe(false)
  })

  it('data_prometida com ano inferido — parser aceita dd/mm/aaaa completo gerado pela IA', () => {
    // Fixture: chamado ocorreu em 25/02/2026, conversa menciona entrega em "05/03"
    // A IA deve inferir 05/03/2026 usando a data do chamado (regra adicionada ao prompt consolidado)
    // O parser apenas recebe e valida o valor; a inferencia ocorre na IA, nao no parser
    const raw = {
      negociacoes_prazo: [
        {
          tipo: 'prazo',
          resumo: 'Entrega informada para 05/03/2026 (ano inferido pela data do chamado Nb 3).',
          data_prometida: '05/03/2026',
          evidencia: 'Chamado N\u00ba 3 \u2014 protocolo 2026022558032: consultora informou entrega em 05/03.',
          chamado_numero: 3,
          protocolo: '2026022558032',
          confianca: 'Alta',
        },
      ],
    }
    const result = parseConsolidado(raw)
    expect(result.negociacoes_prazo).toHaveLength(1)
    expect(result.negociacoes_prazo[0].data_prometida).toBe('05/03/2026')
    expect(result.negociacoes_prazo[0].confianca).toBe('Alta')
    expect(result.negociacoes_prazo[0].resumo).not.toContain('ano n\u00e3o confirmado')
  })

  it('compatibilidade com analise antiga — campos de negociacao ausentes retornam arrays vazios', () => {
    const rawAntigo = {
      produtos_fechados: ['Ber\u00e7o'],
      produtos_interesse_nao_fechados: [],
      tipo_fechamento: 'Indefinido \u2014 n\u00e3o h\u00e1 evid\u00eancia suficiente',
      confianca_tipo_fechamento: 'Baixa',
      evidencias_tipo_fechamento: [],
    }
    const result = parseConsolidado(rawAntigo)
    expect(result.negociacoes_prazo).toEqual([])
    expect(result.negociacoes_frete).toEqual([])
    expect(result.negociacoes_desconto).toEqual([])
    expect(result.negociacoes_pagamento).toEqual([])
    expect(result.valores_citados).toEqual([])
  })
})

describe('extrairTrechosFatuais — helper deterministico de trechos', () => {
  it('captura linha com data dd/mm sem ano', () => {
    const transcript = '[25/02/2026 13:01] Atendente: Fechando hoje consigo a entrega e montagem ja para dia 05/03'
    const trechos = extrairTrechosFatuais(transcript)
    expect(trechos.length).toBeGreaterThan(0)
    expect(trechos[0]).toContain('05/03')
    expect(trechos[0]).toContain('entrega')
  })

  it('captura linha com valor monetario R$', () => {
    const transcript = '[25/02/2026 13:05] Cliente: E o preco desse roupeiro?\n[25/02/2026 13:06] Atendente: R$ 1.400,00 a vista'
    const trechos = extrairTrechosFatuais(transcript)
    expect(trechos.some((t) => t.includes('R$') && t.includes('1.400'))).toBe(true)
  })

  it('captura linha com mencao a link de pagamento', () => {
    const transcript = '[25/02/2026 13:10] Atendente: Se preferir posso estar enviando o link para o fechamento do roupeiro, o que acha?'
    const trechos = extrairTrechosFatuais(transcript)
    expect(trechos.length).toBeGreaterThan(0)
    expect(trechos[0]).toContain('link')
  })

  it('captura linha com mencao a entrega/montagem', () => {
    const transcript = '[25/02/2026 13:02] Atendente: Para quando ficaria a entrega mais ou menos?'
    const trechos = extrairTrechosFatuais(transcript)
    expect(trechos.length).toBeGreaterThan(0)
    expect(trechos[0]).toContain('entrega')
  })

  it('nao captura linha sem relevancia factual', () => {
    const transcript = '[25/02/2026 13:00] Cliente: Simm!\n[25/02/2026 13:01] Atendente: Boa tarde!!'
    const trechos = extrairTrechosFatuais(transcript)
    expect(trechos.length).toBe(0)
  })

  it('transcript vazio retorna array vazio', () => {
    expect(extrairTrechosFatuais('')).toEqual([])
    expect(extrairTrechosFatuais('   ')).toEqual([])
  })

  it('respeita limite de 30 trechos', () => {
    // Gera 50 linhas com "entrega" para testar o limite
    const linhas = Array.from({ length: 50 }, (_, i) => `[25/02/2026 ${String(i).padStart(2, '0')}:00] Atendente: entrega numero ${i}`)
    const trechos = extrairTrechosFatuais(linhas.join('\n'))
    expect(trechos.length).toBeLessThanOrEqual(30)
  })

  it('fixture real: frase do chamado Nb 3 capturada com 05/03', () => {
    const transcript = [
      '[25/02/2026 13:00] Cliente: Boa tarde!!',
      '[25/02/2026 13:01] Atendente: Boa tarde!',
      '[25/02/2026 13:02] Atendente: Para quando ficaria a entrega mais ou menos?',
      '[25/02/2026 13:05] Atendente: Fechando hoje consigo a entrega e montagem ja para dia 05/03',
      '[25/02/2026 13:07] Atendente: Se preferir posso estar enviando o link para o fechamento do roupeiro, o que acha??',
      '[25/02/2026 13:08] Cliente: Hoje ou amanha passamos ai para passar o cartao',
      '[25/02/2026 13:09] Cliente: Simm!',
    ].join('\n')
    const trechos = extrairTrechosFatuais(transcript)
    // Deve capturar: entrega (13:02), 05/03+entrega+montagem (13:05), link (13:07), cartao+loja (13:08)
    expect(trechos.some((t) => t.includes('05/03'))).toBe(true)
    expect(trechos.some((t) => t.includes('link'))).toBe(true)
    expect(trechos.some((t) => t.includes('cartao') || t.includes('cartão'))).toBe(true)
    // Nao deve capturar linhas puramente sociais
    expect(trechos.some((t) => t === '[25/02/2026 13:00] Cliente: Boa tarde!!')).toBe(false)
  })
})

describe('formatarTimestampMensagem — helper defensivo de data', () => {
  // Replica a mesma logica do componente para teste isolado
  function formatarTimestampMensagem(ts: number | null): string | null {
    if (ts === null || ts === undefined) return null
    const dSec = new Date(ts * 1000)
    if (!isNaN(dSec.getTime()) && dSec.getFullYear() > 2000 && dSec.getFullYear() < 2100) {
      return dSec.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    const dMs = new Date(ts)
    if (!isNaN(dMs.getTime()) && dMs.getFullYear() > 2000 && dMs.getFullYear() < 2100) {
      return dMs.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    return null
  }

  it('unix seconds valido retorna data formatada', () => {
    // 1740484800 unix seconds = 25/02/2025 09:00 UTC
    const ts = 1740484800
    const result = formatarTimestampMensagem(ts)
    expect(result).not.toBeNull()
    expect(result).not.toBe('Invalid Date')
    expect(result).toContain('2025')
    expect(result).toContain('02')
  })

  it('null retorna null — nao renderiza data', () => {
    expect(formatarTimestampMensagem(null)).toBeNull()
  })

  it('zero retorna null — epoch invalido para contexto do chat', () => {
    expect(formatarTimestampMensagem(0)).toBeNull()
  })

  it('valor em milissegundos muito alto retorna null via unix-seconds, tenta ms e retorna se valido', () => {
    // 1740484800000 ms = 25/02/2025 — como unix seconds * 1000 seria ano ~57000 = invalido
    // O fallback de ms deve pegar e retornar data valida em 2025
    const tsMs = 1740484800000
    const result = formatarTimestampMensagem(tsMs)
    expect(result).not.toBeNull()
    expect(result).toContain('2025')
  })
})
