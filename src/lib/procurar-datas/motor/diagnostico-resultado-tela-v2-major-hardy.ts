// ─────────────────────────────────────────────────────────────────────────────
// motor/diagnostico-resultado-tela-v2-major-hardy.ts
//
// Diagnóstico interno do motor v2 para o cenário Major Francisco Hardy,
// focando nos slots 31/07 e 05/08 de 2026.
//
// Segue exatamente o mesmo padrão de diagnostico-resultado-tela-v2-santo-amaro.ts.
//
// Expõe:
//   - candidatos gerados/elegíveis antes do recorte
//   - candidatos descartados e motivo de exclusão
//   - candidato final (se entrou)
//   - detalhe do slot: parseAgenda, deltaInsercao, filtroEarlyLegado,
//     origemOperacional, ordenacaoRotaBase
//   - disponibilidade para cada data alvo
//
// Ativado apenas quando options.diagnosticoDeltaMajorHardy31Jul=true.
// NÃO altera motor, regra de negócio, ranking, classificação, OSRM,
// Haversine, Apps Script, banco, produção.
// ─────────────────────────────────────────────────────────────────────────────

import type { PesquisarDatasRequest } from '../contratos'
import type { CandidatoPreliminarV2 } from './candidato'
import type { DetalheSlotMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import type { DisponibilidadeJanelaV2 } from './disponibilidade'
import { normalizarEquipe } from './equipe'
import type { PontoAgendaV2 } from './parse-agenda-shag'
import type { RecortarCandidatosLegadoEquivalenteOutput } from './recortar-candidatos-legado-equivalente'

const DATAS_ALVO = ['2026-07-31', '2026-08-05'] as const
const EQUIPE_ALVO = 'EQUIPE 1'

type DataAlvoMajorHardy = typeof DATAS_ALVO[number]

export interface MontarDiagnosticoResultadoTelaV2MajorHardyInput {
  request: PesquisarDatasRequest
  disponibilidadePorJanela: DisponibilidadeJanelaV2
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  candidatosAntesRecorte: CandidatoPreliminarV2[]
  recorte: RecortarCandidatosLegadoEquivalenteOutput
}

type PontoRotaBaseSimples = {
  indice: number
  tipo: string
  label: string
  lat: number
  lng: number
  endereco?: string
}

function resumirPontoAgenda(p: PontoAgendaV2) {
  const id = `agenda_${p.indiceLinhaOriginal}`
  return {
    id,
    indiceLinhaOriginal: p.indiceLinhaOriginal,
    dataISO: p.dataISO,
    equipe: p.equipe,
    tituloEvento: p.tituloEvento,
    endereco: p.endereco,
    fonteEndereco: p.fonteEndereco,
    cep: p.cep,
    fonteCep: p.fonteCep,
    lat: p.coordenadas.lat,
    lng: p.coordenadas.lng,
  }
}

function enriquecerPontosRotaBase(
  pontosRotaBase: PontoRotaBaseSimples[] | null | undefined,
  pontosAgenda: PontoAgendaV2[] | null | undefined
) {
  if (!pontosRotaBase) return null
  return pontosRotaBase.map((ponto) => {
    if (ponto.tipo === 'origem') {
      return {
        ...ponto,
        id: 'origem',
        tituloEvento: null,
        cep: null,
        equipe: null,
        indiceLinhaOriginal: null,
        origemTipo: 'deposito/casa-equipe',
      }
    }
    const idLabel = ponto.label
    const indice = idLabel.startsWith('agenda_')
      ? Number(idLabel.replace('agenda_', ''))
      : null
    const pontoAgenda =
      indice !== null
        ? (pontosAgenda ?? []).find((pa) => pa.indiceLinhaOriginal === indice)
        : null
    return {
      ...ponto,
      id: idLabel,
      tituloEvento: pontoAgenda?.tituloEvento ?? null,
      cep: pontoAgenda?.cep ?? null,
      fonteCep: pontoAgenda?.fonteCep ?? null,
      fonteEndereco: pontoAgenda?.fonteEndereco ?? null,
      equipe: pontoAgenda?.equipe ?? null,
      dataISO: pontoAgenda?.dataISO ?? null,
      indiceLinhaOriginal: pontoAgenda?.indiceLinhaOriginal ?? indice,
      latAgenda: pontoAgenda?.coordenadas.lat ?? null,
      lngAgenda: pontoAgenda?.coordenadas.lng ?? null,
    }
  })
}

function resumirCandidato(candidato: CandidatoPreliminarV2 | null, rank: number | null) {
  if (!candidato) return null
  return {
    rank,
    id: candidato.id,
    dataISO: candidato.dataISO,
    equipe: candidato.equipe,
    tipo: candidato.tipo,
    elegivel: candidato.elegivel,
    horaMarcada: candidato.horaMarcada ?? null,
    elegivelHoraMarcada: candidato.elegivelHoraMarcada ?? null,
    kmAdicionalNaRotaM: candidato.distancia.kmAdicionalNaRotaM,
    origemKmAdicional: candidato.distancia.origemKmAdicional ?? null,
    chaveSlotKm: candidato.distancia.chaveSlotKm ?? null,
    slotTemPontos: candidato.slotTemPontos ?? null,
    operacional: candidato.operacional,
    limites: candidato.limites,
    motivos: candidato.motivos,
    avisos: candidato.avisos,
    diagnostico: candidato.diagnostico,
  }
}

function rankPorId(candidatos: CandidatoPreliminarV2[], candidato: CandidatoPreliminarV2 | null) {
  if (!candidato) return null
  const idx = candidatos.findIndex((item) => item.id === candidato.id)
  return idx >= 0 ? idx + 1 : null
}

function resumoLista(candidatos: CandidatoPreliminarV2[]) {
  return candidatos.map((candidato, index) => resumirCandidato(candidato, index + 1))
}

function procurarDisponibilidade(
  disponibilidadePorJanela: DisponibilidadeJanelaV2,
  dataISO: string,
  equipeNormalizada: string
) {
  const dia = disponibilidadePorJanela.datas.find((item) => item.dataISO === dataISO)
  const equipe = dia?.equipes.find((item) => normalizarEquipe(item.equipe) === equipeNormalizada)
  return {
    encontrada: Boolean(equipe),
    dataEncontradaNaJanela: Boolean(dia),
    origem:
      'buscarDisponibilidadeRealDiagnosticaComDados(dataInicial, 200, 20, "entrada") em pesquisarDatasV2',
    disponivelMin: equipe?.disponivelMin ?? null,
    ativa: equipe?.ativa ?? null,
    suficienteParaServico: equipe?.suficienteParaServico ?? null,
    motivoIndisponibilidade: equipe?.motivoIndisponibilidade ?? null,
  }
}

function procurarDetalheSlot(
  detalhesPorSlot: DetalheSlotMapaKmAdicional[],
  dataISO: string,
  equipeNormalizada: string
) {
  return (
    detalhesPorSlot.find(
      (detalhe) =>
        detalhe.dataISO === dataISO &&
        normalizarEquipe(detalhe.equipe) === equipeNormalizada
    ) ?? null
  )
}

function diagnosticarData(input: {
  dataISO: DataAlvoMajorHardy
  equipeNormalizada: string
  tempoNecessarioMin: number | null
  disponibilidadePorJanela: DisponibilidadeJanelaV2
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  candidatosAntesRecorte: CandidatoPreliminarV2[]
  recorte: RecortarCandidatosLegadoEquivalenteOutput
}) {
  const candidatosData = input.candidatosAntesRecorte.filter(
    (candidato) =>
      candidato.dataISO === input.dataISO &&
      normalizarEquipe(candidato.equipe) === input.equipeNormalizada
  )
  const candidatoElegivel =
    candidatosData.find((candidato) => candidato.elegivel) ?? null
  const candidatoPrincipal = candidatoElegivel ?? candidatosData[0] ?? null
  const candidatoFinal =
    input.recorte.candidatosFinais.find(
      (candidato) =>
        candidato.dataISO === input.dataISO &&
        normalizarEquipe(candidato.equipe) === input.equipeNormalizada
    ) ?? null
  const exclusoes = input.recorte.exclusoes.filter(
    (exclusao) =>
      exclusao.dataISO === input.dataISO &&
      normalizarEquipe(exclusao.equipe) === input.equipeNormalizada
  )
  const detalheSlot = procurarDetalheSlot(
    input.detalhesPorSlot,
    input.dataISO,
    input.equipeNormalizada
  )
  const disponibilidade = procurarDisponibilidade(
    input.disponibilidadePorJanela,
    input.dataISO,
    input.equipeNormalizada
  )
  const suficienteCalculado =
    typeof disponibilidade.disponivelMin === 'number' &&
    typeof input.tempoNecessarioMin === 'number'
      ? disponibilidade.disponivelMin >= input.tempoNecessarioMin
      : null

  return {
    dataISO: input.dataISO,
    equipe: EQUIPE_ALVO,
    candidatoGerado: candidatoPrincipal !== null,
    candidatoElegivelGerado: candidatoElegivel !== null,
    disponibilidade: {
      ...disponibilidade,
      tempoNecessarioMin: input.tempoNecessarioMin,
      suficienteCalculado,
      observacaoAgenda:
        detalheSlot?.parseAgenda?.resumo
          ? 'Agenda real foi parseada para este slot; ver agenda.pontos.'
          : 'Sem detalhe de agenda para este slot no diagnostico real.',
    },
    agenda: {
      pontos: detalheSlot?.parseAgenda?.resumo ?? null,
      pontosRotaBase: detalheSlot?.deltaInsercao?.pontosRotaBase ?? null,
      pontosRotaBaseDetalhados: enriquecerPontosRotaBase(
        detalheSlot?.deltaInsercao?.pontosRotaBase ?? null,
        detalheSlot?.parseAgenda?.pontos ?? null
      ),
      pontosAgendaCompletos: detalheSlot?.parseAgenda?.pontos?.map(resumirPontoAgenda) ?? null,
      pontosAgendaDescartados: detalheSlot?.parseAgenda?.descartados ?? null,
      ordenacaoRotaBase: detalheSlot?.ordenacaoRotaBase ?? null,
      avisos: detalheSlot?.avisos ?? [],
      erros: detalheSlot?.erros ?? [],
    },
    osrmDelta: {
      kmAdicionalNaRotaM: detalheSlot?.kmAdicionalNaRotaM ?? candidatoPrincipal?.distancia.kmAdicionalNaRotaM ?? null,
      kmAdicionalNaRotaKm:
        typeof (detalheSlot?.kmAdicionalNaRotaM ?? candidatoPrincipal?.distancia.kmAdicionalNaRotaM) === 'number'
          ? Math.round(((detalheSlot?.kmAdicionalNaRotaM ?? candidatoPrincipal?.distancia.kmAdicionalNaRotaM ?? 0) / 1000) * 100) / 100
          : null,
      origemKmAdicionalNaRotaM: detalheSlot?.origemKmAdicionalNaRotaM ?? null,
      melhorInsercao: detalheSlot?.deltaInsercao?.melhorInsercao ?? null,
      candidatosInsercao: detalheSlot?.deltaInsercao?.candidatosInsercao ?? null,
      usaOsrmTableMatriz:
        detalheSlot?.origemKmAdicionalNaRotaM === 'osrm-table-diagnostico',
      origemOperacional: detalheSlot?.origemOperacional ?? null,
    },
    filtroEarlyHaversineLegado: {
      aplicadoNaV2: detalheSlot?.filtroEarlyLegado?.aplicado ?? false,
      descartadoNaV2: detalheSlot?.filtroEarlyLegado?.descartado ?? false,
      motivo: detalheSlot?.filtroEarlyLegado?.motivo ?? null,
      distanciaRetaKm: detalheSlot?.filtroEarlyLegado?.nearestStraightKm ?? null,
      limiteHaversineKm: detalheSlot?.filtroEarlyLegado?.limiteHaversineKm ?? null,
      ancoraDistanciaKm: detalheSlot?.filtroEarlyLegado?.ancoraDistanciaKm ?? null,
      limiteAncoraPremiumKm: detalheSlot?.filtroEarlyLegado?.limiteAncoraPremiumKm ?? null,
      ancoraEndereco: detalheSlot?.filtroEarlyLegado?.ancoraEndereco ?? null,
      ancoraTitulo: detalheSlot?.filtroEarlyLegado?.ancoraTitulo ?? null,
      ancoraCep: detalheSlot?.filtroEarlyLegado?.ancoraCep ?? null,
      nota:
        detalheSlot?.filtroEarlyLegado?.descartado
          ? 'Filtro early legado aplicado no caminho real v2 e descartou este slot antes da classificacao.'
          : 'Filtro early legado nao descartou este slot no caminho real v2.',
    },
    classificacaoAntesRecorte: resumirCandidato(
      candidatoPrincipal,
      rankPorId(input.candidatosAntesRecorte, candidatoPrincipal)
    ),
    recorte: {
      entrouAntesRecorte: candidatoElegivel !== null,
      entrouNoFinal: candidatoFinal !== null,
      final: resumirCandidato(candidatoFinal, rankPorId(input.recorte.candidatosFinais, candidatoFinal)),
      exclusoes,
      motivosExclusao: exclusoes.map((exclusao) => exclusao.motivo),
      motivoGranularDisponivel: exclusoes.length > 0,
      pendenciaTecnica:
        candidatoPrincipal && !candidatoFinal && exclusoes.length === 0
          ? 'Candidato existe antes do recorte, mas o recorte nao expos motivo granular para esta data/equipe.'
          : null,
    },
  }
}

export function montarDiagnosticoResultadoTelaV2MajorHardy(
  input: MontarDiagnosticoResultadoTelaV2MajorHardyInput
) {
  const equipeNormalizada = normalizarEquipe(EQUIPE_ALVO) ?? EQUIPE_ALVO
  const tempoNecessarioMin =
    input.candidatosAntesRecorte.find((candidato) => candidato.operacional.tempoNecessarioMin !== null)
      ?.operacional.tempoNecessarioMin ?? null

  const porData = Object.fromEntries(
    DATAS_ALVO.map((dataISO) => [
      dataISO,
      diagnosticarData({
        dataISO,
        equipeNormalizada,
        tempoNecessarioMin,
        disponibilidadePorJanela: input.disponibilidadePorJanela,
        detalhesPorSlot: input.detalhesPorSlot,
        candidatosAntesRecorte: input.candidatosAntesRecorte,
        recorte: input.recorte,
      }),
    ])
  ) as Record<DataAlvoMajorHardy, ReturnType<typeof diagnosticarData>>

  const especiaisAntesRecorte = input.candidatosAntesRecorte.filter(
    (candidato) => candidato.elegivel && candidato.tipo === 'especial'
  )
  const premiumsAntesRecorte = input.candidatosAntesRecorte.filter(
    (candidato) => candidato.elegivel && candidato.tipo === 'premium'
  )
  const extrasElegiveisAntesRecorte = input.candidatosAntesRecorte.filter(
    (candidato) =>
      candidato.elegivel &&
      (candidato.tipo === 'especial' ||
        candidato.tipo === 'premium' ||
        candidato.tipo === 'hora-marcada' ||
        candidato.elegivelHoraMarcada === true)
  )

  const d31jul = porData['2026-07-31']
  const d05ago = porData['2026-08-05']

  return {
    executado: true,
    ok: true,
    modo: 'diagnostico-resultado-tela-v2-major-hardy',
    payloadFixo: {
      dataInicial: input.request.dataInicial ?? null,
      cep: input.request.cep ?? null,
      destLat: input.request.destLat ?? null,
      destLng: input.request.destLng ?? null,
      isCondominio: input.request.isCondominio ?? null,
      isRural: input.request.isRural ?? null,
      isEncomenda: input.request.isEncomenda ?? null,
      tempoNecessario: input.request.tempoNecessario ?? null,
      tipoBerco: input.request.tipoBerco ?? null,
      comoda: input.request.comoda ?? null,
      roupeiro: input.request.roupeiro ?? null,
    },
    datasAlvo: [...DATAS_ALVO],
    equipeAlvo: EQUIPE_ALVO,
    analisePorData: porData,
    recorteFinal: {
      resumo: input.recorte.resumo,
      candidatosFinais: resumoLista(input.recorte.candidatosFinais),
      extrasElegiveisAntesRecorte: resumoLista(extrasElegiveisAntesRecorte),
      especiaisAntesRecorte: resumoLista(especiaisAntesRecorte),
      premiumsAntesRecorte: resumoLista(premiumsAntesRecorte),
      exclusoesDatasAlvo: DATAS_ALVO.map((dataISO) => ({
        dataISO,
        exclusoes: input.recorte.exclusoes.filter(
          (exclusao) =>
            exclusao.dataISO === dataISO &&
            normalizarEquipe(exclusao.equipe) === equipeNormalizada
        ),
      })),
    },
    comparacaoLegado: {
      referencia31jul: {
        legadoDescarta: true,
        motivoLegado: 'FORA-LIMITE — delta=16.16km > limitePremium=15km',
        ancoraLegado: 'Rua Professora Maria da Gloria Saldanha Loyola, Uberaba, Curitiba, Parana, 81540-470',
        ancoraTituloLegado: '(03:00) UBERABA 28617 (UBERABA)',
        ancoraDistanciaKmLegado: 16.16,
        limitesPremiumLegadoM: 15000,
        resultadoV2: d31jul.recorte.entrouNoFinal
          ? `DIVERGENCIA: v2 aceitou 31/07 como "${d31jul.classificacaoAntesRecorte?.tipo ?? '?'}"`
          : d31jul.candidatoElegivelGerado
            ? `DIVERGENCIA: v2 gerou 31/07 como elegivel tipo="${d31jul.classificacaoAntesRecorte?.tipo ?? '?'}" mas foi removido no recorte (motivo: ${d31jul.recorte.motivosExclusao.join(', ') || 'nao exposto'})`
            : d31jul.candidatoGerado
              ? `v2 gerou candidato inelegivel para 31/07 — ver classificacaoAntesRecorte.motivos`
              : `v2 nao gerou candidato para 31/07 — filtrado antes da geracao (filtroEarly, disponibilidade ou sem pontos)`,
        deltaV2M: d31jul.osrmDelta.kmAdicionalNaRotaM,
        deltaV2Km: d31jul.osrmDelta.kmAdicionalNaRotaKm,
        filtroEarlyAplicadoNaV2: d31jul.filtroEarlyHaversineLegado.descartadoNaV2,
      },
      referencia05ago: {
        legadoAceita: true,
        tipoLegado: 'ESPECIAL',
        motivoLegado: 'delta=9.04km — entre limite base=5km e especial=10km',
        ancoraLegado: 'Av. Candido Hartmann, 456, Curitiba - PR',
        ancoraTituloLegado: '3 (01:00) TRANSF. BIGORRILHO',
        ancoraDistanciaKmLegado: 6.52,
        resultadoV2: d05ago.recorte.entrouNoFinal
          ? `OK: v2 aceitou 05/08 como "${d05ago.classificacaoAntesRecorte?.tipo ?? '?'}"`
          : d05ago.candidatoElegivelGerado
            ? `DIVERGENCIA: v2 gerou 05/08 como elegivel tipo="${d05ago.classificacaoAntesRecorte?.tipo ?? '?'}" mas foi removido no recorte (motivo: ${d05ago.recorte.motivosExclusao.join(', ') || 'nao exposto'})`
            : d05ago.candidatoGerado
              ? `DIVERGENCIA: v2 gerou candidato inelegivel para 05/08 — ver classificacaoAntesRecorte.motivos e disponibilidade`
              : `DIVERGENCIA: v2 nao gerou candidato para 05/08 — filtrado antes da geracao (filtroEarly, disponibilidade ou sem pontos)`,
        deltaV2M: d05ago.osrmDelta.kmAdicionalNaRotaM,
        deltaV2Km: d05ago.osrmDelta.kmAdicionalNaRotaKm,
        filtroEarlyAplicadoNaV2: d05ago.filtroEarlyHaversineLegado.descartadoNaV2,
      },
    },
    pendencias: [
      d31jul.candidatoGerado && !d31jul.filtroEarlyHaversineLegado.descartadoNaV2
        ? '31/07: v2 nao aplicou filtro early para descartar — verificar se kmAdicionalNaRotaM v2 difere do legado (16.16km) ou se classificacao diferiu (especial vs FORA-LIMITE no legado).'
        : null,
      !d05ago.candidatoGerado
        ? '05/08: candidato nao gerado — verificar disponibilidade real, filtroEarlyLegado e pontos de agenda para este slot.'
        : null,
      d05ago.candidatoElegivelGerado && !d05ago.recorte.entrouNoFinal
        ? `05/08: elegivel mas removido no recorte com motivo="${d05ago.recorte.motivosExclusao.join(', ')}". Investigar regra de corte full-window (extra-posterior-ultima-normal) ou limite de especiais.`
        : null,
      d31jul.recorte.pendenciaTecnica,
      d05ago.recorte.pendenciaTecnica,
    ].filter((p): p is string => typeof p === 'string' && p.length > 0),
    trechoLegadoReferencia:
      'CEP-APIBACK.gs: loop de slots/filtro early Haversine e selecionarConjuntoApp3ComExtras_; CEP-CONFIG.gs: getSlots/coletarPontosDoDia/getDrivingKm.',
  }
}
