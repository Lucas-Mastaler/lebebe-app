import type { CandidatoPreliminarV2 } from './candidato'
import type { DisponibilidadeJanelaV2, EquipeDisponivelV2 } from './disponibilidade'
import type { DetalheSlotMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import type { RecortarCandidatosLegadoEquivalenteOutput } from './recortar-candidatos-legado-equivalente'
import { normalizarEquipe } from './equipe'

const DATAS_ALVO_SANTO_AMARO = [
  '2026-07-02',
  '2026-07-10',
  '2026-07-16',
  '2026-07-24',
  '2026-07-25',
  '2026-07-31',
  '2026-08-05',
  '2026-08-08',
] as const

const DIAS_SEMANA_PT = [
  'domingo',
  'segunda-feira',
  'terca-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sabado',
] as const

export interface MontarDiagnosticoSantoAmaroV2Input {
  datasAlvo?: string[]
  equipeAlvo?: string | null
  disponibilidadePorJanela: DisponibilidadeJanelaV2 | null
  candidatosAntesRecorte: CandidatoPreliminarV2[]
  recorte: RecortarCandidatosLegadoEquivalenteOutput | null
  detalhesPorSlot: DetalheSlotMapaKmAdicional[]
}

function formatarDataISO(dataISO: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO)
  if (!match) return dataISO

  const [, ano, mes, dia] = match
  const data = new Date(`${dataISO}T12:00:00.000Z`)
  const diaSemana = DIAS_SEMANA_PT[data.getUTCDay()] ?? 'dia-semana-indisponivel'
  return `${dia}/${mes}/${ano} (${diaSemana})`
}

function procurarEquipe(
  disponibilidadePorJanela: DisponibilidadeJanelaV2 | null,
  dataISO: string,
  equipeNormalizada: string | null
): EquipeDisponivelV2 | null {
  if (!disponibilidadePorJanela?.datas || !equipeNormalizada) return null

  const dia = disponibilidadePorJanela.datas.find((item) => item.dataISO === dataISO)
  if (!dia) return null

  return (
    dia.equipes.find((equipe) => normalizarEquipe(equipe.equipe) === equipeNormalizada) ?? null
  )
}

function rankDeCandidato(candidatos: CandidatoPreliminarV2[], alvo: CandidatoPreliminarV2): number | null {
  const idx = candidatos.findIndex((candidato) => candidato.id === alvo.id)
  return idx >= 0 ? idx + 1 : null
}

function resumoCandidato(candidato: CandidatoPreliminarV2 | null) {
  if (!candidato) return null

  return {
    id: candidato.id,
    dataISO: candidato.dataISO,
    equipe: candidato.equipe,
    tipo: candidato.tipo,
    elegivel: candidato.elegivel,
    horaMarcada: candidato.horaMarcada ?? null,
    elegivelHoraMarcada: candidato.elegivelHoraMarcada ?? null,
    kmAdicionalNaRotaM: candidato.distancia?.kmAdicionalNaRotaM ?? null,
    origemKmAdicional: candidato.distancia?.origemKmAdicional ?? null,
    chaveSlotKm: candidato.distancia?.chaveSlotKm ?? null,
    freteCandidatoV2: candidato.frete ?? null,
    motivos: candidato.motivos,
    avisos: candidato.avisos,
    diagnostico: candidato.diagnostico,
  }
}

function resumirCandidatosRecorte(candidatos: CandidatoPreliminarV2[]) {
  return candidatos.map((candidato, index) => ({
    rank: index + 1,
    dataISO: candidato.dataISO,
    equipe: candidato.equipe,
    tipo: candidato.tipo,
    elegivel: candidato.elegivel,
    horaMarcada: candidato.horaMarcada ?? null,
    kmAdicionalNaRotaM: candidato.distancia?.kmAdicionalNaRotaM ?? null,
    classificacao: candidato.diagnostico?.classificacaoTipo ?? candidato.tipo,
    freteCandidatoV2: candidato.frete ?? null,
  }))
}

