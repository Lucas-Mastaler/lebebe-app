export interface ResultadoChamadoIA {
  resumo_chamado: string
  influencia_compra: 'Sim' | 'Parcialmente' | 'Não' | 'Indefinido'
  grau_influencia: 'Alto' | 'Médio' | 'Baixo' | 'Nenhum'
  motivo_influencia: string
  produtos_mencionados: string[]
  objecoes_identificadas: string[]
  intencao_cliente: 'Alta' | 'Média' | 'Baixa' | 'Indefinida'
  sentimento_cliente: 'Positivo' | 'Neutro' | 'Negativo' | 'Indefinido'
  pontos_de_atencao: string[]
  confianca_analise: 'Alta' | 'Média' | 'Baixa'
  nome_bebe: string | null
  previsao_nascimento_bebe: string | null
  modelo_ia: string
}

export type TipoFechamento =
  | 'Presencial — visitou a loja e comprou na loja'
  | 'Digital — não visitou a loja e comprou online'
  | 'Misto — visitou a loja e comprou depois online'
  | 'Misto — conversou online e comprou depois presencialmente'
  | 'Indefinido — não há evidência suficiente'

export type ConfiancaTipoFechamento = 'Alta' | 'Média' | 'Baixa'

export type ConfiancaNegociacao = 'Alta' | 'Média' | 'Baixa'

export interface NegociacaoPrazo {
  tipo: 'prazo'
  resumo: string
  data_prometida: string | null
  evidencia: string
  chamado_numero: number | null
  protocolo: string | null
  confianca: ConfiancaNegociacao
}

export interface NegociacaoFrete {
  tipo: 'frete'
  valor_original: string | null
  valor_negociado: string | null
  resumo: string
  evidencia: string
  chamado_numero: number | null
  protocolo: string | null
  confianca: ConfiancaNegociacao
}

export interface NegociacaoDesconto {
  tipo: 'desconto'
  valor_original: string | null
  valor_final: string | null
  percentual: string | null
  resumo: string
  evidencia: string
  chamado_numero: number | null
  protocolo: string | null
  confianca: ConfiancaNegociacao
}

export interface NegociacaoPagamento {
  tipo: 'pagamento'
  forma: string | null
  houve_link_pagamento: boolean
  link_usado_confirmado: boolean
  resumo: string
  evidencia: string
  chamado_numero: number | null
  protocolo: string | null
  confianca: ConfiancaNegociacao
}

export interface ValorCitado {
  valor: string
  contexto: string
  tipo_valor: 'produto' | 'frete' | 'desconto' | 'pagamento' | 'outro'
  chamado_numero: number | null
  protocolo: string | null
  confianca: ConfiancaNegociacao
}

export interface ResultadoConsolidadoIA {
  resumo_geral: string
  chamados_que_influenciaram: { ticket_id: string; protocolo: string | null; resumo: string }[]
  chamados_sem_influencia: { ticket_id: string; protocolo: string | null; resumo: string }[]
  principais_motivos_compra: string[]
  principais_objecoes: string[]
  produtos_de_interesse: string[]
  oportunidades_melhoria: string[]
  conclusao_comercial: string
  nome_bebe: string | null
  previsao_nascimento_bebe: string | null
  produtos_fechados: string[]
  produtos_interesse_nao_fechados: string[]
  tipo_fechamento: TipoFechamento
  confianca_tipo_fechamento: ConfiancaTipoFechamento
  evidencias_tipo_fechamento: string[]
  negociacoes_prazo: NegociacaoPrazo[]
  negociacoes_frete: NegociacaoFrete[]
  negociacoes_desconto: NegociacaoDesconto[]
  negociacoes_pagamento: NegociacaoPagamento[]
  valores_citados: ValorCitado[]
  modelo_ia: string
}

const VALID_INFLUENCIA = ['Sim', 'Parcialmente', 'Não', 'Indefinido'] as const
const VALID_GRAU = ['Alto', 'Médio', 'Baixo', 'Nenhum'] as const
const VALID_INTENCAO = ['Alta', 'Média', 'Baixa', 'Indefinida'] as const
const VALID_SENTIMENTO = ['Positivo', 'Neutro', 'Negativo', 'Indefinido'] as const
const VALID_CONFIANCA = ['Alta', 'Média', 'Baixa'] as const

