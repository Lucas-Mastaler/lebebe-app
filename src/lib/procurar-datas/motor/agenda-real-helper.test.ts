// ─────────────────────────────────────────────────────────────────────────────
// motor/agenda-real-helper.test.ts
//   Testes unitários para buscarAgendaRealDiagnostica e buscarAgendaRealDiagnosticaComDados
//
//   NOTA: Testes de integração real com Google Sheets são executados manualmente
//   via DevTools. Estes testes cobrem cenários controlados com mocks.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock do googleapis
const mockGet = vi.fn()
const mockValuesGet = vi.fn()

vi.mock('googleapis', () => {
  const mockSheets = vi.fn(() => ({
    spreadsheets: {
      get: mockGet,
      values: {
        get: mockValuesGet,
      },
    },
  }))
  return {
    google: {
      sheets: mockSheets,
    },
  }
})

// Importar após mock
import { buscarAgendaRealDiagnostica, buscarAgendaRealDiagnosticaComDados } from './agenda-real-helper'

describe('agenda-real-helper', () => {
  const envOriginal = { ...process.env }

  afterEach(() => {
    vi.clearAllMocks()
    // Reset env to original
    Object.keys(process.env).forEach((key) => delete (process.env as Record<string, string | undefined>)[key])
    Object.assign(process.env, envOriginal)
  })

  describe('buscarAgendaRealDiagnosticaComDados', () => {
    it('1. retorna erro quando credenciais OAuth não estão configuradas', async () => {
      // Garante que as credenciais não estão configuradas
      delete process.env.GOOGLE_OAUTH_CLIENT_ID
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET
      delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = ''
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = ''

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(false)
      expect(result.diagnostico.executado).toBe(true)
      expect('erro' in result.diagnostico && result.diagnostico.erro).toContain('Variáveis de ambiente Google OAuth')
      expect(result.linhasAgenda).toEqual([])
    })

    it('2. retorna erro quando aba não é encontrada pelo gid', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [
            { properties: { sheetId: 99999, title: 'Outra Aba' } },
          ],
        },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(false)
      expect(result.diagnostico.executado).toBe(true)
      expect('erro' in result.diagnostico && result.diagnostico.erro).toContain('Aba com gid')
      expect(result.linhasAgenda).toEqual([])
    })

    it('3. retorna sucesso com linhas convertidas corretamente', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['DATA', '', 'TITULO', '', 'OBS', 'ENDERECO', 'EQUIPE'], // cabeçalho
            ['03/07/2026', '', 'Entrega A', '', '', 'Rua A, 123', 'EQUIPE 1'],
            ['03/07/2026', '', 'Entrega B', '', '', 'Rua B, 456', 'EQUIPE 1'],
            ['04/07/2026', '', 'Entrega C', '', '', 'Rua C, 789', 'EQUIPE 2'],
          ],
        },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(true)
      expect(result.diagnostico.executado).toBe(true)
      if ('origem' in result.diagnostico && result.diagnostico.origem && 'abaNomeResolvido' in result.diagnostico.origem) {
        expect(result.diagnostico.origem.abaNomeResolvido).toBe('AGENDA')
      }
      expect(result.linhasAgenda).toHaveLength(3)
      expect(result.linhasAgenda[0]).toEqual([
        '03/07/2026',
        '',
        'Entrega A',
        '',
        '',
        'Rua A, 123',
        'EQUIPE 1',
      ])
      expect(result.linhasAgenda[1]).toEqual([
        '03/07/2026',
        '',
        'Entrega B',
        '',
        '',
        'Rua B, 456',
        'EQUIPE 1',
      ])
    })

    it('4. aplica limite corretamente', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      // Cria 10 linhas de dados
      const valores = [
        ['DATA', '', 'TITULO', '', 'OBS', 'ENDERECO', 'EQUIPE'], // cabeçalho
        ...Array.from({ length: 10 }, (_, i) => [
          `0${(i + 1).toString().padStart(2, '0')}/07/2026`,
          '',
          `Entrega ${i + 1}`,
          '',
          '',
          `Rua ${String.fromCharCode(65 + i)}, ${i + 1}00`,
          'EQUIPE 1',
        ]),
      ]

      mockValuesGet.mockResolvedValueOnce({
        data: { values: valores },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(5)

      expect(result.diagnostico.ok).toBe(true)
      expect(result.linhasAgenda).toHaveLength(5)
      if ('leitura' in result.diagnostico && result.diagnostico.leitura) {
        expect(result.diagnostico.leitura.linhasLidas).toBe(11) // cabeçalho + 10 dados
        expect(result.diagnostico.leitura.linhasConvertidas).toBe(5) // limitado a 5
      }
    })

    it('5. preenche elementos ausentes com string vazia', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['DATA', '', 'TITULO', '', 'OBS', 'ENDERECO', 'EQUIPE'], // cabeçalho
            ['03/07/2026', '', 'Entrega Incompleta'], // linha curta (3 elementos)
          ],
        },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(true)
      expect(result.linhasAgenda).toHaveLength(1)
      expect(result.linhasAgenda[0]).toHaveLength(7)
      expect(result.linhasAgenda[0]).toEqual([
        '03/07/2026',
        '',
        'Entrega Incompleta',
        '',
        '',
        '', // preenchido
        '', // preenchido
      ])
    })

    it('6. retorna array vazio quando planilha está vazia', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockResolvedValueOnce({
        data: { values: null },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(true)
      expect(result.linhasAgenda).toEqual([])
    })

    it('7. retorna array vazio quando só tem cabeçalho', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockResolvedValueOnce({
        data: {
          values: [['DATA', '', 'TITULO', '', 'OBS', 'ENDERECO', 'EQUIPE']], // só cabeçalho
        },
      })

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(true)
      expect(result.linhasAgenda).toEqual([])
      if ('leitura' in result.diagnostico && result.diagnostico.leitura) {
        expect(result.diagnostico.leitura.linhasConvertidas).toBe(0)
      }
    })

    it('8. retorna erro controlado quando Google Sheets falha', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockRejectedValueOnce(new Error('Erro de autenticação'))

      const result = await buscarAgendaRealDiagnosticaComDados(100)

      expect(result.diagnostico.ok).toBe(false)
      expect(result.diagnostico.executado).toBe(true)
      expect('erro' in result.diagnostico && result.diagnostico.erro).toContain('Falha ao ler planilha')
      expect('erro' in result.diagnostico && result.diagnostico.erro).toContain('Erro de autenticação')
      expect(result.linhasAgenda).toEqual([])
    })
  })

  describe('buscarAgendaRealDiagnostica', () => {
    it('9. retorna apenas o bloco diagnostico (backward compatibility)', async () => {
      // Setup env
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh-token'

      mockGet.mockResolvedValueOnce({
        data: {
          sheets: [{ properties: { sheetId: 1324794210, title: 'AGENDA' } }],
        },
      })

      mockValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['DATA', '', 'TITULO', '', 'OBS', 'ENDERECO', 'EQUIPE'],
            ['03/07/2026', '', 'Entrega A', '', '', 'Rua A, 123', 'EQUIPE 1'],
          ],
        },
      })

      const result = await buscarAgendaRealDiagnostica(100)

      expect(result.ok).toBe(true)
      expect(result.executado).toBe(true)
      if ('origem' in result && result.origem && 'abaNomeResolvido' in result.origem) {
        expect(result.origem.abaNomeResolvido).toBe('AGENDA')
      }
      // Não retorna linhasAgenda (apenas diagnostico)
      expect('linhasAgenda' in result).toBe(false)
    })
  })
})
