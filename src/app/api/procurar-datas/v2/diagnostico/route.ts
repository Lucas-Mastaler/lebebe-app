// ─────────────────────────────────────────────────────────────────────────────
// POST /api/procurar-datas/v2/diagnostico
//
// Rota diagnóstica do futuro motor v2 de /procurar-datas.
//
// Propósito:
//   - Validar estrutura de entrada
//   - Testar carregamento de config normalizada
//   - Demonstrar uso de helpers puros já migrados
//   - Confirmar que a arquitetura Next.js está pronta para o motor
//
// NÃO FAZ:
//   - Não busca candidatos reais
//   - Não chama Apps Script
//   - Não chama OSRM
//   - Não chama Google Calendar
//   - Não altera produção
//   - Não integra na tela atual
//
// ACESSO: somente usuários comerciais autorizados (mesmo padrão das rotas atuais).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { parseMinutos, formatarMinutos } from '@/lib/procurar-datas/motor/tempo'
import { normalizarEquipe } from '@/lib/procurar-datas/motor/equipe'
import { normalizarEntradaPesquisaV2 } from '@/lib/procurar-datas/motor/entrada'
import { haversineKm } from '@/lib/procurar-datas/motor/distancia'
import { calcularFrete } from '@/lib/procurar-datas/motor/frete'
import { gerarJanelaDatasPesquisaV2 } from '@/lib/procurar-datas/motor/janela-datas'
import {
  filtrarDisponibilidadePorJanelaV2,
  type DisponibilidadeEquipeDataV2,
} from '@/lib/procurar-datas/motor/disponibilidade'
import {
  classificarCandidatoOperacionalV2,
  type ConfigClassificacaoV2,
} from '@/lib/procurar-datas/motor/classificacao-candidato'
import { montarCandidatoPreliminarV2 } from '@/lib/procurar-datas/motor/candidato'
import { ordenarCandidatosDiagnosticosV2 } from '@/lib/procurar-datas/motor/ordenacao-candidatos'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/procurar-datas/v2/diagnostico
 *
 * Entrada: PesquisarDatasRequest (mesmo contrato da pesquisa atual)
 * Saída: JSON diagnóstico com metadados seguros
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now()

  try {
    // 1. Validação de acesso (mesmo padrão das rotas atuais)
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    // 2. Parse do body usando contrato existente
    const body = (await request.json()) as PesquisarDatasRequest

    // 3. Normalizar entrada usando o normalizador puro do motor v2
    const entradaNormalizada = normalizarEntradaPesquisaV2(body)

    // 4. Diagnóstico da entrada (flags simples, sem expor dados sensíveis)
    const entrada = {
      temCep: !!body.cep && body.cep.trim().length > 0,
      temEnderecoCompleto: !!body.enderecoCompleto && body.enderecoCompleto.trim().length > 0,
      temLatLng: typeof body.lat === 'number' && typeof body.lng === 'number',
      temDestLatLng: typeof body.destLat === 'number' && typeof body.destLng === 'number',
      tempoNecessario: body.tempoNecessario || '',
      tempoMinutos: body.tempoNecessario ? parseMinutos(body.tempoNecessario) : 0,
      dataInicial: body.dataInicial || '',
      isRural: !!body.isRural,
      isCondominio: !!body.isCondominio,
    }

    // 5. Carregar config normalizada (com fallback para planilha)
    const configResult = await buscarConfiguracoesProcurarDatas()

    const config = configResult.ok
      ? {
          origem: configResult.origem,
          usandoFallbackPlanilha: configResult.usandoFallbackPlanilha,
          faltantesNoSupabase: configResult.faltantesNoSupabase,
          // Metadados seguros da config (não retorna a config inteira)
          resumo: {
            diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
            equipe1Ativa: configResult.config.equipe1Ativa,
            equipe2Ativa: configResult.config.equipe2Ativa,
            kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
            kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
            valorSemanaAte10km: configResult.config.valorSemanaAte10km,
            valorSabadoAte10km: configResult.config.valorSabadoAte10km,
          },
        }
      : {
          origem: 'erro' as const,
          usandoFallbackPlanilha: false,
          faltantesNoSupabase: [],
          erro: configResult.erro,
          origemErro: configResult.origemErro,
        }

    // 6. Diagnóstico de distância/frete (usando helpers puros, sem OSRM)
    let diagnosticoFrete: Record<string, unknown>

    const temCoordsOrigem = entradaNormalizada.coordenadasOrigemInformada !== null
    const temCoordsDestino = entradaNormalizada.coordenadasDestino !== null

    if (temCoordsOrigem && temCoordsDestino && configResult.ok) {
      const origem = entradaNormalizada.coordenadasOrigemInformada!
      const destino = entradaNormalizada.coordenadasDestino!
      const distKm = haversineKm(origem, destino)

      const params = configResult.config
      const freteResult = calcularFrete({
        distKm,
        isSabado: false,
        isRural: entradaNormalizada.isRural,
        isCondominio: entradaNormalizada.isCondominio,
        params: {
          kmMaxViagem: params.kmMaxViagem,
          kmMaxValorFixo: params.kmMaxValorFixo,
          kmMaxLongaCidade: params.kmMaxLongaCidade,
          kmMaxNaoViagem: params.kmMaxNaoViagem,
          valorSemanaAte10km: params.valorSemanaAte10km,
          valorSabadoAte10km: params.valorSabadoAte10km,
          fatorMultiplicadorKmViagem: params.fatorMultiplicadorKmViagem,
          multiplicadorKmNaoViagem: params.multiplicadorKmNaoViagem,
          valorDiaApos25kmSemana: params.valorDiaApos25kmSemana,
          valorDiaApos25kmSabado: params.valorDiaApos25kmSabado,
          precoCondominioAdicional: params.precoCondominioAdicional,
        },
        tipo: 'normal',
      })

      diagnosticoFrete = {
        executado: true,
        tipoDistancia: 'haversine_diagnostico',
        distanciaKm: Number(distKm.toFixed(2)),
        frete: freteResult.ok
          ? {
              valor: freteResult.valorFrete,
              valorFormatado: freteResult.valorFormatado,
              faixaAplicada: freteResult.faixaAplicada,
            }
          : {
              valor: 0,
              valorFormatado: freteResult.valorFormatado,
              faixaAplicada: freteResult.faixaAplicada,
            },
        avisos: [
          'Distância calculada por Haversine apenas para diagnóstico. Não substitui OSRM do motor legado.',
        ],
      }
    } else {
      diagnosticoFrete = {
        executado: false,
        motivo: !temCoordsOrigem || !temCoordsDestino
          ? 'Coordenadas insuficientes para diagnóstico de distância/frete.'
          : 'Config não carregada corretamente.',
      }
    }

    // 7. Diagnóstico de janela de datas (usando helper puro, sem agenda)
    let diagnosticoJanelaDatas: Record<string, unknown>
    let janelaResult: ReturnType<typeof gerarJanelaDatasPesquisaV2> | null = null

    if (entradaNormalizada.dataInicialISO && configResult.ok) {
      janelaResult = gerarJanelaDatasPesquisaV2({
        dataInicialISO: entradaNormalizada.dataInicialISO,
        diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
      })

      if (janelaResult.ok) {
        const diasSolicitados = configResult.config.diasPesquisaAgenda
        const quantidadeGerada = janelaResult.datas.length
        const primeiraDataISO = janelaResult.datas[0]?.dataISO ?? null
        const ultimaDataISO = janelaResult.datas[janelaResult.datas.length - 1]?.dataISO ?? null

        // Amostra com no máximo 5 datas
        const amostra = janelaResult.datas.slice(0, 5).map((d) => ({
          dataISO: d.dataISO,
          indice: d.indice,
          diaSemana: d.diaSemana,
          ehSabado: d.ehSabado,
          ehDomingo: d.ehDomingo,
        }))

        diagnosticoJanelaDatas = {
          executado: true,
          diasSolicitados,
          quantidadeGerada,
          primeiraDataISO,
          ultimaDataISO,
          amostra,
          avisos: [
            'Janela bruta de datas. Não consulta agenda, disponibilidade ou ranking.',
            ...janelaResult.avisos,
          ],
        }
      } else {
        diagnosticoJanelaDatas = {
          executado: false,
          motivo: janelaResult.avisos.join(' '),
        }
      }
    } else {
      diagnosticoJanelaDatas = {
        executado: false,
        motivo: !entradaNormalizada.dataInicialISO
          ? 'Data inicial ausente ou inválida.'
          : 'Config não carregada corretamente.',
      }
    }

    // 8. Diagnóstico de disponibilidade (usando helper puro, sem agenda real)
    let diagnosticoDisponibilidade: Record<string, unknown>

    if (janelaResult?.ok && entradaNormalizada.dataInicialISO) {
      // Gerar disponibilidades sintéticas para diagnóstico
      const disponibilidadesSinteticas: DisponibilidadeEquipeDataV2[] = []
      const janelaDatas = janelaResult.datas

      // Criar disponibilidades para as primeiras 5 datas da janela
      for (let i = 0; i < Math.min(5, janelaDatas.length); i++) {
        const data = janelaDatas[i].dataISO

        // Data 0: ambas equipes suficientes
        if (i === 0) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 180, ativa: true }
          )
        }
        // Data 1: EQUIPE 1 suficiente, EQUIPE 2 insuficiente
        else if (i === 1) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 30, ativa: true }
          )
        }
        // Data 2: EQUIPE 1 inativa, EQUIPE 2 suficiente
        else if (i === 2) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: false, motivoIndisponibilidade: 'Férias' },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 180, ativa: true }
          )
        }
        // Data 3: sem disponibilidade
        else if (i === 3) {
          // Nenhuma disponibilidade adicionada
        }
        // Data 4: ambas equipes suficientes com tempo maior
        else if (i === 4) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 300, ativa: true }
          )
        }
      }

      const disponibilidadeResult = filtrarDisponibilidadePorJanelaV2({
        janela: janelaDatas,
        disponibilidades: disponibilidadesSinteticas,
        tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
      })

      const quantidadeDatas = disponibilidadeResult.datas.length
      const quantidadeDatasComEquipe = disponibilidadeResult.datas.filter((d) => d.equipes.length > 0).length

      // Métricas detalhadas de equipes
      let quantidadeEquipesComRegistro = 0
      let quantidadeEquipesAtivas = 0
      let quantidadeEquipesSuficientes = 0
      let quantidadeEquipesInativas = 0
      let quantidadeEquipesInsuficientes = 0

      for (const data of disponibilidadeResult.datas) {
        for (const equipe of data.equipes) {
          quantidadeEquipesComRegistro++
          if (equipe.ativa) {
            quantidadeEquipesAtivas++
            if (equipe.suficienteParaServico) {
              quantidadeEquipesSuficientes++
            } else {
              quantidadeEquipesInsuficientes++
            }
          } else {
            quantidadeEquipesInativas++
          }
        }
      }

      diagnosticoDisponibilidade = {
        executado: true,
        quantidadeDatas,
        quantidadeDatasComEquipe,
        quantidadeEquipesComRegistro,
        quantidadeEquipesAtivas,
        quantidadeEquipesSuficientes,
        quantidadeEquipesInativas,
        quantidadeEquipesInsuficientes,
        tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
        resultado: {
          ok: disponibilidadeResult.ok,
          datas: disponibilidadeResult.datas.map((d) => ({
            dataISO: d.dataISO,
            indice: d.indice,
            diaSemana: d.diaSemana,
            ehSabado: d.ehSabado,
            ehDomingo: d.ehDomingo,
            equipes: d.equipes.map((e) => ({
              equipe: e.equipe,
              disponivelMin: e.disponivelMin,
              suficienteParaServico: e.suficienteParaServico,
              ativa: e.ativa,
              motivoIndisponibilidade: e.motivoIndisponibilidade,
            })),
          })),
          avisos: [
            'Disponibilidades sintéticas para diagnóstico. Não refletem agenda real.',
            ...disponibilidadeResult.avisos,
          ],
        },
      }
    } else {
      diagnosticoDisponibilidade = {
        executado: false,
        motivo: !janelaResult?.ok
          ? 'Janela de datas não foi gerada com sucesso.'
          : 'Data inicial ausente ou inválida.',
      }
    }

    // 9. Diagnóstico de classificação operacional (usando helper puro, sem agenda real)
    let diagnosticoClassificacao: Record<string, unknown>
    let diagnosticoCandidatos: Record<string, unknown>
    let diagnosticoOrdenacao: Record<string, unknown>

    if (
      (diagnosticoDisponibilidade as Record<string, unknown>).executado === true &&
      configResult.ok
    ) {
      const classificacoes: Array<{
        dataISO: string
        equipe: string
        tipo: string
        elegivel: boolean
        motivos: string[]
        avisos: string[]
        detalhes: {
          disponivelMin: number
          suficienteParaServico: boolean
          ativa: boolean
          tempoNecessarioMin: number | null
          distanciaKm: number | null
          kmAdicionalNaRotaM: number | null
          ehSabado: boolean
          ehDomingo: boolean
          diaSemana: number
        }
      }> = []

      const avisosClassificacao: string[] = [
        'Classificação operacional sintética para diagnóstico. Cenários derivados de equipe modelo válida.',
      ]

      // Usar distância do diagnóstico de frete ou fallback controlado
      const rawDistancia = (diagnosticoFrete as Record<string, unknown>).distanciaKm
      const distanciaKm: number | null =
        typeof rawDistancia === 'number' && Number.isFinite(rawDistancia) ? rawDistancia : 5

      const configClassificacao: ConfigClassificacaoV2 = {
        kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
        kmAdicionalMaxNaRotaEspecialM:
          configResult.config.kmAdicionalMaxNaRotaEspecialM,
        kmAdicionalMaxNaRotaPremiumM:
          configResult.config.kmAdicionalMaxNaRotaPremiumM,
        kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
        kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
      }

      const base = configResult.config.kmAdicionalMaxNaRotaM
      const especial = configResult.config.kmAdicionalMaxNaRotaEspecialM
      const premium = configResult.config.kmAdicionalMaxNaRotaPremiumM

      const datasDisponiveis = (
        (diagnosticoDisponibilidade as Record<string, unknown>).resultado as
          | Record<string, unknown>
          | undefined
      )?.datas as Array<Record<string, unknown>> | undefined

      // ── 1. Classificar todas as equipes reais do diagnóstico (valor padrão) ──
      for (const data of datasDisponiveis ?? []) {
        const equipes = (data.equipes as Array<Record<string, unknown>>) ?? []
        for (const equipe of equipes) {
          const resultado = classificarCandidatoOperacionalV2({
            dataISO: String(data.dataISO),
            diaSemana: Number(data.diaSemana),
            ehSabado: Boolean(data.ehSabado),
            ehDomingo: Boolean(data.ehDomingo),
            equipe: String(equipe.equipe),
            ativa: Boolean(equipe.ativa),
            disponivelMin: Number(equipe.disponivelMin),
            suficienteParaServico: Boolean(equipe.suficienteParaServico),
            motivoIndisponibilidade:
              (equipe.motivoIndisponibilidade as string | null) ?? null,
            tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
            distanciaKm,
            kmAdicionalNaRotaM: Math.floor(base * 0.5),
            isCondominio: entradaNormalizada.isCondominio,
            isRural: entradaNormalizada.isRural,
            horaMarcada: false,
            config: configClassificacao,
          })

          classificacoes.push({
            dataISO: String(data.dataISO),
            equipe: String(equipe.equipe),
            tipo: resultado.tipo,
            elegivel: resultado.elegivel,
            motivos: resultado.motivos,
            avisos: resultado.avisos,
            detalhes: {
              disponivelMin: resultado.detalhes.disponivelMin,
              suficienteParaServico: resultado.detalhes.suficienteParaServico,
              ativa: resultado.detalhes.ativa,
              tempoNecessarioMin: resultado.detalhes.tempoNecessarioMin,
              distanciaKm: resultado.detalhes.distanciaKm,
              kmAdicionalNaRotaM: resultado.detalhes.kmAdicionalNaRotaM,
              ehSabado: resultado.detalhes.ehSabado,
              ehDomingo: resultado.detalhes.ehDomingo,
              diaSemana: Number(data.diaSemana),
            },
          })
        }
      }

      // ── 2. Cenários sintéticos explícitos a partir de modelo válido ──
      // Encontrar primeira equipe ativa, suficiente, não domingo
      const modelo = classificacoes.find(
        (c) =>
          c.detalhes.ativa === true &&
          c.detalhes.suficienteParaServico === true &&
          c.detalhes.ehDomingo === false
      )

      if (modelo) {
        const criarCenario = (
          kmAdicionalNaRotaM: number,
          horaMarcada = false
        ) => {
          const resultado = classificarCandidatoOperacionalV2({
            dataISO: modelo.dataISO,
            diaSemana: modelo.detalhes.diaSemana,
            ehSabado: modelo.detalhes.ehSabado,
            ehDomingo: modelo.detalhes.ehDomingo,
            equipe: modelo.equipe,
            ativa: modelo.detalhes.ativa,
            disponivelMin: modelo.detalhes.disponivelMin,
            suficienteParaServico: modelo.detalhes.suficienteParaServico,
            motivoIndisponibilidade: null,
            tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
            distanciaKm,
            kmAdicionalNaRotaM,
            isCondominio: entradaNormalizada.isCondominio,
            isRural: entradaNormalizada.isRural,
            horaMarcada,
            config: configClassificacao,
          })

          classificacoes.push({
            dataISO: modelo.dataISO,
            equipe: `${modelo.equipe} (sintético)`,
            tipo: resultado.tipo,
            elegivel: resultado.elegivel,
            motivos: resultado.motivos,
            avisos: resultado.avisos,
            detalhes: {
              disponivelMin: resultado.detalhes.disponivelMin,
              suficienteParaServico: resultado.detalhes.suficienteParaServico,
              ativa: resultado.detalhes.ativa,
              tempoNecessarioMin: resultado.detalhes.tempoNecessarioMin,
              distanciaKm: resultado.detalhes.distanciaKm,
              kmAdicionalNaRotaM: resultado.detalhes.kmAdicionalNaRotaM,
              ehSabado: resultado.detalhes.ehSabado,
              ehDomingo: resultado.detalhes.ehDomingo,
              diaSemana: modelo.detalhes.diaSemana,
            },
          })
        }

        // Normal
        criarCenario(Math.floor(base * 0.5))

        // Especial (se config permitir)
        if (especial > base) {
          criarCenario(Math.floor((base + especial) / 2))
        } else {
          avisosClassificacao.push(
            'Config não permite cenário especial distinto do normal.'
          )
        }

        // Premium (se config permitir)
        if (premium > especial) {
          criarCenario(Math.floor((especial + premium) / 2))
        } else {
          avisosClassificacao.push(
            'Config não permite cenário premium distinto do especial.'
          )
        }

        // Hora marcada
        criarCenario(Math.floor(base * 0.5), true)

        // Indisponível — fora do premium
        criarCenario(Math.floor(premium * 1.5))
      } else {
        avisosClassificacao.push(
          'Nenhuma equipe modelo válida encontrada para gerar cenários sintéticos.'
        )
      }

      const quantidadeElegiveis = classificacoes.filter((c) => c.elegivel).length
      const quantidadeIndisponiveis = classificacoes.filter((c) => !c.elegivel).length
      const quantidadeNormal = classificacoes.filter((c) => c.tipo === 'normal').length
      const quantidadeEspecial = classificacoes.filter((c) => c.tipo === 'especial').length
      const quantidadePremium = classificacoes.filter((c) => c.tipo === 'premium').length
      const quantidadeHoraMarcada = classificacoes.filter(
        (c) => c.tipo === 'hora-marcada'
      ).length

      diagnosticoClassificacao = {
        executado: true,
        quantidadeCenariosClassificados: classificacoes.length,
        quantidadeElegiveis,
        quantidadeIndisponiveis,
        quantidadeNormal,
        quantidadeEspecial,
        quantidadePremium,
        quantidadeHoraMarcada,
        avisos: avisosClassificacao,
        amostra: classificacoes.slice(0, 10),
      }

      // ── 9.5. Montar candidatos preliminares v2 (lista completa, não amostra) ──
      // Extrair frete do diagnóstico se disponível
      const freteDiagnostico = (diagnosticoFrete as Record<string, unknown>).frete as
        | Record<string, unknown>
        | undefined
      const valorFreteDiagnostico =
        typeof freteDiagnostico?.valor === 'number' && Number.isFinite(freteDiagnostico.valor)
          ? freteDiagnostico.valor
          : null
      const tipoFreteDiagnostico = freteDiagnostico?.faixaAplicada as string | null ?? null
      const freteVinculado = valorFreteDiagnostico !== null

      const candidatosMontados = classificacoes.map((c, idx) =>
        montarCandidatoPreliminarV2({
          dataISO: c.dataISO,
          indice: idx,
          diaSemana: c.detalhes.diaSemana,
          ehSabado: c.detalhes.ehSabado,
          ehDomingo: c.detalhes.ehDomingo,
          equipe: c.equipe,
          disponivelMin: c.detalhes.disponivelMin,
          ativa: c.detalhes.ativa,
          suficienteParaServico: c.detalhes.suficienteParaServico,
          tempoNecessarioMin: c.detalhes.tempoNecessarioMin,
          distanciaKm: c.detalhes.distanciaKm,
          kmAdicionalNaRotaM: c.detalhes.kmAdicionalNaRotaM,
          valorFrete: valorFreteDiagnostico,
          tipoFrete: tipoFreteDiagnostico,
          classificacao: {
            tipo: c.tipo as import('@/lib/procurar-datas/motor/classificacao-candidato').TipoClassificacaoCandidatoV2,
            elegivel: c.elegivel,
            motivos: c.motivos,
            avisos: c.avisos,
            detalhes: {
              equipe: c.equipe,
              dataISO: c.dataISO,
              diaSemana: c.detalhes.diaSemana,
              ehSabado: c.detalhes.ehSabado,
              ehDomingo: c.detalhes.ehDomingo,
              ativa: c.detalhes.ativa,
              disponivelMin: c.detalhes.disponivelMin,
              suficienteParaServico: c.detalhes.suficienteParaServico,
              tempoNecessarioMin: c.detalhes.tempoNecessarioMin,
              distanciaKm: c.detalhes.distanciaKm,
              kmAdicionalNaRotaM: c.detalhes.kmAdicionalNaRotaM,
            },
          },
        })
      )

      const avisosCandidatos = [
        'Candidatos preliminares v2 montados a partir de classificações sintéticas.',
        freteVinculado
          ? 'Frete diagnóstico vinculado aos candidatos preliminares.'
          : 'Frete diagnóstico não possui valor confiável para vincular ao candidato preliminar.',
      ]

      diagnosticoCandidatos = {
        executado: true,
        freteVinculado,
        quantidadeCandidatosMontados: candidatosMontados.length,
        quantidadeElegiveis: candidatosMontados.filter((c) => c.elegivel).length,
        quantidadeIndisponiveis: candidatosMontados.filter((c) => !c.elegivel).length,
        quantidadeNormal: candidatosMontados.filter((c) => c.tipo === 'normal').length,
        quantidadeEspecial: candidatosMontados.filter((c) => c.tipo === 'especial').length,
        quantidadePremium: candidatosMontados.filter((c) => c.tipo === 'premium').length,
        quantidadeHoraMarcada: candidatosMontados.filter(
          (c) => c.tipo === 'hora-marcada'
        ).length,
        quantidadeComMotivos: candidatosMontados.filter((c) => c.motivos.length > 0).length,
        quantidadeComAvisos: candidatosMontados.filter((c) => c.avisos.length > 0).length,
        avisos: avisosCandidatos,
        amostra: candidatosMontados.slice(0, 10).map((c) => ({
          id: c.id,
          dataISO: c.dataISO,
          equipe: c.equipe,
          tipo: c.tipo,
          elegivel: c.elegivel,
          frete: c.frete,
          motivos: c.motivos,
          avisos: c.avisos,
        })),
      }

      // ── 9.6. Ordenar candidatos preliminares v2 (lista completa, não amostra) ──
      const resultadoOrdenacao = ordenarCandidatosDiagnosticosV2({
        candidatos: candidatosMontados,
      })

      const avisosOrdenacao = [
        'Ordenação preliminar/diagnóstica de candidatos v2. Não é ranking final de produção.',
        ...resultadoOrdenacao.avisos,
      ]

      diagnosticoOrdenacao = {
        executado: true,
        resumo: resultadoOrdenacao.resumo,
        avisos: avisosOrdenacao,
        amostra: resultadoOrdenacao.candidatos.slice(0, 10).map((c, idx) => ({
          posicao: idx + 1,
          id: c.id,
          dataISO: c.dataISO,
          equipe: c.equipe,
          tipo: c.tipo,
          elegivel: c.elegivel,
          indice: c.indice,
          frete: c.frete,
          motivos: c.motivos,
          avisos: c.avisos,
        })),
      }
    } else {
      diagnosticoClassificacao = {
        executado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }

      diagnosticoCandidatos = {
        executado: false,
        freteVinculado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }

      diagnosticoOrdenacao = {
        executado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }
    }

    // 10. Testar helpers puros
    const helpers = {
      // Tempo: converter HH:MM para minutos e voltar
      tempoTeste: entrada.tempoNecessario
        ? {
            input: entrada.tempoNecessario,
            minutos: parseMinutos(entrada.tempoNecessario),
            formatado: formatarMinutos(parseMinutos(entrada.tempoNecessario)),
          }
        : null,

      // Equipe: normalizar exemplo
      equipeTeste: {
        exemplos: ['EQUIPE 1', 'EQP 2', 'equipe 01', 'eqp inválida'].map((e) => ({
          input: e,
          normalizado: normalizarEquipe(e),
        })),
      },
    }

    // 9. Montar resposta diagnóstica
    const duracaoMs = Date.now() - inicio

    return NextResponse.json(
      {
        ok: true,
        versao: 'v2-diagnostico',
        motor: 'nextjs',
        modo: 'diagnostico',
        producaoAfetada: false,
        duracaoMs,
        entrada,
        entradaNormalizada: {
          cep: entradaNormalizada.cep,
          temEnderecoCompleto: Boolean(entradaNormalizada.enderecoCompleto),
          dataInicialISO: entradaNormalizada.dataInicialISO,
          tempoNecessarioTexto: entradaNormalizada.tempoNecessarioTexto,
          tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
          temEnderecoMinimo: entradaNormalizada.temEnderecoMinimo,
          temCoordenadasDestino: entradaNormalizada.temCoordenadasDestino,
          temCoordenadasOrigemInformada: Boolean(entradaNormalizada.coordenadasOrigemInformada),
          isRural: entradaNormalizada.isRural,
          isCondominio: entradaNormalizada.isCondominio,
          avisos: entradaNormalizada.avisos,
        },
        diagnosticoFrete,
        diagnosticoJanelaDatas,
        diagnosticoDisponibilidade,
        diagnosticoClassificacao,
        diagnosticoCandidatos,
        diagnosticoOrdenacao,
        config,
        helpers,
        avisos: [
          'Rota diagnóstica. Não busca candidatos e não substitui o motor legado.',
          'Normalizador de entrada v2 integrado: normalizarEntradaPesquisaV2().',
          'Diagnóstico de distância/frete usa Haversine e não substitui OSRM/ranking do motor legado.',
          'Janela de datas v2 gerada apenas para diagnóstico. Não consulta agenda nem disponibilidade.',
          'Disponibilidade v2 calculada com dados sintéticos para diagnóstico. Não reflete agenda real.',
          'Classificação operacional v2 calculada com kmAdicionalNaRotaM sintético para diagnóstico. Não reflete cenário real.',
          'Candidatos preliminares v2 montados a partir de classificações sintéticas. Frete não vinculado nesta etapa.',
          'Ordenação preliminar/diagnóstica de candidatos v2 aplicada. Não é ranking final de produção.',
          'Helpers puros testados: tempo (parse/format), equipe (normalização), distância (haversine), frete, janela de datas, disponibilidade, classificação, candidato, ordenação.',
          'Config carregada via config-service com fallback para planilha.',
        ],
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[PROCURAR-DATAS][v2/diagnostico] erro:', error)
    return respostaErroProcurarDatas(error)
  }
}
