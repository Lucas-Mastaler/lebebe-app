import { describe, expect, it } from 'vitest'
import { isDescricaoVolumeAvulso } from './volume-avulso'

describe('isDescricaoVolumeAvulso', () => {
  it('detecta "VOLUME" maiúsculo como palavra completa (caso real do recebimento 33)', () => {
    expect(isDescricaoVolumeAvulso('VOLUME 01- OFF WHITE/FREIJO/ECO')).toBe(true)
  })

  it('detecta "Volume" e "volume" (case-insensitive)', () => {
    expect(isDescricaoVolumeAvulso('Volume 01- Off White')).toBe(true)
    expect(isDescricaoVolumeAvulso('volume 01- off white')).toBe(true)
  })

  it('não detecta descrição normal de produto sem a palavra VOLUME', () => {
    expect(isDescricaoVolumeAvulso('BERCO ZUPY NEW MATIC OFF WHITE/FREIJO/ECOWOOD')).toBe(false)
  })

  it('não gera falso positivo para palavras que apenas contêm "vol" como substring', () => {
    expect(isDescricaoVolumeAvulso('VOLANTE INFANTIL')).toBe(false)
    expect(isDescricaoVolumeAvulso('REVOLUCAO')).toBe(false)
  })

  it('trata descrição vazia/nula como não-volume-avulso', () => {
    expect(isDescricaoVolumeAvulso('')).toBe(false)
    expect(isDescricaoVolumeAvulso(null)).toBe(false)
    expect(isDescricaoVolumeAvulso(undefined)).toBe(false)
  })
})
