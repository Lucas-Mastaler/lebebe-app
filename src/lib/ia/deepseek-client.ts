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
  modelo_ia: string
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
  }
}

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurado')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

  let attempt = 0
  while (attempt < 2) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`DeepSeek API erro ${res.status}: ${body.slice(0, 200)}`)
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string') throw new Error('DeepSeek retornou resposta sem conteúdo')

      console.log(`[deepseek] modelo=${model} tokens=${data?.usage?.total_tokens ?? '?'}`)
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
  // Remove possível markdown ```json ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = match ? match[1].trim() : trimmed
  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error(`DeepSeek retornou texto não-JSON: ${jsonStr.slice(0, 300)}`)
  }
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
  const parsed = extrairJSON(raw)
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

  return {
    resumo_geral: String(obj.resumo_geral ?? ''),
    chamados_que_influenciaram: toObjArray('chamados_que_influenciaram'),
    chamados_sem_influencia: toObjArray('chamados_sem_influencia'),
    principais_motivos_compra: toStringArray('principais_motivos_compra'),
    principais_objecoes: toStringArray('principais_objecoes'),
    produtos_de_interesse: toStringArray('produtos_de_interesse'),
    oportunidades_melhoria: toStringArray('oportunidades_melhoria'),
    conclusao_comercial: String(obj.conclusao_comercial ?? ''),
    modelo_ia: model,
  }
}
