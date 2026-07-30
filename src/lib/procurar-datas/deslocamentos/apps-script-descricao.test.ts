import { describe, it, expect } from 'vitest'
import {
  formatarLinhaBackend,
  buildMapsLinkBackendCoordenadas,
  buildMapsLinkBackendEnderecos,
} from './apps-script-descricao'

const pontoBase = {
  enderecoOriginal: 'Rua Capitão Tenente Maris de Barros, 243, Portão, Curitiba - PR, 80330-340',
  display:
    '243, Rua Capitão Tenente Maris de Barros, Portão, Curitiba, Região Geográfica Imediata de Curitiba, Região Metropolitana de Curitiba, Região Geográfica Intermediária de Curitiba, Paraná, Região Sul, 80330-000, Brasil',
  lat: -25.123,
  lng: -49.456,
  referencias: [
    { linha: 42, eventId: 'evt-1', titulo: '1 (00:30) PORTÃO OS 4715 (PORTÃO) (CHEGOU)' },
  ],
}

describe('apps-script-descricao', () => {
  describe('formatarLinhaBackend', () => {
    it('exibe endereco original e refs sem bloco GEO', () => {
      const linha = formatarLinhaBackend(pontoBase)
      expect(linha).toContain(pontoBase.enderecoOriginal)
      expect(linha).toContain('refs: linha 42 | event evt-1 | 1 (00:30) PORTÃO OS 4715 (PORTÃO) (CHEGOU)')
      expect(linha).not.toContain('GEO:')
    })

    it('nao inclui termos poluidores da geocodificacao', () => {
      const linha = formatarLinhaBackend(pontoBase)
      expect(linha).not.toContain('Região Geográfica Imediata')
      expect(linha).not.toContain('Região Metropolitana')
      expect(linha).not.toContain('Região Geográfica Intermediária')
      expect(linha).not.toContain('Região Sul')
    })

    it('usa display como fallback quando nao ha endereco original', () => {
      const linha = formatarLinhaBackend({
        display: 'Rua Fallback, 1',
        referencias: [{ linha: 10 }],
      })
      expect(linha).toContain('Rua Fallback, 1')
    })

    it('retorna hifen quando nao ha endereco nem display', () => {
      const linha = formatarLinhaBackend({})
      expect(linha).toContain('-')
    })
  })

  describe('buildMapsLinkBackendCoordenadas', () => {
    it('mantem link por coordenadas na ordem origem -> paradas', () => {
      const link = buildMapsLinkBackendCoordenadas(
        { lat: -25.493, lng: -49.276 },
        [pontoBase]
      )
      const decoded = decodeURIComponent(link)
      expect(link).toContain('https://www.google.com/maps/dir/')
      expect(decoded).toContain('-25.493,-49.276')
      expect(decoded).toContain('-25.123,-49.456')
      expect(decoded.indexOf('-25.493,-49.276')).toBeLessThan(decoded.indexOf('-25.123,-49.456'))
    })

    it('ignora coordenada 0,0', () => {
      const link = buildMapsLinkBackendCoordenadas(
        { lat: 0, lng: 0 },
        [pontoBase]
      )
      const decoded = decodeURIComponent(link)
      expect(decoded).not.toContain('0,0')
      expect(decoded).toContain('-25.123,-49.456')
    })
  })

  describe('buildMapsLinkBackendEnderecos', () => {
    it('cria link com origem original seguida dos enderecos originais de rota.ordem', () => {
      const origem = 'R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450'
      const link = buildMapsLinkBackendEnderecos(origem, [pontoBase])
      expect(link).toContain('https://www.google.com/maps/dir/')
      expect(decodeURIComponent(link)).toContain(origem)
      expect(decodeURIComponent(link)).toContain(pontoBase.enderecoOriginal)
      expect(link.indexOf(encodeURIComponent(origem))).toBeLessThan(
        link.indexOf(encodeURIComponent(pontoBase.enderecoOriginal))
      )
    })

    it('preserva acentos e caracteres na codificacao', () => {
      const origem = 'Rua Capitão Tenente Maris de Barros, 243, Curitiba'
      const link = buildMapsLinkBackendEnderecos(origem, [])
      expect(decodeURIComponent(link)).toBe(
        'https://www.google.com/maps/dir/' + origem
      )
    })

    it('ignora enderecos vazios ou nulos', () => {
      const link = buildMapsLinkBackendEnderecos('Origem', [
        { enderecoOriginal: '' },
        { enderecoOriginal: '   ' },
        { enderecoOriginal: null as unknown as string },
        { enderecoOriginal: 'Parada válida' },
      ])
      const decoded = decodeURIComponent(link)
      expect(decoded).toContain('Origem')
      expect(decoded).toContain('Parada válida')
      expect(decoded.match(/Parada/g)).toHaveLength(1)
    })

    it('mantem origem mesmo sem paradas', () => {
      const link = buildMapsLinkBackendEnderecos('Apenas origem', [])
      expect(link).toBe('https://www.google.com/maps/dir/' + encodeURIComponent('Apenas origem'))
    })

    it('nao quebra quando origem e ausente', () => {
      const link = buildMapsLinkBackendEnderecos(undefined, [])
      expect(link).toBe('https://www.google.com/maps/dir/')
    })
  })
})