function validarResultadoChamado(raw: unknown): Omit<ResultadoChamadoIA, 'modelo_ia'> {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta da IA não é um objeto JSON')

  const obj = raw as Record<string, unknown>

  const assertString = (key: string): string => {
    if (typeof obj[key] !== 'string') throw new Error(`Campo "${key}" ausente ou inválido`)
    return obj[key] as string
  }
  const assertStringArray = (key: string): string[] => {
    if (!Array.isArray(obj[key])) throw new Error(`Campo "${key}" deve ser array`)
    return (obj[key] as unknown[]).map((v) => String(v))
  }
  const assertEnum = <T extends string>(key: string, valid: readonly T[]): T => {
    const val = assertString(key)
    if (!valid.includes(val as T)) throw new Error(`Campo "${key}" valor inválido: "${val}"`)
    return val as T
  }

  const optionalString = (key: string): string | null => {
    const v = obj[key]
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'string') return v
    return null
  }

  return {
    resumo_chamado: assertString('resumo_chamado'),
    influencia_compra: assertEnum('influencia_compra', VALID_INFLUENCIA),
    grau_influencia: assertEnum('grau_influencia', VALID_GRAU),
    motivo_influencia: assertString('motivo_influencia'),
    produtos_mencionados: assertStringArray('produtos_mencionados'),
    objecoes_identificadas: assertStringArray('objecoes_identificadas'),
    intencao_cliente: assertEnum('intencao_cliente', VALID_INTENCAO),
    sentimento_cliente: assertEnum('sentimento_cliente', VALID_SENTIMENTO),
    pontos_de_atencao: assertStringArray('pontos_de_atencao'),
    confianca_analise: assertEnum('confianca_analise', VALID_CONFIANCA),
    nome_bebe: optionalString('nome_bebe'),
    previsao_nascimento_bebe: optionalString('previsao_nascimento_bebe'),
  }
}

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  useJsonFormat = true
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurado')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
  }
  if (useJsonFormat) {
    body.response_format = { type: 'json_object' }
  }

  let attempt = 0
  while (attempt < 2) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        // Se 400 e estava usando response_format, retentar sem ele
        if (res.status === 400 && useJsonFormat) {
          console.warn('[deepseek] response_format rejeitado (400), retentando sem ele')
          return callDeepSeek(systemPrompt, userPrompt, model, false)
        }
        throw new Error(`DeepSeek API erro ${res.status}: ${errBody.slice(0, 200)}`)
      }

      const data = await res.json()
      const choice = data?.choices?.[0]
      const content = choice?.message?.content
      const finishReason = choice?.finish_reason

      if (typeof content !== 'string' || content.trim() === '') {
        console.error('[deepseek] resposta inválida', {
          model,
          finish_reason: finishReason,
          contentLength: content?.length ?? 0,
          contentPreview: String(content ?? '').slice(0, 500),
          hasChoices: Array.isArray(data?.choices),
          choicesLength: data?.choices?.length ?? 0,
          total_tokens: data?.usage?.total_tokens ?? '?',
        })
        throw new Error(
          `DeepSeek retornou conteúdo vazio (finish_reason=${finishReason ?? 'desconhecido'}, tokens=${data?.usage?.total_tokens ?? '?'})`
        )
      }

      console.log(`[deepseek] modelo=${model} tokens=${data?.usage?.total_tokens ?? '?'} finish=${finishReason}`)
      return content
    } catch (err: unknown) {
      attempt++
      if (attempt >= 2) throw err
      const isNetwork = err instanceof Error && (
        err.name === 'AbortError' ||
        err.message.includes('fetch') ||
        err.message.includes('network')
      )
      if (!isNetwork) throw err
      console.warn(`[deepseek] retry após erro de rede: ${(err as Error).message}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  throw new Error('DeepSeek: falha após retry')
}

function extrairJSON(raw: string): unknown {
  const trimmed = raw.trim()
  // Tenta parse direto
  try {
    return JSON.parse(trimmed)
  } catch { /* continua */ }
  // Tenta extrair de bloco markdown ```json ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try {
      return JSON.parse(match[1].trim())
    } catch { /* continua */ }
  }
  // Tenta extrair o primeiro objeto JSON da string
  const objMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch { /* continua */ }
  }
  console.error('[deepseek] falha ao extrair JSON', {
    rawLength: raw.length,
    rawPreview: raw.slice(0, 500),
  })
  throw new Error(`DeepSeek retornou texto não-JSON (${raw.length} chars): ${raw.slice(0, 200)}`)
}

