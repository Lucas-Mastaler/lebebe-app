import { describe, expect, it } from 'vitest'
import { MedidorPerformanceV2 } from './performance-diagnostico-v2'

describe('MedidorPerformanceV2', () => {
  it('resume etapas, OSRM, slots, candidatos, cache e avaliacao TSP/matriz', async () => {
    let agora = 1_000
    const medidor = new MedidorPerformanceV2(() => agora)

    medidor.medir('recorte', () => {
      agora += 12
    })

    await medidor.medirOsrm('matriz-table', async () => {
      agora += 30
      return { ok: true }
    })

    await expect(
      medidor.medirOsrm('deposito-destino', async () => {
        agora += 10
        throw new Error('OSRM timeout apos 10000ms')
      })
    ).rejects.toThrow('OSRM timeout')

    medidor.registrarSlots({
      slotsAvaliados: 5,
      slotsComPontos: 2,
      slotsSemPontos: 3,
      slotsComKm: 4,
      slotsComFallbackHaversine: 1,
    })
    medidor.registrarCache({ hashesConsultados: 10, hitsSupabase: 8, enderecosSemHash: 1 })
    medidor.registrarCandidatosAntesRecorte([
      { tipo: 'normal', elegivel: true },
      { tipo: 'especial', elegivel: true },
      { tipo: 'hora-marcada', elegivel: true, elegivelHoraMarcada: true },
      { tipo: 'indisponivel', elegivel: false },
    ])
    medidor.registrarRecorte({
      candidatosFinais: [{ tipo: 'normal' }],
      exclusoes: [
        { motivo: 'limite-normais-atingido' },
        { motivo: 'extra-posterior-ultima-normal' },
      ],
      extrasRemovidosPorDataPosterior: 1,
    })
    medidor.registrarJanelaProcessadaInteira(true)

    const diagnostico = medidor.finalizar()

    expect(diagnostico.habilitado).toBe(true)
    expect(diagnostico.temposMs.recorte).toBe(12)
    expect(diagnostico.osrm.total.total).toBe(2)
    expect(diagnostico.osrm.total.sucesso).toBe(1)
    expect(diagnostico.osrm.total.timeout).toBe(1)
    expect(diagnostico.osrm.porTipo['matriz-table']?.tempoTotalMs).toBe(30)
    expect(diagnostico.contadores.slotsAvaliados).toBe(5)
    expect(diagnostico.contadores.candidatosAntesRecorte).toBe(4)
    expect(diagnostico.contadores.candidatosFinais).toBe(1)
    expect(diagnostico.contadores.candidatosDescartadosPorMotivo).toMatchObject({
      'limite-normais-atingido': 1,
      'extra-posterior-ultima-normal': 1,
    })
    expect(diagnostico.cache.hitsSupabase).toBe(8)
    expect(diagnostico.fluxo.postAguardaOrquestradorCompleto).toBe(true)
    expect(diagnostico.fluxo.janelaProcessadaInteira).toBe(true)
    expect(diagnostico.tspMatriz.usaOsrmTableMatriz).toBe(true)
    expect(diagnostico.tspMatriz.tspImplementado).toBe(false)
  })

  it('nao mascara erro da funcao medida', async () => {
    const medidor = new MedidorPerformanceV2()
    const erro = new Error('falha controlada')

    await expect(medidor.medirAsync('config', async () => {
      throw erro
    })).rejects.toBe(erro)

    expect(medidor.finalizar().etapas.map((e) => e.nome)).toContain('config')
  })

  it('aceita classificador de status OSRM para retorno ok=false sem throw', async () => {
    const medidor = new MedidorPerformanceV2()

    await medidor.medirOsrm(
      'deposito-destino',
      async () => ({ ok: false, erro: 'HTTP 503' }),
      (resultado) => (resultado.ok ? 'sucesso' : 'erro')
    )

    const diagnostico = medidor.finalizar()
    expect(diagnostico.osrm.total.total).toBe(1)
    expect(diagnostico.osrm.total.erro).toBe(1)
  })
})
