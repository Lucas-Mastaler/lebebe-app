export type HubVendasHorarioOperacional = {
  timezone: string
  diasSemana: number[]
  inicio: string
  fim: string
}

type PartesDataLocal = {
  ano: number
  mes: number
  dia: number
  hora: number
  minuto: number
  segundo: number
  diaSemana: number
}

const DIA_MS = 24 * 60 * 60 * 1000

function parseHorario(horario: string): { hora: number; minuto: number } {
  const [horaRaw, minutoRaw] = horario.split(':')
  const hora = Number(horaRaw)
  const minuto = Number(minutoRaw)
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) {
    throw new Error('hub_vendas_horario_invalido')
  }
  return { hora, minuto }
}

export function obterPartesDataLocal(data: Date, timezone: string): PartesDataLocal {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const partes = Object.fromEntries(formatter.formatToParts(data).map((parte) => [parte.type, parte.value]))
  const weekday = String(partes.weekday)
  const mapaSemana: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
    diaSemana: mapaSemana[weekday] ?? 0,
  }
}

export function dataLocalParaUtc(partes: Omit<PartesDataLocal, 'diaSemana'>, timezone: string): Date {
  const alvoComoUtc = Date.UTC(partes.ano, partes.mes - 1, partes.dia, partes.hora, partes.minuto, partes.segundo)
  let chuteUtc = alvoComoUtc

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const partesDoChute = obterPartesDataLocal(new Date(chuteUtc), timezone)
    const chuteComoUtc = Date.UTC(
      partesDoChute.ano,
      partesDoChute.mes - 1,
      partesDoChute.dia,
      partesDoChute.hora,
      partesDoChute.minuto,
      partesDoChute.segundo
    )
    const delta = alvoComoUtc - chuteComoUtc
    if (delta === 0) break
    chuteUtc += delta
  }

  return new Date(chuteUtc)
}

function inicioLocalDoDia(data: Date, timezone: string): Omit<PartesDataLocal, 'diaSemana'> {
  const partes = obterPartesDataLocal(data, timezone)
  return {
    ano: partes.ano,
    mes: partes.mes,
    dia: partes.dia,
    hora: 0,
    minuto: 0,
    segundo: 0,
  }
}

function somarDiasLocais(partes: Omit<PartesDataLocal, 'diaSemana'>, dias: number) {
  const base = Date.UTC(partes.ano, partes.mes - 1, partes.dia + dias, partes.hora, partes.minuto, partes.segundo)
  const data = new Date(base)
  return {
    ano: data.getUTCFullYear(),
    mes: data.getUTCMonth() + 1,
    dia: data.getUTCDate(),
    hora: data.getUTCHours(),
    minuto: data.getUTCMinutes(),
    segundo: data.getUTCSeconds(),
  }
}

export function obterIntervaloDiaLocalUtc(data: Date, timezone: string): { inicioUtc: Date; fimUtc: Date } {
  const inicioLocal = inicioLocalDoDia(data, timezone)
  const inicioUtc = dataLocalParaUtc(inicioLocal, timezone)
  const fimUtc = dataLocalParaUtc(somarDiasLocais(inicioLocal, 1), timezone)
  return { inicioUtc, fimUtc }
}

export function ajustarParaHorarioOperacional(data: Date, horario: HubVendasHorarioOperacional): Date {
  const inicio = parseHorario(horario.inicio)
  const fim = parseHorario(horario.fim)
  let cursor = new Date(data)

  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const partes = obterPartesDataLocal(cursor, horario.timezone)
    const minutoDoDia = partes.hora * 60 + partes.minuto
    const inicioMinuto = inicio.hora * 60 + inicio.minuto
    const fimMinuto = fim.hora * 60 + fim.minuto
    const diaPermitido = horario.diasSemana.includes(partes.diaSemana)

    if (diaPermitido && minutoDoDia >= inicioMinuto && minutoDoDia < fimMinuto) {
      return cursor
    }

    const baseLocal = {
      ano: partes.ano,
      mes: partes.mes,
      dia: partes.dia,
      hora: inicio.hora,
      minuto: inicio.minuto,
      segundo: 0,
    }

    if (diaPermitido && minutoDoDia < inicioMinuto) {
      return dataLocalParaUtc(baseLocal, horario.timezone)
    }

    const proximoDiaLocal = somarDiasLocais(baseLocal, 1)
    cursor = new Date(dataLocalParaUtc(proximoDiaLocal, horario.timezone).getTime() + tentativa)
  }

  throw new Error('hub_vendas_sem_horario_operacional')
}

export function somarSegundosAjustandoHorario(
  base: Date,
  segundos: number,
  horario: HubVendasHorarioOperacional
): Date {
  return ajustarParaHorarioOperacional(new Date(base.getTime() + segundos * 1000), horario)
}

export function agoraMaisDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS)
}