export async function analisarChamadoIA(userPrompt: string): Promise<ResultadoChamadoIA> {
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

  const systemPrompt = `Você é um analista comercial especializado em vendas de puericultura.
Analise a conversa de WhatsApp fornecida e retorne SOMENTE um JSON válido, sem markdown, sem texto antes ou depois.
Não invente informações que não estejam presentes na conversa.
Seja conservador: só classifique como influente se houver evidência real de relação com produto comprado, orçamento, preço, prazo, visita à loja, decisão de compra, atendimento, negociação ou fechamento.
Se não houver evidência clara, use "Não" ou "Indefinido".
Sempre justifique a classificação em motivo_influencia.
Diferencie influência real de conversa operacional sem impacto na compra.`

  const raw = await callDeepSeek(systemPrompt, userPrompt, model)

  let parsed: unknown
  try {
    parsed = extrairJSON(raw)
  } catch (firstErr) {
    // Retry com prompt de correção
    console.warn('[deepseek] JSON inválido na 1ª tentativa, retentando com prompt de correção')
    const correcaoPrompt = `Sua resposta anterior não foi um JSON válido. Retorne SOMENTE o JSON no schema solicitado, sem markdown e sem texto adicional.\n\nSchema esperado:\n${userPrompt.slice(userPrompt.lastIndexOf('Retorne exatamente este JSON'))}`
    try {
      const raw2 = await callDeepSeek(systemPrompt, correcaoPrompt, model)
      parsed = extrairJSON(raw2)
    } catch (secondErr) {
      console.error('[deepseek] JSON inválido após retry de correção', { firstErr: String(firstErr), secondErr: String(secondErr) })
      throw firstErr
    }
  }

  const validado = validarResultadoChamado(parsed)

  console.log(`[deepseek] análise chamado ok — modelo=${model} influencia=${validado.influencia_compra}`)

  return { ...validado, modelo_ia: model }
}