export function montarDiagnosticoSantoAmaroV2(
  input: MontarDiagnosticoSantoAmaroV2Input
): Record<string, unknown> {
  const datasAlvo = input.datasAlvo?.length ? input.datasAlvo : [...DATAS_ALVO_SANTO_AMARO]
  const equipeAlvo = input.equipeAlvo?.trim() || 'EQUIPE 1'
  const equipeNormalizada = normalizarEquipe(equipeAlvo)
  const candidatosFinais = input.recorte?.candidatosFinais ?? []

  const slots = datasAlvo.map((dataISO) => {
    const detalheSlot =
      input.detalhesPorSlot.find(
        (detalhe) =>
          detalhe.dataISO === dataISO &&
          (!equipeNormalizada || normalizarEquipe(detalhe.equipe) === equipeNormalizada)
      ) ?? null
    const disponibilidade = procurarEquipe(
      input.disponibilidadePorJanela,
      dataISO,
      equipeNormalizada
    )
    const candidatosDataEquipe = input.candidatosAntesRecorte.filter(
      (candidato) =>
        candidato.dataISO === dataISO &&
        (!equipeNormalizada || normalizarEquipe(candidato.equipe) === equipeNormalizada)
    )
    const candidatoAntes =
      candidatosDataEquipe.find((candidato) => candidato.elegivel) ??
      candidatosDataEquipe[0] ??
      null
    const candidatoFinal =
      candidatosFinais.find(
        (candidato) =>
          candidato.dataISO === dataISO &&
          (!equipeNormalizada || normalizarEquipe(candidato.equipe) === equipeNormalizada)
      ) ?? null
    const exclusoes =
      input.recorte?.exclusoes.filter(
        (exclusao) =>
          exclusao.dataISO === dataISO &&
          (!equipeNormalizada || normalizarEquipe(exclusao.equipe) === equipeNormalizada)
      ) ?? []
    const pontosValidos =
      typeof detalheSlot?.parseAgenda?.resumo === 'object' &&
      detalheSlot.parseAgenda?.resumo !== null &&
      'pontosValidos' in detalheSlot.parseAgenda.resumo
        ? detalheSlot.parseAgenda.resumo.pontosValidos
        : null
    const exclusaoPrincipal = exclusoes[0] ?? null
    const motivoExclusao =
      exclusaoPrincipal?.motivo ??
      (candidatoAntes && !candidatoFinal
        ? 'indisponivel'
        : null)
    const pendenciasTecnicas =
      candidatoAntes && !candidatoFinal && exclusoes.length === 0
        ? ['recorte nao expoe motivo granular por candidato']
        : []

    return {
      dataISO,
      dataFormatada: formatarDataISO(dataISO),
      equipe: equipeAlvo,
      disponibilidade: disponibilidade
        ? {
            encontrada: true,
            disponivelMin: disponibilidade.disponivelMin,
            ativa: disponibilidade.ativa,
            suficienteParaServico: disponibilidade.suficienteParaServico,
            motivoIndisponibilidade: disponibilidade.motivoIndisponibilidade,
          }
        : {
            encontrada: false,
            disponivelMin: null,
            ativa: null,
            suficienteParaServico: null,
            motivoIndisponibilidade: 'Disponibilidade da data/equipe nao encontrada no resultado v2.',
          },
      agenda: {
        origem: detalheSlot?.origemKmAdicionalNaRotaM ?? null,
        pontosLidos: detalheSlot?.parseAgenda?.resumo ?? null,
        pontosValidos,
        pontosDescartados: detalheSlot?.descartados?.length ?? null,
        avisos: detalheSlot?.avisos ?? [],
        erros: detalheSlot?.erros ?? [],
      },
      rotaBase: {
        pontosRotaBase: detalheSlot?.deltaInsercao?.pontosRotaBase ?? null,
        ordenacaoRotaBase: detalheSlot?.ordenacaoRotaBase ?? null,
      },
      filtroEarlyHaversine: {
        aplicadoNaV2: false,
        distanciaRetaKm: null,
        limiteUsadoM: null,
        resultado: 'indisponivel-na-v2',
        pendencia:
          'O caminho v2 lido nao calcula filtro early Haversine/ancora do legado; a classificacao usa kmAdicionalNaRotaM por slot.',
      },
      ancoraVencedoraFiltroEarly: {
        disponivelNaV2: false,
        valor: null,
        pendencia:
          'Ancora vencedora do filtro early legado nao existe no bloco v2 lido. Melhor insercao OSRM abaixo nao e o mesmo contrato.',
      },
      osrmDelta: {
        kmAdicionalNaRotaM: detalheSlot?.kmAdicionalNaRotaM ?? null,
        origemKmAdicionalNaRotaM: detalheSlot?.origemKmAdicionalNaRotaM ?? null,
        melhorInsercao: detalheSlot?.deltaInsercao?.melhorInsercao ?? null,
        candidatosInsercao: detalheSlot?.deltaInsercao?.candidatosInsercao ?? null,
      },
      classificacao: candidatoAntes
        ? {
            tipo: candidatoAntes.tipo,
            elegivel: candidatoAntes.elegivel,
            horaMarcada: candidatoAntes.horaMarcada ?? null,
            elegivelHoraMarcada: candidatoAntes.elegivelHoraMarcada ?? null,
            motivos: candidatoAntes.motivos,
            avisos: candidatoAntes.avisos,
            limites: candidatoAntes.limites ?? null,
          }
        : {
            tipo: null,
            elegivel: null,
            horaMarcada: null,
            elegivelHoraMarcada: null,
            motivos: ['Candidato nao gerado para data/equipe no resultado v2.'],
            avisos: [],
            limites: null,
          },
      candidato: {
        gerado: candidatoAntes !== null,
        entrouAntesRecorte: candidatoAntes?.elegivel === true,
        rankAntesRecorte: candidatoAntes ? rankDeCandidato(input.candidatosAntesRecorte, candidatoAntes) : null,
        antesRecorte: resumoCandidato(candidatoAntes),
        entrouDepoisRecorte: candidatoFinal !== null,
        rankDepoisRecorte: candidatoFinal ? rankDeCandidato(candidatosFinais, candidatoFinal) : null,
        depoisRecorte: resumoCandidato(candidatoFinal),
        selecionadoNoRecorte: candidatoFinal !== null,
        excluidoNoRecorte: candidatoAntes !== null && candidatoFinal === null,
        exclusaoEncontrada: exclusoes.length > 0,
        motivoExclusao,
        motivoExclusaoDetalhado: exclusaoPrincipal ?? null,
        elegivelAntesRecorte: candidatoAntes?.elegivel ?? null,
        motivoInelegivel: candidatoAntes?.elegivel === false ? candidatoAntes.motivos : null,
        motivoRemovidoPorMaxNormal:
          exclusoes.find((exclusao) => exclusao.motivo === 'limite-normais-atingido') ?? null,
        motivoRemovidoPorExtraPosterior:
          exclusoes.find((exclusao) => exclusao.motivo === 'extra-posterior-ultima-normal') ?? null,
        motivoRemovidoPorLimiteExtra:
          exclusoes.find((exclusao) =>
            ['limite-especiais-atingido', 'limite-premiums-atingido', 'limite-hora-marcada-atingido'].includes(
              exclusao.motivo
            )
          ) ?? null,
        motivoPerdeuParaMesmoTipo:
          exclusoes.find((exclusao) => exclusao.motivo === 'duplicata-por-data-tipo') ?? null,
        pendenciasTecnicas,
        motivosRemocaoRecorte: exclusoes.map((exclusao) => exclusao.motivo),
        exclusoesRecorte: exclusoes,
      },
      frete: {
        candidatoV2: candidatoFinal?.frete ?? candidatoAntes?.frete ?? null,
        finalPayloadLegado: null,
        finalPayloadLegadoDisponivelNesteBloco: false,
        pendencia:
          'Frete final do payload legado e montado fora deste bloco diagnostico; aqui so ha frete carregado no candidato v2, quando informado.',
      },
      avisos: [
        ...(detalheSlot?.avisos ?? []),
        ...(candidatoAntes?.avisos ?? []),
        ...(!candidatoAntes ? ['Sem candidato antes do recorte para este slot alvo.'] : []),
        ...(candidatoAntes && !candidatoFinal && exclusoes.length === 0
          ? ['Candidato antes do recorte nao entrou no final, mas nao ha exclusao registrada para esta data/equipe.']
          : []),
      ],
    }
  })

  return {
    executado: true,
    ok: true,
    modo: 'diagnostico-santo-amaro-v2',
    escopo:
      'Diagnostico dirigido para Santo Amaro. Apenas expõe dados ja calculados pelo fluxo diagnostico v2; nao altera regras, ranking, frontend ou legado.',
    parametros: {
      datasAlvo,
      equipeAlvo,
      equipeNormalizada,
      enderecoReferencia: 'R. Santo Amaro, 300, Agua Verde, Curitiba - PR',
      cepReferencia: '80620-220',
      coordenadasReferencia: { lat: -25.45741, lng: -49.275329, provider: 'locationiq' },
    },
    resumo: {
      slotsAlvo: slots.length,
      candidatosAntesRecorte: input.candidatosAntesRecorte.length,
      candidatosFinais: candidatosFinais.length,
      slotsComCandidatoAntesRecorte: slots.filter(
        (slot) =>
          typeof slot === 'object' &&
          slot !== null &&
          'candidato' in slot &&
          (slot.candidato as { gerado?: boolean }).gerado === true
      ).length,
      slotsNoResultadoFinal: slots.filter(
        (slot) =>
          typeof slot === 'object' &&
          slot !== null &&
          'candidato' in slot &&
          (slot.candidato as { entrouDepoisRecorte?: boolean }).entrouDepoisRecorte === true
      ).length,
    },
    slots,
    recorte: input.recorte
      ? {
          ok: input.recorte.ok,
          resumo: input.recorte.resumo,
          diasUsados: input.recorte.diasUsados,
          candidatosSelecionados: resumirCandidatosRecorte(input.recorte.candidatosFinais),
          candidatosSelecionadosPorTipo: {
            normais: resumirCandidatosRecorte(input.recorte.normais),
            especiais: resumirCandidatosRecorte(input.recorte.especiais),
            premiums: resumirCandidatosRecorte(input.recorte.premiums),
            horaMarcada: resumirCandidatosRecorte(input.recorte.horaMarcada),
          },
          exclusoes: input.recorte.exclusoes,
          exclusoesPorDataAlvo: datasAlvo.map((dataISO) => ({
            dataISO,
            exclusoes: input.recorte?.exclusoes.filter(
              (exclusao) =>
                exclusao.dataISO === dataISO &&
                (!equipeNormalizada || normalizarEquipe(exclusao.equipe) === equipeNormalizada)
            ) ?? [],
          })),
          avisos: input.recorte.avisos,
        }
      : null,
    avisos: [
      'Filtro early Haversine/ancora legado nao foi encontrado no caminho v2 lido; campos correspondentes ficam explicitamente indisponiveis.',
      'Frete final de payload legado nao e calculado neste helper diagnostico.',
    ],
  }
}
