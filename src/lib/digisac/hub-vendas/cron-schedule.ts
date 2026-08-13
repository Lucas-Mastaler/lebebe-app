import { obterPartesDataLocal } from './tempo'

/**
 * Fonte central e única do agendamento real dos crons do Hub Vendas, para uso em
 * mensagens de observabilidade (ex.: "próxima execução agendada" no alerta de falha).
 *
 * O agendamento real NÃO vive neste repositório nem no Vercel (nenhuma rota do Hub
 * Vendas está em vercel.json) nem no banco (hub_vendas_config não tem chave de
 * schedule) — o código não tem, em tempo de execução, nenhuma forma de consultar o
 * agendamento real. Ele roda via crontab do usuário root na VPS
 * (72.60.252.7, /opt/hub-vendas-cron/executar-rota.sh), confirmado por acesso SSH
 * direto em 2026-08-13.
 *
 * IMPORTANTE: se o crontab da VPS for alterado, esta constante precisa ser
 * atualizada manualmente — não há sincronização automática possível hoje.
 *
 * Crontab confirmado em 2026-08-13 (usuário root, `crontab -l`):
 *   0-59/10  * * * *  hub-vendas-recuperar-filas
 *   1-59/15  * * * *  hub-vendas-preparar-fila
 *   3-59/5   * * * *  hub-vendas-processar-fila
 *   5        * * * *  hub-vendas-status        (não envia alerta de falha)
 *   10 18    * * 1-6  hub-vendas-resumo-diario  (não envia alerta de falha)
 */
export const HUB_VENDAS_CRON_SCHEDULES: Record<string, string> = {
  'preparar-fila': '1-59/15 * * * *',
  'processar-fila': '3-59/5 * * * *',
  'recuperar-filas': '0-59/10 * * * *',
}

/** Timezone confirmado do servidor onde o crontab roda (America/Sao_Paulo, sem DST desde 2019). */
export const HUB_VENDAS_CRON_TIMEZONE = 'America/Sao_Paulo'

function valoresPermitidosCampo(campo: string, min: number, max: number): Set<number> {
  const valores = new Set<number>()
  for (const parte of campo.split(',')) {
    const [intervalo, passoStr] = parte.split('/')
    const passo = passoStr ? Number(passoStr) : 1
    if (!Number.isInteger(passo) || passo <= 0) throw new Error('passo_invalido')

    let inicio = min
    let fim = max
    if (intervalo !== '*') {
      if (intervalo.includes('-')) {
        const [a, b] = intervalo.split('-').map(Number)
        if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('intervalo_invalido')
        inicio = a
        fim = b
      } else {
        const valor = Number(intervalo)
        if (!Number.isInteger(valor)) throw new Error('valor_invalido')
        inicio = fim = valor
      }
    }
    if (inicio < min || fim > max || inicio > fim) throw new Error('intervalo_fora_do_limite')

    for (let v = inicio; v <= fim; v += passo) valores.add(v)
  }
  return valores
}

/**
 * Calcula a próxima execução de uma expressão cron padrão de 5 campos
 * (minuto hora dia-do-mês mês dia-da-semana), estritamente posterior a `apartirDe`,
 * no timezone informado. Suporta `*`, valores únicos, listas (`1,2,3`) e
 * intervalos com passo (ex.: "1-59/15" ou asterisco com passo 5) — o suficiente para os crontabs reais do
 * Hub Vendas. Retorna null se a expressão for inválida ou se nenhuma execução for
 * encontrada dentro da janela de busca (8 dias).
 */
export function calcularProximaExecucaoCron(expressaoCron: string, apartirDe: Date, timezone: string): Date | null {
  const campos = expressaoCron.trim().split(/\s+/)
  if (campos.length !== 5) return null
  const [minutoCampo, horaCampo, diaMesCampo, mesCampo, diaSemanaCampo] = campos

  let minutos: Set<number>
  let horas: Set<number>
  let diasMes: Set<number>
  let meses: Set<number>
  let diasSemana: Set<number>
  try {
    minutos = valoresPermitidosCampo(minutoCampo, 0, 59)
    horas = valoresPermitidosCampo(horaCampo, 0, 23)
    diasMes = valoresPermitidosCampo(diaMesCampo, 1, 31)
    meses = valoresPermitidosCampo(mesCampo, 1, 12)
    diasSemana = valoresPermitidosCampo(diaSemanaCampo, 0, 6)
  } catch {
    return null
  }
  if ([minutos, horas, diasMes, meses, diasSemana].some((s) => s.size === 0)) return null

  // Semantica padrao de cron: quando dia-do-mes E dia-da-semana estao ambos restritos
  // (diferentes de '*'), o match e por OR, nao AND. Nenhum dos crons reais do Hub
  // Vendas usa essa combinacao hoje, mas a funcao fica correta para o caso geral.
  const diaMesRestrito = diaMesCampo !== '*'
  const diaSemanaRestrito = diaSemanaCampo !== '*'

  const LIMITE_MINUTOS_BUSCA = 60 * 24 * 8 // busca no maximo 8 dias a frente
  let candidatoMs = Math.floor(apartirDe.getTime() / 60000) * 60000 + 60000 // proximo minuto cheio, sempre > apartirDe

  for (let i = 0; i < LIMITE_MINUTOS_BUSCA; i += 1) {
    const candidato = new Date(candidatoMs)
    const p = obterPartesDataLocal(candidato, timezone)

    const diaOk = diaMesRestrito && diaSemanaRestrito
      ? diasMes.has(p.dia) || diasSemana.has(p.diaSemana)
      : diasMes.has(p.dia) && diasSemana.has(p.diaSemana)

    if (minutos.has(p.minuto) && horas.has(p.hora) && meses.has(p.mes) && diaOk) {
      return candidato
    }

    candidatoMs += 60000
  }

  return null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatarDataHoraLocal(data: Date, timezone: string): string {
  const p = obterPartesDataLocal(data, timezone)
  return `${pad2(p.dia)}/${pad2(p.mes)}/${p.ano} ${pad2(p.hora)}:${pad2(p.minuto)}`
}

const FALLBACK_INDETERMINADO = 'não foi possível determinar automaticamente'

/**
 * Texto pronto para a linha "Próxima execução agendada" das mensagens de falha de
 * cron do Hub Vendas. Usa o schedule real confirmado em HUB_VENDAS_CRON_SCHEDULES;
 * se a rota não tiver schedule conhecido ou o cálculo falhar, retorna o fallback
 * honesto em vez de inventar um horário.
 */
export function obterProximaExecucaoHubVendasTexto(rota: string, apartirDe: Date = new Date()): string {
  const expressao = HUB_VENDAS_CRON_SCHEDULES[rota]
  if (!expressao) return FALLBACK_INDETERMINADO

  const proxima = calcularProximaExecucaoCron(expressao, apartirDe, HUB_VENDAS_CRON_TIMEZONE)
  if (!proxima) return FALLBACK_INDETERMINADO

  return formatarDataHoraLocal(proxima, HUB_VENDAS_CRON_TIMEZONE)
}