export async function analisarConsolidadoIA(userPrompt: string): Promise<ResultadoConsolidadoIA> {
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

  const systemPrompt = `Você é um analista comercial especializado em vendas de puericultura.
Analise os resultados individuais de chamados Digisac de uma venda e gere um resumo consolidado.
Retorne SOMENTE um JSON válido, sem markdown, sem texto antes ou depois.
Baseie-se apenas nos dados fornecidos, não invente informações.`

  const raw = await callDeepSeek(systemPrompt, userPrompt, model)
  const parsed = extrairJSON(raw)

  if (!parsed || typeof parsed !== 'object') throw new Error('Consolidado: resposta inválida da IA')
  const obj = parsed as Record<string, unknown>

  const toStringArray = (key: string): string[] => {
    if (!Array.isArray(obj[key])) return []
    return (obj[key] as unknown[]).map((v) => String(v))
  }
  const toObjArray = (key: string): { ticket_id: string; protocolo: string | null; resumo: string }[] => {
    if (!Array.isArray(obj[key])) return []
    return (obj[key] as unknown[]).map((v) => {
      const item = v as Record<string, unknown>
      return {
        ticket_id: String(item.ticket_id ?? ''),
        protocolo: item.protocolo != null ? String(item.protocolo) : null,
        resumo: String(item.resumo ?? ''),
      }
    })
  }

  console.log(`[deepseek] análise consolidada ok — modelo=${model}`)

  const toOptionalString = (key: string): string | null => {
    const v = obj[key]
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'string') return v
    return null
  }

  const VALID_TIPO_FECHAMENTO: TipoFechamento[] = [
    'Presencial — visitou a loja e comprou na loja',
    'Digital — não visitou a loja e comprou online',
    'Misto — visitou a loja e comprou depois online',
    'Misto — conversou online e comprou depois presencialmente',
    'Indefinido — não há evidência suficiente',
  ]
  const VALID_CONFIANCA_FECHAMENTO: ConfiancaTipoFechamento[] = ['Alta', 'Média', 'Baixa']

  const parseTipoFechamento = (raw: unknown): TipoFechamento => {
    if (typeof raw === 'string' && VALID_TIPO_FECHAMENTO.includes(raw as TipoFechamento)) {
      return raw as TipoFechamento
    }
    return 'Indefinido — não há evidência suficiente'
  }

  const parseConfiancaFechamento = (raw: unknown): ConfiancaTipoFechamento => {
    if (typeof raw === 'string' && VALID_CONFIANCA_FECHAMENTO.includes(raw as ConfiancaTipoFechamento)) {
      return raw as ConfiancaTipoFechamento
    }
    return 'Baixa'
  }

  const VALID_CONFIANCA_NEG: ConfiancaNegociacao[] = ['Alta', 'Média', 'Baixa']
  const VALID_TIPO_VALOR = ['produto', 'frete', 'desconto', 'pagamento', 'outro'] as const

  const toConfiancaNeg = (v: unknown): ConfiancaNegociacao =>
    typeof v === 'string' && VALID_CONFIANCA_NEG.includes(v as ConfiancaNegociacao)
      ? (v as ConfiancaNegociacao)
      : 'Baixa'

  const toNullableString = (v: unknown): string | null =>
    v != null && v !== '' && typeof v === 'string' ? v : null

  const toNullableNumber = (v: unknown): number | null =>
    typeof v === 'number' ? v : v != null && !isNaN(Number(v)) ? Number(v) : null

  const toBoolean = (v: unknown): boolean => v === true || v === 'true'

  const parseNegociacoesPrazo = (): NegociacaoPrazo[] => {
    if (!Array.isArray(obj.negociacoes_prazo)) return []
    return (obj.negociacoes_prazo as unknown[]).map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>
      return {
        tipo: 'prazo' as const,
        resumo: String(it.resumo ?? ''),
        data_prometida: toNullableString(it.data_prometida),
        evidencia: String(it.evidencia ?? ''),
        chamado_numero: toNullableNumber(it.chamado_numero),
        protocolo: toNullableString(it.protocolo),
        confianca: toConfiancaNeg(it.confianca),
      }
    })
  }

  const parseNegociacoesFrete = (): NegociacaoFrete[] => {
    if (!Array.isArray(obj.negociacoes_frete)) return []
    return (obj.negociacoes_frete as unknown[]).map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>
      return {
        tipo: 'frete' as const,
        valor_original: toNullableString(it.valor_original),
        valor_negociado: toNullableString(it.valor_negociado),
        resumo: String(it.resumo ?? ''),
        evidencia: String(it.evidencia ?? ''),
        chamado_numero: toNullableNumber(it.chamado_numero),
        protocolo: toNullableString(it.protocolo),
        confianca: toConfiancaNeg(it.confianca),
      }
    })
  }

  const parseNegociacoesDesconto = (): NegociacaoDesconto[] => {
    if (!Array.isArray(obj.negociacoes_desconto)) return []
    return (obj.negociacoes_desconto as unknown[]).map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>
      return {
        tipo: 'desconto' as const,
        valor_original: toNullableString(it.valor_original),
        valor_final: toNullableString(it.valor_final),
        percentual: toNullableString(it.percentual),
        resumo: String(it.resumo ?? ''),
        evidencia: String(it.evidencia ?? ''),
        chamado_numero: toNullableNumber(it.chamado_numero),
        protocolo: toNullableString(it.protocolo),
        confianca: toConfiancaNeg(it.confianca),
      }
    })
  }

  const parseNegociacoesPagamento = (): NegociacaoPagamento[] => {
    if (!Array.isArray(obj.negociacoes_pagamento)) return []
    return (obj.negociacoes_pagamento as unknown[]).map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>
      return {
        tipo: 'pagamento' as const,
        forma: toNullableString(it.forma),
        houve_link_pagamento: toBoolean(it.houve_link_pagamento),
        link_usado_confirmado: toBoolean(it.link_usado_confirmado),
        resumo: String(it.resumo ?? ''),
        evidencia: String(it.evidencia ?? ''),
        chamado_numero: toNullableNumber(it.chamado_numero),
        protocolo: toNullableString(it.protocolo),
        confianca: toConfiancaNeg(it.confianca),
      }
    })
  }

  const parseValoresCitados = (): ValorCitado[] => {
    if (!Array.isArray(obj.valores_citados)) return []
    return (obj.valores_citados as unknown[]).map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>
      const tipoValor = typeof it.tipo_valor === 'string' && VALID_TIPO_VALOR.includes(it.tipo_valor as ValorCitado['tipo_valor'])
        ? (it.tipo_valor as ValorCitado['tipo_valor'])
        : 'outro'
      return {
        valor: String(it.valor ?? ''),
        contexto: String(it.contexto ?? ''),
        tipo_valor: tipoValor,
        chamado_numero: toNullableNumber(it.chamado_numero),
        protocolo: toNullableString(it.protocolo),
        confianca: toConfiancaNeg(it.confianca),
      }
    })
  }

  return {
    resumo_geral: String(obj.resumo_geral ?? ''),
    chamados_que_influenciaram: toObjArray('chamados_que_influenciaram'),
    chamados_sem_influencia: toObjArray('chamados_sem_influencia'),
    principais_motivos_compra: toStringArray('principais_motivos_compra'),
    principais_objecoes: toStringArray('principais_objecoes'),
    produtos_de_interesse: toStringArray('produtos_de_interesse'),
    oportunidades_melhoria: toStringArray('oportunidades_melhoria'),
    conclusao_comercial: String(obj.conclusao_comercial ?? ''),
    nome_bebe: toOptionalString('nome_bebe'),
    previsao_nascimento_bebe: toOptionalString('previsao_nascimento_bebe'),
    produtos_fechados: toStringArray('produtos_fechados'),
    produtos_interesse_nao_fechados: toStringArray('produtos_interesse_nao_fechados'),
    tipo_fechamento: parseTipoFechamento(obj.tipo_fechamento),
    confianca_tipo_fechamento: parseConfiancaFechamento(obj.confianca_tipo_fechamento),
    evidencias_tipo_fechamento: toStringArray('evidencias_tipo_fechamento'),
    negociacoes_prazo: parseNegociacoesPrazo(),
    negociacoes_frete: parseNegociacoesFrete(),
    negociacoes_desconto: parseNegociacoesDesconto(),
    negociacoes_pagamento: parseNegociacoesPagamento(),
    valores_citados: parseValoresCitados(),
    modelo_ia: model,
  }
}
