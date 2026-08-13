export type FilaSemProtocolo = {
  id: string
  digisac_ticket_id: string
}

export type FalhaBackfillProtocolo = {
  filaId: string
  ticketId: string
  motivo: string
}

function normalizarProtocolo(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const protocolo = String(valor).trim()
  return protocolo || null
}

export async function executarBackfillProtocolos(params: {
  listarFilas: () => Promise<FilaSemProtocolo[]>
  buscarTicket: (ticketId: string) => Promise<{ protocol?: unknown }>
  salvarProtocolo: (filaId: string, ticketId: string, protocolo: string) => Promise<void>
  registrar?: (mensagem: string) => void
}) {
  const registrar = params.registrar ?? console.log
  const filas = await params.listarFilas()
  const falhas: FalhaBackfillProtocolo[] = []
  let preenchidos = 0

  registrar(`[LOG] [BACKFILL PROTOCOLO] Registros a consultar: ${filas.length}.`)

  for (let indice = 0; indice < filas.length; indice += 1) {
    const fila = filas[indice]
    registrar(`[LOG] [BACKFILL PROTOCOLO] Consultando ${indice + 1} de ${filas.length}. filaId=${fila.id}`)
    try {
      const ticket = await params.buscarTicket(fila.digisac_ticket_id)
      const protocolo = normalizarProtocolo(ticket?.protocol)
      if (!protocolo) throw new Error('protocolo_ausente_na_resposta')
      await params.salvarProtocolo(fila.id, fila.digisac_ticket_id, protocolo)
      preenchidos += 1
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error)
      falhas.push({ filaId: fila.id, ticketId: fila.digisac_ticket_id, motivo: motivo.slice(0, 200) })
      registrar(`[LOG] [BACKFILL PROTOCOLO] Falha individual. filaId=${fila.id} motivo=${motivo.slice(0, 200)}`)
    }
  }

  registrar(`[LOG] [BACKFILL PROTOCOLO] Consultados: ${filas.length}.`)
  registrar(`[LOG] [BACKFILL PROTOCOLO] Protocolos preenchidos: ${preenchidos}.`)
  registrar(`[LOG] [BACKFILL PROTOCOLO] Falhas: ${falhas.length}.`)
  return { consultados: filas.length, preenchidos, falhas }
}
