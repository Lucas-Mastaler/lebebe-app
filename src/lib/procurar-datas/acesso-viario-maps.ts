import { ErroLocalizacaoMaps, coordenadasMapsValidas, linkConferenciaMaps, type LocalizacaoMaps } from './localizacao-maps'
import type { ResultadoRotaOSRM } from './motor/osrm-route-client-diagnostico'
import type { CidadeUfMaps } from './cidade-uf-maps'

export type LocalizacaoMapsVerificada = LocalizacaoMaps & {
  regiao?: CidadeUfMaps | null
  acessoViario: { distanciaRotaM: number; distanciaAteViaM: number; pontoVia: { lat: number; lng: number }; conferirViaUrl: string }
}

export function verificarRotaLocalizacaoMaps(local: LocalizacaoMaps, rota: ResultadoRotaOSRM): LocalizacaoMapsVerificada {
  const via = rota.associacaoDestino
  if (!rota.ok || rota.distanciaM == null || !Number.isFinite(rota.distanciaM) || rota.distanciaM < 0 ||
    !via || !coordenadasMapsValidas(via.lat, via.lng) || !Number.isFinite(via.distanciaAteViaM) || via.distanciaAteViaM < 0) {
    throw new ErroLocalizacaoMaps('rota-nao-confirmada', 'Não foi possível confirmar rota de acesso para esse local. Peça ao cliente o ponto de entrada da propriedade ou outro link do Google Maps.', 422)
  }
  return { ...local, acessoViario: { distanciaRotaM: rota.distanciaM, distanciaAteViaM: via.distanciaAteViaM,
    pontoVia: { lat: via.lat, lng: via.lng }, conferirViaUrl: linkConferenciaMaps(via) } }
}
