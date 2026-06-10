// ─────────────────────────────────────────────────────────────────────────────
// validar-config.ts
//
// Validação e normalização de valores para edição de configurações (Fase 3).
//
// REGRAS GERAIS:
//   - Toda validação é feita no backend antes de qualquer escrita
//   - O valor retornado (valorNormalizado) é o que será salvo no banco
//   - Formato no banco = mesmo formato que veio da planilha (sem R$, sem km, etc.)
//   - distance_m: UI recebe/envia em km → backend converte para metros antes de salvar
//   - Auditoria registra valor no formato do banco (não formatado para tela)
//   - Secrets nunca passam por esta função
// ─────────────────────────────────────────────────────────────────────────────

export type ValidarOk = { ok: true; valorNormalizado: string }
export type ValidarErro = { ok: false; erro: string }
export type ValidarResult = ValidarOk | ValidarErro

// Chave especial com validação de formato HH:MM (valor_tipo é 'text' no banco)
const CHAVE_TEMPO_SABADO = 'TEMPO MAXIMO DE VIAGEM SÁBADO'

// ─── Validadores por tipo ─────────────────────────────────────────────────────

function validarNumber(raw: string): ValidarResult {
  const limpo = raw.trim()
  if (!/^\d+$/.test(limpo)) {
    return { ok: false, erro: 'Deve ser um número inteiro positivo (ex: 30).' }
  }
  const n = parseInt(limpo, 10)
  if (n < 0) return { ok: false, erro: 'Valor não pode ser negativo.' }
  return { ok: true, valorNormalizado: String(n) }
}

function validarDecimal(raw: string): ValidarResult {
  // Aceita ponto ou vírgula como separador decimal
  const limpo = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpo)) {
    return { ok: false, erro: 'Deve ser um número decimal (ex: 1.15 ou 1,15).' }
  }
  const n = parseFloat(limpo)
  if (n < 0) return { ok: false, erro: 'Valor não pode ser negativo.' }
  return { ok: true, valorNormalizado: String(n) }
}

function validarCurrency(raw: string): ValidarResult {
  // Remove R$, espaços, pontos de milhar; troca vírgula decimal por ponto
  const limpo = raw
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')      // remove separadores de milhar
    .replace(',', '.')        // vírgula decimal → ponto
    .trim()
  if (!/^\d+(\.\d+)?$/.test(limpo)) {
    return { ok: false, erro: 'Deve ser um valor monetário (ex: 400 ou 1200,50 ou R$ 400).' }
  }
  const n = parseFloat(limpo)
  if (n < 0) return { ok: false, erro: 'Valor monetário não pode ser negativo.' }
  // Salvar sem casas desnecessárias (ex: 400.0 → "400", 8.5 → "8.5")
  const normalizado = Number.isInteger(n) ? String(n) : String(n)
  return { ok: true, valorNormalizado: normalizado }
}

function validarDistanceKm(raw: string): ValidarResult {
  // Entrada em km, salva em km (string numérica)
  const limpo = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpo)) {
    return { ok: false, erro: 'Deve ser um número em km (ex: 25 ou 25.5).' }
  }
  const n = parseFloat(limpo)
  if (n <= 0) return { ok: false, erro: 'Distância deve ser maior que zero.' }
  return { ok: true, valorNormalizado: String(n) }
}

function validarDistanceM(raw: string): ValidarResult {
  // Entrada em km (UI), salva em metros (banco)
  // Ex: usuário digita "5" → banco recebe "5000"
  const limpo = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpo)) {
    return { ok: false, erro: 'Deve ser um número em km (ex: 5 ou 2.5).' }
  }
  const km = parseFloat(limpo)
  if (km <= 0) return { ok: false, erro: 'Distância deve ser maior que zero.' }
  const metros = Math.round(km * 1000)
  return { ok: true, valorNormalizado: String(metros) }
}

function validarBoolean(raw: string): ValidarResult {
  const upper = raw.trim().toUpperCase()
  // Aceita SIM/NÃO, SIM/NAO, YES/NO, TRUE/FALSE, 1/0
  const sim = ['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'ATIVO', 'ATIVA']
  const nao = ['NÃO', 'NAO', 'N', 'NO', 'FALSE', '0', 'INATIVO', 'INATIVA']
  if (sim.includes(upper)) return { ok: true, valorNormalizado: 'SIM' }
  if (nao.includes(upper)) return { ok: true, valorNormalizado: 'NÃO' }
  return { ok: false, erro: 'Deve ser SIM ou NÃO.' }
}

function validarAddress(raw: string): ValidarResult {
  const limpo = raw.trim()
  if (limpo.length < 5) {
    return { ok: false, erro: 'Endereço muito curto (mínimo 5 caracteres).' }
  }
  if (limpo.length > 300) {
    return { ok: false, erro: 'Endereço muito longo (máximo 300 caracteres).' }
  }
  return { ok: true, valorNormalizado: limpo }
}

function validarText(raw: string): ValidarResult {
  const limpo = raw.trim()
  if (limpo.length === 0) {
    return { ok: false, erro: 'Valor não pode ser vazio.' }
  }
  if (limpo.length > 500) {
    return { ok: false, erro: 'Valor muito longo (máximo 500 caracteres).' }
  }
  return { ok: true, valorNormalizado: limpo }
}

function validarTempoHHMM(raw: string): ValidarResult {
  // Formato esperado: HH:MM (ex: 01:00, 02:30)
  const limpo = raw.trim()
  if (!/^\d{2}:\d{2}$/.test(limpo)) {
    return { ok: false, erro: 'Deve estar no formato HH:MM (ex: 01:00, 02:30).' }
  }
  const [hh, mm] = limpo.split(':').map(Number)
  if (hh < 0 || hh > 23) return { ok: false, erro: 'Horas deve ser entre 00 e 23.' }
  if (mm < 0 || mm > 59) return { ok: false, erro: 'Minutos deve ser entre 00 e 59.' }
  return { ok: true, valorNormalizado: limpo }
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Valida e normaliza o valor de entrada para uma configuração.
 *
 * @param chaveUpper  Chave em UPPERCASE (conforme banco)
 * @param valorTipo   Tipo da configuração (conforme coluna valor_tipo no banco)
 * @param valorRaw    Valor bruto enviado pelo usuário
 * @returns ValidarOk com valorNormalizado (pronto para salvar no banco)
 *          ou ValidarErro com mensagem descritiva
 */
export function validarValorConfig(
  chaveUpper: string,
  valorTipo: string,
  valorRaw: string
): ValidarResult {
  // Override por chave específica: TEMPO MAXIMO DE VIAGEM SÁBADO → HH:MM
  if (chaveUpper === CHAVE_TEMPO_SABADO) {
    return validarTempoHHMM(valorRaw)
  }

  switch (valorTipo) {
    case 'number':
      return validarNumber(valorRaw)
    case 'decimal':
      return validarDecimal(valorRaw)
    case 'currency':
      return validarCurrency(valorRaw)
    case 'distance_km':
      return validarDistanceKm(valorRaw)
    case 'distance_m':
      // Entrada do usuário em km → backend salva em metros
      return validarDistanceM(valorRaw)
    case 'boolean':
      return validarBoolean(valorRaw)
    case 'address':
      return validarAddress(valorRaw)
    case 'text':
      return validarText(valorRaw)
    default:
      return { ok: false, erro: `Tipo desconhecido: ${valorTipo}. Contate o suporte.` }
  }
}
