export const DURACAO_SOM_PV_SEGUNDOS = 1.5
const NOTAS_PV = [523.25, 659.25, 783.99] as const

/** Vinheta local. Nenhum áudio/serviço externo; falhas nunca impedem a venda. */
export class SomPv {
  private contexto: AudioContext | null = null
  private notas: OscillatorNode[] = []

  async preparar() {
    try {
      if (typeof window === 'undefined') return false
      if (!this.contexto || this.contexto.state === 'closed') this.contexto = new AudioContext()
      if (this.contexto.state !== 'running') await this.contexto.resume()
      return this.contexto.state === 'running'
    } catch (error) {
      console.warn('[PV áudio] Reprodução indisponível; manter confirmação visual.', error instanceof Error ? error.name : 'audio_indisponivel')
      return false
    }
  }

  tocar() {
    const contexto = this.contexto
    if (!contexto || contexto.state !== 'running') return false
    try {
      this.pararNotas()
      const inicio = contexto.currentTime
      const fim = inicio + DURACAO_SOM_PV_SEGUNDOS
      NOTAS_PV.forEach((frequencia, indice) => {
        const nota = contexto.createOscillator()
        const volume = contexto.createGain()
        const ataque = inicio + indice * 0.16
        nota.type = 'sine'
        nota.frequency.setValueAtTime(frequencia, ataque)
        volume.gain.setValueAtTime(0, ataque)
        volume.gain.linearRampToValueAtTime(0.10, ataque + 0.015)
        volume.gain.exponentialRampToValueAtTime(0.001, fim - 0.03)
        volume.gain.linearRampToValueAtTime(0, fim)
        nota.connect(volume)
        volume.connect(contexto.destination)
        nota.onended = () => {
          nota.disconnect()
          volume.disconnect()
          this.notas = this.notas.filter(atual => atual !== nota)
        }
        nota.start(ataque)
        this.notas.push(nota)
        nota.stop(fim)
      })
      return true
    } catch (error) {
      this.pararNotas()
      console.warn('[PV áudio] Vinheta não reproduzida; venda permanece concluída.', error instanceof Error ? error.name : 'audio_indisponivel')
      return false
    }
  }

  private pararNotas() {
    const notas = this.notas
    this.notas = []
    notas.forEach(nota => {
      try { nota.stop() } catch {
        nota.disconnect()
        console.warn('[PV áudio] Nota interrompida por desconexão do dispositivo.')
      }
    })
  }

  parar() {
    this.pararNotas()
  }

  encerrar() {
    this.pararNotas()
    const contexto = this.contexto
    this.contexto = null
    if (contexto && contexto.state !== 'closed') {
      void contexto.close().catch(() => console.warn('[PV áudio] Não foi possível encerrar o contexto de áudio.'))
    }
  }
}
