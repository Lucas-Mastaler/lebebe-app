import type { PesquisarDatasRequest } from '../contratos'
import type { CandidatoPreliminarV2 } from './candidato'
import type { DetalheSlotMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import type { DisponibilidadeJanelaV2 } from './disponibilidade'
import { normalizarEquipe } from './equipe'
import type { RecortarCandidatosLegadoEquivalenteOutput } from './recortar-candidatos-legado-equivalente'

const DATAS_ALVO = ['2026-07-02', '2026-07-16', '2026-07-24', '2026-07-25'] as const
const EQUIPE_ALVO = 'EQUIPE 1'

type DataAlvoSantoAmaro = typeof DATAS_ALVO[number]

export interface MontarDiagnosticoResultadoTelaV2SantoAmaroInput {
  request: PesquisarDatasRequest
  disponibilidadePorJanela: DisponibilidadeJanelaV2
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
  candidatosAntesRecorte: CandidatoPreliminarV2[]
  recorte: RecortarCandidatosLegadoEquivalenteOutput
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
  dataISO: DataAlvoSantoAmaro
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
      ordenacaoRotaBase: detalheSlot?.ordenacaoRotaBase ?? null,
      avisos: detalheSlot?.avisos ?? [],
      erros: detalheSlot?.erros ?? [],
    },
    osrmDelta: {
      kmAdicionalNaRotaM: detalheSlot?.kmAdicionalNaRotaM ?? candidatoPrincipal?.distancia.kmAdicionalNaRotaM ?? null,
      origemKmAdicionalNaRotaM: detalheSlot?.origemKmAdicionalNaRotaM ?? null,
      melhorInsercao: detalheSlot?.deltaInsercao?.melhorInsercao ?? null,
      candidatosInsercao: detalheSlot?.deltaInsercao?.candidatosInsercao ?? null,
      usaOsrmTableMatriz:
        detalheSlot?.origemKmAdicionalNaRotaM === 'osrm-table-diagnostico',
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
      divergenciaProvavelFrente1:
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

export function montarDiagnosticoResultadoTelaV2SantoAmaro(
  input: MontarDiagnosticoResultadoTelaV2SantoAmaroInput
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
  ) as Record<DataAlvoSantoAmaro, ReturnType<typeof diagnosticarData>>
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
  const extraFinal = input.recorte.candidatosFinais.find((candidato) => candidato.tipo !== 'normal') ?? null

  return {
    executado: true,
    ok: true,
    modo: 'diagnostico-resultado-tela-v2-santo-amaro',
    payloadExatoTelaEsperado: {
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
      poltrona: input.request.poltrona ?? null,
      painel: input.request.painel ?? null,
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
      porQue02VenceuComoExtra:
        extraFinal?.dataISO === '2026-07-02'
          ? '02/07 entrou porque foi gerado como especial elegivel e e o primeiro especial aceito pelo recorte antes da ultima normal. Ver analisePorData["2026-07-02"].filtroEarlyHaversineLegado para confirmar se o filtro descartou ou nao o slot.'
          : '02/07 nao foi o extra final neste resultado.',
      premiumNaoEncontradoOuRemovido:
        premiumsAntesRecorte.length === 0
          ? 'Nenhum premium elegivel foi gerado antes do recorte.'
          : 'Premium existiu antes do recorte; verificar exclusoes por data e limites do recorte.',
    },
    comparacaoLegado: {
      aplicaFiltroEarlyHaversineEquivalente: true,
      divergenciaProvavel:
        'Frente 1: filtro early Haversine/ancora legado foi implementado no caminho real v2 por slot com pontos.',
      usaOsrmTableMatrizParaDelta: true,
      limitesV2ExpostosNosCandidatos:
        'Cada candidato traz limites.limiteBaseM, limiteEspecialM e limitePremiumM usados na classificacao.',
      criterioPremium:
        'No codigo v2, premium e aplicado quando kmAdicionalNaRotaM > limiteEspecialM e <= limitePremiumM, apos validacoes de disponibilidade/distancia.',
      trechoLegadoAConsultarSePersistirDuvida:
        'CEP-APIBACK.gs: loop de slots/filtro early Haversine e selecionarConjuntoApp3ComExtras_; CEP-CONFIG.gs: getSlots/coletarPontosDoDia/getDrivingKm.',
    },
    conclusaoProvavel: {
      tipo:
        porData['2026-07-02'].candidatoElegivelGerado && porData['2026-07-02'].recorte.entrouNoFinal
          ? 'filtro-early-haversine-nao-aplicado-ou-recorte'
          : 'nao-confirmado',
      detalhes: [
        '02/07 deve ser explicado principalmente por candidato especial elegivel no v2 e ausencia do filtro early Haversine legado no caminho lido.',
        '16/07, 24/07 e 25/07 devem ser analisados em analisePorData para separar nao gerado, classificado diferente, filtrado antes da classificacao ou removido no recorte.',
        'Se 16/07 nao aparecer em premiumsAntesRecorte, o problema esta antes do recorte: disponibilidade, km adicional ou classificacao.',
        'Se 24/07 aparecer em especiaisAntesRecorte mas nao no final, a causa esta no recorte/competicao com 02/07.',
        'Se 25/07 nao aparecer como normal antes do recorte, conferir filtroEarlyHaversineLegado, osrmDelta e slotTemPontos antes de investigar o recorte.',
      ],
    },
  }
}
