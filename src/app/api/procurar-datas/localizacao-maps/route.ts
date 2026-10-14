import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import { resolverLinkMaps } from '@/lib/procurar-datas/resolver-link-maps'
import { ErroLocalizacaoMaps } from '@/lib/procurar-datas/localizacao-maps'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-route-client-diagnostico'
import { verificarRotaLocalizacaoMaps } from '@/lib/procurar-datas/acesso-viario-maps'
import { consultarCidadeUfMaps } from '@/lib/procurar-datas/cidade-uf-maps'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  const acesso = await validarAcessoProcurarDatas()
  if (acesso.response) return acesso.response
  try {
    const body = await request.json().catch(() => { throw new ErroLocalizacaoMaps('entrada-invalida', 'Envie um JSON válido com o campo entrada.') })
    if (typeof body?.entrada !== 'string') throw new ErroLocalizacaoMaps('entrada-invalida', 'Informe um link do Google Maps ou latitude, longitude.')
    const local = await resolverLinkMaps(body.entrada)
    const configResult = await buscarConfiguracoesProcurarDatas()
    if (!configResult.ok) throw new ErroLocalizacaoMaps('config-indisponivel', 'Não foi possível verificar o acesso viário. Tente novamente.', 503)
    const config = configResult.config
    const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({ baseUrl: config.osrmBaseUrl.replace(/\/+$/, ''), timeoutMs: 5000 })
    const [rota, regiao] = await Promise.all([
      buscarRota({ lat: config.latDeposito, lng: config.lngDeposito }, local),
      consultarCidadeUfMaps(local),
    ])
    const resultado = { ...verificarRotaLocalizacaoMaps(local, rota), nome: local.nome || regiao?.nome, regiao }
    console.info('[procurar-datas:localizacao-maps]', { status: 'identificada', fonte: local.fonte, duracaoMs: Date.now() - inicio })
    return NextResponse.json({ ok: true, resultado }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const falha = error instanceof ErroLocalizacaoMaps ? error : new ErroLocalizacaoMaps('falha-resolucao', 'Não foi possível identificar a localização. Confira o link ou informe coordenadas diretamente.', 502)
    console.warn('[procurar-datas:localizacao-maps]', { status: falha.codigo, duracaoMs: Date.now() - inicio })
    return NextResponse.json({ ok: false, codigo: falha.codigo, error: falha.message }, { status: falha.status, headers: { 'Cache-Control': 'no-store' } })
  }
}
