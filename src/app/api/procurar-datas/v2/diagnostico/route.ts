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

    if (entradaNormalizada.dataInicialISO && configResult.ok) {
      const janelaResult = gerarJanelaDatasPesquisaV2({
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

    // 8. Testar helpers puros
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
        config,
        helpers,
        avisos: [
          'Rota diagnóstica. Não busca candidatos e não substitui o motor legado.',
          'Normalizador de entrada v2 integrado: normalizarEntradaPesquisaV2().',
          'Diagnóstico de distância/frete usa Haversine e não substitui OSRM/ranking do motor legado.',
          'Janela de datas v2 gerada apenas para diagnóstico. Não consulta agenda nem disponibilidade.',
          'Helpers puros testados: tempo (parse/format), equipe (normalização), distância (haversine), frete, janela de datas.',
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
