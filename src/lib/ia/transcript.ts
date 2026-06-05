import { buscarMensagensTicketPaginado, type DigisacMensagem } from '@/lib/digisac/sgi-sync'

const TRANSCRIPT_MAX_CHARS = 22_000

export interface TranscriptResult {
  transcript: string
  truncado: boolean
  totalMensagens: number
  tamanhoOriginal: number
}

function formatarTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return '??/??/???? ??:??'
  const d = new Date(timestamp * 1000)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${hora}:${min}`
}

function temConteudoMidia(msg: DigisacMensagem): boolean {
  return !msg.text && msg.type !== undefined && msg.type !== 'chat'
}

export async function montarTranscriptChamado(ticketId: string): Promise<TranscriptResult> {
  const { mensagens, incompleto } = await buscarMensagensTicketPaginado(ticketId)

  // Filtra: ignora reaction, invisible, comments, sem id
  const filtradas = mensagens.filter((m) => {
    if (!m.id) return false
    if (m.type === 'reaction') return false
    if (m.visible === false) return false
    if (m.isComment === true) return false
    return true
  })

  // Ordena por timestamp ASC
  const ordenadas = [...filtradas].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  const linhas: string[] = []

  for (const msg of ordenadas) {
    const hora = formatarTimestamp(msg.timestamp)
    const autor = msg.isFromMe ? 'Atendente' : 'Cliente'

    let conteudo: string
    if (msg.text && msg.text.trim()) {
      conteudo = msg.text.trim()
    } else if (temConteudoMidia(msg)) {
      conteudo = '[arquivo/imagem/áudio enviado - sem transcrição]'
    } else {
      continue
    }

    linhas.push(`[${hora}] ${autor}: ${conteudo}`)
  }

  const transcriptCompleto = linhas.join('\n')
  const tamanhoOriginal = transcriptCompleto.length
  let truncado = tamanhoOriginal > TRANSCRIPT_MAX_CHARS || incompleto
  let transcript = transcriptCompleto

  if (tamanhoOriginal > TRANSCRIPT_MAX_CHARS) {
    const MENSAGENS_INICIO = 20
    const MENSAGENS_FIM = 20
    const inicio = linhas.slice(0, MENSAGENS_INICIO)
    const fim = linhas.slice(-MENSAGENS_FIM)

    const marcador = '[... trecho intermediário removido por limite de tamanho ...]'
    const base = inicio.join('\n') + '\n' + marcador + '\n' + fim.join('\n')

    if (base.length > TRANSCRIPT_MAX_CHARS) {
      // Se mesmo com início+fim estourar, força corte simples do final
      transcript = base.slice(0, TRANSCRIPT_MAX_CHARS) + '\n[... transcript truncado por tamanho ...]'
    } else {
      transcript = base
    }
  }

  return {
    transcript,
    truncado,
    totalMensagens: ordenadas.length,
    tamanhoOriginal,
  }
}
