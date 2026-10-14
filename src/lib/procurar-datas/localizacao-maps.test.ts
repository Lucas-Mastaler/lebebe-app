import { describe, expect, it, vi } from 'vitest'
import { deveAvisarAssociacaoViaMaps, extrairLocalizacaoMaps } from './localizacao-maps'
import { resolverLinkMaps } from './resolver-link-maps'
import { verificarRotaLocalizacaoMaps } from './acesso-viario-maps'

export const LINK_CASA_NOSTRA = 'https://www.google.com/maps/place/S%C3%ADtio+Casa+Nostra/@-25.6963932,-49.5036726,17z/data=!3m1!4b1!4m6!3m5!1s0x94dd07003d047569:0x1c0807c7aafc2425!8m2!3d-25.6963932!4d-49.5036726!16s%2Fg%2F11wr2czrc5'
const SHORT = 'https://maps.app.goo.gl/tpSem2ECruxWx4AF6?g_st=iw'
const esperado = { lat: -25.6963932, lng: -49.5036726 }
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })

describe('localização explícita do Google Maps', () => {
  it.each([
    'https://www.google.com/maps/search/-25.665061,+-49.298785?entry=tts&g_ep=EgoyMDI2MTAxMS4wIPu8ASoASAFQAw%3D%3D&skid=17137bbe-8278-4935-a319-77f3e824d498',
    'https://www.google.com/maps/search/-25.665061,%20-49.298785',
    'https://www.google.com/maps/search/%2D25.665061%2C%20%2D49.298785/',
    'https://www.google.com/maps/search/-25.665061, -49.298785',
    'https://www.google.com/maps/search/?query=-25.665061%2C+-49.298785',
    'https://maps.google.com/?q=-25.665061%2C%20-49.298785',
    'https://www.google.com/maps/search/-25.665061,+-49.298785?q=-25.665061,-49.298785',
    'https://www.google.com/maps/search/-25.665061,+-49.298785/@-20,-40,16z',
  ])('ponto sem estabelecimento é extraído localmente: %s', async(url)=>{
    const fetchImpl=vi.fn<typeof fetch>()
    expect(await resolverLinkMaps(url,fetchImpl)).toMatchObject({lat:-25.665061,lng:-49.298785,fonte:'google-maps-pesquisa-coordenadas',linkOriginal:url})
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it.each(['https://www.google.com/maps/search/91,-49','https://www.google.com/maps/search/-25,-181'])('valida intervalo no caminho: %s',(url)=>expect(()=>extrairLocalizacaoMaps(url)).toThrow('Latitude deve'))
  it('pares diferentes no caminho e parâmetro são ambíguos',()=>expect(()=>extrairLocalizacaoMaps('https://www.google.com/maps/search/-25,-49?q=-26,-50')).toThrow('mais de um ponto'))
  it.each([
    'https://www.google.com/maps/dir/Curitiba/Contenda/data=!3d-25!4d-49',
    'https://www.google.com/maps/preview/dir/Curitiba/Contenda/data=!3d-25!4d-49',
    'https://www.google.com/maps/dir/?api=1&origin=-25,-49&destination=-26,-50',
    'https://maps.google.com/?saddr=-25,-49&daddr=-26,-50',
    'https://www.google.com/maps/dir/?api=1&destination=-26,-50&waypoints=-25,-49',
    'https://www.google.com/maps/search/-25,-49?origin=-25,-49&destination=-26,-50',
  ])('rejeita rota por sua estrutura, sem selecionar origem ou destino: %s', (url) => {
    expect(() => extrairLocalizacaoMaps(url)).toThrow('Este link contém uma rota com mais de um local')
  })
  it('aceita repetições do mesmo pin e obtém nome informado no link', () => {
    expect(extrairLocalizacaoMaps('https://www.google.com/maps/place/S%C3%ADtio+Casa+Nostra/@-20,-40/data=!3d-25.0!4d-49!3d-25!4d-49.0'))
      .toMatchObject({ lat: -25, lng: -49, nome: 'Sítio Casa Nostra' })
  })
  it('extrai o ponto do exemplo real e ignora centro de visualização diferente', () => {
    expect(extrairLocalizacaoMaps(LINK_CASA_NOSTRA.replace('@-25.6963932,-49.5036726', '@-20,-40'))).toMatchObject({ ...esperado, fonte: 'google-maps-ponto' })
  })
  it.each(['-25.6963932, -49.5036726', '(-25.6963932,-49.5036726)', 'https://www.google.com/maps/search/?api=1&query=-25.6963932%2C-49.5036726',
    'https://maps.google.com/?q=loc:-25.6963932,-49.5036726'])('aceita coordenadas explícitas: %s', (entrada) => {
    expect(extrairLocalizacaoMaps(entrada)).toMatchObject(esperado)
  })
  it('aceita zero e extremos geográficos, sem confundir zero com ausência', () => {
    expect(extrairLocalizacaoMaps('0,0')).toMatchObject({ lat: 0, lng: 0 })
    expect(extrairLocalizacaoMaps('-90,180')).toMatchObject({ lat: -90, lng: 180 })
  })
  it.each(['91,0', '0,-181', 'https://www.google.com/maps/place/X/data=!3d91!4d10'])('recusa coordenadas fora de faixa: %s', (entrada) => {
    expect(() => extrairLocalizacaoMaps(entrada)).toThrow('Latitude deve estar')
  })
  it.each(['https://www.google.com/maps/place/Sitio/@-25.6,-49.5,17z', 'https://www.google.com/maps/?center=-25.6,-49.5',
    'https://maps.google.com/?q=Sitio&ftid=0x123:0x456', 'https://www.google.com/maps/search/?api=1&query=Sitio',
    'https://www.google.com/maps/search/?api=1&query=-25,-49&query_place_id=ChIJexemplo'])('não presume o ponto pelo centro, nome ou identificador: %s', (entrada) => {
    expect(extrairLocalizacaoMaps(entrada)).toBeNull()
  })
  it('recusa múltiplos pontos ambíguos', () => {
    expect(() => extrairLocalizacaoMaps('https://www.google.com/maps/place/X/data=!3d-25!4d-49!3d-26!4d-50')).toThrow('mais de um ponto')
  })
})

describe('resolução restrita de links curtos', () => {
  it('resolve redirecionamentos aprovados e extrai as coordenadas finais', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(redirect('https://maps.google.com/maps?q=Sitio'))
      .mockResolvedValueOnce(redirect(LINK_CASA_NOSTRA))
    expect(await resolverLinkMaps(SHORT, fetchImpl)).toMatchObject(esperado)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual', cache: 'no-store' })
  })
  it.each(['http://127.0.0.1/maps', 'https://127.0.0.1/maps', 'https://www.google.com.evil.test/maps',
    'https://www.google.com@evil.test/maps', 'https://www.google.com:444/maps', 'https://evil.test/',
    'file:///etc/passwd', 'https://www.google.com/url?q=http://127.0.0.1', 'https://maps.app.goo.gl.evil.test/test'])('bloqueia entrada não autorizada: %s', async (url) => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(resolverLinkMaps(url, fetchImpl)).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('não faz requisição ao destino malicioso de um redirecionamento', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(redirect('http://169.254.169.254/latest/meta-data/'))
    await expect(resolverLinkMaps(SHORT, fetchImpl)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('trata o formato real do link curto sem inventar ponto pelo ftid ou HTML', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(redirect('https://maps.google.com/maps?q=Sitio+Casa+Nostra&ftid=0x123:0x456'))
      .mockResolvedValueOnce(new Response('<meta property="og:image" content="center=-20,-40">'))
    await expect(resolverLinkMaps(SHORT, fetchImpl)).rejects.toThrow('Não conseguimos identificar esse lugar pelo link curto')
  })
  it('nome sem chave/API paga oferece entrada manual e não faz chamadas', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(resolverLinkMaps('https://www.google.com/maps/search/?api=1&query=Sitio', fetchImpl)).rejects.toThrow('Esse link não informa um ponto exato')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(await resolverLinkMaps(LINK_CASA_NOSTRA, fetchImpl)).toMatchObject(esperado)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('falha de rede não expõe a URL nem o erro interno', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('detalhe privado'))
    await expect(resolverLinkMaps(SHORT, fetchImpl)).rejects.toThrow('Não foi possível resolver o link')
  })
  it('bloqueia loops', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(redirect(SHORT))
    await expect(resolverLinkMaps(SHORT, fetchImpl)).rejects.toThrow('redirecionamentos repetidos')
  })
})

describe('acesso viário rural', () => {
  it.each([[0, false], [388, false], [999.9, false], [1000, false], [1000.01, true], [1500, true]])(
    'aviso visual em %s m é %s, sem arredondar antes do limite', (distancia, esperado) => {
      expect(deveAvisarAssociacaoViaMaps(Number(distancia))).toBe(esperado)
    })
  it('preserva a coordenada original e expõe o deslocamento até a via sem criar limiar', () => {
    const local = extrairLocalizacaoMaps(LINK_CASA_NOSTRA)!
    const resultado = verificarRotaLocalizacaoMaps(local, { ok: true, distanciaM: 42000,
      associacaoDestino: { lat: -25.69, lng: -49.50, distanciaAteViaM: 1500 } })
    expect(resultado).toMatchObject({ ...esperado, acessoViario: { distanciaAteViaM: 1500 } })
    expect(resultado.acessoViario.pontoVia.lat).not.toBe(resultado.lat)
  })
  it.each([{ ok: false, distanciaM: null }, { ok: true, distanciaM: 0 },
    { ok: true, distanciaM: 42000, associacaoDestino: { lat: 91, lng: 0, distanciaAteViaM: 10 } }])('não confirma rota sem evidência válida', (rota) => {
    expect(() => verificarRotaLocalizacaoMaps(extrairLocalizacaoMaps(LINK_CASA_NOSTRA)!, rota)).toThrow('Não foi possível confirmar rota')
  })
})
