import { buscarConfiguracoesProcurarDatas } from './config-service'
import { calcularFrete } from './motor/frete'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from './motor/osrm-route-client-diagnostico'
import type { ValorInicialRequest, ValorInicialResultado } from './contratos'
import type { FreteParams } from './motor/types'

function fmtMoneyBR(n: number): string {
  return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fallbackValorInicial(params: FreteParams | null, isRural: boolean, isCondominio: boolean, msg: string): ValorInicialResultado {
  let minFrete = params?.valorSemanaAte10km || 130
  if (isRural) minFrete += 100
  if (isCondominio) minFrete += params?.precoCondominioAdicional || 0
  minFrete = Math.ceil(minFrete / 10) * 10
  minFrete = Math.ceil((minFrete * 1.2) / 10) * 10
  if (minFrete < 110) minFrete = 110

  return {
    ok: false,
    valor: minFrete,
    valorFormatado: fmtMoneyBR(minFrete),
    valorFmt: fmtMoneyBR(minFrete),
    distanciaKm: null,
    fallbackUsado: true,
    msg,
  }
}

export async function calcularValorInicialLocal(form: ValorInicialRequest): Promise<ValorInicialResultado> {
  const configResult = await buscarConfiguracoesProcurarDatas()
  if (!configResult.ok) {
    throw new Error(configResult.erro)
  }

  const config = configResult.config
  const params: FreteParams = {
    kmMaxViagem: config.kmMaxViagem,
    kmMaxValorFixo: config.kmMaxValorFixo,
    kmMaxLongaCidade: config.kmMaxLongaCidade,
    kmMaxNaoViagem: config.kmMaxNaoViagem,
    valorSemanaAte10km: config.valorSemanaAte10km,
    valorSabadoAte10km: config.valorSabadoAte10km,
    fatorMultiplicadorKmViagem: config.fatorMultiplicadorKmViagem,
    multiplicadorKmNaoViagem: config.multiplicadorKmNaoViagem,
    valorDiaApos25kmSemana: config.valorDiaApos25kmSemana,
    valorDiaApos25kmSabado: config.valorDiaApos25kmSabado,
    precoCondominioAdicional: config.precoCondominioAdicional,
  }

  const destLat = form.destLat ?? form.lat
  const destLng = form.destLng ?? form.lng
  if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
    return fallbackValorInicial(params, form.isRural === true, form.isCondominio === true, 'Sem coordenadas')
  }

  if (!Number.isFinite(config.latDeposito) || !Number.isFinite(config.lngDeposito)) {
    return fallbackValorInicial(params, form.isRural === true, form.isCondominio === true, 'Deposito sem coordenadas')
  }

  const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
    baseUrl: String(config.osrmBaseUrl || 'https://osrm.lebebe.cloud').replace(/\/+$/, ''),
    timeoutMs: 5000,
  })
  const rota = await buscarRota(
    { lat: config.latDeposito, lng: config.lngDeposito },
    { lat: Number(destLat), lng: Number(destLng) }
  )

  if (!rota.ok || rota.distanciaM == null) {
    return fallbackValorInicial(params, form.isRural === true, form.isCondominio === true, `OSRM falhou: ${rota.erro ?? 'erro desconhecido'}`)
  }

  const distanciaKm = rota.distanciaM / 1000
  const frete = calcularFrete({
    distKm: distanciaKm,
    isSabado: false,
    isRural: form.isRural === true,
    isCondominio: form.isCondominio === true,
    params,
  })

  return {
    ok: frete.ok,
    valor: frete.ok ? frete.valorFrete : null,
    valorFormatado: frete.ok ? frete.valorFormatado : '',
    valorFmt: frete.ok ? frete.valorFormatado : '',
    distanciaKm,
    fallbackUsado: false,
    msg: frete.ok ? 'OK' : frete.valorFormatado,
  }
}

