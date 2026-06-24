import { describe, expect, it, vi } from 'vitest'
import type { ProgressoPesquisa } from '../contratos'
import {
  salvarProgressoCompat,
  buscarProgressoCompat,
  separarNormaisExtras,
  montarProgressoDone,
  montarProgressoError,
  criarProgressoInicial,
  progressoWaiting,
  PROGRESSO_COMPAT_TTL_S,
} from './progresso-compat-store'

function criarRedisMock() {
  const store = new Map<string, string>()
  return {
    store,
    set: vi.fn(async (key: string, value: unknown, _opts?: unknown) => {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value))
      return 'OK'
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key) ?? null
    }),
  }
}

describe('progresso-compat-store', () => {
  describe('PROGRESSO_COMPAT_TTL_S', () => {
    it('TTL é 600 segundos (10 minutos)', () => {
      expect(PROGRESSO_COMPAT_TTL_S).toBe(600)
    })
  })

  describe('criarProgressoInicial', () => {
    it('cria progresso com status queued e arrays vazios', () => {
      const p = criarProgressoInicial('tok-abc')
      expect(p.status).toBe('queued')
      expect(p.clientToken).toBe('tok-abc')
      expect(p.normais).toEqual([])
      expect(p.extras).toEqual([])
      expect(typeof p.timestamp).toBe('number')
      expect(typeof p.startedAt).toBe('string')
    })
  })

  describe('progressoWaiting', () => {
    it('cria progresso com status waiting sem clientToken', () => {
      const p = progressoWaiting()
      expect(p.status).toBe('waiting')
      expect(p.clientToken).toBeUndefined()
      expect(p.normais).toEqual([])
      expect(p.extras).toEqual([])
    })
  })

  describe('separarNormaisExtras', () => {
    it('separa corretamente normais (isExtra=false) e extras (isExtra=true)', () => {
      const cands = [
        { isExtra: false, rank: 1, dateISO: 'a', dateDM: '', weekday: '', daysLeftTxt: '', encomenda: '', frete: '', team: '', tipo: 'normal', avisoHoraMarcada: '' },
        { isExtra: true, rank: 2, dateISO: 'b', dateDM: '', weekday: '', daysLeftTxt: '', encomenda: '', frete: '', team: '', tipo: 'especial', avisoHoraMarcada: '' },
        { isExtra: false, rank: 3, dateISO: 'c', dateDM: '', weekday: '', daysLeftTxt: '', encomenda: '', frete: '', team: '', tipo: 'normal', avisoHoraMarcada: '' },
      ]
      const { normais, extras } = separarNormaisExtras(cands)
      expect(normais).toHaveLength(2)
      expect(extras).toHaveLength(1)
      expect(extras[0].rank).toBe(2)
    })

    it('retorna arrays vazios quando lista vazia', () => {
      const { normais, extras } = separarNormaisExtras([])
      expect(normais).toEqual([])
      expect(extras).toEqual([])
    })
  })

  describe('montarProgressoDone', () => {
    it('monta progresso done com payload, normais, extras e tempos', () => {
      const payload = { ok: true, cep: '01310-100', candidates: [] } as unknown as ProgressoPesquisa['payload']
      const cands = [
        { isExtra: false, rank: 1, dateISO: 'x', dateDM: '', weekday: '', daysLeftTxt: '', encomenda: '', frete: 'R$ 100', team: 'EQUIPE 1', tipo: 'normal', avisoHoraMarcada: '' },
        { isExtra: true, rank: 2, dateISO: 'y', dateDM: '', weekday: '', daysLeftTxt: '', encomenda: '', frete: 'R$ 150', team: 'EQUIPE 1', tipo: 'especial', avisoHoraMarcada: '' },
      ]
      const inicioMs = Date.now() - 3000
      const p = montarProgressoDone('tok-done', cands, payload, new Date(inicioMs).toISOString(), inicioMs)

      expect(p.status).toBe('done')
      expect(p.clientToken).toBe('tok-done')
      expect(p.normais).toHaveLength(1)
      expect(p.extras).toHaveLength(1)
      expect(p.payload).toBe(payload)
      expect(typeof p.durationMs).toBe('number')
      expect(p.durationMs!).toBeGreaterThanOrEqual(0)
      expect(typeof p.finishedAt).toBe('string')
    })
  })

  describe('montarProgressoError', () => {
    it('monta progresso error com mensagem e arrays vazios', () => {
      const inicioMs = Date.now() - 1000
      const p = montarProgressoError('tok-err', 'Falhou X', new Date(inicioMs).toISOString(), inicioMs)

      expect(p.status).toBe('error')
      expect(p.clientToken).toBe('tok-err')
      expect(p.error).toBe('Falhou X')
      expect(p.normais).toEqual([])
      expect(p.extras).toEqual([])
      expect(typeof p.durationMs).toBe('number')
    })
  })

  describe('salvarProgressoCompat', () => {
    it('chama redis.set com chave correta e TTL', async () => {
      const redisMock = criarRedisMock()
      const progresso = criarProgressoInicial('tok-set')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await salvarProgressoCompat('tok-set', progresso, redisMock as any)

      expect(redisMock.set).toHaveBeenCalledTimes(1)
      const [chave, , opcoes] = redisMock.set.mock.calls[0]
      expect(chave).toBe('procurar-datas:v2:progress:tok-set')
      expect(opcoes).toMatchObject({ ex: PROGRESSO_COMPAT_TTL_S })
    })

    it('nao lanca erro quando redis é null (credenciais ausentes)', async () => {
      const progresso = criarProgressoInicial('tok-null')
      await expect(salvarProgressoCompat('tok-null', progresso, null)).resolves.toBeUndefined()
    })
  })

  describe('buscarProgressoCompat', () => {
    it('retorna progresso salvo anteriormente', async () => {
      const redisMock = criarRedisMock()
      const progresso = criarProgressoInicial('tok-get')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await salvarProgressoCompat('tok-get', progresso, redisMock as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recuperado = await buscarProgressoCompat('tok-get', redisMock as any)

      expect(recuperado).not.toBeNull()
      expect(recuperado!.status).toBe('queued')
      expect(recuperado!.clientToken).toBe('tok-get')
    })

    it('retorna null quando token nao existe', async () => {
      const redisMock = criarRedisMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await buscarProgressoCompat('tok-inexistente', redisMock as any)
      expect(result).toBeNull()
    })

    it('retorna null quando redis é null (credenciais ausentes)', async () => {
      const result = await buscarProgressoCompat('tok-qualquer', null)
      expect(result).toBeNull()
    })

    it('retorna null se valor armazenado nao é JSON válido', async () => {
      const redisMock = criarRedisMock()
      redisMock.store.set('procurar-datas:v2:progress:tok-broken', 'nao-e-json{{{')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await buscarProgressoCompat('tok-broken', redisMock as any)
      expect(result).toBeNull()
    })
  })
})
