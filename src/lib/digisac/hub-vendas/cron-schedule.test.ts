import { describe, expect, it } from 'vitest'
import {
  HUB_VENDAS_CRON_SCHEDULES,
  HUB_VENDAS_CRON_TIMEZONE,
  calcularProximaExecucaoCron,
  obterProximaExecucaoHubVendasTexto,
} from './cron-schedule'

describe('calcularProximaExecucaoCron', () => {
  it('acha a proxima execucao ainda no mesmo dia (falha antes do proximo horario)', () => {
    // '0 20,21,22 * * *' -> roda as 20h, 21h e 22h. Falha as 21:01 -> proxima e 22:00.
    const falhaEm = new Date('2026-08-13T21:01:00-03:00')
    const proxima = calcularProximaExecucaoCron('0 20,21,22 * * *', falhaEm, 'America/Sao_Paulo')

    expect(proxima?.toISOString()).toBe(new Date('2026-08-13T22:00:00-03:00').toISOString())
  })

  it('nunca retorna a execucao que acabou de falhar, mesmo se a falha ocorrer exatamente no minuto agendado', () => {
    const falhaExatamenteNoHorario = new Date('2026-08-13T21:00:00-03:00')
    const proxima = calcularProximaExecucaoCron('0 20,21,22 * * *', falhaExatamenteNoHorario, 'America/Sao_Paulo')

    expect(proxima?.toISOString()).toBe(new Date('2026-08-13T22:00:00-03:00').toISOString())
  })

  it('atravessa a virada do dia corretamente', () => {
    // Roda so as 00:00 e 23:50. Falha as 23:55 -> proxima e 00:00 do dia seguinte.
    const falhaEm = new Date('2026-08-13T23:55:00-03:00')
    const proxima = calcularProximaExecucaoCron('0,50 0,23 * * *', falhaEm, 'America/Sao_Paulo')

    expect(proxima?.toISOString()).toBe(new Date('2026-08-14T00:00:00-03:00').toISOString())
  })

  it('atravessa virada de mes e ano quando necessario', () => {
    // Roda 1x/dia as 10h. Falha as 10:05 do ultimo dia do ano -> proxima e 01/01 as 10h.
    const falhaEm = new Date('2026-12-31T10:05:00-03:00')
    const proxima = calcularProximaExecucaoCron('0 10 * * *', falhaEm, 'America/Sao_Paulo')

    expect(proxima?.toISOString()).toBe(new Date('2027-01-01T10:00:00-03:00').toISOString())
  })

  it('respeita o timezone America/Sao_Paulo (offset fixo -03:00)', () => {
    const falhaEm = new Date('2026-08-13T21:01:00-03:00')
    const proxima = calcularProximaExecucaoCron('0 22 * * *', falhaEm, 'America/Sao_Paulo')

    expect(proxima).not.toBeNull()
    // 22:00 America/Sao_Paulo = 01:00 UTC do dia seguinte
    expect(proxima!.toISOString()).toBe('2026-08-14T01:00:00.000Z')
  })

  it('calcula corretamente para schedules com frequencias diferentes entre si', () => {
    const falhaEm = new Date('2026-08-13T12:04:00-03:00')

    // preparar-fila: 1-59/15 -> minutos 1,16,31,46
    const proximaPreparar = calcularProximaExecucaoCron(
      HUB_VENDAS_CRON_SCHEDULES['preparar-fila'],
      falhaEm,
      HUB_VENDAS_CRON_TIMEZONE
    )
    expect(proximaPreparar?.toISOString()).toBe(new Date('2026-08-13T12:16:00-03:00').toISOString())

    // processar-fila: 3-59/5 -> minutos 3,8,13,...
    const proximaProcessar = calcularProximaExecucaoCron(
      HUB_VENDAS_CRON_SCHEDULES['processar-fila'],
      falhaEm,
      HUB_VENDAS_CRON_TIMEZONE
    )
    expect(proximaProcessar?.toISOString()).toBe(new Date('2026-08-13T12:08:00-03:00').toISOString())

    // recuperar-filas: 0-59/10 -> minutos 0,10,20,...
    const proximaRecuperar = calcularProximaExecucaoCron(
      HUB_VENDAS_CRON_SCHEDULES['recuperar-filas'],
      falhaEm,
      HUB_VENDAS_CRON_TIMEZONE
    )
    expect(proximaRecuperar?.toISOString()).toBe(new Date('2026-08-13T12:10:00-03:00').toISOString())

    // As tres rotas tem schedules diferentes -> proximas execucoes diferentes entre si
    expect(proximaPreparar?.getTime()).not.toBe(proximaProcessar?.getTime())
    expect(proximaProcessar?.getTime()).not.toBe(proximaRecuperar?.getTime())
  })

  it('retorna null para expressao cron invalida', () => {
    expect(calcularProximaExecucaoCron('invalida', new Date(), 'America/Sao_Paulo')).toBeNull()
    expect(calcularProximaExecucaoCron('* * *', new Date(), 'America/Sao_Paulo')).toBeNull()
  })
})

describe('obterProximaExecucaoHubVendasTexto', () => {
  it('formata DD/MM/AAAA HH:mm para rota com schedule conhecido', () => {
    const falhaEm = new Date('2026-08-13T21:01:00-03:00')
    const texto = obterProximaExecucaoHubVendasTexto('preparar-fila', falhaEm)

    expect(texto).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
    expect(texto).toBe('13/08/2026 21:16')
  })

  it('usa fallback seguro quando a rota nao tem schedule conhecido (nao inventa horario)', () => {
    const texto = obterProximaExecucaoHubVendasTexto('rota-inexistente', new Date())
    expect(texto).toBe('não foi possível determinar automaticamente')
  })
})
