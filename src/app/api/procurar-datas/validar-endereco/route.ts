import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarEnderecoNoGeoCache, salvarEnderecoNoGeoCache } from '@/lib/procurar-datas/endereco-cache'
import { buscarEnderecoLocationIq, type LocationIqEvent } from '@/lib/procurar-datas/locationiq'
import {
  consultarGoogleGeocodingEnderecoDificil,
  ehEnderecoDificilRodoviaOuRural,
  type GoogleGeocodingEvent,
} from '@/lib/procurar-datas/google-geocoding'
import { validarPayloadEndereco } from '@/lib/procurar-datas/validar-endereco-payload'
import type { ValidarEnderecoRequest, ValidarEnderecoResponseSucesso, EnderecoValidado } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][validar-endereco] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as ValidarEnderecoRequest
    const erroPayload = validarPayloadEndereco(body)
    if (erroPayload) {
      console.log(`[PROCURAR_DATAS][validar-endereco] payload_invalido motivo=numero_ou_campos_obrigatorios duracaoMs=${Date.now() - inicio}`)
      return NextResponse.json({ ok: false, error: erroPayload }, { status: 400 })
    }

    const cache = await buscarEnderecoNoGeoCache(body)
    if (cache.status === 'hit') {
      console.log(
        `[PROCURAR_DATAS][validar-endereco] cache_hit provider=supabase fallback=none duracaoMs=${Date.now() - inicio}`
      )
      const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado: cache.resultado }
      return NextResponse.json(resposta)
    }

    console.log(
      `[PROCURAR_DATAS][validar-endereco] cache_miss provider=supabase motivo=${cache.motivo} candidatosAvaliados=${cache.candidatosAvaliados ?? 0} duracaoMs=${Date.now() - inicio}`
    )

    const logLocationIq = (event: LocationIqEvent) => {
      if (event.tipo === 'locationiq_failed') {
        console.log(
          `[PROCURAR_DATAS][validar-endereco] locationiq_failed reserva=${event.reserva} motivo=${event.motivo} duracaoMs=${Date.now() - inicio}`
        )
        return
      }

      if (event.tipo === 'locationiq_start') {
        console.log(
          `[PROCURAR_DATAS][validar-endereco] locationiq_start reserva=${event.reserva} duracaoMs=${Date.now() - inicio}`
        )
        return
      }

      console.log(`[PROCURAR_DATAS][validar-endereco] ${event.tipo} duracaoMs=${Date.now() - inicio}`)
    }

    const locationIq = await buscarEnderecoLocationIq(body, { onEvent: logLocationIq })
    if (locationIq.status === 'success') {
      const cacheSave = await salvarEnderecoNoGeoCache(body, locationIq.resultado)
      if (!cacheSave.ok) {
        console.warn(
          `[PROCURAR_DATAS][validar-endereco] geo_cache_save_failed provider=locationiq motivo=${cacheSave.erro} duracaoMs=${Date.now() - inicio}`
        )
      }

      const r = locationIq.resultado
      const latStr = r.lat !== undefined ? r.lat.toFixed(5) : '-'
      const lngStr = r.lng !== undefined ? r.lng.toFixed(5) : '-'
      const addr = r.address as Record<string, unknown> | undefined
      const addressTrunc = String(r.enderecoCompleto ?? r.display ?? r.display_name ?? '').slice(0, 80)
      const match = String((r as Record<string, unknown>).match ?? 'exato')
      const numeroOk = (r as Record<string, unknown>).numeroOk
      const numeroObrigatorio = (r as Record<string, unknown>).numeroObrigatorio
      const classificacao = String((r as Record<string, unknown>).classificacaoDiagnostica ?? match)
      const motivo = String((r as Record<string, unknown>).motivo ?? 'aceito')
      console.log(
        `[PROCURAR_DATAS][validar-endereco] sucesso provider=locationiq fallback=none` +
        ` match=${match} motivo=${motivo}` +
        ` numeroOk=${numeroOk ?? '-'} numeroObrigatorio=${numeroObrigatorio ?? '-'} bairroOk=-` +
        ` classificacaoDiagnostica=${classificacao}` +
        ` lat=${latStr} lng=${lngStr}` +
        ` confidence=${r.confidence ?? '-'}` +
        ` cep=${r.cep ?? '-'}` +
        ` bairro="${addr?.suburb ?? '-'}"` +
        ` city="${addr?.city ?? '-'}"` +
        ` state="${addr?.state ?? '-'}"` +
        ` address="${addressTrunc}"` +
        ` duracaoMs=${Date.now() - inicio}`
      )
      const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado: locationIq.resultado }
      return NextResponse.json(resposta)
    }

    console.log(
      `[PROCURAR_DATAS][validar-endereco] locationiq_failed motivo=${locationIq.motivo} duracaoMs=${Date.now() - inicio}`
    )

    if (ehEnderecoDificilRodoviaOuRural(body)) {
      const logGoogle = (event: GoogleGeocodingEvent) => {
        if (event.tipo === 'google_fallback_success') {
          console.log(`[PROCURAR_DATAS][validar-endereco] google_fallback_success duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_rejected') {
          console.log(`[PROCURAR_DATAS][validar-endereco] google_fallback_rejected motivo=${event.motivo} duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_error') {
          console.log(`[PROCURAR_DATAS][validar-endereco] google_fallback_error motivo=${event.motivo} duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_missing_key') {
          console.log(`[PROCURAR_DATAS][validar-endereco] google_fallback_missing_key duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_skip_not_difficult') {
          console.log(`[PROCURAR_DATAS][validar-endereco] google_fallback_skip_not_difficult duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_query') {
          console.log(`[PROCURAR_DATAS][validar-endereco][google_fallback_query] query="${event.query}" cidade="${event.cidade}" uf="${event.uf}" cep="${event.cep}" enderecoDificil=true duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_fallback_response') {
          console.log(`[PROCURAR_DATAS][validar-endereco][google_fallback_response] status="${event.status}" total=${event.total} errorMessage="${event.errorMessage ?? ''}" duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_candidate') {
          console.log(
            `[PROCURAR_DATAS][validar-endereco][google_candidate] idx=${event.idx} motivos=${event.motivos} lat=${event.lat} lng=${event.lng} formatted="${event.formatted}" placeId="${event.placeId}" locationType="${event.locationType}" partialMatch=${event.partialMatch} route="${event.route}" streetNumber="${event.streetNumber}" bairroCandidate="${event.bairroCandidate}" cityCandidate="${event.cityCandidate}" citySource="${event.citySource}" formattedCityMatch=${event.formattedCityMatch} stateCandidate="${event.stateCandidate}" postcode="${event.postcode}" cidadeOk=${event.cidadeOk} ufOk=${event.ufOk} logradouroOk=${event.logradouroOk} numeroOk=${event.numeroOk} bairroOk=${event.bairroOk} cepOk=${event.cepOk} duracaoMs=${Date.now() - inicio}`
          )
          return
        }
        if (event.tipo === 'google_summary') {
          console.log(`[PROCURAR_DATAS][validar-endereco][google_summary] total=${event.total} aceitos=${event.aceitos} rejeitados=${event.rejeitados} motivos=${event.motivos} duracaoMs=${Date.now() - inicio}`)
          return
        }
        if (event.tipo === 'google_reject_detail') {
          console.log(`[PROCURAR_DATAS][validar-endereco][google_reject_detail] motivo=${event.motivo} esperadoCidade="${event.esperadoCidade}" recebidoCidade="${event.recebidoCidade}" formatted="${event.formatted}" componentsResumo="${event.componentsResumo}" duracaoMs=${Date.now() - inicio}`)
          return
        }
        console.log(`[PROCURAR_DATAS][validar-endereco] ${event.tipo} duracaoMs=${Date.now() - inicio}`)
      }

      const google = await consultarGoogleGeocodingEnderecoDificil(body, { onEvent: logGoogle })
      if (google.status === 'success') {
        const cacheSave = await salvarEnderecoNoGeoCache(body, google.resultado)
        if (!cacheSave.ok) {
          console.warn(
            `[PROCURAR_DATAS][validar-endereco] geo_cache_save_failed provider=google_geocoding motivo=${cacheSave.erro} duracaoMs=${Date.now() - inicio}`
          )
        }

        const r = google.resultado
        const latStr = r.lat !== undefined ? r.lat.toFixed(5) : '-'
        const lngStr = r.lng !== undefined ? r.lng.toFixed(5) : '-'
        const addressTrunc = String(r.enderecoCompleto ?? r.display ?? r.display_name ?? '').slice(0, 80)
        console.log(
          `[PROCURAR_DATAS][validar-endereco] sucesso provider=google_geocoding fallback=google_geocoding` +
          ` lat=${latStr} lng=${lngStr}` +
          ` cep=${r.cep ?? '-'}` +
          ` address="${addressTrunc}"` +
          ` duracaoMs=${Date.now() - inicio}`
        )
        const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado: google.resultado }
        return NextResponse.json(resposta)
      }

      console.log(
        `[PROCURAR_DATAS][validar-endereco] google_fallback_failed motivo=${google.motivo} duracaoMs=${Date.now() - inicio}`
      )
    }

    console.log(`[PROCURAR_DATAS][validar-endereco] fallback_appsscript duracaoMs=${Date.now() - inicio}`)
    const resultado = await chamarAppsScriptProcurarDatas('LookupCompletoPorEndereco', [body], {
      rota: 'validar-endereco',
    }) as EnderecoValidado

    // Log sanitizado do resultado do fallback Apps Script
    const r = resultado
    const latStr = r.lat !== undefined ? r.lat.toFixed(5) : '-'
    const lngStr = r.lng !== undefined ? r.lng.toFixed(5) : '-'
    const addr = r.address as Record<string, unknown> | undefined
    const addressTrunc = String(r.enderecoCompleto ?? r.display ?? r.display_name ?? '').slice(0, 80)
    const source = (r as Record<string, unknown>).source as string | undefined
    console.log(
      `[PROCURAR_DATAS][validar-endereco][fallback_result]` +
      ` provider=appsscript source=${source ?? '-'} fallbackReason=locationiq_sem_resultado_valido` +
      ` lat=${latStr} lng=${lngStr}` +
      ` confidence=${r.confidence ?? '-'}` +
      ` cep=${r.cep ?? '-'}` +
      ` bairro="${addr?.suburb ?? '-'}"` +
      ` city="${addr?.city ?? '-'}"` +
      ` state="${addr?.state ?? '-'}"` +
      ` address="${addressTrunc}"` +
      ` duracaoMs=${Date.now() - inicio}`
    )

    console.log(
      `[PROCURAR_DATAS][validar-endereco] sucesso provider=appsscript fallback=appsscript` +
      ` fallbackReason=locationiq_sem_resultado_valido` +
      ` duracaoMs=${Date.now() - inicio}`
    )
    const resposta: ValidarEnderecoResponseSucesso = { ok: true, resultado }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][validar-endereco] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
